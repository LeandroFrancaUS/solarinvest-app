/**
 * src/hooks/__tests__/useStorageHydration.test.ts
 *
 * Tests for the useStorageHydration hook extracted from App.tsx.
 *
 * Covered:
 *   1. Initial state — authSyncKey=0, isHydrating=false
 *   2. authSyncKey increments once when userId becomes available
 *   3. Token providers are registered when userId is set
 *   4. No auth-side-effects fire when userId is null
 *   5. Form draft is loaded and the applyDraftRef callback is called on mount
 *   6. isHydrating is toggled true→false around the draft apply call
 *   7. Recovery notification is dispatched with client name when draft contains one
 *   8. Recovery notification falls back to generic message when client.nome is empty
 *   9. No draft callback — no crash when applyDraftRef.current is null
 */

// Enable React act() flushing in jsdom (React 18 requirement)
// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useStorageHydration,
  type UseStorageHydrationOptions,
  type UseStorageHydrationResult,
} from '../useStorageHydration'

// ---------------------------------------------------------------------------
// Module mocks — isolate all external I/O from the hook under test
// ---------------------------------------------------------------------------

vi.mock('../../app/services/serverStorage', () => ({
  setStorageTokenProvider: vi.fn(),
  ensureServerStorageSync: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/api/proposalsApi', () => ({
  setProposalsTokenProvider: vi.fn(),
}))

vi.mock('../../lib/api/clientsApi', () => ({
  setClientsTokenProvider: vi.fn(),
}))

vi.mock('../../services/auth/admin-users', () => ({
  setAdminUsersTokenProvider: vi.fn(),
}))

vi.mock('../../services/clientPortfolioApi', () => ({
  setPortfolioTokenProvider: vi.fn(),
}))

vi.mock('../../services/financialManagementApi', () => ({
  setFinancialManagementTokenProvider: vi.fn(),
}))

vi.mock('../../services/revenueBillingApi', () => ({
  setRevenueBillingTokenProvider: vi.fn(),
}))

vi.mock('../../services/projectsApi', () => ({
  setProjectsTokenProvider: vi.fn(),
}))

vi.mock('../../features/project-finance/api', () => ({
  setProjectFinanceTokenProvider: vi.fn(),
}))

vi.mock('../../services/financialImportApi', () => ({
  setFinancialImportTokenProvider: vi.fn(),
}))

vi.mock('../../services/invoicesApi', () => ({
  setInvoicesTokenProvider: vi.fn(),
}))

vi.mock('../../lib/api/operationalDashboardApi', () => ({
  setOperationalDashboardTokenProvider: vi.fn(),
}))

vi.mock('../../lib/migrateLocalStorageToServer', () => ({
  setMigrationTokenProvider: vi.fn(),
  migrateLocalStorageToServer: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/auth/fetchWithStackAuth', () => ({
  setFetchAuthTokenProvider: vi.fn(),
}))

const mockLoadFormDraft = vi.fn<() => Promise<unknown>>()

vi.mock('../../lib/persist/formDraft', () => ({
  loadFormDraft: () => mockLoadFormDraft(),
}))

// ---------------------------------------------------------------------------
// Minimal renderHook that works with React 18 + jsdom (no @testing-library)
// ---------------------------------------------------------------------------

type HookRef = { current: UseStorageHydrationResult }

