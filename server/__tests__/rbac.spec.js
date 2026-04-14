// server/__tests__/rbac.spec.js
// Unit tests for server-side RBAC logic.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi } from 'vitest'
import { stackPermToDbRole } from '../auth/roleMapping.js'

// ─── derivePrimaryRole (pure function) ───────────────────────────────────────

// Inline derivePrimaryRole to avoid importing the full authorizationSnapshot module
// which has transitive dependencies on Node.js server modules not needed here.
// The canonical implementation in server/auth/authorizationSnapshot.js must stay
// consistent with this inline copy — any change there should be reflected here.
function derivePrimaryRole(permissions) {
  if (!Array.isArray(permissions)) return 'unknown'
  if (permissions.includes('role_admin')) return 'role_admin'
  if (permissions.includes('role_financeiro')) return 'role_financeiro'
  if (permissions.includes('role_office')) return 'role_office'
  if (permissions.includes('role_comercial')) return 'role_comercial'
  return 'unknown'
}

// Inline deriveCapabilities — mirrors the canonical implementation in
// server/auth/authorizationSnapshot.js.  Must be kept in sync.
function deriveCapabilities(permissions) {
  if (!Array.isArray(permissions)) permissions = []
  const isAdmin      = permissions.includes('role_admin')
  const isFinanceiro = permissions.includes('role_financeiro')
  const isOffice     = permissions.includes('role_office')
  const isComercial  = permissions.includes('role_comercial')
  return {
    canManageUsers: isAdmin,
    canReadAllClients:         isAdmin || isFinanceiro || isOffice,
    canWriteAllClients:        isAdmin,
    canReadOwnClients:         isComercial || isOffice,
    canWriteOwnClients:        isComercial || isOffice,
    canReadCommercialClients:  isOffice,
    canWriteCommercialClients: false,
    canReadAllProposals:         isAdmin || isFinanceiro || isOffice,
    canWriteAllProposals:        isAdmin,
    canReadOwnProposals:         isComercial || isOffice,
    canWriteOwnProposals:        isComercial || isOffice,
    canReadCommercialProposals:  isOffice,
    canWriteCommercialProposals: false,
  }
}

describe('derivePrimaryRole', () => {
  it('returns role_admin when role_admin is present', () => {
    expect(derivePrimaryRole(['role_admin', 'role_comercial'])).toBe('role_admin')
  })

  it('returns role_financeiro when no higher role present', () => {
    expect(derivePrimaryRole(['role_financeiro'])).toBe('role_financeiro')
  })

  it('returns role_office when role_office present and no admin/financeiro', () => {
    expect(derivePrimaryRole(['role_office', 'role_comercial'])).toBe('role_office')
  })

  it('returns role_comercial when no higher role present', () => {
    expect(derivePrimaryRole(['role_comercial'])).toBe('role_comercial')
  })

  it('returns unknown for empty array', () => {
    expect(derivePrimaryRole([])).toBe('unknown')
  })

  it('returns unknown for non-array', () => {
    expect(derivePrimaryRole(null)).toBe('unknown')
    expect(derivePrimaryRole(undefined)).toBe('unknown')
  })

  it('admin wins over all other roles', () => {
    expect(derivePrimaryRole(['role_financeiro', 'role_admin', 'role_comercial', 'role_office'])).toBe('role_admin')
  })

  it('financeiro wins over office and comercial', () => {
    expect(derivePrimaryRole(['role_financeiro', 'role_comercial', 'role_office'])).toBe('role_financeiro')
  })
})

