// server/routes/authReconcile.js
//
// POST /api/internal/auth/reconcile
// POST /api/internal/auth/reconcile/:userId
//
// Reconciles DB role (app_user_access.role) with Stack Auth permissions for
// one or all users that have a linked Stack Auth account.
//
// Requires admin role. Intended for drift-correction — use when
// `sync_status = 'drifted'` appears in the admin user list.

import { getCurrentAppUser } from '../auth/currentAppUser.js'
import { requireAdmin } from '../auth/rbac.js'
import { query } from '../db.js'
import { getUserPermissions } from '../auth/stackPermissions.js'
import { derivePrimaryRole } from '../auth/authorizationSnapshot.js'

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Maps a Stack Auth primary role permission to the corresponding DB role value.
 * Mirror of adminUsers.js stackPermToDbRole — kept local to avoid coupling.
 */
function stackPermToDbRole(permId) {
  if (permId === 'role_admin') return 'admin'
  return 'user'
}

/**
 * Reconciles the DB role for a single user row.
 * Returns { userId, stackId, oldRole, newRole, changed, error? }
 */
async function reconcileUser(row) {
  const stackId = sanitizeString(row.auth_provider_user_id)
  if (!stackId) {
    return { userId: row.id, stackId: null, oldRole: row.role, newRole: null, changed: false, skipped: true, reason: 'no_stack_id' }
  }

  try {
    const perms = await getUserPermissions(stackId)
    if (!Array.isArray(perms)) {
      return { userId: row.id, stackId, oldRole: row.role, newRole: null, changed: false, error: 'permissions_fetch_failed' }
    }

    const stackPrimaryRole = derivePrimaryRole(perms)
    const expectedDbRole = stackPermToDbRole(stackPrimaryRole)
    const oldDbRole = sanitizeString(row.role)

    if (expectedDbRole === oldDbRole) {
      return { userId: row.id, stackId, oldRole: oldDbRole, newRole: expectedDbRole, changed: false }
    }

    await query(
      `UPDATE public.app_user_access SET role = $2, updated_at = now() WHERE id = $1`,
      [row.id, expectedDbRole]
    )
    return { userId: row.id, stackId, oldRole: oldDbRole, newRole: expectedDbRole, changed: true }
  } catch (err) {
    return { userId: row.id, stackId, oldRole: row.role, newRole: null, changed: false, error: err?.message }
  }
}

// POST /api/internal/auth/reconcile  — reconcile all users
export async function handleAuthReconcileAll(req, res, { sendJson }) {
  const appUser = await getCurrentAppUser(req)
  requireAdmin(appUser)

  const { rows } = await query(
    `SELECT id, auth_provider_user_id, role FROM public.app_user_access
     WHERE auth_provider_user_id IS NOT NULL AND auth_provider_user_id != ''
     ORDER BY created_at ASC`
  )

  const results = []
  // Process sequentially to avoid hammering the Stack Auth API
  for (const row of rows) {
    results.push(await reconcileUser(row))
  }

  const changed = results.filter((r) => r.changed).length
  const errors = results.filter((r) => r.error).length
  const skipped = results.filter((r) => r.skipped).length

  console.info('[reconcile] completed — total:', rows.length, 'changed:', changed, 'errors:', errors, 'skipped:', skipped, {
    actor: appUser.auth_provider_user_id ?? appUser.id,
  })

  sendJson(res, 200, {
    ok: true,
    summary: { total: rows.length, changed, errors, skipped },
    results,
  })
}

// POST /api/internal/auth/reconcile/:userId  — reconcile a single user
export async function handleAuthReconcileUser(req, res, { sendJson, userId }) {
  const appUser = await getCurrentAppUser(req)
  requireAdmin(appUser)

  const { rows } = await query(
    `SELECT id, auth_provider_user_id, role FROM public.app_user_access WHERE id = $1 LIMIT 1`,
    [userId]
  )
  const row = rows[0]
  if (!row) {
    sendJson(res, 404, { error: 'User not found' })
    return
  }

  const result = await reconcileUser(row)

  console.info('[reconcile] single user completed', {
    ...result,
    actor: appUser.auth_provider_user_id ?? appUser.id,
  })

  sendJson(res, 200, { ok: true, result })
}
