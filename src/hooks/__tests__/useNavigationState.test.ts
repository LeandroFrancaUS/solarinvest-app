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

import React, { act, useRef } from 'react'
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

/** Minimal stub that captures the latest hook result. */
function makeHarness(options: UseNavigationStateOptions) {
  let result: UseNavigationStateResult | null = null

  function Harness() {
    result = useNavigationState(options)
    return null
  }

  return { Harness, getResult: () => result! }
}

// Default permissive options
const defaultOptions = (): UseNavigationStateOptions => ({
  canSeePortfolioEffective: true,
  canSeeFinancialManagementEffective: true,
  canSeeDashboardEffective: true,
  canSeeFinancialAnalysisEffective: true,
  guardRef: { current: null },
})

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let container: HTMLElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  window.localStorage.clear()
})

afterEach(() => {
  if (root) {
    act(() => { root.unmount() })
  }
  container.remove()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('defaults activePage to "app" when localStorage is empty', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    expect(getResult().activePage).toBe('app')
  })

  it('defaults activeTab to "leasing" when localStorage is empty', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    expect(getResult().activeTab).toBe('leasing')
  })

  it('defaults simulacoesSection to "nova" when localStorage is empty', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    expect(getResult().simulacoesSection).toBe('nova')
  })
})

describe('localStorage initialisation', () => {
  it('restores activePage from localStorage', async () => {
    window.localStorage.setItem('solarinvest-active-page', 'dashboard')
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    expect(getResult().activePage).toBe('dashboard')
  })

  it('falls back to "app" for unknown activePage values', async () => {
    window.localStorage.setItem('solarinvest-active-page', 'unknown-page')
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    expect(getResult().activePage).toBe('app')
  })

  it('restores activeTab "vendas" from localStorage', async () => {
    window.localStorage.setItem('solarinvest-active-tab', 'vendas')
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    expect(getResult().activeTab).toBe('vendas')
  })

  it('restores simulacoesSection from localStorage', async () => {
    window.localStorage.setItem('solarinvest-simulacoes-section', 'salvas')
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    expect(getResult().simulacoesSection).toBe('salvas')
  })

  it('carteira is a known activePage value', async () => {
    window.localStorage.setItem('solarinvest-active-page', 'carteira')
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    expect(getResult().activePage).toBe('carteira')
  })
})

describe('localStorage persistence', () => {
  it('persists activePage changes to localStorage', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    await act(() => {
      getResult().setActivePage('crm')
    })
    expect(window.localStorage.getItem('solarinvest-active-page')).toBe('crm')
  })

  it('persists activeTab changes to localStorage', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    await act(() => {
      getResult().setActiveTab('vendas')
    })
    expect(window.localStorage.getItem('solarinvest-active-tab')).toBe('vendas')
  })
})

describe('lastPrimaryPageRef', () => {
  it('updates when activePage is a primary page', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    await act(() => {
      getResult().setActivePage('crm')
    })
    expect(getResult().lastPrimaryPageRef.current).toBe('crm')
  })

  it('does not update when activePage is not a primary page', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    await act(() => {
      getResult().setActivePage('crm')
    })
    await act(() => {
      getResult().setActivePage('settings') // not a primary page
    })
    // lastPrimaryPageRef should still be 'crm'
    expect(getResult().lastPrimaryPageRef.current).toBe('crm')
  })
})

describe('activeSidebarItem', () => {
  it('returns "dashboard-home" for dashboard page', async () => {
    window.localStorage.setItem('solarinvest-active-page', 'dashboard')
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    expect(getResult().activeSidebarItem).toBe('dashboard-home')
  })

  it('returns "propostas-vendas" when activeTab is "vendas" on app page', async () => {
    window.localStorage.setItem('solarinvest-active-tab', 'vendas')
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    expect(getResult().activeSidebarItem).toBe('propostas-vendas')
  })

  it('returns "simulacoes-nova" for simulacoes page with nova section', async () => {
    window.localStorage.setItem('solarinvest-active-page', 'simulacoes')
    window.localStorage.setItem('solarinvest-simulacoes-section', 'nova')
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    expect(getResult().activeSidebarItem).toBe('simulacoes-nova')
  })
})

describe('sidebar handlers', () => {
  it('handleSidebarClose sets isSidebarMobileOpen to false', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    // Force open first
    await act(() => {
      getResult().setIsSidebarMobileOpen(true)
    })
    expect(getResult().isSidebarMobileOpen).toBe(true)
    await act(() => {
      getResult().handleSidebarClose()
    })
    expect(getResult().isSidebarMobileOpen).toBe(false)
  })
})

