// server/proposals/permissions.js
// RBAC helpers for proposal access control.
//
// Role source-of-truth: Stack Auth native permissions
//   role_admin      → Administrador com acesso total ao sistema
//   role_comercial  → Usuário comum (acesso a clientes e propostas próprias)
//   role_office     → Acesso irrestrito a todos os clientes e propostas (leitura e escrita)
//   role_financeiro → Acesso financeiro (read-only de clientes e propostas)
//
// A request with none of these permissions is rejected with 403.
// When Stack Auth is bypassed (dev/test), the actor is treated as admin.

import { getCurrentAppUser } from '../auth/currentAppUser.js'
import { hasStackPermission } from '../auth/stackPermissions.js'
import { isStackAuthBypassed } from '../auth/stackAuth.js'

const PERM_ADMIN      = 'role_admin'
const PERM_COMERCIAL  = 'role_comercial'
const PERM_OFFICE     = 'role_office'
const PERM_FINANCEIRO = 'role_financeiro'

/**
 * Resolves the full actor context from the incoming request.
 *
 * Roles are determined exclusively by Stack Auth permissions:
 *   isAdmin      → has role_admin
 *   isComercial  → has role_comercial (but not role_admin)
 *   isOffice     → has role_office (but not role_admin or role_comercial)
 *   isFinanceiro → has role_financeiro (but not role_admin, role_comercial, or role_office)
 *
 * Returns the actor object or null when the request is unauthenticated.
 */
export async function resolveActor(req) {
  // Bypass mode (dev/test): treat as admin without hitting Stack Auth
  if (isStackAuthBypassed()) {
    return {
      userId: 'bypass-admin',
      email: 'bypass@solarinvest.info',
      displayName: 'Bypass Admin',
      isAdmin: true,
      isComercial: false,
      isOffice: false,
      isFinanceiro: false,
      hasAnyRole: true,
    }
  }

  // Require a valid Stack Auth session (provides userId/email/displayName)
  const appUser = await getCurrentAppUser(req)
  if (!appUser) return null

  // Resolve roles from Stack Auth permissions (all four in parallel)
  const [isAdmin, isComercial, isOffice, isFinanceiro] = await Promise.all([
    hasStackPermission(req, PERM_ADMIN),
    hasStackPermission(req, PERM_COMERCIAL),
    hasStackPermission(req, PERM_OFFICE),
    hasStackPermission(req, PERM_FINANCEIRO),
  ])

  // Higher-privilege roles take precedence when multiple permissions are assigned
  const resolvedAdmin     = isAdmin
  const resolvedComercial = !isAdmin && isComercial
  const resolvedOffice    = !isAdmin && !isComercial && isOffice
  const resolvedFinanceiro = !isAdmin && !isComercial && !isOffice && isFinanceiro

  return {
    userId: appUser.auth_provider_user_id ?? appUser.id,
    email: appUser.email ?? null,
    displayName: appUser.full_name ?? null,
    isAdmin: resolvedAdmin,
    isComercial: resolvedComercial,
    isOffice: resolvedOffice,
    isFinanceiro: resolvedFinanceiro,
    hasAnyRole: resolvedAdmin || resolvedComercial || resolvedOffice || resolvedFinanceiro,
  }
}

/**
 * Throws 401 if actor is null (unauthenticated).
 * Throws 403 if actor has no recognized role.
 */
export function requireProposalAuth(actor) {
  if (!actor) {
    const err = new Error('Authentication required')
    err.statusCode = 401
    throw err
  }
  if (!actor.hasAnyRole) {
    const err = new Error('Access forbidden: no recognized role assigned')
    err.statusCode = 403
    throw err
  }
}

/**
 * Returns true if the actor can read the given proposal.
 *   - Admin     : any proposal
 *   - Financeiro: any proposal (read-only)
 *   - Office    : own proposals OR proposals owned by role_comercial users
 *   - Comercial : own proposals only
 */
export function canReadProposal(actor, proposal) {
  if (!actor) return false
  if (actor.isAdmin || actor.isFinanceiro) return true
  if (actor.isOffice) {
    // Own proposal, OR proposal owned by a comercial user
    return proposal.owner_user_id === actor.userId ||
      proposal.owner_role === 'role_comercial'
  }
  return proposal.owner_user_id === actor.userId
}

/**
 * Returns true if the actor can create proposals.
 *   - Admin     : yes
 *   - Office    : yes
 *   - Comercial : yes
 *   - Financeiro: no (read-only)
 */
export function canWriteProposals(actor) {
  if (!actor) return false
  return actor.isAdmin || actor.isOffice || actor.isComercial
}

/**
 * Returns true if the actor can update a specific proposal.
 *   - Admin     : any proposal
 *   - Office    : own proposals OR proposals owned by role_comercial users
 *   - Comercial : own proposals only
 *   - Financeiro: no
 */
export function canModifyProposal(actor, proposal) {
  if (!actor) return false
  if (actor.isFinanceiro) return false
  if (actor.isAdmin) return true
  if (actor.isOffice) {
    return proposal.owner_user_id === actor.userId ||
      proposal.owner_role === 'role_comercial'
  }
  return proposal.owner_user_id === actor.userId
}

/**
 * Returns true if the actor can delete a specific proposal.
 *   - Admin     : any proposal
 *   - Office    : own proposals OR proposals owned by role_comercial users
 *   - Comercial : own proposals only
 *   - Financeiro: no
 */
export function canDeleteProposal(actor, proposal) {
  if (!actor) return false
  if (actor.isFinanceiro) return false
  if (actor.isAdmin) return true
  if (actor.isOffice) {
    return proposal.owner_user_id === actor.userId ||
      proposal.owner_role === 'role_comercial'
  }
  return proposal.owner_user_id === actor.userId
}
