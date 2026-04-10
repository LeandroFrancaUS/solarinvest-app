// server/proposals/permissions.js
// RBAC helpers for proposal access control.
//
// Role source-of-truth: Stack Auth native permissions (primary) + DB role (fallback).
// Precedence (highest → lowest):
//   role_admin      → Administrador com acesso total ao sistema
//   role_financeiro → Acesso financeiro (read-only de clientes e propostas)
//   role_office     → Acesso irrestrito a todos os clientes e propostas (leitura e escrita)
//   role_comercial  → Usuário comum (acesso a clientes e propostas próprias)
//
// A request with none of these permissions is rejected with 403.
// When Stack Auth is bypassed (dev/test), the actor is treated as admin.

import { getCurrentAppUser } from '../auth/currentAppUser.js'
import { hasStackPermission } from '../auth/stackPermissions.js'
import { isStackAuthBypassed, getBootstrapAdminEmail, getBootstrapAdminUserId } from '../auth/stackAuth.js'

const PERM_ADMIN      = 'role_admin'
const PERM_COMERCIAL  = 'role_comercial'
const PERM_OFFICE     = 'role_office'
const PERM_FINANCEIRO = 'role_financeiro'
const BOOTSTRAP_ADMIN_EMAIL = getBootstrapAdminEmail().toLowerCase().trim()
const BOOTSTRAP_ADMIN_USER_ID = getBootstrapAdminUserId()

/**
 * Resolves the full actor context from the incoming request.
 *
 * Roles are determined by Stack Auth permissions (primary source) with a
 * DB role fallback for the admin role:
 *   isAdmin      → has role_admin (Stack Auth) OR role='admin' in app_user_access DB (fallback)
 *   isComercial  → has role_comercial (but not role_admin)
 *   isOffice     → has role_office (but not role_admin or role_comercial)
 *   isFinanceiro → has role_financeiro (but not role_admin, role_comercial, or role_office)
 *
 * The DB fallback for admin handles the case where the Stack Auth JWT is stale
 * (permission was recently granted but the access token has not yet been refreshed)
 * or when STACK_SECRET_SERVER_KEY is not set (API fallback disabled).
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

  // Require a valid Stack Auth session (provides userId/email/displayName/DB role)
  const appUser = await getCurrentAppUser(req)
  if (!appUser) return null

  // Resolve roles from Stack Auth permissions (all four in parallel)
  const [isAdmin, isComercial, isOffice, isFinanceiro] = await Promise.all([
    hasStackPermission(req, PERM_ADMIN),
    hasStackPermission(req, PERM_COMERCIAL),
    hasStackPermission(req, PERM_OFFICE),
    hasStackPermission(req, PERM_FINANCEIRO),
  ])

  // DB fallback: if Stack Auth returned no role at all, check the DB role.
  // This handles stale JWTs (permission recently granted, token not refreshed)
  // and setups where STACK_SECRET_SERVER_KEY is not configured.
  // Only the admin role has a DB equivalent ('admin' in app_user_access.role).
  const normalizedEmail = (appUser.email ?? '').toLowerCase().trim()
  const isApproved = appUser.access_status === 'approved'
  const dbRoleIsAdmin = appUser.role === 'admin' && isApproved
  // Bootstrap email/userId checks: only activate when the user is approved in the DB.
  // Requiring approved status means an admin can block bootstrap users by setting
  // access_status to 'blocked', making the grant revocable through normal admin flows.
  const bootstrapEmailIsAdmin = Boolean(BOOTSTRAP_ADMIN_EMAIL) && normalizedEmail === BOOTSTRAP_ADMIN_EMAIL && isApproved
  const bootstrapUserIdIsAdmin =
    Boolean(BOOTSTRAP_ADMIN_USER_ID) &&
    (appUser.auth_provider_user_id === BOOTSTRAP_ADMIN_USER_ID || appUser.id === BOOTSTRAP_ADMIN_USER_ID) &&
    isApproved

  // Precedence: admin > financeiro > office > comercial
  // When a user holds multiple permissions the highest-privilege one wins.
  const resolvedAdmin      = isAdmin || dbRoleIsAdmin || bootstrapEmailIsAdmin || bootstrapUserIdIsAdmin
  const resolvedFinanceiro = !resolvedAdmin && isFinanceiro
  const resolvedOffice     = !resolvedAdmin && !resolvedFinanceiro && isOffice
  const resolvedComercial  = !resolvedAdmin && !resolvedFinanceiro && !resolvedOffice && isComercial

  if (dbRoleIsAdmin || bootstrapEmailIsAdmin || bootstrapUserIdIsAdmin) {
    console.info('[RBAC] resolveActor: using admin fallback', {
      userId: appUser.auth_provider_user_id ?? appUser.id,
      dbRole: appUser.role,
      bootstrapEmailIsAdmin,
      bootstrapUserIdIsAdmin,
    })
  }

  return {
    userId: appUser.auth_provider_user_id ?? appUser.id,
    email: appUser.email ?? null,
    displayName: appUser.full_name ?? null,
    isAdmin: resolvedAdmin,
    isFinanceiro: resolvedFinanceiro,
    isOffice: resolvedOffice,
    isComercial: resolvedComercial,
    hasAnyRole: resolvedAdmin || resolvedFinanceiro || resolvedOffice || resolvedComercial,
  }
}

/**
 * Returns the canonical role string for an actor — used to set
 * app.current_user_role in PostgreSQL session config via createUserScopedSql.
 *
 * Precedence: admin > financeiro > office > comercial
 *
 * @param {Object} actor - resolved actor from resolveActor()
 * @returns {string|null} 'role_admin' | 'role_financeiro' | 'role_office' | 'role_comercial' | null
 */
export function actorRole(actor) {
  if (!actor) return null
  if (actor.isAdmin)      return 'role_admin'
  if (actor.isFinanceiro) return 'role_financeiro'
  if (actor.isOffice)     return 'role_office'
  if (actor.isComercial)  return 'role_comercial'
  return null
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
 *   - Office    : any proposal (read-only outside own ownership at mutation layer)
 *   - Comercial : own proposals only
 */
export function canReadProposal(actor, proposal) {
  if (!actor) return false
  if (actor.isAdmin || actor.isFinanceiro) return true
  if (actor.isOffice) {
    return true
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
 *   - Office    : any proposal (read-only outside own ownership at mutation layer)
 *   - Comercial : own proposals only
 *   - Financeiro: no
 */
export function canModifyProposal(actor, proposal) {
  if (!actor) return false
  if (actor.isFinanceiro) return false
  if (actor.isAdmin) return true
  if (actor.isOffice) {
    return proposal.owner_user_id === actor.userId
  }
  return proposal.owner_user_id === actor.userId
}

/**
 * Returns true if the actor can delete a specific proposal.
 *   - Admin     : any proposal
 *   - Office    : any proposal (read-only outside own ownership at mutation layer)
 *   - Comercial : own proposals only
 *   - Financeiro: no
 */
export function canDeleteProposal(actor, proposal) {
  if (!actor) return false
  if (actor.isFinanceiro) return false
  if (actor.isAdmin) return true
  if (actor.isOffice) {
    return proposal.owner_user_id === actor.userId
  }
  return proposal.owner_user_id === actor.userId
}
