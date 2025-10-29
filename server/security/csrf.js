import { randomBytes } from 'node:crypto'
import { config } from '../config.js'

export function createCsrfToken() {
  return randomBytes(24).toString('hex')
}

export function extractCsrfToken(req) {
  return req.headers['x-csrf-token'] || req.headers['x-xsrf-token'] || ''
}

export function requireCsrfProtection(req) {
  const method = req.method?.toUpperCase()
  if (!method) return false
  return !['GET', 'HEAD', 'OPTIONS'].includes(method)
}

export function buildCsrfCookie(token, { maxAgeSeconds = 86400 } = {}) {
  const attributes = [
    `${config.csrfCookieName}=${token}`,
    'Path=/',
    `SameSite=${config.cookieSameSite[0].toUpperCase()}${config.cookieSameSite.slice(1)}`,
  ]
  if (config.cookieDomain) {
    attributes.push(`Domain=${config.cookieDomain}`)
  }
  if (config.cookieSecure) {
    attributes.push('Secure')
  }
  if (typeof maxAgeSeconds === 'number') {
    attributes.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`)
  }
  return attributes.join('; ')
}
