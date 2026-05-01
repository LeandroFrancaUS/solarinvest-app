// server/__tests__/withRLSContext-fail-closed.spec.js
// Verify that createUserScopedSql (new object API) fails closed when
// sql.transaction is unavailable, instead of silently falling back to
// unscoped raw sql that would expose all rows.

import { describe, it, expect } from 'vitest'
import { createUserScopedSql } from '../database/withRLSContext.js'

describe('createUserScopedSql — fail-closed (new object API)', () => {
  it('throws 503 when sql.transaction is not a function', () => {
    // Simulate a sql driver without transaction support
    const sqlWithoutTransaction = Object.assign(() => Promise.resolve([]), {
      transaction: undefined,
    })

    expect(() =>
      createUserScopedSql(sqlWithoutTransaction, { userId: 'u1', role: 'role_comercial' })
    ).toThrow(/sql\.transaction not available/)
  })

  it('thrown error has statusCode 503', () => {
    const sqlWithoutTransaction = Object.assign(() => Promise.resolve([]), {
      transaction: null,
    })

    let caught = null
    try {
      createUserScopedSql(sqlWithoutTransaction, { userId: 'u1', role: 'role_admin' })
    } catch (e) {
      caught = e
    }

    expect(caught).not.toBeNull()
    expect(caught.statusCode).toBe(503)
  })

  it('still throws when userId is missing (fail-closed on missing auth)', () => {
    const mockSql = Object.assign(() => {}, {
      transaction: () => Promise.resolve([]),
    })

    expect(() =>
      createUserScopedSql(mockSql, { userId: '', role: 'role_admin' })
    ).toThrow(/authentication required/)
  })

  it('still throws when role is missing (fail-closed on missing role)', () => {
    const mockSql = Object.assign(() => {}, {
      transaction: () => Promise.resolve([]),
    })

    expect(() =>
      createUserScopedSql(mockSql, { userId: 'u1', role: '' })
    ).toThrow(/authorization required/)
  })

  it('returns a scoped wrapper when both userId and role are provided', () => {
    const mockSql = Object.assign(() => {}, {
      transaction: () => Promise.resolve([[], [], []]),
    })

    const scoped = createUserScopedSql(mockSql, { userId: 'u1', role: 'role_admin' })
    expect(typeof scoped).toBe('function')
  })
})
