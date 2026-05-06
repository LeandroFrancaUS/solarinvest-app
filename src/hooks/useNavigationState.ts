// src/hooks/useNavigationState.ts
//
// Extracted from App.tsx. Encapsulates all navigation-related state, side
// effects, sidebar handlers, derived values, and navigation callbacks.
//
// The `guardRef` option follows the same pattern as `applyDraftRef` in
// useStorageHydration: App.tsx creates the ref before calling the hook, then
// keeps `guardRef.current` up-to-date after `runWithUnsavedChangesGuard` is
// defined later in the render body. The callbacks inside the hook always read
// the latest guard via ref so no stale-closure issue arises.
//
// Zero behavioural change — exact same logic as the original App.tsx blocks.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  SIMULACOES_SECTIONS,
  STORAGE_KEYS,
  type TabKey,
} from '../app/config'
import type { ActivePage, SimulacoesSection } from '../types/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

type GuardFn = (action: () => void | Promise<void>) => Promise<boolean>

export interface UseNavigationStateOptions {
  /** RBAC flags used by navigation callbacks to gate access. */
  canSeePortfolioEffective: boolean
  canSeeFinancialManagementEffective: boolean
  canSeeDashboardEffective: boolean
  canSeeFinancialAnalysisEffective: boolean
  /**
   * Mutable ref pointing to the current `runWithUnsavedChangesGuard` callback.
   * App.tsx must keep this ref current after the guard is declared (same ref
   * pattern used by useStorageHydration's applyDraftRef).
   */
  guardRef: React.MutableRefObject<GuardFn | null>
}

export interface UseNavigationStateResult {
  // Page / tab / section state
  activePage: ActivePage
  setActivePage: React.Dispatch<React.SetStateAction<ActivePage>>
  activeTab: TabKey
  setActiveTab: React.Dispatch<React.SetStateAction<TabKey>>
  /** Mutable ref kept in sync with activeTab — used in callbacks to avoid stale closures. */
  activeTabRef: React.MutableRefObject<TabKey>
  simulacoesSection: SimulacoesSection
  setSimulacoesSection: React.Dispatch<React.SetStateAction<SimulacoesSection>>
  pendingFinancialProjectId: string | null
  setPendingFinancialProjectId: React.Dispatch<React.SetStateAction<string | null>>
  /** Ref tracking the last "primary" page for back-navigation from settings / admin. */
  lastPrimaryPageRef: React.MutableRefObject<'dashboard' | 'app' | 'crm' | 'simulacoes'>
  // Sidebar state
  isSidebarCollapsed: boolean
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  isSidebarMobileOpen: boolean
  setIsSidebarMobileOpen: React.Dispatch<React.SetStateAction<boolean>>
  isMobileViewport: boolean
  // Sidebar handlers
  handleSidebarMenuToggle: () => void
  handleSidebarNavigate: () => void
  handleSidebarClose: () => void
  /** Sidebar item ID derived from the current page / tab / section. */
  activeSidebarItem: string
  // Navigation callbacks
  abrirDashboard: () => Promise<boolean>
  abrirCarteira: () => Promise<boolean>
  abrirCrmCentral: () => Promise<boolean>
  abrirGestaoFinanceira: () => Promise<boolean>
  abrirSimulacoes: (section?: SimulacoesSection) => boolean
  abrirDashboardOperacional: () => Promise<boolean>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNavigationState({
  canSeePortfolioEffective,
  canSeeFinancialManagementEffective,
  canSeeDashboardEffective,
  canSeeFinancialAnalysisEffective,
  guardRef,
}: UseNavigationStateOptions): UseNavigationStateResult {

  // ── Page / tab / section state ─────────────────────────────────────────────

  const [activePage, setActivePage] = useState<ActivePage>(() => {
    if (typeof window === 'undefined') {
      return 'app'
    }

    const storedPage = window.localStorage.getItem(STORAGE_KEYS.activePage)
    const isKnownPage =
      storedPage === 'dashboard' ||
      storedPage === 'operational-dashboard' ||
      storedPage === 'app' ||
      storedPage === 'crm' ||
      storedPage === 'consultar' ||
      storedPage === 'clientes' ||
      storedPage === 'settings' ||
      storedPage === 'simulacoes' ||
      storedPage === 'admin-users' ||
      storedPage === 'carteira' ||
      storedPage === 'financial-management'

    return isKnownPage ? (storedPage as ActivePage) : 'app'
  })

  const [pendingFinancialProjectId, setPendingFinancialProjectId] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window === 'undefined') {
      return 'leasing'
    }

