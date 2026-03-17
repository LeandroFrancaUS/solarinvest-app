// server/routes/admin.users.js
// Admin endpoints for managing user access.
// All endpoints require an authenticated, approved admin user.
import { getDatabaseClient } from '../database/neonClient.js'
import { getCurrentAppUser } from '../auth/currentAppUser.js'
import { requireAdminUser } from '../auth/rbac.js'

/**
 * Parse body helper (reuses the same logic from handler.js via parameter injection)
 * @param {unknown} body
 */
function sanitizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function extractUserId(pathname) {
  // pathname is like /admin/users/some-uuid/approve
  const match = pathname.match(/^\/admin\/users\/([^/]+)/)
  return match ? match[1].trim() : ''
}

function extractAction(pathname) {
  // pathname is like /admin/users/some-uuid/approve
  const match = pathname.match(/^\/admin\/users\/[^/]+\/([^/]+)$/)
  return match ? match[1].trim() : ''
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {(res: import('node:http').ServerResponse, status: number, body: unknown) => void} sendJson
 * @param {(req: import('node:http').IncomingMessage) => Promise<unknown>} readJsonBody
 */
export async function handleAdminUsers(req, res, sendJson, readJsonBody) {
  const method = req.method?.toUpperCase() ?? 'GET'
  const url = new URL(req.url ?? '', 'http://localhost')
  const pathname = url.pathname

  // Authenticate and authorize
  let adminUser
  try {
    adminUser = await getCurrentAppUser(req)
    requireAdminUser(adminUser)
  } catch (err) {
    sendJson(res, err.statusCode ?? 403, { error: err.message })
    return
  }

  const db = getDatabaseClient()
  if (!db) {
    sendJson(res, 503, { error: 'Database not configured' })
    return
  }

  // GET /admin/users — list all users
  if (pathname === '/admin/users' && method === 'GET') {
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') ?? '50', 10)))
    const search = sanitizeText(url.searchParams.get('search') ?? '')
    const offset = (page - 1) * perPage

    try {
      let rows
      let countRows
      if (search) {
        const pattern = `%${search}%`
        rows = await db.sql`
          SELECT id, auth_provider_user_id, email, full_name, role,
                 access_status, is_active, can_access_app, last_login_at, created_at
          FROM app_user_access
          WHERE email ILIKE ${pattern} OR full_name ILIKE ${pattern}
          ORDER BY created_at DESC
          LIMIT ${perPage} OFFSET ${offset}
        `
        countRows = await db.sql`
          SELECT COUNT(*) AS total FROM app_user_access
          WHERE email ILIKE ${pattern} OR full_name ILIKE ${pattern}
        `
      } else {
        rows = await db.sql`
          SELECT id, auth_provider_user_id, email, full_name, role,
                 access_status, is_active, can_access_app, last_login_at, created_at
          FROM app_user_access
          ORDER BY created_at DESC
          LIMIT ${perPage} OFFSET ${offset}
        `
        countRows = await db.sql`SELECT COUNT(*) AS total FROM app_user_access`
      }

      const total = parseInt(countRows[0]?.total ?? '0', 10)
      sendJson(res, 200, { users: rows, total, page, perPage })
    } catch (err) {
      console.error('[admin] list users error:', err)
      sendJson(res, 500, { error: 'Failed to list users' })
    }
    return
  }

  // Routes that require a user ID: /admin/users/:id/:action
  const targetUserId = extractUserId(pathname)
  if (!targetUserId) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  const action = extractAction(pathname)

  if (method === 'POST') {
    // Fetch target user
    let targetRows
    try {
      targetRows = await db.sql`
        SELECT id, email, role, access_status, is_active, can_access_app
        FROM app_user_access WHERE id = ${targetUserId} LIMIT 1
      `
    } catch {
      sendJson(res, 500, { error: 'Database error' })
      return
    }

    if (!targetRows || targetRows.length === 0) {
      sendJson(res, 404, { error: 'User not found' })
      return
    }

    const target = targetRows[0]

    try {
      if (action === 'approve') {
        await db.sql`
          UPDATE app_user_access
          SET access_status = 'approved', can_access_app = true,
              approved_by = ${adminUser.email}, approved_at = now(), updated_at = now()
          WHERE id = ${targetUserId}
        `
        await writeAudit(db, target.id, 'access_approved', target.access_status, 'approved',
          target.role, target.role, adminUser.id, adminUser.email)
        sendJson(res, 200, { ok: true })

      } else if (action === 'block') {
        await db.sql`
          UPDATE app_user_access
          SET access_status = 'blocked', can_access_app = false, updated_at = now()
          WHERE id = ${targetUserId}
        `
        await writeAudit(db, target.id, 'access_blocked', target.access_status, 'blocked',
          target.role, target.role, adminUser.id, adminUser.email)
        sendJson(res, 200, { ok: true })

      } else if (action === 'revoke') {
        await db.sql`
          UPDATE app_user_access
          SET access_status = 'revoked', can_access_app = false,
              revoked_by = ${adminUser.email}, revoked_at = now(), updated_at = now()
          WHERE id = ${targetUserId}
        `
        await writeAudit(db, target.id, 'access_revoked', target.access_status, 'revoked',
          target.role, target.role, adminUser.id, adminUser.email)
        sendJson(res, 200, { ok: true })

      } else if (action === 'role') {
        const body = await readJsonBody(req)
        const newRole = sanitizeText(body?.role ?? '')
        if (!['admin', 'manager', 'user'].includes(newRole)) {
          sendJson(res, 400, { error: 'Invalid role. Must be admin, manager, or user.' })
          return
        }
        await db.sql`
          UPDATE app_user_access
          SET role = ${newRole}, updated_at = now()
          WHERE id = ${targetUserId}
        `
        await writeAudit(db, target.id, 'role_changed', target.access_status, target.access_status,
          target.role, newRole, adminUser.id, adminUser.email)
        sendJson(res, 200, { ok: true })

      } else {
        sendJson(res, 404, { error: 'Unknown action' })
      }
    } catch (err) {
      console.error('[admin] action error:', err)
      sendJson(res, 500, { error: 'Action failed' })
    }
    return
  }

  sendJson(res, 405, { error: 'Method not allowed' })
}

async function writeAudit(db, targetUserId, action, oldStatus, newStatus, oldRole, newRole, performedById, performedByEmail) {
  try {
    await db.sql`
      INSERT INTO app_user_access_audit
        (target_user_id, action, old_status, new_status, old_role, new_role,
         performed_by_user_id, performed_by_email)
      VALUES
        (${targetUserId}, ${action}, ${oldStatus ?? null}, ${newStatus ?? null},
         ${oldRole ?? null}, ${newRole ?? null},
         ${performedById ?? null}, ${performedByEmail ?? null})
    `
  } catch {
    // Audit failures should not block the main action
  }
}