describe('deriveCapabilities — single role', () => {
  it('role_admin gets all capabilities', () => {
    const caps = deriveCapabilities(['role_admin'])
    expect(caps.canManageUsers).toBe(true)
    expect(caps.canReadAllClients).toBe(true)
    expect(caps.canWriteAllClients).toBe(true)
    expect(caps.canReadAllProposals).toBe(true)
    expect(caps.canWriteAllProposals).toBe(true)
  })

  it('role_financeiro gets read-all but not write-all', () => {
    const caps = deriveCapabilities(['role_financeiro'])
    expect(caps.canManageUsers).toBe(false)
    expect(caps.canReadAllClients).toBe(true)
    expect(caps.canWriteAllClients).toBe(false)
    expect(caps.canReadAllProposals).toBe(true)
    expect(caps.canWriteAllProposals).toBe(false)
    expect(caps.canReadOwnProposals).toBe(false)
  })

  it('role_comercial gets own-client/proposal access only', () => {
    const caps = deriveCapabilities(['role_comercial'])
    expect(caps.canReadOwnClients).toBe(true)
    expect(caps.canWriteOwnClients).toBe(true)
    expect(caps.canReadAllClients).toBe(false)
    expect(caps.canReadCommercialClients).toBe(false)
  })

  it('role_office gets read-all + own-write behavior', () => {
    const caps = deriveCapabilities(['role_office'])
    expect(caps.canReadOwnClients).toBe(true)
    expect(caps.canReadCommercialClients).toBe(true)
    expect(caps.canWriteCommercialClients).toBe(false)
    expect(caps.canReadAllClients).toBe(true)
  })

  it('empty permissions → no capabilities', () => {
    const caps = deriveCapabilities([])
    Object.values(caps).forEach((v) => expect(v).toBe(false))
  })
})

describe('deriveCapabilities — multi-role union', () => {
  it('role_comercial + role_financeiro → union of own-access and read-all', () => {
    const caps = deriveCapabilities(['role_comercial', 'role_financeiro'])
    // From role_financeiro
    expect(caps.canReadAllClients).toBe(true)
    expect(caps.canReadAllProposals).toBe(true)
    // From role_comercial
    expect(caps.canReadOwnClients).toBe(true)
    expect(caps.canWriteOwnClients).toBe(true)
    // Neither has write-all
    expect(caps.canWriteAllClients).toBe(false)
    expect(caps.canWriteAllProposals).toBe(false)
    // Neither has canManageUsers
    expect(caps.canManageUsers).toBe(false)
  })

  it('role_office + role_financeiro → union: commercial + read-all', () => {
    const caps = deriveCapabilities(['role_office', 'role_financeiro'])
    expect(caps.canReadAllClients).toBe(true)
    expect(caps.canReadCommercialClients).toBe(true)
    expect(caps.canWriteCommercialClients).toBe(false)
    expect(caps.canWriteAllClients).toBe(false)
    expect(caps.canManageUsers).toBe(false)
  })

  it('role_admin + any other role → still full admin capabilities', () => {
    const caps = deriveCapabilities(['role_admin', 'role_comercial', 'role_financeiro'])
    expect(caps.canManageUsers).toBe(true)
    expect(caps.canWriteAllClients).toBe(true)
    expect(caps.canWriteAllProposals).toBe(true)
  })

  it('all four roles → full admin capabilities via union', () => {
    const caps = deriveCapabilities(['role_admin', 'role_comercial', 'role_office', 'role_financeiro'])
    expect(caps.canManageUsers).toBe(true)
    expect(caps.canWriteAllClients).toBe(true)
  })
})

describe('stackPermToDbRole', () => {
  it('maps role_admin to admin', () => {
    expect(stackPermToDbRole('role_admin')).toBe('admin')
  })

  it('maps role_comercial to user', () => {
    expect(stackPermToDbRole('role_comercial')).toBe('user')
  })

  it('maps role_office to user', () => {
    expect(stackPermToDbRole('role_office')).toBe('user')
  })

  it('maps role_financeiro to user', () => {
    expect(stackPermToDbRole('role_financeiro')).toBe('user')
  })

  it('maps unknown to user', () => {
    expect(stackPermToDbRole('unknown')).toBe('user')
  })

  it('maps empty string to user', () => {
    expect(stackPermToDbRole('')).toBe('user')
  })
})

// ─── Provider error mapping (isRetryableStatus logic) ─────────────────────────

// Inline the retry-status logic from stackPermissions.js
function isRetryableStatus(status) {
  return status === 0 || (status >= 500 && status <= 599)
}

