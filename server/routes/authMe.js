// server/routes/authMe.js
// GET /api/auth/me
// Returns authenticated user info + internal authorization status.

import { getCurrentAppUser } from '../auth/currentAppUser.js'
import { getStackUser, isStackAuthBypassed } from '../auth/stackAuth.js'

const isDev = process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production'

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function handleAuthMeRequest(req, res, { sendJson }) {
  const stackUser = await getStackUser(req)
  if (isDev) console.info('[auth/me] stack user resolved:', stackUser ? `id=${stackUser.id}` : 'null')

  const authenticated = isStackAuthBypassed() || Boolean(stackUser?.id)
  if (!authenticated) {
    sendJson(res, 401, {
      authenticated: false,
      authorized: false,
      role: null,
      accessStatus: null,
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
    })
    return
  }

  const authorized = Boolean(appUser.can_access_app) &&
    appUser.access_status === 'approved' &&
    Boolean(appUser.is_active)

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
  })
}
