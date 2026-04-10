// server/database/withRls.js
//
// Higher-order helper that wraps a database operation in a transaction that
// sets the RLS session context before executing the caller's query.
//
// Usage:
//   import { withRlsClient } from '../database/withRls.js'
//
//   const result = await withRlsClient(actor, async (client) => {
//     return client.query('SELECT * FROM clients WHERE id = $1', [id])
//   })
//
// Where `actor` is an AuthenticatedRlsActor:
//   { authProviderUserId: string, role: DatabaseRlsRole }
//
// The helper:
//   1. Acquires a pooled WebSocket connection (persistent, session-aware)
//   2. Opens a transaction (BEGIN)
//   3. Sets app.current_user_id and app.current_user_role (transaction-local)
//   4. Calls fn(client) — caller runs their query
//   5. COMMITs on success or ROLLBACKs on error
//   6. Releases the client back to the pool
//
// Using is_local=true in set_config means the session variables are cleared
// automatically when the transaction ends, preventing context leaks across
// reused pool connections.

import { getPgPool } from './pgPool.js'
import { applyRlsContext } from './rlsContext.js'

/**
 * Executes `fn` inside a transaction with the RLS session context applied.
 *
 * @template T
 * @param {import('./rlsContext.js').AuthenticatedRlsActor} actor
 * @param {(client: import('@neondatabase/serverless').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withRlsClient(actor, fn) {
  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await applyRlsContext(client, actor)
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
