// src/lib/proposals/useProposalsRbac.ts
// RBAC helpers for proposal actions — purely client-side UI guards.
// The backend enforces real security; these hooks only control UI visibility.

import { useStackRbac } from '../auth/rbac'

export interface ProposalsRbacState {
  /** True when RBAC state is still loading. */
  isLoading: boolean
  /** True when the user can create/edit proposals (role_admin or role_comercial). */
  canWrite: boolean
  /** True when the user can read proposals (any recognized role). */
  canRead: boolean
  /** True when the user has read-only access (role_financeiro only). */
  isReadOnly: boolean
}

/**
 * Returns proposal-specific RBAC flags derived from Stack Auth permissions.
 *
 * UI usage:
 *   const { canWrite, isReadOnly, isLoading } = useProposalsRbac()
 *   if (!canWrite) { hide create/edit buttons }
 */
export function useProposalsRbac(): ProposalsRbacState {
  const { isAdmin, isComercial, isOffice, isFinanceiro, isLoading } = useStackRbac()

  const canRead = isAdmin || isComercial || isOffice || isFinanceiro
  const canWrite = isAdmin || isComercial || isOffice
  const isReadOnly = isFinanceiro && !isAdmin && !isComercial && !isOffice

  return { isLoading, canRead, canWrite, isReadOnly }
}
