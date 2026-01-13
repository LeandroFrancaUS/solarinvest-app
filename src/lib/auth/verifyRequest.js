// src/lib/auth/verifyRequest.js
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

const JWKS_URL = process.env.STACK_JWKS_URL || process.env.JWKS_URL;
const AUDIENCE = process.env.STACK_PROJECT_ID || process.env.NEXT_PUBLIC_STACK_PROJECT_ID;

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

function normalizePayload(payload) {
  if (!payload) return null;
  const id = payload.sub || payload.sub_id || payload.user_id || payload.email || null;
  return {
    ...payload,
    id,
  };
}

export async function verifyRequest(req) {
  // 1) Try cookie session (signed by AUTH_COOKIE_SECRET)
  try {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/solarinvest_session=([^;]+)/);
    const secret = process.env.AUTH_COOKIE_SECRET;
    if (match && secret) {
      const token = match[1];
      const decoded = jwt.verify(token, secret);
      return normalizePayload(decoded);
    }
  } catch (e) {
    // fallthrough to bearer
  }

  // 2) Try Authorization: Bearer <token> with JWKS
  try {
    const auth = (req.headers.authorization || '').trim();
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m && jwksClient && AUDIENCE) {
      const token = m[1];
      const payload = await new Promise((resolve, reject) => {
        jwt.verify(token, getKey, { audience: AUDIENCE, algorithms: ['RS256'] }, (err, payload) => {
          if (err) return reject(err);
          resolve(payload);
        });
      });
      return normalizePayload(payload);
    }
  } catch (e) {
    return null;
  }
  return null;
}
