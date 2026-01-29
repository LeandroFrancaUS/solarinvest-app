import { getStackUser, sanitizeStackUserId, isStackAuthEnabled, getTrustedOrigins } from '../server/auth/stackAuth.js'
import { getDatabaseClient } from '../server/database/neonClient.js'
import { StorageService } from '../server/database/storageService.js'

const MAX_JSON_BODY_BYTES = 256 * 1024
const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With'
const CORS_ALLOWED_METHODS = 'GET,POST,PUT,DELETE,OPTIONS'

const trustedOrigins = getTrustedOrigins()
const stackAuthEnabled = isStackAuthEnabled()

const databaseClient = getDatabaseClient()
const storageService = databaseClient ? new StorageService(databaseClient.sql) : null
let storageUnavailableWarningLogged = false

if (storageService) {
  storageService.ensureInitialized().catch((error) => {
    console.error('[storage] Falha ao inicializar a persistência no ambiente serverless:', error)
  })
}

function applyCorsHeaders(req, res) {
  if (trustedOrigins.size === 0) {
    return
  }

  const originHeader = req.headers?.origin
  const origin = typeof originHeader === 'string' ? originHeader.trim() : ''
  if (!origin || (!trustedOrigins.has(origin) && !trustedOrigins.has('*'))) {
    return
  }

  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS)
  res.setHeader('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS)
  res.setHeader('Access-Control-Max-Age', '600')
  res.setHeader('Vary', 'Origin')
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function sendNoContent(res) {
  res.statusCode = 204
  res.end()
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body
  }

  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (error) {
      throw new Error('JSON inválido na requisição.')
    }
  }

  if (!req.readable) {
    return {}
  }

  let accumulated = ''
  let totalLength = 0

  req.setEncoding('utf8')

  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      totalLength += chunk.length
      if (totalLength > MAX_JSON_BODY_BYTES) {
        reject(new Error('Payload acima do limite permitido.'))
        return
      }
      accumulated += chunk
    })

    req.on('end', () => {
      if (!accumulated) {
        resolve({})
        return
      }
      try {
        const parsed = JSON.parse(accumulated)
        resolve(parsed)
      } catch (error) {
        reject(new Error('JSON inválido na requisição.'))
      }
    })

    req.on('error', (error) => {
      reject(error)
    })
  })
}

export default async function handler(req, res) {
  applyCorsHeaders(req, res)

  const method = req.method?.toUpperCase() ?? 'GET'

  if (method === 'OPTIONS') {
    res.setHeader('Allow', CORS_ALLOWED_METHODS)
    sendNoContent(res)
    return
  }

  if (!storageService) {
    if (!storageUnavailableWarningLogged) {
      storageUnavailableWarningLogged = true
      console.warn('[storage] Persistência Neon indisponível no ambiente serverless. Defina DATABASE_URL para habilitar.')
    }
    sendJson(res, 503, { error: 'Persistência indisponível' })
    return
  }

  const stackUser = await getStackUser(req)
  const userId = stackAuthEnabled
    ? sanitizeStackUserId(stackUser && stackUser.payload ? stackUser : null)
    : sanitizeStackUserId(stackUser)

  if (stackAuthEnabled && !userId) {
    sendJson(res, 401, { error: 'Autenticação obrigatória.' })
    return
  }

  try {
    if (method === 'GET') {
      const entries = await storageService.listEntries(userId)
      sendJson(res, 200, { entries })
      return
    }

    if (method === 'PUT' || method === 'POST') {
      const body = await readJsonBody(req)
      const key = typeof body.key === 'string' ? body.key.trim() : ''
      const value = body.value === undefined || body.value === null ? null : String(body.value)

      if (!key) {
        sendJson(res, 400, { error: 'Chave de armazenamento inválida.' })
        return
      }

      await storageService.setEntry(userId, key, value)
      sendNoContent(res)
      return
    }

    if (method === 'DELETE') {
      const body = await readJsonBody(req)
      const key = typeof body.key === 'string' ? body.key.trim() : ''

      if (!key) {
        await storageService.clear(userId)
        sendNoContent(res)
        return
      }

      await storageService.removeEntry(userId, key)
      sendNoContent(res)
      return
    }

    sendJson(res, 405, { error: 'Método não suportado.' })
  } catch (error) {
    console.error('[storage] Erro ao manipular persistência Neon (serverless):', error)
    sendJson(res, 500, { error: 'Falha ao acessar armazenamento persistente.' })
  }
}
