// src/hooks/useShellLayout.ts
// Extracted from App.tsx — pure derived shell/layout values and sidebar callbacks.
// Zero behavioural change.

import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SidebarGroup } from '../layout/Sidebar'
import type { ActivePage, SimulacoesSection } from '../types/navigation'
import type { TabKey } from '../app/config'

export interface UseShellLayoutParams {
  // Navigation state
  activePage: ActivePage
  activeTab: TabKey
  simulacoesSection: SimulacoesSection
  // Sidebar state
  isMobileViewport: boolean
  isSidebarCollapsed: boolean
  isSidebarMobileOpen: boolean
  isDesktopSimpleEnabled: boolean
  // Setters
  setIsSidebarCollapsed: Dispatch<SetStateAction<boolean>>
  setIsSidebarMobileOpen: Dispatch<SetStateAction<boolean>>
  // Already-built sidebar groups (built in App.tsx via buildSidebarGroups)
  sidebarGroups: SidebarGroup[]
  // Permissions
  canSeeProposalsEffective: boolean
  canSeeContractsEffective: boolean
  canSeeClientsEffective: boolean
  canSeePortfolioEffective: boolean
  canSeeFinancialAnalysisEffective: boolean
  canSeeFinancialManagementEffective: boolean
}

export interface UseShellLayoutResult {
  // Topbar
  shellTopbarSubtitle: string | undefined
  mobileTopbarSubtitle: string | undefined
  // Content area
  shellContentSubtitle: string | undefined
  shellPageIndicator: string | undefined
  // Sidebar
  mobileSidebarGroups: SidebarGroup[]
  activeSidebarItem: string
  menuButtonLabel: string
  menuButtonExpanded: boolean
  // Callbacks
  handleSidebarMenuToggle: () => void
  handleSidebarNavigate: () => void
  handleSidebarClose: () => void
}

export function useShellLayout(params: UseShellLayoutParams): UseShellLayoutResult {
  const {
    activePage,
    activeTab,
    simulacoesSection,
    isMobileViewport,
    isSidebarCollapsed,
    isSidebarMobileOpen,
    isDesktopSimpleEnabled,
    setIsSidebarCollapsed,
    setIsSidebarMobileOpen,
    sidebarGroups,
    canSeeProposalsEffective,
    canSeeContractsEffective,
    canSeeClientsEffective,
    canSeePortfolioEffective,
    canSeeFinancialAnalysisEffective,
    canSeeFinancialManagementEffective,
  } = params

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
  }, [isMobileViewport, setIsSidebarCollapsed, setIsSidebarMobileOpen])

  const handleSidebarNavigate = useCallback(() => {
    if (isMobileViewport) {
      setIsSidebarMobileOpen(false)
    }
  }, [isMobileViewport, setIsSidebarMobileOpen])

  const handleSidebarClose = useCallback(() => {
    setIsSidebarMobileOpen(false)
  }, [setIsSidebarMobileOpen])

  const contentSubtitle =
    activePage === 'dashboard'
      ? undefined
      : activePage === 'crm'
        ? 'CRM Gestão de Relacionamento e Operações'
        : activePage === 'consultar'
          ? 'Consulta de orçamentos salvos'
          : activePage === 'clientes'
            ? 'Gestão de clientes salvos'
            : activePage === 'simulacoes'
              ? 'Simulações financeiras, risco e aprovação interna'
              : activePage === 'settings'
                ? 'Preferências e integrações da proposta'
                : undefined

  const currentPageIndicator =
    activePage === 'dashboard'
      ? 'Dashboard'
      : activePage === 'crm'
        ? 'Central CRM'
        : activePage === 'consultar'
          ? 'Consultar'
          : activePage === 'clientes'
            ? 'Clientes'
            : activePage === 'simulacoes'
              ? 'Simulações'
              : activePage === 'settings'
                ? 'Configurações'
                : activeTab === 'vendas'
                  ? 'Vendas'
                  : 'Leasing'

  const isSimulacoesMobile = isMobileViewport && activePage === 'simulacoes'
  const shellTopbarSubtitle = isSimulacoesMobile ? undefined : contentSubtitle
  const mobileTopbarSubtitle = isSimulacoesMobile ? undefined : currentPageIndicator
  const shellContentSubtitle = isSimulacoesMobile ? undefined : contentSubtitle
  const shellPageIndicator = isSimulacoesMobile ? undefined : currentPageIndicator

  const mobileAllowedIds = [
    ...(canSeeProposalsEffective ? ['propostas-leasing', 'propostas-vendas'] : []),
    ...(canSeeContractsEffective ? ['propostas-contratos'] : []),
    ...(canSeeClientsEffective || canSeeProposalsEffective ? ['orcamentos-importar'] : []),
    ...(canSeeClientsEffective ? ['crm-clientes'] : []),
    ...(canSeePortfolioEffective ? ['carteira-clientes'] : []),
    ...(canSeeFinancialAnalysisEffective ? ['simulacoes-analise'] : []),
    ...(canSeeFinancialManagementEffective ? ['gestao-financeira-home'] : []),
  ]

  const allSidebarItems = new Map(sidebarGroups.flatMap((group) => group.items.map((item) => [item.id, item])))

  const desktopSimpleSidebarGroups: SidebarGroup[] = sidebarGroups.filter(
    (group) => group.id !== 'simulacoes' && group.id !== 'crm',
  )

  const mobileSidebarGroups: SidebarGroup[] = isMobileViewport
    ? [
        {
          id: 'mobile',
          label: '',
          items: mobileAllowedIds.flatMap((id) => {
            const item = allSidebarItems.get(id)
            return item ? [item] : []
          }),
        },
      ]
    : isDesktopSimpleEnabled
    ? desktopSimpleSidebarGroups
    : sidebarGroups

  const activeSidebarItem =
    activePage === 'dashboard'
      ? 'dashboard-home'
      : activePage === 'crm'
        ? 'crm-central'
        : activePage === 'clientes'
          ? 'crm-clientes'
          : activePage === 'carteira'
            ? 'carteira-clientes'
            : activePage === 'consultar'
              ? 'orcamentos-importar'
          : activePage === 'settings' || activePage === 'admin-users'
                ? 'gestao-financeira-home'
                : activePage === 'financial-management'
                  ? 'gestao-financeira-home'
                  : activePage === 'simulacoes'
                  ? `simulacoes-${simulacoesSection}`
                    : activeTab === 'vendas'
                      ? 'propostas-vendas'
                      : 'propostas-leasing'

  const menuButtonLabel = isMobileViewport
    ? isSidebarMobileOpen
      ? 'Fechar menu Painel SolarInvest'
      : 'Abrir menu Painel SolarInvest'
    : 'Painel SolarInvest'

  const menuButtonExpanded = isMobileViewport ? isSidebarMobileOpen : !isSidebarCollapsed

  return {
    shellTopbarSubtitle,
    mobileTopbarSubtitle,
    shellContentSubtitle,
    shellPageIndicator,
    mobileSidebarGroups,
    activeSidebarItem,
    menuButtonLabel,
    menuButtonExpanded,
    handleSidebarMenuToggle,
    handleSidebarNavigate,
    handleSidebarClose,
  }
}