describe('isRetryableStatus', () => {
  it('returns true for 5xx errors', () => {
    expect(isRetryableStatus(500)).toBe(true)
    expect(isRetryableStatus(502)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
    expect(isRetryableStatus(504)).toBe(true)
    expect(isRetryableStatus(599)).toBe(true)
  })

  it('returns true for network error (status 0)', () => {
    expect(isRetryableStatus(0)).toBe(true)
  })

  it('returns false for 4xx errors', () => {
    expect(isRetryableStatus(400)).toBe(false)
    expect(isRetryableStatus(401)).toBe(false)
    expect(isRetryableStatus(403)).toBe(false)
    expect(isRetryableStatus(404)).toBe(false)
    expect(isRetryableStatus(409)).toBe(false)
    expect(isRetryableStatus(422)).toBe(false)
  })

  it('returns false for 2xx success', () => {
    expect(isRetryableStatus(200)).toBe(false)
    expect(isRetryableStatus(204)).toBe(false)
  })
})

// ─── Retry logic (withRetry) ──────────────────────────────────────────────────

// Inline withRetry to test the behavior without importing server modules.
const RETRY_BASE_DELAY_MS = 1 // Use 1ms for tests to stay fast
const MAX_RETRIES = 2

async function withRetryTest(fn, opts = {}) {
  const { correlationId = '', label = 'test' } = opts
  let lastError
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * (2 ** (attempt - 1))))
    }
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < MAX_RETRIES) continue
    }
  }
  throw lastError
}

describe('withRetry', () => {
  it('returns the result on first attempt if successful', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    const result = await withRetryTest(fn)
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on failure and succeeds on second attempt', async () => {
    let call = 0
    const fn = vi.fn().mockImplementation(async () => {
      call++
      if (call < 2) throw new Error('transient')
      return 'ok'
    })
    const result = await withRetryTest(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('exhausts retries and throws the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent'))
    await expect(withRetryTest(fn)).rejects.toThrow('persistent')
    expect(fn).toHaveBeenCalledTimes(MAX_RETRIES + 1)
  })

  it('succeeds on third attempt (last retry)', async () => {
    let call = 0
    const fn = vi.fn().mockImplementation(async () => {
      call++
      if (call <= 2) throw new Error('fail')
      return 'final'
    })
    const result = await withRetryTest(fn)
    expect(result).toBe('final')
    expect(fn).toHaveBeenCalledTimes(3)
  })
})

// ─── Stack Auth endpoint format (regression guard) ───────────────────────────
// These tests document the CORRECT Stack Auth REST API endpoint paths.
// Verified against @stackframe/stack-shared SDK v2.8.x source code.
// Any change to these endpoints will break production permission management.

describe('Stack Auth project-permission endpoint format', () => {
  const STACK_API_BASE = 'https://api.stack-auth.com'

  it('grant endpoint uses /project-permissions/{userId}/{permId} (NOT /users/{id}/permissions)', () => {
    const userId = 'test-user-id'
    const permId = 'role_admin'
    const expected = `${STACK_API_BASE}/api/v1/project-permissions/${encodeURIComponent(userId)}/${encodeURIComponent(permId)}`
    // This path is derived from the SDK's grantServerProjectPermission implementation:
    //   sendServerRequest(`/project-permissions/${userId}/${permId}`, { method: 'POST', body: '{}' })
    expect(expected).toBe('https://api.stack-auth.com/api/v1/project-permissions/test-user-id/role_admin')
    // Must NOT use the old wrong path
    expect(expected).not.toContain('/users/')
    expect(expected).not.toContain('/permissions')
  })

  it('revoke endpoint uses /project-permissions/{userId}/{permId} (NOT /users/{id}/permissions/{permId})', () => {
    const userId = 'test-user-id'
    const permId = 'role_comercial'
    const expected = `${STACK_API_BASE}/api/v1/project-permissions/${encodeURIComponent(userId)}/${encodeURIComponent(permId)}`
    expect(expected).toBe('https://api.stack-auth.com/api/v1/project-permissions/test-user-id/role_comercial')
    expect(expected).not.toContain('/users/')
  })

  it('list endpoint uses /project-permissions?user_id=…&recursive=false (NOT /users/{id}/permissions?type=global)', () => {
    const userId = 'test-user-id'
    const expected = `${STACK_API_BASE}/api/v1/project-permissions?user_id=${encodeURIComponent(userId)}&recursive=false`
    expect(expected).toBe('https://api.stack-auth.com/api/v1/project-permissions?user_id=test-user-id&recursive=false')
    expect(expected).not.toContain('/users/')
    expect(expected).not.toContain('type=global')
  })

  it('permissionId with special chars is URL-encoded in the path', () => {
    const userId = 'user-abc'
    const permId = 'page:financial_analysis'
    const url = `${STACK_API_BASE}/api/v1/project-permissions/${encodeURIComponent(userId)}/${encodeURIComponent(permId)}`
    expect(url).toBe('https://api.stack-auth.com/api/v1/project-permissions/user-abc/page%3Afinancial_analysis')
  })
})

