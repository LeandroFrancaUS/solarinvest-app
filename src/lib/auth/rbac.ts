// src/lib/auth/rbac.ts
// Client-side RBAC using Stack Auth's native permissions system.
// Permissions are defined in the Stack Auth dashboard and checked via the client SDK.
//
// Server-side validation is provided by server/auth/stackPermissions.js which
// checks Stack Auth native permissions (JWT claim + admin API) on protected routes.

import { useStackUser } from '../../app/stack-context'
import { useEffect, useState } from 'react'
import { stackClientApp } from '../../stack/client'
import { PERMISSIONS } from './permissions'

export interface StackRbacState {
  isAdmin: boolean
  /** True when user has role_comercial (and not role_admin, role_office, or role_financeiro). */
  isComercial: boolean
  /** True when user has role_office (and not role_admin). */
  isOffice: boolean
  /** True when user has role_financeiro (and not role_admin or role_office). */
  isFinanceiro: boolean
  /** Human-readable role label in Portuguese. */
  role: string
  /** True while the Stack Auth permission check is in flight. */
  isLoading: boolean
  /** True when user has page_financial_analysis permission. */
  canSeeFinancialAnalysis: boolean
  /** True when user has page:preferences permission. */
  canSeePreferences: boolean
  /** True when user has page:contracts permission. */
  canSeeContracts: boolean
  /** True when user has page_clients permission. */
  canSeeClients: boolean
  /** True when user has page_proposals permission. */
  canSeeProposals: boolean
  /** True when user has page:users permission. */
  canSeeUsers: boolean
  /** True when user has page:dashboard permission. */
  canSeeDashboard: boolean
}

/**
 * Returns the current user's admin status, role label, and page-level permissions
 * derived from Stack Auth native permissions (not metadata and not hardcoded user IDs).
 *
 * Falls back to all-false/loading when Stack Auth is not configured or while
 * permissions are loading.  The server-side security layer in
 * server/auth/stackPermissions.js enforces these permissions on backend routes.
 *
 * Usage:
 *   const { isAdmin, role, canSeeFinancialAnalysis, canSeePreferences, isLoading } = useStackRbac()
 */
export function useStackRbac(): StackRbacState {
  const user = useStackUser()

  const [state, setState] = useState<StackRbacState>({
    isAdmin: false,
    isComercial: false,
    isOffice: false,
    isFinanceiro: false,
    role: 'Usuário',
    // Start loading only when Stack Auth is configured — otherwise we already know
    // there are no permissions to fetch and we can resolve immediately.
    isLoading: !!stackClientApp,
    canSeeFinancialAnalysis: false,
    canSeePreferences: false,
    canSeeContracts: false,
    canSeeClients: false,
    canSeeProposals: false,
    canSeeUsers: false,
    canSeeDashboard: false,
  })

  useEffect(() => {
    if (!user) {
      setState({ isAdmin: false, isComercial: false, isOffice: false, isFinanceiro: false, role: 'Usuário', isLoading: false, canSeeFinancialAnalysis: false, canSeePreferences: false, canSeeContracts: false, canSeeClients: false, canSeeProposals: false, canSeeUsers: false, canSeeDashboard: false })
      return
    }

    let cancelled = false

    Promise.all([
      user.hasPermission(PERMISSIONS.ROLE_ADMIN),
      user.hasPermission(PERMISSIONS.ROLE_COMERCIAL),
      user.hasPermission(PERMISSIONS.ROLE_OFFICE),
      user.hasPermission(PERMISSIONS.ROLE_FINANCEIRO),
      user.hasPermission(PERMISSIONS.PAGE_FINANCIAL),
      user.hasPermission(PERMISSIONS.PAGE_FINANCIAL_LEGACY),
      user.hasPermission(PERMISSIONS.PAGE_PREF),
      user.hasPermission(PERMISSIONS.PAGE_CONTRACTS),
      user.hasPermission(PERMISSIONS.PAGE_CONTRACTS_LEGACY),
      user.hasPermission(PERMISSIONS.PAGE_CLIENTS),
      user.hasPermission(PERMISSIONS.PAGE_CLIENTS_LEGACY),
      user.hasPermission(PERMISSIONS.PAGE_PROPOSALS),
      user.hasPermission(PERMISSIONS.PAGE_PROPOSALS_LEGACY),
      user.hasPermission(PERMISSIONS.PAGE_USERS),
      user.hasPermission(PERMISSIONS.PAGE_DASHBOARD),
    ])
      .then(([
        isAdminPerm,
        isComercialPerm,
        isOfficePerm,
        isFinanceiroPerm,
        canFinancial,
        canFinancialLegacy,
        canPref,
        canContracts,
        canContractsLegacy,
        canClients,
        canClientsLegacy,
        canProposals,
        canProposalsLegacy,
        canUsers,
        canDashboard,
      ]) => {
        if (cancelled) return
        const resolvedAdmin = isAdminPerm
        const resolvedOffice = !isAdminPerm && isOfficePerm
        const resolvedFinanceiro = !isAdminPerm && !resolvedOffice && isFinanceiroPerm
        const resolvedComercial = !isAdminPerm && !resolvedOffice && !resolvedFinanceiro && isComercialPerm
        const role = resolvedAdmin
          ? 'Administrador'
          : resolvedOffice
            ? 'Office'
            : resolvedFinanceiro
              ? 'Financeiro'
              : resolvedComercial
                ? 'Comercial'
                : 'Usuário'
        setState({
          isAdmin: resolvedAdmin,
          isComercial: resolvedComercial,
          isOffice: resolvedOffice,
          isFinanceiro: resolvedFinanceiro,
          role,
          isLoading: false,
          // role_admin includes all page-level permissions automatically.
          canSeeFinancialAnalysis: canFinancial || canFinancialLegacy || isAdminPerm,
          canSeePreferences: canPref || isAdminPerm,
          canSeeContracts: canContracts || canContractsLegacy || isAdminPerm,
          canSeeClients: canClients || canClientsLegacy || isAdminPerm,
          canSeeProposals: canProposals || canProposalsLegacy || isAdminPerm,
          canSeeUsers: canUsers || isAdminPerm,
          canSeeDashboard: canDashboard || isAdminPerm,
        })
      })
      .catch((err) => {
        if (cancelled) return
        console.warn(
          '[rbac] Failed to fetch Stack Auth permissions:',
          err instanceof Error ? err.message : String(err),
        )
        setState({ isAdmin: false, isComercial: false, isOffice: false, isFinanceiro: false, role: 'Usuário', isLoading: false, canSeeFinancialAnalysis: false, canSeePreferences: false, canSeeContracts: false, canSeeClients: false, canSeeProposals: false, canSeeUsers: false, canSeeDashboard: false })
      })

    return () => {
      cancelled = true
    }
  }, [user]) // re-check when the user identity changes (sign-in / sign-out)

  return state
}
