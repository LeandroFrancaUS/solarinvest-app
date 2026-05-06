// server/__tests__/storage-router.spec.js
// Unit tests for server/routes/storage.js (PR 13).
//
// Verifies that registerStorageRoutes correctly delegates GET / PUT / POST /
// DELETE / OPTIONS to StorageService and returns the exact status codes and
// response shapes produced by the original handler.js implementation.
//
// Run with: npm run test:server

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerStorageRoutes } from '../routes/storage.js'

// ── Mock auth dependencies ────────────────────────────────────────────────────

vi.mock('../auth/stackAuth.js', () => ({
  getStackUser: vi.fn(),
  sanitizeStackUserId: vi.fn(),
}))

vi.mock('../proposals/permissions.js', () => ({
  resolveActor: vi.fn(),
  actorRole: vi.fn(),
}))

import { getStackUser, sanitizeStackUserId } from '../auth/stackAuth.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeRes() {
  const headers = {}
  return {
    statusCode: 0,
    headers,
    body: null,
    setHeader(key, val) { headers[key] = val },
    end(body) { this.body = body ?? null },
    get headersSent() { return this.body !== null },
  }
}

function makeReq(method = 'GET') {
  return { url: '/api/storage', method }
}

function makeSendJson() {
  return (res, status, payload) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
  }
}

function makeSendNoContent() {
  return (res) => {
    res.statusCode = 204
    res.end()
  }
}

function makeReadJsonBody(body = {}) {
  return vi.fn().mockResolvedValue(body)
}

function parseBody(res) {
  return JSON.parse(/** @type {string} */ (res.body))
}

// Default "happy-path" actor used across most tests
const MOCK_ACTOR = {
  userId: 'user-abc',
  email: 'tester@example.com',
  displayName: 'Tester',
  isAdmin: true,
  isComercial: false,
  isOffice: false,
  isFinanceiro: false,
  hasAnyRole: true,
}

/**
 * Build and register a router with the given context overrides.
 * Returns the registered handler function for /api/storage.
 */
function buildRouter(ctxOverrides = {}, stackAuthEnabled = false) {
  const sendJson = makeSendJson()
  const sendNoContent = makeSendNoContent()
  const readJsonBody = makeReadJsonBody(ctxOverrides._body ?? {})

  const mockStorage = {
    listEntries: vi.fn().mockResolvedValue([]),
    setEntry: vi.fn().mockResolvedValue(undefined),
    removeEntry: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    ...(ctxOverrides.storageService ?? {}),
  }

  const router = createRouter()
  registerStorageRoutes(router, {
    storageService: ctxOverrides.storageService === null ? null : mockStorage,
    stackAuthEnabled,
    sendJson,
    sendNoContent,
    readJsonBody,
    ...ctxOverrides,
  })

  return {
    router,
    sendJson,
    sendNoContent,
    readJsonBody,
    mockStorage,
    fn: router.match('GET', '/api/storage'),
  }
}

// ── Baseline ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // Default: auth bypass (no stack auth), actor resolves OK
  getStackUser.mockResolvedValue(null)
  sanitizeStackUserId.mockReturnValue(null)
  resolveActor.mockResolvedValue(MOCK_ACTOR)
  actorRole.mockReturnValue('role_admin')
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. Route registration
// ─────────────────────────────────────────────────────────────────────────────

