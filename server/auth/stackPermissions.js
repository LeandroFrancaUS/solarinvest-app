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

// Maximum number of retry attempts for transient (5xx / network) errors.
const API_MAX_RETRIES = 2
// Base delay (ms) for exponential backoff: attempt 1 = 200ms, attempt 2 = 400ms.
const API_RETRY_BASE_DELAY_MS = 200

function getSecretKey() {
  return (process.env.STACK_SECRET_SERVER_KEY ?? '').trim()
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

/**
 * Returns true when the status code represents a transient server-side error
 * that is safe to retry (5xx), or when status is 0 (network failure before
 * receiving a response).  4xx errors are permanent and should NOT be retried.
 */
function isRetryableStatus(status) {
  return status === 0 || (status >= 500 && status <= 599)
}

/**
 * Executes `fn` up to (1 + maxRetries) times, retrying on transient errors
 * with exponential back-off.  Returns the result of the first successful call.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ correlationId?: string, label?: string }} [opts]
 * @returns {Promise<T>}
 */
async function withRetry(fn, opts = {}) {
  const { correlationId = '', label = 'stackApi' } = opts
  let lastError
  for (let attempt = 0; attempt <= API_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = API_RETRY_BASE_DELAY_MS * (2 ** (attempt - 1))
      await new Promise((resolve) => setTimeout(resolve, delay))
      console.info(`[RBAC] ${label} retry attempt ${attempt}`, { correlationId })
    }
    try {
      return await fn()
    } catch (err) {
      lastError = err
      // Network/timeout errors are always retryable.
      if (attempt < API_MAX_RETRIES) {
        console.warn(`[RBAC] ${label} attempt ${attempt} failed (retrying):`, err?.message, { correlationId })
        continue
      }
    }
  }
  throw lastError
}

// ─── Stack Auth REST API helpers ──────────────────────────────────────────────

/**
 * Fetches the list of global project permissions for a user.
 * Returns an array of permission IDs (strings), or null on failure / missing key.
 *
 * @param {string} userId
 * @param {{ correlationId?: string }} [opts]
 */
async function getUserPermissionsViaApi(userId, opts = {}) {
  const secretKey = getSecretKey()
  const projectId = getProjectId()
  if (!secretKey || !projectId || !userId) return null

  const { correlationId = '' } = opts

  try {
    return await withRetry(async () => {
      // Stack Auth REST API: project-level (global) permissions for a user.
      // Endpoint discovered from the official @stackframe/stack-shared SDK source:
      //   listServerProjectPermissions → GET /api/v1/project-permissions?user_id=…&recursive=false
      // Do NOT use /api/v1/users/{id}/permissions — that path does not exist.
      const url =
        `${STACK_API_BASE}/api/v1/project-permissions?user_id=${encodeURIComponent(userId)}&recursive=false`
      const res = await fetch(url, {
        headers: {
          'x-stack-access-type': 'server',
          'x-stack-project-id': projectId,
          'x-stack-secret-server-key': secretKey,
        },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        if (!isRetryableStatus(res.status)) {
          // 4xx — non-retryable; log and return null immediately.
          console.warn('[RBAC] getUserPermissionsViaApi HTTP', res.status, { userId, correlationId, body: body.slice(0, 200) })
          return null
        }
        const err = new Error(`Stack Auth API ${res.status}`)
        err.providerStatus = res.status
        throw err
      }
      const data = await res.json()
      const items = Array.isArray(data?.items) ? data.items : []
      return items.map((item) => (typeof item?.id === 'string' ? item.id : String(item)))
    }, { correlationId, label: 'getUserPermissions' })
  } catch (err) {
    console.warn('[RBAC] getUserPermissionsViaApi error:', err?.message, { userId, correlationId })
    return null
  }
}

/**
 * Revokes a global project permission from a user via the Stack Auth admin API.
 * Returns { ok: true } on success (or if the permission did not exist).
 * Returns { ok: false, error: string, providerStatus?: number } on failure.
 *
 * @param {string} userId
 * @param {string} permissionId
 * @param {{ correlationId?: string }} [opts]
 */
async function revokePermissionViaApi(userId, permissionId, opts = {}) {
  const secretKey = getSecretKey()
  const projectId = getProjectId()
  if (!secretKey) return { ok: false, error: 'STACK_SECRET_SERVER_KEY não configurada' }
  if (!projectId) return { ok: false, error: 'STACK_PROJECT_ID não configurado' }
  if (!userId || !permissionId) return { ok: false, error: 'userId ou permissionId ausente' }

  const { correlationId = '' } = opts

  try {
    await withRetry(async () => {
      // Stack Auth REST API: revoke a project-level permission.
      // Endpoint discovered from @stackframe/stack-shared SDK:
      //   revokeServerProjectPermission → DELETE /api/v1/project-permissions/{userId}/{permId}
      // Body must be {} (empty JSON object); type is implicit in the path prefix.
      const url =
        `${STACK_API_BASE}/api/v1/project-permissions/${encodeURIComponent(userId)}/${encodeURIComponent(permissionId)}`
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'x-stack-access-type': 'server',
          'x-stack-project-id': projectId,
          'x-stack-secret-server-key': secretKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      })
      if (!res.ok && res.status !== 404) {
        const body = await res.text().catch(() => '')
        console.warn('[RBAC] revokePermissionViaApi HTTP', res.status, { userId, permissionId, correlationId, body: body.slice(0, 200) })
        if (!isRetryableStatus(res.status)) {
          const err = new Error(`Stack Auth API ${res.status}: ${body}`.trim())
          err.providerStatus = res.status
          err.permanent = true
          throw err
        }
        const err = new Error(`Stack Auth API ${res.status}`)
        err.providerStatus = res.status
        throw err
      }
    }, { correlationId, label: 'revokePermission' })
    return { ok: true }
  } catch (err) {
    const msg = err?.message ?? 'Erro de rede'
    console.warn('[RBAC] revokePermissionViaApi error:', msg, { userId, permissionId, correlationId })
    return { ok: false, error: msg, providerStatus: err?.providerStatus }
  }
}

