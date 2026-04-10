// server/database/withRls.js
//
// Higher-order helper that wraps a database operation with the RLS session
// context set for the authenticated actor.
//
// IMPORTANT — Neon serverless HTTP driver limitation:
//   This module uses the Neon HTTP driver via createUserScopedSql, which batches
//   the set_config() calls together with the data query in a single round-trip
//   transaction using sql.transaction([]).  This is the only reliable way to
//   preserve session variables across statements when using stateless HTTP
//   connections.  Do NOT use this helper with a plain pg Pool over HTTP — the
//   BEGIN/set_config/query sequence would be three separate HTTP requests and
//   the session variables would not carry over.
//
// Usage:
//   import { withRlsQuery } from '../database/withRls.js'
//
//   const rows = await withRlsQuery(db.sql, actor, sql => sql`SELECT * FROM clients`)
//
// Where `actor` is an AuthenticatedRlsActor:
//   { authProviderUserId: string, role: DatabaseRlsRole }

import { createUserScopedSql } from './withRLSContext.js'

/**
 * Executes `fn` with an RLS-scoped sql wrapper applied for the given actor.
 *
 * The returned sql function transparently prepends two set_config() calls
 * (app.current_user_id and app.current_user_role) before every query via
 * the Neon transaction batch API — ensuring the PostgreSQL RLS policies
 * see the correct session context.
 *
 * @template T
 * @param {Function} sql - neon tagged-template function (from getDatabaseClient().sql)
 * @param {import('./rlsContext.js').AuthenticatedRlsActor} actor
 * @param {(scopedSql: Function) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withRlsQuery(sql, actor, fn) {
  const scopedSql = createUserScopedSql(sql, {
    userId: actor.authProviderUserId,
    role: actor.role,
  })
  return fn(scopedSql)
}

/**
 * @deprecated Use withRlsQuery() instead. withRlsClient() is kept for
 * backward compatibility but internally uses the same Neon HTTP transaction
 * approach as withRlsQuery(). BEGIN/COMMIT are no-ops over Neon HTTP.
 *
 * @template T
 * @param {import('./rlsContext.js').AuthenticatedRlsActor} actor
 * @param {(client: { query: Function }) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withRlsClient(actor, fn) {
  // NOTE: This version wraps withRlsQuery and exposes a query() interface for
  // callers that expect the pg PoolClient-style API. The sql function is obtained
  // from neonClient at call time, so this requires getDatabaseClient() to be
  // configured.  Prefer withRlsQuery() for new code.
  const { getDatabaseClient } = await import('./neonClient.js')
  const db = getDatabaseClient()
  if (!db) {
    throw new Error('[withRlsClient] Database not configured')
  }
  return withRlsQuery(db.sql, actor, async (scopedSql) => {
    // Provide a pg PoolClient-like interface for callers that use client.query()
    const client = {
      query: (text, params) => scopedSql(text, ...(params ? [params] : [])),
    }
    return fn(client)
  })
}

