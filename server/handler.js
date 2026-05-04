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
import { resolveActor, actorRole } from './proposals/permissions.js'
import { requireStackPermission } from './auth/stackPermissions.js'
import { getNeonDatabaseConfig } from './database/neonConfig.js'
import { getDatabaseClient } from './database/neonClient.js'
import { StorageService } from './database/storageService.js'
import { registerAuthRoutes } from './routes/auth.js'
import {
  handleAdminUsersListRequest,
  handleAdminUserApprove,
  handleAdminUserBlock,
  handleAdminUserRevoke,
  handleAdminUserRole,
  handleAdminUserGrantPermission,
  handleAdminUserRevokePermission,
  handleAdminUserDelete,
  handleAdminUserCreate,
} from './routes/adminUsers.js'
import { createUserScopedSql } from './database/withRLSContext.js'
import { createRouter } from './router.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerStorageRoutes } from './routes/storage.js'
import { registerClientsRoutes } from './routes/clients.js'
import { registerProposalsRoutes } from './routes/proposals.js'
import { registerPortfolioRoutes } from './routes/portfolio.js'
import { registerProjectsRoutes } from './routes/projects.js'
import { registerFinancialManagementRoutes } from './routes/financialManagement.js'
import { registerFinancialImportRoutes } from './routes/financialImport.js'
import { registerFinancialAnalysesRoutes } from './routes/financialAnalyses.js'
import { registerInvoicesRoutes } from './routes/invoices.js'
import { registerRevenueBillingRoutes } from './routes/revenueBilling.js'
import { registerOperationalTasksRoutes } from './routes/operationalTasks.js'
import { registerConsultantsRoutes } from './routes/consultants.js'
import { registerEngineersRoutes } from './routes/engineers.js'
import { registerInstallersRoutes } from './routes/installers.js'
import { registerPersonnelImportRoutes } from './routes/personnelImport.js'
import { registerDatabaseBackupRoutes } from './routes/databaseBackup.js'
import { registerPurgeDeletedClientsRoute } from './routes/purgeDeletedClients.js'
import { registerPurgeOldProposalsRoute } from './routes/purgeOldProposals.js'

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

const TEST_API_PATH = '/api/test'
const MAX_JSON_BODY_BYTES = 5 * 1024 * 1024
const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With'
const CORS_ALLOWED_METHODS = 'GET,POST,PUT,DELETE,OPTIONS'

const trustedOrigins = getTrustedOrigins()
const stackAuthEnabled = isStackAuthEnabled()

const createRequestId = () => crypto.randomUUID()

// ── Simple in-memory rate limiter for auth endpoints ─────────────────────────
const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000   // 1-minute sliding window
const AUTH_RATE_LIMIT_MAX = 30                 // max 30 requests per window per IP
const rateLimitBuckets = new Map()             // IP → { count, resetAt }

// Stricter rate limit for mutating admin endpoints (permission grant/revoke, user ops)
const ADMIN_RATE_LIMIT_WINDOW_MS = 60 * 1000  // 1-minute sliding window
const ADMIN_RATE_LIMIT_MAX = 20               // max 20 admin mutations per window per IP
const adminRateLimitBuckets = new Map()       // IP → { count, resetAt }

