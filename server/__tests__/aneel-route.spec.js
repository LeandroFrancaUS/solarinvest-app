// server/__tests__/aneel-route.spec.js
// Tests for server/routes/aneel.js (registerAneelRoutes).
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi } from 'vitest'
import { createRouter } from '../router.js'
import { registerAneelRoutes } from '../routes/aneel.js'

vi.mock('../aneelProxy.js', () => ({
  DEFAULT_PROXY_BASE: '/api/aneel',
  handleAneelProxyRequest: vi.fn().mockResolvedValue(undefined),
}))

function makeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    get headersSent() { return res.body !== null },
    setHeader(key, val) { res.headers[key] = val },
    end(body) { res.body = body },
  }
  return res
}

function makeReq(url = '/api/aneel', method = 'GET') {
  return { url, method }
}

describe('registerAneelRoutes — route registration', () => {
  it('registers /api/aneel', () => {
    const router = createRouter()
    registerAneelRoutes(router, {})
    expect(router.match('GET', '/api/aneel')).toBeTypeOf('function')
    expect(router.size).toBe(1)
  })

  it('does not register any other routes', () => {
    const router = createRouter()
    registerAneelRoutes(router, {})
    expect(router.match('GET', '/api/other')).toBeNull()
  })
})

describe('/api/aneel handler', () => {
  it('delegates to handleAneelProxyRequest', async () => {
    const { handleAneelProxyRequest } = await import('../aneelProxy.js')
    const router = createRouter()
    registerAneelRoutes(router, {})

    const req = makeReq('/api/aneel', 'GET')
    const res = makeRes()
    const fn = router.match('GET', '/api/aneel')
    await fn(req, res, {})

    expect(handleAneelProxyRequest).toHaveBeenCalledWith(req, res)
  })

  it('matches POST as well (wildcard method)', () => {
    const router = createRouter()
    registerAneelRoutes(router, {})
    expect(router.match('POST', '/api/aneel')).toBeTypeOf('function')
  })
})
