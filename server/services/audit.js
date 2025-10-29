import { getDb, saveDatabase, createId } from '../storage/database.js'

export function recordAuditEvent({ userId = null, action, actorIp, userAgent = '', payload = null }) {
  const db = getDb()
  db.auditLog.push({
    id: createId(),
    userId,
    action,
    actorIp,
    userAgent,
    payload,
    createdAt: new Date().toISOString(),
  })
  saveDatabase()
}

export function listAuditEvents(limit = 100) {
  const db = getDb()
  return db.auditLog.slice(-limit).reverse()
}
