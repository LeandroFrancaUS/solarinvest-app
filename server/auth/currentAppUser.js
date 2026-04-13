// server/auth/currentAppUser.js
import { query } from '../db.js'
import { getStackUser, isStackAuthBypassed, getBootstrapAdminEmail, getProjectId } from './stackAuth.js'
import { ensureAdminPermissionForUser, ensureComercialPermissionForUsers, ensureOfficePermissionForUsers, getUserPermissions } from './stackPermissions.js'
import { syncUserProfile } from './userProfileSync.js'
import { derivePrimaryRole } from './authorizationSnapshot.js'

const ADMIN_BOOTSTRAP_EMAIL = getBootstrapAdminEmail()

/**
 * Sentinel suffix used for placeholder email addresses created when a user
 * authenticates but the JWT carries no email claim and the Stack Auth server
 * API is unavailable (no STACK_SECRET_SERVER_KEY).  Rows with this suffix are
 * treated specially so we can detect and update them once a real email arrives.
 */
const PLACEHOLDER_EMAIL_SUFFIX = '@stack-auth.placeholder'

/**
 * Returns true if a placeholder email was assigned by the first-user bootstrap.
 */
function isPlaceholderEmail(email) {
  return typeof email === 'string' && email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)
}

// ─── One-time startup initialization ─────────────────────────────────────────
// Module-level flag: reset per cold start (serverless), stable per warm instance.
let _initAttempted = false

/**
 * Returns true when at least one approved admin row exists in the DB.
 * Used to decide whether to apply the "first-user bootstrap admin" fallback.
 * Throws on DB error so callers can handle it appropriately.
 */
async function hasApprovedAdmin() {
  const { rows } = await query(
    `SELECT 1 FROM public.app_user_access
     WHERE access_status = 'approved' AND role = 'admin'
     LIMIT 1`
  )
  return rows.length > 0
}

/**
 * Idempotent startup check:
 * 1. Create `app_user_access` table if it does not exist (safe when migration ran).
 * 2. Run bootstrap admin self-heal: promote any pending row for the bootstrap email.
 *
 * Best-effort — never throws to callers. A failure here is logged and retried on
 * the next invocation (flag reset). The primary auth queries will fail independently
 * if the DB is truly unavailable, giving the caller their own error path.
 */
