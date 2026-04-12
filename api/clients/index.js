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
      const pageRaw = Number.parseInt(String(req.query?.page ?? '1'), 10)
      const limitRaw = Number.parseInt(String(req.query?.limit ?? '100'), 10)
      const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1
      const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, limitRaw)) : 100
      const offset = (page - 1) * limit
      const clientConn = await pool.connect()
      try {
        const countQuery = 'SELECT COUNT(*)::int AS total FROM clients WHERE user_id = $1'
        const listQuery = `
          SELECT * FROM clients
          WHERE user_id = $1
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT $2 OFFSET $3
        `
        const [countResult, result] = await Promise.all([
          clientConn.query(countQuery, [userId]),
          clientConn.query(listQuery, [userId, limit, offset]),
        ])
        const total = Number(countResult.rows?.[0]?.total ?? 0)
        const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1
        res.status(200).json({
          ok: true,
          data: result.rows,
          clients: result.rows,
          meta: { page, limit, total, totalPages },
        })
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
    console.error('[api/clients][GET|POST] failed', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      query: req.query,
      method: req.method,
    })
    res.status(error.status || 500).json({
      error: 'CLIENTS_LIST_FAILED',
      message: 'Falha ao carregar clientes.',
    })
  }
}
