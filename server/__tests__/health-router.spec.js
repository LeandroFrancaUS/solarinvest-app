// server/__tests__/health-router.spec.js
// Tests for the route registry (server/router.js) and health route handlers
// (server/routes/health.js).
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerHealthRoutes } from '../routes/health.js'

// ── Mock external dependency ──────────────────────────────────────────────────
vi.mock('../database/neonConfig.js', () => ({
  getNeonDatabaseConfig: () => ({ source: 'DATABASE_URL', schema: 'public' }),
}))

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeRes() {
  const headers = {}
  const res = {
    statusCode: 0,
    headers,
    body: /** @type {string | null} */ (null),
    get headersSent() {
      return res.body !== null
    },
    setHeader(key, val) {
      headers[key] = val
    },
    end(body) {
      res.body = body
    },
  }
  return res
}

function makeReq(url = '/api/health') {
  return { url }
}

/** @returns {(res: object, status: number, payload: object) => void} */
function makeSendJson() {
  return (res, status, payload) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
  }
}

/** @param {ReturnType<makeSendJson>} sendJson */
function makeSendServerError(sendJson) {
  return (res, statusCode, payload, requestId, vercelId) => {
    if (res.headersSent) return
    if (requestId) res.setHeader('X-Request-Id', requestId)
    if (vercelId) res.setHeader('X-Vercel-Id', vercelId)
    sendJson(res, statusCode, { ok: false, requestId, vercelId, ...payload })
  }
}

