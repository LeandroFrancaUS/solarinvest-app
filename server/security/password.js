import crypto from 'node:crypto'

const SALT_LENGTH = 16

const SCRYPT_N = parsePositiveNumber(process.env.AUTH_SCRYPT_N, 16384)
const SCRYPT_r = parsePositiveNumber(process.env.AUTH_SCRYPT_r, 8)
const SCRYPT_p = parsePositiveNumber(process.env.AUTH_SCRYPT_p, 1)
const SCRYPT_MAXMEM = parsePositiveNumber(process.env.AUTH_SCRYPT_MAXMEM, 128 * 1024 * 1024)
const KEYLEN = parsePositiveNumber(process.env.AUTH_SCRYPT_KEYLEN, 64)
const HASH_VERSION = String(process.env.AUTH_SCRYPT_VERSION ?? 'v2')

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function ensurePassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Senha inválida')
  }
}

function runScryptAsync(password, saltBuf) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      saltBuf,
      KEYLEN,
      {
        N: SCRYPT_N,
        r: SCRYPT_r,
        p: SCRYPT_p,
        maxmem: SCRYPT_MAXMEM,
      },
      (err, derivedKey) => {
        if (err) {
          reject(err)
          return
        }
        resolve(derivedKey)
      },
    )
  })
}

function runScryptSync(password, saltBuf) {
  return crypto.scryptSync(password, saltBuf, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    maxmem: SCRYPT_MAXMEM,
  })
}

export function deriveKeySync(password, saltBuf) {
  return runScryptSync(password, saltBuf)
}

export function deriveKey(password, saltBuf) {
  return runScryptAsync(password, saltBuf)
}

export async function hashPassword(password) {
  ensurePassword(password)
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = await deriveKey(password, salt)
  return `${HASH_VERSION}:${salt.toString('base64')}:${key.toString('base64')}`
}

export function hashPasswordSync(password) {
  ensurePassword(password)
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = deriveKeySync(password, salt)
  return `${HASH_VERSION}:${salt.toString('base64')}:${key.toString('base64')}`
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || stored.length === 0) {
    return false
  }
  try {
    const { salt, key } = parseStoredHash(stored)
    const derived = await deriveKey(password, salt)
    if (derived.length !== key.length) {
      return false
    }
    return crypto.timingSafeEqual(derived, key)
  } catch (error) {
    return false
  }
}

export function verifyPasswordSync(password, stored) {
  if (typeof stored !== 'string' || stored.length === 0) {
    return false
  }
  try {
    const { salt, key } = parseStoredHash(stored)
    const derived = deriveKeySync(password, salt)
    if (derived.length !== key.length) {
      return false
    }
    return crypto.timingSafeEqual(derived, key)
  } catch (error) {
    return false
  }
}

function parseStoredHash(stored) {
  const trimmed = stored.trim()
  if (trimmed.startsWith('scrypt$')) {
    const [, saltHex, hashHex] = trimmed.split('$')
    if (!saltHex || !hashHex) {
      throw new Error('Formato de hash inválido')
    }
    const salt = Buffer.from(saltHex, 'hex')
    const key = Buffer.from(hashHex, 'hex')
    if (salt.length === 0 || key.length === 0) {
      throw new Error('Formato de hash inválido')
    }
    return {
      version: 'legacy',
      salt,
      key,
    }
  }
  const parts = trimmed.split(':')
  if (parts.length === 3) {
    const [, saltB64, keyB64] = parts
    const salt = Buffer.from(saltB64, 'base64')
    const key = Buffer.from(keyB64, 'base64')
    if (salt.length === 0 || key.length === 0) {
      throw new Error('Formato de hash inválido')
    }
    return {
      version: parts[0],
      salt,
      key,
    }
  }
  if (parts.length === 2) {
    const [saltB64, keyB64] = parts
    const salt = Buffer.from(saltB64, 'base64')
    const key = Buffer.from(keyB64, 'base64')
    if (salt.length === 0 || key.length === 0) {
      throw new Error('Formato de hash inválido')
    }
    return {
      version: 'v1',
      salt,
      key,
    }
  }
  throw new Error('Formato de hash inválido')
}

export function getScryptParams() {
  return {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    maxmem: SCRYPT_MAXMEM,
    keylen: KEYLEN,
    version: HASH_VERSION,
  }
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
