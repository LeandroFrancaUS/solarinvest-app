// server/auth/stackPermissions.js
//
// Stack Auth native permission helpers — server-side only.
//
// Three layers:
//   1. JWT fast-path  — checks `payload.permissions` from the already-verified
//      access token (zero extra network round-trips).
//   2. API fallback   — calls Stack Auth admin REST API when the JWT claim is
//      absent or the permission was just granted this session (requires
//      STACK_SECRET_SERVER_KEY; degrades gracefully when absent).
//   3. Auto-grant     — idempotent grant of `role_admin` to the bootstrap admin
//      user; invoked from currentAppUser.js after the DB row is resolved.

import { getStackUser, getProjectId, getBootstrapAdminEmail, getBootstrapAdminUserId } from './stackAuth.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = getBootstrapAdminEmail().toLowerCase().trim()
const ADMIN_USER_ID = getBootstrapAdminUserId()
const ADMIN_PERMISSION = 'role_admin'
const STACK_API_BASE = 'https://api.stack-auth.com'
const API_TIMEOUT_MS = 4000

function getSecretKey() {
  return (process.env.STACK_SECRET_SERVER_KEY ?? '').trim()
}

// ─── Stack Auth REST API helpers ──────────────────────────────────────────────

/**
 * Fetches the list of global project permissions for a user.
 * Returns an array of permission IDs (strings), or null on failure / missing key.
 */
async function getUserPermissionsViaApi(userId) {
  const secretKey = getSecretKey()
  const projectId = getProjectId()
  if (!secretKey || !projectId || !userId) return null

  try {
    const url =
      `${STACK_API_BASE}/api/v1/users/${encodeURIComponent(userId)}/permissions?type=global`
    const res = await fetch(url, {
      headers: {
        'x-stack-access-type': 'server',
        'x-stack-project-id': projectId,
        'x-stack-secret-server-key': secretKey,
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn('[RBAC] getUserPermissionsViaApi HTTP', res.status, 'for userId:', userId)
      return null
    }
    const data = await res.json()
    const items = Array.isArray(data?.items) ? data.items : []
    return items.map((item) => (typeof item?.id === 'string' ? item.id : String(item)))
  } catch (err) {
    console.warn('[RBAC] getUserPermissionsViaApi error:', err?.message)
    return null
  }
}

/**
 * Revokes a global project permission from a user via the Stack Auth admin API.
 * Returns { ok: true } on success (or if the permission did not exist).
 * Returns { ok: false, error: string } on configuration error or API failure.
 */
async function revokePermissionViaApi(userId, permissionId) {
  const secretKey = getSecretKey()
  const projectId = getProjectId()
  if (!secretKey) return { ok: false, error: 'STACK_SECRET_SERVER_KEY não configurada' }
  if (!projectId) return { ok: false, error: 'STACK_PROJECT_ID não configurado' }
  if (!userId || !permissionId) return { ok: false, error: 'userId ou permissionId ausente' }

  try {
    const url =
      `${STACK_API_BASE}/api/v1/users/${encodeURIComponent(userId)}/permissions/${encodeURIComponent(permissionId)}?type=global`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'x-stack-access-type': 'server',
        'x-stack-project-id': projectId,
        'x-stack-secret-server-key': secretKey,
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => '')
      console.warn('[RBAC] revokePermissionViaApi HTTP', res.status, 'userId:', userId, 'permission:', permissionId, '| response:', body)
      return { ok: false, error: `Stack Auth API ${res.status}: ${body}`.trim() }
    }
    return { ok: true }
  } catch (err) {
    console.warn('[RBAC] revokePermissionViaApi error:', err?.message)
    return { ok: false, error: err?.message ?? 'Erro de rede' }
  }
}

/**
 * Deletes a user from Stack Auth via the admin API.
 * Returns true on success, false otherwise.
 */