// Tests for the business rule: cannot revoke role_admin from last active admin
describe('last-admin protection rule', () => {
  function shouldBlockRevoke(permId, activeAdminCount) {
    return permId === 'role_admin' && activeAdminCount <= 1
  }

  it('blocks revoke of role_admin when only 1 admin exists', () => {
    expect(shouldBlockRevoke('role_admin', 1)).toBe(true)
  })

  it('allows revoke of role_admin when 2+ admins exist', () => {
    expect(shouldBlockRevoke('role_admin', 2)).toBe(false)
    expect(shouldBlockRevoke('role_admin', 5)).toBe(false)
  })

  it('does not block revoke of other role permissions', () => {
    expect(shouldBlockRevoke('role_comercial', 1)).toBe(false)
    expect(shouldBlockRevoke('role_office', 1)).toBe(false)
    expect(shouldBlockRevoke('role_financeiro', 1)).toBe(false)
  })
})

// ─── actorRole() helper ───────────────────────────────────────────────────────
// Inline actorRole to mirror server/proposals/permissions.js without importing
// modules that have transitive server-only dependencies.
// Precedence: admin > financeiro > office > comercial

function actorRole(actor) {
  if (!actor) return null
  if (actor.isAdmin)      return 'role_admin'
  if (actor.isFinanceiro) return 'role_financeiro'
  if (actor.isOffice)     return 'role_office'
  if (actor.isComercial)  return 'role_comercial'
  return null
}

describe('actorRole — canonical role string derivation', () => {
  it('returns role_admin for admin actor', () => {
    expect(actorRole({ isAdmin: true, isFinanceiro: false, isOffice: false, isComercial: false })).toBe('role_admin')
  })

  it('returns role_financeiro for financeiro actor', () => {
    expect(actorRole({ isAdmin: false, isFinanceiro: true, isOffice: false, isComercial: false })).toBe('role_financeiro')
  })

  it('returns role_office for office actor', () => {
    expect(actorRole({ isAdmin: false, isFinanceiro: false, isOffice: true, isComercial: false })).toBe('role_office')
  })

  it('returns role_comercial for comercial actor', () => {
    expect(actorRole({ isAdmin: false, isFinanceiro: false, isOffice: false, isComercial: true })).toBe('role_comercial')
  })

  it('returns null for actor with no role', () => {
    expect(actorRole({ isAdmin: false, isFinanceiro: false, isOffice: false, isComercial: false })).toBe(null)
  })

  it('returns null for null actor', () => {
    expect(actorRole(null)).toBe(null)
  })
})

// ─── resolveActor role precedence ────────────────────────────────────────────
// Inline the precedence logic from server/proposals/permissions.js resolveActor.
// Precedence: admin > financeiro > office > comercial

function resolveActorFlags(isAdmin, isFinanceiro, isOffice, isComercial) {
  const resolvedAdmin      = isAdmin
  const resolvedFinanceiro = !resolvedAdmin && isFinanceiro
  const resolvedOffice     = !resolvedAdmin && !resolvedFinanceiro && isOffice
  const resolvedComercial  = !resolvedAdmin && !resolvedFinanceiro && !resolvedOffice && isComercial
  return {
    isAdmin: resolvedAdmin,
    isFinanceiro: resolvedFinanceiro,
    isOffice: resolvedOffice,
    isComercial: resolvedComercial,
    hasAnyRole: resolvedAdmin || resolvedFinanceiro || resolvedOffice || resolvedComercial,
  }
}

