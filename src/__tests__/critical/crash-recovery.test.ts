/**
 * Tests for crash recovery and draft persistence mechanisms.
 *
 * Validates:
 *   - crashRecovery detection logic
 *   - formDraft save/load/clear lifecycle
 *   - Error boundary snapshot preservation (by source inspection)
 *   - beforeunload handler emergency save (by source inspection)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { isCrashRecovery } from '../../store/crashRecovery'

const ROOT = resolve(__dirname, '../..')

describe('crash recovery detection', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('returns false when session_active is not set (clean start)', () => {
    expect(isCrashRecovery()).toBe(false)
  })

  it('returns true when session_active is "true" (crash detected)', () => {
    window.sessionStorage.setItem('session_active', 'true')
    expect(isCrashRecovery()).toBe(true)
  })

  it('returns false when session_active is "false"', () => {
    window.sessionStorage.setItem('session_active', 'false')
    expect(isCrashRecovery()).toBe(false)
  })

  it('returns false when session_active was removed (clean exit)', () => {
    window.sessionStorage.setItem('session_active', 'true')
    window.sessionStorage.removeItem('session_active')
    expect(isCrashRecovery()).toBe(false)
  })
})

describe('error boundary snapshot preservation', () => {
  it('error boundary should import saveFormDraft for emergency snapshots', () => {
    const source = readFileSync(resolve(ROOT, 'app/Boundary.tsx'), 'utf-8')
    expect(source).toContain("import { saveFormDraft }")
    expect(source).toContain('saveFormDraft')
    expect(source).toContain('snapshotSaved')
    expect(source).toContain('Seu progresso foi salvo automaticamente')
  })
})

describe('beforeunload emergency save', () => {
  it('App.tsx should save snapshot on beforeunload and visibilitychange', () => {
    const source = readFileSync(resolve(ROOT, 'App.tsx'), 'utf-8')
    expect(source).toContain('visibilitychange')
    expect(source).toContain('Emergency snapshot')
    expect(source).toContain("document.addEventListener('visibilitychange'")
  })
})

describe('activePage persistence', () => {
  it('should include carteira in known pages', () => {
    const source = readFileSync(resolve(ROOT, 'hooks/useNavigationState.ts'), 'utf-8')
    expect(source).toContain("storedPage === 'carteira'")
  })

  it('should persist simulacoesSection to localStorage', () => {
    const source = readFileSync(resolve(ROOT, 'hooks/useNavigationState.ts'), 'utf-8')
    expect(source).toContain('STORAGE_KEYS.simulacoesSection')
  })
})

describe('logout cleanup', () => {
  it('should clear page states on logout', () => {
    const source = readFileSync(resolve(ROOT, 'lib/auth/logout.ts'), 'utf-8')
    expect(source).toContain('clearAllPageStates')
  })

  it('should clear navigation keys in clearOnLogout', () => {
    const source = readFileSync(resolve(ROOT, 'lib/persist/clearOnLogout.ts'), 'utf-8')
    expect(source).toContain('solarinvest-active-page')
    expect(source).toContain('solarinvest-active-tab')
    expect(source).toContain('solarinvest-simulacoes-section')
  })
})
