import { verifyRequest } from '../../src/lib/auth/verifyRequest.js'
import { getPgPool } from '../../server/database/pgPool.js'

const pool = getPgPool()

export default async function handler(req, res) {
  try {
    const user = await verifyRequest(req)
    const userId = user?.id || null
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: missing user id in session' })
      return
    }

    if (req.method === 'GET') {
      const clientConn = await pool.connect()
      try {
        const query = 'SELECT * FROM clients WHERE user_id = $1 ORDER BY updated_at DESC'
        const result = await clientConn.query(query, [userId])
        res.status(200).json({ clients: result.rows })
        return
      } finally {
        clientConn.release()
      }
    }

    if (req.method === 'POST') {
      const body = req.body || {}
      if (!body.name) {
        res.status(400).json({ error: 'Missing client name' })
        return
      }

      const clientConn = await pool.connect()
      try {
        const insert = `
          INSERT INTO clients (user_id, name, document, email, phone, city, state, address, uc, distribuidora, metadata, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now(), now())
          RETURNING *`
        const values = [
          userId,
          body.name,
          body.document || null,
          body.email || null,
          body.phone || null,
          body.city || null,
          body.state || null,
          body.address || null,
          body.uc || null,
          body.distribuidora || null,
          body.metadata ? body.metadata : null,
        ]
        const result = await clientConn.query(insert, values)
        res.status(201).json({ client: result.rows[0] })
        return
      } finally {
        clientConn.release()
      }
    }

    res.setHeader('Allow', 'GET, POST')
    res.status(405).end('Method Not Allowed')
  } catch (error) {
    console.error('/api/clients error', error)
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' })
  }
}