function renderHook(
  buildOptions: () => UseStorageHydrationOptions,
): {
  result: HookRef
  rerender: (buildOptions: () => UseStorageHydrationOptions) => void
  unmount: () => void
} {
  const result: HookRef = { current: null as unknown as UseStorageHydrationResult }
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)

  let currentOptions = buildOptions()

  function TestComponent() {
    // Pass options directly so the hook uses the exact same applyDraftRef the
    // test controls, rather than a shadowing useRef created inside this wrapper.
    result.current = useStorageHydration(currentOptions)
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(TestComponent))
  })

  return {
    result,
    rerender(newBuildOptions) {
      currentOptions = newBuildOptions()
      act(() => {
        root.render(React.createElement(TestComponent))
      })
    },
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockGetAccessToken = vi.fn((): Promise<null> => Promise.resolve(null))

function makeOptions(
  override: Partial<UseStorageHydrationOptions> = {},
): UseStorageHydrationOptions {
  const applyDraftRef = { current: null as ((data: unknown) => void) | null }
  return {
    userId: null,
    getAccessToken: mockGetAccessToken,
    applyDraftRef,
    onNotify: vi.fn(),
    ...override,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useStorageHydration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadFormDraft.mockResolvedValue(null)
  })

  afterEach(() => {
    // nothing to clean up — each test creates its own container
  })

  // 1. Initial state
  it('starts with authSyncKey=0 and isHydrating=false', () => {
    const { result, unmount } = renderHook(() => makeOptions())

    expect(result.current.authSyncKey).toBe(0)
    expect(result.current.isHydrating).toBe(false)
    expect(result.current.isHydratingRef.current).toBe(false)

    unmount()
  })

  // 2. authSyncKey increments when userId is provided
  it('increments authSyncKey when userId becomes available', async () => {
    const { result, unmount } = renderHook(() => makeOptions({ userId: 'user-123' }))

    // The auth effect fires after mount — flush microtasks
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    expect(result.current.authSyncKey).toBeGreaterThan(0)
    unmount()
  })

  // 3. Token providers registered
  it('calls setStorageTokenProvider with getAccessToken when userId is set', async () => {
    const { setStorageTokenProvider } = await import('../../app/services/serverStorage')
    const { result, unmount } = renderHook(() => makeOptions({ userId: 'user-abc' }))

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    expect(setStorageTokenProvider).toHaveBeenCalledWith(mockGetAccessToken)
    expect(result.current.authSyncKey).toBe(1)
    unmount()
  })

  // 4. No side effects when userId is null
  it('does not call setStorageTokenProvider when userId is null', async () => {
    const { setStorageTokenProvider } = await import('../../app/services/serverStorage')
    const { unmount } = renderHook(() => makeOptions({ userId: null }))

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    expect(setStorageTokenProvider).not.toHaveBeenCalled()
    unmount()
  })

  // 5. Form draft callback is called with loaded data
  it('calls applyDraftRef.current with the loaded draft data on mount', async () => {
    const draftData = { cliente: { nome: 'Acme Corp' }, kcKwhMes: 450 }
    mockLoadFormDraft.mockResolvedValue({ version: 1, updatedAt: new Date().toISOString(), data: draftData })

    const applyFn = vi.fn()
    const applyDraftRef = { current: applyFn as ((data: unknown) => void) | null }

    const { unmount } = renderHook(() =>
      makeOptions({ applyDraftRef }),
    )

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 50))
    })

    expect(applyFn).toHaveBeenCalledOnce()
    expect(applyFn).toHaveBeenCalledWith(draftData)
    unmount()
  })

  // 6. isHydrating toggles true → false around the draft apply
  it('toggles isHydrating true then false during draft application', async () => {
    const hydratingValues: boolean[] = []

    const draftData = { cliente: { nome: 'Test' } }
    mockLoadFormDraft.mockResolvedValue({ version: 1, updatedAt: '', data: draftData })

    const applyDraftRef: { current: ((data: unknown) => void) | null } = {
      current: null,
    }

    let capturedRef: React.MutableRefObject<boolean> | null = null

    const { result, unmount } = renderHook(() =>
      makeOptions({ applyDraftRef }),
    )

    // Capture the isHydratingRef after first render
    capturedRef = result.current.isHydratingRef

    // Override apply to record isHydrating at call time
    applyDraftRef.current = () => {
      hydratingValues.push(capturedRef?.current ?? false)
    }

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 50))
    })

    // isHydrating should have been true during apply, then false after
    expect(hydratingValues[0]).toBe(true)
    expect(result.current.isHydrating).toBe(false)
    expect(result.current.isHydratingRef.current).toBe(false)
    unmount()
  })

  // 7. Recovery notification with client name
  it('sends a named recovery notification when draft has a client name', async () => {
    const draftData = { cliente: { nome: 'João Silva' } }
    mockLoadFormDraft.mockResolvedValue({ version: 1, updatedAt: '', data: draftData })

    const onNotify = vi.fn()
    const applyDraftRef = { current: vi.fn() as ((data: unknown) => void) | null }

    const { unmount } = renderHook(() =>
      makeOptions({ applyDraftRef, onNotify }),
    )

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 50))
    })

    expect(onNotify).toHaveBeenCalledWith('Progresso recuperado: João Silva', 'info')
    unmount()
  })

  // 8. Generic recovery notification when client name is empty
  it('sends a generic recovery notification when client.nome is empty', async () => {
    const draftData = { cliente: { nome: '' } }
    mockLoadFormDraft.mockResolvedValue({ version: 1, updatedAt: '', data: draftData })

    const onNotify = vi.fn()
    const applyDraftRef = { current: vi.fn() as ((data: unknown) => void) | null }

    const { unmount } = renderHook(() =>
      makeOptions({ applyDraftRef, onNotify }),
    )

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 50))
    })

    expect(onNotify).toHaveBeenCalledWith('Progresso recuperado automaticamente', 'info')
    unmount()
  })

  // 9. No crash when applyDraftRef.current is null
  it('does not crash when applyDraftRef.current is null and draft exists', async () => {
    const draftData = { cliente: { nome: 'Test' } }
    mockLoadFormDraft.mockResolvedValue({ version: 1, updatedAt: '', data: draftData })

    const applyDraftRef = { current: null as ((data: unknown) => void) | null }

    const { result, unmount } = renderHook(() =>
      makeOptions({ applyDraftRef }),
    )

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 50))
    })

    // Should not throw; hydration guard should be cleared even if callback was null
    expect(result.current.isHydrating).toBe(false)
    unmount()
  })
})
