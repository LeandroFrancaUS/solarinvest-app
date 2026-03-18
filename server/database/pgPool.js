// server/database/pgPool.js
// Neon-based adapter that exposes the same interface as a pg Pool so that
// existing callers (api/clients/*.js, api/storage-hook.js) continue to work.
// This avoids a startup crash caused by the optional `pg` package being absent.
import { neon } from '@neondatabase/serverless'
import { getNeonDatabaseConfig } from './neonConfig.js'

let sqlSingleton

function getSql() {
  if (sqlSingleton) return sqlSingleton

  const { directConnectionString, connectionString } = getNeonDatabaseConfig()
  const resolvedConnection = directConnectionString || connectionString

  if (!resolvedConnection) {
    throw new Error('[database] Connection string is not configured')
  }

  sqlSingleton = neon(resolvedConnection)
  return sqlSingleton
}

// Returns a pool-like object whose interface is compatible with pg Pool:
//   pool.connect() → client with .query(text, params) and .release()
//   pool.query(text, params) → { rows, rowCount }
export function getPgPool() {
  const sql = getSql()

  const poolLike = {
    async connect() {
      return {
        async query(text, params) {
          return await sql.query(text, params)
        },
        release() {
          // No-op: Neon serverless manages its own connections per-request.
        },
      }
    },
    async query(text, params) {
      return await sql.query(text, params)
    },
  }

  return poolLike
}
