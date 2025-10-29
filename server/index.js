import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { URL } from 'node:url'

import { handleAneelProxyRequest, DEFAULT_PROXY_BASE } from './aneelProxy.js'
import { CONTRACT_RENDER_PATH, handleContractRenderRequest } from './contracts.js'
import { config } from './config.js'
import { parseJsonBody } from './http/bodyParser.js'
import { sendJson, applySecurityHeaders } from './http/responses.js'
import { getAuthenticatedUser, issueSessionCookies, clearAuthCookies } from './http/auth.js'
import { buildRefreshTokenCookie, buildAccessTokenCookie, buildClearedCookie, parseCookies } from './http/cookies.js'
import {
  createSession,
  rotateSession,
  findSessionByRefreshToken,
  revokeSession,
  revokeAllSessions,
  listSessionsForUser,
  markSessionActivity,
} from './services/sessionService.js'
import {
  findUserByEmail,
  findUserById,
  verifyUserPassword,
  clearFailedLogin,
  incrementFailedLogin,
  getUserTotpSecret,
  listUsers,
  updateUser,
  ensureInitialAdmin,
  createUser,
  setUserPassword,
  disableUserTotp,
  setUserTotpSecret,
} from './services/userService.js'
import { recordAuditEvent } from './services/audit.js'
import {
  createInvitation,
  findInvitationByToken,
  markInvitationUsed,
  cleanupExpiredInvitations,
} from './services/invitationService.js'
import {
  createPasswordReset,
  findPasswordResetByToken,
  markPasswordResetUsed,
  cleanupExpiredResets,
} from './services/passwordResetService.js'
import { createMfaChallenge, consumeMfaChallenge, purgeExpiredChallenges } from './services/mfaChallengeService.js'
import { verifyTotp, generateTotpSecret, buildOtpauthUrl } from './security/totp.js'
import { rateLimit } from './security/rateLimiter.js'
import { createCsrfToken, buildCsrfCookie, requireCsrfProtection, extractCsrfToken } from './security/csrf.js'
import { hasExpired } from './utils/duration.js'
import { createJwt } from './security/jwt.js'

ensureInitialAdmin()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.resolve(__dirname, '../dist')
const distExists = existsSync(distDir)

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10)

function respond(res, status, payload) {
  sendJson(res, status, payload)
}

function respondUnauthorized(res, message = 'Autenticação obrigatória') {
  respond(res, 401, { error: message })
}

function respondForbidden(res, message = 'Permissão insuficiente') {
  respond(res, 403, { error: message })
}

function respondBadRequest(res, message = 'Requisição inválida') {
  respond(res, 400, { error: message })
}

function sanitizeEmail(email) {
  return email?.trim().toLowerCase()
}

async function serveStatic(pathname, res) {
  if (!distExists) {
    respond(res, 404, { error: 'Not found' })
    return
  }
  let target = pathname
  if (target === '/' || target === '') {
    target = '/index.html'
  }
  const resolved = path.resolve(distDir, `.${target}`)
  if (!resolved.startsWith(distDir) || !existsSync(resolved)) {
    const indexPath = path.join(distDir, 'index.html')
    const indexContent = await readFile(indexPath)
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(indexContent)
    return
  }
  const ext = path.extname(resolved)
  const content = await readFile(resolved)
  res.statusCode = 200
  res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream')
  res.end(content)
}

function validateCsrf(req, res) {
  if (!requireCsrfProtection(req)) {
    return true
  }
  const cookies = parseCookies(req.headers.cookie ?? '')
  const expected = cookies[config.csrfCookieName]
  const received = extractCsrfToken(req)
  if (!expected || !received || expected !== received) {
    respondForbidden(res, 'Token CSRF ausente ou inválido')
    return false
  }
  return true
}

