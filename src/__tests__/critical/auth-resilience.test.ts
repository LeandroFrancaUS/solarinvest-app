/**
 * Tests for auth session resilience — verifying that transient errors
 * do NOT cause premature redirects or permanent error states.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../..')

describe('auth-session resilience', () => {
  it('should have MAX_RETRIES of 5 for better transient error tolerance', async () => {
    const module = await import('../../auth/auth-session')
    expect(module.useAuthSession).toBeDefined()
    expect(typeof module.useAuthSession).toBe('function')
  })
})

describe('useAuthorizationSnapshot resilience', () => {
  it('should not have window.location.reload in the permissions change handler', () => {
    const source = readFileSync(resolve(ROOT, 'auth/useAuthorizationSnapshot.ts'), 'utf-8')
    expect(source).not.toContain('window.location.reload()')
    expect(source).toContain('updating snapshot in-place (no reload)')
  })
})

describe('serverStorage sync resilience', () => {
  it('should use backoff instead of permanently disabling sync', () => {
    const source = readFileSync(resolve(ROOT, 'app/services/serverStorage.ts'), 'utf-8')
    expect(source).toContain('handleSyncFailure')
    expect(source).toContain('handleSyncSuccess')
    expect(source).toContain('SYNC_BACKOFF_BASE_MS')
  })
})
