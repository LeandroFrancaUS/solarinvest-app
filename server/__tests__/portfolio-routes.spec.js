// server/__tests__/portfolio-routes.spec.js
//
// Route-registration, OPTIONS pre-flight, method-guard, and params tests
// for registerPortfolioRoutes (PR 21).
//
// Covers:
//   PATCH      /api/clients/:clientId/portfolio-export
//   PATCH      /api/clients/:clientId/portfolio-remove
//   GET        /api/dashboard/portfolio/summary
//   GET        /api/client-portfolio
//   GET        /api/client-portfolio/:clientId
//   PATCH      /api/client-portfolio/:clientId/profile
//   PATCH      /api/client-portfolio/:clientId/contract
//   PATCH      /api/client-portfolio/:clientId/project
//   PATCH      /api/client-portfolio/:clientId/billing
//   PATCH      /api/client-portfolio/:clientId/plan
//   GET|POST   /api/client-portfolio/:clientId/notes
//
// No live DB required — all domain handlers are mocked.
//
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerPortfolioRoutes } from '../routes/portfolio.js'

vi.mock('../client-portfolio/handler.js', () => ({
  handlePortfolioListRequest: vi.fn().mockResolvedValue(undefined),
  handlePortfolioGetRequest: vi.fn().mockResolvedValue(undefined),
  handlePortfolioExportRequest: vi.fn().mockResolvedValue(undefined),
  handlePortfolioRemoveRequest: vi.fn().mockResolvedValue(undefined),
  handlePortfolioProfilePatch: vi.fn().mockResolvedValue(undefined),
  handlePortfolioContractPatch: vi.fn().mockResolvedValue(undefined),
  handlePortfolioProjectPatch: vi.fn().mockResolvedValue(undefined),
  handlePortfolioBillingPatch: vi.fn().mockResolvedValue(undefined),
  handlePortfolioPlanPatch: vi.fn().mockResolvedValue(undefined),
  handlePortfolioNotesRequest: vi.fn().mockResolvedValue(undefined),
  handleDashboardPortfolioSummary: vi.fn().mockResolvedValue(undefined),
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

describe('registerPortfolioRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerPortfolioRoutes(router, makeModuleCtx())
  })

  it('registers PATCH /api/clients/:clientId/portfolio-export', () => {
    expect(router.match('PATCH', '/api/clients/1/portfolio-export')).toBeTypeOf('function')
  })

  it('registers PATCH /api/clients/:clientId/portfolio-remove', () => {
    expect(router.match('PATCH', '/api/clients/1/portfolio-remove')).toBeTypeOf('function')
  })

  it('registers GET /api/dashboard/portfolio/summary', () => {
    expect(router.match('GET', '/api/dashboard/portfolio/summary')).toBeTypeOf('function')
  })

  it('registers GET /api/client-portfolio', () => {
    expect(router.match('GET', '/api/client-portfolio')).toBeTypeOf('function')
  })

  it('registers GET /api/client-portfolio/:clientId', () => {
    expect(router.match('GET', '/api/client-portfolio/5')).toBeTypeOf('function')
  })

  it('registers PATCH /api/client-portfolio/:clientId/profile', () => {
    expect(router.match('PATCH', '/api/client-portfolio/5/profile')).toBeTypeOf('function')
  })

  it('registers PATCH /api/client-portfolio/:clientId/contract', () => {
    expect(router.match('PATCH', '/api/client-portfolio/5/contract')).toBeTypeOf('function')
  })

  it('registers PATCH /api/client-portfolio/:clientId/project', () => {
    expect(router.match('PATCH', '/api/client-portfolio/5/project')).toBeTypeOf('function')
  })

  it('registers PATCH /api/client-portfolio/:clientId/billing', () => {
    expect(router.match('PATCH', '/api/client-portfolio/5/billing')).toBeTypeOf('function')
  })

  it('registers PATCH /api/client-portfolio/:clientId/plan', () => {
    expect(router.match('PATCH', '/api/client-portfolio/5/plan')).toBeTypeOf('function')
  })

  it('registers GET /api/client-portfolio/:clientId/notes', () => {
    expect(router.match('GET', '/api/client-portfolio/5/notes')).toBeTypeOf('function')
  })

  it('registers POST /api/client-portfolio/:clientId/notes', () => {
    expect(router.match('POST', '/api/client-portfolio/5/notes')).toBeTypeOf('function')
  })

  it('/api/client-portfolio is not shadowed by /:clientId', () => {
    expect(router.match('GET', '/api/client-portfolio')).toBeTypeOf('function')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS pre-flight
// ─────────────────────────────────────────────────────────────────────────────

describe('registerPortfolioRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerPortfolioRoutes(router, makeModuleCtx())
  })

  it('/api/clients/:clientId/portfolio-export OPTIONS → 204 Allow: PATCH,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/clients/1/portfolio-export')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/clients/1/portfolio-export'), res, makeReqCtx({ clientId: '1' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PATCH,OPTIONS')
  })

  it('/api/clients/:clientId/portfolio-remove OPTIONS → 204 Allow: PATCH,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/clients/1/portfolio-remove')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/clients/1/portfolio-remove'), res, makeReqCtx({ clientId: '1' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PATCH,OPTIONS')
  })

  it('/api/dashboard/portfolio/summary OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/dashboard/portfolio/summary')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/dashboard/portfolio/summary'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/client-portfolio OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/client-portfolio')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/client-portfolio'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/client-portfolio/:clientId OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/client-portfolio/5')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/client-portfolio/5'), res, makeReqCtx({ clientId: '5' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/client-portfolio/:clientId/profile OPTIONS → 204 Allow: PATCH,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/client-portfolio/5/profile')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/client-portfolio/5/profile'), res, makeReqCtx({ clientId: '5' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PATCH,OPTIONS')
  })

  it('/api/client-portfolio/:clientId/billing OPTIONS → 204 Allow: PATCH,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/client-portfolio/5/billing')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/client-portfolio/5/billing'), res, makeReqCtx({ clientId: '5' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PATCH,OPTIONS')
  })

  it('/api/client-portfolio/:clientId/notes OPTIONS → 204 Allow: GET,POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/client-portfolio/5/notes')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/client-portfolio/5/notes'), res, makeReqCtx({ clientId: '5' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,OPTIONS')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Method guards
