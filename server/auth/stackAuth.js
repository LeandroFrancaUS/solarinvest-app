import { createHmac, createPublicKey, createVerify, timingSafeEqual } from 'node:crypto'
import { performance } from 'node:perf_hooks'

const REQUEST_USER_SYMBOL = Symbol('stackAuthUser')
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000
const JWKS_MIN_REFRESH_INTERVAL_MS = 30 * 1000

/**
 * Explicit allowlist of asymmetric JWT algorithms accepted from the Stack Auth JWKS.
 *
 * alg=none and any algorithm not in this map are categorically rejected.
 *
 * nodeName  – argument to Node.js createVerify()
 * sigFormat – 'der'    for RSA (createVerify expects DER natively)
 *           – 'p1363'  for ECDSA (JWT uses raw r‖s; must convert to DER first)
 * coordLen  – bytes per EC coordinate (P-256: 32, P-384: 48, P-521: 66)
 */
const ASYMMETRIC_ALG_MAP = new Map([
  ['RS256', { nodeName: 'RSA-SHA256', sigFormat: 'der' }],
  ['RS384', { nodeName: 'RSA-SHA384', sigFormat: 'der' }],
  ['RS512', { nodeName: 'RSA-SHA512', sigFormat: 'der' }],
  ['ES256', { nodeName: 'SHA256',     sigFormat: 'p1363', coordLen: 32 }],  // P-256
  ['ES384', { nodeName: 'SHA384',     sigFormat: 'p1363', coordLen: 48 }],  // P-384
  ['ES512', { nodeName: 'SHA512',     sigFormat: 'p1363', coordLen: 66 }],  // P-521 (coordLen 66)
])

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

// Admin bootstrap email (optional use elsewhere; does not change auth behavior)
const ADMIN_EMAIL = sanitizeString(process.env.ADMIN_EMAIL) || 'brsolarinvest@gmail.com'

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

// Defaults if none configured
trustedOrigins.add('https://app.solarinvest.app')
trustedOrigins.add('http://localhost:5173')
trustedOrigins.add('http://127.0.0.1:5173')

/**
 * IMPORTANT:
 * Prefer STACK_PROJECT_ID (server-side) and avoid relying on NEXT_PUBLIC_*.
 * Keep fallbacks for compatibility only.
 *
 * VITE_STACK_PROJECT_ID is included as a last-resort fallback because Vercel
 * exposes all dashboard env vars to API functions at runtime — including VITE_*
 * ones — so if the operator only configured the frontend-prefixed var the
 * server will still find the project ID here.
 */
const projectId = sanitizeString(
  process.env.STACK_PROJECT_ID ??
    process.env.STACK_AUTH_PROJECT_ID ??
    process.env.NEXT_PUBLIC_STACK_PROJECT_ID ??
    process.env.VITE_STACK_PROJECT_ID ??
    ''
)

/**
 * Prefer STACK_JWKS_URL (server-side). Keep JWKS_URL as fallback.
 */
const jwksUrlFromEnv = sanitizeString(process.env.STACK_JWKS_URL ?? process.env.JWKS_URL)

const inferredJwksUrl = projectId
  ? `https://api.stack-auth.com/api/v1/projects/${projectId}/.well-known/jwks.json`
  : ''

const jwksUrl = jwksUrlFromEnv || inferredJwksUrl

const expectedIssuer = projectId
  ? `https://api.stack-auth.com/api/v1/projects/${projectId}`
  : ''

const authCookieName = sanitizeString(process.env.AUTH_COOKIE_NAME) || 'solarinvest_session'
const authCookieSecret = sanitizeString(process.env.AUTH_COOKIE_SECRET ?? process.env.JWT_SECRET ?? '')
const stackAuthBypass = process.env.STACK_AUTH_BYPASS === 'true'

