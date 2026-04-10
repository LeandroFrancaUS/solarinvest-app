// server/database/pgPool.js
//
// Returns a pg-compatible Pool backed by Neon's WebSocket driver.
//
// WHY WebSocket Pool (not neon() HTTP):
//   The neon() HTTP function is stateless — each call opens a new HTTP request
//   which resets any PostgreSQL session variables (including the app.*
//   settings used by RLS policies).  The WebSocket Pool maintains a persistent
//   connection so that SET / set_config() calls made at the start of a
//   transaction remain visible to subsequent queries within that same
//   transaction, which is required for RLS to work correctly.
//
// The Pool instance is a singleton per process to avoid exhausting connection
// limits.  Call getPgPool().end() during graceful shutdown if needed.

import ws from 'ws'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { getNeonDatabaseConfig } from './neonConfig.js'

// Configure the WebSocket constructor once for the Neon driver.
// This is required in Node.js environments where the global WebSocket API is
// not available.  In browsers (or Node 24+ with the global WebSocket flag),
// this assignment is a harmless no-op.
neonConfig.webSocketConstructor = ws

let poolSingleton

/**
 * Returns the shared pg-compatible WebSocket Pool for RLS-protected queries.
 *
 * The returned pool exposes:
 *   pool.connect()          → PoolClient with .query(text, params), .release()
 *   pool.query(text, params) → { rows, rowCount, fields }
 *
 * Always prefer withRlsClient() (server/database/withRls.js) over calling
 * pool.connect() directly when running queries on RLS-protected tables.
 *
 * @returns {Pool}
 */
export function getPgPool() {
  if (poolSingleton) return poolSingleton

  const { directConnectionString, connectionString } = getNeonDatabaseConfig()
  const resolvedConnection = directConnectionString || connectionString

  if (!resolvedConnection) {
    throw new Error('[database] Connection string is not configured')
  }

  poolSingleton = new Pool({ connectionString: resolvedConnection })
  return poolSingleton
}