/**
 * Deletes a user from Stack Auth via the admin API.
 * Returns true on success, false otherwise.
 *
 * @param {string} userId
 * @param {{ correlationId?: string }} [opts]
 */
async function deleteStackUserViaApi(userId, opts = {}) {
  const secretKey = getSecretKey()
  const projectId = getProjectId()
  if (!secretKey || !projectId || !userId) return false

  const { correlationId = '' } = opts

  try {
    await withRetry(async () => {
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
        console.warn('[RBAC] deleteStackUserViaApi HTTP', res.status, { userId, correlationId })
        if (!isRetryableStatus(res.status)) {
          const err = new Error(`Stack Auth API ${res.status}`)
          err.permanent = true
          throw err
        }
        throw new Error(`Stack Auth API ${res.status}`)
      }
    }, { correlationId, label: 'deleteUser' })
    return true
  } catch (err) {
    console.warn('[RBAC] deleteStackUserViaApi error:', err?.message, { userId, correlationId })
    return false
  }
}

/**
 * Grants a global project permission to a user via the Stack Auth admin API.
 * Returns { ok: true } on success.
 * Returns { ok: false, error: string, providerStatus?: number } on failure.
 *
 * @param {string} userId
 * @param {string} permissionId
 * @param {{ correlationId?: string }} [opts]
 */
