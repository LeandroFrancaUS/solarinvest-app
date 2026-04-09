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

const isDev = process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production'

// Primary role permission IDs — every user must hold at least one of these.
const PRIMARY_ROLE_PERMISSIONS = ['role_admin', 'role_comercial', 'role_office', 'role_financeiro']

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Returns true when the JWT payload carries an explicit permissions array and
 * none of the primary role permissions are present in it.
 *
 * We only block when the array is explicitly present (non-null, non-undefined)
 * so that older tokens without a `permissions` claim don't get falsely blocked
 * while the JWT is being refreshed.
 */
function hasNoPrimaryRolePermissions(jwtPayload) {
  if (!jwtPayload || typeof jwtPayload !== 'object') return false
  const perms = jwtPayload.permissions
  if (!Array.isArray(perms)) return false   // claim absent — do not block
  return !perms.some((p) => PRIMARY_ROLE_PERMISSIONS.includes(p))
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
  // no primary role permission in Stack Auth.  We check the JWT claim first
  // (fast-path, zero extra network calls).  The check is skipped when bypass
  // mode is active or when the JWT does not carry a permissions array at all
  // (older token format), to avoid false blocks during token refresh.
  if (authorized && !isStackAuthBypassed() && hasNoPrimaryRolePermissions(stackUser?.payload)) {
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
