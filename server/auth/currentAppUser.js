// server/auth/currentAppUser.js
import { query } from '../db.js'
import { getStackUser, isStackAuthBypassed, getBootstrapAdminEmail } from './stackAuth.js'

const ADMIN_BOOTSTRAP_EMAIL = getBootstrapAdminEmail()

/**
 * Ensure the bootstrap admin (brsolarinvest@gmail.com) has admin access.
 * Idempotent. Handles three scenarios:
 *
 *  a) No row yet (first login): INSERT a new admin row.
 *  b) Row exists with the same auth_provider_user_id: UPDATE to admin via ON CONFLICT.
 *  c) Row exists with a DIFFERENT auth_provider_user_id (orphaned pending row from a
 *     previous broken session): promote it to admin WITHOUT changing its user ID so
 *     the primary SELECT (which uses auth_provider_user_id) will not find it — but the
 *     email-based fallback SELECT will link it on the next step.
 */
async function ensureBootstrapAdmin(authProviderUserId, email, fullName) {
  if (!ADMIN_BOOTSTRAP_EMAIL || email.toLowerCase() !== ADMIN_BOOTSTRAP_EMAIL.toLowerCase()) {
    return
  }

  try {
    // Primary: upsert by auth_provider_user_id — creates or promotes the current
    // session's row.
    await query(
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
             updated_at = now()`,
      [authProviderUserId, email, fullName || null]
    )

    // Secondary: also promote any OTHER row that has the bootstrap email but is not
    // yet admin/approved (e.g., a pending row created with a different user ID during
    // an earlier broken session). This does NOT change auth_provider_user_id — the
    // email-based fallback SELECT in getCurrentAppUser will re-link it.
    await query(
      `UPDATE public.app_user_access
       SET role = 'admin',
           access_status = 'approved',
           is_active = true,
           can_access_app = true,
           approved_at = COALESCE(approved_at, now()),
           updated_at = now()
       WHERE lower(email) = lower($1)
         AND auth_provider_user_id != $2
         AND (role != 'admin' OR access_status != 'approved' OR is_active = false OR can_access_app = false)`,
      [email, authProviderUserId]
    )
  } catch (err) {
    console.warn('[auth] ensureBootstrapAdmin error:', err?.message)
  }
}

/**
 * Provision a new user as "pending" on first login.
 * Does nothing if the user already exists (by auth_provider_user_id).
 * Skipped when email is absent — we never create rows without an email.
 */
async function provisionNewUser(authProviderUserId, email, fullName) {
  if (!email) return
  try {
    await query(
      `INSERT INTO public.app_user_access
         (auth_provider_user_id, email, full_name, role, access_status, is_active, can_access_app)
       VALUES ($1, $2, $3, 'user', 'pending', true, false)
       ON CONFLICT (auth_provider_user_id) DO UPDATE
         SET email = EXCLUDED.email,
             full_name = COALESCE(EXCLUDED.full_name, app_user_access.full_name),
             last_login_at = now(),
             updated_at = now()`,
      [authProviderUserId, email, fullName || null]
    )
  } catch (err) {
    console.warn('[auth] provisionNewUser error:', err?.message)
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

  // Diagnostic: safe to log (no secrets or token values)
  console.info(
    '[auth/user] resolving — userId:', authProviderUserId,
    '| email:', email || '(not in token)',
  )

  // NOTE: We no longer return null when email is absent from the JWT payload.
  // The primary DB lookup is always by auth_provider_user_id (which is always
  // present as `sub` in verified JWTs). Bootstrap admin promotion and user
  // provisioning are email-dependent operations and are skipped when email is
  // absent, but the lookup itself always runs.

  if (email) {
    // 2) Bootstrap admin promotion (idempotent, also fixes orphaned pending rows)
    await ensureBootstrapAdmin(authProviderUserId, email, fullName)

    // 3) Provision on first login (no-op if already exists; skipped when email absent)
    await provisionNewUser(authProviderUserId, email, fullName)
  }

  // 4) Primary lookup: fetch authorization record by auth_provider_user_id
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
      '[auth/user] primary lookup by userId:',
      record
        ? `found — id=${record.id} status=${record.access_status} role=${record.role}`
        : 'not found',
    )
  }

  // 5) Email-based fallback: if no row was found by auth_provider_user_id but we
  //    have an email, look for an existing row by email.  This handles:
  //    • A row created with a different/old auth_provider_user_id (e.g., from a
  //      previous session before the JWT was correctly linked).
  //    • The bootstrap admin secondary-update from step 2, which promoted a row
  //      without re-linking its user ID.
  //    When found, we update the row's auth_provider_user_id so future logins
  //    resolve via the faster primary path.
  if (!record && email) {
    try {
      // Prefer the approved/admin row if multiple exist for the same email
      // (e.g., one pending and one admin from the bootstrap secondary-update).
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
          '| status:', emailRow.access_status,
          '| role:', emailRow.role,
          '— linking to current userId',
        )

        // Link the found row to the new auth_provider_user_id. The UPDATE is
        // conditional: skip if another row already claims this user ID (prevents
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
          // Another row already claimed auth_provider_user_id; re-fetch it.
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

  console.info(
    '[auth/user] final record:',
    record
      ? `id=${record.id} status=${record.access_status} role=${record.role} canAccess=${record.can_access_app}`
      : 'null — user will see pending screen',
  )

  if (!record) {
    return null
  }

  // 6) Update last_login_at (best-effort, non-blocking — failure here does not affect auth)
  query(
    `UPDATE public.app_user_access SET last_login_at = now(), updated_at = now()
     WHERE auth_provider_user_id = $1`,
    [authProviderUserId]
  ).catch((err) => {
    console.warn('[auth] Failed to update last_login_at:', err?.message)
  })

  return record
}