async function grantPermissionViaApi(userId, permissionId, opts = {}) {
  const secretKey = getSecretKey()
  const projectId = getProjectId()
  if (!secretKey) return { ok: false, error: 'STACK_SECRET_SERVER_KEY não configurada' }
  if (!projectId) return { ok: false, error: 'STACK_PROJECT_ID não configurado' }
  if (!userId || !permissionId) return { ok: false, error: 'userId ou permissionId ausente' }

  const { correlationId = '' } = opts

  try {
    await withRetry(async () => {
      // Stack Auth REST API v2: grant a project-level permission.
      // Endpoint discovered from @stackframe/stack-shared SDK:
      //   grantServerProjectPermission → POST /api/v1/project-permissions/{userId}/{permId}
      // Body must be {} (empty JSON object); the permission ID is in the URL path.
      // Do NOT use POST /api/v1/users/{userId}/permissions — that path returns 404.
      const url =
        `${STACK_API_BASE}/api/v1/project-permissions/${encodeURIComponent(userId)}/${encodeURIComponent(permissionId)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-stack-access-type': 'server',
          'x-stack-project-id': projectId,
          'x-stack-secret-server-key': secretKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.warn('[RBAC] grantPermissionViaApi HTTP', res.status, { userId, permissionId, correlationId, body: body.slice(0, 200) })
        if (!isRetryableStatus(res.status)) {
          const err = new Error(`Stack Auth API ${res.status}: ${body}`.trim())
          err.providerStatus = res.status
          err.permanent = true
          throw err
        }
        const err = new Error(`Stack Auth API ${res.status}`)
        err.providerStatus = res.status
        throw err
      }
    }, { correlationId, label: 'grantPermission' })
    return { ok: true }
  } catch (err) {
    const msg = err?.message ?? 'Erro de rede'
    console.warn('[RBAC] grantPermissionViaApi error:', msg, { userId, permissionId, correlationId })
    return { ok: false, error: msg, providerStatus: err?.providerStatus }
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
 * Returns { ok: true } on success, { ok: false, error: string, providerStatus?: number } on failure.
 *
 * @param {string} userId
 * @param {string} permissionId
 * @param {{ correlationId?: string }} [opts]
 */
export async function grantUserPermission(userId, permissionId, opts = {}) {
  return grantPermissionViaApi(userId, permissionId, opts)
}

/**
 * Revokes a permission from a user by their Stack Auth user ID.
 * Returns { ok: true } on success, { ok: false, error: string, providerStatus?: number } on failure.
 *
 * @param {string} userId
 * @param {string} permissionId
 * @param {{ correlationId?: string }} [opts]
 */
export async function revokeUserPermission(userId, permissionId, opts = {}) {
  return revokePermissionViaApi(userId, permissionId, opts)
}

/**
 * Retrieves all global permissions for a user by their Stack Auth user ID.
 * Returns an array of permission ID strings, or null on failure.
 *
 * @param {string} userId
 * @param {{ correlationId?: string }} [opts]
 */
export async function getUserPermissions(userId, opts = {}) {
  return getUserPermissionsViaApi(userId, opts)
}

/**
 * Deletes a user from Stack Auth by their Stack Auth user ID.
 * Returns true on success, false otherwise.
 *
 * @param {string} userId
 * @param {{ correlationId?: string }} [opts]
 */
export async function deleteStackUser(userId, opts = {}) {
  return deleteStackUserViaApi(userId, opts)
}

/**
 * Creates a new user in Stack Auth via the admin API.
 *
 * Returns { ok: true, userId: string } on success.
 * Returns { ok: false, error: string, providerStatus?: number } on failure.
 *
 * @param {string} email - Primary email address for the new user.
 * @param {string|null} [displayName] - Optional display name.
 * @param {{ correlationId?: string }} [opts]
 */
export async function createStackUser(email, displayName, opts = {}) {
  const secretKey = getSecretKey()
  const projectId = getProjectId()
  if (!secretKey) return { ok: false, error: 'STACK_SECRET_SERVER_KEY não configurada' }
  if (!projectId) return { ok: false, error: 'STACK_PROJECT_ID não configurado' }
  if (!email || typeof email !== 'string') return { ok: false, error: 'E-mail inválido' }

  const { correlationId = '' } = opts

  try {
    const url = `${STACK_API_BASE}/api/v1/users`
    const body = {
      primary_email: email.toLowerCase().trim(),
      primary_email_auth_enabled: true,
    }
    if (displayName && typeof displayName === 'string' && displayName.trim()) {
      body.display_name = displayName.trim()
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-stack-access-type': 'server',
        'x-stack-project-id': projectId,
        'x-stack-secret-server-key': secretKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })

    if (!res.ok) {
      const responseBody = await res.text().catch(() => '')
      console.warn('[RBAC] createStackUser HTTP', res.status, { email, correlationId, body: responseBody.slice(0, 200) })
      return { ok: false, error: `Stack Auth API ${res.status}: ${responseBody}`.trim(), providerStatus: res.status }
    }

    const data = await res.json()
    const userId = data?.id ?? data?.user_id ?? data?.userId ?? null
    if (!userId) {
      console.warn('[RBAC] createStackUser: no userId in response', { email, correlationId })
      return { ok: false, error: 'Resposta inesperada do Stack Auth (userId ausente)' }
    }

    console.info('[RBAC] createStackUser: created userId=%s email=%s', userId, email)
    return { ok: true, userId }
  } catch (err) {
    const msg = err?.message ?? 'Erro de rede'
    console.warn('[RBAC] createStackUser error:', msg, { email, correlationId })
    return { ok: false, error: msg }
  }
}

/**
 * Looks up an existing Stack Auth user by primary email address.
 *
 * Returns { ok: true, userId: string } when a matching user is found.
 * Returns { ok: false, error: string, providerStatus?: number } on failure or
 * when no user with that email exists.
 *
 * @param {string} email
 * @param {{ correlationId?: string }} [opts]
 */
export async function lookupStackUserByEmail(email, opts = {}) {
  const secretKey = getSecretKey()
  const projectId = getProjectId()
  if (!secretKey) return { ok: false, error: 'STACK_SECRET_SERVER_KEY não configurada' }
  if (!projectId) return { ok: false, error: 'STACK_PROJECT_ID não configurado' }
  if (!email || typeof email !== 'string') return { ok: false, error: 'E-mail inválido' }

  const { correlationId = '' } = opts
  const normalizedEmail = email.toLowerCase().trim()

  try {
    const url = `${STACK_API_BASE}/api/v1/users?primary_email=${encodeURIComponent(normalizedEmail)}`
    const res = await fetch(url, {
      headers: {
        'x-stack-access-type': 'server',
        'x-stack-project-id': projectId,
        'x-stack-secret-server-key': secretKey,
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn('[RBAC] lookupStackUserByEmail HTTP', res.status, { email: normalizedEmail, correlationId, body: body.slice(0, 200) })
      return { ok: false, error: `Stack Auth API ${res.status}: ${body}`.trim(), providerStatus: res.status }
    }

    const data = await res.json()
    const items = Array.isArray(data?.items) ? data.items : []
    const match = items.find(
      (u) =>
        typeof u?.primary_email === 'string' &&
        u.primary_email.toLowerCase() === normalizedEmail
    )

    if (!match?.id) {
      console.warn('[RBAC] lookupStackUserByEmail: no user found for email', { email: normalizedEmail, correlationId })
      return { ok: false, error: 'Nenhum usuário Stack Auth encontrado com esse e-mail.' }
    }

    console.info('[RBAC] lookupStackUserByEmail: found userId=%s email=%s', match.id, normalizedEmail)
    return { ok: true, userId: match.id }
  } catch (err) {
    const msg = err?.message ?? 'Erro de rede'
    console.warn('[RBAC] lookupStackUserByEmail error:', msg, { email: normalizedEmail, correlationId })
    return { ok: false, error: msg }
  }
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
 * Comma-separated list of emails that should be auto-granted `role_office`.
 * Override with the BOOTSTRAP_OFFICE_EMAILS environment variable.
 * The default includes the office team member; add more via the env var.
 */
const OFFICE_EMAILS = (
  process.env.BOOTSTRAP_OFFICE_EMAILS ||
  'laienygomes1@gmail.com'
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

/**
 * Idempotent: ensures users whose email is in OFFICE_EMAILS (or
 * BOOTSTRAP_OFFICE_EMAILS env var) have the `role_office` Stack Auth
 * permission.  Silently skips if:
 *   - The user's email is not in the configured list.
 *   - STACK_SECRET_SERVER_KEY / STACK_PROJECT_ID is not configured.
 *   - The permission already exists.
 *
 * Should only be called from server-side auth resolution (currentAppUser.js).
 */
export async function ensureOfficePermissionForUsers(userId, email) {
  const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : ''
  if (!OFFICE_EMAILS.includes(normalizedEmail)) return

  const secretKey = getSecretKey()
  const projectId = getProjectId()
  if (!secretKey || !projectId) return

  console.info('[RBAC] ensuring office permission for', userId, normalizedEmail)

  const existing = await getUserPermissionsViaApi(userId)
  if (existing !== null && existing.includes('role_office')) {
    // Already granted — nothing to do.
    return
  }

  const result = await grantPermissionViaApi(userId, 'role_office')
  if (result.ok) {
    console.info('[RBAC] granted role_office to', userId)
  } else {
    console.warn('[RBAC] ensureOfficePermission: grant failed —', result.error)
  }
}
