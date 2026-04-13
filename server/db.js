// server/db.js
// Uses @neondatabase/serverless (already in dependencies) instead of pg.
// This avoids a startup crash when the optional `pg` package is not installed.
import { neon } from '@neondatabase/serverless'
import { getCanonicalDatabaseUrl } from './database/connection.js'

const connectionString = getCanonicalDatabaseUrl()

if (!connectionString) {
  // Warn at startup instead of throwing — lets the module load cleanly so that
  // bypass-mode (STACK_AUTH_BYPASS=true) works even when DATABASE_URL is absent.
  // Any actual query() call will still fail fast with an actionable error.
  console.warn('[db] Missing canonical DATABASE_URL. Database queries will fail.')
}

// fullResults: true makes the response shape match the pg Pool interface:
// { rows: [...], fields: [...], rowCount: n, ... }
const sql = connectionString ? neon(connectionString, { fullResults: true }) : null

// Exported for backward-compatibility; no longer backed by a pg Pool.
export const pool = null

// Helper: execute a parameterized SQL query.
// Returns { rows: [...], rowCount: n } compatible with the pg Pool.query() interface.
export async function query(text, params) {
  if (!sql) {
    throw new Error(
      'Database configuration missing. Set DATABASE_URL (preferred) or optional legacy PG* variables. ' +
      'In bypass mode (STACK_AUTH_BYPASS=true), this code path should never be reached.'
    )
  }
  return await sql(text, params ?? [])
}
