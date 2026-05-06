// server/__tests__/financial-routes.spec.js
//
// Route-registration, OPTIONS pre-flight, and method-guard tests for:
//   registerFinancialManagementRoutes  (/api/financial-management/*)
//   registerFinancialImportRoutes      (/api/financial-import/*)
//   registerFinancialAnalysesRoutes    (/api/financial-analyses)
//   registerRevenueBillingRoutes       (/api/revenue-billing/*)
//
// No live DB required — all domain handlers are mocked.
//
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerFinancialManagementRoutes } from '../routes/financialManagement.js'
import { registerFinancialImportRoutes } from '../routes/financialImport.js'
import { registerFinancialAnalysesRoutes } from '../routes/financialAnalyses.js'
import { registerRevenueBillingRoutes } from '../routes/revenueBilling.js'

// Mock all domain handlers
vi.mock('../financial-management/handler.js', () => ({
  handleFinancialSummary: vi.fn().mockResolvedValue(undefined),
  handleFinancialProjects: vi.fn().mockResolvedValue(undefined),
  handleFinancialCashflow: vi.fn().mockResolvedValue(undefined),
  handleFinancialEntries: vi.fn().mockResolvedValue(undefined),
  handleFinancialCategories: vi.fn().mockResolvedValue(undefined),
  handleFinancialDashboardFeed: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../financial-import/handler.js', () => ({
  handleFinancialImportParse: vi.fn().mockResolvedValue(undefined),
  handleFinancialImportConfirm: vi.fn().mockResolvedValue(undefined),
  handleFinancialImportBatches: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../financial-analyses/handler.js', () => ({
  handleFinancialAnalyses: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../revenue-billing/handler.js', () => ({
  handleRevenueClients: vi.fn().mockResolvedValue(undefined),
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

// ═════════════════════════════════════════════════════════════════════════════
// Financial Management
// ═════════════════════════════════════════════════════════════════════════════

describe('registerFinancialManagementRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerFinancialManagementRoutes(router, makeModuleCtx())
  })

  it('registers /api/financial-management/summary', () => {
    expect(router.match('GET', '/api/financial-management/summary')).toBeTypeOf('function')
  })

  it('registers /api/financial-management/projects', () => {
    expect(router.match('GET', '/api/financial-management/projects')).toBeTypeOf('function')
  })

  it('registers /api/financial-management/cashflow', () => {
    expect(router.match('GET', '/api/financial-management/cashflow')).toBeTypeOf('function')
  })

  it('registers /api/financial-management/categories', () => {
    expect(router.match('GET', '/api/financial-management/categories')).toBeTypeOf('function')
  })

  it('registers /api/financial-management/dashboard-feed', () => {
    expect(router.match('GET', '/api/financial-management/dashboard-feed')).toBeTypeOf('function')
  })

  it('registers /api/financial-management/entries (collection)', () => {
    expect(router.match('GET', '/api/financial-management/entries')).toBeTypeOf('function')
  })

  it('registers /api/financial-management/entries/:id (by-id)', () => {
    expect(router.match('GET', '/api/financial-management/entries/42')).toBeTypeOf('function')
  })

  it('does not register unrelated paths', () => {
    expect(router.match('GET', '/api/other')).toBeNull()
  })
})

describe('registerFinancialManagementRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerFinancialManagementRoutes(router, makeModuleCtx())
  })

  it('/api/financial-management/summary OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/financial-management/summary')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/financial-management/summary'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/financial-management/entries OPTIONS → 204 Allow: GET,POST,PUT,DELETE,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/financial-management/entries')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/financial-management/entries'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,PUT,DELETE,OPTIONS')
  })

  it('/api/financial-management/entries/:id OPTIONS → 204 Allow: GET,POST,PUT,DELETE,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/financial-management/entries/5')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/financial-management/entries/5'), res, makeReqCtx({ id: '5' }))
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,PUT,DELETE,OPTIONS')
  })
})

