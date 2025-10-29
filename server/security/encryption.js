import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { config } from '../config.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

export function encryptSecret(plainText) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, config.mfaEncryptionKey, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf-8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptSecret(cipherText) {
  const buffer = Buffer.from(cipherText, 'base64')
  const iv = buffer.subarray(0, IV_LENGTH)
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16)
  const payload = buffer.subarray(IV_LENGTH + 16)
  const decipher = createDecipheriv(ALGORITHM, config.mfaEncryptionKey, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()])
  return decrypted.toString('utf-8')
}
