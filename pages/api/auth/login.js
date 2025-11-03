// pages/api/auth/login.js
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

const JWKS_URL = process.env.JWKS_URL;
const AUDIENCE = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;

let jwksClient;
if (JWKS_URL) {
  jwksClient = jwksRsa({ jwksUri: JWKS_URL, cache: true, cacheMaxEntries: 5, cacheMaxAge: 600000 });
}

function getKey(header, callback) {
  if (!jwksClient) return callback(new Error('JWKS not configured'));
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const pub = key.getPublicKey();
    callback(null, pub);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Missing token' });

    // Prefer to validate token with JWKS if configured
    let payload = null;
    if (jwksClient && AUDIENCE) {
      try {
        payload = await new Promise((resolve, reject) => {
          jwt.verify(token, getKey, { audience: AUDIENCE, algorithms: ['RS256'] }, (err, decoded) => {
            if (err) return reject(err);
            resolve(decoded);
          });
        });
      } catch (e) {
        console.warn('[login] JWKS verify failed, falling back to decode', e);
      }
    }

    // Fallback to decode if verification not possible
    if (!payload) {
      payload = jwt.decode(token) || {};
    }

    const secret = process.env.AUTH_COOKIE_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server not configured for cookie auth' });

    // Ensure payload has an identifier (sub or email)
    const id = payload.sub || payload.sub_id || payload.user_id || payload.email || null;
    if (!id) return res.status(400).json({ error: 'Token missing subject/email' });

    const sessionToken = jwt.sign(payload, secret, { expiresIn: '7d' });

    const isSecure = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', `solarinvest_session=${sessionToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${isSecure ? '; Secure' : ''}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('/api/auth/login', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