async function ensureSchemaAndBootstrapData() {
  if (_initAttempted) return
  _initAttempted = true
  try {
    // Create the table if not present (idempotent; no-op when migration already ran)
    await query(`
      CREATE TABLE IF NOT EXISTS public.app_user_access (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        auth_provider_user_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        full_name TEXT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        access_status TEXT NOT NULL DEFAULT 'pending',
        is_active BOOLEAN NOT NULL DEFAULT true,
        can_access_app BOOLEAN NOT NULL DEFAULT false,
        invited_by TEXT NULL,
        approved_by TEXT NULL,
        approved_at TIMESTAMPTZ NULL,
        revoked_by TEXT NULL,
        revoked_at TIMESTAMPTZ NULL,
        last_login_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT app_user_access_role_chk
          CHECK (role IN ('admin','manager','user')),
        CONSTRAINT app_user_access_status_chk
          CHECK (access_status IN ('pending','approved','revoked','blocked'))
      )
    `)

    // Self-heal: if a row for the bootstrap admin exists but is pending/inactive,
    // promote it now so the first auth request resolves correctly.
    if (ADMIN_BOOTSTRAP_EMAIL) {
      await query(
        `UPDATE public.app_user_access
         SET role = 'admin',
             access_status = 'approved',
             is_active = true,
             can_access_app = true,
             approved_at = COALESCE(approved_at, now()),
             updated_at = now()
         WHERE lower(email) = lower($1)
           AND (role != 'admin' OR access_status != 'approved'
                OR is_active = false OR can_access_app = false)`,
        [ADMIN_BOOTSTRAP_EMAIL]
      )
    }

    // First-user bootstrap self-heal: if no approved admin exists at all, promote
    // the oldest row (the first user who ever logged in) to admin.  This covers
    // the case where the JWT had no email claim so the email-based self-heal above
    // could not match any row, leaving the system with only pending rows.
    await query(
      `UPDATE public.app_user_access
       SET role          = 'admin',
           access_status = 'approved',
           is_active     = true,
           can_access_app = true,
           approved_at   = COALESCE(approved_at, now()),
           updated_at    = now()
       WHERE id = (
         SELECT id FROM public.app_user_access
         ORDER BY created_at ASC
         LIMIT 1
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.app_user_access
         WHERE access_status = 'approved' AND role = 'admin'
       )`
    )

    // Auto-approve all remaining pending rows.
    // Stack Auth is the identity gate — any user who has authenticated via Stack
    // Auth and has a row here should be able to access the app.  The 'pending'
    // state was an extra manual approval step that is not needed when using Stack
    // Auth's built-in sign-up rules / email verification.
    await query(
      `UPDATE public.app_user_access
       SET access_status = 'approved',
           can_access_app = true,
           approved_at   = COALESCE(approved_at, now()),
           updated_at    = now()
       WHERE access_status = 'pending'`
    )

    // Bulk self-heal: fix ALL approved rows where can_access_app or is_active are
    // still false due to schema defaults or direct-SQL edits.
    // Affects ALL users — important when the problem is widespread.
    // The authorized flag in authMe.js requires can_access_app AND is_active to
    // both be true for an approved row; without this heal every such user sees
    // "Acesso pendente" even though their account is legitimately approved.
    await query(
      `UPDATE public.app_user_access
       SET can_access_app = true,
           is_active      = true,
           updated_at     = now()
       WHERE access_status = 'approved'
         AND (can_access_app = false OR is_active = false)`
    )
    console.info('[auth/init] schema + bootstrap self-heal OK')
  } catch (err) {
    _initAttempted = false   // allow retry on next request
    console.warn('[auth/init] initialization warning (non-fatal):', err?.message)
  }
}

// ─── Optional: fetch email from Stack Auth server API ─────────────────────────
/**
 * When the JWT access token does not include an email claim (Stack Auth v2+
 * omits it in some configurations), fall back to the server-side user-info
 * endpoint to retrieve the primary email.
 *
 * Requires STACK_SECRET_SERVER_KEY to be configured; silently returns '' when
 * absent so callers degrade gracefully rather than crashing.
 */
