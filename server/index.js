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
import { getNeonDatabaseConfig } from './database/neonConfig.js'

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

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
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
if (!databaseConfig.connectionString) {
  console.info('[database] Nenhuma conexão Neon configurada. Defina NEON_DATABASE_URL para habilitar persistência.')
} else {
  console.info('[database] Configuração Neon detectada. Integração será inicializada quando implementada.')
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: 'Requisição inválida' })
    return
  }

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

  if (pathname === CONTRACT_RENDER_PATH) {
    await handleContractRenderRequest(req, res)
    return
  }

  if (pathname === CONTRACT_TEMPLATES_PATH) {
    await handleContractTemplatesRequest(req, res)
    return
  }

  if (method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  await serveStatic(pathname, res)
})

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