async function handleLogin(req, res, ip) {
  if (rateLimit({ ip, route: 'login', limit: 5, windowMs: 5 * 60 * 1000 })) {
    respondForbidden(res, 'Limite de tentativas excedido. Aguarde antes de tentar novamente.')
    return
  }
  let body
  try {
    body = await parseJsonBody(req)
  } catch (error) {
    respondBadRequest(res, error.message)
    return
  }
  const email = sanitizeEmail(body.email)
  const password = body.password ?? ''
  const totpCode = body.totp
  const deviceId = body.deviceId

  if (!email || typeof password !== 'string') {
    respondBadRequest(res, 'Credenciais inválidas')
    return
  }
  const user = findUserByEmail(email)
  if (!user) {
    respondUnauthorized(res, 'Usuário ou senha inválidos')
    return
  }
  if (user.disabledAt) {
    respondForbidden(res, 'Conta desabilitada')
    return
  }
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    respondForbidden(res, 'Conta temporariamente bloqueada devido a tentativas falhas')
    return
  }
  if (!verifyUserPassword(user, password)) {
    incrementFailedLogin(user, { maxAttempts: 10, lockMinutes: 15 })
    recordAuditEvent({
      userId: user.id,
      action: 'auth.login.failure',
      actorIp: ip,
      userAgent: req.headers['user-agent'] ?? '',
      payload: { reason: 'invalid_password', email },
    })
    respondUnauthorized(res, 'Usuário ou senha inválidos')
    return
  }

  if (user.role === 'ADMIN' && !user.mfaEnabled) {
    respondForbidden(res, 'Ative o MFA (TOTP) antes de prosseguir.')
    return
  }

  const totpSecret = getUserTotpSecret(user)
  if (user.mfaEnabled) {
    if (!totpCode) {
      const challenge = createMfaChallenge({
        userId: user.id,
        method: 'totp',
        context: { deviceId },
      })
      respond(res, 200, {
        mfaRequired: true,
        challengeId: challenge.id,
        methods: ['totp'],
      })
      return
    }
    if (!totpSecret || !verifyTotp({ secret: totpSecret, token: totpCode })) {
      recordAuditEvent({
        userId: user.id,
        action: 'auth.mfa.verify.failure',
        actorIp: ip,
        userAgent: req.headers['user-agent'] ?? '',
        payload: { method: 'totp' },
      })
      respondUnauthorized(res, 'Código MFA inválido')
      return
    }
  }

  clearFailedLogin(user)

  const userAgent = req.headers['user-agent'] ?? ''
  const { session, refreshToken } = createSession({
    userId: user.id,
    userAgent,
    ip,
    deviceId,
  })
  markSessionActivity(session.id)
  issueSessionCookies({ res, user, session, refreshToken, actorIp: ip, userAgent })
  respond(res, 200, {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
    },
  })
}

async function handleMfaVerify(req, res, ip) {
  let body
  try {
    body = await parseJsonBody(req)
  } catch (error) {
    respondBadRequest(res, error.message)
    return
  }
  const { challengeId, code } = body
  if (!challengeId || typeof code !== 'string') {
    respondBadRequest(res, 'Dados inválidos')
    return
  }
  const challenge = consumeMfaChallenge(challengeId)
  if (!challenge) {
    respondBadRequest(res, 'Desafio MFA expirado ou inválido')
    return
  }
  const user = findUserById(challenge.userId)
  if (!user) {
    respondBadRequest(res, 'Usuário não encontrado')
    return
  }
  const secret = getUserTotpSecret(user)
  if (!secret || !verifyTotp({ secret, token: code })) {
    respondUnauthorized(res, 'Código MFA inválido')
    return
  }
  recordAuditEvent({
    userId: user.id,
    action: 'auth.mfa.verify.success',
    actorIp: ip,
    userAgent: req.headers['user-agent'] ?? '',
    payload: { method: 'totp' },
  })
  clearFailedLogin(user)
  const userAgent = req.headers['user-agent'] ?? ''
  const { session, refreshToken } = createSession({
    userId: user.id,
    userAgent,
    ip,
    deviceId: challenge.context?.deviceId,
  })
  markSessionActivity(session.id)
  issueSessionCookies({ res, user, session, refreshToken, actorIp: ip, userAgent })
  respond(res, 200, {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
    },
  })
}

