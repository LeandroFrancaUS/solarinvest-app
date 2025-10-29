import { randomBytes } from 'node:crypto'
import { parseDuration } from './utils/duration.js'

const DEFAULT_ACCESS_SECONDS = parseDuration(process.env.AUTH_ACCESS_TTL, 600)
const DEFAULT_REFRESH_SECONDS = parseDuration(process.env.AUTH_REFRESH_TTL, 30 * 24 * 60 * 60)

function parseBool(value, fallback) {
  if (value == null) return fallback
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

const sameSiteValue = (() => {
  const raw = process.env.COOKIE_SAMESITE?.trim().toLowerCase()
  if (!raw) return 'lax'
  if (['lax', 'strict', 'none'].includes(raw)) return raw
  return 'lax'
})()

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  accessTokenSeconds: DEFAULT_ACCESS_SECONDS,
  refreshTokenSeconds: DEFAULT_REFRESH_SECONDS,
  inviteExpiresSeconds: 48 * 60 * 60,
  resetTokenSeconds: 15 * 60,
  csrfCookieName: 'solarinvest_csrf',
  accessCookieName: 'solarinvest_access',
  refreshCookieName: 'solarinvest_refresh',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieSecure: parseBool(process.env.COOKIE_SECURE, true),
  cookieSameSite: sameSiteValue,
  appOrigin: process.env.APP_ORIGIN || undefined,
  apiOrigin: process.env.API_ORIGIN || undefined,
  jwtPrivateKey: process.env.AUTH_JWT_PRIVATE_KEY_BASE64
    ? Buffer.from(process.env.AUTH_JWT_PRIVATE_KEY_BASE64, 'base64').toString('utf-8')
    : null,
  jwtPublicKey: process.env.AUTH_JWT_PUBLIC_KEY_BASE64
    ? Buffer.from(process.env.AUTH_JWT_PUBLIC_KEY_BASE64, 'base64').toString('utf-8')
    : null,
  mfaEncryptionKey: process.env.AUTH_MFA_ENCRYPTION_KEY_BASE64
    ? Buffer.from(process.env.AUTH_MFA_ENCRYPTION_KEY_BASE64, 'base64')
    : randomBytes(32),
}

export function isDevelopment() {
  return config.nodeEnv !== 'production'
}

if (!process.env.AUTH_MFA_ENCRYPTION_KEY_BASE64 && isDevelopment()) {
  console.warn(
    'Chave de criptografia MFA gerada automaticamente para desenvolvimento. Defina AUTH_MFA_ENCRYPTION_KEY_BASE64 para persistir segredos com segurança.',
  )
}