describe('registerStorageRoutes — route registration', () => {
  it('registers /api/storage for all methods via wildcard', () => {
    const { router } = buildRouter()
    expect(router.match('GET', '/api/storage')).toBeTypeOf('function')
    expect(router.match('POST', '/api/storage')).toBeTypeOf('function')
    expect(router.match('PUT', '/api/storage')).toBeTypeOf('function')
    expect(router.match('DELETE', '/api/storage')).toBeTypeOf('function')
    expect(router.match('OPTIONS', '/api/storage')).toBeTypeOf('function')
    // Wildcard registration = 1 route entry
    expect(router.size).toBe(1)
  })

  it('does not register unrelated paths', () => {
    const { router } = buildRouter()
    expect(router.match('GET', '/api/other')).toBeNull()
    expect(router.match('GET', '/api/storage/extra')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Storage unavailable
// ─────────────────────────────────────────────────────────────────────────────

describe('storageService unavailable', () => {
  it('returns 503 STORAGE_UNAVAILABLE when storageService is null', async () => {
    const router = createRouter()
    const sendJson = makeSendJson()
    registerStorageRoutes(router, {
      storageService: null,
      stackAuthEnabled: false,
      sendJson,
      sendNoContent: makeSendNoContent(),
      readJsonBody: makeReadJsonBody(),
    })

    const res = makeRes()
    const fn = router.match('GET', '/api/storage')
    await fn(makeReq('GET'), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(503)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(body.code).toBe('STORAGE_UNAVAILABLE')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Auth / permission gates
// ─────────────────────────────────────────────────────────────────────────────

describe('authentication / authorization gates', () => {
  it('returns 401 when resolveActor throws with "Unauthorized"', async () => {
    resolveActor.mockRejectedValueOnce(new Error('Unauthorized — invalid token'))
    const { fn } = buildRouter()
    const res = makeRes()
    await fn(makeReq('GET'), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(401)
    expect(parseBody(res).code).toBe('UNAUTHORIZED')
  })

  it('returns 401 when resolveActor throws with "401"', async () => {
    resolveActor.mockRejectedValueOnce(new Error('Status 401'))
    const { fn } = buildRouter()
    const res = makeRes()
    await fn(makeReq('GET'), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(401)
    expect(parseBody(res).code).toBe('UNAUTHORIZED')
  })

  it('returns 503 when resolveActor throws a generic error', async () => {
    resolveActor.mockRejectedValueOnce(new Error('DB connection lost'))
    const { fn } = buildRouter()
    const res = makeRes()
    await fn(makeReq('GET'), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(503)
    expect(parseBody(res).code).toBe('STORAGE_UNAVAILABLE')
  })

  it('returns 401 when stackAuthEnabled and no userId resolved', async () => {
    resolveActor.mockResolvedValueOnce(null)
    actorRole.mockReturnValueOnce(null)
    sanitizeStackUserId.mockReturnValueOnce(null)

    const { fn } = buildRouter({}, true /* stackAuthEnabled */)
    const res = makeRes()
    await fn(makeReq('GET'), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(401)
    expect(parseBody(res).code).toBe('UNAUTHORIZED')
  })

  it('returns 403 when stackAuthEnabled and userId exists but no role resolved', async () => {
    resolveActor.mockResolvedValueOnce({ userId: 'user-abc', isAdmin: false, isComercial: false, isOffice: false, isFinanceiro: false, hasAnyRole: false })
    actorRole.mockReturnValueOnce(null)
    sanitizeStackUserId.mockReturnValueOnce('user-abc')
    getStackUser.mockResolvedValueOnce({ payload: { sub: 'user-abc' } })

    const { fn } = buildRouter({}, true /* stackAuthEnabled */)
    const res = makeRes()
    await fn(makeReq('GET'), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(403)
    expect(parseBody(res).code).toBe('FORBIDDEN')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('OPTIONS /api/storage', () => {
  it('returns 204 with Allow header', async () => {
    const { fn } = buildRouter()
    const res = makeRes()
    await fn(makeReq('OPTIONS'), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,PUT,DELETE,OPTIONS')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /api/storage
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/storage', () => {
  it('returns 200 with entries array on success', async () => {
    const entries = [
      { key: 'solarinvest-active-page', value: { page: 'dashboard' } },
      { key: 'solarinvest:leasing-form:v2', value: null },
    ]
    const { fn, mockStorage } = buildRouter()
    mockStorage.listEntries.mockResolvedValueOnce(entries)

    const res = makeRes()
    await fn(makeReq('GET'), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.entries).toEqual(entries)
  })

  it('returns 200 with empty entries array when no data', async () => {
    const { fn } = buildRouter()
    const res = makeRes()
    await fn(makeReq('GET'), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(200)
    expect(parseBody(res).entries).toEqual([])
  })

  it('calls listEntries with resolved userId and userRole', async () => {
    actorRole.mockReturnValueOnce('role_comercial')
    resolveActor.mockResolvedValueOnce({ userId: 'u-999', isComercial: true })
    const { fn, mockStorage } = buildRouter()

    const res = makeRes()
    await fn(makeReq('GET'), res, { requestId: 'r1' })

    expect(mockStorage.listEntries).toHaveBeenCalledWith({ userId: 'u-999', userRole: 'role_comercial' })
  })

  it('returns 503 STORAGE_UNAVAILABLE when listEntries throws', async () => {
    const { fn, mockStorage } = buildRouter()
    mockStorage.listEntries.mockRejectedValueOnce(new Error('DB timeout'))

    const res = makeRes()
    await fn(makeReq('GET'), res, { requestId: 'req-42' })

    expect(res.statusCode).toBe(503)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(body.code).toBe('STORAGE_UNAVAILABLE')
    expect(body.requestId).toBe('req-42')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUT / POST /api/storage
// ─────────────────────────────────────────────────────────────────────────────

describe.each(['PUT', 'POST'])('%s /api/storage', (method) => {
  it('returns 204 on success', async () => {
    const { router, sendJson, sendNoContent } = buildRouter({ _body: { key: 'my-key', value: { x: 1 } } })
    const fn = router.match(method, '/api/storage')

    const res = makeRes()
    await fn(makeReq(method), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(204)
  })

  it('calls setEntry with correct context, key, value', async () => {
    const { router, mockStorage } = buildRouter({ _body: { key: 'solarinvest-active-page', value: 42 } })
    actorRole.mockReturnValueOnce('role_office')
    resolveActor.mockResolvedValueOnce({ userId: 'u-x', isOffice: true })
    const fn = router.match(method, '/api/storage')

    const res = makeRes()
    await fn(makeReq(method), res, { requestId: 'r1' })

    expect(mockStorage.setEntry).toHaveBeenCalledWith(
      { userId: 'u-x', userRole: 'role_office' },
      'solarinvest-active-page',
      42,
    )
  })

  it('returns 400 VALIDATION_ERROR when key is absent', async () => {
    const { router } = buildRouter({ _body: { value: 'x' } })
    const fn = router.match(method, '/api/storage')

    const res = makeRes()
    await fn(makeReq(method), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(400)
    expect(parseBody(res).code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR when key is empty string', async () => {
    const { router } = buildRouter({ _body: { key: '   ', value: 1 } })
    const fn = router.match(method, '/api/storage')

    const res = makeRes()
    await fn(makeReq(method), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(400)
    expect(parseBody(res).code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 INVALID_JSON when readJsonBody throws INVALID_JSON', async () => {
    const router = createRouter()
    const sendJson = makeSendJson()
    const errJson = new Error('bad json')
    errJson.code = 'INVALID_JSON'
    const readJsonBody = vi.fn().mockRejectedValueOnce(errJson)
    registerStorageRoutes(router, {
      storageService: { listEntries: vi.fn(), setEntry: vi.fn(), removeEntry: vi.fn(), clear: vi.fn() },
      stackAuthEnabled: false,
      sendJson,
      sendNoContent: makeSendNoContent(),
      readJsonBody,
    })

    const fn = router.match(method, '/api/storage')
    const res = makeRes()
    await fn(makeReq(method), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(400)
    expect(parseBody(res).code).toBe('INVALID_JSON')
  })

  it('returns 413 PAYLOAD_TOO_LARGE when readJsonBody throws PAYLOAD_TOO_LARGE', async () => {
    const router = createRouter()
    const sendJson = makeSendJson()
    const errBig = new Error('too large')
    errBig.code = 'PAYLOAD_TOO_LARGE'
    const readJsonBody = vi.fn().mockRejectedValueOnce(errBig)
    registerStorageRoutes(router, {
      storageService: { listEntries: vi.fn(), setEntry: vi.fn(), removeEntry: vi.fn(), clear: vi.fn() },
      stackAuthEnabled: false,
      sendJson,
      sendNoContent: makeSendNoContent(),
      readJsonBody,
    })

    const fn = router.match(method, '/api/storage')
    const res = makeRes()
    await fn(makeReq(method), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(413)
    expect(parseBody(res).code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('returns 413 PAYLOAD_TOO_LARGE when setEntry throws STORAGE_PAYLOAD_TOO_LARGE', async () => {
    const router = createRouter()
    const sendJson = makeSendJson()
    const errStorage = new Error('too large')
    errStorage.code = 'STORAGE_PAYLOAD_TOO_LARGE'
    const mockStorage = {
      listEntries: vi.fn(),
      setEntry: vi.fn().mockRejectedValueOnce(errStorage),
      removeEntry: vi.fn(),
      clear: vi.fn(),
    }
    registerStorageRoutes(router, {
      storageService: mockStorage,
      stackAuthEnabled: false,
      sendJson,
      sendNoContent: makeSendNoContent(),
      readJsonBody: makeReadJsonBody({ key: 'k', value: 'v' }),
    })

    const fn = router.match(method, '/api/storage')
    const res = makeRes()
    await fn(makeReq(method), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(413)
    expect(parseBody(res).code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('returns 503 STORAGE_UNAVAILABLE when setEntry throws a generic error', async () => {
    const { router, mockStorage } = buildRouter({ _body: { key: 'k', value: 'v' } })
    mockStorage.setEntry.mockRejectedValueOnce(new Error('Network error'))
    const fn = router.match(method, '/api/storage')

    const res = makeRes()
    await fn(makeReq(method), res, { requestId: 'req-77' })

    expect(res.statusCode).toBe(503)
    const body = parseBody(res)
    expect(body.code).toBe('STORAGE_UNAVAILABLE')
    expect(body.requestId).toBe('req-77')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. DELETE /api/storage
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/storage', () => {
  it('calls clear() and returns 204 when no key is provided', async () => {
    const { fn, mockStorage } = buildRouter()
    const res = makeRes()
    await fn(makeReq('DELETE'), res, { requestId: 'r1' })

    expect(mockStorage.clear).toHaveBeenCalledOnce()
    expect(mockStorage.removeEntry).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(204)
  })

  it('calls removeEntry() and returns 204 when a key is provided', async () => {
    const { router, mockStorage } = buildRouter({ _body: { key: 'solarinvest-active-page' } })
    const fn = router.match('DELETE', '/api/storage')

    const res = makeRes()
    await fn(makeReq('DELETE'), res, { requestId: 'r1' })

    expect(mockStorage.removeEntry).toHaveBeenCalledWith(
      expect.objectContaining({ userId: expect.any(String) }),
      'solarinvest-active-page',
    )
    expect(mockStorage.clear).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(204)
  })

  it('returns 400 INVALID_JSON when readJsonBody throws INVALID_JSON', async () => {
    const router = createRouter()
    const sendJson = makeSendJson()
    const errJson = new Error('bad json')
    errJson.code = 'INVALID_JSON'
    registerStorageRoutes(router, {
      storageService: { listEntries: vi.fn(), setEntry: vi.fn(), removeEntry: vi.fn(), clear: vi.fn() },
      stackAuthEnabled: false,
      sendJson,
      sendNoContent: makeSendNoContent(),
      readJsonBody: vi.fn().mockRejectedValueOnce(errJson),
    })

    const fn = router.match('DELETE', '/api/storage')
    const res = makeRes()
    await fn(makeReq('DELETE'), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(400)
    expect(parseBody(res).code).toBe('INVALID_JSON')
  })

  it('returns 413 PAYLOAD_TOO_LARGE when readJsonBody throws PAYLOAD_TOO_LARGE', async () => {
    const router = createRouter()
    const sendJson = makeSendJson()
    const errBig = new Error('too large')
    errBig.code = 'PAYLOAD_TOO_LARGE'
    registerStorageRoutes(router, {
      storageService: { listEntries: vi.fn(), setEntry: vi.fn(), removeEntry: vi.fn(), clear: vi.fn() },
      stackAuthEnabled: false,
      sendJson,
      sendNoContent: makeSendNoContent(),
      readJsonBody: vi.fn().mockRejectedValueOnce(errBig),
    })

    const fn = router.match('DELETE', '/api/storage')
    const res = makeRes()
    await fn(makeReq('DELETE'), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(413)
    expect(parseBody(res).code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('returns 503 STORAGE_UNAVAILABLE when clear throws', async () => {
    const { fn, mockStorage } = buildRouter()
    mockStorage.clear.mockRejectedValueOnce(new Error('DB gone'))

    const res = makeRes()
    await fn(makeReq('DELETE'), res, { requestId: 'req-del' })

    expect(res.statusCode).toBe(503)
    const body = parseBody(res)
    expect(body.code).toBe('STORAGE_UNAVAILABLE')
    expect(body.requestId).toBe('req-del')
  })

  it('returns 503 STORAGE_UNAVAILABLE when removeEntry throws', async () => {
    const { router, mockStorage } = buildRouter({ _body: { key: 'some-key' } })
    mockStorage.removeEntry.mockRejectedValueOnce(new Error('DB gone'))
    const fn = router.match('DELETE', '/api/storage')

    const res = makeRes()
    await fn(makeReq('DELETE'), res, { requestId: 'req-del2' })

    expect(res.statusCode).toBe(503)
    expect(parseBody(res).code).toBe('STORAGE_UNAVAILABLE')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Unsupported method
// ─────────────────────────────────────────────────────────────────────────────

describe('unsupported method', () => {
  it('returns 405 METHOD_NOT_ALLOWED for PATCH', async () => {
    const { fn } = buildRouter()
    const res = makeRes()
    await fn(makeReq('PATCH'), res, { requestId: 'r1' })

    expect(res.statusCode).toBe(405)
    expect(parseBody(res).code).toBe('METHOD_NOT_ALLOWED')
  })
})
