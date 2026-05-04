// server/__tests__/clients-routes.spec.js
//
// Route-registration, OPTIONS pre-flight, method-guard, and params tests
// for registerClientsRoutes (PR 21).
//
// Covers:
//   POST           /api/clients/upsert-by-cpf
//   POST           /api/clients/bulk-import/preview
//   POST           /api/clients/bulk-import
//   POST           /api/clients/consultor-backfill
//   GET|POST       /api/clients
//   GET            /api/clients/:id/proposals
//   GET|PUT|DELETE /api/clients/:id
//
// No live DB required — all domain handlers are mocked.
//
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerClientsRoutes } from '../routes/clients.js'

vi.mock('../clients/handler.js', () => ({
  handleUpsertClientByCpf: vi.fn().mockResolvedValue(undefined),
  handleClientsRequest: vi.fn().mockResolvedValue(undefined),
  handleClientByIdRequest: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../clients/bulkImport.js', () => ({
  handleBulkImportPreview: vi.fn().mockResolvedValue(undefined),
  handleBulkImport: vi.fn().mockResolvedValue(undefined),
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
    headersSent: false,
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

describe('registerClientsRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerClientsRoutes(router, makeModuleCtx())
  })

  it('registers POST /api/clients/upsert-by-cpf', () => {
    expect(router.match('POST', '/api/clients/upsert-by-cpf')).toBeTypeOf('function')
  })

  it('registers POST /api/clients/bulk-import/preview', () => {
    expect(router.match('POST', '/api/clients/bulk-import/preview')).toBeTypeOf('function')
  })

  it('registers POST /api/clients/bulk-import', () => {
    expect(router.match('POST', '/api/clients/bulk-import')).toBeTypeOf('function')
  })

  it('registers POST /api/clients/consultor-backfill', () => {
    expect(router.match('POST', '/api/clients/consultor-backfill')).toBeTypeOf('function')
  })

  it('registers GET /api/clients', () => {
    expect(router.match('GET', '/api/clients')).toBeTypeOf('function')
  })

  it('registers POST /api/clients', () => {
    expect(router.match('POST', '/api/clients')).toBeTypeOf('function')
  })

  it('registers GET /api/clients/:id', () => {
    expect(router.match('GET', '/api/clients/42')).toBeTypeOf('function')
  })

  it('registers PUT /api/clients/:id', () => {
    expect(router.match('PUT', '/api/clients/42')).toBeTypeOf('function')
  })

  it('registers DELETE /api/clients/:id', () => {
    expect(router.match('DELETE', '/api/clients/42')).toBeTypeOf('function')
  })

  it('registers GET /api/clients/:id/proposals', () => {
    expect(router.match('GET', '/api/clients/42/proposals')).toBeTypeOf('function')
  })

  it('exact /api/clients/upsert-by-cpf is not shadowed by /:id', () => {
    expect(router.match('POST', '/api/clients/upsert-by-cpf')).toBeTypeOf('function')
  })

  it('exact /api/clients/bulk-import is not shadowed by /:id', () => {
    expect(router.match('POST', '/api/clients/bulk-import')).toBeTypeOf('function')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS pre-flight
// ─────────────────────────────────────────────────────────────────────────────

describe('registerClientsRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerClientsRoutes(router, makeModuleCtx())
  })

  it('/api/clients/upsert-by-cpf OPTIONS → 204 Allow: POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/clients/upsert-by-cpf')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/clients/upsert-by-cpf'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('POST,OPTIONS')
  })

  it('/api/clients/bulk-import/preview OPTIONS → 204 Allow: POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/clients/bulk-import/preview')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/clients/bulk-import/preview'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('POST,OPTIONS')
  })

  it('/api/clients/bulk-import OPTIONS → 204 Allow: POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/clients/bulk-import')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/clients/bulk-import'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('POST,OPTIONS')
  })

  it('/api/clients/consultor-backfill OPTIONS → 204 Allow: POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/clients/consultor-backfill')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/clients/consultor-backfill'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('POST,OPTIONS')
  })

  it('/api/clients OPTIONS → 204 Allow: GET,POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/clients')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/clients'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,OPTIONS')
  })

  it('/api/clients/:id OPTIONS → 204 Allow: GET,PUT,DELETE,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/clients/42')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/clients/42'), res, makeReqCtx({ id: '42' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,PUT,DELETE,OPTIONS')
  })

  it('/api/clients/:id/proposals OPTIONS → 204 Allow: GET,PUT,DELETE,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/clients/42/proposals')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/clients/42/proposals'), res, makeReqCtx({ id: '42' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,PUT,DELETE,OPTIONS')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Method guards
// ─────────────────────────────────────────────────────────────────────────────