async function handleRefresh(req, res, ip) {
  if (!validateCsrf(req, res)) {
    return
  }
  const cookies = parseCookies(req.headers.cookie ?? '')
  const token = cookies[config.refreshCookieName]
  if (!token) {
    respondUnauthorized(res)
    return
  }
  const session = findSessionByRefreshToken(token)
  if (!session) {
    respondUnauthorized(res)
    return
  }
  if (session.revokedAt || hasExpired(session.expiresAt)) {
    respondUnauthorized(res)
    return
  }
  const user = findUserById(session.userId)
  if (!user || user.disabledAt) {
    respondUnauthorized(res)
    return
  }
  const userAgent = req.headers['user-agent'] ?? ''
  const newRefreshToken = rotateSession(session, { ip, userAgent })
  markSessionActivity(session.id)
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
    buildRefreshTokenCookie(newRefreshToken),
    buildCsrfCookie(csrfToken),
  ])
  respond(res, 200, { ok: true })
}

async function handleLogout(req, res, actor) {
  if (!actor) {
    respondUnauthorized(res)
    return
  }
  if (!validateCsrf(req, res)) {
    return
  }
  revokeSession(actor.sessionId, { reason: 'revoked', actorIp: req.socket.remoteAddress ?? 'unknown', userAgent: req.headers['user-agent'] ?? '' })
  clearAuthCookies(res)
  respond(res, 200, { ok: true })
}

async function handleLogoutAll(req, res, actor) {
  if (!actor) {
    respondUnauthorized(res)
    return
  }
  if (!validateCsrf(req, res)) {
    return
  }
  revokeAllSessions(actor.user.id, { actorIp: req.socket.remoteAddress ?? 'unknown', userAgent: req.headers['user-agent'] ?? '' })
  clearAuthCookies(res)
  respond(res, 200, { ok: true })
}

async function handleMe(req, res, actor) {
  if (!actor) {
    respondUnauthorized(res)
    return
  }
  markSessionActivity(actor.sessionId)
  respond(res, 200, {
    user: {
      id: actor.user.id,
      email: actor.user.email,
      role: actor.user.role,
      mfaEnabled: actor.user.mfaEnabled,
    },
  })
}

async function handleInvite(req, res, actor, ip) {
  if (!actor || actor.user.role !== 'ADMIN') {
    respondForbidden(res)
    return
  }
  if (!validateCsrf(req, res)) {
    return
  }
  let body
  try {
    body = await parseJsonBody(req)
  } catch (error) {
    respondBadRequest(res, error.message)
    return
  }
  const email = sanitizeEmail(body.email)
  const role = body.role
  if (!email || !role) {
    respondBadRequest(res, 'Dados inválidos')
    return
  }
  const { token, invitation } = createInvitation({
    email,
    role,
    invitedBy: actor.user.id,
    actorIp: ip,
    userAgent: req.headers['user-agent'] ?? '',
  })
  respond(res, 201, {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    },
    token,
  })
}

async function handleAcceptInvite(req, res) {
  let body
  try {
    body = await parseJsonBody(req)
  } catch (error) {
    respondBadRequest(res, error.message)
    return
  }
  const { token, password } = body
  if (!token || typeof password !== 'string') {
    respondBadRequest(res, 'Dados inválidos')
    return
  }
  const invitation = findInvitationByToken(token)
  if (!invitation) {
    respondBadRequest(res, 'Convite inválido ou expirado')
    return
  }
  if (hasExpired(invitation.expiresAt)) {
    respondBadRequest(res, 'Convite expirado')
    return
  }
  let user = findUserByEmail(invitation.email)
  if (!user) {
    user = createUser({
      email: invitation.email,
      role: invitation.role,
      password,
      status: 'active',
      requireEmailVerification: false,
    })
  } else {
    setUserPassword(user.id, password)
    updateUser(user.id, { role: invitation.role, status: 'active' })
  }
  markInvitationUsed(invitation.id)
  recordAuditEvent({
    userId: user.id,
    action: 'user.invite.accepted',
    actorIp: 'unknown',
    userAgent: req.headers['user-agent'] ?? '',
  })
  respond(res, 200, { ok: true })
}

async function handlePasswordForgot(req, res) {
  let body
  try {
    body = await parseJsonBody(req)
  } catch (error) {
    respondBadRequest(res, error.message)
    return
  }
  const email = sanitizeEmail(body.email)
  if (!email) {
    respondBadRequest(res, 'Dados inválidos')
    return
  }
  const user = findUserByEmail(email)
  if (!user) {
    respond(res, 200, { ok: true })
    return
  }
  const { token } = createPasswordReset({
    userId: user.id,
    actorIp: req.socket.remoteAddress ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? '',
  })
  respond(res, 200, { token })
}

