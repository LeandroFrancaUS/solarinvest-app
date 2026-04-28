// src/hooks/useRouteGuard.ts
// Guards protected pages by redirecting unauthorized users to 'no-permission'.
// Etapa 8: extended to use the frontend permissionMap (hasPermission) so that
// every page — not just the handful previously listed — is route-protected.

import { useEffect } from 'react'
import type { ActivePage, SimulacoesSection } from '../types/navigation'
import { hasPermission, type UserRole } from '../features/auth/permissions'

export interface RouteGuardParams {
  activePage: ActivePage
  simulacoesSection: SimulacoesSection
  isRbacLoading: boolean
  isAdmin: boolean
  /** Resolved frontend role from resolveUserRole(). */
  userRole: UserRole
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
    userRole,
    canSeeFinancialAnalysisEffective,
    canSeeUsersEffective,
    canSeeDashboardEffective,
    canSeePortfolioEffective,
    canSeeFinancialManagementEffective,
    setActivePage,
  } = params

  useEffect(() => {
    if (isRbacLoading) return

    // ── Generic check: frontend permissionMap (Etapa 8) ──────────────────────
    // This covers all pages, including ones previously unguarded (operacao-*,
    // cobrancas-*, indicadores-*, comercial-*).
    if (!hasPermission(userRole, activePage)) {
      setActivePage('no-permission')
      return
    }

    // ── Specific guards: Stack Auth-derived canSee* flags ────────────────────
    // Retained for backward compatibility with the existing permission model.
    // These fire only for ADMIN-fallback users who have specific access revoked
    // via Stack Auth page-level permissions.
    if (activePage === 'settings' && !isAdmin) {
      setActivePage('no-permission')
    } else if (activePage === 'simulacoes' && simulacoesSection === 'analise' && !canSeeFinancialAnalysisEffective) {
      setActivePage('no-permission')
    } else if (activePage === 'admin-users' && !canSeeUsersEffective) {
      setActivePage('no-permission')
    } else if (activePage === 'dashboard' && !canSeeDashboardEffective) {
      setActivePage('no-permission')
    } else if (activePage === 'carteira' && !canSeePortfolioEffective) {
      setActivePage('no-permission')
    } else if (activePage === 'financial-management' && !canSeeFinancialManagementEffective) {
      setActivePage('no-permission')
    }
  }, [activePage, simulacoesSection, isAdmin, userRole, canSeeFinancialAnalysisEffective, canSeeUsersEffective, canSeeDashboardEffective, canSeePortfolioEffective, canSeeFinancialManagementEffective, isRbacLoading, setActivePage])
}