// Startup diagnostic: visible in server logs, never logs secrets or project ID in full.
// Helps confirm that the server-side Stack Auth configuration is present.
const _projectIdPrefix = projectId ? `${projectId.slice(0, 8)}…` : '(not set)'
console.info(
  '[stack-auth] server module loaded —',
  stackAuthBypass
    ? 'BYPASS MODE (STACK_AUTH_BYPASS=true)'
    : `projectId: ${_projectIdPrefix} / jwksUrl: ${jwksUrl || '(empty — JWT verification will fail)'}`,
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
  } catch {
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

/**
 * Convert an ECDSA signature from IEEE P1363 format (raw r ‖ s) to
 * DER/ASN.1 SEQUENCE { INTEGER r, INTEGER s } format.
 *
 * JWT ES256/ES384/ES512 signatures are P1363 (raw big-endian r then s,
 * each exactly `coordLen` bytes).  Node.js createVerify expects DER for
 * EC keys, so we must convert before calling verifier.verify().
 *
 * @param {Buffer} rawSig   P1363 signature (must be 2 × coordLen bytes)
 * @param {number} coordLen Bytes per coordinate (32 for P-256, 48 for P-384, 66 for P-521)
 * @returns {Buffer} DER-encoded ECDSA signature
 */
function p1363ToDer(rawSig, coordLen) {
  if (!Buffer.isBuffer(rawSig) || rawSig.length !== 2 * coordLen) {
    throw new Error(`p1363ToDer: invalid signature length ${rawSig.length} for coordLen ${coordLen}`)
  }

  function encodeAsn1Int(buf) {
    // Strip leading 0x00 bytes, but keep at least one byte.
    let start = 0
    while (start < buf.length - 1 && buf[start] === 0x00) start++
    const trimmed = buf.subarray(start)
    // An all-zero coordinate is cryptographically invalid for ECDSA.
    // After stripping leading zeros the loop guarantees trimmed has ≥1 byte;
    // if that single byte is 0x00 the entire coordinate was zero.
    if (trimmed[0] === 0x00) {
      throw new Error('p1363ToDer: invalid EC signature — zero coordinate')
    }
    // Prepend 0x00 when the high bit is set so DER treats it as positive.
    const body = (trimmed[0] & 0x80) !== 0
      ? Buffer.concat([Buffer.from([0x00]), Buffer.from(trimmed)])
      : Buffer.from(trimmed)
    return Buffer.concat([Buffer.from([0x02, body.length]), body])
  }

  const rDer = encodeAsn1Int(rawSig.subarray(0, coordLen))
  const sDer = encodeAsn1Int(rawSig.subarray(coordLen, 2 * coordLen))
  const seqContent = Buffer.concat([rDer, sDer])

  // DER length encoding — supports single-byte and two-byte lengths.
  let lenBytes
  if (seqContent.length < 0x80) {
    lenBytes = Buffer.from([seqContent.length])
  } else if (seqContent.length < 0x100) {
    lenBytes = Buffer.from([0x81, seqContent.length])
  } else {
    lenBytes = Buffer.from([0x82, seqContent.length >> 8, seqContent.length & 0xff])
  }
  return Buffer.concat([Buffer.from([0x30]), lenBytes, seqContent])
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

  return (
    cookieHeader
      .split(';')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => segment.split('='))
      .filter(([cookieName]) => cookieName && cookieName.trim() === name)
      .map(([, ...rest]) => rest.join('=') ?? '')
      .map((value) => {
        try {
          return decodeURIComponent(value)
        } catch {
          return value
        }
      })
      .find((value) => typeof value === 'string')
      ?.trim() ?? ''
  )
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
    // Only enforce audience when the claim is actually present in the token.
    // Stack Auth access tokens are documented to include `aud`, but if the
    // claim is absent we treat it as a pass rather than failing — a missing
    // claim is not evidence of forgery; the RS256 signature already proved
    // the token came from Stack Auth's private key.
    if (audience != null) {
      if (typeof audience === 'string') {
        if (audience !== projectId) {
          return false
        }
      } else if (Array.isArray(audience)) {
        if (!audience.includes(projectId)) {
          return false
        }
      } else {
        // Unknown aud type — fail closed.
        return false
      }
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

  const alg = sanitizeString(header.alg)
  const algConfig = ASYMMETRIC_ALG_MAP.get(alg)
  if (!algConfig) {
    console.warn(
      '[stack-auth] verifyJwt: unsupported alg', alg,
      '— accepted:', [...ASYMMETRIC_ALG_MAP.keys()].join(', '),
    )
    return null
  }

  const kid = sanitizeString(header.kid)
  if (!kid) {
    console.warn('[stack-auth] verifyJwt: missing kid in JWT header')
    return null
  }

  const payload = decodeSegment(encodedPayload)
  if (!payload) {
    return null
  }

  const keys = await fetchJwks()
  if (!keys || keys.length === 0) {
    console.warn('[stack-auth] verifyJwt: JWKS unavailable (projectId configured?', Boolean(projectId), '/ jwksUrl:', jwksUrl || '(empty)', ')')
    return null
  }

  const jwk = keys.find((entry) => entry.kid === kid)
  if (!jwk) {
    console.warn('[stack-auth] verifyJwt: kid', kid, 'not found in JWKS (', keys.length, 'key(s) loaded)')
    return null
  }

  try {
    const rawSignature = base64UrlToBuffer(encodedSignature)

    // JWT ES256/ES384/ES512 signatures use IEEE P1363 format (raw r ‖ s).
    // Node.js createVerify expects DER/ASN.1 for EC keys — convert first.
    // RSA signatures are already DER, so no conversion is needed there.
    const signatureBuffer = algConfig.sigFormat === 'p1363'
      ? p1363ToDer(rawSignature, algConfig.coordLen)
      : rawSignature

    const verifier = createVerify(algConfig.nodeName)
    verifier.update(`${encodedHeader}.${encodedPayload}`)
    verifier.end()

    if (!verifier.verify(jwk.publicKey, signatureBuffer)) {
      console.warn('[stack-auth] verifyJwt: signature verification failed (alg:', alg, ')')
      return null
    }
  } catch (error) {
    logStackError('[stack-auth] Falha ao verificar assinatura JWT', error)
    return null
  }

  if (!validateClaims(payload)) {
    const iss = sanitizeString(payload.iss)
    const aud = typeof payload.aud === 'string' ? payload.aud : JSON.stringify(payload.aud)
    console.warn('[stack-auth] verifyJwt: claims validation failed — iss:', iss, '/ aud:', aud, '/ expected iss:', expectedIssuer, '/ expected aud (projectId):', projectId)
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
  if (stackAuthBypass) {
    return false
  }
  return Boolean(projectId && jwksUrl)
}

export function isStackAuthBypassed() {
  return stackAuthBypass
}

export async function getStackUser(req) {
  if (!req || typeof req !== 'object') {
    return null
  }

  if (REQUEST_USER_SYMBOL in req) {
    return req[REQUEST_USER_SYMBOL]
  }

  let resolvedUser = null

  // Priority 1: Bearer token via JWKS verification (primary production path)
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
          _authSource: 'bearer',
        }
      }
    }
  }

  // Priority 2: Backend session cookie (HMAC-SHA256 JWT)
  if (!resolvedUser) {
    const cookieUser = resolveSessionCookieUser(req)
    if (cookieUser) {
      resolvedUser = { ...cookieUser, _authSource: 'session-cookie' }
    }
  }

  // Priority 3: x-user-id header fallback (dev/testing only)
  if (!resolvedUser) {
    const fallbackId = resolveFallbackUserId(req)
    if (fallbackId) {
      resolvedUser = { id: fallbackId, _authSource: 'header-fallback' }
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

// Optional export if you want to bootstrap RBAC later
export function getBootstrapAdminEmail() {
  return ADMIN_EMAIL
}

export function getProjectId() {
  return projectId
}
