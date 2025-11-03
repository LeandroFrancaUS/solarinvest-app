// pages/api/clients/[id].js
import { Pool } from 'pg';
import { verifyRequest } from '../../../src/lib/auth/verifyRequest';

let pool;
if (!global.__pgPool) {
  global.__pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
}
pool = global.__pgPool;

export default async function handler(req, res) {
  try {
    const user = await verifyRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = user.sub || null;
    const { id } = req.query;

    if (req.method === 'GET') {
      const clientConn = await pool.connect();
      try {
        const q = 'SELECT * FROM clients WHERE id = $1 AND user_id = $2';
        const r = await clientConn.query(q, [id, userId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        return res.status(200).json({ client: r.rows[0] });
      } finally {
        clientConn.release();
      }
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const clientConn = await pool.connect();
      try {
        const q = `
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
          RETURNING *`;
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
        ];
        const r = await clientConn.query(q, values);
        if (!r.rows.length) return res.status(404).json({ error: 'Not found or not allowed' });
        return res.status(200).json({ client: r.rows[0] });
      } finally {
        clientConn.release();
      }
    }

    if (req.method === 'DELETE') {
      const clientConn = await pool.connect();
      try {
        const q = 'DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING id';
        const r = await clientConn.query(q, [id, userId]);
        if (!r.rows.length) return res.status(404).json({ error: 'Not found or not allowed' });
        return res.status(200).json({ deletedId: r.rows[0].id });
      } finally {
        clientConn.release();
      }
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error('/api/clients/[id] error', err);
    return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
}