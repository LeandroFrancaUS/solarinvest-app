// server/auth/currentAppUser.js
import { query } from '../db.js'
import { getStackUser, isStackAuthBypassed, getBootstrapAdminEmail } from './stackAuth.js'

const ADMIN_BOOTSTRAP_EMAIL = getBootstrapAdminEmail()

/**
 * Ensure an existing (already-found) row is promoted to bootstrap admin status.
 * Called when we have already resolved the row via primary lookup OR email fallback.
 * Idempotent — only runs UPDATE if fields are not already correct.
 */
async function promoteToBootstrapAdmin(rowId, authProviderUserId) {
  try {
    await query(
      `UPDATE public.app_user_access
       SET role = 'admin',
           access_status = 'approved',
           is_active = true,
           can_access_app = true,
           approved_at = COALESCE(approved_at, now()),
           updated_at = now()
       WHERE id = $1
         AND (role != 'admin' OR access_status != 'approved' OR is_active = false OR can_access_app = false)`,
      [rowId]
    )
    console.info('[auth/user] promoteToBootstrapAdmin applied for rowId:', rowId)
  } catch (err) {
    console.warn('[auth] promoteToBootstrapAdmin error:', err?.message)
  }
}

/**
 * Create a brand-new bootstrap admin row for a first-time login.
 * Only called when no existing row was found by userId OR email.
 */
async function createBootstrapAdminRow(authProviderUserId, email, fullName) {
  try {
    const { rows } = await query(
      `INSERT INTO public.app_user_access
         (auth_provider_user_id, email, full_name, role, access_status, is_active, can_access_app, approved_at)
       VALUES ($1, $2, $3, 'admin', 'approved', true, true, now())
       ON CONFLICT (auth_provider_user_id) DO UPDATE
         SET role = 'admin',
             access_status = 'approved',
             is_active = true,
             can_access_app = true,
             email = EXCLUDED.email,
             full_name = COALESCE(EXCLUDED.full_name, app_user_access.full_name),
             approved_at = COALESCE(app_user_access.approved_at, now()),
             updated_at = now()
       RETURNING id, auth_provider_user_id, email, full_name, role,
                 access_status, is_active, can_access_app, last_login_at`,
      [authProviderUserId, email, fullName || null]
    )
    return rows[0] || null
  } catch (err) {
    console.warn('[auth] createBootstrapAdminRow error:', err?.message)
    return null
  }
}

/**
 * Provision a new user as "pending" on first login.
 * Only called when no existing row was found by userId OR email.
 * Never creates rows without an email.
 */
async function createPendingUserRow(authProviderUserId, email, fullName) {
  if (!email) return null
  try {
    const { rows } = await query(
      `INSERT INTO public.app_user_access
         (auth_provider_user_id, email, full_name, role, access_status, is_active, can_access_app)
       VALUES ($1, $2, $3, 'user', 'pending', true, false)
       ON CONFLICT (auth_provider_user_id) DO UPDATE
         SET email = EXCLUDED.email,
             full_name = COALESCE(EXCLUDED.full_name, app_user_access.full_name),
             last_login_at = now(),
             updated_at = now()
       RETURNING id, auth_provider_user_id, email, full_name, role,
                 access_status, is_active, can_access_app, last_login_at`,
      [authProviderUserId, email, fullName || null]
    )
    return rows[0] || null
  } catch (err) {
    console.warn('[auth] createPendingUserRow error:', err?.message)
    return null
  }
}

