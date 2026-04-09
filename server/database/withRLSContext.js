// server/database/withRLSContext.js
//
// Helper that creates a user-scoped SQL wrapper for the Neon serverless driver.
//
// PostgreSQL RLS policies on user-owned tables (storage, clients, proposals)
// check the session setting `app.current_user_id` to decide which rows are
// visible.  Because each Neon HTTP call is an independent connection, the only
// reliable way to set a session variable for a query is to batch both the
// set_config() call and the actual query in a single transaction round trip
// using the neon driver's sql.transaction([]) API.
//
// Usage:
//   import { createUserScopedSql } from '../database/withRLSContext.js'
//   const userSql = createUserScopedSql(db.sql, actor.userId)
//   const rows = await userSql`SELECT * FROM clients WHERE ...`
//   const rows = await userSql('SELECT * FROM clients WHERE id = $1', [id])
//
// When userId is null / empty the original sql is returned unchanged so that
// privileged (admin/service) queries continue to use the RLS bypass path
// defined by the `nullif(current_setting(...), '') IS NULL` policy condition.

/**
 * Returns a sql wrapper that transparently prepends
 * `set_config('app.current_user_id', userId, true)` to every query via the
 * neon transaction batch API.
 *
 * @param {Function} sql     - neon tagged-template function (from neonClient)
 * @param {string|null} userId - Stack Auth user ID for the request, or null
 *                               for privileged / admin operations
 * @returns {Function} Tagged-template function compatible with the neon API
 */
export function createUserScopedSql(sql, userId) {
  const safeUserId = typeof userId === 'string' ? userId.trim() : ''

  // No userId → return raw sql; RLS "no-context" bypass applies at DB level.
  if (!safeUserId) return sql

  // Graceful fallback: if the driver version does not expose .transaction(),
  // fall back to raw sql.  Application-level WHERE clauses still enforce
  // ownership; RLS simply won't add the second layer for this call.
  if (typeof sql?.transaction !== 'function') {
    console.warn('[rls] sql.transaction not available; RLS context not set for user', safeUserId)
    return sql
  }

  /**
   * Wraps any sql call (template tag or parameterised string form) in a
   * single-round-trip transaction that sets app.current_user_id first.
   *
   * Both call signatures of the neon driver are supported:
   *   userSql`SELECT * FROM clients WHERE id = ${id}`
   *     → strings = TemplateStringsArray, values = [id]
   *     → forwarded as sql(TemplateStringsArray, id)  ✓ tagged-template form
   *
   *   userSql('SELECT * FROM clients WHERE id = $1', [id])
   *     → strings = 'SELECT ...', values = [[id]]
   *     → forwarded as sql('SELECT ...', [id])         ✓ parameterised form
   *
   * The `...values` spread handles both cases correctly: for the parameterised
   * form the outer array wrapper becomes the variadic spread, so the neon
   * driver receives exactly (string, array) as expected.
   */
  return (strings, ...values) => {
    // Build the lazy (not yet executed) NeonQueryPromise for the caller's
    // query.  Both tagged-template and plain-function forms use the same
    // underlying neon callable, so forwarding (strings, ...values) works for
    // both.
    const dataQuery = sql(strings, ...values)

    // Batch set_config + data query into one HTTP round trip.
    // set_config(key, value, is_local=true) scopes the setting to the
    // current transaction, which is what we want.
    return sql
      .transaction([
        sql`SELECT set_config('app.current_user_id', ${safeUserId}, true)`,
        dataQuery,
      ])
      .then(([, result]) => result)
  }
}
