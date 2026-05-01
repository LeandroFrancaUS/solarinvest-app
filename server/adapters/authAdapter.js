// server/adapters/authAdapter.js
//
// Compatibility adapter: Stack Auth JWT user → AuthenticatedRlsActor.
//
// Delegates ALL role resolution to the existing rlsContext.js to avoid
// diverging mappings.  Never invents its own role strings.
//
// Role hierarchy (highest → lowest privilege):
//   role_admin  > role_office > role_financeiro > role_gerente_comercial > role_comercial
//
// This module is a PURE DATA-MAPPING layer — no DB access.

import { mapBusinessRoleToDatabaseRole } from '../database/rlsContext.js'

// Ordered from highest to lowest privilege.
// Used by fromPermissions() to resolve the single canonical role from a set.
const ROLE_PRIORITY = [
  'role_admin',
  'role_office',
  'role_financeiro',
  'role_gerente_comercial',
  'role_comercial',
]

/**
 * Build an AuthenticatedRlsActor from a Stack Auth user object and a business role string.
 *
 * The actor is the shape required by applyRlsContext() in rlsContext.js:
 *   { authProviderUserId: string, role: DatabaseRlsRole }
 *
 * @param {{ id: string, email?: string, payload?: object }} stackUser - From getStackUser()
 * @param {string} businessRole - Business role string (e.g. 'admin', 'role_admin', 'comercial')
 * @returns {{ authProviderUserId: string, role: string }} AuthenticatedRlsActor
 * @throws {TypeError} if stackUser.id is missing
 * @throws {Error}     if businessRole is not recognised (propagated from mapBusinessRoleToDatabaseRole)
 */
export function fromStackUser(stackUser, businessRole) {
  if (!stackUser?.id) {
    throw new TypeError('AuthAdapter.fromStackUser: stackUser.id is required')
  }

  const role = mapBusinessRoleToDatabaseRole(businessRole)

  return {
    authProviderUserId: stackUser.id,
    role,
  }
}

/**
 * Resolve a single canonical database role from an array of Stack Auth
 * permission IDs by selecting the highest-privilege recognised role.
 *
 * Unrecognised permission IDs are silently ignored — this tolerates extra
 * permissions that may exist in Stack Auth for non-RLS purposes.
 *
 * Falls back to 'role_comercial' (lowest privilege) when no recognised role
 * is found rather than throwing, since a user may have been created before
 * roles were assigned.
 *
 * @param {string[]} permissions - Array of Stack Auth permission IDs
 * @returns {string} Canonical database role string
 */
export function fromPermissions(permissions) {
  if (!Array.isArray(permissions)) {
    return 'role_comercial'
  }

  for (const candidateRole of ROLE_PRIORITY) {
    if (permissions.includes(candidateRole)) {
      return candidateRole
    }
  }

  return 'role_comercial'
}

/**
 * Build an AuthenticatedRlsActor directly from a Stack Auth user and a
 * permissions array.  Combines fromPermissions() + fromStackUser().
 *
 * @param {{ id: string }} stackUser
 * @param {string[]} permissions
 * @returns {{ authProviderUserId: string, role: string }} AuthenticatedRlsActor
 */
export function fromStackUserAndPermissions(stackUser, permissions) {
  if (!stackUser?.id) {
    throw new TypeError('AuthAdapter.fromStackUserAndPermissions: stackUser.id is required')
  }
  const role = fromPermissions(permissions)
  return {
    authProviderUserId: stackUser.id,
    role,
  }
}

/**
 * Check whether an actor has at least the minimum required privilege level.
 *
 * @param {{ role: string }} actor
 * @param {string} minimumRole - e.g. 'role_financeiro'
 * @returns {boolean}
 */
export function hasMinimumRole(actor, minimumRole) {
  const actorPriority   = ROLE_PRIORITY.indexOf(actor?.role ?? '')
  const requiredPriority = ROLE_PRIORITY.indexOf(minimumRole)

  if (actorPriority === -1 || requiredPriority === -1) {
    return false
  }

  // Lower index = higher privilege
  return actorPriority <= requiredPriority
}
