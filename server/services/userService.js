import { getDb, saveDatabase, createId } from '../storage/database.js'
import { hashPassword, verifyPassword, validatePasswordStrength } from '../security/password.js'
import { encryptSecret, decryptSecret } from '../security/encryption.js'
import { recordAuditEvent } from './audit.js'

const USER_ROLES = ['ADMIN', 'DIRETOR', 'INTEGRADOR']

export function isValidRole(role) {
  return USER_ROLES.includes(role)
}

export function listUsers() {
  const db = getDb()
  return db.users.map((user) => ({
    ...user,
    passwordHash: undefined,
    mfaTotpSecret: undefined,
  }))
}

export function findUserByEmail(email) {
  const db = getDb()
  return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null
}

export function findUserById(id) {
  const db = getDb()
  return db.users.find((user) => user.id === id) || null
}

export async function createUser({
  email,
  role,
  password,
  mfaSecret,
  status = 'active',
  requireEmailVerification = true,
}) {
  const db = getDb()
  const now = new Date().toISOString()
  const normalizedEmail = email.toLowerCase()
  if (db.users.some((user) => user.email === normalizedEmail)) {
    throw new Error('Usuário já existe')
  }
  const passwordStrength = validatePasswordStrength(password)
  if (!passwordStrength.valid) {
    throw new Error(passwordStrength.message)
  }
  const passwordHash = await hashPassword(password)
  const user = {
    id: createId(),
    email: normalizedEmail,
    role,
    passwordHash,
    mfaEnabled: Boolean(mfaSecret),
    mfaTotpSecret: mfaSecret ? encryptSecret(mfaSecret) : null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    disabledAt: status === 'disabled' ? now : null,
    emailVerifiedAt: requireEmailVerification ? null : now,
    status,
    failedLoginAttempts: 0,
    lockedUntil: null,
  }
  db.users.push(user)
  saveDatabase()
  return { ...user, passwordHash: undefined, mfaTotpSecret: undefined }
}

export function updateUser(userId, updates) {
  const db = getDb()
  const user = db.users.find((item) => item.id === userId)
  if (!user) throw new Error('Usuário não encontrado')
  Object.assign(user, updates, { updatedAt: new Date().toISOString() })
  saveDatabase()
  return { ...user, passwordHash: undefined, mfaTotpSecret: undefined }
}

export async function setUserPassword(userId, password) {
  const db = getDb()
  const user = db.users.find((item) => item.id === userId)
  if (!user) throw new Error('Usuário não encontrado')
  const strength = validatePasswordStrength(password)
  if (!strength.valid) {
    throw new Error(strength.message)
  }
  user.passwordHash = await hashPassword(password)
  user.updatedAt = new Date().toISOString()
  user.failedLoginAttempts = 0
  user.lockedUntil = null
  saveDatabase()
  recordAuditEvent({ userId, action: 'user.password.updated', actorIp: 'system', userAgent: 'system' })
}

export async function verifyUserPassword(user, password) {
  if (!user.passwordHash) return false
  return verifyPassword(password, user.passwordHash)
}

export function getUserTotpSecret(user) {
  if (!user.mfaTotpSecret) return null
  try {
    return decryptSecret(user.mfaTotpSecret)
  } catch (error) {
    return null
  }
}

export function setUserTotpSecret(userId, secret) {
  const db = getDb()
  const user = db.users.find((item) => item.id === userId)
  if (!user) throw new Error('Usuário não encontrado')
  user.mfaTotpSecret = encryptSecret(secret)
  user.mfaEnabled = true
  user.updatedAt = new Date().toISOString()
  saveDatabase()
}

export function disableUserTotp(userId) {
  const db = getDb()
  const user = db.users.find((item) => item.id === userId)
  if (!user) throw new Error('Usuário não encontrado')
  user.mfaTotpSecret = null
  user.mfaEnabled = false
  user.updatedAt = new Date().toISOString()
  saveDatabase()
}

export function incrementFailedLogin(user, { maxAttempts = 10, lockMinutes = 15 }) {
  const db = getDb()
  const target = db.users.find((item) => item.id === user.id)
  if (!target) return
  target.failedLoginAttempts += 1
  if (target.failedLoginAttempts >= maxAttempts) {
    const lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000)
    target.lockedUntil = lockUntil.toISOString()
    recordAuditEvent({
      userId: target.id,
      action: 'security.account.locked',
      actorIp: 'system',
      userAgent: 'system',
      payload: { attempts: target.failedLoginAttempts },
    })
  }
  saveDatabase()
}

export function clearFailedLogin(user) {
  const db = getDb()
  const target = db.users.find((item) => item.id === user.id)
  if (!target) return
  target.failedLoginAttempts = 0
  target.lockedUntil = null
  target.updatedAt = new Date().toISOString()
  saveDatabase()
}

export async function ensureInitialAdmin() {
  const db = getDb()
  if (db.users.some((user) => user.role === 'ADMIN')) {
    return
  }
  const password = 'Fotovolt@iaco25'
  const admin = await createUser({
    email: 'brsolarinvest@gmail.com',
    role: 'ADMIN',
    password,
    status: 'active',
    requireEmailVerification: false,
  })
  console.log('Administrador inicial criado:', admin.email, 'senha temporária:', password)
}
