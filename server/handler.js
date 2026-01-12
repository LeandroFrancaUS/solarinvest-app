// server/handler.js
import { readFile, access } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { URL } from 'node:url'

import { handleAneelProxyRequest, DEFAULT_PROXY_BASE } from './aneelProxy.js'
import {
  CONTRACT_RENDER_PATH,
  CONTRACT_TEMPLATES_PATH,
  handleContractRenderRequest,
  handleContractTemplatesRequest,
  isConvertApiConfigured,
  isGotenbergConfigured,
} from './contracts.js'
import {
  LEASING_CONTRACTS_PATH,
  LEASING_CONTRACTS_AVAILABILITY_PATH,
  LEASING_CONTRACTS_SMOKE_PATH,
  handleLeasingContractsRequest,
  handleLeasingContractsAvailabilityRequest,
  handleLeasingContractsSmokeRequest,
} from './leasingContracts.js'
import {
  getStackUser,
  getTrustedOrigins,
  isStackAuthEnabled,
  sanitizeStackUserId,
} from './auth/stackAuth.js'
import { getNeonDatabaseConfig } from './database/neonConfig.js'
import { getDatabaseClient } from './database/neonClient.js'
import { StorageService } from './database/storageService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ⚠️ Em produção na Vercel, quem serve o front é o “static output” do Vite.
// Ainda assim, manter serveStatic como fallback NÃO quebra — mas o normal é nem precisar.
const distDir = path.resolve(__dirname, '../dist')
const distExists = existsSync(distDir)

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const STORAGE_API_PATH = '/api/storage'
const TEST_API_PATH = '/api/test'
const MAX_JSON_BODY_BYTES = 256 * 1024
const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With'
const CORS_ALLOWED_METHODS = 'GET,POST,PUT,DELETE,OPTIONS'

const trustedOrigins = getTrustedOrigins()
const stackAuthEnabled = isStackAuthEnabled()

const createRequestId = () => crypto.randomUUID()

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const sendNoContent = (res) => {
  res.statusCode = 204
  res.end()
}

const sendServerError = (res, statusCode, payload, requestId, vercelId) => {
  if (res.headersSent) return
  if (requestId) res.setHeader('X-Request-Id', requestId)
  if (vercelId) res.setHeader('X-Vercel-Id', vercelId)
  sendJson(res, statusCode, { ok: false, requestId, vercelId, ...payload })
}

const applyCorsHeaders = (req, res) => {
  if (trustedOrigins.size === 0) return

  const originHeader = req.headers?.origin
  const origin = typeof originHeader === 'string' ? originHeader.trim() : ''
  if (!origin || (!trustedOrigins.has(origin) && !trustedOrigins.has('*'))) return

  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS)
  res.setHeader('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS)
  res.setHeader('Access-Control-Max-Age', '600')
  res.setHeader('Vary', 'Origin')
}

const readJsonBody = async (req) => {
  if (!req.readable) return {}

  let accumulated = ''
  let totalLength = 0
  req.setEncoding('utf8')

  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      totalLength += chunk.length
      if (totalLength > MAX_JSON_BODY_BYTES) {
        reject(new Error('Payload acima do limite permitido.'))
        return
      }
      accumulated += chunk
    })
    req.on('end', () => {
      if (!accumulated) return resolve({})
      try {
        resolve(JSON.parse(accumulated))
      } catch {
        reject(new Error('JSON inválido na requisição.'))
      }
    })
    req.on('error', reject)
  })
}

const serveStatic = async (pathname, res) => {
  if (!distExists) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  let target = pathname
  if (target === '/' || target === '') target = '/index.html'

  const resolved = path.resolve(distDir, `.${target}`)
  if (!resolved.startsWith(distDir) || !existsSync(resolved)) {
    const indexPath = path.join(distDir, 'index.html')
    const indexContent = await readFile(indexPath)
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(indexContent)
    return
  }

  const ext = path.extname(resolved)
  const content = await readFile(resolved)
  res.statusCode = 200
  res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream')
  res.end(content)
}

const databaseConfig = getNeonDatabaseConfig()
const databaseClient = getDatabaseClient()
let storageService = null

if (databaseConfig.connectionString && databaseClient) {
  storageService = new StorageService(databaseClient.sql)
  storageService.ensureInitialized().catch(() => {
    // log já existe no seu arquivo original; aqui pode manter simples
  })
}

