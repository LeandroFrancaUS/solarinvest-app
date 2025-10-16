import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleAneelProxyRequest, DEFAULT_PROXY_BASE } from './aneelProxy.js'

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.resolve(__dirname, '../dist')
const distExists = existsSync(distDir)

/** @type {Record<string, string>} */
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

const isApiRequest = (pathname) => pathname === DEFAULT_PROXY_BASE

const safeResolve = (targetPath) => {
  let decoded
  try {
    decoded = decodeURIComponent(targetPath)
  } catch (error) {
    return null
  }
  const withoutLeadingSlash = decoded.replace(/^\/+/, '')
  const resolved = path.resolve(distDir, withoutLeadingSlash)
  if (!resolved.startsWith(distDir)) {
    return null
  }
  return resolved
}

/**
 * @param {string} filePath
 * @param {import('node:http').ServerResponse} res
 */
const serveFile = async (filePath, res) => {
  try {
    const content = await readFile(filePath)
    const ext = path.extname(filePath)
    const mime = MIME_TYPES[ext] ?? 'application/octet-stream'
    res.statusCode = 200
    res.setHeader('Content-Type', mime)
    res.end(content)
  } catch (error) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not found' }))
  }
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Invalid request' }))
    return
  }

  const url = new URL(req.url, 'http://localhost')
  const { pathname } = url

  if (isApiRequest(pathname)) {
    await handleAneelProxyRequest(req, res)
    return
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (!distExists || (req.method && !['GET', 'HEAD'].includes(req.method))) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  if (pathname === '/' || pathname === '') {
    await serveFile(path.join(distDir, 'index.html'), res)
    return
  }

  const filePath = safeResolve(pathname)
  if (filePath && existsSync(filePath)) {
    await serveFile(filePath, res)
    return
  }

  // Fallback to index.html for SPA routes
  await serveFile(path.join(distDir, 'index.html'), res)
})

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