describe('abrirSimulacoes', () => {
  it('navigates to simulacoes with specified section', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    let result: boolean
    await act(() => {
      result = getResult().abrirSimulacoes('salvas')
    })
    expect(result!).toBe(true)
    expect(getResult().activePage).toBe('simulacoes')
    expect(getResult().simulacoesSection).toBe('salvas')
  })

  it('blocks analise section when canSeeFinancialAnalysisEffective is false', async () => {
    const opts = { ...defaultOptions(), canSeeFinancialAnalysisEffective: false }
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    let result: boolean
    await act(() => {
      result = getResult().abrirSimulacoes('analise')
    })
    expect(result!).toBe(false)
    expect(getResult().activePage).toBe('app') // unchanged
  })

  it('defaults section to "nova" when no section is passed', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    await act(() => {
      getResult().abrirSimulacoes()
    })
    expect(getResult().simulacoesSection).toBe('nova')
  })
})

describe('abrirDashboard', () => {
  it('navigates without guard when guardRef is null', async () => {
    const opts = defaultOptions() // guardRef.current = null
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    await act(async () => {
      await getResult().abrirDashboard()
    })
    expect(getResult().activePage).toBe('dashboard')
  })

  it('calls guard when guardRef is set', async () => {
    const guard = vi.fn(async (action: () => void) => { action(); return true })
    const opts = { ...defaultOptions(), guardRef: { current: guard } }
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    await act(async () => {
      await getResult().abrirDashboard()
    })
    expect(guard).toHaveBeenCalledOnce()
    expect(getResult().activePage).toBe('dashboard')
  })
})

describe('abrirCarteira', () => {
  it('returns false when canSeePortfolioEffective is false', async () => {
    const opts = { ...defaultOptions(), canSeePortfolioEffective: false }
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    let result: boolean
    await act(async () => {
      result = await getResult().abrirCarteira()
    })
    expect(result!).toBe(false)
    expect(getResult().activePage).toBe('app')
  })

  it('navigates to carteira when permitted', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    await act(async () => {
      await getResult().abrirCarteira()
    })
    expect(getResult().activePage).toBe('carteira')
  })
})

describe('abrirCrmCentral', () => {
  it('navigates to crm page', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    await act(async () => {
      await getResult().abrirCrmCentral()
    })
    expect(getResult().activePage).toBe('crm')
  })
})

describe('abrirGestaoFinanceira', () => {
  it('returns false when canSeeFinancialManagementEffective is false', async () => {
    const opts = { ...defaultOptions(), canSeeFinancialManagementEffective: false }
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    let result: boolean
    await act(async () => {
      result = await getResult().abrirGestaoFinanceira()
    })
    expect(result!).toBe(false)
    expect(getResult().activePage).toBe('app')
  })

  it('navigates when permitted', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    await act(async () => {
      await getResult().abrirGestaoFinanceira()
    })
    expect(getResult().activePage).toBe('financial-management')
  })
})

describe('abrirDashboardOperacional', () => {
  it('returns false when canSeeDashboardEffective is false', async () => {
    const opts = { ...defaultOptions(), canSeeDashboardEffective: false }
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    let result: boolean
    await act(async () => {
      result = await getResult().abrirDashboardOperacional()
    })
    expect(result!).toBe(false)
    expect(getResult().activePage).toBe('app')
  })

  it('navigates when permitted', async () => {
    const opts = defaultOptions()
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })
    await act(async () => {
      await getResult().abrirDashboardOperacional()
    })
    expect(getResult().activePage).toBe('operational-dashboard')
  })
})

describe('guardRef late-binding pattern', () => {
  it('uses the latest guard even after it is updated post-hook-call', async () => {
    const guardRef = { current: null as ((action: () => void) => Promise<boolean>) | null }
    const opts = { ...defaultOptions(), guardRef }
    const { Harness, getResult } = makeHarness(opts)
    await act(() => {
      root = createRoot(container)
      root.render(React.createElement(Harness))
    })

    // Install a guard after the hook was called
    const guard = vi.fn(async (action: () => void) => { action(); return true })
    guardRef.current = guard

    await act(async () => {
      await getResult().abrirDashboard()
    })

    expect(guard).toHaveBeenCalledOnce()
    expect(getResult().activePage).toBe('dashboard')
  })
})
