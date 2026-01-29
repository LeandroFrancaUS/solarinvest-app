// server/db.js
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL

if (!connectionString) {
  throw new Error('Missing DATABASE_URL (or NEON_DATABASE_URL)')
}

// Em Vercel/Serverless: use pool com limites baixos
export const pool = new Pool({
  connectionString,
  max: Number(process.env.NEON_MAX_CONNECTIONS || 10),
  ssl: { rejectUnauthorized: false },
})

// helper simples
export async function query(text, params) {
  const client = await pool.connect()
  try {
    const res = await client.query(text, params)
    return res
  } finally {
    client.release()
  }
}
