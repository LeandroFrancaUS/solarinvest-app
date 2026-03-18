// api/me.js
import { getCurrentAppUser } from '../server/auth/currentAppUser.js'
import { getStackUser, isStackAuthBypassed } from '../server/auth/stackAuth.js'

export default async function handler(req, res) {
  try {
    const stackUser = await getStackUser(req)
    const authenticated = isStackAuthBypassed() || Boolean(stackUser?.id)

    if (!authenticated) {
      res.status(401).json({ authenticated: false, authorized: false, role: null, accessStatus: null })
      return
    }

    const appUser = await getCurrentAppUser(req)

    if (!appUser) {
      res.status(200).json({
        authenticated: true,
        authorized: false,
        role: null,
        accessStatus: 'pending',
        email: stackUser?.email || '',
      })
      return
    }

    const authorized = Boolean(appUser.can_access_app) &&
      appUser.access_status === 'approved' &&
      Boolean(appUser.is_active)

    res.status(200).json({
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
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Internal error' })
  }
}
