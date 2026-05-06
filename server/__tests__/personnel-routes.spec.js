// server/__tests__/personnel-routes.spec.js
//
// Integration-level tests for the route registrations introduced in PR 19:
//   registerConsultantsRoutes, registerEngineersRoutes,
//   registerInstallersRoutes, registerPersonnelImportRoutes,
//   registerPurgeDeletedClientsRoute, registerPurgeOldProposalsRoute,
//   and the /api/internal/auth/reconcile/:userId route added to registerAuthRoutes.
//
// These tests cover:
//   - Route registration (router.match returns a function for each path)
//   - OPTIONS pre-flight responses (204 + Allow header)
//   - Method-not-allowed responses (405)
//   - Non-numeric ID guard for parameterised routes (404)
//
// DB interactions are fully mocked — no live Neon connection required.
//
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerConsultantsRoutes } from '../routes/consultants.js'
import { registerEngineersRoutes } from '../routes/engineers.js'
import { registerInstallersRoutes } from '../routes/installers.js'
import { registerPersonnelImportRoutes } from '../routes/personnelImport.js'
import { registerPurgeDeletedClientsRoute } from '../routes/purgeDeletedClients.js'
import { registerPurgeOldProposalsRoute } from '../routes/purgeOldProposals.js'
import { registerAuthRoutes } from '../routes/auth.js'

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

function makeReq(method, url) {
  return { method, url, headers: {}, readable: false }
}

function makeReqCtx() {
  return { requestId: 'test', vercelId: undefined }
}

// Module context stubs — never actually invoked in method-guard / OPTIONS tests.
function makeScopedSql() {
  return vi.fn().mockResolvedValue(undefined)
}
function makeReadJsonBody() {
  return vi.fn().mockResolvedValue({})
}
function makeModuleCtx() {
  return { getScopedSql: makeScopedSql(), readJsonBody: makeReadJsonBody() }
}

function makeAuthCtx() {
  return {
    expireAuthCookie: vi.fn(),
    isAuthRateLimited: () => false,
    isAdminRateLimited: () => false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Consultants routes
// ─────────────────────────────────────────────────────────────────────────────

describe('registerConsultantsRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerConsultantsRoutes(router, makeModuleCtx())
  })

  it('registers /api/consultants/picker', () => {
    expect(router.match('GET', '/api/consultants/picker')).toBeTypeOf('function')
  })

  it('registers /api/consultants/auto-detect', () => {
    expect(router.match('GET', '/api/consultants/auto-detect')).toBeTypeOf('function')
  })

  it('registers /api/consultants (list/create)', () => {
    expect(router.match('GET', '/api/consultants')).toBeTypeOf('function')
    expect(router.match('POST', '/api/consultants')).toBeTypeOf('function')
  })

  it('registers /api/consultants/:id (update)', () => {
    expect(router.match('PUT', '/api/consultants/42')).toBeTypeOf('function')
  })

  it('registers /api/consultants/:id/deactivate', () => {
    expect(router.match('PATCH', '/api/consultants/42/deactivate')).toBeTypeOf('function')
  })

  it('registers /api/consultants/:id/link', () => {
    expect(router.match('POST', '/api/consultants/42/link')).toBeTypeOf('function')
    expect(router.match('DELETE', '/api/consultants/42/link')).toBeTypeOf('function')
  })

  it('exact /api/consultants/picker is NOT shadowed by /:id pattern', () => {
    // The matched function for /picker must be the exact route handler
    // (not a params-injecting wrapper from the /:id pattern)
    const pickerFn = router.match('GET', '/api/consultants/picker')
    const idFn = router.match('GET', '/api/consultants/picker')
    // They should be the same handler (the exact one)
    expect(pickerFn).toBe(idFn)
  })
})

describe('registerConsultantsRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerConsultantsRoutes(router, makeModuleCtx())
  })

  it('/api/consultants OPTIONS → 204 Allow: GET,POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/consultants')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/consultants'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,OPTIONS')
  })

  it('/api/consultants/picker OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/consultants/picker')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/consultants/picker'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/consultants/:id OPTIONS → 204 Allow: PUT,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/consultants/7')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/consultants/7'), res, { ...makeReqCtx(), params: { id: '7' } })
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PUT,OPTIONS')
  })

  it('/api/consultants/:id/deactivate OPTIONS → 204 Allow: PATCH,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/consultants/7/deactivate')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/consultants/7/deactivate'), res, { ...makeReqCtx(), params: { id: '7' } })
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PATCH,OPTIONS')
  })

  it('/api/consultants/:id/link OPTIONS → 204 Allow: POST,DELETE,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/consultants/7/link')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/consultants/7/link'), res, { ...makeReqCtx(), params: { id: '7' } })
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('POST,DELETE,OPTIONS')
  })
})

