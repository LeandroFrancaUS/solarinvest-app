// server/adapters/__tests__/integration/authAdapter.integration.spec.js
//
// Integration tests for AuthAdapter.
// These do not require a DB — they validate role resolution against the
// production app_user_access role values used by the real system.
// Always runs (no INTEGRATION_TEST_DB_URL guard).
// @integration

import { describe, it, expect } from 'vitest'
import { fromStackUser, fromPermissions, hasMinimumRole } from '../../authAdapter.js'

describe('AuthAdapter [integration — no DB required]', () => {
  it('resolves the full role hierarchy correctly', () => {
    const roles = [
      { perm: 'role_admin',            expected: 'role_admin' },
      { perm: 'role_office',           expected: 'role_office' },
      { perm: 'role_financeiro',       expected: 'role_financeiro' },
      { perm: 'role_gerente_comercial',expected: 'role_gerente_comercial' },
      { perm: 'role_comercial',        expected: 'role_comercial' },
    ]

    for (const { perm, expected } of roles) {
      const actor = fromStackUser({ id: `user-${perm}` }, perm)
      expect(actor.role).toBe(expected)
    }
  })

  it('hasMinimumRole enforces the correct privilege order', () => {
    const matrix = [
      // [actorRole,                  minimumRequired,             expected]
      ['role_admin',              'role_admin',             true ],
      ['role_admin',              'role_comercial',         true ],
      ['role_office',             'role_admin',             false],
      ['role_office',             'role_financeiro',        true ],
      ['role_financeiro',         'role_office',            false],
      ['role_financeiro',         'role_comercial',         true ],
      ['role_comercial',          'role_financeiro',        false],
      ['role_comercial',          'role_comercial',         true ],
    ]

    for (const [actorRole, minimum, expected] of matrix) {
      const result = hasMinimumRole({ role: actorRole }, minimum)
      expect(result, `${actorRole} >= ${minimum}`).toBe(expected)
    }
  })

  it('fromPermissions always produces a valid DB role string', () => {
    const validRoles = new Set([
      'role_admin', 'role_office', 'role_financeiro',
      'role_gerente_comercial', 'role_comercial',
    ])

    const testCases = [
      [],
      ['role_admin'],
      ['role_comercial', 'role_financeiro'],
      ['unknown_perm'],
      null,
    ]

    for (const perms of testCases) {
      const role = fromPermissions(perms)
      expect(validRoles.has(role), `fromPermissions(${JSON.stringify(perms)}) returned "${role}"`).toBe(true)
    }
  })
})
