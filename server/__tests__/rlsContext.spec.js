// server/__tests__/rlsContext.spec.js
// Unit tests for server/database/rlsContext.js and server/database/withRls.js
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapBusinessRoleToDatabaseRole, applyRlsContext } from '../database/rlsContext.js'
import { withRlsClient } from '../database/withRls.js'

// ─── mapBusinessRoleToDatabaseRole ────────────────────────────────────────────

describe('mapBusinessRoleToDatabaseRole', () => {
  it('maps "admin" to role_admin', () => {
    expect(mapBusinessRoleToDatabaseRole('admin')).toBe('role_admin')
  })

  it('maps "role_admin" to role_admin (passthrough)', () => {
    expect(mapBusinessRoleToDatabaseRole('role_admin')).toBe('role_admin')
  })

  it('maps "comercial" to role_comercial', () => {
    expect(mapBusinessRoleToDatabaseRole('comercial')).toBe('role_comercial')
  })

  it('maps "role_comercial" to role_comercial (passthrough)', () => {
    expect(mapBusinessRoleToDatabaseRole('role_comercial')).toBe('role_comercial')
  })

  it('maps "financeiro" to role_financeiro', () => {
    expect(mapBusinessRoleToDatabaseRole('financeiro')).toBe('role_financeiro')
  })

  it('maps "role_financeiro" to role_financeiro (passthrough)', () => {
    expect(mapBusinessRoleToDatabaseRole('role_financeiro')).toBe('role_financeiro')
  })

  it('maps "office" to role_office', () => {
    expect(mapBusinessRoleToDatabaseRole('office')).toBe('role_office')
  })

  it('maps "role_office" to role_office (passthrough)', () => {
    expect(mapBusinessRoleToDatabaseRole('role_office')).toBe('role_office')
  })

  it('maps "gerente_comercial" to role_gerente_comercial', () => {
    expect(mapBusinessRoleToDatabaseRole('gerente_comercial')).toBe('role_gerente_comercial')
  })

  it('maps "role_gerente_comercial" to role_gerente_comercial (passthrough)', () => {
    expect(mapBusinessRoleToDatabaseRole('role_gerente_comercial')).toBe('role_gerente_comercial')
  })

  it('throws for an unrecognised role', () => {
    expect(() => mapBusinessRoleToDatabaseRole('superuser')).toThrow(/Unsupported database role mapping/)
  })

  it('throws for null', () => {
    expect(() => mapBusinessRoleToDatabaseRole(null)).toThrow(/Unsupported database role mapping/)
  })

  it('throws for undefined', () => {
    expect(() => mapBusinessRoleToDatabaseRole(undefined)).toThrow(/Unsupported database role mapping/)
  })

  it('throws for empty string', () => {
    expect(() => mapBusinessRoleToDatabaseRole('')).toThrow(/Unsupported database role mapping/)
  })
})

// ─── applyRlsContext ──────────────────────────────────────────────────────────

describe('applyRlsContext', () => {
  it('calls client.query with both set_config calls', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) }
    const actor = { authProviderUserId: 'user-abc-123', role: 'role_admin' }

    await applyRlsContext(mockClient, actor)

    expect(mockClient.query).toHaveBeenCalledOnce()
    const [sql, params] = mockClient.query.mock.calls[0]
    expect(sql).toContain('app.current_user_id')
    expect(sql).toContain('app.current_user_role')
    expect(params).toEqual(['user-abc-123', 'role_admin'])
  })

  it('passes the correct role for each actor type', async () => {
    const roles = [
      'role_admin',
      'role_comercial',
      'role_financeiro',
      'role_office',
      'role_gerente_comercial',
    ]

    for (const role of roles) {
      const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) }
      const actor = { authProviderUserId: 'test-user', role }
      await applyRlsContext(mockClient, actor)
      const [, params] = mockClient.query.mock.calls[0]
      expect(params[1]).toBe(role)
    }
  })
})

// ─── withRlsClient ────────────────────────────────────────────────────────────

// Mock the pool module so withRlsClient can be tested without a real DB.
vi.mock('../database/pgPool.js', () => {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  }
  const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) }
  return { getPgPool: vi.fn().mockReturnValue(mockPool), __mockClient: mockClient, __mockPool: mockPool }
})

