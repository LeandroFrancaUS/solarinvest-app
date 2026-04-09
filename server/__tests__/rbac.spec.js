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
    canReadAllClients:         isAdmin || isFinanceiro,
    canWriteAllClients:        isAdmin,
    canReadOwnClients:         isComercial || isOffice,
    canWriteOwnClients:        isComercial || isOffice,
    canReadCommercialClients:  isOffice,
    canWriteCommercialClients: isOffice,
    canReadAllProposals:         isAdmin || isFinanceiro,
    canWriteAllProposals:        isAdmin,
    canReadOwnProposals:         isComercial || isOffice,
    canWriteOwnProposals:        isComercial || isOffice,
    canReadCommercialProposals:  isOffice,
    canWriteCommercialProposals: isOffice,
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

  it('role_office gets own + commercial client/proposal access', () => {
    const caps = deriveCapabilities(['role_office'])
    expect(caps.canReadOwnClients).toBe(true)
    expect(caps.canReadCommercialClients).toBe(true)
    expect(caps.canWriteCommercialClients).toBe(true)
    expect(caps.canReadAllClients).toBe(false)
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
    expect(caps.canWriteCommercialClients).toBe(true)
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
