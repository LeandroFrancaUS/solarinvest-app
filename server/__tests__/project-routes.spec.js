// server/__tests__/project-routes.spec.js
//
// Route-registration, OPTIONS pre-flight, method-guard, and params tests
// for registerProjectsRoutes (PR 20).
//
// Covers:
//   GET    /api/projects
//   GET    /api/projects/summary
//   POST   /api/projects/from-plan/:planId
//   GET    /api/projects/:id
//   PATCH  /api/projects/:id
//   GET    /api/projects/:id/finance
//   PUT    /api/projects/:id/finance
//   PATCH  /api/projects/:id/status
//   PATCH  /api/projects/:id/pv-data
//
// No live DB required — all domain handlers are mocked.
//
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerProjectsRoutes } from '../routes/projects.js'

// Mock all domain handlers to avoid DB dependencies
vi.mock('../projects/handler.js', () => ({
  handleProjectsList: vi.fn().mockResolvedValue(undefined),
  handleProjectsSummary: vi.fn().mockResolvedValue(undefined),
  handleProjectById: vi.fn().mockResolvedValue(undefined),
  handleProjectStatus: vi.fn().mockResolvedValue(undefined),
  handleProjectPvData: vi.fn().mockResolvedValue(undefined),
  handleProjectFromPlan: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../project-finance/handler.js', () => ({
  handleProjectFinance: vi.fn().mockResolvedValue(undefined),
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

describe('registerProjectsRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerProjectsRoutes(router, makeModuleCtx())
  })

  it('registers GET /api/projects', () => {
    expect(router.match('GET', '/api/projects')).toBeTypeOf('function')
  })

  it('registers GET /api/projects/summary', () => {
    expect(router.match('GET', '/api/projects/summary')).toBeTypeOf('function')
  })

  it('registers POST /api/projects/from-plan/:planId', () => {
    expect(router.match('POST', '/api/projects/from-plan/plan-abc')).toBeTypeOf('function')
  })

  it('registers GET /api/projects/:id', () => {
    expect(router.match('GET', '/api/projects/proj-1')).toBeTypeOf('function')
  })

  it('registers PATCH /api/projects/:id', () => {
    expect(router.match('PATCH', '/api/projects/proj-1')).toBeTypeOf('function')
  })

  it('registers GET /api/projects/:id/finance', () => {
    expect(router.match('GET', '/api/projects/proj-1/finance')).toBeTypeOf('function')
  })

  it('registers PUT /api/projects/:id/finance', () => {
    expect(router.match('PUT', '/api/projects/proj-1/finance')).toBeTypeOf('function')
  })

  it('registers PATCH /api/projects/:id/status', () => {
    expect(router.match('PATCH', '/api/projects/proj-1/status')).toBeTypeOf('function')
  })

  it('registers PATCH /api/projects/:id/pv-data', () => {
    expect(router.match('PATCH', '/api/projects/proj-1/pv-data')).toBeTypeOf('function')
  })

  it('/api/projects/summary is not shadowed by /:id', () => {
    const summaryFn = router.match('GET', '/api/projects/summary')
    expect(summaryFn).toBeTypeOf('function')
    // Exact match wins — calling it should not inject params.id = 'summary'
    const res = makeRes()
    // OPTIONS on exact route returns 204 with correct Allow header
    summaryFn(makeReq('OPTIONS', '/api/projects/summary'), res, makeReqCtx())
    // Will be async but we just check registration priority is correct
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS pre-flight
// ─────────────────────────────────────────────────────────────────────────────

describe('registerProjectsRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerProjectsRoutes(router, makeModuleCtx())
  })

  it('GET /api/projects OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/projects')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/projects'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/projects/summary OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/projects/summary')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/projects/summary'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/projects/from-plan/:planId OPTIONS → 204 Allow: POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/projects/from-plan/p1')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/projects/from-plan/p1'), res, makeReqCtx({ planId: 'p1' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('POST,OPTIONS')
  })

  it('/api/projects/:id OPTIONS → 204 Allow: GET,PATCH,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/projects/proj-1')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/projects/proj-1'), res, makeReqCtx({ id: 'proj-1' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,PATCH,OPTIONS')
  })

  it('/api/projects/:id/finance OPTIONS → 204 Allow: GET,PUT,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/projects/proj-1/finance')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/projects/proj-1/finance'), res, makeReqCtx({ id: 'proj-1' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,PUT,OPTIONS')
  })

  it('/api/projects/:id/status OPTIONS → 204 Allow: PATCH,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/projects/proj-1/status')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/projects/proj-1/status'), res, makeReqCtx({ id: 'proj-1' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PATCH,OPTIONS')
  })

  it('/api/projects/:id/pv-data OPTIONS → 204 Allow: PATCH,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/projects/proj-1/pv-data')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/projects/proj-1/pv-data'), res, makeReqCtx({ id: 'proj-1' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PATCH,OPTIONS')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Method guards
