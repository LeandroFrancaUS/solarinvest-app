// server/adapters/__tests__/authAdapter.spec.js
// Unit tests for server/adapters/authAdapter.js
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect } from 'vitest'
import { fromStackUser, fromPermissions, fromStackUserAndPermissions, hasMinimumRole } from '../authAdapter.js'

const STACK_USER = { id: 'stack-user-xyz', email: 'user@solarinvest.app' }

// ─── fromStackUser ────────────────────────────────────────────────────────────

describe('AuthAdapter.fromStackUser', () => {
  it('returns authProviderUserId and role for admin', () => {
    const actor = fromStackUser(STACK_USER, 'admin')
    expect(actor.authProviderUserId).toBe('stack-user-xyz')
    expect(actor.role).toBe('role_admin')
  })

  it('maps all supported business role aliases', () => {
    const cases = [
      ['admin',               'role_admin'],
      ['role_admin',          'role_admin'],
      ['office',              'role_office'],
      ['role_office',         'role_office'],
      ['financeiro',          'role_financeiro'],
      ['role_financeiro',     'role_financeiro'],
      ['comercial',           'role_comercial'],
      ['role_comercial',      'role_comercial'],
      ['gerente_comercial',   'role_gerente_comercial'],
      ['role_gerente_comercial', 'role_gerente_comercial'],
    ]

    for (const [input, expected] of cases) {
      const actor = fromStackUser(STACK_USER, input)
      expect(actor.role).toBe(expected)
    }
  })

  it('throws when stackUser.id is missing', () => {
    expect(() => fromStackUser({ email: 'x' }, 'admin')).toThrow(TypeError)
  })

  it('throws when stackUser is null', () => {
    expect(() => fromStackUser(null, 'admin')).toThrow(TypeError)
  })

  it('throws for an unrecognised role', () => {
    expect(() => fromStackUser(STACK_USER, 'superuser')).toThrow(/Unsupported database role/)
  })
})

// ─── fromPermissions ──────────────────────────────────────────────────────────

describe('AuthAdapter.fromPermissions', () => {
  it('returns role_admin when permissions include role_admin', () => {
    expect(fromPermissions(['role_admin', 'role_comercial'])).toBe('role_admin')
  })

  it('returns the highest-priority role when multiple are present', () => {
    // role_office > role_financeiro
    expect(fromPermissions(['role_financeiro', 'role_office'])).toBe('role_office')
    // role_financeiro > role_comercial
    expect(fromPermissions(['role_comercial', 'role_financeiro'])).toBe('role_financeiro')
  })

  it('returns role_comercial as fallback when no known role is present', () => {
    expect(fromPermissions(['unknown_perm', 'another_perm'])).toBe('role_comercial')
  })

  it('returns role_comercial for empty permissions array', () => {
    expect(fromPermissions([])).toBe('role_comercial')
  })

  it('returns role_comercial for non-array input', () => {
    expect(fromPermissions(null)).toBe('role_comercial')
    expect(fromPermissions(undefined)).toBe('role_comercial')
  })

  it('handles each role in isolation', () => {
    const roles = [
      'role_admin',
      'role_office',
      'role_financeiro',
      'role_gerente_comercial',
      'role_comercial',
    ]
    for (const role of roles) {
      expect(fromPermissions([role])).toBe(role)
    }
  })
})

// ─── fromStackUserAndPermissions ──────────────────────────────────────────────

describe('AuthAdapter.fromStackUserAndPermissions', () => {
  it('combines user id with resolved role', () => {
    const actor = fromStackUserAndPermissions(STACK_USER, ['role_financeiro'])
    expect(actor.authProviderUserId).toBe('stack-user-xyz')
    expect(actor.role).toBe('role_financeiro')
  })

  it('throws when stackUser.id is missing', () => {
    expect(() => fromStackUserAndPermissions({}, ['role_admin'])).toThrow(TypeError)
  })
})

// ─── hasMinimumRole ───────────────────────────────────────────────────────────

describe('AuthAdapter.hasMinimumRole', () => {
  it('admin satisfies all role requirements', () => {
    const actor = { role: 'role_admin' }
    expect(hasMinimumRole(actor, 'role_admin')).toBe(true)
    expect(hasMinimumRole(actor, 'role_office')).toBe(true)
    expect(hasMinimumRole(actor, 'role_financeiro')).toBe(true)
    expect(hasMinimumRole(actor, 'role_comercial')).toBe(true)
  })

  it('comercial only satisfies comercial requirement', () => {
    const actor = { role: 'role_comercial' }
    expect(hasMinimumRole(actor, 'role_admin')).toBe(false)
    expect(hasMinimumRole(actor, 'role_financeiro')).toBe(false)
    expect(hasMinimumRole(actor, 'role_comercial')).toBe(true)
  })

  it('financeiro satisfies financeiro and comercial requirements', () => {
    const actor = { role: 'role_financeiro' }
    expect(hasMinimumRole(actor, 'role_admin')).toBe(false)
    expect(hasMinimumRole(actor, 'role_financeiro')).toBe(true)
    expect(hasMinimumRole(actor, 'role_gerente_comercial')).toBe(true)
    expect(hasMinimumRole(actor, 'role_comercial')).toBe(true)
  })

  it('returns false for unknown role in actor', () => {
    const actor = { role: 'role_unknown' }
    expect(hasMinimumRole(actor, 'role_comercial')).toBe(false)
  })

  it('returns false when actor is null', () => {
    expect(hasMinimumRole(null, 'role_comercial')).toBe(false)
  })
})
