// api/auth/login.js
// POST /api/auth/login
//
// Exchanges a valid Stack Auth Bearer token for a backend HMAC session cookie.
// This gives /api/auth/me a second authentication path (session cookie) in addition
// to the per-request Bearer-token JWKS verification already implemented in
// server/auth/stackAuth.js.
//
// Design constraints
// ------------------
// • NO external JWT library (jsonwebtoken, jwks-rsa, etc.) — those are not
//   installed in package.json and would cause ERR_MODULE_NOT_FOUND crashes.
// • Uses only node:crypto built-ins + the project's own server/auth/stackAuth.js
//   (which already implements JWKS verification via the same built-ins).
// • The signed session cookie is verifiable by verifyHmacJwt in stackAuth.js —
//   both use base64url-encoded HS256 JWTs with sub/email/exp/nbf/iat claims.

import { createHmac } from 'node:crypto'
import { getStackUser } from '../../server/auth/stackAuth.js'

// ── Session cookie configuration ─────────────────────────────────────────────
const SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60   // 7 days
const COOKIE_NAME = (process.env.AUTH_COOKIE_NAME ?? '').trim() || 'solarinvest_session'
const COOKIE_SECRET = (process.env.AUTH_COOKIE_SECRET ?? process.env.JWT_SECRET ?? '').trim()

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sign a minimal session JWT with HMAC-SHA256.
 *
 * Produces a standard base64url HS256 JWT that is verifiable by verifyHmacJwt()
 * in server/auth/stackAuth.js without any external library.
 *
 * @param {string} userId  Stack Auth user ID (stored as `sub`)
 * @param {string} email   User email address
 * @returns {string|null}  Signed token string, or null on error
 */
function signSessionJwt(userId, email) {
  if (!COOKIE_SECRET || !userId) return null

  const now = Math.floor(Date.now() / 1000)

  // base64url encode using Node.js built-in (requires Node 16+, project uses 24.x)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    email: email || '',
    iat: now,
    exp: now + SESSION_EXPIRY_SECONDS,
    nbf: now - 5,   // 5 seconds clock-skew grace period
  })).toString('base64url')

  const signingInput = `${header}.${payload}`
  const signature = createHmac('sha256', COOKIE_SECRET)
    .update(signingInput)
    .digest()
    .toString('base64url')

  return `${signingInput}.${signature}`
}

/**
 * Whether the current runtime environment is production.
 * Covers Node's standard NODE_ENV and Vercel's VERCEL_ENV.
 */
function isProductionEnv() {
  return (
    process.env.NODE_ENV === 'production' ||
    (typeof process.env.VERCEL_ENV === 'string' &&
      process.env.VERCEL_ENV !== 'development')
  )
}

// ── Simple in-memory rate limiter (best-effort for serverless) ────────────────
const LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 1000   // 1-minute window
const LOGIN_RATE_LIMIT_MAX = 10                 // max 10 login attempts per IP per minute
const loginRateBuckets = new Map()              // IP → { count, resetAt }

function isLoginRateLimited(req) {
  const forwarded = typeof req.headers?.['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : ''
  const ip = forwarded || req.socket?.remoteAddress || ''
  if (!ip) return false

  const now = Date.now()
  // Lazy cleanup when map grows large
  if (loginRateBuckets.size > 5_000) {
    for (const [key, bucket] of loginRateBuckets) {
      if (bucket.resetAt <= now) loginRateBuckets.delete(key)
    }
  }
  let bucket = loginRateBuckets.get(ip)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS }
    loginRateBuckets.set(ip, bucket)
  }
  bucket.count += 1
  return bucket.count > LOGIN_RATE_LIMIT_MAX
}

// ── Request handler ───────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  // Pre-flight (CORS)
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST,OPTIONS')
    res.statusCode = 204
    res.end()
    return
  }

  // Only POST is accepted.  Return 405 (not 500) so Vercel health checks,
  // browser prefetches, and stale GET callers get a meaningful response
  // instead of a crash.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method Not Allowed' }))
    return
  }

  // Rate limiting: prevent brute-force login attempts
  if (isLoginRateLimited(req)) {
    res.statusCode = 429
    res.end(JSON.stringify({ error: 'Too many requests. Try again later.' }))
    return
  }

  const authHeaderPresent = Boolean(req.headers?.authorization)

  if (!authHeaderPresent) {
    res.statusCode = 401
    res.end(JSON.stringify({ error: 'Missing Authorization header' }))
    return
  }

  try {
    // Verify the Stack Auth Bearer token using the existing JWKS implementation.
    // getStackUser() reads the Authorization header, verifies via JWKS, and
    // returns { id, email, payload } or null.
    const stackUser = await getStackUser(req)

    if (!stackUser?.id) {
      res.statusCode = 401
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    if (!COOKIE_SECRET) {
      // AUTH_COOKIE_SECRET not configured: skip cookie creation.
      // Bearer-token JWKS verification (in /api/auth/me) remains the active auth path.
      console.warn('[auth/login] AUTH_COOKIE_SECRET not set — session cookie skipped; Bearer-token auth remains active')
      res.statusCode = 200
      res.end(JSON.stringify({ ok: true, sessionCookie: false }))
      return
    }

    const token = signSessionJwt(stackUser.id, stackUser.email)
    if (!token) {
      console.error('[auth/login] failed to sign session JWT')
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to create session' }))
      return
    }

    const secure = isProductionEnv() ? '; Secure' : ''
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_EXPIRY_SECONDS}; SameSite=Lax${secure}`,
    )
    res.statusCode = 200
    res.end(JSON.stringify({ ok: true, sessionCookie: true }))
  } catch (error) {
    console.error('[auth/login] error:', error?.message ?? String(error))
    res.statusCode = 500
    res.end(JSON.stringify({ error: 'Internal error' }))
  }
}
