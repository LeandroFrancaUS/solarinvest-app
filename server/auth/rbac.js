// server/auth/rbac.js
export function requireAuth(appUser) {
  if (!appUser) {
    const err = new Error('Not authenticated')
    err.statusCode = 401
    throw err
  }
}

export function requireRole(appUser, allowedRoles) {
  requireAuth(appUser)
  if (!allowedRoles.includes(appUser.role)) {
    const err = new Error('Forbidden')
    err.statusCode = 403
    throw err
  }
}

/**
 * Throws 401 if not authenticated, 403 if authenticated but not authorized
 * (access_status !== 'approved' or can_access_app !== true or is_active !== true).
 */
export function requireAuthorizedUser(appUser) {
  requireAuth(appUser)
  if (
    appUser.access_status !== 'approved' ||
    appUser.can_access_app !== true ||
    appUser.is_active !== true
  ) {
    const err = new Error('Access not authorized')
    err.statusCode = 403
    err.accessStatus = appUser.access_status ?? 'pending'
    throw err
  }
}

/**
 * Throws 401/403 unless the user is an approved admin.
 */
export function requireAdminUser(appUser) {
  requireAuthorizedUser(appUser)
  if (appUser.role !== 'admin') {
    const err = new Error('Admin access required')
    err.statusCode = 403
    throw err
  }
}

