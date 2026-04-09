// server/auth/authorizationSnapshot.js
//
// Builds a full AuthorizationSnapshot for the authenticated user.
//
// The snapshot combines:
//   - Identity fields from the resolved app user (Stack Auth JWT)
//   - The user's real Stack Auth permissions (JWT fast-path + API fallback)
//   - A derived primary role and capability map
//
// The snapshot is served by GET /api/authz/me and is the single source of
// truth that the frontend uses to drive menus, guards, and offline behavior.

import { getStackUser } from './stackAuth.js'
import { getUserPermissions } from './stackPermissions.js'
import { getCurrentAppUser } from './currentAppUser.js'
import { syncUserProfile } from './userProfileSync.js'

/**
 * Derives the single primary role from the list of Stack permissions.
 *
 * Priority: admin > financeiro > office > comercial > unknown
 *
 * The highest-privilege role is returned for display / label purposes.
 * Capability checks should use deriveCapabilities(permissions) directly so
 * that union rules across all assigned roles are respected.
 *
 * @param {string[]} permissions
 * @returns {'role_admin'|'role_financeiro'|'role_office'|'role_comercial'|'unknown'}
 */
export function derivePrimaryRole(permissions) {
  if (!Array.isArray(permissions)) return 'unknown'
  if (permissions.includes('role_admin')) return 'role_admin'
  if (permissions.includes('role_financeiro')) return 'role_financeiro'
  if (permissions.includes('role_office')) return 'role_office'
  if (permissions.includes('role_comercial')) return 'role_comercial'
  return 'unknown'
}

/**
 * Returns the capability map for the given set of permissions.
 *
 * Capabilities are the *union* of all active roles: a user with both
 * role_comercial and role_financeiro gets capabilities from both roles.
 * The highest-priority role still takes precedence for label/display purposes,
 * but no capability is lost because of a higher role being present.
 *
 * @param {string[]} permissions
 */
export function deriveCapabilities(permissions) {
  if (!Array.isArray(permissions)) permissions = []

  const isAdmin      = permissions.includes('role_admin')
  const isFinanceiro = permissions.includes('role_financeiro')
  const isOffice     = permissions.includes('role_office')
  const isComercial  = permissions.includes('role_comercial')

  return {
    // User management
    canManageUsers: isAdmin,

    // Clients
    canReadAllClients:         isAdmin || isFinanceiro,
    canWriteAllClients:        isAdmin,
    canReadOwnClients:         isComercial || isOffice,
    canWriteOwnClients:        isComercial || isOffice,
    canReadCommercialClients:  isOffice,
    canWriteCommercialClients: isOffice,

    // Proposals
    canReadAllProposals:         isAdmin || isFinanceiro,
    canWriteAllProposals:        isAdmin,
    canReadOwnProposals:         isComercial || isOffice,
    canWriteOwnProposals:        isComercial || isOffice,
    canReadCommercialProposals:  isOffice,
    canWriteCommercialProposals: isOffice,
  }
}

/**
 * Builds an AuthorizationSnapshot for the authenticated user on the given request.
 *
 * Returns null when the request is unauthenticated.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<object|null>}
 */
export async function getAuthorizationSnapshot(req) {
  const stackUser = await getStackUser(req)
  if (!stackUser?.id) return null

  // Resolve internal DB user (needed for display name / email fallback)
  let appUser = null
  try {
    appUser = await getCurrentAppUser(req)
  } catch {
    // DB unavailable — still return a partial snapshot from JWT
  }

  // Fetch permissions: try API (authoritative) then fall back to JWT claim
  let permissions = []
  try {
    const apiPerms = await getUserPermissions(stackUser.id)
    if (Array.isArray(apiPerms)) {
      permissions = apiPerms
    } else if (Array.isArray(stackUser.payload?.permissions)) {
      permissions = stackUser.payload.permissions
    }
  } catch {
    if (Array.isArray(stackUser.payload?.permissions)) {
      permissions = stackUser.payload.permissions
    }
  }

  const role = derivePrimaryRole(permissions)
  const capabilities = deriveCapabilities(permissions)

  // Sync profile asynchronously (fire-and-forget; non-blocking)
  const email = appUser?.email ?? stackUser.email ?? null
  const displayName = appUser?.full_name ?? null
  syncUserProfile(stackUser.id, role, email, displayName).catch((err) => {
    console.warn('[authz] syncUserProfile error (non-fatal):', err?.message)
  })

  return {
    stackUserId:  stackUser.id,
    primaryEmail: email,
    displayName,
    permissions,
    role,
    capabilities,
    fetchedAt: new Date().toISOString(),
  }
}
