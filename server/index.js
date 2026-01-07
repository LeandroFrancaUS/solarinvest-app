import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { URL } from 'node:url'

import { handleAneelProxyRequest, DEFAULT_PROXY_BASE } from './aneelProxy.js'
import {
  CONTRACT_RENDER_PATH,
  CONTRACT_TEMPLATES_PATH,
  handleContractRenderRequest,
  handleContractTemplatesRequest,
} from './contracts.js'
import {
  LEASING_CONTRACTS_PATH,
  LEASING_CONTRACTS_AVAILABILITY_PATH,
  handleLeasingContractsRequest,
  handleLeasingContractsAvailabilityRequest,
} from './leasingContracts.js'
import {
  getStackUser,
  getTrustedOrigins,
  isStackAuthEnabled,
  sanitizeStackUserId,
} from './auth/stackAuth.js'
import { getNeonDatabaseConfig } from './database/neonConfig.js'
import { getDatabaseClient } from './database/neonClient.js'
import { StorageService } from './database/storageService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.resolve(__dirname, '../dist')
const distExists = existsSync(distDir)

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10)
const STORAGE_API_PATH = '/api/storage'
const TEST_API_PATH = '/api/test'
const MAX_JSON_BODY_BYTES = 256 * 1024
const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With'
const CORS_ALLOWED_METHODS = 'GET,POST,PUT,DELETE,OPTIONS'

const trustedOrigins = getTrustedOrigins()
const stackAuthEnabled = isStackAuthEnabled()

if (stackAuthEnabled) {
  console.info('[auth] Stack Auth JWT validation habilitado.')
} else {
  console.info('[auth] Stack Auth não configurado. Defina NEXT_PUBLIC_STACK_PROJECT_ID e STACK_JWKS_URL para exigir autenticação.')
}

const applyCorsHeaders = (req, res) => {
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

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const sendNoContent = (res) => {
  res.statusCode = 204
  res.end()
}

const readJsonBody = async (req) => {
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

const serveStatic = async (pathname, res) => {
  if (!distExists) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  let target = pathname
  if (target === '/' || target === '') {
    target = '/index.html'
  }

  const resolved = path.resolve(distDir, `.${target}`)
  if (!resolved.startsWith(distDir) || !existsSync(resolved)) {
    const indexPath = path.join(distDir, 'index.html')
    try {
      const indexContent = await readFile(indexPath)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(indexContent)
    } catch (error) {
      console.error('[server] Não foi possível servir index.html:', error)
      sendJson(res, 404, { error: 'Not found' })
    }
    return
  }

  const ext = path.extname(resolved)
  const content = await readFile(resolved)
  res.statusCode = 200
  res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream')
  res.end(content)
}

const databaseConfig = getNeonDatabaseConfig()
const databaseClient = getDatabaseClient()
let storageService = null

if (!databaseConfig.connectionString) {
  console.info('[database] Nenhuma conexão Neon configurada. Defina DATABASE_URL para habilitar persistência.')
} else if (!databaseClient) {
  console.error('[database] Não foi possível inicializar o cliente Neon. Verifique suas dependências.')
} else {
  storageService = new StorageService(databaseClient.sql)
  storageService
    .ensureInitialized()
    .then(() => {
      console.info('[database] Integração Neon inicializada com sucesso.')
    })
    .catch((error) => {
      console.error('[database] Falha ao inicializar a estrutura do banco de dados:', error)
    })
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: 'Requisição inválida' })
    return
  }

  applyCorsHeaders(req, res)

  const requestUrl = new URL(req.url, 'http://localhost')
  const pathname = requestUrl.pathname
  const method = req.method?.toUpperCase() ?? 'GET'

  if (pathname === '/health') {
    sendJson(res, 200, { status: 'ok' })
    return
  }

  if (pathname === DEFAULT_PROXY_BASE) {
    await handleAneelProxyRequest(req, res)
    return
  }

  // Check more specific leasing routes before the general leasing route
  if (pathname === LEASING_CONTRACTS_AVAILABILITY_PATH) {
    await handleLeasingContractsAvailabilityRequest(req, res)
    return
  }

  if (pathname === LEASING_CONTRACTS_PATH) {
    await handleLeasingContractsRequest(req, res)
    return
  }

  if (pathname === CONTRACT_RENDER_PATH) {
    await handleContractRenderRequest(req, res)
    return
  }

  if (pathname === CONTRACT_TEMPLATES_PATH) {
    await handleContractTemplatesRequest(req, res)
    return
  }

  if (pathname === TEST_API_PATH) {
    if (!databaseClient || !databaseConfig.connectionString) {
      sendJson(res, 503, { error: 'Persistência indisponível' })
      return
    }

    try {
      const result = await databaseClient.sql`SELECT NOW() AS current_time`
      const row = Array.isArray(result) && result.length > 0 ? result[0] : null
      const nowValue = row?.current_time ?? row?.now ?? null
      const serialized =
        nowValue && typeof nowValue.toISOString === 'function'
          ? nowValue.toISOString()
          : nowValue
      sendJson(res, 200, { now: serialized })
    } catch (error) {
      console.error('[database] Falha ao executar teste de conexão Neon:', error)
      sendJson(res, 500, { error: 'Falha ao consultar o banco de dados.' })
    }
    return
  }

  if (pathname === STORAGE_API_PATH) {
    if (!storageService) {
      sendJson(res, 503, { error: 'Persistência indisponível' })
      return
    }

    const stackUser = await getStackUser(req)
    const userId = stackAuthEnabled
      ? sanitizeStackUserId(stackUser && stackUser.payload ? stackUser : null)
      : sanitizeStackUserId(stackUser)

    try {
      if (method === 'OPTIONS') {
        res.setHeader('Allow', CORS_ALLOWED_METHODS)
        sendNoContent(res)
        return
      }

      if (stackAuthEnabled && !userId) {
        sendJson(res, 401, { error: 'Autenticação obrigatória.' })
        return
      }

      if (method === 'GET') {
        const entries = await storageService.listEntries(userId)
        sendJson(res, 200, { entries })
        return
      }

      if (method === 'PUT' || method === 'POST') {
        const body = await readJsonBody(req)
        const key = typeof body.key === 'string' ? body.key.trim() : ''
        const value = body.value === undefined ? null : body.value

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
      console.error('[storage] Erro ao manipular persistência Neon:', error)
      sendJson(res, 500, { error: 'Falha ao acessar armazenamento persistente.' })
    }
    return
  }

  if (method === 'OPTIONS') {
    res.setHeader('Allow', CORS_ALLOWED_METHODS)
    sendNoContent(res)
    return
  }

  await serveStatic(pathname, res)
})

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
