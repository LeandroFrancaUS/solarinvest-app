// server/proposals/permissions.js
// RBAC helpers for proposal access control.

import { getCurrentAppUser } from '../auth/currentAppUser.js'
import { hasStackPermission } from '../auth/stackPermissions.js'

const STACK_PERMISSION_FINANCEIRO = 'role_financeiro'

/**
 * Resolves the full actor context from the incoming request.
 * Returns { userId, email, displayName, isAdmin, isFinanceiro, isRegular, appUser }
 * or null if the user is not authenticated.
 */
export async function resolveActor(req) {
  const appUser = await getCurrentAppUser(req)
  if (!appUser) return null

  const isAdmin = appUser.role === 'admin'
  const isFinanceiro = !isAdmin && await hasStackPermission(req, STACK_PERMISSION_FINANCEIRO)
  const isRegular = !isAdmin && !isFinanceiro

  return {
    userId: appUser.id ?? appUser.auth_provider_user_id,
    email: appUser.email ?? null,
    displayName: appUser.full_name ?? null,
    isAdmin,
    isFinanceiro,
    isRegular,
    appUser,
  }
}

/**
 * Throws 401 if actor is null (unauthenticated).
 * Throws 403 if actor's app access is not approved.
 */
export function requireProposalAuth(actor) {
  if (!actor) {
    const err = new Error('Authentication required')
    err.statusCode = 401
    throw err
  }

  const { appUser } = actor
  if (!appUser.can_access_app || appUser.access_status !== 'approved' || !appUser.is_active) {
    const err = new Error('Access not authorized')
    err.statusCode = 403
    err.accessStatus = appUser.access_status || 'pending'
    throw err
  }
}

/**
 * Returns true if the actor can read the given proposal.
 * Admins, financeiro users, and the proposal owner can read.
 */
export function canReadProposal(actor, proposal) {
  if (!actor) return false
  if (actor.isAdmin || actor.isFinanceiro) return true
  return proposal.owner_user_id === actor.userId
}

/**
 * Returns true if the actor can create or update proposals.
 * Admins and regular users can write; financeiro users are read-only.
 */
export function canWriteProposals(actor) {
  if (!actor) return false
  return actor.isAdmin || actor.isRegular
}

/**
 * Returns true if the actor can modify (update) a specific proposal.
 * Admins can modify any proposal; regular users can only modify their own.
 * Financeiro users cannot modify.
 */
export function canModifyProposal(actor, proposal) {
  if (!actor) return false
  if (actor.isFinanceiro) return false
  if (actor.isAdmin) return true
  return proposal.owner_user_id === actor.userId
}

/**
 * Returns true if the actor can delete a specific proposal.
 * Same rules as modify: admins always, owners if not financeiro.
 */
export function canDeleteProposal(actor, proposal) {
  if (!actor) return false
  if (actor.isFinanceiro) return false
  if (actor.isAdmin) return true
  return proposal.owner_user_id === actor.userId
}