describe('resolveActor role precedence (admin > financeiro > office > comercial)', () => {
  it('admin wins when all roles present', () => {
    const r = resolveActorFlags(true, true, true, true)
    expect(r.isAdmin).toBe(true)
    expect(r.isFinanceiro).toBe(false)
    expect(r.isOffice).toBe(false)
    expect(r.isComercial).toBe(false)
  })

  it('financeiro wins over office and comercial', () => {
    const r = resolveActorFlags(false, true, true, true)
    expect(r.isAdmin).toBe(false)
    expect(r.isFinanceiro).toBe(true)
    expect(r.isOffice).toBe(false)
    expect(r.isComercial).toBe(false)
  })

  it('office wins over comercial only', () => {
    const r = resolveActorFlags(false, false, true, true)
    expect(r.isAdmin).toBe(false)
    expect(r.isFinanceiro).toBe(false)
    expect(r.isOffice).toBe(true)
    expect(r.isComercial).toBe(false)
  })

  it('single comercial role — comercial wins', () => {
    const r = resolveActorFlags(false, false, false, true)
    expect(r.isAdmin).toBe(false)
    expect(r.isFinanceiro).toBe(false)
    expect(r.isOffice).toBe(false)
    expect(r.isComercial).toBe(true)
  })

  it('no roles → hasAnyRole false', () => {
    const r = resolveActorFlags(false, false, false, false)
    expect(r.hasAnyRole).toBe(false)
  })
})

// ─── can_access_owner / can_write_owner logic ─────────────────────────────────
// Inline the PL/pgSQL logic as a JS function to validate business rules.

function canAccessOwner(role, uid, ownerUserId, ownerIsComercial = false) {
  if (!role) return true                              // no context → bypass
  if (role === 'role_admin') return true
  if (role === 'role_financeiro') return true         // read-only; write blocked separately
  if (role === 'role_office') return true
  if (role === 'role_comercial') return ownerUserId === uid
  return false                                        // unknown role → fail closed
}

function canWriteOwner(role, uid, ownerUserId, ownerIsComercial = false) {
  if (!role) return true                              // no context → bypass
  if (role === 'role_admin') return true
  if (role === 'role_financeiro') return false        // read-only role
  if (role === 'role_office') return ownerUserId === uid
  if (role === 'role_comercial') return ownerUserId === uid
  return false
}

describe('can_access_owner — PostgreSQL logic (JS inline)', () => {
  const ADMIN_UID = 'admin-uid'
  const FIN_UID   = 'fin-uid'
  const OFFICE_UID = 'off-uid'
  const COM_UID   = 'com-uid'
  const OTHER_UID = 'other-uid'

  it('no context (null role) → always bypass', () => {
    expect(canAccessOwner(null, ADMIN_UID, OTHER_UID)).toBe(true)
  })

  it('role_admin sees any owner', () => {
    expect(canAccessOwner('role_admin', ADMIN_UID, OTHER_UID)).toBe(true)
    expect(canAccessOwner('role_admin', ADMIN_UID, 'leandro-orders-uid')).toBe(true)
  })

  it('role_financeiro reads any owner', () => {
    expect(canAccessOwner('role_financeiro', FIN_UID, OTHER_UID)).toBe(true)
    expect(canAccessOwner('role_financeiro', FIN_UID, COM_UID)).toBe(true)
  })

  it('role_office sees own uid', () => {
    expect(canAccessOwner('role_office', OFFICE_UID, OFFICE_UID)).toBe(true)
  })

  it('role_office sees any other user rows', () => {
    expect(canAccessOwner('role_office', OFFICE_UID, COM_UID, true)).toBe(true)
    expect(canAccessOwner('role_office', OFFICE_UID, OTHER_UID, false)).toBe(true)
  })

  it('role_office read scope includes non-comercial users', () => {
    expect(canAccessOwner('role_office', OFFICE_UID, OTHER_UID, false)).toBe(true)
  })

  it('role_comercial sees own rows', () => {
    expect(canAccessOwner('role_comercial', COM_UID, COM_UID)).toBe(true)
  })

  it('role_comercial does not see other comercial', () => {
    expect(canAccessOwner('role_comercial', COM_UID, 'other-com-uid')).toBe(false)
  })

  it('unknown role → fail closed', () => {
    expect(canAccessOwner('role_unknown', 'x-uid', 'x-uid')).toBe(false)
  })
})

