// server/__tests__/proposals-routes.spec.js
//
// Route-registration, OPTIONS pre-flight, method-guard, and params tests
// for registerProposalsRoutes (PR 21).
//
// Covers:
//   GET|POST         /api/proposals
//   GET|PATCH|DELETE /api/proposals/:id
//
// No live DB required — all domain handlers are mocked.
//
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerProposalsRoutes } from '../routes/proposals.js'

vi.mock('../proposals/handler.js', () => ({
  handleProposalsRequest: vi.fn().mockResolvedValue(undefined),
  handleProposalByIdRequest: vi.fn().mockResolvedValue(undefined),
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

describe('registerProposalsRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerProposalsRoutes(router, makeModuleCtx())
  })

  it('registers GET /api/proposals', () => {
    expect(router.match('GET', '/api/proposals')).toBeTypeOf('function')
  })

  it('registers POST /api/proposals', () => {
    expect(router.match('POST', '/api/proposals')).toBeTypeOf('function')
  })

  it('registers GET /api/proposals/:id', () => {
    expect(router.match('GET', '/api/proposals/abc-123')).toBeTypeOf('function')
  })

  it('registers PATCH /api/proposals/:id', () => {
    expect(router.match('PATCH', '/api/proposals/abc-123')).toBeTypeOf('function')
  })

  it('registers DELETE /api/proposals/:id', () => {
    expect(router.match('DELETE', '/api/proposals/abc-123')).toBeTypeOf('function')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS pre-flight
// ─────────────────────────────────────────────────────────────────────────────

describe('registerProposalsRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerProposalsRoutes(router, makeModuleCtx())
  })

  it('/api/proposals OPTIONS → 204 Allow: GET,POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/proposals')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/proposals'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,OPTIONS')
  })

  it('/api/proposals/:id OPTIONS → 204 Allow: GET,PATCH,DELETE,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/proposals/abc-123')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/proposals/abc-123'), res, makeReqCtx({ id: 'abc-123' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,PATCH,DELETE,OPTIONS')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Method guards
// ─────────────────────────────────────────────────────────────────────────────

describe('registerProposalsRoutes — method guards', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerProposalsRoutes(router, makeModuleCtx())
  })

  it('/api/proposals/:id PUT → 405', async () => {
    const fn = router.match('PUT', '/api/proposals/abc-123')
    const res = makeRes()
    await fn(makeReq('PUT', '/api/proposals/abc-123'), res, makeReqCtx({ id: 'abc-123' }))
    expect(res.statusCode).toBe(405)
  })

  it('/api/proposals/:id POST → 405', async () => {
    const fn = router.match('POST', '/api/proposals/abc-123')
    const res = makeRes()
    await fn(makeReq('POST', '/api/proposals/abc-123'), res, makeReqCtx({ id: 'abc-123' }))
    expect(res.statusCode).toBe(405)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Params extraction and handler dispatch
// ─────────────────────────────────────────────────────────────────────────────

describe('registerProposalsRoutes — params and handler dispatch', () => {
  let router
  let handleProposalByIdRequestMock
  let handleProposalsRequestMock

  beforeEach(async () => {
    router = createRouter()
    registerProposalsRoutes(router, makeModuleCtx())
    const proposalsMod = await import('../proposals/handler.js')
    handleProposalByIdRequestMock = proposalsMod.handleProposalByIdRequest
    handleProposalsRequestMock = proposalsMod.handleProposalsRequest
    vi.clearAllMocks()
    handleProposalByIdRequestMock.mockResolvedValue(undefined)
    handleProposalsRequestMock.mockResolvedValue(undefined)
  })

  it('passes proposalId from /api/proposals/:id', async () => {
    const fn = router.match('GET', '/api/proposals/uuid-abc-def')
    const res = makeRes()
    await fn(makeReq('GET', '/api/proposals/uuid-abc-def'), res, makeReqCtx({ id: 'uuid-abc-def' }))
    expect(handleProposalByIdRequestMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ proposalId: 'uuid-abc-def' }),
    )
  })

  it('passes a URL object as requestUrl to handleProposalsRequest', async () => {
    const fn = router.match('GET', '/api/proposals')
    const res = makeRes()
    await fn(makeReq('GET', '/api/proposals?page=1'), res, makeReqCtx())
    expect(handleProposalsRequestMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ requestUrl: expect.objectContaining({ pathname: '/api/proposals' }) }),
    )
  })

  it('passes jsonResponse (3-arg) as sendJson to proposal handlers', async () => {
    const fn = router.match('GET', '/api/proposals/abc')
    const res = makeRes()
    await fn(makeReq('GET', '/api/proposals/abc'), res, makeReqCtx({ id: 'abc' }))
    const call = handleProposalByIdRequestMock.mock.calls[0]
    const ctx = call[2]
    expect(typeof ctx.sendJson).toBe('function')
    expect(ctx.sendJson.length).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Smoke tests — proposals list, proposal by id
// ─────────────────────────────────────────────────────────────────────────────

describe('registerProposalsRoutes — smoke tests', () => {
  let router
  let handleProposalsRequestMock
  let handleProposalByIdRequestMock

  beforeEach(async () => {
    router = createRouter()
    registerProposalsRoutes(router, makeModuleCtx())
    const proposalsMod = await import('../proposals/handler.js')
    handleProposalsRequestMock = proposalsMod.handleProposalsRequest
    handleProposalByIdRequestMock = proposalsMod.handleProposalByIdRequest
    vi.clearAllMocks()
    handleProposalsRequestMock.mockResolvedValue(undefined)
    handleProposalByIdRequestMock.mockResolvedValue(undefined)
  })

  it('GET /api/proposals dispatches to handleProposalsRequest', async () => {
    const fn = router.match('GET', '/api/proposals')
    const res = makeRes()
    await fn(makeReq('GET', '/api/proposals'), res, makeReqCtx())
    expect(handleProposalsRequestMock).toHaveBeenCalledOnce()
  })

  it('POST /api/proposals dispatches to handleProposalsRequest', async () => {
    const fn = router.match('POST', '/api/proposals')
    const res = makeRes()
    await fn(makeReq('POST', '/api/proposals'), res, makeReqCtx())
    expect(handleProposalsRequestMock).toHaveBeenCalledOnce()
  })

  it('GET /api/proposals/:id dispatches to handleProposalByIdRequest', async () => {
    const fn = router.match('GET', '/api/proposals/some-uuid')
    const res = makeRes()
    await fn(makeReq('GET', '/api/proposals/some-uuid'), res, makeReqCtx({ id: 'some-uuid' }))
    expect(handleProposalByIdRequestMock).toHaveBeenCalledOnce()
  })

  it('PATCH /api/proposals/:id dispatches to handleProposalByIdRequest', async () => {
    const fn = router.match('PATCH', '/api/proposals/some-uuid')
    const res = makeRes()
    await fn(makeReq('PATCH', '/api/proposals/some-uuid'), res, makeReqCtx({ id: 'some-uuid' }))
    expect(handleProposalByIdRequestMock).toHaveBeenCalledOnce()
  })

  it('DELETE /api/proposals/:id dispatches to handleProposalByIdRequest', async () => {
    const fn = router.match('DELETE', '/api/proposals/some-uuid')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/proposals/some-uuid'), res, makeReqCtx({ id: 'some-uuid' }))
    expect(handleProposalByIdRequestMock).toHaveBeenCalledOnce()
  })
})
