// src/hooks/useRouteGuard.ts
// Extracted from App.tsx. Guards protected pages by redirecting unauthorized
// users back to 'app' once RBAC permissions have been resolved.
// Zero behavioural change — exact same useEffect logic as the original inline block.

import { useEffect } from 'react'
import type { ActivePage, SimulacoesSection } from '../types/navigation'

export interface RouteGuardParams {
  activePage: ActivePage
  simulacoesSection: SimulacoesSection
  isRbacLoading: boolean
  isAdmin: boolean
  canSeeFinancialAnalysisEffective: boolean
  canSeeUsersEffective: boolean
  canSeeDashboardEffective: boolean
  canSeePortfolioEffective: boolean
  canSeeFinancialManagementEffective: boolean
  setActivePage: (page: ActivePage) => void
}

export function useRouteGuard(params: RouteGuardParams): void {
  const {
    activePage,
    simulacoesSection,
    isRbacLoading,
    isAdmin,
    canSeeFinancialAnalysisEffective,
    canSeeUsersEffective,
    canSeeDashboardEffective,
    canSeePortfolioEffective,
    canSeeFinancialManagementEffective,
    setActivePage,
  } = params

  useEffect(() => {
    if (isRbacLoading) return
    if (activePage === 'settings' && !isAdmin) {
      setActivePage('app')
    } else if (activePage === 'simulacoes' && simulacoesSection === 'analise' && !canSeeFinancialAnalysisEffective) {
      setActivePage('app')
    } else if (activePage === 'admin-users' && !canSeeUsersEffective) {
      setActivePage('app')
    } else if (activePage === 'dashboard' && !canSeeDashboardEffective) {
      setActivePage('app')
    } else if (activePage === 'carteira' && !canSeePortfolioEffective) {
      setActivePage('app')
    } else if (activePage === 'financial-management' && !canSeeFinancialManagementEffective) {
      setActivePage('app')
    }
  }, [activePage, simulacoesSection, isAdmin, canSeeFinancialAnalysisEffective, canSeeUsersEffective, canSeeDashboardEffective, canSeePortfolioEffective, canSeeFinancialManagementEffective, isRbacLoading, setActivePage])
}