async function deleteStackUserViaApi(userId) {
  const secretKey = getSecretKey()
  const projectId = getProjectId()
  if (!secretKey || !projectId || !userId) return false

  try {
    const url = `${STACK_API_BASE}/api/v1/users/${encodeURIComponent(userId)}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'x-stack-access-type': 'server',
        'x-stack-project-id': projectId,
        'x-stack-secret-server-key': secretKey,
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })
    if (!res.ok && res.status !== 404) {
      console.warn('[RBAC] deleteStackUserViaApi HTTP', res.status, 'userId:', userId)
      return false
    }
    return true
  } catch (err) {
    console.warn('[RBAC] deleteStackUserViaApi error:', err?.message)
    return false
  }
}

/**
 * Grants a global project permission to a user via the Stack Auth admin API.
 * Returns { ok: true } on success.
 * Returns { ok: false, error: string } on configuration error or API failure.
 */
async function grantPermissionViaApi(userId, permissionId) {
  const secretKey = getSecretKey()
  const projectId = getProjectId()
  if (!secretKey) return { ok: false, error: 'STACK_SECRET_SERVER_KEY não configurada' }
  if (!projectId) return { ok: false, error: 'STACK_PROJECT_ID não configurado' }
  if (!userId || !permissionId) return { ok: false, error: 'userId ou permissionId ausente' }

  try {
    const url =
      `${STACK_API_BASE}/api/v1/users/${encodeURIComponent(userId)}/permissions/${encodeURIComponent(permissionId)}?type=global`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-stack-access-type': 'server',
        'x-stack-project-id': projectId,
        'x-stack-secret-server-key': secretKey,
        'content-type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn('[RBAC] grantPermissionViaApi HTTP', res.status, 'userId:', userId, 'permission:', permissionId, '| response:', body)
      return { ok: false, error: `Stack Auth API ${res.status}: ${body}`.trim() }
    }
    return { ok: true }
  } catch (err) {
    console.warn('[RBAC] grantPermissionViaApi error:', err?.message)
    return { ok: false, error: err?.message ?? 'Erro de rede' }
  }
}

// ─── JWT fast-path ────────────────────────────────────────────────────────────

/**
 * Checks if a permission is present in the already-decoded JWT payload.
 * Stack Auth v2 access tokens carry `permissions: string[]` in the payload.
 *
 * Returns true/false — never throws.
 */
function checkPermissionFromPayload(jwtPayload, permissionId) {
  if (!jwtPayload || typeof jwtPayload !== 'object') return false
  const perms = jwtPayload.permissions
  if (!Array.isArray(perms)) return false
  return perms.includes(permissionId)
}

// ─── Auto-grant for bootstrap admin ──────────────────────────────────────────

/**
 * Idempotent: ensures the bootstrap admin user has the `role_admin` Stack Auth
 * permission.  Silently skips if:
 *   - The user is not the bootstrap admin (by email or user ID).
 *   - STACK_SECRET_SERVER_KEY is not configured.
 *   - The permission already exists.
 *
 * Should only be called from server-side auth resolution (currentAppUser.js).
 * Never call this from React components.
 */
export async function ensureAdminPermissionForUser(userId, email) {
  const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : ''
  const isTargetAdmin =
    userId === ADMIN_USER_ID || normalizedEmail === ADMIN_EMAIL

  if (!isTargetAdmin) return

  const secretKey = getSecretKey()
  if (!secretKey) {
    // No API key — cannot grant. The one-time script (scripts/grant-admin.ts) can be
    // used instead.  Log a hint in dev so the developer knows what's needed.
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        '[RBAC] ensureAdminPermission: STACK_SECRET_SERVER_KEY not set — ' +
        'run scripts/grant-admin.ts to grant role_admin manually.',
      )
    }
    return
  }

  console.info('[RBAC] ensuring admin permission for', userId, normalizedEmail || '(no email)')

  // 1) Check via API — do NOT rely on JWT here since the token may predate the grant.
  const existing = await getUserPermissionsViaApi(userId)
  if (existing !== null && existing.includes(ADMIN_PERMISSION)) {
    // Already granted — nothing to do.
    return
  }

  // 2) Grant.
  const result = await grantPermissionViaApi(userId, ADMIN_PERMISSION)
  if (result.ok) {
    console.info('[RBAC] granted', ADMIN_PERMISSION, 'to', userId)
  } else {
    console.warn('[RBAC] ensureAdminPermission: grant failed —', result.error)
  }
}

// ─── Request-level permission checking ───────────────────────────────────────

/**
 * Returns true if the authenticated user on `req` has the given Stack Auth
 * project permission.
 *
 * Fast path: reads `permissions` claim from the already-decoded JWT payload.
 * API fallback: if the JWT claim is absent and STACK_SECRET_SERVER_KEY is
 *   configured, falls back to the REST API (handles recently-granted perms).
 *
 * Returns false (not throws) when the user is unauthenticated.
 */
export async function hasStackPermission(req, permissionId) {
  const stackUser = await getStackUser(req)
  if (!stackUser?.id) return false

  // Fast path: JWT claim.
  if (checkPermissionFromPayload(stackUser.payload, permissionId)) {
    return true
  }

  // API fallback (e.g. permission just granted in this session, JWT not yet
  // refreshed, or JWT format does not include permissions).
  const secretKey = getSecretKey()
  if (secretKey) {
    const apiPerms = await getUserPermissionsViaApi(stackUser.id)
    if (apiPerms !== null) {
      return apiPerms.includes(permissionId)
    }
  }

  return false
}

/**
 * Throws an error with the appropriate HTTP status code if the authenticated
 * user on `req` does NOT have the given Stack Auth project permission.
 *
 *   - 401 when the request is unauthenticated.
 *   - 403 when the user is authenticated but lacks the permission.
 *
 * Usage inside a handler:
 *   await requireStackPermission(req, 'page:financial_analysis')
 */
export async function requireStackPermission(req, permissionId) {
  const stackUser = await getStackUser(req)

  if (!stackUser?.id) {
    console.warn('[RBAC] forbidden (unauthenticated) for permission:', permissionId)
    const err = new Error('Not authenticated')
    err.statusCode = 401
    throw err
  }

  const allowed = await hasStackPermission(req, permissionId)

  if (!allowed) {
    console.warn('[RBAC] forbidden', { userId: stackUser.id, permissionId })
    const err = new Error('Forbidden')
    err.statusCode = 403
    throw err
  }
}

/**
 * Grants a permission to a user by their Stack Auth user ID.
 * Returns { ok: true } on success, { ok: false, error: string } on failure.
 */
export async function grantUserPermission(userId, permissionId) {
  return grantPermissionViaApi(userId, permissionId)
}

/**
 * Revokes a permission from a user by their Stack Auth user ID.
 * Returns { ok: true } on success, { ok: false, error: string } on failure.
 */
export async function revokeUserPermission(userId, permissionId) {
  return revokePermissionViaApi(userId, permissionId)
}

/**
 * Retrieves all global permissions for a user by their Stack Auth user ID.
 * Returns an array of permission ID strings, or null on failure.
 */
export async function getUserPermissions(userId) {
  return getUserPermissionsViaApi(userId)
}

/**
 * Deletes a user from Stack Auth by their Stack Auth user ID.
 * Returns true on success, false otherwise.
 */
export async function deleteStackUser(userId) {
  return deleteStackUserViaApi(userId)
}

// ─── Auto-grant for configured commercial users ───────────────────────────────

/**
 * Comma-separated list of emails that should be auto-granted `role_comercial`.
 * Override with the BOOTSTRAP_COMERCIAL_EMAILS environment variable.
 * The two defaults are the initial commercial team members; add more via the
 * env var rather than editing this file.
 */
const COMERCIAL_EMAILS = (
  process.env.BOOTSTRAP_COMERCIAL_EMAILS ||
  'laienygomes1@gmail.com,cmdosanjos123@gmail.com'
)
  .split(',')
  .map((e) => e.toLowerCase().trim())
  .filter(Boolean)

/**
 * Idempotent: ensures users whose email is in COMERCIAL_EMAILS (or
 * BOOTSTRAP_COMERCIAL_EMAILS env var) have the `role_comercial` Stack Auth
 * permission.  Silently skips if:
 *   - The user's email is not in the configured list.
 *   - STACK_SECRET_SERVER_KEY / STACK_PROJECT_ID is not configured.
 *   - The permission already exists.
 *
 * Should only be called from server-side auth resolution (currentAppUser.js).
 */
export async function ensureComercialPermissionForUsers(userId, email) {
  const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : ''
  if (!COMERCIAL_EMAILS.includes(normalizedEmail)) return

  const secretKey = getSecretKey()
  const projectId = getProjectId()
  if (!secretKey || !projectId) return

  console.info('[RBAC] ensuring comercial permission for', userId, normalizedEmail)

  const existing = await getUserPermissionsViaApi(userId)
  if (existing !== null && existing.includes('role_comercial')) {
    // Already granted — nothing to do.
    return
  }

  const result = await grantPermissionViaApi(userId, 'role_comercial')
  if (result.ok) {
    console.info('[RBAC] granted role_comercial to', userId)
  } else {
    console.warn('[RBAC] ensureComercialPermission: grant failed —', result.error)
  }
}
