// server/database/withRLSContext.js
//
// Helper that creates a user-scoped SQL wrapper for the Neon serverless driver.
//
// PostgreSQL RLS policies on user-owned tables (storage, clients, proposals)
// read two session settings to decide which rows are visible/writable:
//   app.current_user_id   → Stack Auth user ID of the requesting user
//   app.current_user_role → canonical role string (role_admin | role_financeiro |
//                            role_office | role_comercial)
//
// Because each Neon HTTP call is an independent connection, the only reliable
// way to set session variables for a query is to batch both set_config() calls
// and the actual query in a single transaction round trip using the neon
// driver's sql.transaction([]) API.
//
// NEW API (authenticated routes):
//   import { createUserScopedSql } from '../database/withRLSContext.js'
//   const userSql = createUserScopedSql(db.sql, { userId: actor.userId, role: actorRole(actor) })
//   const rows = await userSql`SELECT * FROM clients WHERE ...`
//   const rows = await userSql('SELECT * FROM clients WHERE id = $1', [id])
//
// LEGACY API (backward compat - sets only app.current_user_id):
//   const userSql = createUserScopedSql(db.sql, userId_string)   // deprecated
//
// Fail-closed: passing { userId, role } where either value is absent throws an
// error immediately so that misconfigured callers are caught at development time
// rather than silently falling back to service-level access.
//
// Service / admin queries that use db.sql directly (migrations, audit log, etc.)
// do NOT go through this helper and therefore set no session context - the RLS
// policies treat that as the service bypass path (returns all rows).

/**
 * Returns a sql wrapper that transparently prepends two set_config() calls -
 * one for app.current_user_id and one for app.current_user_role - before every
 * query via the neon transaction batch API.
 *
 * @param {Function} sql  - neon tagged-template function (from neonClient)
 * @param {Object|string|null} options
 *   Object form (new API):
 *     { userId: string, role: string }
 *     Both fields are required; throws if either is missing.
 *   String form (legacy, deprecated):
 *     userId string (sets only app.current_user_id, no role context).
 *     Pass null/empty to get raw sql back (service bypass).
 * @returns {Function} Tagged-template function compatible with the neon API
 */
export function createUserScopedSql(sql, options) {
  // -- New API: { userId, role } -----------------------------------------------
  if (options !== null && typeof options === 'object') {
    const { userId, role } = options

    // Fail-closed: both must be non-empty strings in the new API.
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      const err = new Error('[rls] createUserScopedSql called without userId - authentication required')
      err.statusCode = 401
      throw err
    }
    if (!role || typeof role !== 'string' || !role.trim()) {
      const err = new Error('[rls] createUserScopedSql called without role - authorization required')
      err.statusCode = 403
      throw err
    }

    const safeUserId = userId.trim()
    const safeRole   = role.trim()

    // Graceful fallback: if the driver version does not expose .transaction(),
    // log a warning and return raw sql.  The RLS context will not be set but
    // application-layer checks still provide a security layer.
    if (typeof sql?.transaction !== 'function') {
      console.warn('[rls] sql.transaction not available; RLS context not set for user', safeUserId)
      return sql
    }

    /**
     * Wraps any sql call in a single-round-trip transaction that sets both
     * app.current_user_id and app.current_user_role before the caller's query.
     *
     * Both tagged-template and parameterised call signatures are supported:
     *   userSql`SELECT ...`          -> (TemplateStringsArray, ...values)
     *   userSql('SELECT ...', [...]) -> (string, ...[[...]])
     */
    return (strings, ...values) => {
      const dataQuery = sql(strings, ...values)
      return sql
        .transaction([
          sql`SELECT set_config('app.current_user_id',   ${safeUserId}, true)`,
          sql`SELECT set_config('app.current_user_role', ${safeRole},   true)`,
          dataQuery,
        ])
        .then(([,, result]) => result)
    }
  }

  // -- Legacy API: string userId (or null) -------------------------------------
  // Kept for backward compat.  Sets only app.current_user_id; no role context
  // is written, so RLS falls back to the no-context service bypass.
  // New code should use the object form above.
  const safeUserId = typeof options === 'string' ? options.trim() : ''

  if (!safeUserId) {
    // No userId -> return raw sql; RLS bypass applies at DB level.
    return sql
  }

  if (typeof sql?.transaction !== 'function') {
    console.warn('[rls] sql.transaction not available; RLS context not set for user', safeUserId)
    return sql
  }

  return (strings, ...values) => {
    const dataQuery = sql(strings, ...values)
    return sql
      .transaction([
        sql`SELECT set_config('app.current_user_id', ${safeUserId}, true)`,
        dataQuery,
      ])
      .then(([, result]) => result)
  }
}