/** Parse JSON body written to a fake res. */
function parseBody(res) {
  return JSON.parse(/** @type {string} */ (res.body))
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. createRouter — registry primitives
// ─────────────────────────────────────────────────────────────────────────────

describe('createRouter', () => {
  it('registers and matches a GET route', () => {
    const router = createRouter()
    const fn = vi.fn()
    router.register('GET', '/api/test', fn)
    expect(router.match('GET', '/api/test')).toBe(fn)
  })

  it('returns null for an unregistered route', () => {
    const router = createRouter()
    expect(router.match('GET', '/api/missing')).toBeNull()
  })

  it('is case-insensitive for method', () => {
    const router = createRouter()
    const fn = vi.fn()
    router.register('get', '/api/test', fn)
    expect(router.match('GET', '/api/test')).toBe(fn)
  })

  it('wildcard method matches any HTTP verb', () => {
    const router = createRouter()
    const fn = vi.fn()
    router.register('*', '/api/health', fn)
    expect(router.match('GET', '/api/health')).toBe(fn)
    expect(router.match('POST', '/api/health')).toBe(fn)
    expect(router.match('DELETE', '/api/health')).toBe(fn)
  })

  it('specific method does not match a different method', () => {
    const router = createRouter()
    const fn = vi.fn()
    router.register('GET', '/api/resource', fn)
    expect(router.match('POST', '/api/resource')).toBeNull()
  })

  it('tracks .size after registrations', () => {
    const router = createRouter()
    expect(router.size).toBe(0)
    router.register('GET', '/a', vi.fn())
    router.register('POST', '/b', vi.fn())
    expect(router.size).toBe(2)
  })

  it('returns the first registered handler when multiple paths exist', () => {
    const router = createRouter()
    const first = vi.fn()
    const second = vi.fn()
    router.register('GET', '/api/health', first)
    router.register('GET', '/api/health', second)
    expect(router.match('GET', '/api/health')).toBe(first)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. registerHealthRoutes — registers all expected paths
// ─────────────────────────────────────────────────────────────────────────────

describe('registerHealthRoutes — route registration', () => {
  it('registers /health, /api/health, /api/health/db, /api/health/auth, /api/health/storage, /api/health/pdf, /api/health/contracts, /api/test', () => {
    const router = createRouter()
    const sendJson = makeSendJson()
    registerHealthRoutes(router, {
      databaseClient: null,
      databaseConfig: {},
      storageService: null,
      stackAuthEnabled: false,
      sendJson,
      sendServerError: makeSendServerError(sendJson),
    })

    expect(router.match('GET', '/health')).toBeTypeOf('function')
    expect(router.match('GET', '/api/health')).toBeTypeOf('function')
    expect(router.match('GET', '/api/health/db')).toBeTypeOf('function')
    expect(router.match('GET', '/api/health/auth')).toBeTypeOf('function')
    expect(router.match('GET', '/api/health/storage')).toBeTypeOf('function')
    expect(router.match('GET', '/api/health/pdf')).toBeTypeOf('function')
    expect(router.match('GET', '/api/health/contracts')).toBeTypeOf('function')
    expect(router.match('GET', '/api/test')).toBeTypeOf('function')
    expect(router.size).toBe(8) // 5 original + 3 new routes
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. /api/health handler behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('/api/health handler', () => {
  let router
  let sendJson
  let mockSql

  beforeEach(() => {
    router = createRouter()
    sendJson = makeSendJson()
    mockSql = vi.fn().mockResolvedValue([{ ok: 1 }])

    registerHealthRoutes(router, {
      databaseClient: { sql: mockSql },
      databaseConfig: { connectionString: 'postgres://test' },
      storageService: {},
      stackAuthEnabled: false,
      sendJson,
      sendServerError: makeSendServerError(sendJson),
    })
  })

  it('returns 200 { ok: true, db: true } when DB is reachable', async () => {
    const res = makeRes()
    const fn = router.match('GET', '/api/health')
    await fn(makeReq('/api/health'), res, { requestId: 'r1', vercelId: undefined })

    expect(res.statusCode).toBe(200)
    expect(parseBody(res)).toEqual({ ok: true, db: true })
  })

  it('returns 503 DB_NOT_CONFIGURED when databaseClient is null', async () => {
    const router2 = createRouter()
    const sj = makeSendJson()
    registerHealthRoutes(router2, {
      databaseClient: null,
      databaseConfig: {},
      storageService: null,
      stackAuthEnabled: false,
      sendJson: sj,
      sendServerError: makeSendServerError(sj),
    })

    const res = makeRes()
    const fn = router2.match('GET', '/api/health')
    await fn(makeReq('/api/health'), res, { requestId: 'r2', vercelId: undefined })

    expect(res.statusCode).toBe(503)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(body.error).toBe('DB_NOT_CONFIGURED')
  })

  it('returns 500 DB_HEALTHCHECK_FAILED when DB query throws', async () => {
    mockSql.mockRejectedValueOnce(new Error('connection refused'))

    const res = makeRes()
    const fn = router.match('GET', '/api/health')
    await fn(makeReq('/api/health'), res, { requestId: 'r3', vercelId: 'v3' })

    expect(res.statusCode).toBe(500)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(body.error).toBe('DB_HEALTHCHECK_FAILED')
  })

  it('also handles /health (alias)', async () => {
    const res = makeRes()
    const fn = router.match('GET', '/health')
    await fn(makeReq('/health'), res, { requestId: 'r4', vercelId: undefined })

    expect(res.statusCode).toBe(200)
    expect(parseBody(res)).toEqual({ ok: true, db: true })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. /api/health/db handler behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('/api/health/db handler', () => {
  const NOW = new Date('2025-01-01T00:00:00.000Z')
  let router
  let sendJson
  let mockSql

  beforeEach(() => {
    router = createRouter()
    sendJson = makeSendJson()
    mockSql = vi.fn().mockResolvedValue([{ ok: 1, now: NOW }])

    registerHealthRoutes(router, {
      databaseClient: { sql: mockSql },
      databaseConfig: { connectionString: 'postgres://test' },
      storageService: {},
      stackAuthEnabled: false,
      sendJson,
      sendServerError: makeSendServerError(sendJson),
    })
  })

  it('returns 200 with ok, db, now, latencyMs on success', async () => {
    const res = makeRes()
    const fn = router.match('GET', '/api/health/db')
    await fn(makeReq('/api/health/db'), res, { requestId: 'r1', vercelId: undefined })

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.ok).toBe(true)
    expect(body.db).toBe('connected')
    expect(body.now).toBe(NOW.toISOString())
    expect(typeof body.latencyMs).toBe('number')
  })

  it('returns 503 when databaseClient is null', async () => {
    const router2 = createRouter()
    const sj = makeSendJson()
    registerHealthRoutes(router2, {
      databaseClient: null,
      databaseConfig: {},
      storageService: null,
      stackAuthEnabled: false,
      sendJson: sj,
      sendServerError: makeSendServerError(sj),
    })

    const res = makeRes()
    const fn = router2.match('GET', '/api/health/db')
    await fn(makeReq('/api/health/db'), res, { requestId: 'r2', vercelId: undefined })

    expect(res.statusCode).toBe(503)
    const body = parseBody(res)
    expect(body.db).toBe('not_configured')
  })

  it('returns 500 when DB query fails', async () => {
    mockSql.mockRejectedValueOnce(new Error('timeout'))

    const res = makeRes()
    const fn = router.match('GET', '/api/health/db')
    await fn(makeReq('/api/health/db'), res, { requestId: 'r3', vercelId: undefined })

    expect(res.statusCode).toBe(500)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(body.db).toBe('error')
    expect(typeof body.latencyMs).toBe('number')
  })

  it('serializes a non-Date now value as-is', async () => {
    mockSql.mockResolvedValueOnce([{ ok: 1, now: '2025-06-01T00:00:00Z' }])

    const res = makeRes()
    const fn = router.match('GET', '/api/health/db')
    await fn(makeReq('/api/health/db'), res, { requestId: 'r4', vercelId: undefined })

    expect(res.statusCode).toBe(200)
    expect(parseBody(res).now).toBe('2025-06-01T00:00:00Z')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. /api/health/auth handler behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('/api/health/auth handler', () => {
  function setup(stackAuthEnabled) {
    const router = createRouter()
    const sendJson = makeSendJson()
    registerHealthRoutes(router, {
      databaseClient: null,
      databaseConfig: {},
      storageService: null,
      stackAuthEnabled,
      sendJson,
      sendServerError: makeSendServerError(sendJson),
    })
    return router
  }

  it('returns status "bypass" when stackAuthEnabled is false', async () => {
    const res = makeRes()
    const fn = setup(false).match('GET', '/api/health/auth')
    await fn(makeReq('/api/health/auth'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.ok).toBe(true)
    expect(body.service).toBe('auth')
    expect(body.status).toBe('bypass')
    expect(body.stackAuthEnabled).toBe(false)
  })

  it('returns status "configured" when stackAuthEnabled is true', async () => {
    const res = makeRes()
    const fn = setup(true).match('GET', '/api/health/auth')
    await fn(makeReq('/api/health/auth'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.status).toBe('configured')
    expect(body.stackAuthEnabled).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. /api/health/storage handler behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('/api/health/storage handler', () => {
  let router
  let sendJson
  let mockSql

  beforeEach(() => {
    router = createRouter()
    sendJson = makeSendJson()
    mockSql = vi.fn().mockResolvedValue([{ ok: 1 }])

    registerHealthRoutes(router, {
      databaseClient: { sql: mockSql },
      databaseConfig: { connectionString: 'postgres://test' },
      storageService: { /* non-null */ },
      stackAuthEnabled: false,
      sendJson,
      sendServerError: makeSendServerError(sendJson),
    })
  })

  it('returns 200 with ok + latencyMs when storage is reachable', async () => {
    const res = makeRes()
    const fn = router.match('GET', '/api/health/storage')
    await fn(makeReq('/api/health/storage'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.ok).toBe(true)
    expect(body.service).toBe('storage')
    expect(body.status).toBe('connected')
    expect(typeof body.latencyMs).toBe('number')
  })

  it('returns 503 not_configured when storageService is null', async () => {
    const router2 = createRouter()
    const sj = makeSendJson()
    registerHealthRoutes(router2, {
      databaseClient: null,
      databaseConfig: {},
      storageService: null,
      stackAuthEnabled: false,
      sendJson: sj,
      sendServerError: makeSendServerError(sj),
    })

    const res = makeRes()
    const fn = router2.match('GET', '/api/health/storage')
    await fn(makeReq('/api/health/storage'), res, {})

    expect(res.statusCode).toBe(503)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(body.status).toBe('not_configured')
  })

  it('returns 503 error when DB query throws', async () => {
    mockSql.mockRejectedValueOnce(new Error('network error'))

    const res = makeRes()
    const fn = router.match('GET', '/api/health/storage')
    await fn(makeReq('/api/health/storage'), res, {})

    expect(res.statusCode).toBe(503)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(body.status).toBe('error')
    expect(typeof body.latencyMs).toBe('number')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. /api/health/pdf handler behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('/api/health/pdf handler', () => {
  function setup({ convertapi = false, gotenberg = false } = {}) {
    const router = createRouter()
    const sendJson = makeSendJson()
    registerHealthRoutes(router, {
      databaseClient: null,
      databaseConfig: {},
      storageService: null,
      stackAuthEnabled: false,
      sendJson,
      sendServerError: makeSendServerError(sendJson),
      isConvertApiConfigured: () => convertapi,
      isGotenbergConfigured: () => gotenberg,
    })
    return router
  }

  it('returns 200 with ok=false when no converter is configured', async () => {
    const res = makeRes()
    const fn = setup({ convertapi: false, gotenberg: false }).match('GET', '/api/health/pdf')
    await fn(makeReq('/api/health/pdf'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(body.convertapiConfigured).toBe(false)
    expect(body.gotenbergConfigured).toBe(false)
  })

  it('returns 200 with ok=true when convertapi is configured', async () => {
    const res = makeRes()
    const fn = setup({ convertapi: true }).match('GET', '/api/health/pdf')
    await fn(makeReq('/api/health/pdf'), res, {})

    expect(res.statusCode).toBe(200)
    expect(parseBody(res).ok).toBe(true)
    expect(parseBody(res).convertapiConfigured).toBe(true)
  })

  it('returns 200 with ok=true when gotenberg is configured', async () => {
    const res = makeRes()
    const fn = setup({ gotenberg: true }).match('GET', '/api/health/pdf')
    await fn(makeReq('/api/health/pdf'), res, {})

    expect(res.statusCode).toBe(200)
    expect(parseBody(res).ok).toBe(true)
    expect(parseBody(res).gotenbergConfigured).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. /api/health/contracts handler behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('/api/health/contracts handler', () => {
  function setup({ fileExists = true } = {}) {
    const router = createRouter()
    const sendJson = makeSendJson()
    registerHealthRoutes(router, {
      databaseClient: null,
      databaseConfig: {},
      storageService: null,
      stackAuthEnabled: false,
      sendJson,
      sendServerError: makeSendServerError(sendJson),
      isConvertApiConfigured: () => false,
      isGotenbergConfigured: () => false,
      contractTemplatePath: '/fake/template.dotx',
      checkFileExists: fileExists
        ? () => Promise.resolve()
        : () => Promise.reject(new Error('ENOENT')),
    })
    return router
  }

  it('returns 200 with ok=true when template file exists', async () => {
    const res = makeRes()
    const fn = setup({ fileExists: true }).match('GET', '/api/health/contracts')
    await fn(makeReq('/api/health/contracts'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.ok).toBe(true)
    expect(body.templateExists).toBe(true)
    expect(typeof body.node).toBe('string')
  })

  it('returns 200 with ok=false when template file is missing', async () => {
    const res = makeRes()
    const fn = setup({ fileExists: false }).match('GET', '/api/health/contracts')
    await fn(makeReq('/api/health/contracts'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(body.templateExists).toBe(false)
  })

  it('returns ok=false when contractTemplatePath is null', async () => {
    const router = createRouter()
    const sendJson = makeSendJson()
    registerHealthRoutes(router, {
      databaseClient: null,
      databaseConfig: {},
      storageService: null,
      stackAuthEnabled: false,
      sendJson,
      sendServerError: makeSendServerError(sendJson),
    })

    const res = makeRes()
    const fn = router.match('GET', '/api/health/contracts')
    await fn(makeReq('/api/health/contracts'), res, {})

    expect(res.statusCode).toBe(200)
    expect(parseBody(res).ok).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. /api/test handler behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('/api/test handler', () => {
  const NOW = new Date('2025-06-01T12:00:00.000Z')
  let router
  let sendJson
  let mockSql

  beforeEach(() => {
    router = createRouter()
    sendJson = makeSendJson()
    mockSql = vi.fn().mockResolvedValue([{ current_time: NOW }])

    registerHealthRoutes(router, {
      databaseClient: { sql: mockSql },
      databaseConfig: { connectionString: 'postgres://test' },
      storageService: {},
      stackAuthEnabled: false,
      sendJson,
      sendServerError: makeSendServerError(sendJson),
    })
  })

  it('returns 200 with { now } ISO string when DB is available', async () => {
    const res = makeRes()
    const fn = router.match('GET', '/api/test')
    await fn(makeReq('/api/test'), res, {})

    expect(res.statusCode).toBe(200)
    expect(parseBody(res)).toEqual({ now: NOW.toISOString() })
  })

  it('returns 503 when databaseClient is null', async () => {
    const router2 = createRouter()
    const sj = makeSendJson()
    registerHealthRoutes(router2, {
      databaseClient: null,
      databaseConfig: {},
      storageService: null,
      stackAuthEnabled: false,
      sendJson: sj,
      sendServerError: makeSendServerError(sj),
    })

    const res = makeRes()
    const fn = router2.match('GET', '/api/test')
    await fn(makeReq('/api/test'), res, {})

    expect(res.statusCode).toBe(503)
    expect(parseBody(res).error).toBe('Persistência indisponível')
  })

  it('returns 503 when connectionString is absent', async () => {
    const router2 = createRouter()
    const sj = makeSendJson()
    const mockSql2 = vi.fn()
    registerHealthRoutes(router2, {
      databaseClient: { sql: mockSql2 },
      databaseConfig: { connectionString: '' },
      storageService: null,
      stackAuthEnabled: false,
      sendJson: sj,
      sendServerError: makeSendServerError(sj),
    })

    const res = makeRes()
    const fn = router2.match('GET', '/api/test')
    await fn(makeReq('/api/test'), res, {})

    expect(res.statusCode).toBe(503)
  })
})