describe('registerFinancialManagementRoutes — method guards', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerFinancialManagementRoutes(router, makeModuleCtx())
  })

  it('/api/financial-management/summary POST → 405', async () => {
    const fn = router.match('POST', '/api/financial-management/summary')
    const res = makeRes()
    await fn(makeReq('POST', '/api/financial-management/summary'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/financial-management/cashflow DELETE → 405', async () => {
    const fn = router.match('DELETE', '/api/financial-management/cashflow')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/financial-management/cashflow'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/financial-management/categories PATCH → 405', async () => {
    const fn = router.match('PATCH', '/api/financial-management/categories')
    const res = makeRes()
    await fn(makeReq('PATCH', '/api/financial-management/categories'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Financial Import
// ═════════════════════════════════════════════════════════════════════════════

describe('registerFinancialImportRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerFinancialImportRoutes(router, {})
  })

  it('registers POST /api/financial-import/parse', () => {
    expect(router.match('POST', '/api/financial-import/parse')).toBeTypeOf('function')
  })

  it('registers POST /api/financial-import/confirm', () => {
    expect(router.match('POST', '/api/financial-import/confirm')).toBeTypeOf('function')
  })

  it('registers GET /api/financial-import/batches', () => {
    expect(router.match('GET', '/api/financial-import/batches')).toBeTypeOf('function')
  })
})

describe('registerFinancialImportRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerFinancialImportRoutes(router, {})
  })

  it('/api/financial-import/parse OPTIONS → 204 Allow: POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/financial-import/parse')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/financial-import/parse'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('POST,OPTIONS')
  })

  it('/api/financial-import/batches OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/financial-import/batches')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/financial-import/batches'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })
})

describe('registerFinancialImportRoutes — method guards', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerFinancialImportRoutes(router, {})
  })

  it('/api/financial-import/parse GET → 405', async () => {
    const fn = router.match('GET', '/api/financial-import/parse')
    const res = makeRes()
    await fn(makeReq('GET', '/api/financial-import/parse'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/financial-import/confirm GET → 405', async () => {
    const fn = router.match('GET', '/api/financial-import/confirm')
    const res = makeRes()
    await fn(makeReq('GET', '/api/financial-import/confirm'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/financial-import/batches POST → 405', async () => {
    const fn = router.match('POST', '/api/financial-import/batches')
    const res = makeRes()
    await fn(makeReq('POST', '/api/financial-import/batches'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Financial Analyses
// ═════════════════════════════════════════════════════════════════════════════

describe('registerFinancialAnalysesRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerFinancialAnalysesRoutes(router, makeModuleCtx())
  })

  it('registers /api/financial-analyses for all methods', () => {
    expect(router.match('GET', '/api/financial-analyses')).toBeTypeOf('function')
    expect(router.match('POST', '/api/financial-analyses')).toBeTypeOf('function')
    expect(router.match('DELETE', '/api/financial-analyses')).toBeTypeOf('function')
  })

  it('does not register unrelated paths', () => {
    expect(router.match('GET', '/api/financial-analyses/other')).toBeNull()
  })
})

describe('registerFinancialAnalysesRoutes — delegates to domain handler', () => {
  let router, handleFinancialAnalysesMock
  beforeEach(async () => {
    router = createRouter()
    registerFinancialAnalysesRoutes(router, makeModuleCtx())
    const mod = await import('../financial-analyses/handler.js')
    handleFinancialAnalysesMock = mod.handleFinancialAnalyses
    vi.clearAllMocks()
    handleFinancialAnalysesMock.mockResolvedValue(undefined)
  })

  it('calls handleFinancialAnalyses on GET', async () => {
    const fn = router.match('GET', '/api/financial-analyses')
    const res = makeRes()
    await fn(makeReq('GET', '/api/financial-analyses'), res, makeReqCtx())
    expect(handleFinancialAnalysesMock).toHaveBeenCalledOnce()
  })

  it('passes method and sendJson to handler', async () => {
    const fn = router.match('POST', '/api/financial-analyses')
    const res = makeRes()
    await fn(makeReq('POST', '/api/financial-analyses'), res, makeReqCtx())
    expect(handleFinancialAnalysesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ method: 'POST', sendJson: expect.any(Function), readJsonBody: expect.any(Function) }),
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Revenue Billing
// ═════════════════════════════════════════════════════════════════════════════

describe('registerRevenueBillingRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerRevenueBillingRoutes(router, {})
  })

  it('registers GET /api/revenue-billing/clients', () => {
    expect(router.match('GET', '/api/revenue-billing/clients')).toBeTypeOf('function')
  })

  it('does not register unrelated paths', () => {
    expect(router.match('GET', '/api/revenue-billing/other')).toBeNull()
  })
})

describe('registerRevenueBillingRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerRevenueBillingRoutes(router, {})
  })

  it('/api/revenue-billing/clients OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/revenue-billing/clients')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/revenue-billing/clients'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })
})

describe('registerRevenueBillingRoutes — method guards', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerRevenueBillingRoutes(router, {})
  })

  it('/api/revenue-billing/clients POST → 405', async () => {
    const fn = router.match('POST', '/api/revenue-billing/clients')
    const res = makeRes()
    await fn(makeReq('POST', '/api/revenue-billing/clients'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })
})
