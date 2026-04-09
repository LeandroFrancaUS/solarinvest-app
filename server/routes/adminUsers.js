// server/routes/adminUsers.js
// Admin endpoints for managing user access.
// All routes require admin role with approved access.

import crypto from 'node:crypto'
import { getCurrentAppUser } from '../auth/currentAppUser.js'
import { requireAdmin } from '../auth/rbac.js'
import { query } from '../db.js'
import {
  getUserPermissions,
  grantUserPermission,
  revokeUserPermission,
  deleteStackUser,
  createStackUser,
  lookupStackUserByEmail,
} from '../auth/stackPermissions.js'
import { syncUserProfile } from '../auth/userProfileSync.js'
import { derivePrimaryRole } from '../auth/authorizationSnapshot.js'
import { stackPermToDbRole } from '../auth/roleMapping.js'

// The four primary role permissions — a user may hold more than one simultaneously.
// Capabilities from all held roles are unioned (see deriveCapabilities in
// server/auth/authorizationSnapshot.js).
const PRIMARY_ROLE_PERMISSIONS = ['role_admin', 'role_comercial', 'role_office', 'role_financeiro']
const VALID_STACK_PERMISSIONS = PRIMARY_ROLE_PERMISSIONS

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

const newCorrelationId = () => crypto.randomUUID()

