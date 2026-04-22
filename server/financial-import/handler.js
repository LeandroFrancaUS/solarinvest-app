// server/financial-import/handler.js
// HTTP handlers for the financial import feature.
//
// Routes:
//   POST /api/financial-import/parse   — upload XLSX, run preview (no entity creation)
//   POST /api/financial-import/confirm — upload XLSX, run full import (creates entities)
//   GET  /api/financial-import/batches — list recent import batches (audit log)
//
// File upload: expects raw binary body (Content-Type: application/octet-stream)
// or multipart with a single file. Max 10 MB.

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import { previewImport, confirmImport } from './importService.js'
import { listImportBatches } from './repository.js'

const WRITE_ROLES = ['role_admin', 'role_office', 'role_financeiro']
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

function sendError(sendJson, statusCode, code, message) {
  sendJson(statusCode, { error: { code, message } })
}

function requireWriteRole(actor, sendJson) {
  if (!actor) {
    sendError(sendJson, 401, 'UNAUTHORIZED', 'Autenticação necessária.')
    return false
  }
  if (!WRITE_ROLES.includes(actorRole(actor))) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Perfil sem permissão para importação financeira.')
    return false
  }
  return true
}

async function getScopedSql(actor) {
  const db = getDatabaseClient()
  if (!db?.sql) {
    const err = new Error('Database not configured')
    err.statusCode = 503
    throw err
  }
  return createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })
}

/**
 * Read raw binary body from request. Returns a Buffer.
 * Supports both:
 *   - Content-Type: application/octet-stream  (raw bytes)
 *   - Content-Type: multipart/form-data       (extracts first file part)
 */
async function readBinaryBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalBytes = 0

    req.on('data', (chunk) => {
      totalBytes += chunk.length
      if (totalBytes > MAX_UPLOAD_BYTES) {
        reject(new Error(`Arquivo muito grande. Limite: ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`))
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      const raw = Buffer.concat(chunks)
      const contentType = req.headers['content-type'] ?? ''

      if (contentType.includes('multipart/form-data')) {
        // Extract binary content of the first file part from the multipart body
        try {
          const result = extractMultipartFile(raw, contentType)
          resolve(result)
        } catch (e) {
          reject(e)
        }
      } else {
        // Raw binary or base64 JSON
        if (contentType.includes('application/json')) {
          try {
            const json = JSON.parse(raw.toString('utf8'))
            if (typeof json.file === 'string') {
              // base64-encoded file
              resolve(Buffer.from(json.file, 'base64'))
            } else {
              reject(new Error('JSON body deve conter campo "file" em base64.'))
            }
          } catch {
            reject(new Error('Corpo JSON inválido.'))
          }
        } else {
          resolve(raw)
        }
      }
    })

    req.on('error', reject)
  })
}

/**
 * Minimal multipart/form-data parser.
 * Extracts the binary data of the first file field.
 */
function extractMultipartFile(buffer, contentType) {
  // Extract boundary from Content-Type header
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/)
  if (!boundaryMatch) throw new Error('Boundary não encontrado no Content-Type.')
  const boundary = Buffer.from('--' + boundaryMatch[1])

  // Find parts
  let pos = 0
  while (pos < buffer.length) {
    const boundaryPos = buffer.indexOf(boundary, pos)
    if (boundaryPos === -1) break

    pos = boundaryPos + boundary.length

    // Skip \r\n after boundary
    if (buffer[pos] === 0x0d && buffer[pos + 1] === 0x0a) pos += 2
    else if (buffer[pos] === 0x0a) pos += 1

    // Check for final boundary (--)
    if (buffer[pos] === 0x2d && buffer[pos + 1] === 0x2d) break

    // Read headers until double \r\n
    const headersEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), pos)
    if (headersEnd === -1) break
    const headers = buffer.slice(pos, headersEnd).toString('utf8')
    pos = headersEnd + 4

    // Only process file fields (Content-Disposition contains filename)
    if (!headers.includes('filename=')) continue

    // Data ends at the next boundary
    const nextBoundary = buffer.indexOf(boundary, pos)
    const dataEnd = nextBoundary === -1 ? buffer.length : nextBoundary - 2 // -2 for \r\n before boundary
    return buffer.slice(pos, dataEnd)
  }

  throw new Error('Nenhum arquivo encontrado no corpo multipart.')
}

function extractFileName(req) {
  // Try to get filename from Content-Disposition header
  const cd = req.headers['content-disposition'] ?? ''
  const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i)
  if (match) return decodeURIComponent(match[1])
  // Try from query string
  const url = new URL(req.url ?? '', 'http://localhost')
  return url.searchParams.get('filename') ?? 'import.xlsx'
}

// ── Route handlers ─────────────────────────────────────────────────────────

/**
 * POST /api/financial-import/parse
 * Upload XLSX → preview (no entity creation, creates batch with status='previewed').
 */
