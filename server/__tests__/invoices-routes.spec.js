// server/__tests__/invoices-routes.spec.js
//
// Route-registration, OPTIONS pre-flight, method-guard, and params tests
// for registerInvoicesRoutes (PR 20).
//
// Covers:
//   GET|POST  /api/invoices
//   GET       /api/invoices/notifications
//   GET|POST  /api/invoices/notification-config
//   PATCH|DEL /api/invoices/:invoiceId
//   POST      /api/invoices/:invoiceId/payment
//
// No live DB required — all domain handlers are mocked.
//
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerInvoicesRoutes } from '../routes/invoices.js'

vi.mock('../invoices/handler.js', () => ({
  handleInvoicesListRequest: vi.fn().mockResolvedValue(undefined),
  handleInvoicesCreateRequest: vi.fn().mockResolvedValue(undefined),
  handleInvoicesUpdateRequest: vi.fn().mockResolvedValue(undefined),
  handleInvoicesDeleteRequest: vi.fn().mockResolvedValue(undefined),
  handleInvoicePaymentRequest: vi.fn().mockResolvedValue(undefined),
  handleInvoiceNotificationsRequest: vi.fn().mockResolvedValue(undefined),
  handleInvoiceNotificationConfigGetRequest: vi.fn().mockResolvedValue(undefined),
  handleInvoiceNotificationConfigUpdateRequest: vi.fn().mockResolvedValue(undefined),
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

describe('registerInvoicesRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerInvoicesRoutes(router, makeModuleCtx())
  })

  it('registers GET /api/invoices', () => {
    expect(router.match('GET', '/api/invoices')).toBeTypeOf('function')
  })

  it('registers POST /api/invoices', () => {
    expect(router.match('POST', '/api/invoices')).toBeTypeOf('function')
  })

  it('registers GET /api/invoices/notifications', () => {
    expect(router.match('GET', '/api/invoices/notifications')).toBeTypeOf('function')
  })

  it('registers GET /api/invoices/notification-config', () => {
    expect(router.match('GET', '/api/invoices/notification-config')).toBeTypeOf('function')
  })

  it('registers PATCH /api/invoices/:invoiceId', () => {
    expect(router.match('PATCH', '/api/invoices/5')).toBeTypeOf('function')
  })

  it('registers DELETE /api/invoices/:invoiceId', () => {
    expect(router.match('DELETE', '/api/invoices/5')).toBeTypeOf('function')
  })

  it('registers POST /api/invoices/:invoiceId/payment', () => {
    expect(router.match('POST', '/api/invoices/5/payment')).toBeTypeOf('function')
  })

  it('exact /api/invoices/notifications is not shadowed by /:invoiceId', () => {
    expect(router.match('GET', '/api/invoices/notifications')).toBeTypeOf('function')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS pre-flight
// ─────────────────────────────────────────────────────────────────────────────

describe('registerInvoicesRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerInvoicesRoutes(router, makeModuleCtx())
  })

  it('/api/invoices OPTIONS → 204 Allow: GET,POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/invoices')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/invoices'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,OPTIONS')
  })

  it('/api/invoices/notifications OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/invoices/notifications')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/invoices/notifications'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/invoices/notification-config OPTIONS → 204 Allow: GET,POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/invoices/notification-config')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/invoices/notification-config'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,OPTIONS')
  })

  it('/api/invoices/:invoiceId OPTIONS → 204 Allow: PATCH,DELETE,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/invoices/7')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/invoices/7'), res, makeReqCtx({ invoiceId: '7' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PATCH,DELETE,OPTIONS')
  })

  it('/api/invoices/:invoiceId/payment OPTIONS → 204 Allow: POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/invoices/7/payment')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/invoices/7/payment'), res, makeReqCtx({ invoiceId: '7' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('POST,OPTIONS')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Method guards
// ─────────────────────────────────────────────────────────────────────────────

describe('registerInvoicesRoutes — method guards', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerInvoicesRoutes(router, makeModuleCtx())
  })

  it('/api/invoices DELETE → 405', async () => {
    const fn = router.match('DELETE', '/api/invoices')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/invoices'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/invoices/notifications POST → 405', async () => {
    const fn = router.match('POST', '/api/invoices/notifications')
    const res = makeRes()
    await fn(makeReq('POST', '/api/invoices/notifications'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/invoices/notification-config DELETE → 405', async () => {
    const fn = router.match('DELETE', '/api/invoices/notification-config')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/invoices/notification-config'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/invoices/:invoiceId GET → 405 (only PATCH,DELETE)', async () => {
    const fn = router.match('GET', '/api/invoices/5')
    const res = makeRes()
    await fn(makeReq('GET', '/api/invoices/5'), res, makeReqCtx({ invoiceId: '5' }))
    expect(res.statusCode).toBe(405)
  })

  it('/api/invoices/:invoiceId/payment GET → 405 (only POST)', async () => {
    const fn = router.match('GET', '/api/invoices/5/payment')
    const res = makeRes()
    await fn(makeReq('GET', '/api/invoices/5/payment'), res, makeReqCtx({ invoiceId: '5' }))
    expect(res.statusCode).toBe(405)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Non-numeric invoiceId guard
// ─────────────────────────────────────────────────────────────────────────────

describe('registerInvoicesRoutes — invoiceId validation', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerInvoicesRoutes(router, makeModuleCtx())
  })

  it('/api/invoices/abc → 404 (non-numeric)', async () => {
    const fn = router.match('PATCH', '/api/invoices/abc')
    const res = makeRes()
    await fn(makeReq('PATCH', '/api/invoices/abc'), res, makeReqCtx({ invoiceId: 'abc' }))
    expect(res.statusCode).toBe(404)
  })

  it('/api/invoices/0 → 404 (zero not valid)', async () => {
    const fn = router.match('PATCH', '/api/invoices/0')
    const res = makeRes()
    await fn(makeReq('PATCH', '/api/invoices/0'), res, makeReqCtx({ invoiceId: '0' }))
    expect(res.statusCode).toBe(404)
  })

  it('/api/invoices/abc/payment → 404 (non-numeric)', async () => {
    const fn = router.match('POST', '/api/invoices/abc/payment')
    const res = makeRes()
    await fn(makeReq('POST', '/api/invoices/abc/payment'), res, makeReqCtx({ invoiceId: 'abc' }))
    expect(res.statusCode).toBe(404)
  })
})