async function writeAudit(targetUserId, action, oldStatus, newStatus, oldRole, newRole, performedBy, extra = {}) {
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
    console.warn('[auth] writeAudit error:', err?.message, extra)
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

  // Enrich each user with their current Stack Auth permissions and sync status
  const users = await Promise.all(
    listResult.rows.map(async (user) => {
      const stackId = sanitizeString(user.auth_provider_user_id)
      let stack_permissions = []
      let sync_status = 'no_stack_id'
      if (stackId) {
        const perms = await getUserPermissions(stackId)
        if (Array.isArray(perms)) {
          stack_permissions = perms.filter((p) => VALID_STACK_PERMISSIONS.includes(p))
          // Derive what the DB role *should* be based on Stack permissions
          const expectedDbRole = stackPermToDbRole(derivePrimaryRole(stack_permissions))
          const actualDbRole = sanitizeString(user.role)
          sync_status = expectedDbRole === actualDbRole ? 'in_sync' : 'drifted'
        } else {
          // Permissions fetch failed (API error)
          sync_status = 'sync_failed'
        }
      }
      return { ...user, stack_permissions, sync_status }
    })
  )

  sendJson(res, 200, {
    users,
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

// POST /api/admin/users/:id/permissions/:perm  — grant a Stack Auth permission
export async function handleAdminUserGrantPermission(req, res, { sendJson, userId, permId }) {
  const appUser = await getCurrentAppUser(req)
  requireAdmin(appUser)

  if (!VALID_STACK_PERMISSIONS.includes(permId)) {
    sendJson(res, 400, { error: `Invalid permission. Must be one of: ${VALID_STACK_PERMISSIONS.join(', ')}` })
    return
  }

  const { rows } = await query(
    `SELECT id, auth_provider_user_id, role FROM public.app_user_access WHERE id = $1 LIMIT 1`,
    [userId]
  )
  const target = rows[0]
  if (!target) {
    sendJson(res, 404, { error: 'User not found' })
    return
  }

  if (!process.env.STACK_SECRET_SERVER_KEY) {
    sendJson(res, 503, { error: 'Stack Auth API key não configurada no servidor (STACK_SECRET_SERVER_KEY ausente)' })
    return
  }

  const stackId = sanitizeString(target.auth_provider_user_id)
  if (!stackId) {
    sendJson(res, 422, { error: 'User has no linked Stack Auth account' })
    return
  }

  const correlationId = newCorrelationId()

  // Idempotency check: skip grant if user already has this permission.
  const existingPerms = await getUserPermissions(stackId, { correlationId })
  if (Array.isArray(existingPerms) && existingPerms.includes(permId)) {
    console.info('[admin] permission already present — skipping grant (idempotent)', { stackId, permId, correlationId })
  } else {
    // Grant the requested permission
    const result = await grantUserPermission(stackId, permId, { correlationId })
    if (!result.ok) {
      const isConfigError = result.error?.includes('não configurad') || result.error?.includes('not configured')
      sendJson(res, isConfigError ? 503 : 502, {
        error: result.error ?? 'Failed to grant permission via Stack Auth API',
        provider_status: result.providerStatus ?? null,
        correlation_id: correlationId,
      })
      return
    }
  }

  // Sync the DB role to match the newly granted Stack permission (source of truth sync).
  // This ensures requireAdmin() gates see the updated role immediately.
  const newDbRole = stackPermToDbRole(permId)
  const oldDbRole = sanitizeString(target.role)
  if (newDbRole !== oldDbRole) {
    await query(
      `UPDATE public.app_user_access SET role = $2, updated_at = now() WHERE id = $1`,
      [userId, newDbRole]
    )
  }

  // Sync the updated primary role into app_user_profiles (best-effort)
  syncUserProfile(stackId, permId, null, null).catch((err) => {
    console.warn('[admin] syncUserProfile after grant failed (non-fatal):', err?.message)
  })

  console.info('RBAC update', {
    actorUserId: appUser.auth_provider_user_id ?? appUser.id,
    targetUserId: stackId,
    permissionId: permId,
    action: 'grant',
    dbRoleChanged: newDbRole !== oldDbRole,
    correlationId,
  })

  await writeAudit(userId, 'permission_granted', null, null, oldDbRole, permId, appUser, { correlationId })
  sendJson(res, 200, { ok: true })
}

// DELETE /api/admin/users/:id/permissions/:perm  — revoke a Stack Auth permission
export async function handleAdminUserRevokePermission(req, res, { sendJson, userId, permId }) {
  const appUser = await getCurrentAppUser(req)
  requireAdmin(appUser)

  if (!VALID_STACK_PERMISSIONS.includes(permId)) {
    sendJson(res, 400, { error: `Invalid permission. Must be one of: ${VALID_STACK_PERMISSIONS.join(', ')}` })
    return
  }

  const { rows } = await query(
    `SELECT id, auth_provider_user_id, role FROM public.app_user_access WHERE id = $1 LIMIT 1`,
    [userId]
  )
  const target = rows[0]
  if (!target) {
    sendJson(res, 404, { error: 'User not found' })
    return
  }

  if (!process.env.STACK_SECRET_SERVER_KEY) {
    sendJson(res, 503, { error: 'Stack Auth API key não configurada no servidor (STACK_SECRET_SERVER_KEY ausente)' })
    return
  }

  const stackId = sanitizeString(target.auth_provider_user_id)
  if (!stackId) {
    sendJson(res, 422, { error: 'User has no linked Stack Auth account' })
    return
  }

  // Last-admin protection: prevent revoking role_admin from the last active admin.
  if (permId === 'role_admin') {
    const { rows: adminRows } = await query(
      `SELECT COUNT(*) AS total FROM public.app_user_access
       WHERE role = 'admin' AND is_active = true AND access_status = 'approved'`
    )
    const adminCount = parseInt(adminRows[0]?.total || '0', 10)
    if (adminCount <= 1) {
      sendJson(res, 409, {
        error: 'Não é possível revogar o último administrador ativo. Promova outro usuário a admin antes.',
        code: 'LAST_ADMIN_PROTECTION',
      })
      return
    }
  }

  const correlationId = newCorrelationId()
  const result = await revokeUserPermission(stackId, permId, { correlationId })
  if (!result.ok) {
    const isConfigError = result.error?.includes('não configurad') || result.error?.includes('not configured')
    sendJson(res, isConfigError ? 503 : 502, {
      error: result.error ?? 'Failed to revoke permission via Stack Auth API',
      provider_status: result.providerStatus ?? null,
      correlation_id: correlationId,
    })
    return
  }

  // After revoke, determine what the new primary role is and sync profile + DB
  const oldDbRole = sanitizeString(target.role)
  getUserPermissions(stackId, { correlationId })
    .then(async (perms) => {
      const newStackRole = derivePrimaryRole(Array.isArray(perms) ? perms : [])
      const newDbRole = stackPermToDbRole(newStackRole)
      // Sync DB role (best-effort — revoking doesn't always change DB role, but keep in sync)
      if (newDbRole !== oldDbRole) {
        await query(
          `UPDATE public.app_user_access SET role = $2, updated_at = now() WHERE id = $1`,
          [userId, newDbRole]
        ).catch((err) => {
          console.warn('[admin] DB role sync after revoke failed (non-fatal):', err?.message)
        })
      }
      return syncUserProfile(stackId, newStackRole, null, null)
    })
    .catch((err) => {
      console.warn('[admin] syncUserProfile after revoke failed (non-fatal):', err?.message)
    })

  console.info('RBAC update', {
    actorUserId: appUser.auth_provider_user_id ?? appUser.id,
    targetUserId: stackId,
    permissionId: permId,
    action: 'revoke',
    correlationId,
  })

  await writeAudit(userId, 'permission_revoked', null, null, oldDbRole, permId, appUser, { correlationId })
  sendJson(res, 200, { ok: true })
}

// DELETE /api/admin/users/:id  — permanently delete a user from DB and Stack Auth
export async function handleAdminUserDelete(req, res, { sendJson, userId }) {
  const appUser = await getCurrentAppUser(req)
  requireAdmin(appUser)

  const { rows } = await query(
    `SELECT id, auth_provider_user_id, email FROM public.app_user_access WHERE id = $1 LIMIT 1`,
    [userId]
  )
  const target = rows[0]
  if (!target) {
    sendJson(res, 404, { error: 'User not found' })
    return
  }

  const stackId = sanitizeString(target.auth_provider_user_id)

  // Write audit BEFORE deleting so the record still exists for FK constraints
  await writeAudit(userId, 'user_deleted', null, null, null, null, appUser)

  // Delete from Stack Auth first (best-effort — proceed even on failure)
  if (stackId) {
    const stackDeleted = await deleteStackUser(stackId)
    if (!stackDeleted) {
      console.warn('[admin] Failed to delete user from Stack Auth:', stackId)
    }
  }

  // Delete from DB
  await query(`DELETE FROM public.app_user_access WHERE id = $1`, [userId])

  sendJson(res, 200, { ok: true })
}

// POST /api/admin/users  — provision a new user (DB row + Stack Auth account + permissions)
export async function handleAdminUserCreate(req, res, { sendJson, body }) {
  const appUser = await getCurrentAppUser(req)
  requireAdmin(appUser)

  if (!process.env.STACK_SECRET_SERVER_KEY) {
    sendJson(res, 503, { error: 'Stack Auth API key não configurada no servidor (STACK_SECRET_SERVER_KEY ausente)' })
    return
  }

  const email = sanitizeString(body?.email).toLowerCase()
  if (!email || !email.includes('@')) {
    sendJson(res, 400, { error: 'E-mail inválido ou ausente.' })
    return
  }

  const displayName = sanitizeString(body?.displayName || body?.full_name || '')

  const permissions = Array.isArray(body?.permissions)
    ? body.permissions.filter((p) => VALID_STACK_PERMISSIONS.includes(p))
    : []

  if (permissions.length === 0) {
    sendJson(res, 400, { error: 'Selecione ao menos uma permissão para o novo usuário.' })
    return
  }

  // Check for duplicate email in the DB
  const { rows: existing } = await query(
    `SELECT id FROM public.app_user_access WHERE lower(email) = $1 LIMIT 1`,
    [email]
  )
  if (existing.length > 0) {
    sendJson(res, 409, { error: 'Já existe um usuário com esse e-mail.' })
    return
  }

  const correlationId = newCorrelationId()

  // 1) Create the user in Stack Auth — or look up the existing one if it already exists.
  const createResult = await createStackUser(email, displayName || null, { correlationId })
  let stackUserId
  if (!createResult.ok) {
    if (createResult.providerStatus === 409) {
      // User already exists in Stack Auth (e.g. signed in before, or created externally).
      // Look up their userId so we can link them to the app DB and grant permissions.
      const lookupResult = await lookupStackUserByEmail(email, { correlationId })
      if (!lookupResult.ok) {
        sendJson(res, 409, {
          error: 'Já existe uma conta Stack Auth com esse e-mail, mas não foi possível localizá-la para vinculação. Verifique se o e-mail está correto ou contacte o suporte.',
          provider_status: lookupResult.providerStatus ?? null,
          correlation_id: correlationId,
        })
        return
      }
      stackUserId = lookupResult.userId
      console.info('[admin] handleAdminUserCreate: linking existing Stack Auth user', { email, stackUserId, correlationId })
    } else {
      sendJson(res, 502, {
        error: createResult.error ?? 'Falha ao criar usuário no Stack Auth',
        provider_status: createResult.providerStatus ?? null,
        correlation_id: correlationId,
      })
      return
    }
  } else {
    stackUserId = createResult.userId
  }

  // 2) Derive DB role from the highest-priority permission being granted
  const derivedDbRole = stackPermToDbRole(derivePrimaryRole(permissions))

  // 3) Insert the DB row (approved immediately — admin is provisioning this user)
  let newRow
  try {
    const { rows } = await query(
      `INSERT INTO public.app_user_access
         (auth_provider_user_id, email, full_name, role, access_status, is_active, can_access_app,
          invited_by, approved_by, approved_at)
       VALUES ($1, $2, $3, $4, 'approved', true, true, $5, $5, now())
       RETURNING id, auth_provider_user_id, email, full_name, role, access_status, is_active, can_access_app`,
      [stackUserId, email, displayName || null, derivedDbRole, appUser.email || appUser.id]
    )
    newRow = rows[0]
  } catch (dbErr) {
    console.error('[admin] handleAdminUserCreate: DB insert failed', dbErr?.message, { email, stackUserId, correlationId })
    sendJson(res, 500, { error: 'Falha ao salvar usuário no banco de dados.' })
    return
  }

  // 4) Grant all requested permissions in Stack Auth (best-effort — log failures)
  const grantResults = await Promise.allSettled(
    permissions.map((perm) => grantUserPermission(stackUserId, perm, { correlationId }))
  )
  const failedGrants = grantResults
    .map((r, i) => ({ perm: permissions[i], result: r }))
    .filter((g) => g.result.status === 'rejected' || !g.result.value?.ok)

  if (failedGrants.length > 0) {
    console.warn(
      '[admin] handleAdminUserCreate: some permissions failed to grant',
      failedGrants.map((g) => g.perm),
      { correlationId }
    )
  }

  await writeAudit(
    newRow.id,
    'user_created',
    null,
    'approved',
    null,
    permissions.join(','),
    appUser,
    { correlationId, stackUserId }
  )

  sendJson(res, 201, {
    ok: true,
    user: {
      ...newRow,
      stack_permissions: permissions.filter((_, i) => grantResults[i].status === 'fulfilled' && grantResults[i].value?.ok),
    },
    failedPermissions: failedGrants.length > 0 ? failedGrants.map((g) => g.perm) : undefined,
  })
}
