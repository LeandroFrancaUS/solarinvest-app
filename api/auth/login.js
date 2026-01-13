import jwt from 'jsonwebtoken'
import jwksRsa from 'jwks-rsa'

const JWKS_URL = process.env.STACK_JWKS_URL || process.env.JWKS_URL
const AUDIENCE = process.env.STACK_PROJECT_ID || process.env.NEXT_PUBLIC_STACK_PROJECT_ID
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'brsolarinvest@gmail.com').trim()

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildTrustedOriginsSet() {
  const raw = [
    process.env.TRUSTED_WEB_ORIGINS,
    process.env.STACK_TRUSTED_DOMAIN,
    process.env.TRUSTED_DOMAIN,
    process.env.CORS_ALLOWED_ORIGINS,
    process.env.ALLOWED_ORIGINS,
  ]
    .map((v) => sanitizeString(v))
    .filter(Boolean)
    .join(',')

  const set = new Set(
    raw
      .split(',')
      .map((v) => sanitizeString(v))
      .filter(Boolean),
  )

  // Defaults
  set.add('https://app.solarinvest.app')
  set.add('http://localhost:5173')
  set.add('http://127.0.0.1:5173')

  return set
}

const TRUSTED_ORIGINS = buildTrustedOriginsSet()

function getRequestOrigin(req) {
  const origin = req.headers?.origin
  if (typeof origin === 'string' && origin.trim()) return origin.trim()

  const referer = req.headers?.referer
  if (typeof referer === 'string' && referer.trim()) {
    try {
      return new URL(referer).origin
    } catch {
      return ''
    }
  }

  return ''
}

let jwksClient
if (JWKS_URL) {
  jwksClient = jwksRsa({ jwksUri: JWKS_URL, cache: true, cacheMaxEntries: 5, cacheMaxAge: 600000 })
}

function getKey(header, callback) {
  if (!jwksClient) {
    callback(new Error('JWKS not configured'))
    return
  }
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err)
      return
    }
    const pub = key.getPublicKey()
    callback(null, pub)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).end('Method Not Allowed')
    return
  }

  try {
    // 0) Enforce trusted origins (browser requests)
    const requestOrigin = getRequestOrigin(req)
    if (requestOrigin && !TRUSTED_ORIGINS.has(requestOrigin)) {
      res.status(403).json({ error: 'Forbidden origin' })
      return
    }

    const { token } = req.body || {}
    if (!token) {
      res.status(400).json({ error: 'Missing token' })
      return
    }

    let payload = null
    if (jwksClient && AUDIENCE) {
      try {
        payload = await new Promise((resolve, reject) => {
          jwt.verify(token, getKey, { audience: AUDIENCE, algorithms: ['RS256'] }, (err, decoded) => {
            if (err) {
              reject(err)
              return
            }
            resolve(decoded)
          })
        })
      } catch (error) {
        console.warn('[login] JWKS verify failed, falling back to decode', error)
      }
    }

    if (!payload) {
      payload = jwt.decode(token) || {}
    }

    const secret = process.env.AUTH_COOKIE_SECRET
    if (!secret) {
      res.status(500).json({ error: 'Server not configured for cookie auth' })
      return
    }

    const id = payload.sub || payload.sub_id || payload.user_id || payload.email || null
    if (!id) {
      res.status(400).json({ error: 'Token missing subject/email' })
      return
    }

    // (Optional) You can use this later for bootstrap
    // Example: if ((payload.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()) { ... }
    void ADMIN_EMAIL

    const sessionToken = jwt.sign(payload, secret, { expiresIn: '7d' })

    const isSecure = process.env.NODE_ENV === 'production'
    res.setHeader(
      'Set-Cookie',
      `solarinvest_session=${sessionToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${
        isSecure ? '; Secure' : ''
      }`,
    )
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('/api/auth/login', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
