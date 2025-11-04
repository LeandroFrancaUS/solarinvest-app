import { createHmac, createPublicKey, createVerify, timingSafeEqual } from 'node:crypto'
import { performance } from 'node:perf_hooks'

const REQUEST_USER_SYMBOL = Symbol('stackAuthUser')
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000
const JWKS_MIN_REFRESH_INTERVAL_MS = 30 * 1000

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

const rawTrustedOrigins = [
  process.env.TRUSTED_WEB_ORIGINS,
  process.env.STACK_TRUSTED_DOMAIN,
  process.env.TRUSTED_DOMAIN,
  process.env.CORS_ALLOWED_ORIGINS,
  process.env.ALLOWED_ORIGINS,
]
  .map((value) => sanitizeString(value))
  .filter(Boolean)
  .join(',')

const trustedOrigins = new Set(
  rawTrustedOrigins
    .split(',')
    .map((origin) => sanitizeString(origin))
    .filter(Boolean)
)

if (trustedOrigins.size === 0) {
  trustedOrigins.add('http://localhost:5173')
  trustedOrigins.add('http://127.0.0.1:5173')
}

const projectId = sanitizeString(
  process.env.STACK_AUTH_PROJECT_ID ??
    process.env.NEXT_PUBLIC_STACK_PROJECT_ID ??
    process.env.STACK_PROJECT_ID ??
    ''
)

const jwksUrlFromEnv = sanitizeString(process.env.JWKS_URL ?? process.env.STACK_JWKS_URL)

const inferredJwksUrl = projectId
  ? `https://api.stack-auth.com/api/v1/projects/${projectId}/.well-known/jwks.json`
  : ''

const jwksUrl = jwksUrlFromEnv || inferredJwksUrl

const expectedIssuer = projectId
  ? `https://api.stack-auth.com/api/v1/projects/${projectId}`
  : ''

const authCookieName = sanitizeString(process.env.AUTH_COOKIE_NAME) || 'solarinvest_session'
const authCookieSecret = sanitizeString(
  process.env.AUTH_COOKIE_SECRET ?? process.env.JWT_SECRET ?? ''
)

let lastJwksFetch = 0
let jwksCache = null
let lastFetchAttempt = 0
let lastLoggedError = 0

async function fetchJwks() {
  if (!jwksUrl) {
    return null
  }

  const now = performance.now()
  if (jwksCache && now - lastJwksFetch < JWKS_CACHE_TTL_MS) {
    return jwksCache
  }

  if (now - lastFetchAttempt < JWKS_MIN_REFRESH_INTERVAL_MS && jwksCache) {
    return jwksCache
  }

  lastFetchAttempt = now

  try {
    const response = await fetch(jwksUrl)
    if (!response.ok) {
      throw new Error(`JWKS fetch returned status ${response.status}`)
    }
    const payload = await response.json()
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.keys)) {
      throw new Error('JWKS payload malformado')
    }
    const keys = payload.keys
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => ({
        kid: sanitizeString(entry.kid),
        alg: sanitizeString(entry.alg),
        kty: sanitizeString(entry.kty),
        use: sanitizeString(entry.use),
        n: entry.n,
        e: entry.e,
        crv: entry.crv,
        x: entry.x,
        y: entry.y,
      }))
      .filter((entry) => Boolean(entry.kid))

    jwksCache = keys
      .map((entry) => {
        try {
          const publicKey = createPublicKey({ key: entry, format: 'jwk' })
          return { ...entry, publicKey }
        } catch (error) {
          logStackError('[stack-auth] Falha ao processar chave JWK', error)
          return null
        }
      })
      .filter(Boolean)

    lastJwksFetch = performance.now()
    return jwksCache
  } catch (error) {
    logStackError('[stack-auth] Erro ao buscar JWKS', error)
    return jwksCache
  }
}

function normalizeBase64Segment(segment) {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
  const paddingLength = (4 - (normalized.length % 4 || 4)) % 4
  return normalized + '='.repeat(paddingLength)
}

function base64UrlToBuffer(segment) {
  return Buffer.from(normalizeBase64Segment(segment), 'base64')
}

function decodeSegment(segment) {
  try {
    const json = Buffer.from(normalizeBase64Segment(segment), 'base64').toString('utf8')
    return JSON.parse(json)
  } catch (error) {
    return null
  }
}

function logStackError(message, error) {
  const now = Date.now()
  if (now - lastLoggedError < 30_000) {
    return
  }
  lastLoggedError = now
  console.warn(message, error)
}

