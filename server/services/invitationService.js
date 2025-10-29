import { randomBytes } from 'node:crypto'
import { getDb, saveDatabase, createId } from '../storage/database.js'
import { config } from '../config.js'
import { hashPassword as hashToken, verifyPassword as verifyToken } from '../security/password.js'
import { recordAuditEvent } from './audit.js'

function generateInviteToken() {
  return randomBytes(32).toString('hex')
}

export async function createInvitation({ email, role, invitedBy, actorIp, userAgent }) {
  const db = getDb()
  const token = generateInviteToken()
  const tokenHash = await hashToken(token)
  const now = new Date().toISOString()
  const invitation = {
    id: createId(),
    email: email.toLowerCase(),
    role,
    tokenHash,
    createdAt: now,
    expiresAt: new Date(Date.now() + config.inviteExpiresSeconds * 1000).toISOString(),
    usedAt: null,
    invitedBy,
  }
  db.invitations.push(invitation)
  saveDatabase()
  recordAuditEvent({
    userId: invitedBy,
    action: 'user.invited',
    actorIp,
    userAgent,
    payload: { email: invitation.email, role },
  })
  return { invitation, token }
}

export async function findInvitationByToken(token) {
  const db = getDb()
  if (!token) {
    return null
  }
  for (const invitation of db.invitations) {
    if (invitation.usedAt) {
      continue
    }
    if (await verifyToken(token, invitation.tokenHash)) {
      return invitation
    }
  }
  return null
}

export function markInvitationUsed(invitationId) {
  const db = getDb()
  const invitation = db.invitations.find((item) => item.id === invitationId)
  if (!invitation) return
  invitation.usedAt = new Date().toISOString()
  saveDatabase()
}

export function cleanupExpiredInvitations() {
  const db = getDb()
  const now = Date.now()
  db.invitations = db.invitations.filter((inv) => {
    if (inv.usedAt) return true
    const expires = new Date(inv.expiresAt).getTime()
    return Number.isNaN(expires) || expires > now
  })
  saveDatabase()
}