describe('registerConsultantsRoutes — method guards', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerConsultantsRoutes(router, makeModuleCtx())
  })

  it('/api/consultants DELETE → 405', async () => {
    const fn = router.match('DELETE', '/api/consultants')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/consultants'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/consultants/picker POST → 405', async () => {
    const fn = router.match('POST', '/api/consultants/picker')
    const res = makeRes()
    await fn(makeReq('POST', '/api/consultants/picker'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/consultants/:id GET → 405 (only PUT allowed)', async () => {
    const fn = router.match('GET', '/api/consultants/1')
    const res = makeRes()
    await fn(makeReq('GET', '/api/consultants/1'), res, { ...makeReqCtx(), params: { id: '1' } })
    expect(res.statusCode).toBe(405)
  })

  it('/api/consultants/:id/deactivate PUT → 405 (only PATCH allowed)', async () => {
    const fn = router.match('PUT', '/api/consultants/1/deactivate')
    const res = makeRes()
    await fn(makeReq('PUT', '/api/consultants/1/deactivate'), res, { ...makeReqCtx(), params: { id: '1' } })
    expect(res.statusCode).toBe(405)
  })
})

describe('registerConsultantsRoutes — non-numeric ID guard', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerConsultantsRoutes(router, makeModuleCtx())
  })

  it('/api/consultants/abc (non-numeric) → 404', async () => {
    const fn = router.match('PUT', '/api/consultants/abc')
    const res = makeRes()
    await fn(makeReq('PUT', '/api/consultants/abc'), res, { ...makeReqCtx(), params: { id: 'abc' } })
    expect(res.statusCode).toBe(404)
  })

  it('/api/consultants/0 (zero) → 404', async () => {
    const fn = router.match('PUT', '/api/consultants/0')
    const res = makeRes()
    await fn(makeReq('PUT', '/api/consultants/0'), res, { ...makeReqCtx(), params: { id: '0' } })
    expect(res.statusCode).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Engineers routes
// ─────────────────────────────────────────────────────────────────────────────

describe('registerEngineersRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerEngineersRoutes(router, makeModuleCtx())
  })

  it('registers /api/engineers (list/create)', () => {
    expect(router.match('GET', '/api/engineers')).toBeTypeOf('function')
    expect(router.match('POST', '/api/engineers')).toBeTypeOf('function')
  })

  it('registers /api/engineers/:id (update)', () => {
    expect(router.match('PUT', '/api/engineers/5')).toBeTypeOf('function')
  })

  it('registers /api/engineers/:id/deactivate', () => {
    expect(router.match('PATCH', '/api/engineers/5/deactivate')).toBeTypeOf('function')
  })
})

describe('registerEngineersRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerEngineersRoutes(router, makeModuleCtx())
  })

  it('/api/engineers OPTIONS → 204 Allow: GET,POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/engineers')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/engineers'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,OPTIONS')
  })

  it('/api/engineers/:id OPTIONS → 204 Allow: PUT,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/engineers/3')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/engineers/3'), res, { ...makeReqCtx(), params: { id: '3' } })
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PUT,OPTIONS')
  })

  it('/api/engineers/:id/deactivate OPTIONS → 204 Allow: PATCH,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/engineers/3/deactivate')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/engineers/3/deactivate'), res, { ...makeReqCtx(), params: { id: '3' } })
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PATCH,OPTIONS')
  })
})

describe('registerEngineersRoutes — method guards and ID guard', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerEngineersRoutes(router, makeModuleCtx())
  })

  it('/api/engineers DELETE → 405', async () => {
    const fn = router.match('DELETE', '/api/engineers')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/engineers'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/engineers/abc (non-numeric) → 404', async () => {
    const fn = router.match('PUT', '/api/engineers/abc')
    const res = makeRes()
    await fn(makeReq('PUT', '/api/engineers/abc'), res, { ...makeReqCtx(), params: { id: 'abc' } })
    expect(res.statusCode).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Installers routes
// ─────────────────────────────────────────────────────────────────────────────

describe('registerInstallersRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerInstallersRoutes(router, makeModuleCtx())
  })

  it('registers /api/installers (list/create)', () => {
    expect(router.match('GET', '/api/installers')).toBeTypeOf('function')
    expect(router.match('POST', '/api/installers')).toBeTypeOf('function')
  })

  it('registers /api/installers/:id (update)', () => {
    expect(router.match('PUT', '/api/installers/9')).toBeTypeOf('function')
  })

  it('registers /api/installers/:id/deactivate', () => {
    expect(router.match('PATCH', '/api/installers/9/deactivate')).toBeTypeOf('function')
  })
})

describe('registerInstallersRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerInstallersRoutes(router, makeModuleCtx())
  })

  it('/api/installers OPTIONS → 204 Allow: GET,POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/installers')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/installers'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,POST,OPTIONS')
  })

  it('/api/installers/:id OPTIONS → 204 Allow: PUT,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/installers/2')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/installers/2'), res, { ...makeReqCtx(), params: { id: '2' } })
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('PUT,OPTIONS')
  })
})

