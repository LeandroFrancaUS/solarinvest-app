// server/db.js
// Uses @neondatabase/serverless (already in dependencies) instead of pg.
// This avoids a startup crash when the optional `pg` package is not installed.
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL

if (!connectionString) {
  // Warn at startup instead of throwing — lets the module load cleanly so that
  // bypass-mode (STACK_AUTH_BYPASS=true) works even when DATABASE_URL is absent.
  // Any actual query() call will still fail fast with an actionable error.
  console.warn('[db] Missing DATABASE_URL (or NEON_DATABASE_URL). Database queries will fail.')
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
      'Database not configured: set DATABASE_URL or NEON_DATABASE_URL. ' +
      'In bypass mode (STACK_AUTH_BYPASS=true), this code path should never be reached.'
    )
  }
  return await sql(text, params ?? [])
}
