// src/lib/auth/rbac.ts
// Client-side RBAC using Stack Auth's native permissions system.
// Permissions are defined in the Stack Auth dashboard and checked via the client SDK.
//
// Server-side validation is provided by server/auth/stackPermissions.js which
// checks Stack Auth native permissions (JWT claim + admin API) on protected routes.

import { useStackUser } from '../../app/Providers'
import { useEffect, useState } from 'react'
import { stackClientApp } from '../../stack/client'
import { PERMISSIONS } from './permissions'

export interface StackRbacState {
  isAdmin: boolean
  /** Human-readable role label in Portuguese. */
  role: string
  /** True while the Stack Auth permission check is in flight. */
  isLoading: boolean
  /** True when user has page:financial_analysis permission. */
  canSeeFinancialAnalysis: boolean
  /** True when user has page:preferences permission. */
  canSeePreferences: boolean
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
    role: 'Usuário',
    // Start loading only when Stack Auth is configured — otherwise we already know
    // there are no permissions to fetch and we can resolve immediately.
    isLoading: !!stackClientApp,
    canSeeFinancialAnalysis: false,
    canSeePreferences: false,
  })

  useEffect(() => {
    if (!user) {
      setState({ isAdmin: false, role: 'Usuário', isLoading: false, canSeeFinancialAnalysis: false, canSeePreferences: false })
      return
    }

    let cancelled = false

    Promise.all([
      user.hasPermission(PERMISSIONS.ROLE_ADMIN),
      user.hasPermission(PERMISSIONS.ROLE_COMERCIAL),
      user.hasPermission(PERMISSIONS.ROLE_FINANCEIRO),
      user.hasPermission(PERMISSIONS.PAGE_FINANCIAL),
      user.hasPermission(PERMISSIONS.PAGE_PREF),
    ])
      .then(([isAdminPerm, isComercialPerm, isFinanceiroPerm, canFinancial, canPref]) => {
        if (cancelled) return
        const role = isAdminPerm
          ? 'Administrador'
          : isComercialPerm
            ? 'Comercial'
            : isFinanceiroPerm
              ? 'Financeiro'
              : 'Usuário'
        setState({
          isAdmin: isAdminPerm,
          role,
          isLoading: false,
          // role_admin includes page:financial_analysis and page:preferences,
          // so admins automatically get both page-level permissions.
          canSeeFinancialAnalysis: canFinancial || isAdminPerm,
          canSeePreferences: canPref || isAdminPerm,
        })
      })
      .catch((err) => {
        if (cancelled) return
        console.warn(
          '[rbac] Failed to fetch Stack Auth permissions:',
          err instanceof Error ? err.message : String(err),
        )
        setState({ isAdmin: false, role: 'Usuário', isLoading: false, canSeeFinancialAnalysis: false, canSeePreferences: false })
      })

    return () => {
      cancelled = true
    }
  }, [user]) // re-check when the user identity changes (sign-in / sign-out)

  return state
}