async function handlePasswordReset(req, res) {
  let body
  try {
    body = await parseJsonBody(req)
  } catch (error) {
    respondBadRequest(res, error.message)
    return
  }
  const { token, password } = body
  if (!token || typeof password !== 'string') {
    respondBadRequest(res, 'Dados inválidos')
    return
  }
  const reset = findPasswordResetByToken(token)
  if (!reset) {
    respondBadRequest(res, 'Token inválido ou expirado')
    return
  }
  if (hasExpired(reset.expiresAt)) {
    respondBadRequest(res, 'Token expirado')
    return
  }
  setUserPassword(reset.userId, password)
  markPasswordResetUsed(reset.id)
  revokeAllSessions(reset.userId, { actorIp: req.socket.remoteAddress ?? 'unknown', userAgent: req.headers['user-agent'] ?? '' })
  respond(res, 200, { ok: true })
}

async function handleMfaSetupTotp(req, res, actor) {
  if (!actor) {
    respondUnauthorized(res)
    return
  }
  if (!validateCsrf(req, res)) {
    return
  }
  const secret = generateTotpSecret()
  const otpauthUrl = buildOtpauthUrl({ label: actor.user.email, secret })
  const challenge = createMfaChallenge({
    userId: actor.user.id,
    method: 'setup_totp',
    context: { secret },
  })
  respond(res, 200, { secret, otpauthUrl, challengeId: challenge.id })
}

async function handleMfaSetupVerify(req, res, actor) {
  if (!actor) {
    respondUnauthorized(res)
    return
  }
  if (!validateCsrf(req, res)) {
    return
  }
  let body
  try {
    body = await parseJsonBody(req)
  } catch (error) {
    respondBadRequest(res, error.message)
    return
  }
  const { challengeId, code } = body
  if (!challengeId || typeof code !== 'string') {
    respondBadRequest(res, 'Dados inválidos')
    return
  }
  const challenge = consumeMfaChallenge(challengeId)
  if (!challenge || challenge.userId !== actor.user.id || challenge.method !== 'setup_totp') {
    respondBadRequest(res, 'Desafio inválido')
    return
  }
  const secret = challenge.context?.secret
  if (!secret || !verifyTotp({ secret, token: code })) {
    respondBadRequest(res, 'Código inválido')
    return
  }
  setUserTotpSecret(actor.user.id, secret)
  respond(res, 200, { ok: true })
}

async function handleMfaDisable(req, res, actor) {
  if (!actor) {
    respondUnauthorized(res)
    return
  }
  if (!validateCsrf(req, res)) {
    return
  }
  let body
  try {
    body = await parseJsonBody(req)
  } catch (error) {
    respondBadRequest(res, error.message)
    return
  }
  const { password, code } = body
  if (typeof password !== 'string' || typeof code !== 'string') {
    respondBadRequest(res, 'Dados inválidos')
    return
  }
  if (!verifyUserPassword(actor.user, password)) {
    respondUnauthorized(res, 'Senha inválida')
    return
  }
  const secret = getUserTotpSecret(actor.user)
  if (!secret || !verifyTotp({ secret, token: code })) {
    respondUnauthorized(res, 'Código MFA inválido')
    return
  }
  disableUserTotp(actor.user.id)
  respond(res, 200, { ok: true })
}

async function handleSessionsList(req, res, actor) {
  if (!actor) {
    respondUnauthorized(res)
    return
  }
  if (!validateCsrf(req, res)) {
    return
  }
  const sessions = listSessionsForUser(actor.user.id)
  respond(res, 200, { sessions })
}

async function handleSessionDelete(req, res, actor, sessionId) {
  if (!actor) {
    respondUnauthorized(res)
    return
  }
  if (!validateCsrf(req, res)) {
    return
  }
  const sessions = listSessionsForUser(actor.user.id)
  const target = sessions.find((session) => session.id === sessionId)
  if (!target) {
    respondBadRequest(res, 'Sessão não encontrada')
    return
  }
  revokeSession(sessionId, { actorIp: req.socket.remoteAddress ?? 'unknown', userAgent: req.headers['user-agent'] ?? '' })
  respond(res, 200, { ok: true })
}

