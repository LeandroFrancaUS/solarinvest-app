// server/__tests__/auth-router.spec.js
// Unit tests for server/routes/auth.js (PR 14).
//
// Verifies that registerAuthRoutes correctly registers all auth routes and that
// each handler enforces the right method guards, rate-limiting, and delegation
// to the underlying auth modules.
//
// The /api/auth/me tests exercise the full handleAuthMeRequest logic (not
// mocked) by controlling the leaf auth dependencies so that all user-state
// scenarios are covered: unauthenticated, pending, no-permissions, authorized,
// DB-error, and Stack Auth bypass mode.
//
// Run with: npm run test:server

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerAuthRoutes } from '../routes/auth.js'

// ── Module-level mocks ─────────────────────────────────────────────────────────
// Mocked before any import so Vitest hoists them correctly.

vi.mock('../auth/stackAuth.js', () => ({
  getStackUser: vi.fn(),
  isStackAuthBypassed: vi.fn(),
}))

vi.mock('../auth/currentAppUser.js', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('../auth/stackPermissions.js', () => ({
  getUserPermissions: vi.fn(),
}))

vi.mock('../auth/authorizationSnapshot.js', () => ({
  getAuthorizationSnapshot: vi.fn(),
  derivePrimaryRole: vi.fn(),
}))

vi.mock('../routes/authReconcile.js', () => ({
  handleAuthReconcileAll: vi.fn(),
  handleAuthReconcileUser: vi.fn(),
}))

vi.mock('../routes/rbacInspect.js', () => ({
  handleRbacInspectRequest: vi.fn(),
}))

import { getStackUser, isStackAuthBypassed } from '../auth/stackAuth.js'
import { getCurrentAppUser } from '../auth/currentAppUser.js'
import { getUserPermissions } from '../auth/stackPermissions.js'
import { getAuthorizationSnapshot } from '../auth/authorizationSnapshot.js'
import { handleAuthReconcileAll } from '../routes/authReconcile.js'
import { handleRbacInspectRequest } from '../routes/rbacInspect.js'

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeRes() {
  const headers = {}
  return {
    statusCode: 0,
    headers,
    body: /** @type {string | null} */ (null),
    setHeader(key, val) { headers[key] = val },
    end(body) { this.body = body ?? null },
    get headersSent() { return this.body !== null },
  }
}

function makeReq(method = 'GET', url = '/api/auth/me') {
  return { method, url, headers: {}, socket: {} }
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

function parseBody(res) {
  return JSON.parse(/** @type {string} */ (res.body))
}

/** Default (no-op) expireAuthCookie — override per test when needed. */
function makeExpireAuthCookie() {
  return vi.fn()
}

/** Build a router with all auth routes registered. */
function makeRouter({
  isAuthRateLimited = () => false,
  isAdminRateLimited = () => false,
  expireAuthCookie = makeExpireAuthCookie(),
} = {}) {
  const router = createRouter()
  const sendJson = makeSendJson()
  const sendNoContent = makeSendNoContent()
  registerAuthRoutes(router, {
    sendJson,
    sendNoContent,
    expireAuthCookie,
    isAuthRateLimited,
    isAdminRateLimited,
  })
  return { router, sendJson, sendNoContent }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Route registration
// ─────────────────────────────────────────────────────────────────────────────

describe('registerAuthRoutes — route registration', () => {
  it('registers exactly 5 routes', () => {
    const { router } = makeRouter()
    expect(router.size).toBe(5)
  })

  it('registers GET /api/auth/me', () => {
    const { router } = makeRouter()
    expect(router.match('GET', '/api/auth/me')).toBeTypeOf('function')
  })

  it('registers GET /api/authz/me', () => {
    const { router } = makeRouter()
    expect(router.match('GET', '/api/authz/me')).toBeTypeOf('function')
  })

  it('registers POST /api/auth/logout', () => {
    const { router } = makeRouter()
    expect(router.match('POST', '/api/auth/logout')).toBeTypeOf('function')
  })

  it('registers POST /api/internal/auth/reconcile', () => {
    const { router } = makeRouter()
    expect(router.match('POST', '/api/internal/auth/reconcile')).toBeTypeOf('function')
  })

  it('registers GET /api/internal/rbac/inspect', () => {
    const { router } = makeRouter()
    expect(router.match('GET', '/api/internal/rbac/inspect')).toBeTypeOf('function')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. OPTIONS pre-flight handling
// ─────────────────────────────────────────────────────────────────────────────

describe('OPTIONS pre-flight', () => {
  it('/api/auth/me OPTIONS → 204 with Allow: GET,OPTIONS', async () => {
    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('OPTIONS', '/api/auth/me')
    await fn(makeReq('OPTIONS', '/api/auth/me'), res, {})
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/authz/me OPTIONS → 204 with Allow: GET,OPTIONS', async () => {
    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('OPTIONS', '/api/authz/me')
    await fn(makeReq('OPTIONS', '/api/authz/me'), res, {})
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })

  it('/api/auth/logout OPTIONS → 204 with Allow: POST,OPTIONS', async () => {
    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('OPTIONS', '/api/auth/logout')
    await fn(makeReq('OPTIONS', '/api/auth/logout'), res, {})
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('POST,OPTIONS')
  })

  it('/api/internal/auth/reconcile OPTIONS → 204 with Allow: POST,OPTIONS', async () => {
    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('OPTIONS', '/api/internal/auth/reconcile')
    await fn(makeReq('OPTIONS', '/api/internal/auth/reconcile'), res, {})
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('POST,OPTIONS')
  })

  it('/api/internal/rbac/inspect OPTIONS → 204 with Allow: GET,OPTIONS', async () => {
    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('OPTIONS', '/api/internal/rbac/inspect')
    await fn(makeReq('OPTIONS', '/api/internal/rbac/inspect'), res, {})
    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('GET,OPTIONS')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Method guards (405)
// ─────────────────────────────────────────────────────────────────────────────

describe('method guards', () => {
  it('/api/auth/me POST → 405', async () => {
    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('POST', '/api/auth/me')
    await fn(makeReq('POST', '/api/auth/me'), res, {})
    expect(res.statusCode).toBe(405)
    expect(parseBody(res).error).toBe('Método não suportado.')
  })

  it('/api/authz/me POST → 405', async () => {
    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('POST', '/api/authz/me')
    await fn(makeReq('POST', '/api/authz/me'), res, {})
    expect(res.statusCode).toBe(405)
  })

  it('/api/auth/logout GET → 405', async () => {
    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/auth/logout')
    await fn(makeReq('GET', '/api/auth/logout'), res, {})
    expect(res.statusCode).toBe(405)
  })

  it('/api/internal/auth/reconcile GET → 405', async () => {
    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/internal/auth/reconcile')
    await fn(makeReq('GET', '/api/internal/auth/reconcile'), res, {})
    expect(res.statusCode).toBe(405)
  })

  it('/api/internal/rbac/inspect POST → 405', async () => {
    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('POST', '/api/internal/rbac/inspect')
    await fn(makeReq('POST', '/api/internal/rbac/inspect'), res, {})
    expect(res.statusCode).toBe(405)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Rate limiting (429)
// ─────────────────────────────────────────────────────────────────────────────

describe('rate limiting', () => {
  it('/api/auth/me → 429 when auth rate limited', async () => {
    const { router } = makeRouter({ isAuthRateLimited: () => true })
    const res = makeRes()
    const fn = router.match('GET', '/api/auth/me')
    await fn(makeReq('GET', '/api/auth/me'), res, {})
    expect(res.statusCode).toBe(429)
    expect(parseBody(res).error).toBe('Too many requests. Try again later.')
  })

  it('/api/authz/me → 429 when auth rate limited', async () => {
    const { router } = makeRouter({ isAuthRateLimited: () => true })
    const res = makeRes()
    const fn = router.match('GET', '/api/authz/me')
    await fn(makeReq('GET', '/api/authz/me'), res, {})
    expect(res.statusCode).toBe(429)
  })

  it('/api/internal/auth/reconcile → 429 when admin rate limited', async () => {
    const { router } = makeRouter({ isAdminRateLimited: () => true })
    const res = makeRes()
    const fn = router.match('POST', '/api/internal/auth/reconcile')
    await fn(makeReq('POST', '/api/internal/auth/reconcile'), res, {})
    expect(res.statusCode).toBe(429)
  })

  it('/api/internal/rbac/inspect → 429 when admin rate limited', async () => {
    const { router } = makeRouter({ isAdminRateLimited: () => true })
    const res = makeRes()
    const fn = router.match('GET', '/api/internal/rbac/inspect')
    await fn(makeReq('GET', '/api/internal/rbac/inspect'), res, {})
    expect(res.statusCode).toBe(429)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /api/auth/me — auth/me scenarios
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 401 when unauthenticated (no stack user, bypass off)', async () => {
    getStackUser.mockResolvedValue(null)
    isStackAuthBypassed.mockReturnValue(false)

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/auth/me')
    await fn(makeReq('GET', '/api/auth/me'), res, {})

    expect(res.statusCode).toBe(401)
    const body = parseBody(res)
    expect(body.authenticated).toBe(false)
    expect(body.authorized).toBe(false)
    expect(body.role).toBeNull()
    expect(body.accessStatus).toBeNull()
  })

  it('returns 200 authorized:false accessStatus:pending when appUser is null', async () => {
    getStackUser.mockResolvedValue({ id: 'u1', email: 'user@example.com', _authSource: 'bearer' })
    isStackAuthBypassed.mockReturnValue(false)
    getCurrentAppUser.mockResolvedValue(null)

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/auth/me')
    await fn(makeReq('GET', '/api/auth/me'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.authenticated).toBe(true)
    expect(body.authorized).toBe(false)
    expect(body.accessStatus).toBe('pending')
    expect(body.email).toBe('user@example.com')
  })

  it('returns 200 authorized:false accessStatus:no_permissions when user has no primary role', async () => {
    getStackUser.mockResolvedValue({
      id: 'u2',
      email: 'noperms@example.com',
      _authSource: 'bearer',
      payload: { permissions: [] },
    })
    isStackAuthBypassed.mockReturnValue(false)
    getCurrentAppUser.mockResolvedValue({
      id: 1,
      role: 'role_comercial',
      email: 'noperms@example.com',
      full_name: 'No Perms',
      access_status: 'approved',
      can_access_app: true,
      is_active: true,
    })
    getUserPermissions.mockResolvedValue([])

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/auth/me')
    await fn(makeReq('GET', '/api/auth/me'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.authorized).toBe(false)
    expect(body.accessStatus).toBe('no_permissions')
  })

  it('returns 200 authorized:true for a fully approved user with role', async () => {
    getStackUser.mockResolvedValue({
      id: 'u3',
      email: 'admin@example.com',
      _authSource: 'bearer',
      payload: { permissions: ['role_admin'] },
    })
    isStackAuthBypassed.mockReturnValue(false)
    getCurrentAppUser.mockResolvedValue({
      id: 2,
      role: 'role_admin',
      email: 'admin@example.com',
      full_name: 'Admin User',
      access_status: 'approved',
      can_access_app: true,
      is_active: true,
      auth_provider_user_id: 'u3',
    })

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/auth/me')
    await fn(makeReq('GET', '/api/auth/me'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.authenticated).toBe(true)
    expect(body.authorized).toBe(true)
    expect(body.role).toBe('role_admin')
    expect(body.accessStatus).toBe('approved')
    expect(body.email).toBe('admin@example.com')
    expect(body.fullName).toBe('Admin User')
  })

  it('returns 200 authorized:false when appUser.access_status is not approved', async () => {
    getStackUser.mockResolvedValue({
      id: 'u4',
      email: 'blocked@example.com',
      _authSource: 'bearer',
      payload: { permissions: ['role_comercial'] },
    })
    isStackAuthBypassed.mockReturnValue(false)
    getCurrentAppUser.mockResolvedValue({
      id: 3,
      role: 'role_comercial',
      email: 'blocked@example.com',
      full_name: 'Blocked User',
      access_status: 'blocked',
      can_access_app: false,
      is_active: true,
      auth_provider_user_id: 'u4',
    })

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/auth/me')
    await fn(makeReq('GET', '/api/auth/me'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.authorized).toBe(false)
    expect(body.accessStatus).toBe('blocked')
  })

  it('returns 200 authorized:false when DB throws (authenticated but DB error)', async () => {
    getStackUser.mockResolvedValue({ id: 'u5', email: 'err@example.com', _authSource: 'bearer' })
    isStackAuthBypassed.mockReturnValue(false)
    getCurrentAppUser.mockRejectedValue(new Error('DB connection refused'))

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/auth/me')
    await fn(makeReq('GET', '/api/auth/me'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.authenticated).toBe(true)
    expect(body.authorized).toBe(false)
    expect(body.accessStatus).toBeNull()
  })

  it('returns 200 authorized:true in Stack Auth bypass mode (no JWT required)', async () => {
    getStackUser.mockResolvedValue(null)
    isStackAuthBypassed.mockReturnValue(true)
    getCurrentAppUser.mockResolvedValue({
      id: 10,
      role: 'role_admin',
      email: 'bypass@example.com',
      full_name: 'Bypass User',
      access_status: 'approved',
      can_access_app: true,
      is_active: true,
      auth_provider_user_id: null,
    })

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/auth/me')
    await fn(makeReq('GET', '/api/auth/me'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.authenticated).toBe(true)
    expect(body.authorized).toBe(true)
  })

  it('uses API fallback for permissions when JWT has no permissions claim', async () => {
    // JWT payload has no permissions array — triggers API fallback path
    getStackUser.mockResolvedValue({
      id: 'u6',
      email: 'fallback@example.com',
      _authSource: 'bearer',
      payload: {},  // no permissions claim
    })
    isStackAuthBypassed.mockReturnValue(false)
    getCurrentAppUser.mockResolvedValue({
      id: 4,
      role: 'role_office',
      email: 'fallback@example.com',
      full_name: 'Fallback User',
      access_status: 'approved',
      can_access_app: true,
      is_active: true,
      auth_provider_user_id: 'u6',
    })
    getUserPermissions.mockResolvedValue(['role_office'])

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/auth/me')
    await fn(makeReq('GET', '/api/auth/me'), res, {})

    expect(res.statusCode).toBe(200)
    expect(getUserPermissions).toHaveBeenCalledWith('u6')
    const body = parseBody(res)
    expect(body.authorized).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET /api/authz/me — authorization snapshot
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/authz/me', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 401 when getAuthorizationSnapshot returns null (unauthenticated)', async () => {
    getAuthorizationSnapshot.mockResolvedValue(null)

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/authz/me')
    await fn(makeReq('GET', '/api/authz/me'), res, {})

    expect(res.statusCode).toBe(401)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(body.error).toBe('Autenticação obrigatória.')
  })

  it('returns 200 with snapshot data when authenticated', async () => {
    const fakeSnapshot = { stackUserId: 'u1', role: 'role_admin', permissions: ['role_admin'] }
    getAuthorizationSnapshot.mockResolvedValue(fakeSnapshot)

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/authz/me')
    await fn(makeReq('GET', '/api/authz/me'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.ok).toBe(true)
    expect(body.data).toEqual(fakeSnapshot)
  })

  it('returns 500 when getAuthorizationSnapshot throws', async () => {
    getAuthorizationSnapshot.mockRejectedValue(new Error('unexpected'))

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/authz/me')
    await fn(makeReq('GET', '/api/authz/me'), res, {})

    expect(res.statusCode).toBe(500)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(body.error).toBe('Falha ao carregar snapshot de autorização.')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('calls expireAuthCookie and returns 204', async () => {
    const expireAuthCookie = vi.fn()
    const { router } = makeRouter({ expireAuthCookie })
    const req = makeReq('POST', '/api/auth/logout')
    const res = makeRes()
    const fn = router.match('POST', '/api/auth/logout')
    await fn(req, res, {})

    expect(expireAuthCookie).toHaveBeenCalledWith(req, res)
    expect(res.statusCode).toBe(204)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. POST /api/internal/auth/reconcile — delegation
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/internal/auth/reconcile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('delegates to handleAuthReconcileAll', async () => {
    handleAuthReconcileAll.mockImplementation((_req, res, { sendJson }) => {
      sendJson(res, 200, { ok: true, summary: { total: 0, changed: 0, errors: 0, skipped: 0 }, results: [] })
    })

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('POST', '/api/internal/auth/reconcile')
    await fn(makeReq('POST', '/api/internal/auth/reconcile'), res, {})

    expect(handleAuthReconcileAll).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.ok).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. GET /api/internal/rbac/inspect — delegation
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/internal/rbac/inspect', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('delegates to handleRbacInspectRequest', async () => {
    handleRbacInspectRequest.mockImplementation((_req, res, { sendJson }) => {
      sendJson(res, 200, { foundUsers: 0, users: [] })
    })

    const { router } = makeRouter()
    const res = makeRes()
    const fn = router.match('GET', '/api/internal/rbac/inspect')
    await fn(makeReq('GET', '/api/internal/rbac/inspect?emails=a@b.com'), res, {})

    expect(handleRbacInspectRequest).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.foundUsers).toBe(0)
  })
})