function verifyHmacJwt(token, secret) {
  if (!token || !secret) {
    return null
  }

  const segments = token.split('.')
  if (segments.length !== 3) {
    return null
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments
  const header = decodeSegment(encodedHeader)
  if (!header || typeof header !== 'object') {
    return null
  }

  const algorithm = sanitizeString(header.alg)
  const supportedAlgorithms = new Map([
    ['HS256', 'sha256'],
    ['HS384', 'sha384'],
    ['HS512', 'sha512'],
  ])

  const hmacAlgorithm = supportedAlgorithms.get(algorithm)
  if (!hmacAlgorithm) {
    return null
  }

  const payload = decodeSegment(encodedPayload)
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const hmac = createHmac(hmacAlgorithm, secret)
  hmac.update(`${encodedHeader}.${encodedPayload}`)
  const expectedSignature = hmac.digest()
  const signatureBuffer = base64UrlToBuffer(encodedSignature)

  if (expectedSignature.length !== signatureBuffer.length) {
    return null
  }

  if (!timingSafeEqual(expectedSignature, signatureBuffer)) {
    return null
  }

  const expiration = typeof payload.exp === 'number' ? payload.exp * 1000 : NaN
  if (Number.isFinite(expiration) && Date.now() > expiration) {
    return null
  }

  const notBefore = typeof payload.nbf === 'number' ? payload.nbf * 1000 : NaN
  if (Number.isFinite(notBefore) && Date.now() + 500 < notBefore) {
    return null
  }

  return payload
}

function extractCookieValue(cookieHeader, name) {
  if (!cookieHeader || !name) {
    return ''
  }

  return cookieHeader
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.split('='))
    .filter(([cookieName]) => cookieName && cookieName.trim() === name)
    .map(([, ...rest]) => rest.join('=') ?? '')
    .map((value) => {
      try {
        return decodeURIComponent(value)
      } catch (error) {
        return value
      }
    })
    .find((value) => typeof value === 'string')
    ?.trim() ?? ''
}

function resolveSessionCookieUser(req) {
  if (!authCookieSecret || !authCookieName) {
    return null
  }

  const cookieHeader = typeof req.headers?.cookie === 'string' ? req.headers.cookie : ''
  const token = extractCookieValue(cookieHeader, authCookieName)
  if (!token) {
    return null
  }

  const payload = verifyHmacJwt(token, authCookieSecret)
  if (!payload) {
    return null
  }

  const userId = sanitizeString(payload?.sub ?? payload?.user_id ?? payload?.email ?? '')
  if (!userId) {
    return null
  }

  return {
    id: userId,
    email: sanitizeString(payload?.email ?? ''),
    payload,
  }
}

function extractBearerToken(req) {
  const header = req.headers?.authorization
  if (typeof header !== 'string') {
    return ''
  }
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

function validateClaims(payload) {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  if (expectedIssuer && sanitizeString(payload.iss) !== expectedIssuer) {
    return false
  }

  if (projectId) {
    const audience = payload.aud
    if (typeof audience === 'string') {
      if (audience !== projectId) {
        return false
      }
    } else if (Array.isArray(audience)) {
      if (!audience.includes(projectId)) {
        return false
      }
    } else {
      return false
    }
  }

  const expiration = typeof payload.exp === 'number' ? payload.exp * 1000 : NaN
  if (Number.isFinite(expiration) && Date.now() > expiration) {
    return false
  }

  const notBefore = typeof payload.nbf === 'number' ? payload.nbf * 1000 : NaN
  if (Number.isFinite(notBefore) && Date.now() + 500 < notBefore) {
    return false
  }

  return true
}

async function verifyJwt(token) {
  if (!token) {
    return null
  }

  const segments = token.split('.')
  if (segments.length !== 3) {
    return null
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments
  const header = decodeSegment(encodedHeader)
  if (!header || typeof header !== 'object') {
    return null
  }

  if (sanitizeString(header.alg) !== 'RS256') {
    return null
  }

  const kid = sanitizeString(header.kid)
  if (!kid) {
    return null
  }

  const payload = decodeSegment(encodedPayload)
  if (!payload) {
    return null
  }

  const keys = await fetchJwks()
  if (!keys || keys.length === 0) {
    return null
  }

  const jwk = keys.find((entry) => entry.kid === kid)
  if (!jwk) {
    return null
  }

  try {
    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${encodedHeader}.${encodedPayload}`)
    verifier.end()
    const signatureBuffer = base64UrlToBuffer(encodedSignature)

    if (!verifier.verify(jwk.publicKey, signatureBuffer)) {
      return null
    }
  } catch (error) {
    logStackError('[stack-auth] Falha ao verificar assinatura JWT', error)
    return null
  }

  if (!validateClaims(payload)) {
    return null
  }

  return payload
}

function resolveFallbackUserId(req) {
  const headerId = req.headers?.['x-user-id'] ?? req.headers?.['x-userid']
  return sanitizeString(Array.isArray(headerId) ? headerId[0] : headerId)
}

export function getTrustedOrigins() {
  return new Set(trustedOrigins)
}

export function isStackAuthEnabled() {
  return Boolean(projectId && jwksUrl)
}

export async function getStackUser(req) {
  if (!req || typeof req !== 'object') {
    return null
  }

  if (REQUEST_USER_SYMBOL in req) {
    return req[REQUEST_USER_SYMBOL]
  }

  let resolvedUser = null

  const token = extractBearerToken(req)
  if (token) {
    const payload = await verifyJwt(token)
    if (payload) {
      const userId = sanitizeString(payload.sub ?? payload.user_id ?? '')
      if (userId) {
        resolvedUser = {
          id: userId,
          email: sanitizeString(payload.email ?? ''),
          payload,
        }
      }
    }
  }

  if (!resolvedUser) {
    const cookieUser = resolveSessionCookieUser(req)
    if (cookieUser) {
      resolvedUser = cookieUser
    }
  }

  if (!resolvedUser) {
    const fallbackId = resolveFallbackUserId(req)
    if (fallbackId) {
      resolvedUser = { id: fallbackId }
    }
  }

  req[REQUEST_USER_SYMBOL] = resolvedUser
  return resolvedUser
}

export function sanitizeStackUserId(user) {
  if (!user) {
    return ''
  }
  if (typeof user === 'string') {
    return sanitizeString(user)
  }
  return sanitizeString(user.id)
}
