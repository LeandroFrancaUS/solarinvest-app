/**
 * src/hooks/__tests__/useNavigationState.test.ts
 *
 * Tests for the useNavigationState hook extracted from App.tsx.
 *
 * Covered:
 *   1. Initial state — activePage, activeTab, simulacoesSection defaults
 *   2. localStorage initialisation — persisted values are restored on mount
 *   3. localStorage persistence — state changes are written back
 *   4. lastPrimaryPageRef — tracks last primary-page transition
 *   5. activeSidebarItem — derived from current page/tab/section
 *   6. Sidebar handlers — toggle / navigate / close
 *   7. abrirSimulacoes — section routing + analise permission gate
 *   8. abrirDashboard — calls guard + navigates
 *   9. abrirCarteira — permission gate + guard + navigates
 *  10. abrirCrmCentral — calls guard + navigates
 *  11. abrirGestaoFinanceira — permission gate + guard + navigates
 *  12. abrirDashboardOperacional — permission gate + guard + navigates
 *  13. guardRef pattern — late binding of runWithUnsavedChangesGuard
 */

// Enable React act() flushing in jsdom (React 18 requirement)
// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useNavigationState,
  type UseNavigationStateOptions,
  type UseNavigationStateResult,
} from '../useNavigationState'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type HookRef = { current: UseNavigationStateResult }

function renderHook(opts: UseNavigationStateOptions): {
  result: HookRef
  unmount: () => void
} {
  const result: HookRef = { current: null as unknown as UseNavigationStateResult }
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)

  function Harness() {
    result.current = useNavigationState(opts)
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(Harness))
  })

  return {
    result,
    unmount() {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

// Default permissive options
function makeOptions(override: Partial<UseNavigationStateOptions> = {}): UseNavigationStateOptions {
  return {
    canSeePortfolioEffective: true,
    canSeeFinancialManagementEffective: true,
    canSeeDashboardEffective: true,
    canSeeFinancialAnalysisEffective: true,
    guardRef: { current: null },
    ...override,
  }
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('defaults activePage to "app" when localStorage is empty', () => {
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.activePage).toBe('app')
    unmount()
  })

  it('defaults activeTab to "leasing" when localStorage is empty', () => {
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.activeTab).toBe('leasing')
    unmount()
  })

  it('defaults simulacoesSection to "nova" when localStorage is empty', () => {
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.simulacoesSection).toBe('nova')
    unmount()
  })
})

describe('localStorage initialisation', () => {
  it('restores activePage from localStorage', () => {
    window.localStorage.setItem('solarinvest-active-page', 'dashboard')
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.activePage).toBe('dashboard')
    unmount()
  })

  it('falls back to "app" for unknown activePage values', () => {
    window.localStorage.setItem('solarinvest-active-page', 'unknown-page')
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.activePage).toBe('app')
    unmount()
  })

  it('restores activeTab "vendas" from localStorage', () => {
    window.localStorage.setItem('solarinvest-active-tab', 'vendas')
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.activeTab).toBe('vendas')
    unmount()
  })

  it('restores simulacoesSection from localStorage', () => {
    window.localStorage.setItem('solarinvest-simulacoes-section', 'salvas')
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.simulacoesSection).toBe('salvas')
    unmount()
  })

  it('carteira is a known activePage value', () => {
    window.localStorage.setItem('solarinvest-active-page', 'carteira')
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.activePage).toBe('carteira')
    unmount()
  })
})

describe('localStorage persistence', () => {
  it('persists activePage changes to localStorage', () => {
    const { result, unmount } = renderHook(makeOptions())
    act(() => { result.current.setActivePage('crm') })
    expect(window.localStorage.getItem('solarinvest-active-page')).toBe('crm')
    unmount()
  })

  it('persists activeTab changes to localStorage', () => {
    const { result, unmount } = renderHook(makeOptions())
    act(() => { result.current.setActiveTab('vendas') })
    expect(window.localStorage.getItem('solarinvest-active-tab')).toBe('vendas')
    unmount()
  })

  it('persists simulacoesSection changes to localStorage', () => {
    const { result, unmount } = renderHook(makeOptions())
    act(() => { result.current.abrirSimulacoes('risco') })
    expect(window.localStorage.getItem('solarinvest-simulacoes-section')).toBe('risco')
    unmount()
  })
})

describe('lastPrimaryPageRef', () => {
  it('updates when activePage is a primary page', () => {
    const { result, unmount } = renderHook(makeOptions())
    act(() => { result.current.setActivePage('crm') })
    expect(result.current.lastPrimaryPageRef.current).toBe('crm')
    unmount()
  })

  it('does not update when activePage is not a primary page', () => {
    const { result, unmount } = renderHook(makeOptions())
    act(() => { result.current.setActivePage('crm') })
    act(() => { result.current.setActivePage('settings') }) // not a primary page
    // lastPrimaryPageRef should still be 'crm'
    expect(result.current.lastPrimaryPageRef.current).toBe('crm')
    unmount()
  })
})

describe('activeSidebarItem', () => {
  it('returns "dashboard-home" for dashboard page', () => {
    window.localStorage.setItem('solarinvest-active-page', 'dashboard')
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.activeSidebarItem).toBe('dashboard-home')
    unmount()
  })

  it('returns "propostas-vendas" when activeTab is "vendas" on app page', () => {
    window.localStorage.setItem('solarinvest-active-tab', 'vendas')
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.activeSidebarItem).toBe('propostas-vendas')
    unmount()
  })

  it('returns "simulacoes-nova" for simulacoes page with nova section', () => {
    window.localStorage.setItem('solarinvest-active-page', 'simulacoes')
    window.localStorage.setItem('solarinvest-simulacoes-section', 'nova')
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.activeSidebarItem).toBe('simulacoes-nova')
    unmount()
  })

  it('returns "crm-clientes" for clientes page', () => {
    window.localStorage.setItem('solarinvest-active-page', 'clientes')
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.activeSidebarItem).toBe('crm-clientes')
    unmount()
  })

  it('returns "gestao-financeira-home" for financial-management page', () => {
    window.localStorage.setItem('solarinvest-active-page', 'financial-management')
    const { result, unmount } = renderHook(makeOptions())
    expect(result.current.activeSidebarItem).toBe('gestao-financeira-home')
    unmount()
  })
})

