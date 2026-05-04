// server/__tests__/database-backup-route.spec.js
// Route-level tests for /api/admin/database-backup (PR 15).
//
// Verifies that registerDatabaseBackupRoutes correctly enforces HTTP method
// guards, rate-limiting, authentication, authorization, and delegates to the
// underlying backup handler for the success and service-error cases.
//
// Run with: npm run test:server

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerDatabaseBackupRoutes } from '../routes/databaseBackup.js'

// ── Module-level mocks ─────────────────────────────────────────────────────────

vi.mock('../database/neonClient.js', () => ({
  getDatabaseClient: vi.fn(),
}))

vi.mock('../proposals/permissions.js', () => ({
  resolveActor: vi.fn(),
}))

import { getDatabaseClient } from '../database/neonClient.js'
import { resolveActor } from '../proposals/permissions.js'

// ── Test helpers ───────────────────────────────────────────────────────────────

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

function makeReq(method = 'POST', url = '/api/admin/database-backup') {
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

function makeReadJsonBody(body = {}) {
  return vi.fn().mockResolvedValue(body)
}

function parseBody(res) {
  return JSON.parse(/** @type {string} */ (res.body))
}

/** Default admin actor used in happy-path tests. */
const ADMIN_ACTOR = {
  userId: 'user-admin-1',
  email: 'admin@example.com',
  isAdmin: true,
  isOffice: false,
}

/** Office actor — also permitted to call backup. */
const OFFICE_ACTOR = {
  userId: 'user-office-1',
  email: 'office@example.com',
  isAdmin: false,
  isOffice: true,
}

/** Comercial actor — not permitted. */
const COMERCIAL_ACTOR = {
  userId: 'user-comercial-1',
  email: 'comercial@example.com',
  isAdmin: false,
  isOffice: false,
}

/** Build a router with the backup route registered. */
function makeRouter({
  isAdminRateLimited = () => false,
  readJsonBody = makeReadJsonBody({ action: 'export', destination: 'local' }),
} = {}) {
  const router = createRouter()
  const sendJson = makeSendJson()
  const sendNoContent = makeSendNoContent()
  registerDatabaseBackupRoutes(router, {
    sendJson,
    sendNoContent,
    readJsonBody,
    isAdminRateLimited,
  })
  return router
}

// ── Minimal mock SQL that satisfies buildBackupPayload ─────────────────────────

function makeMockSql() {
  const sql = vi.fn()
  // Tagged-template calls (sql`...`) return minimal rows
  sql.mockImplementation((strings, ...values) => {
    // Detect tagged template by checking if strings is an array with a raw property
    if (Array.isArray(strings) && strings.raw) {
      const query = strings.join('?').toLowerCase()
      if (query.includes('generated_at') || query.includes('now()')) {
        return Promise.resolve([{
          generated_at: new Date('2025-01-01T00:00:00Z'),
          database_name: 'testdb',
          postgres_version: 'PostgreSQL 15.0',
        }])
      }
      // INSERT INTO db_backup_snapshots
      return Promise.resolve([])
    }
    // String-query calls (sql(query, values)) — safeSelectAll uses this path
    const q = typeof strings === 'string' ? strings.toLowerCase() : ''
    if (q.includes('to_regclass')) {
      return Promise.resolve([{ full_name: 'public.clients' }])
    }
    return Promise.resolve([])
  })
  return sql
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Route registration
// ─────────────────────────────────────────────────────────────────────────────

describe('registerDatabaseBackupRoutes — registration', () => {
  it('registers /api/admin/database-backup', () => {
    const router = makeRouter()
    expect(router.match('POST', '/api/admin/database-backup')).toBeTypeOf('function')
  })

  it('wildcard method matches OPTIONS and DELETE (method guard is inside the handler)', () => {
    const router = makeRouter()
    expect(router.match('OPTIONS', '/api/admin/database-backup')).toBeTypeOf('function')
    expect(router.match('DELETE', '/api/admin/database-backup')).toBeTypeOf('function')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. OPTIONS pre-flight
// ─────────────────────────────────────────────────────────────────────────────

describe('OPTIONS /api/admin/database-backup', () => {
  it('returns 204 with Allow: POST,OPTIONS', async () => {
    const router = makeRouter()
    const res = makeRes()
    const fn = router.match('OPTIONS', '/api/admin/database-backup')
    await fn(makeReq('OPTIONS'), res, {})

    expect(res.statusCode).toBe(204)
    expect(res.headers['Allow']).toBe('POST,OPTIONS')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Unsupported method → 405
// ─────────────────────────────────────────────────────────────────────────────

describe('unsupported method → 405', () => {
  it.each(['GET', 'PUT', 'PATCH', 'DELETE'])('%s returns 405', async (method) => {
    const router = makeRouter()
    const res = makeRes()
    const fn = router.match(method, '/api/admin/database-backup')
    await fn(makeReq(method), res, {})

    expect(res.statusCode).toBe(405)
    expect(parseBody(res)).toMatchObject({ error: 'Método não suportado.' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Rate limit → 429
// ─────────────────────────────────────────────────────────────────────────────

describe('rate limit → 429', () => {
  it('returns 429 when isAdminRateLimited returns true', async () => {
    const router = makeRouter({ isAdminRateLimited: () => true })
    const res = makeRes()
    const fn = router.match('POST', '/api/admin/database-backup')
    await fn(makeReq('POST'), res, {})

    expect(res.statusCode).toBe(429)
    expect(parseBody(res)).toMatchObject({ error: 'Too many requests. Try again later.' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Unauthenticated → 401
// ─────────────────────────────────────────────────────────────────────────────

describe('unauthenticated → 401', () => {
  beforeEach(() => {
    getDatabaseClient.mockReturnValue({ sql: makeMockSql() })
  })

  it('returns 401 when resolveActor throws', async () => {
    resolveActor.mockRejectedValue(new Error('Unauthorized'))

    const router = makeRouter()
    const res = makeRes()
    const fn = router.match('POST', '/api/admin/database-backup')
    await fn(makeReq('POST'), res, {})

    expect(res.statusCode).toBe(401)
    expect(parseBody(res)).toMatchObject({ ok: false, error: 'Autenticação obrigatória.' })
  })

  it('returns 401 when resolveActor returns actor without userId', async () => {
    resolveActor.mockResolvedValue({ userId: null, isAdmin: true })

    const router = makeRouter()
    const res = makeRes()
    const fn = router.match('POST', '/api/admin/database-backup')
    await fn(makeReq('POST'), res, {})

    expect(res.statusCode).toBe(401)
    expect(parseBody(res)).toMatchObject({ ok: false, error: 'Autenticação obrigatória.' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Non-admin / insufficient role → 403
// ─────────────────────────────────────────────────────────────────────────────

describe('non-admin → 403', () => {
  beforeEach(() => {
    getDatabaseClient.mockReturnValue({ sql: makeMockSql() })
  })

  it('returns 403 when actor is not admin and not office', async () => {
    resolveActor.mockResolvedValue(COMERCIAL_ACTOR)

    const router = makeRouter()
    const res = makeRes()
    const fn = router.match('POST', '/api/admin/database-backup')
    await fn(makeReq('POST'), res, {})

    expect(res.statusCode).toBe(403)
    expect(parseBody(res)).toMatchObject({ ok: false })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Backup success
// ─────────────────────────────────────────────────────────────────────────────

describe('backup success', () => {
  beforeEach(() => {
    const sql = makeMockSql()
    getDatabaseClient.mockReturnValue({ sql })
    resolveActor.mockResolvedValue(ADMIN_ACTOR)
  })

  it('returns 200 with ok:true and backup payload for admin', async () => {
    const router = makeRouter({
      readJsonBody: makeReadJsonBody({ action: 'export', destination: 'local' }),
    })
    const res = makeRes()
    const fn = router.match('POST', '/api/admin/database-backup')
    await fn(makeReq('POST'), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.ok).toBe(true)
    expect(typeof body.checksumSha256).toBe('string')
    expect(typeof body.fileName).toBe('string')
    expect(body.destination).toBe('local')
  })

  it('returns 200 for office actor', async () => {
    resolveActor.mockResolvedValue(OFFICE_ACTOR)

    const router = makeRouter({
      readJsonBody: makeReadJsonBody({ action: 'export', destination: 'local' }),
    })
    const res = makeRes()
    const fn = router.match('POST', '/api/admin/database-backup')
    await fn(makeReq('POST'), res, {})

    expect(res.statusCode).toBe(200)
    expect(parseBody(res).ok).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Backup service error → 500
// ─────────────────────────────────────────────────────────────────────────────

describe('backup service error → 500', () => {
  it('returns 500 when getDatabaseClient returns null', async () => {
    getDatabaseClient.mockReturnValue(null)
    resolveActor.mockResolvedValue(ADMIN_ACTOR)

    const router = makeRouter()
    const res = makeRes()
    const fn = router.match('POST', '/api/admin/database-backup')
    await fn(makeReq('POST'), res, {})

    expect(res.statusCode).toBe(503)
    expect(parseBody(res)).toMatchObject({ ok: false })
  })

  it('returns 500 when the DB query throws', async () => {
    const sql = vi.fn()
    // First call (tagged template for meta row) throws
    sql.mockImplementation((strings) => {
      if (Array.isArray(strings) && strings.raw) {
        return Promise.reject(new Error('DB connection failed'))
      }
      return Promise.resolve([])
    })
    getDatabaseClient.mockReturnValue({ sql })
    resolveActor.mockResolvedValue(ADMIN_ACTOR)

    const router = makeRouter()
    const res = makeRes()
    const fn = router.match('POST', '/api/admin/database-backup')
    await fn(makeReq('POST'), res, {})

    expect(res.statusCode).toBe(500)
    const body = parseBody(res)
    expect(body.ok).toBe(false)
    expect(typeof body.error).toBe('string')
  })
})
