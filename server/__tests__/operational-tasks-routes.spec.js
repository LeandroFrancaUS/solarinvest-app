// server/__tests__/operational-tasks-routes.spec.js
//
// Route-registration, OPTIONS pre-flight, method-guard, and params tests
// for registerOperationalTasksRoutes (PR 20).
//
// Covers:
//   GET|POST  /api/operational-tasks
//   PATCH|DEL /api/operational-tasks/:taskId
//   GET       /api/operational-tasks/:taskId/history
//   GET|POST  /api/dashboard/notification-preferences
//
// No live DB required — all domain handlers are mocked.
//
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerOperationalTasksRoutes } from '../routes/operationalTasks.js'

vi.mock('../operational-tasks/handler.js', () => ({
  handleOperationalTasksListRequest: vi.fn().mockResolvedValue(undefined),
  handleOperationalTasksCreateRequest: vi.fn().mockResolvedValue(undefined),
  handleOperationalTasksUpdateRequest: vi.fn().mockResolvedValue(undefined),
  handleOperationalTasksDeleteRequest: vi.fn().mockResolvedValue(undefined),
  handleTaskHistoryRequest: vi.fn().mockResolvedValue(undefined),
  handleNotificationPreferencesGetRequest: vi.fn().mockResolvedValue(undefined),
  handleNotificationPreferencesUpdateRequest: vi.fn().mockResolvedValue(undefined),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeRes() {
  const headers = {}
  return {
    statusCode: null,
    _body: null,
    headers,
    ended: false,
    setHeader(name, value) { headers[name] = value },
    end(body) { this._body = body; this.ended = true },
  }
}

function makeReq(method, url = '/') {
  return { method, url, headers: {}, readable: false }
}

function makeReqCtx(params = {}) {
  return { requestId: 'test', vercelId: undefined, params }
}

function makeModuleCtx() {
  return { readJsonBody: vi.fn().mockResolvedValue({}) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────────────────────────────────────

describe('registerOperationalTasksRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerOperationalTasksRoutes(router, makeModuleCtx())
  })

  it('registers GET /api/operational-tasks', () => {
    expect(router.match('GET', '/api/operational-tasks')).toBeTypeOf('function')
  })

  it('registers POST /api/operational-tasks', () => {
    expect(router.match('POST', '/api/operational-tasks')).toBeTypeOf('function')
  })

  it('registers PATCH /api/operational-tasks/:taskId', () => {
    expect(router.match('PATCH', '/api/operational-tasks/5')).toBeTypeOf('function')
  })

  it('registers DELETE /api/operational-tasks/:taskId', () => {
    expect(router.match('DELETE', '/api/operational-tasks/5')).toBeTypeOf('function')
  })

  it('registers GET /api/operational-tasks/:taskId/history', () => {
    expect(router.match('GET', '/api/operational-tasks/5/history')).toBeTypeOf('function')
  })

  it('registers GET /api/dashboard/notification-preferences', () => {
    expect(router.match('GET', '/api/dashboard/notification-preferences')).toBeTypeOf('function')
  })

  it('registers POST /api/dashboard/notification-preferences', () => {
    expect(router.match('POST', '/api/dashboard/notification-preferences')).toBeTypeOf('function')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS pre-flight
// ─────────────────────────────────────────────────────────────────────────────

describe('registerOperationalTasksRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerOperationalTasksRoutes(router, makeModuleCtx())
  })

  it('/api/operational-tasks OPTIONS → 204 Allow: GET,POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/operational-tasks')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/operational-tasks'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,OPTIONS')
  })

  it('/api/operational-tasks/:taskId OPTIONS → 204 Allow: PATCH,DELETE,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/operational-tasks/3')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/operational-tasks/3'), res, makeReqCtx({ taskId: '3' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PATCH,DELETE,OPTIONS')
  })

  it('/api/operational-tasks/:taskId/history OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/operational-tasks/3/history')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/operational-tasks/3/history'), res, makeReqCtx({ taskId: '3' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/dashboard/notification-preferences OPTIONS → 204 Allow: GET,POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/dashboard/notification-preferences')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/dashboard/notification-preferences'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,OPTIONS')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Method guards
// ─────────────────────────────────────────────────────────────────────────────

describe('registerOperationalTasksRoutes — method guards', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerOperationalTasksRoutes(router, makeModuleCtx())
  })

  it('/api/operational-tasks DELETE → 405', async () => {
    const fn = router.match('DELETE', '/api/operational-tasks')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/operational-tasks'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/operational-tasks/:taskId GET → 405 (only PATCH,DELETE)', async () => {
    const fn = router.match('GET', '/api/operational-tasks/5')
    const res = makeRes()
    await fn(makeReq('GET', '/api/operational-tasks/5'), res, makeReqCtx({ taskId: '5' }))
    expect(res.statusCode).toBe(405)
  })

  it('/api/operational-tasks/:taskId/history POST → 405', async () => {
    const fn = router.match('POST', '/api/operational-tasks/5/history')
    const res = makeRes()
    await fn(makeReq('POST', '/api/operational-tasks/5/history'), res, makeReqCtx({ taskId: '5' }))
    expect(res.statusCode).toBe(405)
  })

  it('/api/dashboard/notification-preferences DELETE → 405', async () => {
    const fn = router.match('DELETE', '/api/dashboard/notification-preferences')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/dashboard/notification-preferences'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Non-numeric taskId guard
// ─────────────────────────────────────────────────────────────────────────────

describe('registerOperationalTasksRoutes — taskId validation', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerOperationalTasksRoutes(router, makeModuleCtx())
  })

  it('/api/operational-tasks/abc → 404 (non-numeric)', async () => {
    const fn = router.match('PATCH', '/api/operational-tasks/abc')
    const res = makeRes()
    await fn(makeReq('PATCH', '/api/operational-tasks/abc'), res, makeReqCtx({ taskId: 'abc' }))
    expect(res.statusCode).toBe(404)
  })

  it('/api/operational-tasks/0 → 404 (zero not valid)', async () => {
    const fn = router.match('PATCH', '/api/operational-tasks/0')
    const res = makeRes()
    await fn(makeReq('PATCH', '/api/operational-tasks/0'), res, makeReqCtx({ taskId: '0' }))
    expect(res.statusCode).toBe(404)
  })

  it('/api/operational-tasks/abc/history → 404 (non-numeric)', async () => {
    const fn = router.match('GET', '/api/operational-tasks/abc/history')
    const res = makeRes()
    await fn(makeReq('GET', '/api/operational-tasks/abc/history'), res, makeReqCtx({ taskId: 'abc' }))
    expect(res.statusCode).toBe(404)
  })
})
