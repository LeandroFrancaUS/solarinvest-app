// server/routes/health.js
// Health-check route handlers.
//
// These handlers were extracted from the inline if-chain in handler.js as part
// of the route registry foundation (PR 12).  /api/health/pdf,
// /api/health/contracts, and /api/test were added in PR 22.
// Response shapes and status codes are intentionally identical to the originals.

import { getNeonDatabaseConfig } from '../database/neonConfig.js'
import { jsonResponse } from '../response.js'

/**
 * Registers all health-check routes on the given router.
 *
 * @param {ReturnType<import('../router.js').createRouter>} router
 * @param {{
 *   databaseClient:        { sql: Function } | null,
 *   databaseConfig:        { connectionString?: string },
 *   storageService:        object | null,
 *   stackAuthEnabled:      boolean,
 *   sendServerError:       (res: object, status: number, payload: object, requestId?: string, vercelId?: string) => void,
 *   isConvertApiConfigured?:  () => boolean,
 *   isGotenbergConfigured?:   () => boolean,
 *   contractTemplatePath?:    string,
 *   checkFileExists?:         (p: string) => Promise<void>,
 * }} moduleCtx
 */
export function registerHealthRoutes(router, moduleCtx) {
  const {
    databaseClient,
    databaseConfig,
    storageService,
    stackAuthEnabled,
    sendServerError,
    isConvertApiConfigured = () => false,
    isGotenbergConfigured = () => false,
    contractTemplatePath = null,
    checkFileExists = null,
  } = moduleCtx

  // ── /health  and  /api/health ──────────────────────────────────────────────
  // Quick liveness probe: verifies DB connectivity and returns ok+db flags.

  /** @param {object} req @param {object} res @param {{ requestId?: string, vercelId?: string }} reqCtx */
  const handleHealth = async (req, res, { requestId, vercelId }) => {
    const requestUrl = new URL(req.url, 'http://localhost')
    const diagnostics = getNeonDatabaseConfig()
    console.info('[db-runtime]', {
      route: requestUrl.pathname,
      dbSource: diagnostics.source ?? null,
      schema: diagnostics.schema ?? 'public',
    })

    if (!databaseClient || !databaseConfig.connectionString) {
      sendServerError(
        res,
        503,
        { ok: false, db: false, error: 'DB_NOT_CONFIGURED' },
        requestId,
        vercelId,
      )
      return
    }

    try {
      await databaseClient.sql`SELECT 1 AS ok`
      jsonResponse(res, 200, { ok: true, db: true })
    } catch (error) {
      console.error('[api/health] failed', {
        message: error instanceof Error ? error.message : String(error),
      })
      sendServerError(
        res,
        500,
        { ok: false, db: false, error: 'DB_HEALTHCHECK_FAILED' },
        requestId,
        vercelId,
      )
    }
  }

  router.register('*', '/health', handleHealth)
  router.register('*', '/api/health', handleHealth)

  // ── /api/health/db ─────────────────────────────────────────────────────────
  // Detailed DB health: latency, server timestamp.

  router.register('*', '/api/health/db', async (_req, res, { requestId, vercelId }) => {
    if (!databaseClient || !databaseConfig.connectionString) {
      sendServerError(
        res,
        503,
        {
          ok: false,
          db: 'not_configured',
          error: 'Banco de dados não configurado. Defina DATABASE_URL.',
        },
        requestId,
        vercelId,
      )
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

      jsonResponse(res, 200, { ok: true, db: 'connected', now: serialized, latencyMs })
    } catch (error) {
      const latencyMs = Date.now() - startTime
      console.error('[database] Falha no health check:', error)
      sendServerError(
        res,
        500,
        {
          ok: false,
          db: 'error',
          error: 'Falha ao conectar ao banco de dados',
          latencyMs,
        },
        requestId,
        vercelId,
      )
    }
  })

  // ── /api/health/auth ───────────────────────────────────────────────────────
  // Auth configuration probe: reports Stack Auth enabled/bypass status.

  router.register('*', '/api/health/auth', (_req, res, _reqCtx) => {
    jsonResponse(res, 200, {
      ok: true,
      service: 'auth',
      status: !stackAuthEnabled ? 'bypass' : 'configured',
      stackAuthEnabled,
    })
  })

  // ── /api/health/storage ────────────────────────────────────────────────────
  // Storage layer probe: verifies DB reachability for the storage service.

  router.register('*', '/api/health/storage', async (_req, res, _reqCtx) => {
    if (!storageService || !databaseClient || !databaseConfig.connectionString) {
      jsonResponse(res, 503, {
        ok: false,
        service: 'storage',
        status: 'not_configured',
        error: 'DATABASE_URL não definido ou storage indisponível.',
      })
      return
    }

    const startTime = Date.now()
    try {
      await databaseClient.sql`SELECT 1 AS ok`
      jsonResponse(res, 200, {
        ok: true,
        service: 'storage',
        status: 'connected',
        latencyMs: Date.now() - startTime,
      })
    } catch (_err) {
      jsonResponse(res, 503, {
        ok: false,
        service: 'storage',
        status: 'error',
        error: 'Falha ao conectar ao banco de dados.',
        latencyMs: Date.now() - startTime,
      })
    }
  })

  // ── /api/health/pdf ────────────────────────────────────────────────────────
  // Reports whether ConvertAPI / Gotenberg PDF converters are configured.

  router.register('*', '/api/health/pdf', (_req, res, _reqCtx) => {
    const convertapiConfigured = isConvertApiConfigured()
    const gotenbergConfigured = isGotenbergConfigured()
    jsonResponse(res, 200, {
      ok: convertapiConfigured || gotenbergConfigured,
      convertapiConfigured,
      gotenbergConfigured,
    })
  })

  // ── /api/health/contracts ──────────────────────────────────────────────────
  // Checks whether the leasing contract template file exists on disk and which
  // PDF converters are available.

  router.register('*', '/api/health/contracts', async (_req, res, _reqCtx) => {
    let templateExists = false
    if (contractTemplatePath && checkFileExists) {
      try { await checkFileExists(contractTemplatePath); templateExists = true } catch { templateExists = false }
    }
    jsonResponse(res, 200, {
      ok: templateExists,
      templateExists,
      convertapiConfigured: isConvertApiConfigured(),
      gotenbergConfigured: isGotenbergConfigured(),
      node: process.version,
    })
  })

  // ── /api/test ─────────────────────────────────────────────────────────────
  // Lightweight DB connectivity probe — returns the current server timestamp.

  router.register('*', '/api/test', async (_req, res, _reqCtx) => {
    if (!databaseClient || !databaseConfig.connectionString) {
      jsonResponse(res, 503, { error: 'Persistência indisponível' })
      return
    }
    const result = await databaseClient.sql`SELECT NOW() AS current_time`
    const row = Array.isArray(result) && result.length > 0 ? result[0] : null
    const nowValue = row?.current_time ?? row?.now ?? null
    const serialized =
      nowValue && typeof nowValue.toISOString === 'function'
        ? nowValue.toISOString()
        : nowValue
    jsonResponse(res, 200, { now: serialized })
  })
}