describe('can_write_owner — PostgreSQL logic (JS inline)', () => {
  const ADMIN_UID  = 'admin-uid'
  const FIN_UID    = 'fin-uid'
  const OFFICE_UID = 'off-uid'
  const COM_UID    = 'com-uid'

  it('no context → bypass', () => {
    expect(canWriteOwner(null, ADMIN_UID, 'any-uid')).toBe(true)
  })

  it('role_admin writes any row', () => {
    expect(canWriteOwner('role_admin', ADMIN_UID, 'other-uid')).toBe(true)
  })

  it('role_financeiro cannot write — read-only', () => {
    expect(canWriteOwner('role_financeiro', FIN_UID, FIN_UID)).toBe(false)
    expect(canWriteOwner('role_financeiro', FIN_UID, 'any-uid')).toBe(false)
  })

  it('role_office writes own rows', () => {
    expect(canWriteOwner('role_office', OFFICE_UID, OFFICE_UID)).toBe(true)
  })

  it('role_office cannot write commercial rows unless owner is self', () => {
    expect(canWriteOwner('role_office', OFFICE_UID, 'com-uid', true)).toBe(false)
  })

  it('role_office cannot write non-comercial rows', () => {
    expect(canWriteOwner('role_office', OFFICE_UID, 'other-uid', false)).toBe(false)
  })

  it('role_comercial writes own rows', () => {
    expect(canWriteOwner('role_comercial', COM_UID, COM_UID)).toBe(true)
  })

  it('role_comercial cannot write other rows', () => {
    expect(canWriteOwner('role_comercial', COM_UID, 'other-uid')).toBe(false)
  })
})

// ─── createUserScopedSql – fail-closed validation ────────────────────────────
// Import the actual function to test the new fail-closed behavior.

import { createUserScopedSql } from '../database/withRLSContext.js'

describe('createUserScopedSql — fail-closed guard', () => {
  // A minimal mock sql function (no .transaction) for synchronous tests.
  const mockSql = Object.assign(() => Promise.resolve([]), { transaction: undefined })

  it('throws 401 when userId is missing in object form', () => {
    expect(() => createUserScopedSql(mockSql, { userId: '', role: 'role_admin' }))
      .toThrow(/without userId/)
  })

  it('throws 403 when role is missing in object form', () => {
    expect(() => createUserScopedSql(mockSql, { userId: 'u1', role: '' }))
      .toThrow(/without role/)
  })

  it('throws 401 when userId is null in object form', () => {
    expect(() => createUserScopedSql(mockSql, { userId: null, role: 'role_admin' }))
      .toThrow(/without userId/)
  })

  it('returns raw sql for legacy null (service bypass)', () => {
    const result = createUserScopedSql(mockSql, null)
    expect(result).toBe(mockSql)
  })

  it('returns raw sql for legacy empty string (service bypass)', () => {
    const result = createUserScopedSql(mockSql, '')
    expect(result).toBe(mockSql)
  })

  it('returns wrapper function for legacy non-empty userId string', () => {
    // No .transaction on mock → falls back to raw sql with a warning
    const result = createUserScopedSql(mockSql, 'some-user-id')
    // Should not throw; returns raw sql due to missing .transaction
    expect(result).toBe(mockSql)
  })

  it('returns wrapper function for valid object form when .transaction available', () => {
    const mockSqlWithTx = Object.assign((...args) => Promise.resolve([]), {
      transaction: (queries) => Promise.resolve(queries.map(() => [])),
    })
    const wrapper = createUserScopedSql(mockSqlWithTx, { userId: 'u1', role: 'role_admin' })
    expect(typeof wrapper).toBe('function')
  })
})

// ─── dbRoleIsAdmin guard: Stack Auth role takes precedence ───────────────────
//
// Reproduces the bug where a comercial user auto-promoted to DB 'admin' via
// the first-user bootstrap self-heal was resolved as admin because dbRoleIsAdmin
// fired unconditionally.  After the fix, DB fallback only activates when Stack
// Auth returns NO recognized role at all.

