// server/auth/rbac.js
export function requireAuth(appUser) {
  if (!appUser) {
    const err = new Error('Not authenticated')
    err.statusCode = 401
    throw err
  }
}

export function requireAuthorized(appUser) {
  requireAuth(appUser)
  if (!appUser.can_access_app || appUser.access_status !== 'approved' || !appUser.is_active) {
    const err = new Error('Access not authorized')
    err.statusCode = 403
    err.accessStatus = appUser.access_status || 'pending'
    throw err
  }
}

export function requireRole(appUser, allowedRoles) {
  requireAuthorized(appUser)
  if (!allowedRoles.includes(appUser.role)) {
    const err = new Error('Forbidden')
    err.statusCode = 403
    throw err
  }
}

export function requireAdmin(appUser) {
  requireRole(appUser, ['admin'])
}
