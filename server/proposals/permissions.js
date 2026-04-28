// server/proposals/permissions.js
// RBAC helpers for proposal access control.
//
// Role source-of-truth: Stack Auth native permissions (primary) + DB role (fallback).
// Precedence (highest → lowest):
//   role_admin      → Administrador com acesso total ao sistema
//   role_office     → Acesso irrestrito a todos os clientes e propostas (leitura e escrita)
//   role_financeiro → Acesso financeiro (read-only de clientes e propostas)
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
const PERM_OPERACAO   = 'role_operacao'
const PERM_SUPORTE    = 'role_suporte'
const BOOTSTRAP_ADMIN_EMAIL = getBootstrapAdminEmail().toLowerCase().trim()
const BOOTSTRAP_ADMIN_USER_ID = getBootstrapAdminUserId()

/**
 * Resolves the full actor context from the incoming request.
 *
 * Roles are determined by Stack Auth permissions (primary source) with a
 * DB role fallback for the admin role:
 *   isAdmin      → has role_admin (Stack Auth) OR role='admin' in app_user_access DB (fallback)
 *   isOffice     → has role_office (but not role_admin)
 *   isFinanceiro → has role_financeiro (but not role_admin or role_office)
 *   isComercial  → has role_comercial (but not role_admin, role_office, or role_financeiro)
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
      isOperacao: false,
      isSuporte: false,
      hasAnyRole: true,
    }
  }

  // Require a valid Stack Auth session (provides userId/email/displayName/DB role)
  const appUser = await getCurrentAppUser(req)
  if (!appUser) return null

  // Generate correlation ID from request for better debugging
  const correlationId = req.headers?.['x-vercel-id'] || req.headers?.['x-request-id'] || ''

  // Resolve roles from Stack Auth permissions (all six in parallel)
  const [isAdmin, isComercial, isOffice, isFinanceiro, isOperacao, isSuporte] = await Promise.all([
    hasStackPermission(req, PERM_ADMIN, { correlationId }),
    hasStackPermission(req, PERM_COMERCIAL, { correlationId }),
    hasStackPermission(req, PERM_OFFICE, { correlationId }),
    hasStackPermission(req, PERM_FINANCEIRO, { correlationId }),
    hasStackPermission(req, PERM_OPERACAO, { correlationId }),
    hasStackPermission(req, PERM_SUPORTE, { correlationId }),
  ])

  // DB fallback: if Stack Auth returned no role at all, check the DB role.
  // This handles stale JWTs (permission recently granted, token not refreshed)
  // and setups where STACK_SECRET_SERVER_KEY is not configured.
  // Only the admin role has a DB equivalent ('admin' in app_user_access.role).
  //
  // IMPORTANT: the fallback ONLY activates when Stack Auth has zero recognized roles.
  // If Stack Auth explicitly grants any role (including role_comercial), it takes
  // precedence over the DB snapshot — this prevents first-user bootstrap self-heal
  // from wrongly elevating a comercial user who was auto-promoted to DB 'admin'
  // before the Stack Auth permissions were configured.
  const hasAnyStackAuthRole = isAdmin || isComercial || isOffice || isFinanceiro || isOperacao || isSuporte
  const normalizedEmail = (appUser.email ?? '').toLowerCase().trim()
  const isApproved = appUser.access_status === 'approved'
  const dbRoleIsAdmin = !hasAnyStackAuthRole && appUser.role === 'admin' && isApproved
  // Bootstrap email/userId checks: only activate when the user is approved in the DB.
  // Requiring approved status means an admin can block bootstrap users by setting
  // access_status to 'blocked', making the grant revocable through normal admin flows.
  const bootstrapEmailIsAdmin = Boolean(BOOTSTRAP_ADMIN_EMAIL) && normalizedEmail === BOOTSTRAP_ADMIN_EMAIL && isApproved
  const bootstrapUserIdIsAdmin =
    Boolean(BOOTSTRAP_ADMIN_USER_ID) &&
    (appUser.auth_provider_user_id === BOOTSTRAP_ADMIN_USER_ID || appUser.id === BOOTSTRAP_ADMIN_USER_ID) &&
    isApproved

  // Precedence: admin > office > financeiro > comercial > operacao > suporte
  // When a user holds multiple permissions the highest-privilege one wins.
  // office takes priority over financeiro because office grants write access
  // while financeiro is read-only — a user with both roles should retain write access.
  const resolvedAdmin      = isAdmin || dbRoleIsAdmin || bootstrapEmailIsAdmin || bootstrapUserIdIsAdmin
  const resolvedOffice     = !resolvedAdmin && isOffice
  const resolvedFinanceiro = !resolvedAdmin && !resolvedOffice && isFinanceiro
  const resolvedComercial  = !resolvedAdmin && !resolvedOffice && !resolvedFinanceiro && isComercial
  const resolvedOperacao   = !resolvedAdmin && !resolvedOffice && !resolvedFinanceiro && !resolvedComercial && isOperacao
  const resolvedSuporte    = !resolvedAdmin && !resolvedOffice && !resolvedFinanceiro && !resolvedComercial && !resolvedOperacao && isSuporte

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
    isOffice: resolvedOffice,
    isFinanceiro: resolvedFinanceiro,
    isComercial: resolvedComercial,
    isOperacao: resolvedOperacao,
    isSuporte: resolvedSuporte,
    hasAnyRole: resolvedAdmin || resolvedFinanceiro || resolvedOffice || resolvedComercial || resolvedOperacao || resolvedSuporte,
  }
}

/**
 * Returns the canonical role string for an actor — used to set
 * app.current_user_role in PostgreSQL session config via createUserScopedSql.
 *
 * Precedence: admin > office > financeiro > comercial
 *
 * @param {Object} actor - resolved actor from resolveActor()
 * @returns {string|null} 'role_admin' | 'role_office' | 'role_financeiro' | 'role_comercial' | null
 */
export function actorRole(actor) {
  if (!actor) return null
  if (actor.isAdmin)      return 'role_admin'
  if (actor.isOffice)     return 'role_office'
  if (actor.isFinanceiro) return 'role_financeiro'
  if (actor.isComercial)  return 'role_comercial'
  if (actor.isOperacao)   return 'role_operacao'
  if (actor.isSuporte)    return 'role_suporte'
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
