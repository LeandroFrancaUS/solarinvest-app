import { createHmac, randomBytes } from 'node:crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer) {
  let bits = 0
  let value = 0
  let output = ''
  for (let i = 0; i < buffer.length; i += 1) {
    value = (value << 8) | buffer[i]
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

function base32Decode(input) {
  const sanitized = input.replace(/=+$/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const output = []
  for (let i = 0; i < sanitized.length; i += 1) {
    const index = BASE32_ALPHABET.indexOf(sanitized[i])
    if (index === -1) {
      throw new Error('Invalid base32 input')
    }
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(output)
}

export function generateTotpSecret(length = 20) {
  const random = randomBytes(length)
  return base32Encode(random)
}

export function totp({ secret, step = 30, digits = 6, timestamp = Date.now() }) {
  const counter = Math.floor(timestamp / 1000 / step)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', base32Decode(secret))
  hmac.update(counterBuffer)
  const digest = hmac.digest()
  const offset = digest[digest.length - 1] & 0xf
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  const otp = (code % 10 ** digits).toString()
  return otp.padStart(digits, '0')
}

export function verifyTotp({ secret, token, step = 30, digits = 6, window = 1 }) {
  if (!token) return false
  const current = Date.now()
  const normalized = String(token).trim()
  for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
    const otp = totp({ secret, step, digits, timestamp: current + errorWindow * step * 1000 })
    if (otp === normalized) {
      return true
    }
  }
  return false
}

export function buildOtpauthUrl({ label, secret, issuer = 'SolarInvest' }) {
  const encodedLabel = encodeURIComponent(label)
  const encodedIssuer = encodeURIComponent(issuer)
  return `otpauth://totp/${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}`
}
