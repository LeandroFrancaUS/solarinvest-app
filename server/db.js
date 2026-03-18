// server/db.js
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL

if (!connectionString) {
  // Warn at startup instead of throwing — lets the module load cleanly so that
  // bypass-mode (stackAuthBypass=true) works even when DATABASE_URL is absent.
  // Any actual query() call will still fail fast with an actionable error.
  console.warn('[db] Missing DATABASE_URL (or NEON_DATABASE_URL). Database queries will fail.')
}

// Em Vercel/Serverless: use pool com limites baixos
export const pool = connectionString
  ? new Pool({
      connectionString,
      max: Number(process.env.NEON_MAX_CONNECTIONS || 10),
      ssl: { rejectUnauthorized: false },
    })
  : null

// helper simples
export async function query(text, params) {
  if (!pool) {
    throw new Error(
      'Database not configured: set DATABASE_URL or NEON_DATABASE_URL. ' +
      'In bypass mode (STACK_AUTH_BYPASS=true), this code path should never be reached.'
    )
  }
  const client = await pool.connect()
  try {
    const res = await client.query(text, params)
    return res
  } finally {
    client.release()
  }
}
