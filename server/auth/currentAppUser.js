// server/auth/currentAppUser.js
import { query } from '../db.js'
import { getStackUser, isStackAuthBypassed, getBootstrapAdminEmail } from './stackAuth.js'

const ADMIN_BOOTSTRAP_EMAIL = getBootstrapAdminEmail()

/**
 * Ensure the bootstrap admin (brsolarinvest@gmail.com) has admin access
 * if they authenticate with that email. Idempotent upsert.
 */
async function ensureBootstrapAdmin(authProviderUserId, email, fullName) {
  if (!ADMIN_BOOTSTRAP_EMAIL || email.toLowerCase() !== ADMIN_BOOTSTRAP_EMAIL.toLowerCase()) {
    return
  }

  try {
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
  } catch (err) {
    console.warn('[auth] ensureBootstrapAdmin error:', err?.message)
  }
}

/**
 * Provision a new user as "pending" on first login.
 * Does nothing if the user already exists.
 */
async function provisionNewUser(authProviderUserId, email, fullName) {
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

  if (!email) {
    return null
  }

  // 2) Bootstrap admin check (idempotent)
  await ensureBootstrapAdmin(authProviderUserId, email, fullName)

  // 3) Provision user on first login (no-op if already exists)
  await provisionNewUser(authProviderUserId, email, fullName)

  // 4) Fetch internal authorization record
  const { rows } = await query(
    `SELECT id, auth_provider_user_id, email, full_name, role,
            access_status, is_active, can_access_app, last_login_at
     FROM public.app_user_access
     WHERE auth_provider_user_id = $1
     LIMIT 1`,
    [authProviderUserId]
  )

  const record = rows[0]
  if (!record) {
    return null
  }

  // 5) Update last_login_at (best-effort, non-blocking — failure here does not affect auth)
  query(
    `UPDATE public.app_user_access SET last_login_at = now(), updated_at = now()
     WHERE auth_provider_user_id = $1`,
    [authProviderUserId]
  ).catch((err) => {
    console.warn('[auth] Failed to update last_login_at:', err?.message)
  })

  return record
}
