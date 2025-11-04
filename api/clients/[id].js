import { Pool } from 'pg'
import { verifyRequest } from '../../src/lib/auth/verifyRequest.js'

let pool
if (!global.__pgPool) {
  global.__pgPool = new Pool({ connectionString: process.env.DATABASE_URL })
}

pool = global.__pgPool

export default async function handler(req, res) {
  try {
    const user = await verifyRequest(req)
    const userId = user?.id || null
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: missing user id in session' })
      return
    }

    const { id } = req.query

    if (req.method === 'GET') {
      const clientConn = await pool.connect()
      try {
        const query = 'SELECT * FROM clients WHERE id = $1 AND user_id = $2'
        const result = await clientConn.query(query, [id, userId])
        if (!result.rows.length) {
          res.status(404).json({ error: 'Not found' })
          return
        }
        res.status(200).json({ client: result.rows[0] })
        return
      } finally {
        clientConn.release()
      }
    }

    if (req.method === 'PUT') {
      const body = req.body || {}
      const clientConn = await pool.connect()
      try {
        const query = `
          UPDATE clients SET
            name = COALESCE($1, name),
            document = COALESCE($2, document),
            email = COALESCE($3, email),
            phone = COALESCE($4, phone),
            city = COALESCE($5, city),
            state = COALESCE($6, state),
            address = COALESCE($7, address),
            uc = COALESCE($8, uc),
            distribuidora = COALESCE($9, distribuidora),
            metadata = COALESCE($10, metadata),
            updated_at = now()
          WHERE id = $11 AND user_id = $12
          RETURNING *`
        const values = [
          body.name || null,
          body.document || null,
          body.email || null,
          body.phone || null,
          body.city || null,
          body.state || null,
          body.address || null,
          body.uc || null,
          body.distribuidora || null,
          body.metadata ? body.metadata : null,
          id,
          userId,
        ]
        const result = await clientConn.query(query, values)
        if (!result.rows.length) {
          res.status(404).json({ error: 'Not found or not allowed' })
          return
        }
        res.status(200).json({ client: result.rows[0] })
        return
      } finally {
        clientConn.release()
      }
    }

    if (req.method === 'DELETE') {
      const clientConn = await pool.connect()
      try {
        const query = 'DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING id'
        const result = await clientConn.query(query, [id, userId])
        if (!result.rows.length) {
          res.status(404).json({ error: 'Not found or not allowed' })
          return
        }
        res.status(200).json({ deletedId: result.rows[0].id })
        return
      } finally {
        clientConn.release()
      }
    }

    res.setHeader('Allow', 'GET, PUT, DELETE')
    res.status(405).end('Method Not Allowed')
  } catch (error) {
    console.error('/api/clients/[id] error', error)
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' })
  }
}