describe('registerClientsRoutes — method guards', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerClientsRoutes(router, makeModuleCtx())
  })

  it('/api/clients/upsert-by-cpf GET → 405', async () => {
    const fn = router.match('GET', '/api/clients/upsert-by-cpf')
    const res = makeRes()
    await fn(makeReq('GET', '/api/clients/upsert-by-cpf'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/clients/bulk-import/preview GET → 405', async () => {
    const fn = router.match('GET', '/api/clients/bulk-import/preview')
    const res = makeRes()
    await fn(makeReq('GET', '/api/clients/bulk-import/preview'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/clients/bulk-import GET → 405', async () => {
    const fn = router.match('GET', '/api/clients/bulk-import')
    const res = makeRes()
    await fn(makeReq('GET', '/api/clients/bulk-import'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/clients/consultor-backfill GET → 405', async () => {
    const fn = router.match('GET', '/api/clients/consultor-backfill')
    const res = makeRes()
    await fn(makeReq('GET', '/api/clients/consultor-backfill'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Params extraction and handler dispatch
// ─────────────────────────────────────────────────────────────────────────────

describe('registerClientsRoutes — params and handler dispatch', () => {
  let router
  let handleClientByIdRequestMock
  let handleClientsRequestMock

  beforeEach(async () => {
    router = createRouter()
    registerClientsRoutes(router, makeModuleCtx())
    const clientsMod = await import('../clients/handler.js')
    handleClientByIdRequestMock = clientsMod.handleClientByIdRequest
    handleClientsRequestMock = clientsMod.handleClientsRequest
    vi.clearAllMocks()
    handleClientByIdRequestMock.mockResolvedValue(undefined)
    handleClientsRequestMock.mockResolvedValue(undefined)
  })

  it('passes clientId string to handleClientByIdRequest for /api/clients/:id', async () => {
    const fn = router.match('GET', '/api/clients/99')
    const res = makeRes()
    await fn(makeReq('GET', '/api/clients/99'), res, makeReqCtx({ id: '99' }))
    expect(handleClientByIdRequestMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ clientId: '99', subpath: null }),
    )
  })

  it('passes subpath="proposals" for /api/clients/:id/proposals', async () => {
    const fn = router.match('GET', '/api/clients/99/proposals')
    const res = makeRes()
    await fn(makeReq('GET', '/api/clients/99/proposals'), res, makeReqCtx({ id: '99' }))
    expect(handleClientByIdRequestMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ clientId: '99', subpath: 'proposals' }),
    )
  })

  it('passes a URL object as requestUrl to handleClientsRequest for /api/clients', async () => {
    const fn = router.match('GET', '/api/clients')
    const res = makeRes()
    await fn(makeReq('GET', '/api/clients?page=2'), res, makeReqCtx())
    expect(handleClientsRequestMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ requestUrl: expect.objectContaining({ pathname: '/api/clients' }) }),
    )
  })

  it('passes jsonResponse (3-arg) as sendJson to client handlers', async () => {
    const fn = router.match('GET', '/api/clients/5')
    const res = makeRes()
    await fn(makeReq('GET', '/api/clients/5'), res, makeReqCtx({ id: '5' }))
    const call = handleClientByIdRequestMock.mock.calls[0]
    const ctx = call[2]
    // The sendJson passed should be the raw 3-arg jsonResponse function
    expect(typeof ctx.sendJson).toBe('function')
    expect(ctx.sendJson.length).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Smoke tests — clients list, client by id
// ─────────────────────────────────────────────────────────────────────────────

describe('registerClientsRoutes — smoke tests', () => {
  let router
  let handleClientsRequestMock
  let handleClientByIdRequestMock

  beforeEach(async () => {
    router = createRouter()
    registerClientsRoutes(router, makeModuleCtx())
    const clientsMod = await import('../clients/handler.js')
    handleClientsRequestMock = clientsMod.handleClientsRequest
    handleClientByIdRequestMock = clientsMod.handleClientByIdRequest
    vi.clearAllMocks()
    handleClientsRequestMock.mockResolvedValue(undefined)
    handleClientByIdRequestMock.mockResolvedValue(undefined)
  })

  it('GET /api/clients dispatches to handleClientsRequest', async () => {
    const fn = router.match('GET', '/api/clients')
    const res = makeRes()
    await fn(makeReq('GET', '/api/clients'), res, makeReqCtx())
    expect(handleClientsRequestMock).toHaveBeenCalledOnce()
  })

  it('POST /api/clients dispatches to handleClientsRequest', async () => {
    const fn = router.match('POST', '/api/clients')
    const res = makeRes()
    await fn(makeReq('POST', '/api/clients'), res, makeReqCtx())
    expect(handleClientsRequestMock).toHaveBeenCalledOnce()
  })

  it('GET /api/clients/42 dispatches to handleClientByIdRequest', async () => {
    const fn = router.match('GET', '/api/clients/42')
    const res = makeRes()
    await fn(makeReq('GET', '/api/clients/42'), res, makeReqCtx({ id: '42' }))
    expect(handleClientByIdRequestMock).toHaveBeenCalledOnce()
  })

  it('GET /api/clients/42/proposals dispatches to handleClientByIdRequest', async () => {
    const fn = router.match('GET', '/api/clients/42/proposals')
    const res = makeRes()
    await fn(makeReq('GET', '/api/clients/42/proposals'), res, makeReqCtx({ id: '42' }))
    expect(handleClientByIdRequestMock).toHaveBeenCalledOnce()
  })
})