// ✅ ESTE É O HANDLER serverless
export default async function handler(req, res) {
  const requestId = createRequestId()
  const vercelId =
    typeof req.headers['x-vercel-id'] === 'string' ? req.headers['x-vercel-id'] : undefined

  try {
    if (!req.url) {
      sendJson(res, 400, { error: 'Requisição inválida' })
      return
    }

    applyCorsHeaders(req, res)

    const requestUrl = new URL(req.url, 'http://localhost')
    const pathname = requestUrl.pathname
    const method = req.method?.toUpperCase() ?? 'GET'

    if (pathname === '/health') {
      sendJson(res, 200, { status: 'ok' })
      return
    }

    if (pathname === '/api/health/db') {
      if (!databaseClient || !databaseConfig.connectionString) {
        sendServerError(res, 503, {
          ok: false,
          db: 'not_configured',
          error: 'Banco de dados não configurado. Defina DATABASE_URL.'
        }, requestId, vercelId)
        return
      }

      const startTime = Date.now()
      try {
        const result = await databaseClient.sql`SELECT 1 as ok, NOW() as now`
        const latencyMs = Date.now() - startTime
        const row = Array.isArray(result) && result.length > 0 ? result[0] : null
        const nowValue = row?.now ?? null
        const serialized =
          nowValue && typeof nowValue.toISOString === 'function'
            ? nowValue.toISOString()
            : nowValue

        sendJson(res, 200, {
          ok: true,
          db: 'connected',
          now: serialized,
          latencyMs
        })
      } catch (error) {
        const latencyMs = Date.now() - startTime
        console.error('[database] Falha no health check:', error)
        sendServerError(res, 500, {
          ok: false,
          db: 'error',
          error: error.message || 'Falha ao conectar ao banco de dados',
          latencyMs
        }, requestId, vercelId)
      }
      return
    }

    if (pathname === '/api/health/pdf') {
      const convertapiConfigured = isConvertApiConfigured()
      const gotenbergConfigured = isGotenbergConfigured()
      sendJson(res, 200, { ok: convertapiConfigured || gotenbergConfigured, convertapiConfigured, gotenbergConfigured })
      return
    }

    if (pathname === '/api/health/contracts') {
      const templatePath = path.join(
        process.cwd(),
        'public/templates/contratos/leasing/CONTRATO UNIFICADO DE LEASING DE SISTEMA FOTOVOLTAICO.dotx',
      )
      let templateExists = false
      try { await access(templatePath); templateExists = true } catch { templateExists = false }
      sendJson(res, 200, {
        ok: templateExists,
        templateExists,
        convertapiConfigured: isConvertApiConfigured(),
        gotenbergConfigured: isGotenbergConfigured(),
        node: process.version,
      })
      return
    }

    if (pathname === DEFAULT_PROXY_BASE) {
      await handleAneelProxyRequest(req, res)
      return
    }

    if (pathname === LEASING_CONTRACTS_AVAILABILITY_PATH) {
      await handleLeasingContractsAvailabilityRequest(req, res)
      return
    }

    if (pathname === LEASING_CONTRACTS_SMOKE_PATH) {
      await handleLeasingContractsSmokeRequest(req, res)
      return
    }

    if (pathname === LEASING_CONTRACTS_PATH) {
      await handleLeasingContractsRequest(req, res)
      return
    }

    if (pathname === CONTRACT_RENDER_PATH) {
      await handleContractRenderRequest(req, res)
      return
    }

    if (pathname === CONTRACT_TEMPLATES_PATH) {
      await handleContractTemplatesRequest(req, res)
      return
    }

    if (pathname === TEST_API_PATH) {
      if (!databaseClient || !databaseConfig.connectionString) {
        sendJson(res, 503, { error: 'Persistência indisponível' })
        return
      }
      const result = await databaseClient.sql`SELECT NOW() AS current_time`
      const row = Array.isArray(result) && result.length > 0 ? result[0] : null
      const nowValue = row?.current_time ?? row?.now ?? null
      const serialized =
        nowValue && typeof nowValue.toISOString === 'function'
          ? nowValue.toISOString()
          : nowValue
      sendJson(res, 200, { now: serialized })
      return
    }

    if (pathname === STORAGE_API_PATH) {
      if (!storageService) {
        sendJson(res, 503, { error: 'Persistência indisponível' })
        return
      }

      const stackUser = await getStackUser(req)
      const userId = stackAuthEnabled
        ? sanitizeStackUserId(stackUser && stackUser.payload ? stackUser : null)
        : sanitizeStackUserId(stackUser)

      if (method === 'OPTIONS') {
        res.setHeader('Allow', CORS_ALLOWED_METHODS)
        sendNoContent(res)
        return
      }

      if (stackAuthEnabled && !userId) {
        sendJson(res, 401, { error: 'Autenticação obrigatória.' })
        return
      }

      if (method === 'GET') {
        const entries = await storageService.listEntries(userId)
        sendJson(res, 200, { entries })
        return
      }

      if (method === 'PUT' || method === 'POST') {
        const body = await readJsonBody(req)
        const key = typeof body.key === 'string' ? body.key.trim() : ''
        const value = body.value === undefined ? null : body.value
        if (!key) return sendJson(res, 400, { error: 'Chave de armazenamento inválida.' })
        await storageService.setEntry(userId, key, value)
        sendNoContent(res)
        return
      }

      if (method === 'DELETE') {
        const body = await readJsonBody(req)
        const key = typeof body.key === 'string' ? body.key.trim() : ''
        if (!key) {
          await storageService.clear(userId)
          sendNoContent(res)
          return
        }
        await storageService.removeEntry(userId, key)
        sendNoContent(res)
        return
      }

      sendJson(res, 405, { error: 'Método não suportado.' })
      return
    }

    if (method === 'OPTIONS') {
      res.setHeader('Allow', CORS_ALLOWED_METHODS)
      sendNoContent(res)
      return
    }

    // fallback SPA/static (opcional)
    await serveStatic(pathname, res)
  } catch (error) {
    console.error('[server] Erro inesperado ao processar requisição:', error)
    sendServerError(
      res,
      500,
      {
        code: 'FUNCTION_INVOCATION_FAILED',
        message: 'A server error has occurred',
        hint: 'Verifique os logs do servidor para mais detalhes.',
      },
      requestId,
      vercelId,
    )
  }
}
