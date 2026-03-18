// server/routes/adminUsers.js
// Admin endpoints for managing user access.
// All routes require admin role with approved access.

import { getCurrentAppUser } from '../auth/currentAppUser.js'
import { requireAdmin } from '../auth/rbac.js'
import { query } from '../db.js'

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

async function writeAudit(targetUserId, action, oldStatus, newStatus, oldRole, newRole, performedBy) {
  try {
    await query(
      `INSERT INTO public.app_user_access_audit
         (target_user_id, action, old_status, new_status, old_role, new_role,
          performed_by_user_id, performed_by_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        targetUserId,
        action,
        oldStatus || null,
        newStatus || null,
        oldRole || null,
        newRole || null,
        performedBy?.id || null,
        performedBy?.email || null,
      ]
    )
  } catch (err) {
    console.warn('[auth] writeAudit error:', err?.message)
  }
}

// GET /api/admin/users?page=1&limit=20&search=
export async function handleAdminUsersListRequest(req, res, { sendJson, requestUrl }) {
  const appUser = await getCurrentAppUser(req)
  requireAdmin(appUser)

  const page = Math.max(1, parseInt(requestUrl.searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(requestUrl.searchParams.get('limit') || '20', 10)))
  const search = sanitizeString(requestUrl.searchParams.get('search') || '')
  const offset = (page - 1) * limit

  let countResult, listResult

  if (search) {
    const pattern = `%${search.toLowerCase()}%`
    countResult = await query(
      `SELECT COUNT(*) AS total FROM public.app_user_access
       WHERE lower(email) LIKE $1 OR lower(full_name) LIKE $1`,
      [pattern]
    )
    listResult = await query(
      `SELECT id, auth_provider_user_id, email, full_name, role, access_status,
              is_active, can_access_app, last_login_at, created_at, updated_at
       FROM public.app_user_access
       WHERE lower(email) LIKE $1 OR lower(full_name) LIKE $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [pattern, limit, offset]
    )
  } else {
    countResult = await query(`SELECT COUNT(*) AS total FROM public.app_user_access`)
    listResult = await query(
      `SELECT id, auth_provider_user_id, email, full_name, role, access_status,
              is_active, can_access_app, last_login_at, created_at, updated_at
       FROM public.app_user_access
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )
  }

  const total = parseInt(countResult.rows[0]?.total || '0', 10)

  sendJson(res, 200, {
    users: listResult.rows,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  })
}

// POST /api/admin/users/:id/approve
export async function handleAdminUserApprove(req, res, { sendJson, userId }) {
  const appUser = await getCurrentAppUser(req)
  requireAdmin(appUser)

  const { rows } = await query(
    `SELECT id, access_status, role FROM public.app_user_access WHERE id = $1 LIMIT 1`,
    [userId]
  )
  const target = rows[0]
  if (!target) {
    sendJson(res, 404, { error: 'User not found' })
    return
  }

  await query(
    `UPDATE public.app_user_access
     SET access_status = 'approved', can_access_app = true, is_active = true,
         approved_by = $2, approved_at = now(), updated_at = now()
     WHERE id = $1`,
    [userId, appUser.email || appUser.id]
  )

  await writeAudit(userId, 'access_approved', target.access_status, 'approved', null, null, appUser)
  sendJson(res, 200, { ok: true })
}

// POST /api/admin/users/:id/block
export async function handleAdminUserBlock(req, res, { sendJson, userId }) {
  const appUser = await getCurrentAppUser(req)
  requireAdmin(appUser)

  const { rows } = await query(
    `SELECT id, access_status, role FROM public.app_user_access WHERE id = $1 LIMIT 1`,
    [userId]
  )
  const target = rows[0]
  if (!target) {
    sendJson(res, 404, { error: 'User not found' })
    return
  }

  await query(
    `UPDATE public.app_user_access
     SET access_status = 'blocked', can_access_app = false, is_active = false,
         updated_at = now()
     WHERE id = $1`,
    [userId]
  )

  await writeAudit(userId, 'access_blocked', target.access_status, 'blocked', null, null, appUser)
  sendJson(res, 200, { ok: true })
}

// POST /api/admin/users/:id/revoke
export async function handleAdminUserRevoke(req, res, { sendJson, userId }) {
  const appUser = await getCurrentAppUser(req)
  requireAdmin(appUser)

  const { rows } = await query(
    `SELECT id, access_status, role FROM public.app_user_access WHERE id = $1 LIMIT 1`,
    [userId]
  )
  const target = rows[0]
  if (!target) {
    sendJson(res, 404, { error: 'User not found' })
    return
  }

  await query(
    `UPDATE public.app_user_access
     SET access_status = 'revoked', can_access_app = false,
         revoked_by = $2, revoked_at = now(), updated_at = now()
     WHERE id = $1`,
    [userId, appUser.email || appUser.id]
  )

  await writeAudit(userId, 'access_revoked', target.access_status, 'revoked', null, null, appUser)
  sendJson(res, 200, { ok: true })
}

// POST /api/admin/users/:id/role  body: { role: 'admin'|'manager'|'user' }
export async function handleAdminUserRole(req, res, { sendJson, userId, body }) {
  const appUser = await getCurrentAppUser(req)
  requireAdmin(appUser)

  const newRole = sanitizeString(body?.role)
  const validRoles = ['admin', 'manager', 'user']
  if (!validRoles.includes(newRole)) {
    sendJson(res, 400, { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` })
    return
  }

  const { rows } = await query(
    `SELECT id, role FROM public.app_user_access WHERE id = $1 LIMIT 1`,
    [userId]
  )
  const target = rows[0]
  if (!target) {
    sendJson(res, 404, { error: 'User not found' })
    return
  }

  await query(
    `UPDATE public.app_user_access SET role = $2, updated_at = now() WHERE id = $1`,
    [userId, newRole]
  )

  await writeAudit(userId, 'role_changed', null, null, target.role, newRole, appUser)
  sendJson(res, 200, { ok: true })
}