async function handleAdminUsers(req, res, actor) {
  if (!actor || actor.user.role !== 'ADMIN') {
    respondForbidden(res)
    return
  }
  const users = listUsers()
  respond(res, 200, { users })
}

function requireJson(req, res) {
  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('application/json')) {
    respondBadRequest(res, 'Content-Type deve ser application/json')
    return false
  }
  return true
}

const server = createServer(async (req, res) => {
  applySecurityHeaders(res)
  res.setHeader('X-Powered-By', 'SolarInvest Security Gateway')

  if (!req.url) {
    respondBadRequest(res)
    return
  }

  const ip = req.socket.remoteAddress ?? 'unknown'
  const url = new URL(req.url, 'http://localhost')
  const pathname = url.pathname
  const method = req.method?.toUpperCase() ?? 'GET'
  const actor = getAuthenticatedUser(req)

  cleanupExpiredInvitations()
  cleanupExpiredResets()
  purgeExpiredChallenges()

  if (pathname === '/health') {
    respond(res, 200, { status: 'ok' })
    return
  }

  if (pathname === CONTRACT_RENDER_PATH) {
    await handleContractRenderRequest(req, res)
    return
  }

  if (pathname === DEFAULT_PROXY_BASE) {
    await handleAneelProxyRequest(req, res)
    return
  }

  if (pathname.startsWith('/auth/')) {
    if (pathname === '/auth/login' && method === 'POST') {
      if (!requireJson(req, res)) return
      await handleLogin(req, res, ip)
      return
    }
    if (pathname === '/auth/mfa/verify' && method === 'POST') {
      if (!requireJson(req, res)) return
      await handleMfaVerify(req, res, ip)
      return
    }
    if (pathname === '/auth/refresh' && method === 'POST') {
      await handleRefresh(req, res, ip)
      return
    }
    if (pathname === '/auth/logout' && method === 'POST') {
      await handleLogout(req, res, actor)
      return
    }
    if (pathname === '/auth/logout-all' && method === 'POST') {
      await handleLogoutAll(req, res, actor)
      return
    }
    if (pathname === '/auth/me' && method === 'GET') {
      await handleMe(req, res, actor)
      return
    }
    if (pathname === '/auth/invite' && method === 'POST') {
      if (!requireJson(req, res)) return
      await handleInvite(req, res, actor, ip)
      return
    }
    if (pathname === '/auth/accept-invite' && method === 'POST') {
      if (!requireJson(req, res)) return
      await handleAcceptInvite(req, res)
      return
    }
    if (pathname === '/auth/password/forgot' && method === 'POST') {
      if (!requireJson(req, res)) return
      await handlePasswordForgot(req, res)
      return
    }
    if (pathname === '/auth/password/reset' && method === 'POST') {
      if (!requireJson(req, res)) return
      await handlePasswordReset(req, res)
      return
    }
    if (pathname === '/auth/mfa/setup/totp' && method === 'POST') {
      await handleMfaSetupTotp(req, res, actor)
      return
    }
    if (pathname === '/auth/mfa/setup/totp/verify' && method === 'POST') {
      if (!requireJson(req, res)) return
      await handleMfaSetupVerify(req, res, actor)
      return
    }
    if (pathname === '/auth/mfa/disable' && method === 'POST') {
      if (!requireJson(req, res)) return
      await handleMfaDisable(req, res, actor)
      return
    }
    if (pathname === '/auth/sessions' && method === 'GET') {
      await handleSessionsList(req, res, actor)
      return
    }
    if (pathname.startsWith('/auth/sessions/') && method === 'DELETE') {
      const sessionId = pathname.split('/')[3]
      await handleSessionDelete(req, res, actor, sessionId)
      return
    }
    respond(res, 404, { error: 'Not found' })
    return
  }

  if (pathname.startsWith('/admin/users') && method === 'GET') {
    await handleAdminUsers(req, res, actor)
    return
  }

  if (method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  await serveStatic(pathname, res)
})

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