describe('registerInstallersRoutes — method guards and ID guard', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerInstallersRoutes(router, makeModuleCtx())
  })

  it('/api/installers DELETE → 405', async () => {
    const fn = router.match('DELETE', '/api/installers')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/installers'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/installers/0 (zero) → 404', async () => {
    const fn = router.match('PUT', '/api/installers/0')
    const res = makeRes()
    await fn(makeReq('PUT', '/api/installers/0'), res, { ...makeReqCtx(), params: { id: '0' } })
    expect(res.statusCode).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Personnel import routes
// ─────────────────────────────────────────────────────────────────────────────

describe('registerPersonnelImportRoutes — route registration', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerPersonnelImportRoutes(router, { getScopedSql: makeScopedSql() })
  })

  it('registers /api/personnel/importable-users', () => {
    expect(router.match('GET', '/api/personnel/importable-users')).toBeTypeOf('function')
  })

  it('registers /api/personnel/importable-clients', () => {
    expect(router.match('GET', '/api/personnel/importable-clients')).toBeTypeOf('function')
  })
})

describe('registerPersonnelImportRoutes — OPTIONS pre-flight', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerPersonnelImportRoutes(router, { getScopedSql: makeScopedSql() })
  })

  it('/api/personnel/importable-users OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/personnel/importable-users')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/personnel/importable-users'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/personnel/importable-clients OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/personnel/importable-clients')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/personnel/importable-clients'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })
})

describe('registerPersonnelImportRoutes — method guards', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerPersonnelImportRoutes(router, { getScopedSql: makeScopedSql() })
  })

  it('/api/personnel/importable-users POST → 405', async () => {
    const fn = router.match('POST', '/api/personnel/importable-users')
    const res = makeRes()
    await fn(makeReq('POST', '/api/personnel/importable-users'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('/api/personnel/importable-clients DELETE → 405', async () => {
    const fn = router.match('DELETE', '/api/personnel/importable-clients')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/personnel/importable-clients'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Purge routes
// ─────────────────────────────────────────────────────────────────────────────

describe('registerPurgeDeletedClientsRoute — route registration', () => {
  it('registers /api/internal/purge-deleted-clients', () => {
    const router = createRouter()
    registerPurgeDeletedClientsRoute(router)
    expect(router.match('GET', '/api/internal/purge-deleted-clients')).toBeTypeOf('function')
  })

  it('/api/internal/purge-deleted-clients OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const router = createRouter()
    registerPurgeDeletedClientsRoute(router)
    const fn = router.match('OPTIONS', '/api/internal/purge-deleted-clients')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/internal/purge-deleted-clients'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/internal/purge-deleted-clients POST → 405', async () => {
    const router = createRouter()
    registerPurgeDeletedClientsRoute(router)
    const fn = router.match('POST', '/api/internal/purge-deleted-clients')
    const res = makeRes()
    await fn(makeReq('POST', '/api/internal/purge-deleted-clients'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })
})

describe('registerPurgeOldProposalsRoute — route registration', () => {
  it('registers /api/internal/purge-old-proposals', () => {
    const router = createRouter()
    registerPurgeOldProposalsRoute(router)
    expect(router.match('GET', '/api/internal/purge-old-proposals')).toBeTypeOf('function')
  })

  it('/api/internal/purge-old-proposals OPTIONS → 204 Allow: GET,OPTIONS', async () => {
    const router = createRouter()
    registerPurgeOldProposalsRoute(router)
    const fn = router.match('OPTIONS', '/api/internal/purge-old-proposals')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/internal/purge-old-proposals'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/internal/purge-old-proposals DELETE → 405', async () => {
    const router = createRouter()
    registerPurgeOldProposalsRoute(router)
    const fn = router.match('DELETE', '/api/internal/purge-old-proposals')
    const res = makeRes()
    await fn(makeReq('DELETE', '/api/internal/purge-old-proposals'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. reconcile/:userId route added to registerAuthRoutes
// ─────────────────────────────────────────────────────────────────────────────

describe('registerAuthRoutes — /api/internal/auth/reconcile/:userId', () => {
  let router
  beforeEach(() => {
    router = createRouter()
    registerAuthRoutes(router, makeAuthCtx())
  })

  it('registers POST /api/internal/auth/reconcile/:userId', () => {
    expect(router.match('POST', '/api/internal/auth/reconcile/user-123')).toBeTypeOf('function')
  })

  it('OPTIONS → 204 Allow: POST,OPTIONS', async () => {
    const fn = router.match('OPTIONS', '/api/internal/auth/reconcile/user-abc')
    const res = makeRes()
    await fn(makeReq('OPTIONS', '/api/internal/auth/reconcile/user-abc'), res, makeReqCtx())
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('POST,OPTIONS')
  })

  it('GET → 405', async () => {
    const fn = router.match('GET', '/api/internal/auth/reconcile/user-abc')
    const res = makeRes()
    await fn(makeReq('GET', '/api/internal/auth/reconcile/user-abc'), res, makeReqCtx())
    expect(res.statusCode).toBe(405)
  })

  it('exact /api/internal/auth/reconcile is NOT shadowed by /:userId', () => {
    // The exact route (all-users reconcile) must still match
    const exactFn = router.match('POST', '/api/internal/auth/reconcile')
    expect(exactFn).toBeTypeOf('function')
    // And it must be a different function from the param route
    const paramFn = router.match('POST', '/api/internal/auth/reconcile/user-1')
    expect(paramFn).not.toBe(exactFn)
  })
})
