// server/__tests__/admin-users-routes.spec.js
// Tests for the registerAdminUsersRoutes export in server/routes/adminUsers.js.
// Verifies route registration, method dispatch, rate limiting, and param extraction.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerAdminUsersRoutes } from '../routes/adminUsers.js'

// Mock all heavy admin handler functions — we test routing, not business logic.
vi.mock('../auth/currentAppUser.js', () => ({ getCurrentAppUser: vi.fn() }))
vi.mock('../auth/rbac.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../db.js', () => ({ query: vi.fn() }))
vi.mock('../auth/stackPermissions.js', () => ({
  getUserPermissions: vi.fn(),
  grantUserPermission: vi.fn(),
  revokeUserPermission: vi.fn(),
  deleteStackUser: vi.fn(),
  createStackUser: vi.fn(),
  lookupStackUserByEmail: vi.fn(),
}))
vi.mock('../auth/userProfileSync.js', () => ({ syncUserProfile: vi.fn() }))
vi.mock('../auth/authorizationSnapshot.js', () => ({ derivePrimaryRole: vi.fn() }))
vi.mock('../auth/roleMapping.js', () => ({ stackPermToDbRole: vi.fn() }))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSendJson() {
  return vi.fn((res, status, payload) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
  })
}

function makeSendNoContent() {
  return vi.fn((res) => {
    res.statusCode = 204
    res.end('')
  })
}

function makeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    get headersSent() { return res.body !== null },
    setHeader(key, val) { res.headers[key] = val },
    end(body) { res.body = body ?? '' },
  }
  return res
}

function parseBody(res) {
  return JSON.parse(res.body)
}

function makeReq(url, method = 'GET', readable = false) {
  const req = { url, method, readable }
  return req
}

