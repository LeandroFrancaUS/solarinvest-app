const UPSTREAM_ORIGIN = 'https://dadosabertos.aneel.gov.br'
const DEFAULT_PROXY_BASE = '/api/aneel'

class ProxyError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
    this.name = 'ProxyError'
  }
}

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition,Content-Type,Cache-Control')
}

const resolveUpstreamUrl = (requestUrl) => {
  const parsed = new URL(requestUrl || '/', 'http://localhost')
  const pathParam = parsed.searchParams.get('path')
  if (!pathParam) {
    throw new ProxyError(400, 'Missing required "path" query parameter')
  }

  if (!pathParam.startsWith('/')) {
    throw new ProxyError(400, 'The "path" parameter must start with "/"')
  }

  const upstream = new URL(pathParam, UPSTREAM_ORIGIN)
  if (pathParam.startsWith('//') || upstream.origin !== UPSTREAM_ORIGIN) {
    throw new ProxyError(400, 'The "path" parameter must target dadosabertos.aneel.gov.br')
  }
  return upstream.toString()
}

const forwardResponse = async (upstreamResponse, res) => {
  const buffer = Buffer.from(await upstreamResponse.arrayBuffer())
  res.statusCode = upstreamResponse.status

  const contentType = upstreamResponse.headers.get('content-type')
  if (contentType) {
    res.setHeader('Content-Type', contentType)
  } else {
    res.setHeader('Content-Type', 'application/octet-stream')
  }

  const disposition = upstreamResponse.headers.get('content-disposition')
  if (disposition) {
    res.setHeader('Content-Disposition', disposition)
  }

  const cacheControl = upstreamResponse.headers.get('cache-control')
  if (cacheControl) {
    res.setHeader('Cache-Control', cacheControl)
  }

  res.end(buffer)
}

export const handleAneelProxyRequest = async (req, res) => {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method && req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const upstreamUrl = resolveUpstreamUrl(req.url)
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: { Accept: '*/*' },
    })
    await forwardResponse(upstreamResponse, res)
  } catch (error) {
    if (error instanceof ProxyError) {
      res.statusCode = error.statusCode
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: error.message }))
      return
    }

    console.error('[ANEEL proxy] Unexpected error', error)
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to reach dadosabertos.aneel.gov.br' }))
  }
}

export const createAneelProxyMiddleware = (basePath = DEFAULT_PROXY_BASE) => {
  const normalizedBase = typeof basePath === 'string' ? basePath.replace(/\/+$/, '') || '/' : '/api/aneel'

  return async (req, res, next) => {
    if (!req.url) {
      next()
      return
    }

    const url = new URL(req.url, 'http://localhost')
    if (url.pathname !== normalizedBase) {
      next()
      return
    }

    await handleAneelProxyRequest(req, res)
  }
}

export { DEFAULT_PROXY_BASE }
