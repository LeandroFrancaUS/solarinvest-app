import { useCallback } from 'react'
import type { SidebarGroup, SidebarItem } from '../layout/Sidebar'
import type { ActivePage, SimulacoesSection } from '../types/navigation'
import type { TabKey } from '../app/config'

export interface UseShellLayoutParams {
  activePage: ActivePage
  activeTab: TabKey
  simulacoesSection: SimulacoesSection
  isMobileViewport: boolean
  isSidebarMobileOpen: boolean
  isSidebarCollapsed: boolean
  isDesktopSimpleEnabled: boolean
  contentSubtitle: string | undefined
  currentPageIndicator: string
  sidebarGroups: SidebarGroup[]
  canSeeProposalsEffective: boolean
  canSeeContractsEffective: boolean
  canSeeClientsEffective: boolean
  canSeePortfolioEffective: boolean
  canSeeFinancialAnalysisEffective: boolean
  canSeeFinancialManagementEffective: boolean
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  setIsSidebarMobileOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export interface UseShellLayoutResult {
  shellTopbarSubtitle: string | undefined
  mobileTopbarSubtitle: string | undefined
  shellContentSubtitle: string | undefined
  shellPageIndicator: string | undefined
  mobileAllowedIds: string[]
  allSidebarItems: Map<string, SidebarItem>
  mobileSidebarGroups: SidebarGroup[]
  desktopSimpleSidebarGroups: SidebarGroup[]
  activeSidebarItem: string
  menuButtonLabel: string
  menuButtonExpanded: boolean
  handleSidebarMenuToggle: () => void
  handleSidebarNavigate: () => void
  handleSidebarClose: () => void
}

export function useShellLayout({
  activePage,
  activeTab,
  simulacoesSection,
  isMobileViewport,
  isSidebarMobileOpen,
  isSidebarCollapsed,
  isDesktopSimpleEnabled,
  contentSubtitle,
  currentPageIndicator,
  sidebarGroups,
  canSeeProposalsEffective,
  canSeeContractsEffective,
  canSeeClientsEffective,
  canSeePortfolioEffective,
  canSeeFinancialAnalysisEffective,
  canSeeFinancialManagementEffective,
  setIsSidebarCollapsed,
  setIsSidebarMobileOpen,
}: UseShellLayoutParams): UseShellLayoutResult {
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

  const topbarSubtitle = contentSubtitle
  const isSimulacoesMobile = isMobileViewport && activePage === 'simulacoes'
  const mobileTopbarSubtitle = isSimulacoesMobile ? undefined : currentPageIndicator
  const shellTopbarSubtitle = isSimulacoesMobile ? undefined : topbarSubtitle
  const shellContentSubtitle = isSimulacoesMobile ? undefined : contentSubtitle
  const shellPageIndicator = isSimulacoesMobile ? undefined : currentPageIndicator

  const mobileAllowedIds = [
    ...(canSeeProposalsEffective ? ['propostas-leasing', 'propostas-vendas'] : []),
    ...(canSeeContractsEffective ? ['propostas-contratos'] : []),
    ...(canSeeClientsEffective || canSeeProposalsEffective ? ['orcamentos-importar', 'relatorios-pdfs'] : []),
    ...(canSeeClientsEffective ? ['crm-clientes'] : []),
    ...(canSeePortfolioEffective ? ['carteira-clientes'] : []),
    ...(canSeeFinancialAnalysisEffective ? ['simulacoes-analise'] : []),
    ...(canSeeFinancialManagementEffective ? ['cobrancas-mensalidades'] : []),
  ]

  // Flatten all sidebar items (including nested) into a map for quick lookup
  const allSidebarItems = new Map<string, SidebarItem>()
  const collectItems = (items: SidebarItem[]) => {
    for (const item of items) {
      allSidebarItems.set(item.id, item)
      if (item.items) collectItems(item.items)
    }
  }
  for (const group of sidebarGroups) collectItems(group.items)

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

  // Map activePage → sidebar item ID to highlight
  const activeSidebarItem =
    activePage === 'dashboard'
      ? 'dashboard-home'
      : activePage === 'crm'
        ? 'comercial-leads'
        : activePage === 'clientes'
          ? 'crm-clientes'
          : activePage === 'carteira'
            ? 'carteira-clientes'
            : activePage === 'consultar'
              ? 'relatorios-pdfs'
              : activePage === 'settings' || activePage === 'admin-users'
                ? 'configuracoes-home'
                : activePage === 'financial-management'
                  ? 'cobrancas-mensalidades'
                  : activePage === 'operational-dashboard'
                    ? 'operational-dashboard'
                    : activePage === 'simulacoes'
                      ? `simulacoes-${simulacoesSection}`
                      : activePage === 'operacao-agenda'
                        ? 'operacao-agenda'
                        : activePage === 'operacao-chamados'
                          ? 'operacao-chamados'
                          : activePage === 'operacao-manutencoes'
                            ? 'operacao-manutencoes'
                            : activePage === 'operacao-limpezas'
                              ? 'operacao-limpezas'
                              : activePage === 'operacao-seguros'
                                ? 'operacao-seguros'
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
    mobileAllowedIds,
    allSidebarItems,
    mobileSidebarGroups,
    desktopSimpleSidebarGroups,
    activeSidebarItem,
    menuButtonLabel,
    menuButtonExpanded,
    handleSidebarMenuToggle,
    handleSidebarNavigate,
    handleSidebarClose,
  }
}
