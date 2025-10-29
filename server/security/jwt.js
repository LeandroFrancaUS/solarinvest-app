import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from 'node:crypto'
import { config, isDevelopment } from '../config.js'

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64urlDecode(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64')
}

function parseJsonBase64Url(input) {
  const json = base64urlDecode(input).toString('utf-8')
  return JSON.parse(json)
}

let privateKeyPem = config.jwtPrivateKey
let publicKeyPem = config.jwtPublicKey

if (!privateKeyPem || !publicKeyPem) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' })
  if (isDevelopment()) {
    console.warn('JWT key pair generated for development. Provide AUTH_JWT_PRIVATE_KEY_BASE64/AUTH_JWT_PUBLIC_KEY_BASE64 for production.')
  }
}

const privateKey = createPrivateKey(privateKeyPem)
const publicKey = createPublicKey(publicKeyPem)

export function createJwt(payload, { expiresInSeconds }) {
  const now = Math.floor(Date.now() / 1000)
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    jti: base64url(randomBytes(16)),
  }
  const header = { alg: 'EdDSA', typ: 'JWT' }
  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(fullPayload))
  const data = `${encodedHeader}.${encodedPayload}`
  const signature = sign(null, Buffer.from(data), privateKey)
  const encodedSignature = base64url(signature)
  return `${data}.${encodedSignature}`
}

export function verifyJwt(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token inválido')
  }
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Token inválido')
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const data = `${encodedHeader}.${encodedPayload}`
  const signature = base64urlDecode(encodedSignature)
  const isValid = verify(null, Buffer.from(data), publicKey, signature)
  if (!isValid) {
    throw new Error('Assinatura inválida')
  }
  const payload = parseJsonBase64Url(encodedPayload)
  if (payload.exp && typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expirado')
  }
  return payload
}

export function getPublicKeyPem() {
  return publicKeyPem
}