export async function handleFinancialImportParse(req, res, { method, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWriteRole(actor, sendJson)) return
  if (method !== 'POST') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  let buffer
  try {
    buffer = await readBinaryBody(req)
  } catch (err) {
    sendError(sendJson, 400, 'UPLOAD_ERROR', err.message)
    return
  }

  if (!buffer || buffer.length < 4) {
    sendError(sendJson, 400, 'EMPTY_FILE', 'Arquivo vazio ou inválido.')
    return
  }

  // Quick XLSX magic-byte check: PK\x03\x04 (ZIP)
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
    sendError(sendJson, 400, 'INVALID_FILE_TYPE', 'Apenas arquivos .xlsx são aceitos.')
    return
  }

  const fileName = extractFileName(req)
  const mergeMode = req.headers['x-import-merge-mode'] === 'true'

  try {
    const sql = await getScopedSql(actor)
    const result = await previewImport(sql, buffer, {
      fileName,
      userId: actor?.userId ?? null,
      mergeMode,
    })
    sendJson(200, {
      data: {
        batchId: result.batchId,
        items: result.items.map(serializePreviewItem),
        summary: result.summary,
        warnings: result.warnings,
      },
    })
  } catch (err) {
    console.error('[financial-import][parse] error', err?.message, err?.stack)
    const msg = err instanceof Error ? err.message : 'Erro ao processar o arquivo.'
    sendError(sendJson, 500, 'PARSE_ERROR', msg)
  }
}

/**
 * POST /api/financial-import/confirm
 * Upload XLSX → full import (creates clients/proposals/projects).
 */
export async function handleFinancialImportConfirm(req, res, { method, sendJson }) {
  const actor = await resolveActor(req)
  if (!requireWriteRole(actor, sendJson)) return
  if (method !== 'POST') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  let buffer
  try {
    buffer = await readBinaryBody(req)
  } catch (err) {
    sendError(sendJson, 400, 'UPLOAD_ERROR', err.message)
    return
  }

  if (!buffer || buffer.length < 4) {
    sendError(sendJson, 400, 'EMPTY_FILE', 'Arquivo vazio ou inválido.')
    return
  }

  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
    sendError(sendJson, 400, 'INVALID_FILE_TYPE', 'Apenas arquivos .xlsx são aceitos.')
    return
  }

  const fileName = extractFileName(req)
  const mergeMode = req.headers['x-import-merge-mode'] === 'true'
  const selectedSheets = req.headers['x-import-sheets']
    ? req.headers['x-import-sheets'].split(',').map((s) => s.trim()).filter(Boolean)
    : undefined

  try {
    const sql = await getScopedSql(actor)
    const result = await confirmImport(sql, buffer, {
      fileName,
      userId: actor?.userId ?? null,
      mergeMode,
      selectedSheets,
    })
    sendJson(201, {
      data: {
        batchId: result.batchId,
        report: result.report,
        counters: result.counters,
        warnings: result.warnings,
      },
    })
  } catch (err) {
    console.error('[financial-import][confirm] error', err?.message, err?.stack)
    const msg = err instanceof Error ? err.message : 'Erro ao importar dados.'
    sendError(sendJson, 500, 'IMPORT_ERROR', msg)
  }
}

/**
 * GET /api/financial-import/batches
 * List recent import batches (audit log).
 */
export async function handleFinancialImportBatches(req, res, { method, sendJson, requestUrl }) {
  const actor = await resolveActor(req)
  if (!requireWriteRole(actor, sendJson)) return
  if (method !== 'GET') {
    sendError(sendJson, 405, 'METHOD_NOT_ALLOWED', 'Método não permitido.')
    return
  }

  try {
    const sql = await getScopedSql(actor)
    const url = new URL(requestUrl ?? '', 'http://localhost')
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 100)
    const batches = await listImportBatches(sql, { limit, userId: actor.userId })
    sendJson(200, { data: batches })
  } catch (err) {
    console.error('[financial-import][batches] error', err?.message)
    sendError(sendJson, 500, 'DB_ERROR', 'Erro ao listar importações.')
  }
}

// ────────────────────────────────────────────────────────────────────────────

function serializePreviewItem(item) {
  return {
    sheetName: item.sheetName,
    worksheetType: item.worksheetType,
    sourceRowIndex: item.sourceRowIndex,
    clientName: item.clientName ?? null,
    uf: item.uf ?? null,
    usina: item.usina ?? null,
    financeiro: item.financeiro ?? null,
    entry: item.entry ?? null,
    match: item.match
      ? {
          clientId: item.match.clientId,
          clientName: item.match.clientName,
          clientConfidence: item.match.clientConfidence,
          clientMatchType: item.match.clientMatchType,
          proposalId: item.match.proposalId,
          projectId: item.match.projectId,
        }
      : null,
  }
}