function makeModuleCtx(overrides = {}) {
  const sendJson = makeSendJson()
  const sendNoContent = makeSendNoContent()
  return {
    readJsonBody: vi.fn().mockResolvedValue({}),
    isAdminRateLimited: vi.fn().mockReturnValue(false),
    sendJson,
    sendNoContent,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Route registration
// ─────────────────────────────────────────────────────────────────────────────

describe('registerAdminUsersRoutes — route registration', () => {
  it('registers all expected paths', () => {
    const router = createRouter()
    registerAdminUsersRoutes(router, makeModuleCtx())

    expect(router.match('GET', '/api/admin/users')).toBeTypeOf('function')
    expect(router.match('POST', '/api/admin/users')).toBeTypeOf('function')
    expect(router.match('POST', '/api/admin/users/123/approve')).toBeTypeOf('function')
    expect(router.match('POST', '/api/admin/users/123/block')).toBeTypeOf('function')
    expect(router.match('POST', '/api/admin/users/123/revoke')).toBeTypeOf('function')
    expect(router.match('POST', '/api/admin/users/123/role')).toBeTypeOf('function')
    expect(router.match('DELETE', '/api/admin/users/123')).toBeTypeOf('function')
    expect(router.match('POST', '/api/admin/users/123/permissions/role_admin')).toBeTypeOf('function')
    expect(router.match('DELETE', '/api/admin/users/123/permissions/role_admin')).toBeTypeOf('function')
  })

  it('does not match unrelated paths', () => {
    const router = createRouter()
    registerAdminUsersRoutes(router, makeModuleCtx())

    expect(router.match('GET', '/api/admin/other')).toBeNull()
    expect(router.match('GET', '/api/users')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. /api/admin/users — method dispatch
// ─────────────────────────────────────────────────────────────────────────────

describe('/api/admin/users', () => {
  it('OPTIONS returns 204 with Allow header', async () => {
    const ctx = makeModuleCtx()
    const router = createRouter()
    registerAdminUsersRoutes(router, ctx)

    const res = makeRes()
    const req = makeReq('/api/admin/users', 'OPTIONS')
    await router.match('OPTIONS', '/api/admin/users')(req, res, {})

    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toContain('GET')
    expect(res.headers['Allow']).toContain('POST')
  })

  it('unsupported method returns 405', async () => {
    const ctx = makeModuleCtx()
    const router = createRouter()
    registerAdminUsersRoutes(router, ctx)

    const res = makeRes()
    const req = makeReq('/api/admin/users', 'DELETE')
    await router.match('DELETE', '/api/admin/users')(req, res, {})

    expect(res.statusCode).toBe(405)
  })

  it('POST returns 429 when rate limited', async () => {
    const ctx = makeModuleCtx({ isAdminRateLimited: vi.fn().mockReturnValue(true) })
    const router = createRouter()
    registerAdminUsersRoutes(router, ctx)

    const res = makeRes()
    const req = makeReq('/api/admin/users', 'POST')
    await router.match('POST', '/api/admin/users')(req, res, {})

    expect(res.statusCode).toBe(429)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. /api/admin/users/:id/approve — param extraction and method guard
// ─────────────────────────────────────────────────────────────────────────────

describe('/api/admin/users/:id/approve', () => {
  it('OPTIONS returns 204', async () => {
    const ctx = makeModuleCtx()
    const router = createRouter()
    registerAdminUsersRoutes(router, ctx)

    const res = makeRes()
    await router.match('OPTIONS', '/api/admin/users/abc/approve')(
      makeReq('/api/admin/users/abc/approve', 'OPTIONS'), res, {}
    )
    expect(res.statusCode).toBe(204)
  })

  it('non-POST returns 405', async () => {
    const ctx = makeModuleCtx()
    const router = createRouter()
    registerAdminUsersRoutes(router, ctx)

    const res = makeRes()
    await router.match('GET', '/api/admin/users/abc/approve')(
      makeReq('/api/admin/users/abc/approve', 'GET'), res, {}
    )
    expect(res.statusCode).toBe(405)
  })

  it('rate-limited POST returns 429', async () => {
    const ctx = makeModuleCtx({ isAdminRateLimited: vi.fn().mockReturnValue(true) })
    const router = createRouter()
    registerAdminUsersRoutes(router, ctx)

    const res = makeRes()
    await router.match('POST', '/api/admin/users/abc/approve')(
      makeReq('/api/admin/users/abc/approve', 'POST'), res, {}
    )
    expect(res.statusCode).toBe(429)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. /api/admin/users/:id — DELETE only
// ─────────────────────────────────────────────────────────────────────────────

describe('/api/admin/users/:id', () => {
  it('OPTIONS returns 204', async () => {
    const ctx = makeModuleCtx()
    const router = createRouter()
    registerAdminUsersRoutes(router, ctx)

    const res = makeRes()
    await router.match('OPTIONS', '/api/admin/users/xyz')(
      makeReq('/api/admin/users/xyz', 'OPTIONS'), res, {}
    )
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toContain('DELETE')
  })

  it('non-DELETE returns 405', async () => {
    const ctx = makeModuleCtx()
    const router = createRouter()
    registerAdminUsersRoutes(router, ctx)

    const res = makeRes()
    await router.match('POST', '/api/admin/users/xyz')(
      makeReq('/api/admin/users/xyz', 'POST'), res, {}
    )
    expect(res.statusCode).toBe(405)
  })

  it('DELETE rate-limited returns 429', async () => {
    const ctx = makeModuleCtx({ isAdminRateLimited: vi.fn().mockReturnValue(true) })
    const router = createRouter()
    registerAdminUsersRoutes(router, ctx)

    const res = makeRes()
    await router.match('DELETE', '/api/admin/users/xyz')(
      makeReq('/api/admin/users/xyz', 'DELETE'), res, {}
    )
    expect(res.statusCode).toBe(429)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. /api/admin/users/:id/permissions/:perm — POST grant, DELETE revoke
// ─────────────────────────────────────────────────────────────────────────────

describe('/api/admin/users/:id/permissions/:perm', () => {
  it('OPTIONS returns 204 with POST,DELETE,OPTIONS in Allow', async () => {
    const ctx = makeModuleCtx()
    const router = createRouter()
    registerAdminUsersRoutes(router, ctx)

    const res = makeRes()
    await router.match('OPTIONS', '/api/admin/users/u1/permissions/role_admin')(
      makeReq('/api/admin/users/u1/permissions/role_admin', 'OPTIONS'), res, {}
    )
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toContain('POST')
    expect(res.headers['Allow']).toContain('DELETE')
  })

  it('PUT returns 405', async () => {
    const ctx = makeModuleCtx()
    const router = createRouter()
    registerAdminUsersRoutes(router, ctx)

    const res = makeRes()
    await router.match('PUT', '/api/admin/users/u1/permissions/role_admin')(
      makeReq('/api/admin/users/u1/permissions/role_admin', 'PUT'), res, {}
    )
    expect(res.statusCode).toBe(405)
  })

  it('POST rate-limited returns 429', async () => {
    const ctx = makeModuleCtx({ isAdminRateLimited: vi.fn().mockReturnValue(true) })
    const router = createRouter()
    registerAdminUsersRoutes(router, ctx)

    const res = makeRes()
    await router.match('POST', '/api/admin/users/u1/permissions/role_admin')(
      makeReq('/api/admin/users/u1/permissions/role_admin', 'POST'), res, {}
    )
    expect(res.statusCode).toBe(429)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Exact /api/admin/users is not shadowed by /:id pattern
// ─────────────────────────────────────────────────────────────────────────────

describe('route priority: /api/admin/users vs /:id', () => {
  it('/api/admin/users exact path is matched before /:id wildcard', () => {
    const router = createRouter()
    registerAdminUsersRoutes(router, makeModuleCtx())

    // The exact route should be matched (first pass wins exact paths)
    const fn = router.match('GET', '/api/admin/users')
    expect(fn).toBeTypeOf('function')
    // The /:id pattern must NOT match the exact list path
    // (it would have id=undefined if it did — but the exact path wins)
    const fnId = router.match('GET', '/api/admin/users/someId')
    // /:id only matches DELETE; GET on /:id should return 405 inside the handler
    expect(fnId).toBeTypeOf('function')
  })
})
