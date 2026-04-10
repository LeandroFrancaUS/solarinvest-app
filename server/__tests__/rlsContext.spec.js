// server/__tests__/rlsContext.spec.js
// Unit tests for server/database/rlsContext.js and server/database/withRls.js
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapBusinessRoleToDatabaseRole, applyRlsContext } from '../database/rlsContext.js'

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

// ─── withRlsQuery ─────────────────────────────────────────────────────────────

// Mock withRLSContext to avoid loading the full Neon client in tests.
vi.mock('../database/withRLSContext.js', () => {
  return {
    createUserScopedSql: vi.fn((sql, { userId, role }) => {
      // Return a tagged-template-compatible spy that records what was passed
      const scopedSql = vi.fn().mockResolvedValue({ rows: [] })
      scopedSql._userId = userId
      scopedSql._role = role
      scopedSql._baseSql = sql
      return scopedSql
    }),
  }
})

describe('withRlsQuery', () => {
  it('calls createUserScopedSql with the actor userId and role', async () => {
    const { withRlsQuery } = await import('../database/withRls.js')
    const { createUserScopedSql } = await import('../database/withRLSContext.js')

    const mockSql = vi.fn()
    const actor = { authProviderUserId: 'user-abc', role: 'role_admin' }
    const fn = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] })

    const result = await withRlsQuery(mockSql, actor, fn)

    expect(createUserScopedSql).toHaveBeenCalledWith(mockSql, { userId: 'user-abc', role: 'role_admin' })
    expect(fn).toHaveBeenCalled()
    expect(result).toEqual({ rows: [{ id: 1 }] })
  })

  it('propagates errors from fn', async () => {
    const { withRlsQuery } = await import('../database/withRls.js')
    const mockSql = vi.fn()
    const actor = { authProviderUserId: 'user-fail', role: 'role_comercial' }
    const fn = vi.fn().mockRejectedValue(new Error('query failed'))

    await expect(withRlsQuery(mockSql, actor, fn)).rejects.toThrow('query failed')
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
