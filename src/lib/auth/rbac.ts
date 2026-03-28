// src/lib/auth/rbac.ts
// Client-side RBAC using Stack Auth's native permissions system.
// Permissions are defined in the Stack Auth dashboard and checked via the client SDK.
//
// Server-side validation is provided by the existing /api/auth/me endpoint which
// reads the role stored in the internal DB (approved = role:admin in Stack Auth →
// role 'admin' in DB). The two are kept in sync by the admin grant process.

import { useUser } from '@stackframe/react'
import { useEffect, useState } from 'react'
import { stackClientApp } from '../../stack/client'
import { PERMISSIONS } from './permissions'

export interface StackRbacState {
  isAdmin: boolean
  /** Human-readable role label in Portuguese. */
  role: string
  /** True while the Stack Auth permission check is in flight. */
  isLoading: boolean
}

/**
 * Returns the current user's admin status and role label derived from Stack Auth
 * native permissions (not metadata and not hardcoded user IDs).
 *
 * Falls back to `{ isAdmin: false, role: 'Usuário' }` when Stack Auth is not
 * configured (e.g. dev / bypass mode) or while permissions are loading.
 *
 * Usage:
 *   const { isAdmin, role, isLoading } = useStackRbac()
 */
export function useStackRbac(): StackRbacState {
  const user = useUser()

  const [state, setState] = useState<StackRbacState>({
    isAdmin: false,
    role: 'Usuário',
    // Start loading only when Stack Auth is configured — otherwise we already know
    // there are no permissions to fetch and we can resolve immediately.
    isLoading: !!stackClientApp,
  })

  useEffect(() => {
    if (!user) {
      setState({ isAdmin: false, role: 'Usuário', isLoading: false })
      return
    }

    let cancelled = false

    Promise.all([
      user.hasPermission(PERMISSIONS.ROLE_ADMIN),
      user.hasPermission(PERMISSIONS.ROLE_COMERCIAL),
      user.hasPermission(PERMISSIONS.ROLE_FINANCEIRO),
    ])
      .then(([isAdminPerm, isComercialPerm, isFinanceiroPerm]) => {
        if (cancelled) return
        const role = isAdminPerm
          ? 'Administrador'
          : isComercialPerm
            ? 'Comercial'
            : isFinanceiroPerm
              ? 'Financeiro'
              : 'Usuário'
        setState({ isAdmin: isAdminPerm, role, isLoading: false })
      })
      .catch((err) => {
        if (cancelled) return
        console.warn(
          '[rbac] Failed to fetch Stack Auth permissions:',
          err instanceof Error ? err.message : String(err),
        )
        setState({ isAdmin: false, role: 'Usuário', isLoading: false })
      })

    return () => {
      cancelled = true
    }
  }, [user]) // re-check when the user identity changes (sign-in / sign-out)

  return state
}
