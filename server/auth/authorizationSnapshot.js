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

const ROLE_PERMISSIONS = ['role_admin', 'role_financeiro', 'role_office', 'role_comercial']

/**
 * Derives the single primary role from the list of Stack permissions.
 *
 * Priority: admin > financeiro > office > comercial > unknown
 *
 * The order is chosen so that the most privileged role "wins" when a user
 * temporarily has multiple permissions during a transition (e.g. the admin is
 * revoking old roles just after granting the new one).  In steady state, the
 * grant handler auto-revokes other primary roles, so only one will be present.
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
 * Returns the capability map for the given role.
 *
 * @param {'role_admin'|'role_financeiro'|'role_office'|'role_comercial'|'unknown'} role
 */
function deriveCapabilities(role) {
  const isAdmin       = role === 'role_admin'
  const isFinanceiro  = role === 'role_financeiro'
  const isOffice      = role === 'role_office'
  const isComercial   = role === 'role_comercial'

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
  const capabilities = deriveCapabilities(role)

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
