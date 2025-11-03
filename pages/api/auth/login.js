// pages/api/auth/login.js
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const secret = process.env.AUTH_COOKIE_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server not configured for cookie auth' });

    const payload = jwt.decode(token) || {};
    const sessionToken = jwt.sign(payload, secret, { expiresIn: '7d' });

    const isSecure = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', `solarinvest_session=${sessionToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${isSecure ? '; Secure' : ''}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('/api/auth/login', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}