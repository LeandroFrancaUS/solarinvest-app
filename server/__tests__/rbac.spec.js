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

// ─── Last-admin protection ────────────────────────────────────────────────────

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