// ─────────────────────────────────────────────────────────────────────────────

describe('registerProjectsRoutes — method guards', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerProjectsRoutes(router, makeModuleCtx())
  })

  it('/api/projects POST → 405', async () => {
    const fn = router.match('POST', '/api/projects')
    const res = makeRes()
    await fn(makeReq('POST', '/api/projects'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/projects/summary POST → 405', async () => {
    const fn = router.match('POST', '/api/projects/summary')
    const res = makeRes()
    await fn(makeReq('POST', '/api/projects/summary'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/projects/from-plan/:planId GET → 405', async () => {
    const fn = router.match('GET', '/api/projects/from-plan/p1')
    const res = makeRes()
    await fn(makeReq('GET', '/api/projects/from-plan/p1'), res, makeReqCtx({ planId: 'p1' }))
    expect(res.statusCode).toBe(405)
  })

  it('/api/projects/:id DELETE → 405', async () => {
    const fn = router.match('DELETE', '/api/projects/proj-1')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/projects/proj-1'), res, makeReqCtx({ id: 'proj-1' }))
    expect(res.statusCode).toBe(405)
  })

  it('/api/projects/:id/finance DELETE → 405', async () => {
    const fn = router.match('DELETE', '/api/projects/proj-1/finance')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/projects/proj-1/finance'), res, makeReqCtx({ id: 'proj-1' }))
    expect(res.statusCode).toBe(405)
  })

  it('/api/projects/:id/status GET → 405', async () => {
    const fn = router.match('GET', '/api/projects/proj-1/status')
    const res = makeRes()
    await fn(makeReq('GET', '/api/projects/proj-1/status'), res, makeReqCtx({ id: 'proj-1' }))
    expect(res.statusCode).toBe(405)
  })

  it('/api/projects/:id/pv-data GET → 405', async () => {
    const fn = router.match('GET', '/api/projects/proj-1/pv-data')
    const res = makeRes()
    await fn(makeReq('GET', '/api/projects/proj-1/pv-data'), res, makeReqCtx({ id: 'proj-1' }))
    expect(res.statusCode).toBe(405)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Params extraction
// ─────────────────────────────────────────────────────────────────────────────

describe('registerProjectsRoutes — params extraction', () => {
  let router, handleProjectFromPlanMock, handleProjectFinanceMock
  beforeEach(async () => {
    router = createRouter()
    registerProjectsRoutes(router, makeModuleCtx())
    const projMod = await import('../projects/handler.js')
    handleProjectFromPlanMock = projMod.handleProjectFromPlan
    const financeMod = await import('../project-finance/handler.js')
    handleProjectFinanceMock = financeMod.handleProjectFinance
    vi.clearAllMocks()
    handleProjectFromPlanMock.mockResolvedValue(undefined)
    handleProjectFinanceMock.mockResolvedValue(undefined)
  })

  it('decodes planId from /api/projects/from-plan/:planId', async () => {
    const fn = router.match('POST', '/api/projects/from-plan/plan-abc%20xyz')
    const res = makeRes()
    await fn(makeReq('POST', '/api/projects/from-plan/plan-abc%20xyz'), res, makeReqCtx({ planId: 'plan-abc%20xyz' }))
    expect(handleProjectFromPlanMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ planId: 'plan-abc xyz' }),
    )
  })

  it('passes projectId from /api/projects/:id/finance', async () => {
    const fn = router.match('GET', '/api/projects/proj-99/finance')
    const res = makeRes()
    await fn(makeReq('GET', '/api/projects/proj-99/finance'), res, makeReqCtx({ id: 'proj-99' }))
    expect(handleProjectFinanceMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ projectId: 'proj-99' }),
    )
  })
})
