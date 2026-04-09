// server/auth/roleMapping.js
//
// Shared mapping between Stack Auth permission IDs and DB role values.
// Imported by adminUsers.js, authReconcile.js, and tests.
//
// DB role column (app_user_access.role) supports: 'admin', 'manager', 'user'
// Stack Auth primary roles:  role_admin | role_comercial | role_office | role_financeiro

/**
 * Maps a Stack Auth primary role permission to the corresponding DB role value.
 * Only `role_admin` elevates to DB admin; all other roles stay as 'user'.
 *
 * @param {string} permId - Stack Auth permission ID (e.g. 'role_admin')
 * @returns {'admin'|'user'}
 */
export function stackPermToDbRole(permId) {
  if (permId === 'role_admin') return 'admin'
  return 'user'
}