async function fetchEmailFromStackAuth(userId) {
  const secretKey = (process.env.STACK_SECRET_SERVER_KEY ?? '').trim()
  const projectId = getProjectId()
  if (!secretKey || !projectId || !userId) return ''
  try {
    const url = `https://api.stack-auth.com/api/v1/users/${encodeURIComponent(userId)}`
    const res = await fetch(url, {
      headers: {
        'x-stack-access-type': 'server',
        'x-stack-project-id': projectId,
        'x-stack-secret-server-key': secretKey,
      },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) {
      console.warn('[auth/user] fetchEmailFromStackAuth: HTTP', res.status, 'for userId:', userId)
      return ''
    }
    const data = await res.json()
    const email = (
      data?.primary_email ??
      data?.email ??
      data?.primaryEmail ??
      ''
    )
    return typeof email === 'string' ? email.toLowerCase().trim() : ''
  } catch (err) {
    console.warn('[auth/user] fetchEmailFromStackAuth error:', err?.message)
    return ''
  }
}

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
 * Provision a new Stack Auth-authenticated user as "approved" on first login.
 *
 * Stack Auth is the identity source-of-truth: if the user has a valid JWT they
 * have already been verified by the identity provider.  Creating them as
 * 'pending' and requiring manual approval just blocks legitimate users.
 * We auto-approve with role='user' so they can access the app immediately,
 * while still keeping the RBAC row so admins can later promote or revoke.
 *
 * Only called when no existing row was found by userId OR email.
 * Never creates rows without an email.
 */
async function createApprovedUserRow(authProviderUserId, email, fullName) {
  if (!email) return null
  try {
    const { rows } = await query(
      `INSERT INTO public.app_user_access
         (auth_provider_user_id, email, full_name, role, access_status, is_active, can_access_app, approved_at)
       VALUES ($1, $2, $3, 'user', 'approved', true, true, now())
       ON CONFLICT (auth_provider_user_id) DO UPDATE
         SET email = EXCLUDED.email,
             full_name = COALESCE(EXCLUDED.full_name, app_user_access.full_name),
             -- If the row was previously pending, upgrade it now.
             access_status = CASE
               WHEN app_user_access.access_status = 'pending' THEN 'approved'
               ELSE app_user_access.access_status
             END,
             can_access_app = CASE
               WHEN app_user_access.access_status = 'pending' THEN true
               ELSE app_user_access.can_access_app
             END,
             approved_at = CASE
               WHEN app_user_access.access_status = 'pending' THEN now()
               ELSE app_user_access.approved_at
             END,
             last_login_at = now(),
             updated_at = now()
       RETURNING id, auth_provider_user_id, email, full_name, role,
                 access_status, is_active, can_access_app, last_login_at`,
      [authProviderUserId, email, fullName || null]
    )
    return rows[0] || null
  } catch (err) {
    console.warn('[auth] createApprovedUserRow error:', err?.message)
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

  // 0) One-time startup check: ensure table exists + run bootstrap self-heal.
  //    Best-effort; never throws — the primary auth queries handle their own errors.
  await ensureSchemaAndBootstrapData()

  // 1) Get authenticated user from Stack Auth
  const stackUser = await getStackUser(req)
  if (!stackUser?.id) {
    return null
  }

  const authProviderUserId = stackUser.id
  // Stack Auth v2 access tokens may omit `email` from the JWT payload.
  // Try multiple field names to maximise compatibility.
  let email = (
    stackUser.email ||
    stackUser.payload?.email ||
    stackUser.payload?.primary_email ||
    stackUser.payload?.primaryEmail ||
    ''
  ).toLowerCase().trim()

  const fullName =
    stackUser.payload?.display_name ||
    stackUser.payload?.displayName ||
    stackUser.payload?.name ||
    null

  const isBootstrapAdminByEmail = (addr) =>
    Boolean(ADMIN_BOOTSTRAP_EMAIL) &&
    Boolean(addr) &&
    addr.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase()

  const isBootstrapAdmin = isBootstrapAdminByEmail(email)

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

  // 2b) If the JWT had no email but we have the DB record's email, try to fetch
  //     a fresh email from the Stack Auth server API (requires STACK_SECRET_SERVER_KEY).
  //     This also handles the case where the bootstrap admin's email was not in the JWT.
  if (!email && record?.email) {
    // Use email from the DB record (already verified via userId match).
    // Skip placeholder emails created by the first-user bootstrap so we can
    // continue looking for a real one via the Stack Auth API below.
    const recordEmail = record.email.toLowerCase().trim()
    if (!recordEmail.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) {
      email = recordEmail
      console.info('[auth/user] email resolved from DB record:', email)
    } else {
      // Row has a placeholder — try Stack Auth API for a real email
      const fetched = await fetchEmailFromStackAuth(authProviderUserId)
      if (fetched) {
        email = fetched
        console.info('[auth/user] email resolved from Stack Auth API (replacing placeholder):', email)
        // Persist the real email so future logins skip this path.
        // Await to ensure the DB is updated before we propagate the email
        // in the in-memory record (prevents a stale record on failure).
        try {
          await query(
            `UPDATE public.app_user_access SET email = $1, updated_at = now()
             WHERE id = $2 AND email != $1`,
            [email, record.id]
          )
          record = { ...record, email }
        } catch (updateErr) {
          console.warn('[auth/user] failed to update placeholder email in DB:', updateErr?.message)
          // Don't update in-memory record if DB write failed — next login will retry.
        }
      }
    }
  } else if (!email) {
    // No email from JWT and no DB record — try Stack Auth server API
    const fetched = await fetchEmailFromStackAuth(authProviderUserId)
    if (fetched) {
      email = fetched
      console.info('[auth/user] email resolved from Stack Auth API:', email)
    }
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
  //    is not yet admin/approved, promote it.
  //
  //    IMPORTANT: we check BOTH the JWT/API email AND the DB record's own email.
  //    Stack Auth v2 access tokens often omit `email` from the JWT payload, so
  //    the record's stored email is the reliable source of truth once the row has
  //    been located via the verified auth_provider_user_id.  Using only the JWT
  //    email would silently skip promotion whenever the email claim is absent,
  //    leaving a pending row that the user can never self-resolve.
  const recordEmail = record ? (record.email || '').toLowerCase() : ''
  const resolvedIsBootstrapAdmin =
    isBootstrapAdmin || isBootstrapAdminByEmail(recordEmail)

  if (record && resolvedIsBootstrapAdmin) {
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

    // Also ensure the Stack Auth native permission `role_admin` is granted.
    // Fire-and-forget: we do NOT await this so it never blocks the auth response.
    // Idempotent — safe to call on every login; skips if already granted.
    ensureAdminPermissionForUser(authProviderUserId, email).catch((err) => {
      console.warn('[auth/user] ensureAdminPermission failed (non-fatal):', err?.message)
    })
  }

  // 4b) Auto-approve any pending row for a Stack Auth-authenticated user.
  //     Stack Auth is the identity gate — if the user has a valid JWT, they are
  //     verified.  A 'pending' row means their first-login INSERT defaulted to
  //     pending (old behaviour before this fix), so we upgrade it in place.
  if (record && record.access_status === 'pending') {
    try {
      await query(
        `UPDATE public.app_user_access
         SET access_status = 'approved',
             can_access_app = true,
             approved_at    = COALESCE(approved_at, now()),
             updated_at     = now()
         WHERE id = $1
           AND access_status = 'pending'`,
        [record.id]
      )
      record = { ...record, access_status: 'approved', can_access_app: true }
      console.info('[auth/user] auto-approved pending row for Stack Auth user — userId:', authProviderUserId)
    } catch (err) {
      console.warn('[auth/user] auto-approve pending row error:', err?.message)
    }
  }

  // 4c) Self-heal inconsistent "approved" rows where can_access_app or is_active
  //     are still false.  This can happen when:
  //     - The row was inserted or updated via direct SQL with only access_status
  //       set to 'approved' without also setting can_access_app / is_active.
  //     - The schema default (can_access_app = false) was not overridden by the
  //       approval flow (e.g. a legacy bootstrap path).
  //     Without this heal the authorized flag in authMe.js evaluates to false
  //     even though the status is 'approved', causing the "Acesso pendente"
  //     screen to be shown to a legitimately approved user.
  if (
    record &&
    record.access_status === 'approved' &&
    (!record.can_access_app || !record.is_active)
  ) {
    try {
      await query(
        `UPDATE public.app_user_access
         SET can_access_app = true,
             is_active      = true,
             updated_at     = now()
         WHERE id = $1
           AND access_status = 'approved'
           AND (can_access_app = false OR is_active = false)`,
        [record.id]
      )
      record = { ...record, can_access_app: true, is_active: true }
      console.info(
        '[auth/user] self-healed approved row (can_access_app/is_active were false) — userId:', authProviderUserId
      )
    } catch (err) {
      console.warn('[auth/user] self-heal approved row error:', err?.message)
    }
  }

  // 5) Provision (create row) only when no existing row was found at all.
  //    Re-evaluate isBootstrapAdmin using any newly resolved email.
  if (!record) {
    const finalIsBootstrapAdmin = isBootstrapAdminByEmail(email)
    console.info('[auth/user] no row found — provisioning new row. isBootstrapAdmin:', finalIsBootstrapAdmin)
    if (finalIsBootstrapAdmin) {
      record = await createBootstrapAdminRow(authProviderUserId, email, fullName)
      // Also ensure Stack Auth native permission is granted (fire-and-forget).
      ensureAdminPermissionForUser(authProviderUserId, email).catch((err) => {
        console.warn('[auth/user] ensureAdminPermission failed (non-fatal):', err?.message)
      })
    } else if (email) {
      record = await createApprovedUserRow(authProviderUserId, email, fullName)
      console.info('[auth/user] new approved row created for Stack Auth user — userId:', authProviderUserId)
    } else {
      // No email available from JWT or Stack Auth API.
      // As a last resort, check whether the system has ANY approved admin yet.
      // If not, this is the very first authenticated user — grant admin access so
      // the app can self-bootstrap without requiring STACK_SECRET_SERVER_KEY or
      // a manual DB seed.  Once an admin exists, subsequent no-email users get a
      // pending row (which an admin can approve via the admin panel).
      try {
        if (!(await hasApprovedAdmin())) {
          // No approved admins — treat this user as the bootstrap admin.
          const placeholderEmail = `${authProviderUserId}${PLACEHOLDER_EMAIL_SUFFIX}`
          record = await createBootstrapAdminRow(authProviderUserId, placeholderEmail, fullName)
          console.info(
            '[auth/user] first-user bootstrap: no admins found — admin row created for userId:', authProviderUserId,
          )
        } else {
          console.warn(
            '[auth/user] cannot provision: email absent from JWT and Stack Auth API — userId:', authProviderUserId,
          )
        }
      } catch (err) {
        console.warn('[auth/user] first-user bootstrap check error:', err?.message)
      }
    }
  }

  // 5b) First-user bootstrap for EXISTING pending rows with a placeholder email.
  //     If a pending row was previously created with a placeholder email (from
  //     the first-user logic above) but there are still no approved admins,
  //     promote the row now rather than keeping the user stuck in pending.
  if (
    record &&
    record.access_status !== 'approved' &&
    !resolvedIsBootstrapAdmin &&
    isPlaceholderEmail(record.email)
  ) {
    try {
      if (!(await hasApprovedAdmin())) {
        await promoteToBootstrapAdmin(record.id, authProviderUserId)
        record = { ...record, role: 'admin', access_status: 'approved', is_active: true, can_access_app: true }
        console.info('[auth/user] first-user bootstrap: promoted existing placeholder-email row to admin for userId:', authProviderUserId)
      }
    } catch (err) {
      console.warn('[auth/user] first-user promotion check error:', err?.message)
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

  // 6) Update last_login_at (best-effort, non-blocking).
  // Also ensure role-based permissions are granted for configured emails (fire-and-forget, idempotent).
  const resolvedEmail = email || record.email
  ensureComercialPermissionForUsers(authProviderUserId, resolvedEmail).catch((err) => {
    console.warn('[auth/user] ensureComercialPermissionForUsers failed (non-fatal):', err?.message)
  })
  ensureOfficePermissionForUsers(authProviderUserId, resolvedEmail).catch((err) => {
    console.warn('[auth/user] ensureOfficePermissionForUsers failed (non-fatal):', err?.message)
  })

  // 7) Sync the user's primary role into app_user_profiles (fire-and-forget).
  // The Stack Auth permissions are fetched asynchronously so this is approximate
  // on first login (the role may arrive slightly after this call). The snapshot
  // endpoint (/api/authz/me) always gets the authoritative value via the API.
  getUserPermissions(authProviderUserId)
    .then((perms) => {
      const role = derivePrimaryRole(Array.isArray(perms) ? perms : [])
      return syncUserProfile(authProviderUserId, role, resolvedEmail, record.full_name ?? null)
    })
    .catch((err) => {
      console.warn('[auth/user] syncUserProfile failed (non-fatal):', err?.message)
    })

  query(
    `UPDATE public.app_user_access SET last_login_at = now(), updated_at = now()
     WHERE auth_provider_user_id = $1`,
    [authProviderUserId]
  ).catch((err) => {
    console.warn('[auth] Failed to update last_login_at:', err?.message)
  })

  return record
}