    const storedTab = window.localStorage.getItem(STORAGE_KEYS.activeTab)
    return storedTab === 'leasing' || storedTab === 'vendas' ? storedTab : 'leasing'
  })

  // Mutable ref kept in sync with activeTab — avoids stale closures in callbacks.
  const activeTabRef = useRef<TabKey>(activeTab)

  const [simulacoesSection, setSimulacoesSection] = useState<SimulacoesSection>(() => {
    if (typeof window === 'undefined') return 'nova'
    const stored = window.localStorage.getItem(STORAGE_KEYS.simulacoesSection)
    return (stored && (SIMULACOES_SECTIONS as readonly string[]).includes(stored))
      ? (stored as SimulacoesSection)
      : 'nova'
  })

  // ── lastPrimaryPageRef ─────────────────────────────────────────────────────

  const lastPrimaryPageRef = useRef<'dashboard' | 'app' | 'crm' | 'simulacoes'>('app')
  useEffect(() => {
    if (
      activePage === 'dashboard' ||
      activePage === 'app' ||
      activePage === 'crm' ||
      activePage === 'simulacoes'
    ) {
      lastPrimaryPageRef.current = activePage
    }
  }, [activePage])

  // ── Sidebar state ──────────────────────────────────────────────────────────

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.innerWidth < 1000
  })
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  // ── Effects ────────────────────────────────────────────────────────────────

  // Sync activeTabRef so callbacks always see the latest tab.
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // Persist activePage to localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.activePage, activePage)
  }, [activePage])

  // Persist activeTab to localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.activeTab, activeTab)
  }, [activeTab])

  // Persist simulacoesSection to localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.simulacoesSection, simulacoesSection)
  }, [simulacoesSection])

  // Collapse sidebar on narrow viewports.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      const width = window.innerWidth
      if (width <= 920) {
        setIsSidebarCollapsed(false)
      } else {
        setIsSidebarCollapsed(width < 1000)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Track mobile viewport via matchMedia.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(max-width: 920px)')
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches)
      if (!event.matches) {
        setIsSidebarMobileOpen(false)
      }
    }

    setIsMobileViewport(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // ── Sidebar handlers ───────────────────────────────────────────────────────

  const handleSidebarMenuToggle = useCallback(() => {
    if (isMobileViewport) {
      setIsSidebarMobileOpen((previous) => {
        const next = !previous
        if (next) {
          setIsSidebarCollapsed(false)
        }
        return next
      })
      return
    }

    setIsSidebarCollapsed((previous) => !previous)
  }, [isMobileViewport])

  const handleSidebarNavigate = useCallback(() => {
    if (isMobileViewport) {
      setIsSidebarMobileOpen(false)
    }
  }, [isMobileViewport])

  const handleSidebarClose = useCallback(() => {
    setIsSidebarMobileOpen(false)
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeSidebarItem = useMemo(() => {
    if (activePage === 'dashboard') return 'dashboard-home'
    if (activePage === 'crm') return 'crm-central'
    if (activePage === 'clientes') return 'crm-clientes'
    if (activePage === 'carteira') return 'carteira-clientes'
    if (activePage === 'consultar') return 'orcamentos-importar'
    if (activePage === 'settings' || activePage === 'admin-users') return 'gestao-financeira-home'
    if (activePage === 'financial-management') return 'gestao-financeira-home'
    if (activePage === 'simulacoes') return `simulacoes-${simulacoesSection}`
    return activeTab === 'vendas' ? 'propostas-vendas' : 'propostas-leasing'
  }, [activePage, simulacoesSection, activeTab])

  // ── Navigation callbacks ───────────────────────────────────────────────────

  const abrirDashboard = useCallback(async (): Promise<boolean> => {
    const guard = guardRef.current
    if (!guard) {
      setActivePage('dashboard')
      return true
    }
    return guard(() => {
      setActivePage('dashboard')
    })
  }, [guardRef, setActivePage])

  const abrirCarteira = useCallback(async (): Promise<boolean> => {
    if (!canSeePortfolioEffective) return false
    const guard = guardRef.current
    if (!guard) {
      setActivePage('carteira')
      return true
    }
    return guard(() => {
      setActivePage('carteira')
    })
  }, [guardRef, setActivePage, canSeePortfolioEffective])

  const abrirCrmCentral = useCallback(async (): Promise<boolean> => {
    const guard = guardRef.current
    if (!guard) {
      setActivePage('crm')
      return true
    }
    return guard(() => {
      setActivePage('crm')
    })
  }, [guardRef, setActivePage])

  const abrirGestaoFinanceira = useCallback(async (): Promise<boolean> => {
    if (!canSeeFinancialManagementEffective) return false
    const guard = guardRef.current
    if (!guard) {
      setActivePage('financial-management')
      return true
    }
    return guard(() => {
      setActivePage('financial-management')
    })
  }, [guardRef, setActivePage, canSeeFinancialManagementEffective])

  const abrirSimulacoes = useCallback(
    (section?: SimulacoesSection): boolean => {
      if (section === 'analise' && !canSeeFinancialAnalysisEffective) {
        return false
      }
      setSimulacoesSection(section ?? 'nova')
      setActivePage('simulacoes')
      return true
    },
    [setActivePage, setSimulacoesSection, canSeeFinancialAnalysisEffective],
  )

  const abrirDashboardOperacional = useCallback(async (): Promise<boolean> => {
    if (!canSeeDashboardEffective) return false
    const guard = guardRef.current
    if (!guard) {
      setActivePage('operational-dashboard')
      return true
    }
    return guard(() => {
      setActivePage('operational-dashboard')
    })
  }, [guardRef, setActivePage, canSeeDashboardEffective])

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    activePage,
    setActivePage,
    activeTab,
    setActiveTab,
    activeTabRef,
    simulacoesSection,
    setSimulacoesSection,
    pendingFinancialProjectId,
    setPendingFinancialProjectId,
    lastPrimaryPageRef,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isSidebarMobileOpen,
    setIsSidebarMobileOpen,
    isMobileViewport,
    handleSidebarMenuToggle,
    handleSidebarNavigate,
    handleSidebarClose,
    activeSidebarItem,
    abrirDashboard,
    abrirCarteira,
    abrirCrmCentral,
    abrirGestaoFinanceira,
    abrirSimulacoes,
    abrirDashboardOperacional,
  }
}
