// server/routes/rbacInspect.js
// Diagnostic endpoint for inspecting RBAC resolution and data ownership.
// Intended for admin-only operational troubleshooting.

import { query } from '../db.js'
import { resolveActor, actorRole } from '../proposals/permissions.js'
import { getUserPermissions } from '../auth/stackPermissions.js'

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseEmailsParam(requestUrl) {
  const raw = sanitizeString(requestUrl.searchParams.get('emails') || '')
  const defaults = [
    'brsolarinvest@gmail.com',
    'cmdosanjos123@gmail.com',
    'leandro.orders@gmail.com',
    'laienygomes1@gmail.com',
  ]
  if (!raw) return defaults
  return raw
    .split(',')
    .map((entry) => sanitizeString(entry).toLowerCase())
    .filter(Boolean)
}

export async function handleRbacInspectRequest(req, res, { sendJson, requestUrl }) {
  let actor
  try {
    actor = await resolveActor(req)
  } catch (err) {
    sendJson(res, 401, { error: 'UNAUTHENTICATED', message: err?.message ?? 'Authentication required' })
    return
  }

  if (!actor?.isAdmin) {
    sendJson(res, 403, { error: 'FORBIDDEN', message: 'Admin only endpoint' })
    return
  }

  const emails = parseEmailsParam(requestUrl)
  const { rows } = await query(
    `
      SELECT
        a.id,
        a.auth_provider_user_id,
        a.email,
        a.full_name,
        a.role AS app_access_role,
        a.access_status,
        a.is_active,
        a.can_access_app,
        up.primary_role AS profile_primary_role,
        up.team_id AS profile_team_id,
        up.regional_id AS profile_regional_id,
        (SELECT COUNT(*) FROM clients c WHERE c.deleted_at IS NULL AND c.owner_user_id = a.auth_provider_user_id)  AS clients_owned,
        (SELECT COUNT(*) FROM proposals p WHERE p.deleted_at IS NULL AND p.owner_user_id = a.auth_provider_user_id) AS proposals_owned
      FROM app_user_access a
      LEFT JOIN app_user_profiles up ON up.stack_user_id = a.auth_provider_user_id
      WHERE lower(a.email) = ANY($1::text[])
      ORDER BY a.email ASC
    `,
    [emails.map((email) => email.toLowerCase())]
  )

  const users = await Promise.all(rows.map(async (row) => {
    const perms = await getUserPermissions(row.auth_provider_user_id)
    return {
      id: row.id,
      stackUserId: row.auth_provider_user_id,
      email: row.email,
      fullName: row.full_name,
      appAccessRole: row.app_access_role,
      accessStatus: row.access_status,
      isActive: row.is_active,
      canAccessApp: row.can_access_app,
      profilePrimaryRole: row.profile_primary_role ?? null,
      teamId: row.profile_team_id ?? null,
      regionalId: row.profile_regional_id ?? null,
      clientsOwned: Number(row.clients_owned ?? 0),
      proposalsOwned: Number(row.proposals_owned ?? 0),
      stackPermissions: Array.isArray(perms) ? perms : [],
    }
  }))

  sendJson(res, 200, {
    actor: {
      userId: actor.userId,
      email: actor.email,
      displayName: actor.displayName,
      resolvedRole: actorRole(actor),
      flags: {
        isAdmin: actor.isAdmin,
        isFinanceiro: actor.isFinanceiro,
        isOffice: actor.isOffice,
        isComercial: actor.isComercial,
      },
    },
    requestedEmails: emails,
    foundUsers: users.length,
    users,
  })
}