describe('sidebar handlers', () => {
  it('handleSidebarClose sets isSidebarMobileOpen to false', () => {
    const { result, unmount } = renderHook(makeOptions())
    act(() => { result.current.setIsSidebarMobileOpen(true) })
    expect(result.current.isSidebarMobileOpen).toBe(true)
    act(() => { result.current.handleSidebarClose() })
    expect(result.current.isSidebarMobileOpen).toBe(false)
    unmount()
  })
})

describe('abrirSimulacoes', () => {
  it('navigates to simulacoes with specified section', () => {
    const { result, unmount } = renderHook(makeOptions())
    let res: boolean
    act(() => { res = result.current.abrirSimulacoes('salvas') })
    expect(res!).toBe(true)
    expect(result.current.activePage).toBe('simulacoes')
    expect(result.current.simulacoesSection).toBe('salvas')
    unmount()
  })

  it('blocks analise section when canSeeFinancialAnalysisEffective is false', () => {
    const { result, unmount } = renderHook(makeOptions({ canSeeFinancialAnalysisEffective: false }))
    let res: boolean
    act(() => { res = result.current.abrirSimulacoes('analise') })
    expect(res!).toBe(false)
    expect(result.current.activePage).toBe('app') // unchanged
    unmount()
  })

  it('defaults section to "nova" when no section is passed', () => {
    const { result, unmount } = renderHook(makeOptions())
    act(() => { result.current.abrirSimulacoes() })
    expect(result.current.simulacoesSection).toBe('nova')
    unmount()
  })
})

describe('abrirDashboard', () => {
  it('navigates without guard when guardRef is null', async () => {
    const { result, unmount } = renderHook(makeOptions())
    await act(async () => { await result.current.abrirDashboard() })
    expect(result.current.activePage).toBe('dashboard')
    unmount()
  })

  it('calls guard when guardRef is set', async () => {
    const guard = vi.fn(async (action: () => void | Promise<void>) => { await action(); return true })
    const { result, unmount } = renderHook(makeOptions({ guardRef: { current: guard } }))
    await act(async () => { await result.current.abrirDashboard() })
    expect(guard).toHaveBeenCalledOnce()
    expect(result.current.activePage).toBe('dashboard')
    unmount()
  })
})

describe('abrirCarteira', () => {
  it('returns false when canSeePortfolioEffective is false', async () => {
    const { result, unmount } = renderHook(makeOptions({ canSeePortfolioEffective: false }))
    let res: boolean
    await act(async () => { res = await result.current.abrirCarteira() })
    expect(res!).toBe(false)
    expect(result.current.activePage).toBe('app')
    unmount()
  })

  it('navigates to carteira when permitted', async () => {
    const { result, unmount } = renderHook(makeOptions())
    await act(async () => { await result.current.abrirCarteira() })
    expect(result.current.activePage).toBe('carteira')
    unmount()
  })
})

describe('abrirCrmCentral', () => {
  it('navigates to crm page', async () => {
    const { result, unmount } = renderHook(makeOptions())
    await act(async () => { await result.current.abrirCrmCentral() })
    expect(result.current.activePage).toBe('crm')
    unmount()
  })
})

describe('abrirGestaoFinanceira', () => {
  it('returns false when canSeeFinancialManagementEffective is false', async () => {
    const { result, unmount } = renderHook(makeOptions({ canSeeFinancialManagementEffective: false }))
    let res: boolean
    await act(async () => { res = await result.current.abrirGestaoFinanceira() })
    expect(res!).toBe(false)
    expect(result.current.activePage).toBe('app')
    unmount()
  })

  it('navigates when permitted', async () => {
    const { result, unmount } = renderHook(makeOptions())
    await act(async () => { await result.current.abrirGestaoFinanceira() })
    expect(result.current.activePage).toBe('financial-management')
    unmount()
  })
})

describe('abrirDashboardOperacional', () => {
  it('returns false when canSeeDashboardEffective is false', async () => {
    const { result, unmount } = renderHook(makeOptions({ canSeeDashboardEffective: false }))
    let res: boolean
    await act(async () => { res = await result.current.abrirDashboardOperacional() })
    expect(res!).toBe(false)
    expect(result.current.activePage).toBe('app')
    unmount()
  })

  it('navigates when permitted', async () => {
    const { result, unmount } = renderHook(makeOptions())
    await act(async () => { await result.current.abrirDashboardOperacional() })
    expect(result.current.activePage).toBe('operational-dashboard')
    unmount()
  })
})

describe('guardRef late-binding pattern', () => {
  it('uses the latest guard even after it is updated post-hook-call', async () => {
    const guardRef: { current: ((action: () => void | Promise<void>) => Promise<boolean>) | null } = { current: null }
    const { result, unmount } = renderHook(makeOptions({ guardRef }))

    // Install a guard after the hook was called
    const guard = vi.fn(async (action: () => void | Promise<void>) => { await action(); return true })
    guardRef.current = guard

    await act(async () => { await result.current.abrirDashboard() })

    expect(guard).toHaveBeenCalledOnce()
    expect(result.current.activePage).toBe('dashboard')
    unmount()
  })
})

