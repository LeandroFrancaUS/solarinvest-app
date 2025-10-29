import { randomBytes } from 'node:crypto'
import { getDb, saveDatabase, createId } from '../storage/database.js'
import { config } from '../config.js'
import { hashPassword as hashValue, verifyPassword as verifyValue } from '../security/password.js'
import { recordAuditEvent } from './audit.js'

export async function createSession({ userId, userAgent, ip, deviceId }) {
  const db = getDb()
  const sessionId = createId()
  const secret = randomBytes(48).toString('base64url')
  const refreshToken = `${sessionId}.${secret}`
  const now = new Date().toISOString()
  const refreshHash = await hashValue(secret)
  const session = {
    id: sessionId,
    userId,
    deviceId: deviceId || createId(),
    refreshHash,
    userAgent: userAgent?.slice(0, 500) ?? '',
    ip: ip?.slice(0, 100) ?? '',
    createdAt: now,
    lastSeenAt: now,
    revokedAt: null,
    expiresAt: new Date(Date.now() + config.refreshTokenSeconds * 1000).toISOString(),
    rotationCounter: 0,
  }
  db.sessions.push(session)
  saveDatabase()
  recordAuditEvent({ userId, action: 'auth.session.created', actorIp: ip ?? 'unknown', userAgent })
  return { session, refreshToken }
}

export async function rotateSession(session, { ip, userAgent }) {
  const db = getDb()
  const target = db.sessions.find((item) => item.id === session.id)
  if (!target || target.revokedAt) {
    throw new Error('Sessão inválida')
  }
  const secret = randomBytes(48).toString('base64url')
  const refreshToken = `${session.id}.${secret}`
  target.refreshHash = await hashValue(secret)
  target.rotationCounter += 1
  target.lastSeenAt = new Date().toISOString()
  target.expiresAt = new Date(Date.now() + config.refreshTokenSeconds * 1000).toISOString()
  saveDatabase()
  recordAuditEvent({ userId: target.userId, action: 'auth.refresh.rotate', actorIp: ip ?? 'unknown', userAgent })
  return refreshToken
}

export function revokeSession(sessionId, { reason = 'revoked', actorIp = 'unknown', userAgent = '' } = {}) {
  const db = getDb()
  const target = db.sessions.find((item) => item.id === sessionId)
  if (!target) return
  if (!target.revokedAt) {
    target.revokedAt = new Date().toISOString()
    saveDatabase()
    recordAuditEvent({
      userId: target.userId,
      action: `auth.session.${reason}`,
      actorIp,
      userAgent,
      payload: { sessionId },
    })
  }
}

export function revokeAllSessions(userId, { actorIp = 'unknown', userAgent = '' } = {}) {
  const db = getDb()
  const now = new Date().toISOString()
  for (const session of db.sessions) {
    if (session.userId === userId && !session.revokedAt) {
      session.revokedAt = now
    }
  }
  saveDatabase()
  recordAuditEvent({ userId, action: 'auth.session.revoked_all', actorIp, userAgent })
}

export function findSessionById(sessionId) {
  const db = getDb()
  return db.sessions.find((session) => session.id === sessionId) || null
}

export async function findSessionByRefreshToken(token) {
  const db = getDb()
  if (!token || typeof token !== 'string') {
    return null
  }
  const parts = token.split('.')
  if (parts.length !== 2) {
    return null
  }
  const [sessionId, secret] = parts
  const session = db.sessions.find((item) => item.id === sessionId)
  if (!session || session.revokedAt) {
    return null
  }
  if (await verifyValue(secret, session.refreshHash)) {
    return session
  }
  return null
}

export function listSessionsForUser(userId) {
  const db = getDb()
  return db.sessions
    .filter((session) => session.userId === userId)
    .map((session) => ({ ...session, refreshHash: undefined }))
}

export function markSessionActivity(sessionId) {
  const db = getDb()
  const session = db.sessions.find((item) => item.id === sessionId)
  if (!session) return
  session.lastSeenAt = new Date().toISOString()
  saveDatabase()
}