// ─────────────────────────────────────────────────────────────────────────────

describe('registerPortfolioRoutes — method guards', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerPortfolioRoutes(router, makeModuleCtx())
  })

  it('/api/clients/:clientId/portfolio-export GET → 405', async () => {
    const fn = router.match('GET', '/api/clients/1/portfolio-export')
    const res = makeRes()
    await fn(makeReq('GET', '/api/clients/1/portfolio-export'), res, makeReqCtx({ clientId: '1' }))
    expect(res.statusCode).toBe(405)
  })

  it('/api/dashboard/portfolio/summary POST → 405', async () => {
    const fn = router.match('POST', '/api/dashboard/portfolio/summary')
    const res = makeRes()
    await fn(makeReq('POST', '/api/dashboard/portfolio/summary'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/client-portfolio POST → 405', async () => {
    const fn = router.match('POST', '/api/client-portfolio')
    const res = makeRes()
    await fn(makeReq('POST', '/api/client-portfolio'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/client-portfolio/:clientId POST → 405', async () => {
    const fn = router.match('POST', '/api/client-portfolio/5')
    const res = makeRes()
    await fn(makeReq('POST', '/api/client-portfolio/5'), res, makeReqCtx({ clientId: '5' }))
    expect(res.statusCode).toBe(405)
  })

  it('/api/client-portfolio/:clientId/profile GET → 405', async () => {
    const fn = router.match('GET', '/api/client-portfolio/5/profile')
    const res = makeRes()
    await fn(makeReq('GET', '/api/client-portfolio/5/profile'), res, makeReqCtx({ clientId: '5' }))
    expect(res.statusCode).toBe(405)
  })

  it('/api/client-portfolio/:clientId/notes DELETE → 405', async () => {
    const fn = router.match('DELETE', '/api/client-portfolio/5/notes')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/client-portfolio/5/notes'), res, makeReqCtx({ clientId: '5' }))
    expect(res.statusCode).toBe(405)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Params extraction and handler dispatch
// ─────────────────────────────────────────────────────────────────────────────

describe('registerPortfolioRoutes — params and handler dispatch', () => {
  let router
  let handlePortfolioGetRequestMock
  let handlePortfolioExportRequestMock
  let handlePortfolioListRequestMock

  beforeEach(async () => {
    router = createRouter()
    registerPortfolioRoutes(router, makeModuleCtx())
    const portfolioMod = await import('../client-portfolio/handler.js')
    handlePortfolioGetRequestMock = portfolioMod.handlePortfolioGetRequest
    handlePortfolioExportRequestMock = portfolioMod.handlePortfolioExportRequest
    handlePortfolioListRequestMock = portfolioMod.handlePortfolioListRequest
    vi.clearAllMocks()
    handlePortfolioGetRequestMock.mockResolvedValue(undefined)
    handlePortfolioExportRequestMock.mockResolvedValue(undefined)
    handlePortfolioListRequestMock.mockResolvedValue(undefined)
  })

  it('converts clientId param to number for portfolio-export', async () => {
    const fn = router.match('PATCH', '/api/clients/7/portfolio-export')
    const res = makeRes()
    await fn(makeReq('PATCH', '/api/clients/7/portfolio-export'), res, makeReqCtx({ clientId: '7' }))
    expect(handlePortfolioExportRequestMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ clientId: 7 }),
    )
  })

  it('converts clientId param to number for portfolio get', async () => {
    const fn = router.match('GET', '/api/client-portfolio/3')
    const res = makeRes()
    await fn(makeReq('GET', '/api/client-portfolio/3'), res, makeReqCtx({ clientId: '3' }))
    expect(handlePortfolioGetRequestMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ clientId: 3 }),
    )
  })

  it('passes requestUrl string to handlePortfolioListRequest', async () => {
    const fn = router.match('GET', '/api/client-portfolio')
    const res = makeRes()
    await fn(makeReq('GET', '/api/client-portfolio?search=foo'), res, makeReqCtx())
    expect(handlePortfolioListRequestMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ requestUrl: '/api/client-portfolio?search=foo' }),
    )
  })

  it('passes 2-arg sendJson closure to portfolio handlers', async () => {
    const fn = router.match('GET', '/api/client-portfolio/5')
    const res = makeRes()
    await fn(makeReq('GET', '/api/client-portfolio/5'), res, makeReqCtx({ clientId: '5' }))
    const call = handlePortfolioGetRequestMock.mock.calls[0]
    const ctx = call[2]
    // The sendJson passed should be a 2-arg closure (not jsonResponse directly)
    expect(typeof ctx.sendJson).toBe('function')
    expect(ctx.sendJson.length).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Smoke tests — portfolio list, portfolio detail
// ─────────────────────────────────────────────────────────────────────────────

describe('registerPortfolioRoutes — smoke tests', () => {
  let router
  let mocks

  beforeEach(async () => {
    router = createRouter()
    registerPortfolioRoutes(router, makeModuleCtx())
    const portfolioMod = await import('../client-portfolio/handler.js')
    mocks = portfolioMod
    vi.clearAllMocks()
    Object.values(mocks).forEach(m => { if (typeof m?.mockResolvedValue === 'function') m.mockResolvedValue(undefined) })
  })

  it('GET /api/client-portfolio dispatches to handlePortfolioListRequest', async () => {
    const fn = router.match('GET', '/api/client-portfolio')
    const res = makeRes()
    await fn(makeReq('GET', '/api/client-portfolio'), res, makeReqCtx())
    expect(mocks.handlePortfolioListRequest).toHaveBeenCalledOnce()
  })

  it('GET /api/client-portfolio/:clientId dispatches to handlePortfolioGetRequest', async () => {
    const fn = router.match('GET', '/api/client-portfolio/10')
    const res = makeRes()
    await fn(makeReq('GET', '/api/client-portfolio/10'), res, makeReqCtx({ clientId: '10' }))
    expect(mocks.handlePortfolioGetRequest).toHaveBeenCalledOnce()
  })

  it('PATCH /api/clients/:clientId/portfolio-export dispatches to handlePortfolioExportRequest', async () => {
    const fn = router.match('PATCH', '/api/clients/2/portfolio-export')
    const res = makeRes()
    await fn(makeReq('PATCH', '/api/clients/2/portfolio-export'), res, makeReqCtx({ clientId: '2' }))
    expect(mocks.handlePortfolioExportRequest).toHaveBeenCalledOnce()
  })

  it('PATCH /api/clients/:clientId/portfolio-remove dispatches to handlePortfolioRemoveRequest', async () => {
    const fn = router.match('PATCH', '/api/clients/2/portfolio-remove')
    const res = makeRes()
    await fn(makeReq('PATCH', '/api/clients/2/portfolio-remove'), res, makeReqCtx({ clientId: '2' }))
    expect(mocks.handlePortfolioRemoveRequest).toHaveBeenCalledOnce()
  })

  it('GET /api/dashboard/portfolio/summary dispatches to handleDashboardPortfolioSummary', async () => {
    const fn = router.match('GET', '/api/dashboard/portfolio/summary')
    const res = makeRes()
    await fn(makeReq('GET', '/api/dashboard/portfolio/summary'), res, makeReqCtx())
    expect(mocks.handleDashboardPortfolioSummary).toHaveBeenCalledOnce()
  })
})
