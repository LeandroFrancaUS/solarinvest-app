// server/routes/authMe.js
// GET /api/auth/me
// Returns authenticated user info + internal authorization status.
//
// Auth architecture (documented):
// ────────────────────────────────
// Production auth model:
//   1. Bearer token (Stack Auth JWT via JWKS) — PRIMARY
//      Sent by the frontend on every /me request.
//   2. Session cookie (HMAC-SHA256 JWT) — OPTIONAL ENHANCEMENT
//      Created by POST /api/auth/login when AUTH_COOKIE_SECRET is configured.
//      Provides persistence across page reloads without requiring a fresh
//      Stack Auth token.
//   3. x-user-id header — DEV/TESTING ONLY
//      Only accepted when STACK_AUTH_BYPASS=true.
//
// The `authSource` field in the response tells the frontend which method
// authenticated the current request, aiding diagnostics.

import { getCurrentAppUser } from '../auth/currentAppUser.js'
import { getStackUser, isStackAuthBypassed } from '../auth/stackAuth.js'
import { getUserPermissions } from '../auth/stackPermissions.js'

const isDev = process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production'

// Primary role permission IDs — every user must hold at least one of these.
const PRIMARY_ROLE_PERMISSIONS = ['role_admin', 'role_comercial', 'role_office', 'role_financeiro']

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Resolves whether the user holds any primary role permission.
 *
 * Strategy:
 *   1. Fast-path — check the `permissions` claim in the already-decoded JWT.
 *      Stack Auth includes this claim when the user has been granted at least
 *      one permission and the token was issued/refreshed after that grant.
 *   2. API fallback — when the claim is absent (e.g. first-ever token for a
 *      user who has never been granted a permission, or a very old token), call
 *      the Stack Auth admin API to get authoritative permissions.
 *      Falls back to "allow" only when the API is unavailable (network error /
 *      STACK_SECRET_SERVER_KEY not configured), to avoid locking out legitimate
 *      users during transient Stack Auth outages.
 *
 * Returns { hasPrimaryRole: boolean, source: 'jwt'|'api'|'api_unavailable' }
 *
 * @param {object|null} jwtPayload - decoded JWT payload
 * @param {string} stackUserId - Stack Auth user ID (for API fallback)
 */
async function checkPrimaryRolePermissions(jwtPayload, stackUserId) {
  const jwtPerms = jwtPayload?.permissions

  // ── 1. JWT fast-path ──────────────────────────────────────────────────────
  if (Array.isArray(jwtPerms)) {
    const hasPrimaryRole = jwtPerms.some((p) => PRIMARY_ROLE_PERMISSIONS.includes(p))
    return { hasPrimaryRole, source: 'jwt' }
  }

  // ── 2. API fallback ──────────────────────────────────────────────────────
  // The JWT has no permissions claim.  This is normal for users who have never
  // been granted any permission (their token was never seeded with the claim).
  // We must call the Stack Auth API to get the real, authoritative state.
  if (!stackUserId) {
    return { hasPrimaryRole: false, source: 'api' }
  }

  try {
    const apiPerms = await getUserPermissions(stackUserId)
    if (Array.isArray(apiPerms)) {
      const hasPrimaryRole = apiPerms.some((p) => PRIMARY_ROLE_PERMISSIONS.includes(p))
      return { hasPrimaryRole, source: 'api' }
    }
    // null return = API unavailable or key not configured → fail-open
    return { hasPrimaryRole: true, source: 'api_unavailable' }
  } catch {
    // Network error → fail-open to avoid locking out users during outages
    return { hasPrimaryRole: true, source: 'api_unavailable' }
  }
}

export async function handleAuthMeRequest(req, res, { sendJson }) {
  const stackUser = await getStackUser(req)
  const authSource = stackUser?._authSource ?? null
  if (isDev) console.info('[auth/me] resolved: %s via %s', stackUser ? `id=${stackUser.id}` : 'null', authSource ?? 'none')

  const authenticated = isStackAuthBypassed() || Boolean(stackUser?.id)
  if (!authenticated) {
    sendJson(res, 401, {
      authenticated: false,
      authorized: false,
      role: null,
      accessStatus: null,
      authSource: null,
    })
    return
  }

  let appUser
  try {
    appUser = await getCurrentAppUser(req)
    if (isDev) console.info('[auth/me] appUser:', appUser ? `id=${appUser.id}` : 'null')
  } catch (dbErr) {
    // Database is unreachable or not configured.
    // Return HTTP 200 with authorized:false so the client shows an "Access Pending"
    // screen instead of a 500 error that could be misinterpreted as anonymous access.
    console.error('[auth/me] db query failed')
    sendJson(res, 200, {
      authenticated: true,
      authorized: false,
      role: null,
      accessStatus: null,
      email: sanitizeString(stackUser?.email ?? ''),
      authSource,
    })
    return
  }

  if (!appUser) {
    sendJson(res, 200, {
      authenticated: true,
      authorized: false,
      role: null,
      accessStatus: 'pending',
      email: sanitizeString(stackUser?.email ?? ''),
      authSource,
    })
    return
  }

  const authorized = Boolean(appUser.can_access_app) &&
    appUser.access_status === 'approved' &&
    Boolean(appUser.is_active)

  // Req 1: Even an "approved" DB row cannot access the app when the user has
  // no primary role permission in Stack Auth.
  // Strategy: JWT fast-path → API fallback (see checkPrimaryRolePermissions).
  // Skipped in bypass mode.
  if (authorized && !isStackAuthBypassed()) {
    const { hasPrimaryRole, source } = await checkPrimaryRolePermissions(
      stackUser?.payload ?? null,
      stackUser?.id ?? ''
    )
    if (isDev) console.info('[auth/me] permission check: hasPrimaryRole=%s source=%s', hasPrimaryRole, source)
    if (!hasPrimaryRole) {
      sendJson(res, 200, {
        authenticated: true,
        authorized: false,
        role: appUser.role,
        accessStatus: 'no_permissions',
        email: appUser.email,
        fullName: appUser.full_name,
        id: appUser.id,
        authSource,
      })
      return
    }
  }

  sendJson(res, 200, {
    authenticated: true,
    authorized,
    role: appUser.role,
    accessStatus: appUser.access_status,
    isActive: appUser.is_active,
    canAccessApp: appUser.can_access_app,
    email: appUser.email,
    fullName: appUser.full_name,
    id: appUser.id,
    authSource,
  })
}