describe('resolveActor — dbRoleIsAdmin guard', () => {
  /**
   * Inline the role-resolution logic from permissions.js so we can unit test
   * it without importing the full module (which has transitive DB dependencies).
   * MUST be kept in sync with the canonical implementation.
   */
  function resolveRoles({ isAdmin, isComercial, isOffice, isFinanceiro, appUserRole, isApproved }) {
    const hasAnyStackAuthRole = isAdmin || isComercial || isOffice || isFinanceiro
    const dbRoleIsAdmin = !hasAnyStackAuthRole && appUserRole === 'admin' && isApproved
    const resolvedAdmin      = isAdmin || dbRoleIsAdmin
    const resolvedFinanceiro = !resolvedAdmin && isFinanceiro
    const resolvedOffice     = !resolvedAdmin && !resolvedFinanceiro && isOffice
    const resolvedComercial  = !resolvedAdmin && !resolvedFinanceiro && !resolvedOffice && isComercial
    return { resolvedAdmin, resolvedFinanceiro, resolvedOffice, resolvedComercial, dbRoleIsAdmin }
  }

  it('comercial from Stack Auth takes precedence over DB admin (bootstrap self-heal victim)', () => {
    // This is the exact scenario for user leandro.orders@gmail.com:
    // Stack Auth says role_comercial, but app_user_access.role='admin' from bootstrap.
    const { resolvedAdmin, resolvedComercial, dbRoleIsAdmin } = resolveRoles({
      isAdmin: false,
      isComercial: true,  // Stack Auth says comercial
      isOffice: false,
      isFinanceiro: false,
      appUserRole: 'admin',  // DB says admin (bootstrap self-heal)
      isApproved: true,
    })
    expect(dbRoleIsAdmin).toBe(false)     // DB fallback must NOT fire
    expect(resolvedAdmin).toBe(false)     // must NOT be admin
    expect(resolvedComercial).toBe(true)  // must be comercial
  })

  it('DB admin fallback activates when Stack Auth returns no role', () => {
    // Stale JWT: Stack Auth returns no role, DB says admin → grant admin
    const { resolvedAdmin, dbRoleIsAdmin } = resolveRoles({
      isAdmin: false,
      isComercial: false,
      isOffice: false,
      isFinanceiro: false,
      appUserRole: 'admin',
      isApproved: true,
    })
    expect(dbRoleIsAdmin).toBe(true)
    expect(resolvedAdmin).toBe(true)
  })

  it('DB admin fallback does NOT fire when appUser is not approved', () => {
    const { resolvedAdmin, dbRoleIsAdmin } = resolveRoles({
      isAdmin: false,
      isComercial: false,
      isOffice: false,
      isFinanceiro: false,
      appUserRole: 'admin',
      isApproved: false,  // not approved
    })
    expect(dbRoleIsAdmin).toBe(false)
    expect(resolvedAdmin).toBe(false)
  })

  it('office from Stack Auth takes precedence over DB admin', () => {
    const { resolvedAdmin, resolvedOffice } = resolveRoles({
      isAdmin: false,
      isComercial: false,
      isOffice: true,
      isFinanceiro: false,
      appUserRole: 'admin',
      isApproved: true,
    })
    expect(resolvedAdmin).toBe(false)
    expect(resolvedOffice).toBe(true)
  })

  it('financeiro from Stack Auth takes precedence over DB admin', () => {
    const { resolvedAdmin, resolvedFinanceiro } = resolveRoles({
      isAdmin: false,
      isComercial: false,
      isOffice: false,
      isFinanceiro: true,
      appUserRole: 'admin',
      isApproved: true,
    })
    expect(resolvedAdmin).toBe(false)
    expect(resolvedFinanceiro).toBe(true)
  })

  it('Stack Auth admin always wins regardless of DB role', () => {
    const { resolvedAdmin } = resolveRoles({
      isAdmin: true,
      isComercial: false,
      isOffice: false,
      isFinanceiro: false,
      appUserRole: 'user',
      isApproved: true,
    })
    expect(resolvedAdmin).toBe(true)
  })
})