export async function getCurrentAppUser(req) {
  if (isStackAuthBypassed()) {
    return {
      id: 'bypass-admin',
      email: 'bypass@solarinvest.info',
      full_name: 'Bypass Admin',
      role: 'admin',
      access_status: 'approved',
      is_active: true,
      can_access_app: true,
    }
  }

  // 1) Get authenticated user from Stack Auth
  const stackUser = await getStackUser(req)
  if (!stackUser?.id) {
    return null
  }

  const authProviderUserId = stackUser.id
  const email = (stackUser.email || '').toLowerCase().trim()
  const fullName = stackUser.payload?.display_name || stackUser.payload?.name || null
  const isBootstrapAdmin =
    Boolean(ADMIN_BOOTSTRAP_EMAIL) &&
    Boolean(email) &&
    email === ADMIN_BOOTSTRAP_EMAIL.toLowerCase()

  // Diagnostic: safe to log (no secrets or token values)
  console.info(
    '[auth/user] resolving — userId:', authProviderUserId,
    '| email:', email || '(not in token)',
    '| isBootstrapAdmin:', isBootstrapAdmin,
  )

  // 2) Primary lookup: fetch authorization record by auth_provider_user_id.
  //    This is the fast path for all returning users.
  let record = null
  {
    const { rows } = await query(
      `SELECT id, auth_provider_user_id, email, full_name, role,
              access_status, is_active, can_access_app, last_login_at
       FROM public.app_user_access
       WHERE auth_provider_user_id = $1
       LIMIT 1`,
      [authProviderUserId]
    )
    record = rows[0] || null
    console.info(
      '[auth/user] primary lookup (by userId):',
      record
        ? `found — id=${record.id} status=${record.access_status} role=${record.role}`
        : 'not found',
    )
  }

  // 3) Email-based fallback: if no row was found by auth_provider_user_id but we
  //    have an email, look for an existing row by email.
  //
  //    This is the CORRECT ORDER — we must check email BEFORE creating any new row.
  //    Without this check, a new pending row would be created even when an approved
  //    row already exists for the same email with a different auth_provider_user_id.
  //
  //    This handles:
  //    • A row created before the auth_provider_user_id was correctly linked.
  //    • The bootstrap admin account on first login with a fresh token.
  //    When found, we update the row's auth_provider_user_id so future logins
  //    resolve via the faster primary path.
  if (!record && email) {
    try {
      // Prefer the approved/admin row if multiple exist for the same email.
      const { rows: emailRows } = await query(
        `SELECT id, auth_provider_user_id, email, full_name, role,
                access_status, is_active, can_access_app, last_login_at
         FROM public.app_user_access
         WHERE lower(email) = $1
         ORDER BY
           CASE WHEN access_status = 'approved' THEN 0 ELSE 1 END,
           CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
           created_at ASC
         LIMIT 1`,
        [email]
      )

      if (emailRows[0]) {
        const emailRow = emailRows[0]
        console.info(
          '[auth/user] email fallback matched row id:', emailRow.id,
          '| old userId:', emailRow.auth_provider_user_id,
          '| status:', emailRow.access_status, '| role:', emailRow.role,
          '— linking to current userId',
        )

        // Link the found row to the current auth_provider_user_id.
        // Conditional: skip if another row already claims this user ID (prevents
        // a UNIQUE constraint violation in the unlikely race where two logins
        // overlap and both reach this branch).
        const { rows: updated } = await query(
          `UPDATE public.app_user_access
           SET auth_provider_user_id = $1, updated_at = now()
           WHERE id = $2
             AND NOT EXISTS (
               SELECT 1 FROM public.app_user_access
               WHERE auth_provider_user_id = $1 AND id != $2
             )
           RETURNING id`,
          [authProviderUserId, emailRow.id]
        )

        if (updated.length > 0) {
          record = { ...emailRow, auth_provider_user_id: authProviderUserId }
        } else {
          // Another row already claimed auth_provider_user_id — re-fetch it.
          console.info('[auth/user] email-link skipped (userId already claimed) — re-fetching primary')
          const { rows: refetch } = await query(
            `SELECT id, auth_provider_user_id, email, full_name, role,
                    access_status, is_active, can_access_app, last_login_at
             FROM public.app_user_access
             WHERE auth_provider_user_id = $1
             LIMIT 1`,
            [authProviderUserId]
          )
          record = refetch[0] || null
        }
      }
    } catch (err) {
      console.warn('[auth/user] email-fallback error:', err?.message)
    }
  }

  // 4) Bootstrap admin promotion: if the resolved row (by either path) exists but
  //    is not yet admin/approved, promote it.  This ensures the bootstrap account
  //    is always authorised regardless of how the row was created.
  if (record && isBootstrapAdmin) {
    await promoteToBootstrapAdmin(record.id, authProviderUserId)
    // Reflect the promotion in the in-memory record so the response is correct
    // without needing an extra SELECT.
    record = {
      ...record,
      role: 'admin',
      access_status: 'approved',
      is_active: true,
      can_access_app: true,
    }
  }

  // 5) Provision (create row) only when no existing row was found at all.
  if (!record) {
    console.info('[auth/user] no row found — provisioning new row. isBootstrapAdmin:', isBootstrapAdmin)
    if (isBootstrapAdmin) {
      record = await createBootstrapAdminRow(authProviderUserId, email, fullName)
    } else if (email) {
      record = await createPendingUserRow(authProviderUserId, email, fullName)
      console.info('[auth/user] new pending row created — pendingRowCreated:true')
    }
  }

  console.info(
    '[auth/user] final record:',
    record
      ? `id=${record.id} status=${record.access_status} role=${record.role} canAccess=${record.can_access_app}`
      : 'null — user will see pending screen',
  )

  if (!record) {
    return null
  }

  // 6) Update last_login_at (best-effort, non-blocking)
  query(
    `UPDATE public.app_user_access SET last_login_at = now(), updated_at = now()
     WHERE auth_provider_user_id = $1`,
    [authProviderUserId]
  ).catch((err) => {
    console.warn('[auth] Failed to update last_login_at:', err?.message)
  })

  return record
}
