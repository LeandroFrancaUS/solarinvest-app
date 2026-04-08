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
import { requireStackPermission } from './auth/stackPermissions.js'
import { getNeonDatabaseConfig } from './database/neonConfig.js'
import { getDatabaseClient } from './database/neonClient.js'
import { StorageService } from './database/storageService.js'
import { handleAuthMeRequest } from './routes/authMe.js'
import {
  handleAdminUsersListRequest,
  handleAdminUserApprove,
  handleAdminUserBlock,
  handleAdminUserRevoke,
  handleAdminUserRole,
} from './routes/adminUsers.js'
import {
  handleProposalsRequest,
  handleProposalByIdRequest,
} from './proposals/handler.js'
import {
  handleUpsertClientByCpf,
  handleClientsRequest as handleClientsRequestV2,
  handleClientByIdRequest,
} from './clients/handler.js'

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

// ── Simple in-memory rate limiter for auth endpoints ─────────────────────────
const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000   // 1-minute sliding window
const AUTH_RATE_LIMIT_MAX = 30                 // max 30 requests per window per IP
const rateLimitBuckets = new Map()             // IP → { count, resetAt }

function isAuthRateLimited(req) {
  const forwarded = typeof req.headers['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : ''
  const ip = forwarded || req.socket?.remoteAddress || ''
  if (!ip) return false // cannot identify client — skip rate limiting

  const now = Date.now()

  // Lazy cleanup: remove expired entries when the map grows large
  if (rateLimitBuckets.size > 10_000) {
    for (const [key, bucket] of rateLimitBuckets) {
      if (bucket.resetAt <= now) rateLimitBuckets.delete(key)
    }
  }

  let bucket = rateLimitBuckets.get(ip)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS }
    rateLimitBuckets.set(ip, bucket)
  }
  bucket.count += 1
  return bucket.count > AUTH_RATE_LIMIT_MAX
}

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const sendNoContent = (res) => {
  res.statusCode = 204
  res.end()
}

const getAuthCookieName = () => {
  const value = typeof process.env.AUTH_COOKIE_NAME === 'string' ? process.env.AUTH_COOKIE_NAME.trim() : ''
  return value || 'solarinvest_session'
}

const isHttpsRequest = (req) => {
  const forwardedProto = typeof req.headers['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto'].split(',')[0].trim()
    : ''
  if (forwardedProto) return forwardedProto === 'https'
  return Boolean(req.socket?.encrypted)
}

const expireAuthCookie = (req, res) => {
  const cookieName = getAuthCookieName()
  const secure = isHttpsRequest(req) ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${cookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`)
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
          error: 'Falha ao conectar ao banco de dados',
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
        'public/templates/contratos/leasing/CONTRATO DE LEASING OPERACIONAL DE SISTEMA FOTOVOLTAICO.dotx',
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
      if (stackAuthEnabled) await requireStackPermission(req, 'page:financial_analysis')
      await handleLeasingContractsRequest(req, res)
      return
    }

    if (pathname === CONTRACT_RENDER_PATH) {
      if (stackAuthEnabled) await requireStackPermission(req, 'page:financial_analysis')
      await handleContractRenderRequest(req, res)
      return
    }

    if (pathname === CONTRACT_TEMPLATES_PATH) {
      if (stackAuthEnabled) await requireStackPermission(req, 'page:financial_analysis')
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

    // Auth & Admin routes — apply rate limiting
    if (pathname === '/api/auth/me') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      if (method !== 'GET') { sendJson(res, 405, { error: 'Método não suportado.' }); return }
      if (isAuthRateLimited(req)) { sendJson(res, 429, { error: 'Too many requests. Try again later.' }); return }
      await handleAuthMeRequest(req, res, { sendJson, requestUrl })
      return
    }

    if (pathname === '/api/auth/logout') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,OPTIONS'); sendNoContent(res); return }
      if (method !== 'POST') { sendJson(res, 405, { error: 'Método não suportado.' }); return }
      expireAuthCookie(req, res)
      sendNoContent(res)
      return
    }

    if (pathname === '/api/admin/users') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      if (method !== 'GET') { sendJson(res, 405, { error: 'Método não suportado.' }); return }
      await handleAdminUsersListRequest(req, res, { sendJson, requestUrl })
      return
    }

    // /api/admin/users/:id/approve|block|revoke|role
    const adminUserActionMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/(approve|block|revoke|role)$/)
    if (adminUserActionMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,OPTIONS'); sendNoContent(res); return }
      if (method !== 'POST') { sendJson(res, 405, { error: 'Método não suportado.' }); return }
      const userId = adminUserActionMatch[1]
      const action = adminUserActionMatch[2]
      const body = await readJsonBody(req)
      const ctx = { sendJson, userId, body }
      if (action === 'approve') await handleAdminUserApprove(req, res, ctx)
      else if (action === 'block') await handleAdminUserBlock(req, res, ctx)
      else if (action === 'revoke') await handleAdminUserRevoke(req, res, ctx)
      else if (action === 'role') await handleAdminUserRole(req, res, ctx)
      return
    }

    // ── Clients API ───────────────────────────────────────────────────────────
    // POST /api/clients/upsert-by-cpf — offline-first client upsert
    if (pathname === '/api/clients/upsert-by-cpf' && method === 'POST') {
      const clientsCtx = { method, readJsonBody, sendJson, sendNoContent }
      await handleUpsertClientByCpf(req, res, clientsCtx)
      return
    }

    // GET /api/clients — list with filters
    // POST /api/clients — create client
    if (pathname === '/api/clients') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,POST,OPTIONS'); sendNoContent(res); return }
      const clientsCtx = { method, readJsonBody, sendJson, sendNoContent, requestUrl }
      await handleClientsRequestV2(req, res, clientsCtx)
      return
    }

    // GET /api/clients/:id — get client
    // GET /api/clients/:id/proposals — get client's proposals
    // PUT /api/clients/:id — update client
    const clientByIdMatch = pathname.match(/^\/api\/clients\/(\d+)(\/proposals)?$/)
    if (clientByIdMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,PUT,OPTIONS'); sendNoContent(res); return }
      const clientId = clientByIdMatch[1]
      const subpath = clientByIdMatch[2]?.slice(1) ?? null  // 'proposals' or null
      const clientsCtx = { method, clientId, subpath, readJsonBody, sendJson, sendNoContent }
      await handleClientByIdRequest(req, res, clientsCtx)
      return
    }

    // ── Proposals API ─────────────────────────────────────────────────────────
    // GET /api/proposals        — list proposals
    // POST /api/proposals       — create proposal
    if (pathname === '/api/proposals') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,POST,OPTIONS'); sendNoContent(res); return }
      const proposalsCtx = { method, readJsonBody, sendJson, sendNoContent, requestUrl }
      await handleProposalsRequest(req, res, proposalsCtx)
      return
    }

    // GET /api/proposals/:id    — get one proposal
    // PATCH /api/proposals/:id  — update proposal
    // DELETE /api/proposals/:id — soft delete
    const proposalByIdMatch = pathname.match(/^\/api\/proposals\/([^/]+)$/)
    if (proposalByIdMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,PATCH,DELETE,OPTIONS'); sendNoContent(res); return }
      const proposalId = proposalByIdMatch[1]
      const proposalByIdCtx = { method, proposalId, readJsonBody, sendJson, sendNoContent, requestUrl }
      await handleProposalByIdRequest(req, res, proposalByIdCtx)
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
