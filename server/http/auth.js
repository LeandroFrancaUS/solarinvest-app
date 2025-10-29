import { config } from '../config.js'
import { parseCookies, buildAccessTokenCookie, buildRefreshTokenCookie, buildClearedCookie } from './cookies.js'
import { verifyJwt, createJwt } from '../security/jwt.js'
import { createSession, rotateSession, findSessionByRefreshToken, revokeSession } from '../services/sessionService.js'
import { findUserById, getUserTotpSecret } from '../services/userService.js'
import { createCsrfToken, buildCsrfCookie } from '../security/csrf.js'
import { recordAuditEvent } from '../services/audit.js'

export function getRequestCookies(req) {
  return parseCookies(req.headers.cookie ?? '')
}

export function getAuthenticatedUser(req) {
  const cookies = getRequestCookies(req)
  const token = cookies[config.accessCookieName]
  if (!token) return null
  try {
    const payload = verifyJwt(token)
    const user = findUserById(payload.sub)
    if (!user) return null
    return { user, sessionId: payload.sid }
  } catch (error) {
    return null
  }
}

export function issueSessionCookies({ res, user, session, refreshToken, actorIp, userAgent }) {
  const accessToken = createJwt(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: session.id,
      mfa: user.mfaEnabled,
    },
    { expiresInSeconds: config.accessTokenSeconds },
  )
  const csrfToken = createCsrfToken()
  res.setHeader('Set-Cookie', [
    buildAccessTokenCookie(accessToken),
    buildRefreshTokenCookie(refreshToken),
    buildCsrfCookie(csrfToken),
  ])
  recordAuditEvent({ userId: user.id, action: 'auth.login.success', actorIp, userAgent })
  return { accessToken, csrfToken }
}

export function clearAuthCookies(res) {
  res.setHeader('Set-Cookie', [
    buildClearedCookie(config.accessCookieName),
    buildClearedCookie(config.refreshCookieName),
    buildCsrfCookie('', { maxAgeSeconds: 0 }),
  ])
}

export function requireRole(user, allowedRoles) {
  if (!user) return false
  return allowedRoles.includes(user.role)
}
