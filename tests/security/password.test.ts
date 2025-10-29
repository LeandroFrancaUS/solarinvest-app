import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import {
  hashPassword,
  verifyPassword,
  getScryptParams,
  deriveKey,
} from '../../server/security/password.js'

describe('scrypt password hashing', () => {
  it('hashes and verifies with defaults', async () => {
    const hash = await hashPassword('secret123')
    expect(await verifyPassword('secret123', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('accepts legacy hashes (scrypt$ salt hex)', async () => {
    const salt = crypto.randomBytes(16)
    const key = await deriveKey('legacy', salt)
    const legacyHash = `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
    expect(await verifyPassword('legacy', legacyHash)).toBe(true)
    expect(await verifyPassword('wrong', legacyHash)).toBe(false)
  })

  it('exposes effective params', () => {
    const params = getScryptParams()
    expect(params.N).toBeGreaterThan(0)
    expect(params.keylen).toBe(64)
    expect(params.maxmem).toBeGreaterThanOrEqual(128 * 1024 * 1024)
  })
})
