// server/__tests__/db-info-route.spec.js
// Tests for server/routes/dbInfo.js (registerDbInfoRoutes).
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter } from '../router.js'
import { registerDbInfoRoutes } from '../routes/dbInfo.js'

vi.mock('../proposals/permissions.js', () => ({
  resolveActor: vi.fn(),
  actorRole: vi.fn(),
}))

function makeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    get headersSent() { return res.body !== null },
    setHeader(key, val) { res.headers[key] = val },
    end(body) { res.body = body },
  }
  return res
}

function parseBody(res) {
  return JSON.parse(res.body)
}

function makeReq(url = '/api/db-info') {
  return { url }
}

describe('registerDbInfoRoutes — route registration', () => {
  it('registers /api/db-info', () => {
    const router = createRouter()
    registerDbInfoRoutes(router, { databaseClient: null, databaseConfig: {} })
    expect(router.match('GET', '/api/db-info')).toBeTypeOf('function')
    expect(router.size).toBe(1)
  })
})

describe('/api/db-info handler', () => {
  let mockSql

  beforeEach(async () => {
    const perms = await import('../proposals/permissions.js')
    mockSql = vi.fn().mockResolvedValue([{
      db_name: 'testdb',
      db_schema: 'public',
      db_user: 'app_user',
    }])
    perms.resolveActor.mockResolvedValue({ userId: 'u1', permissions: ['role_admin'] })
    perms.actorRole.mockReturnValue('role_admin')
  })

  it('returns 401 when actor is null', async () => {
    const { resolveActor } = await import('../proposals/permissions.js')
    resolveActor.mockResolvedValueOnce(null)

    const router = createRouter()
    registerDbInfoRoutes(router, { databaseClient: { sql: mockSql }, databaseConfig: { connectionString: 'postgres://x' } })

    const res = makeRes()
    await router.match('GET', '/api/db-info')(makeReq(), res, {})

    expect(res.statusCode).toBe(401)
    expect(parseBody(res).error).toMatch(/autenticação/i)
  })

  it('returns 403 when actor is not role_admin', async () => {
    const perms = await import('../proposals/permissions.js')
    perms.actorRole.mockReturnValueOnce('role_comercial')

    const router = createRouter()
    registerDbInfoRoutes(router, { databaseClient: { sql: mockSql }, databaseConfig: { connectionString: 'postgres://x' } })

    const res = makeRes()
    await router.match('GET', '/api/db-info')(makeReq(), res, {})

    expect(res.statusCode).toBe(403)
    expect(parseBody(res).error).toMatch(/admin/i)
  })

  it('returns 503 when databaseClient is null', async () => {
    const router = createRouter()
    registerDbInfoRoutes(router, { databaseClient: null, databaseConfig: {} })

    const res = makeRes()
    await router.match('GET', '/api/db-info')(makeReq(), res, {})

    expect(res.statusCode).toBe(503)
    expect(parseBody(res).error).toBe('DB_NOT_CONFIGURED')
  })

  it('returns 200 with masked DB info on success', async () => {
    const router = createRouter()
    registerDbInfoRoutes(router, {
      databaseClient: { sql: mockSql },
      databaseConfig: {
        connectionString: 'postgres://user:pass@db.neon.tech:5432/testdb',
        source: 'DATABASE_URL',
      },
    })

    const res = makeRes()
    await router.match('GET', '/api/db-info')(makeReq(), res, {})

    expect(res.statusCode).toBe(200)
    const body = parseBody(res)
    expect(body.ok).toBe(true)
    expect(body.db_name).toBe('testdb')
    expect(body.db_schema).toBe('public')
    expect(body.db_user).toBe('app_user')
    // Password must be masked — host should not contain credentials
    expect(body.host).not.toContain('pass')
    expect(body.host).toContain('db.neon.tech')
    expect(body.source).toBe('DATABASE_URL')
  })

  it('returns 500 when DB query throws', async () => {
    const failSql = vi.fn().mockRejectedValue(new Error('connection refused'))
    const router = createRouter()
    registerDbInfoRoutes(router, {
      databaseClient: { sql: failSql },
      databaseConfig: { connectionString: 'postgres://x' },
    })

    const res = makeRes()
    await router.match('GET', '/api/db-info')(makeReq(), res, {})

    expect(res.statusCode).toBe(500)
    expect(parseBody(res).ok).toBe(false)
    expect(parseBody(res).error).toContain('connection refused')
  })
})