describe('withRlsClient', () => {
  let mockClient
  let mockPool

  beforeEach(async () => {
    vi.clearAllMocks()
    const pgPoolModule = await import('../database/pgPool.js')
    mockPool = pgPoolModule.getPgPool()
    mockClient = await mockPool.connect()
    // Reset the mock client's query/release to fresh spies
    mockClient.query = vi.fn().mockResolvedValue({ rows: [] })
    mockClient.release = vi.fn()
    mockPool.connect = vi.fn().mockResolvedValue(mockClient)
    pgPoolModule.getPgPool.mockReturnValue(mockPool)
  })

  it('calls BEGIN, applyRlsContext, fn, and COMMIT in the correct order', async () => {
    const actor = { authProviderUserId: 'user-xyz', role: 'role_comercial' }
    const fn = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] })

    const result = await withRlsClient(actor, fn)

    expect(result).toEqual({ rows: [{ id: 1 }] })
    expect(fn).toHaveBeenCalledWith(mockClient)
    expect(mockClient.release).toHaveBeenCalledOnce()

    const sqlCalls = mockClient.query.mock.calls.map(([sql]) => sql)
    // First call must be BEGIN
    expect(sqlCalls[0]).toBe('BEGIN')
    // Second call must set both RLS session variables
    expect(sqlCalls[1]).toContain('app.current_user_id')
    expect(sqlCalls[1]).toContain('app.current_user_role')
    // Last call must be COMMIT (no ROLLBACK)
    expect(sqlCalls.at(-1)).toBe('COMMIT')
    expect(sqlCalls).not.toContain('ROLLBACK')
  })

  it('calls ROLLBACK (not COMMIT) when fn throws, and re-throws the error', async () => {
    const actor = { authProviderUserId: 'user-fail', role: 'role_admin' }
    const boom = new Error('DB constraint violated')
    const fn = vi.fn().mockRejectedValue(boom)

    await expect(withRlsClient(actor, fn)).rejects.toThrow('DB constraint violated')

    expect(mockClient.release).toHaveBeenCalledOnce()
    const sqlCalls = mockClient.query.mock.calls.map(([sql]) => sql)
    expect(sqlCalls).toContain('ROLLBACK')
    expect(sqlCalls).not.toContain('COMMIT')
  })

  it('releases the client even when COMMIT fails', async () => {
    const actor = { authProviderUserId: 'user-cmt', role: 'role_office' }
    const fn = vi.fn().mockResolvedValue({ rows: [] })

    // Make COMMIT throw
    let callCount = 0
    mockClient.query = vi.fn().mockImplementation((sql) => {
      callCount++
      if (sql === 'COMMIT') return Promise.reject(new Error('Commit failed'))
      return Promise.resolve({ rows: [] })
    })

    await expect(withRlsClient(actor, fn)).rejects.toThrow('Commit failed')
    expect(mockClient.release).toHaveBeenCalledOnce()
  })

  it('passes the correct userId and role to set_config', async () => {
    const actor = { authProviderUserId: 'stack-user-42', role: 'role_financeiro' }
    await withRlsClient(actor, vi.fn().mockResolvedValue(null))

    const rlsCall = mockClient.query.mock.calls.find(([sql]) => sql.includes('app.current_user_id'))
    expect(rlsCall).toBeDefined()
    expect(rlsCall[1]).toEqual(['stack-user-42', 'role_financeiro'])
  })
})

// ─── Role-based access matrix (documentation tests) ──────────────────────────

describe('Role-based access matrix', () => {
  const matrix = [
    // role, canReadAll, canWriteAll, canReadOwn, canWriteOwn
    { role: 'role_admin',      canReadAll: true,  canWriteAll: true,  canReadOwn: true,  canWriteOwn: true  },
    { role: 'role_financeiro', canReadAll: true,  canWriteAll: false, canReadOwn: true,  canWriteOwn: false },
    { role: 'role_office',     canReadAll: true,  canWriteAll: false, canReadOwn: true,  canWriteOwn: true  },
    { role: 'role_comercial',  canReadAll: false, canWriteAll: false, canReadOwn: true,  canWriteOwn: true  },
  ]

  for (const { role, canReadAll, canWriteAll, canReadOwn, canWriteOwn } of matrix) {
    describe(role, () => {
      it('maps cleanly to a DatabaseRlsRole', () => {
        expect(() => mapBusinessRoleToDatabaseRole(role)).not.toThrow()
        expect(mapBusinessRoleToDatabaseRole(role)).toBe(role)
      })

      it(`canReadAll = ${canReadAll}`, () => {
        const actual = role === 'role_admin' || role === 'role_financeiro' || role === 'role_office'
        expect(actual).toBe(canReadAll)
      })

      it(`canWriteAll = ${canWriteAll}`, () => {
        const actual = role === 'role_admin'
        expect(actual).toBe(canWriteAll)
      })

      it(`canReadOwn = ${canReadOwn}`, () => {
        // All roles can read their own rows
        expect(canReadOwn).toBe(true)
      })

      it(`canWriteOwn = ${canWriteOwn}`, () => {
        const actual = role !== 'role_financeiro'
        expect(actual).toBe(canWriteOwn)
      })
    })
  }
})
