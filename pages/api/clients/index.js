// pages/api/clients/index.js
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

    if (req.method === 'GET') {
      const clientConn = await pool.connect();
      try {
        const q = 'SELECT * FROM clients WHERE user_id = $1 ORDER BY updated_at DESC';
        const r = await clientConn.query(q, [userId]);
        return res.status(200).json({ clients: r.rows });
      } finally {
        clientConn.release();
      }
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ error: 'Missing client name' });

      const clientConn = await pool.connect();
      try {
        const insert = `
          INSERT INTO clients (user_id, name, document, email, phone, city, state, address, uc, distribuidora, metadata, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now(), now())
          RETURNING *`;
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
        ];
        const r = await clientConn.query(insert, values);
        return res.status(201).json({ client: r.rows[0] });
      } finally {
        clientConn.release();
      }
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error('/api/clients error', err);
    return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
}