function getClientIp(req) {
  const forwarded = typeof req.headers['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : ''
  return forwarded || req.socket?.remoteAddress || ''
}

function isRateLimited(buckets, ip, windowMs, max) {
  if (!ip) return false

  const now = Date.now()

  if (buckets.size > 10_000) {
    for (const [key, rateLimitEntry] of buckets) {
      if (rateLimitEntry.resetAt <= now) buckets.delete(key)
    }
  }

  let rateLimitWindow = buckets.get(ip)
  if (!rateLimitWindow || rateLimitWindow.resetAt <= now) {
    rateLimitWindow = { count: 0, resetAt: now + windowMs }
    buckets.set(ip, rateLimitWindow)
  }
  rateLimitWindow.count += 1
  return rateLimitWindow.count > max
}

function isAuthRateLimited(req) {
  return isRateLimited(rateLimitBuckets, getClientIp(req), AUTH_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX)
}

function isAdminRateLimited(req) {
  return isRateLimited(adminRateLimitBuckets, getClientIp(req), ADMIN_RATE_LIMIT_WINDOW_MS, ADMIN_RATE_LIMIT_MAX)
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
        const error = new Error('Payload acima do limite permitido.')
        error.code = 'PAYLOAD_TOO_LARGE'
        reject(error)
        return
      }
      accumulated += chunk
    })
    req.on('end', () => {
      if (!accumulated) return resolve({})
      try {
        resolve(JSON.parse(accumulated))
      } catch {
        const error = new Error('JSON inválido na requisição.')
        error.code = 'INVALID_JSON'
        reject(error)
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

/**
 * Creates a user-scoped RLS SQL client for use in route handlers.
 * @param {object} actor - Resolved actor from resolveActor(req). Must have userId and permissions.
 * @returns {Promise<import('postgres').Sql>} A scoped SQL instance with RLS context set.
 * @throws {Error} With statusCode 503 when the database is not configured.
 */
async function createHandlerScopedSql(actor) {
  const db = getDatabaseClient()
  if (!db?.sql) {
    const err = new Error('Database not configured')
    err.statusCode = 503
    throw err
  }
  const role = actorRole(actor)
  return createUserScopedSql(db.sql, { userId: actor.userId, role })
}

if (databaseConfig.connectionString && databaseClient) {
  storageService = new StorageService(databaseClient.sql)
  storageService.ensureInitialized().catch((err) => {
    console.error('[storage] ensureInitialized failed:', err?.message)
  })
} else {
  // Log clearly so preview/deployment logs show the root cause of storage failures.
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV)
  const vercelEnv = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown'
  const vercelHint = isVercel
    ? ` Vercel env: ${vercelEnv}. Ensure DATABASE_URL is enabled for this environment in Vercel > Settings > Environment Variables.`
    : ''
  console.warn(`[storage] DATABASE_URL (or equivalent) is not set — storage is unavailable.${vercelHint}`)
}

// ── Route registry ────────────────────────────────────────────────────────────
const router = createRouter()
registerHealthRoutes(router, {
  databaseClient,
  databaseConfig,
  storageService,
  stackAuthEnabled,
  sendJson,
  sendServerError,
})
registerStorageRoutes(router, {
  storageService,
  stackAuthEnabled,
  sendJson,
  sendNoContent,
  readJsonBody,
})
registerAuthRoutes(router, {
  sendJson,
  sendNoContent,
  expireAuthCookie,
  isAuthRateLimited,
  isAdminRateLimited,
})
registerDatabaseBackupRoutes(router, {
  sendJson,
  sendNoContent,
  readJsonBody,
  isAdminRateLimited,
})
registerPurgeDeletedClientsRoute(router)
registerPurgeOldProposalsRoute(router)
registerPersonnelImportRoutes(router, { getScopedSql: createHandlerScopedSql })
registerConsultantsRoutes(router, { getScopedSql: createHandlerScopedSql, readJsonBody })
registerEngineersRoutes(router, { getScopedSql: createHandlerScopedSql, readJsonBody })
registerInstallersRoutes(router, { getScopedSql: createHandlerScopedSql, readJsonBody })
registerClientsRoutes(router, { readJsonBody })
registerProposalsRoutes(router, { readJsonBody })
registerPortfolioRoutes(router, { readJsonBody })
registerInvoicesRoutes(router, { readJsonBody })
registerOperationalTasksRoutes(router, { readJsonBody })
registerRevenueBillingRoutes(router, {})
registerFinancialManagementRoutes(router, { readJsonBody })
registerProjectsRoutes(router, { readJsonBody })
registerFinancialImportRoutes(router, {})
registerFinancialAnalysesRoutes(router, { readJsonBody })

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

    // ── Route registry dispatch ────────────────────────────────────────────
    const routerFn = router.match(method, pathname)
    if (routerFn) {
      await routerFn(req, res, { requestId, vercelId })
      return
    }

    if (pathname === '/api/db-info') {
      // DB diagnostics endpoint — requires admin role.
      // Returns masked host, db name, schema, current_user, pooled/unpooled indicator.
      const actor = await resolveActor(req)
      if (!actor) { sendJson(res, 401, { error: 'Autenticação necessária.' }); return }
      if (actorRole(actor) !== 'role_admin') { sendJson(res, 403, { error: 'Requer perfil admin.' }); return }
      if (!databaseClient?.sql) {
        sendJson(res, 503, { ok: false, error: 'DB_NOT_CONFIGURED' })
        return
      }
      try {
        const rows = await databaseClient.sql`
          SELECT
            current_database() AS db_name,
            current_schema()   AS db_schema,
            current_user       AS db_user
        `
        const row = rows[0] ?? {}
        const connStr = databaseConfig.connectionString ?? ''
        // Mask credentials: keep only host/path, hide password
        let maskedHost = null
        try {
          const u = new URL(connStr)
          maskedHost = u.hostname + (u.port ? ':' + u.port : '') + u.pathname
        } catch { /* ignore */ }
        const isPooled =
          typeof connStr === 'string' && !connStr.includes('unpooled')
            ? !connStr.includes('-direct')
            : connStr.includes('unpooled') ? false : null
        sendJson(res, 200, {
          ok: true,
          db_name: row.db_name ?? null,
          db_schema: row.db_schema ?? null,
          db_user: row.db_user ?? null,
          host: maskedHost,
          pooled: isPooled,
          source: databaseConfig.source ?? null,
        })
      } catch (err) {
        console.error('[db-info] query failed', err?.message)
        sendJson(res, 500, { ok: false, error: err?.message ?? 'DB_QUERY_FAILED' })
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

    // /api/storage is now handled by the route registry above (registerStorageRoutes).
    // Auth routes (/api/auth/me, /api/authz/me, /api/auth/logout,
    //   /api/internal/auth/reconcile, /api/internal/auth/reconcile/:userId,
    //   /api/internal/rbac/inspect) are now handled by registerAuthRoutes above.
    // Cron routes (/api/internal/purge-deleted-clients, /api/internal/purge-old-proposals)
    //   are now handled by registerPurgeDeletedClientsRoute / registerPurgeOldProposalsRoute above.
    // Personnel import routes (/api/personnel/importable-users, /api/personnel/importable-clients)
    //   are now handled by registerPersonnelImportRoutes above.
    // Consultants, engineers, and installers routes are now handled by their respective
    //   registerXRoutes above.

    if (pathname === '/api/admin/users') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,POST,OPTIONS'); sendNoContent(res); return }
      if (method === 'GET') {
        await handleAdminUsersListRequest(req, res, { sendJson, requestUrl })
      } else if (method === 'POST') {
        if (isAdminRateLimited(req)) { sendJson(res, 429, { error: 'Too many requests. Try again later.' }); return }
        const body = await readJsonBody(req)
        await handleAdminUserCreate(req, res, { sendJson, body })
      } else {
        sendJson(res, 405, { error: 'Método não suportado.' })
      }
      return
    }

    // /api/admin/users/:id/approve|block|revoke|role
    const adminUserActionMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/(approve|block|revoke|role)$/)
    if (adminUserActionMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,OPTIONS'); sendNoContent(res); return }
      if (method !== 'POST') { sendJson(res, 405, { error: 'Método não suportado.' }); return }
      if (isAdminRateLimited(req)) { sendJson(res, 429, { error: 'Too many requests. Try again later.' }); return }
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

    // DELETE /api/admin/users/:id  — permanent deletion
    const adminUserDeleteMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
    if (adminUserDeleteMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'DELETE,OPTIONS'); sendNoContent(res); return }
      if (method !== 'DELETE') { sendJson(res, 405, { error: 'Método não suportado.' }); return }
      if (isAdminRateLimited(req)) { sendJson(res, 429, { error: 'Too many requests. Try again later.' }); return }
      const userId = adminUserDeleteMatch[1]
      await handleAdminUserDelete(req, res, { sendJson, userId })
      return
    }

    // /api/admin/users/:id/permissions/:perm  — grant (POST) / revoke (DELETE)
    const adminUserPermMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/permissions\/([^/]+)$/)
    if (adminUserPermMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,DELETE,OPTIONS'); sendNoContent(res); return }
      if ((method === 'POST' || method === 'DELETE') && isAdminRateLimited(req)) {
        sendJson(res, 429, { error: 'Too many requests. Try again later.' })
        return
      }
      const userId = adminUserPermMatch[1]
      const permId = decodeURIComponent(adminUserPermMatch[2])
      if (method === 'POST') {
        await handleAdminUserGrantPermission(req, res, { sendJson, userId, permId })
      } else if (method === 'DELETE') {
        await handleAdminUserRevokePermission(req, res, { sendJson, userId, permId })
      } else {
        sendJson(res, 405, { error: 'Método não suportado.' })
      }
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
