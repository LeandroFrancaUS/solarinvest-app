import { config } from '../config.js'

function buildCookie(name, value, { httpOnly = true, maxAgeSeconds } = {}) {
  const safeValue = encodeURIComponent(value)
  const attributes = [`${name}=${safeValue}`]
  attributes.push('Path=/')
  if (typeof maxAgeSeconds === 'number') {
    attributes.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`)
  }
  attributes.push(`SameSite=${config.cookieSameSite[0].toUpperCase()}${config.cookieSameSite.slice(1)}`)
  if (config.cookieSecure) {
    attributes.push('Secure')
  }
  if (config.cookieDomain) {
    attributes.push(`Domain=${config.cookieDomain}`)
  }
  if (httpOnly) {
    attributes.push('HttpOnly')
  }
  return attributes.join('; ')
}

export function buildAccessTokenCookie(token) {
  return buildCookie(config.accessCookieName, token, {
    httpOnly: true,
    maxAgeSeconds: config.accessTokenSeconds,
  })
}

export function buildRefreshTokenCookie(token) {
  return buildCookie(config.refreshCookieName, token, {
    httpOnly: true,
    maxAgeSeconds: config.refreshTokenSeconds,
  })
}

export function buildClearedCookie(name) {
  return buildCookie(name, '', { httpOnly: true, maxAgeSeconds: 0 })
}

export function parseCookies(header = '') {
  const cookies = {}
  header.split(';').forEach((part) => {
    const [name, ...rest] = part.trim().split('=')
    if (!name) return
    const value = rest.join('=').trim()
    try {
      cookies[name] = decodeURIComponent(value)
    } catch (error) {
      cookies[name] = value
    }
  })
  return cookies
}
