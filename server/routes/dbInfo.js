// server/routes/dbInfo.js
// Admin-only DB diagnostics endpoint (/api/db-info).
// Extracted from the handler.js inline if-chain (PR 22).
//
// Returns masked connection info (host, db name, schema, user, pooled flag).
// Requires role_admin — no changes to auth behaviour.

import { resolveActor, actorRole } from '../proposals/permissions.js'
import { jsonResponse } from '../response.js'

/**
 * Registers the /api/db-info diagnostics route.
 *
 * @param {ReturnType<import('../router.js').createRouter>} router
 * @param {{
 *   databaseClient: { sql: Function } | null,
 *   databaseConfig: { connectionString?: string, source?: string },
 * }} moduleCtx
 */
export function registerDbInfoRoutes(router, { databaseClient, databaseConfig }) {
  router.register('*', '/api/db-info', async (req, res) => {
    const actor = await resolveActor(req)
    if (!actor) {
      jsonResponse(res, 401, { error: 'Autenticação necessária.' })
      return
    }
    if (actorRole(actor) !== 'role_admin') {
      jsonResponse(res, 403, { error: 'Requer perfil admin.' })
      return
    }
    if (!databaseClient?.sql) {
      jsonResponse(res, 503, { ok: false, error: 'DB_NOT_CONFIGURED' })
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
      jsonResponse(res, 200, {
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
      jsonResponse(res, 500, { ok: false, error: err?.message ?? 'DB_QUERY_FAILED' })
    }
  })
}
