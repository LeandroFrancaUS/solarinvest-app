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
import {
  handleProposalsRequest,
  handleProposalByIdRequest,
} from './proposals/handler.js'
import {
  handleUpsertClientByCpf,
  handleClientsRequest as handleClientsRequestV2,
  handleClientByIdRequest,
} from './clients/handler.js'
import {
  handleBulkImportPreview,
  handleBulkImport,
} from './clients/bulkImport.js'
import { registerConsultantsRoutes } from './routes/consultants.js'
import { registerEngineersRoutes } from './routes/engineers.js'
import { registerInstallersRoutes } from './routes/installers.js'
import { registerPersonnelImportRoutes } from './routes/personnelImport.js'
import { registerDatabaseBackupRoutes } from './routes/databaseBackup.js'
import { registerPurgeDeletedClientsRoute } from './routes/purgeDeletedClients.js'
import { registerPurgeOldProposalsRoute } from './routes/purgeOldProposals.js'
import {
  handlePortfolioListRequest,
  handlePortfolioGetRequest,
  handlePortfolioExportRequest,
  handlePortfolioProfilePatch,
  handlePortfolioContractPatch,
  handlePortfolioProjectPatch,
  handlePortfolioBillingPatch,
  handlePortfolioPlanPatch,
  handlePortfolioNotesRequest,
  handlePortfolioRemoveRequest,
  handleDashboardPortfolioSummary,
} from './client-portfolio/handler.js'
import {
  handleFinancialSummary,
  handleFinancialProjects,
  handleFinancialCashflow,
  handleFinancialEntries,
  handleFinancialCategories,
  handleFinancialDashboardFeed,
} from './financial-management/handler.js'
import { handleRevenueClients } from './revenue-billing/handler.js'
import {
  handleProjectsList,
  handleProjectsSummary,
  handleProjectById,
  handleProjectStatus,
  handleProjectPvData,
  handleProjectFromPlan,
} from './projects/handler.js'
import { handleProjectFinance } from './project-finance/handler.js'
import {
  handleFinancialImportParse,
  handleFinancialImportConfirm,
  handleFinancialImportBatches,
} from './financial-import/handler.js'
import { handleFinancialAnalyses } from './financial-analyses/handler.js'
import {
  handleInvoicesListRequest,
  handleInvoicesCreateRequest,
  handleInvoicesUpdateRequest,
  handleInvoicesDeleteRequest,
  handleInvoicePaymentRequest,
  handleInvoiceNotificationsRequest,
  handleInvoiceNotificationConfigGetRequest,
  handleInvoiceNotificationConfigUpdateRequest,
} from './invoices/handler.js'
import {
  handleOperationalTasksListRequest,
  handleOperationalTasksCreateRequest,
  handleOperationalTasksUpdateRequest,
  handleOperationalTasksDeleteRequest,
  handleTaskHistoryRequest,
  handleNotificationPreferencesGetRequest,
  handleNotificationPreferencesUpdateRequest,
} from './operational-tasks/handler.js'
import { createUserScopedSql } from './database/withRLSContext.js'
import { createRouter } from './router.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerStorageRoutes } from './routes/storage.js'

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

    // POST /api/clients/upsert-by-cpf — offline-first client upsert
    if (pathname === '/api/clients/upsert-by-cpf' && method === 'POST') {
      const clientsCtx = { method, readJsonBody, sendJson, sendNoContent }
      await handleUpsertClientByCpf(req, res, clientsCtx)
      return
    }

    // POST /api/clients/bulk-import/preview — deduplication preview (no persistence)
    if (pathname === '/api/clients/bulk-import/preview' && method === 'POST') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,OPTIONS'); sendNoContent(res); return }
      const clientsCtx = { method, readJsonBody, sendJson, sendNoContent }
      await handleBulkImportPreview(req, res, clientsCtx)
      return
    }

    // POST /api/clients/bulk-import — enterprise bulk import with deduplication
    if (pathname === '/api/clients/bulk-import' && method === 'POST') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,OPTIONS'); sendNoContent(res); return }
      const clientsCtx = { method, readJsonBody, sendJson, sendNoContent }
      await handleBulkImport(req, res, clientsCtx)
      return
    }

    // POST /api/clients/consultor-backfill — normalize consultant metadata across all clients
    if (pathname === '/api/clients/consultor-backfill' && method === 'POST') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,OPTIONS'); sendNoContent(res); return }
      const clientsCtx = { method, readJsonBody, sendJson, sendNoContent, requestUrl }
      await handleClientsRequestV2(req, res, clientsCtx)
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
    // DELETE /api/clients/:id — soft delete client
    const clientByIdMatch = pathname.match(/^\/api\/clients\/(\d+)(\/proposals)?$/)
    if (clientByIdMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,PUT,DELETE,OPTIONS'); sendNoContent(res); return }
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

    // ── Carteira de Clientes ─────────────────────────────────────────────────

    // PATCH /api/clients/:clientId/portfolio-export — mark client as converted to portfolio
    const portfolioExportMatch = pathname.match(/^\/api\/clients\/(\d+)\/portfolio-export$/)
    if (portfolioExportMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'PATCH,OPTIONS'); sendNoContent(res); return }
      const clientId = Number(portfolioExportMatch[1])
      const sj = (s, b) => sendJson(res, s, b)
      await handlePortfolioExportRequest(req, res, { method, clientId, sendJson: sj })
      return
    }

    // PATCH /api/clients/:clientId/portfolio-remove — remove client from portfolio (keeps client in system)
    const portfolioRemoveMatch = pathname.match(/^\/api\/clients\/(\d+)\/portfolio-remove$/)
    if (portfolioRemoveMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'PATCH,OPTIONS'); sendNoContent(res); return }
      const clientId = Number(portfolioRemoveMatch[1])
      const sj = (s, b) => sendJson(res, s, b)
      await handlePortfolioRemoveRequest(req, res, { method, clientId, sendJson: sj })
      return
    }

    // GET /api/dashboard/portfolio/summary
    if (pathname === '/api/dashboard/portfolio/summary') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleDashboardPortfolioSummary(req, res, { method, sendJson: sj })
      return
    }

    // GET /api/client-portfolio — list portfolio clients
    if (pathname === '/api/client-portfolio') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handlePortfolioListRequest(req, res, { method, sendJson: sj, requestUrl })
      return
    }

    // GET /api/client-portfolio/:clientId — get single portfolio client detail
    const portfolioByIdMatch = pathname.match(/^\/api\/client-portfolio\/(\d+)$/)
    if (portfolioByIdMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const clientId = Number(portfolioByIdMatch[1])
      const sj = (s, b) => sendJson(res, s, b)
      await handlePortfolioGetRequest(req, res, { method, clientId, sendJson: sj })
      return
    }

    // PATCH /api/client-portfolio/:clientId/profile
    const portfolioProfileMatch = pathname.match(/^\/api\/client-portfolio\/(\d+)\/profile$/)
    if (portfolioProfileMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'PATCH,OPTIONS'); sendNoContent(res); return }
      const clientId = Number(portfolioProfileMatch[1])
      const sj = (s, b) => sendJson(res, s, b)
      await handlePortfolioProfilePatch(req, res, { method, clientId, readJsonBody, sendJson: sj })
      return
    }

    // PATCH /api/client-portfolio/:clientId/contract
    const portfolioContractMatch = pathname.match(/^\/api\/client-portfolio\/(\d+)\/contract$/)
    if (portfolioContractMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'PATCH,OPTIONS'); sendNoContent(res); return }
      const clientId = Number(portfolioContractMatch[1])
      const sj = (s, b) => sendJson(res, s, b)
      await handlePortfolioContractPatch(req, res, { method, clientId, readJsonBody, sendJson: sj })
      return
    }

    // PATCH /api/client-portfolio/:clientId/project
    const portfolioProjectMatch = pathname.match(/^\/api\/client-portfolio\/(\d+)\/project$/)
    if (portfolioProjectMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'PATCH,OPTIONS'); sendNoContent(res); return }
      const clientId = Number(portfolioProjectMatch[1])
      const sj = (s, b) => sendJson(res, s, b)
      await handlePortfolioProjectPatch(req, res, { method, clientId, readJsonBody, sendJson: sj })
      return
    }

    // PATCH /api/client-portfolio/:clientId/billing
    const portfolioBillingMatch = pathname.match(/^\/api\/client-portfolio\/(\d+)\/billing$/)
    if (portfolioBillingMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'PATCH,OPTIONS'); sendNoContent(res); return }
      const clientId = Number(portfolioBillingMatch[1])
      const sj = (s, b) => sendJson(res, s, b)
      await handlePortfolioBillingPatch(req, res, { method, clientId, readJsonBody, sendJson: sj })
      return
    }

    // PATCH /api/client-portfolio/:clientId/plan
    const portfolioPlanMatch = pathname.match(/^\/api\/client-portfolio\/(\d+)\/plan$/)
    if (portfolioPlanMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'PATCH,OPTIONS'); sendNoContent(res); return }
      const clientId = Number(portfolioPlanMatch[1])
      const sj = (s, b) => sendJson(res, s, b)
      await handlePortfolioPlanPatch(req, res, { method, clientId, readJsonBody, sendJson: sj })
      return
    }

    // GET|POST /api/client-portfolio/:clientId/notes
    const portfolioNotesMatch = pathname.match(/^\/api\/client-portfolio\/(\d+)\/notes$/)
    if (portfolioNotesMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,POST,OPTIONS'); sendNoContent(res); return }
      const clientId = Number(portfolioNotesMatch[1])
      const sj = (s, b) => sendJson(res, s, b)
      await handlePortfolioNotesRequest(req, res, { method, clientId, readJsonBody, sendJson: sj })
      return
    }

    // ── Invoice Management routes ─────────────────────────────────────────────

    // GET /api/invoices?client_id=:id — list invoices for a client
    // POST /api/invoices — create new invoice
    if (pathname === '/api/invoices') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,POST,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      if (method === 'GET') {
        await handleInvoicesListRequest(req, res, { method, sendJson: sj, requestUrl: req.url ?? '' })
      } else if (method === 'POST') {
        const body = await readJsonBody(req)
        await handleInvoicesCreateRequest(req, res, { method, sendJson: sj, body })
      } else {
        sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
      }
      return
    }

    // PATCH /api/invoices/:invoiceId — update invoice
    // DELETE /api/invoices/:invoiceId — delete invoice
    const invoiceByIdMatch = pathname.match(/^\/api\/invoices\/(\d+)$/)
    if (invoiceByIdMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'PATCH,DELETE,OPTIONS'); sendNoContent(res); return }
      const invoiceId = Number(invoiceByIdMatch[1])
      const sj = (s, b) => sendJson(res, s, b)
      if (method === 'PATCH') {
        const body = await readJsonBody(req)
        await handleInvoicesUpdateRequest(req, res, { method, invoiceId, sendJson: sj, body })
      } else if (method === 'DELETE') {
        await handleInvoicesDeleteRequest(req, res, { method, invoiceId, sendJson: sj })
      } else {
        sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
      }
      return
    }

    // POST /api/invoices/:invoiceId/payment — register payment
    const invoicePaymentMatch = pathname.match(/^\/api\/invoices\/(\d+)\/payment$/)
    if (invoicePaymentMatch) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,OPTIONS'); sendNoContent(res); return }
      const invoiceId = Number(invoicePaymentMatch[1])
      const sj = (s, b) => sendJson(res, s, b)
      const body = await readJsonBody(req)
      await handleInvoicePaymentRequest(req, res, { method, invoiceId, sendJson: sj, body })
      return
    }

    // GET /api/invoices/notifications — get invoice alerts
    if (pathname === '/api/invoices/notifications') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleInvoiceNotificationsRequest(req, res, { method, sendJson: sj })
      return
    }

    // GET /api/invoices/notification-config — get notification config
    // POST /api/invoices/notification-config — update notification config
    if (pathname === '/api/invoices/notification-config') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,POST,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      if (method === 'GET') {
        await handleInvoiceNotificationConfigGetRequest(req, res, { method, sendJson: sj })
      } else if (method === 'POST') {
        const body = await readJsonBody(req)
        await handleInvoiceNotificationConfigUpdateRequest(req, res, { method, sendJson: sj, body })
      } else {
        sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
      }
      return
    }

    // ── Operational Tasks routes ──────────────────────────────────────────────

    // GET /api/operational-tasks — list operational tasks
    // POST /api/operational-tasks — create operational task
    if (pathname === '/api/operational-tasks') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,POST,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      if (method === 'GET') {
        await handleOperationalTasksListRequest(req, res, { method, sendJson: sj, requestUrl: req.url ?? '' })
      } else if (method === 'POST') {
        const body = await readJsonBody(req)
        await handleOperationalTasksCreateRequest(req, res, { method, sendJson: sj, body })
      } else {
        sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
      }
      return
    }

    // PATCH /api/operational-tasks/:taskId — update task
    // DELETE /api/operational-tasks/:taskId — delete task
    const operationalTaskMatch = pathname.match(/^\/api\/operational-tasks\/(\d+)$/)
    if (operationalTaskMatch) {
      const taskId = parseInt(operationalTaskMatch[1], 10)
      if (method === 'OPTIONS') { res.setHeader('Allow', 'PATCH,DELETE,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      if (method === 'PATCH') {
        const body = await readJsonBody(req)
        await handleOperationalTasksUpdateRequest(req, res, { method, taskId, sendJson: sj, body })
      } else if (method === 'DELETE') {
        await handleOperationalTasksDeleteRequest(req, res, { method, taskId, sendJson: sj })
      } else {
        sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
      }
      return
    }

    // GET /api/operational-tasks/:taskId/history — get task history
    const taskHistoryMatch = pathname.match(/^\/api\/operational-tasks\/(\d+)\/history$/)
    if (taskHistoryMatch) {
      const taskId = parseInt(taskHistoryMatch[1], 10)
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleTaskHistoryRequest(req, res, { method, taskId, sendJson: sj, requestUrl: req.url ?? '' })
      return
    }

    // GET /api/dashboard/notification-preferences — get dashboard notification preferences
    // POST /api/dashboard/notification-preferences — update dashboard notification preferences
    if (pathname === '/api/dashboard/notification-preferences') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,POST,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      if (method === 'GET') {
        await handleNotificationPreferencesGetRequest(req, res, { method, sendJson: sj })
      } else if (method === 'POST') {
        const body = await readJsonBody(req)
        await handleNotificationPreferencesUpdateRequest(req, res, { method, sendJson: sj, body })
      } else {
        sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } })
      }
      return
    }

    // ── Revenue Billing routes ────────────────────────────────────────────────

    // GET /api/revenue-billing/clients
    if (pathname === '/api/revenue-billing/clients') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleRevenueClients(req, res, { method, sendJson: sj, requestUrl })
      return
    }

    // ── Financial Management routes ───────────────────────────────────────────

    // GET /api/financial-management/summary
    if (pathname === '/api/financial-management/summary') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleFinancialSummary(req, res, { method, sendJson: sj, requestUrl: req.url ?? '' })
      return
    }

    // GET /api/financial-management/projects
    if (pathname === '/api/financial-management/projects') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleFinancialProjects(req, res, { method, sendJson: sj, requestUrl: req.url ?? '' })
      return
    }

    // GET /api/financial-management/cashflow
    if (pathname === '/api/financial-management/cashflow') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleFinancialCashflow(req, res, { method, sendJson: sj, requestUrl: req.url ?? '' })
      return
    }

    // GET /api/financial-management/categories
    if (pathname === '/api/financial-management/categories') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleFinancialCategories(req, res, { method, sendJson: sj })
      return
    }

    // GET /api/financial-management/dashboard-feed
    if (pathname === '/api/financial-management/dashboard-feed') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleFinancialDashboardFeed(req, res, { method, sendJson: sj, requestUrl: req.url ?? '' })
      return
    }

    // GET|POST|PUT|DELETE /api/financial-management/entries[/:id]
    if (pathname === '/api/financial-management/entries' || pathname.startsWith('/api/financial-management/entries/')) {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,POST,PUT,DELETE,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => {
        if (b === null) { sendNoContent(res); return }
        sendJson(res, s, b)
      }
      const body = ['POST', 'PUT'].includes(method) ? await readJsonBody(req) : undefined
      await handleFinancialEntries(req, res, { method, sendJson: sj, requestUrl: req.url ?? '', body })
      return
    }

    // ── Projects (Gestão Financeira > Projetos) ───────────────────────────────

    // GET /api/projects/summary
    if (pathname === '/api/projects/summary') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleProjectsSummary(req, res, { method, sendJson: sj })
      return
    }

    // POST /api/projects/from-plan/:planId
    {
      const fromPlanMatch = pathname.match(/^\/api\/projects\/from-plan\/([^/]+)$/)
      if (fromPlanMatch) {
        if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,OPTIONS'); sendNoContent(res); return }
        const sj = (s, b) => sendJson(res, s, b)
        const planId = decodeURIComponent(fromPlanMatch[1])
        await handleProjectFromPlan(req, res, { method, planId, readJsonBody, sendJson: sj })
        return
      }
    }

    // GET|PUT /api/projects/:id/finance
    {
      const financeMatch = pathname.match(/^\/api\/projects\/([^/]+)\/finance$/)
      if (financeMatch) {
        if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,PUT,OPTIONS'); sendNoContent(res); return }
        const sj = (s, b) => sendJson(res, s, b)
        await handleProjectFinance(req, res, { method, projectId: financeMatch[1], readJsonBody, sendJson: sj })
        return
      }
    }

    // PATCH /api/projects/:id/status
    {
      const statusMatch = pathname.match(/^\/api\/projects\/([^/]+)\/status$/)
      if (statusMatch) {
        if (method === 'OPTIONS') { res.setHeader('Allow', 'PATCH,OPTIONS'); sendNoContent(res); return }
        const sj = (s, b) => sendJson(res, s, b)
        await handleProjectStatus(req, res, { method, projectId: statusMatch[1], readJsonBody, sendJson: sj })
        return
      }
    }

    // PATCH /api/projects/:id/pv-data
    {
      const pvDataMatch = pathname.match(/^\/api\/projects\/([^/]+)\/pv-data$/)
      if (pvDataMatch) {
        if (method === 'OPTIONS') { res.setHeader('Allow', 'PATCH,OPTIONS'); sendNoContent(res); return }
        const sj = (s, b) => sendJson(res, s, b)
        await handleProjectPvData(req, res, { method, projectId: pvDataMatch[1], readJsonBody, sendJson: sj })
        return
      }
    }

    // GET|PATCH /api/projects/:id
    {
      const byIdMatch = pathname.match(/^\/api\/projects\/([^/]+)$/)
      if (byIdMatch) {
        if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,PATCH,OPTIONS'); sendNoContent(res); return }
        const sj = (s, b) => sendJson(res, s, b)
        await handleProjectById(req, res, { method, projectId: byIdMatch[1], readJsonBody, sendJson: sj })
        return
      }
    }

    // GET /api/projects
    if (pathname === '/api/projects') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleProjectsList(req, res, { method, sendJson: sj, requestUrl: req.url ?? '' })
      return
    }

    // ── Financial Import (Excel) ──────────────────────────────────────────────
    // POST /api/financial-import/parse   — upload XLSX → preview
    // POST /api/financial-import/confirm — upload XLSX → full import
    // GET  /api/financial-import/batches — list recent batches (audit log)

    if (pathname === '/api/financial-import/parse') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleFinancialImportParse(req, res, { method, sendJson: sj })
      return
    }

    if (pathname === '/api/financial-import/confirm') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'POST,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleFinancialImportConfirm(req, res, { method, sendJson: sj })
      return
    }

    if (pathname === '/api/financial-import/batches') {
      if (method === 'OPTIONS') { res.setHeader('Allow', 'GET,OPTIONS'); sendNoContent(res); return }
      const sj = (s, b) => sendJson(res, s, b)
      await handleFinancialImportBatches(req, res, { method, sendJson: sj, requestUrl: req.url ?? '' })
      return
    }

    if (pathname === '/api/financial-analyses') {
      await handleFinancialAnalyses(req, res, {
        method,
        readJsonBody,
        sendJson: (status, payload) => sendJson(res, status, payload),
      })
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
