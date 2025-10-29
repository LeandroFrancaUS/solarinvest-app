import { randomBytes } from 'node:crypto'
import { getDb, saveDatabase, createId } from '../storage/database.js'
import { config } from '../config.js'
import { hashPassword as hashToken, verifyPassword as verifyToken } from '../security/password.js'
import { recordAuditEvent } from './audit.js'

function generateResetToken() {
  return randomBytes(32).toString('hex')
}

export async function createPasswordReset({ userId, actorIp, userAgent }) {
  const db = getDb()
  const token = generateResetToken()
  const tokenHash = await hashToken(token)
  const now = new Date().toISOString()
  const reset = {
    id: createId(),
    userId,
    tokenHash,
    createdAt: now,
    expiresAt: new Date(Date.now() + config.resetTokenSeconds * 1000).toISOString(),
    usedAt: null,
  }
  db.passwordResets.push(reset)
  saveDatabase()
  recordAuditEvent({ userId, action: 'user.password.reset.requested', actorIp, userAgent })
  return { reset, token }
}

export async function findPasswordResetByToken(token) {
  const db = getDb()
  if (!token) {
    return null
  }
  for (const reset of db.passwordResets) {
    if (reset.usedAt) {
      continue
    }
    if (await verifyToken(token, reset.tokenHash)) {
      return reset
    }
  }
  return null
}

export function markPasswordResetUsed(resetId) {
  const db = getDb()
  const reset = db.passwordResets.find((item) => item.id === resetId)
  if (!reset) return
  reset.usedAt = new Date().toISOString()
  saveDatabase()
}

export function cleanupExpiredResets() {
  const db = getDb()
  const now = Date.now()
  db.passwordResets = db.passwordResets.filter((reset) => {
    if (reset.usedAt) return true
    const expires = new Date(reset.expiresAt).getTime()
    return Number.isNaN(expires) || expires > now
  })
  saveDatabase()
}
