// server/routes/auth.me.js
// GET /auth/me — returns the authenticated user's identity + internal authorization status.
import { getCurrentAppUser } from '../auth/currentAppUser.js'
import { getStackUser, isStackAuthBypassed } from '../auth/stackAuth.js'

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {(res: import('node:http').ServerResponse, status: number, body: unknown) => void} sendJson
 */
export async function handleAuthMe(req, res, sendJson) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  // Resolve Stack Auth user identity
  const stackUser = isStackAuthBypassed() ? null : await getStackUser(req)

  // Resolve internal authorization record (also auto-provisions if needed)
  const appUser = await getCurrentAppUser(req)

  if (!appUser) {
    // Not authenticated at all (or no valid identity)
    sendJson(res, 401, {
      authenticated: false,
      authorized: false,
      role: null,
      accessStatus: null,
    })
    return
  }

  const authorized =
    appUser.access_status === 'approved' &&
    appUser.can_access_app === true &&
    appUser.is_active === true

  sendJson(res, 200, {
    authenticated: true,
    authorized,
    role: appUser.role,
    accessStatus: appUser.access_status,
    user: {
      id: appUser.id,
      email: appUser.email,
      fullName: appUser.full_name ?? null,
      providerUserId: appUser.auth_provider_user_id,
      // If we have the Stack identity, include name from there as well
      stackEmail: stackUser?.email ?? appUser.email,
    },
  })
}
