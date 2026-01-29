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
