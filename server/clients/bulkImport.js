// server/clients/bulkImport.js
// Handlers for /api/clients/bulk-import/preview and /api/clients/bulk-import

import { getDatabaseClient } from '../database/neonClient.js'
import { createUserScopedSql } from '../database/withRLSContext.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import { checkDuplicateClient, createClientSafe } from './deduplication.js'

const MAX_BULK_ROWS = 500

function sendError(sendJson, statusCode, code, message) {
  sendJson(statusCode, { error: { code, message } })
}

function requireClientAuth(actor) {
  if (!actor?.userId) {
    const err = new Error('Login required')
    err.statusCode = 401
    throw err
  }
  if (!actor?.hasAnyRole) {
    const err = new Error('Access forbidden: no recognized role assigned')
    err.statusCode = 403
    throw err
  }
}

function handleAuthError(sendJson, err) {
  const status = err?.statusCode ?? 500
  if (status === 401) return sendError(sendJson, 401, 'UNAUTHENTICATED', err.message || 'Login required')
  if (status === 403) return sendError(sendJson, 403, 'FORBIDDEN', err.message || 'Access forbidden')
  return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Unexpected authentication error')
}

/**
 * POST /api/clients/bulk-import/preview
 *
 * Body: { rows: ImportRow[] }
 *
 * Returns deduplication analysis for each row without persisting anything.
 * Used to populate the smart preview UI.
 */
export async function handleBulkImportPreview(req, res, ctx) {
  const { readJsonBody, sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)

  const db = getDatabaseClient()
  if (!db) return sendError(sendJson, 503, 'SERVICE_UNAVAILABLE', 'Database not configured')

  let actor
  try {
    actor = await resolveActor(req)
    requireClientAuth(actor)
    if (actor.isFinanceiro && !actor.isAdmin) return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON')
  }

  const rows = body?.rows
  if (!Array.isArray(rows) || rows.length === 0) {
    return sendError(sendJson, 422, 'VALIDATION_ERROR', 'Field rows must be a non-empty array')
  }
  if (rows.length > MAX_BULK_ROWS) {
    return sendError(sendJson, 422, 'VALIDATION_ERROR', `Maximum ${MAX_BULK_ROWS} rows per import`)
  }

  const sql = createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })

  try {
    const results = await Promise.all(
      rows.map(async (row, index) => {
        try {
          const dedupResult = await checkDuplicateClient(sql, {
            document: row.document ?? row.cpf_raw ?? row.cnpj_raw ?? null,
            uc: row.uc ?? null,
            email: row.email ?? null,
            phone: row.phone ?? null,
            name: row.name ?? null,
            city: row.city ?? null,
          })
          return {
            rowIndex: index,
            name: row.name ?? '',
            ...dedupResult,
            // Strip the full existing client row for the preview (only send id + name)
            existingClient: dedupResult.existingClient
              ? { id: dedupResult.existingClient.id, name: dedupResult.existingClient.name }
              : null,
          }
        } catch (err) {
          console.error(`[bulk-import/preview] row ${index} error:`, err)
          return {
            rowIndex: index,
            name: row.name ?? '',
            matchLevel: 'none',
            status: 'new',
            confidence: 'high',
            suggestedAction: 'import',
            matchReason: null,
            existingClient: null,
            matchFields: [],
            error: 'Preview check failed',
          }
        }
      }),
    )

    return sendJson(200, { data: results })
  } catch (err) {
    console.error('[bulk-import/preview] error:', err)
    return sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to run preview deduplication')
  }
}

/**
 * POST /api/clients/bulk-import
 *
 * Body: {
 *   rows: ImportRow[],       // Only the rows the user confirmed to import
 *   autoMerge?: boolean      // If true, merge empty fields into existing clients on hard match
 * }
 *
 * ImportRow: {
 *   name, document?, uc?, email?, phone?, city?, state?, address?,
 *   distribuidora?, metadata?,
 *   energyProfile?: { kwh_contratado?, potencia_kwp?, tipo_rede?, tarifa_atual?,
 *                     desconto_percentual?, mensalidade?, indicacao?, modalidade?, prazo_meses? }
 * }
 */
export async function handleBulkImport(req, res, ctx) {
  const { readJsonBody, sendJson: rawSendJson } = ctx
  const sendJson = (s, p) => rawSendJson(res, s, p)

  const db = getDatabaseClient()
  if (!db) return sendError(sendJson, 503, 'SERVICE_UNAVAILABLE', 'Database not configured')

  let actor
  try {
    actor = await resolveActor(req)
    requireClientAuth(actor)
    if (actor.isFinanceiro && !actor.isAdmin) return sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
  } catch (err) {
    return handleAuthError(sendJson, err)
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return sendError(sendJson, 400, 'VALIDATION_ERROR', 'Invalid JSON')
  }

  const rows = body?.rows
  if (!Array.isArray(rows) || rows.length === 0) {
    return sendError(sendJson, 422, 'VALIDATION_ERROR', 'Field rows must be a non-empty array')
  }
  if (rows.length > MAX_BULK_ROWS) {
    return sendError(sendJson, 422, 'VALIDATION_ERROR', `Maximum ${MAX_BULK_ROWS} rows per import`)
  }

  const autoMerge = body?.autoMerge === true
  const sql = createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })

  const summary = { created: 0, merged: 0, skipped: 0, errors: 0 }
  const results = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const result = await createClientSafe(sql, row, {
        autoMerge,
        actorUserId: actor.userId,
        actorEmail: actor.email ?? null,
      })
      summary[result.action] = (summary[result.action] ?? 0) + 1
      results.push({
        rowIndex: i,
        name: row.name ?? '',
        action: result.action,
        clientId: result.client?.id ?? null,
        hasEnergyProfile: !!result.energyProfile,
      })
    } catch (err) {
      console.error(`[bulk-import] row ${i} error:`, err)
      summary.errors++
      results.push({
        rowIndex: i,
        name: row.name ?? '',
        action: 'error',
        error: err?.message ?? 'Unknown error',
      })
    }
  }

  console.info('[bulk-import] completed', {
    actorUserId: actor.userId,
    total: rows.length,
    ...summary,
  })

  return sendJson(201, { summary, results })
}
