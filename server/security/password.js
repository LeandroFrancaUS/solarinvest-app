import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SALT_LENGTH = 16
const KEY_LENGTH = 64
const MEMORY_COST_KB = 19456
function deriveKey(password, salt) {
  return scryptSync(password, salt, KEY_LENGTH, {
    N: 2 ** 16,
    r: 8,
    p: 1,
    maxmem: MEMORY_COST_KB * 1024,
  })
}

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Senha inválida')
  }
  const salt = randomBytes(SALT_LENGTH)
  const hash = deriveKey(password, salt)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(password, hashString) {
  if (!hashString || typeof hashString !== 'string') {
    return false
  }
  const [scheme, saltHex, hashHex] = hashString.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) {
    return false
  }
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  let derived
  try {
    derived = deriveKey(password, salt)
  } catch (error) {
    return false
  }
  if (derived.length !== expected.length) {
    return false
  }
  return timingSafeEqual(derived, expected)
}

export function validatePasswordStrength(password) {
  if (typeof password !== 'string') {
    return { valid: false, message: 'Senha inválida.' }
  }
  const trimmed = password.trim()
  if (trimmed.length < 10) {
    return { valid: false, message: 'A senha deve ter pelo menos 10 caracteres.' }
  }
  const hasLetter = /[a-zA-Z]/.test(trimmed)
  const hasNumber = /[0-9]/.test(trimmed)
  const hasSymbol = /[^a-zA-Z0-9]/.test(trimmed)
  if (!(hasLetter && hasNumber && hasSymbol)) {
    return {
      valid: false,
      message: 'Use letras, números e símbolos para garantir segurança.',
    }
  }
  const banned = ['password', '123456', 'qwerty', 'solarinvest', 'admin123']
  if (banned.includes(trimmed.toLowerCase())) {
    return { valid: false, message: 'Escolha uma senha menos óbvia.' }
  }
  return { valid: true }
}
