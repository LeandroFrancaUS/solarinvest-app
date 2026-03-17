// server/auth/currentAppUser.js
import { getDatabaseClient } from '../database/neonClient.js'
import { getBootstrapAdminEmail, getStackUser, isStackAuthBypassed } from './stackAuth.js'

/**
 * Resolve the current app user from the database (app_user_access table).
 *
 * Behaviour:
 * - If Stack Auth is bypassed (dev mode), return a synthetic admin.
 * - If the user authenticated via Stack Auth but has no record yet, provision them as 'pending'.
 * - Return null if the request carries no valid auth identity.
 */
export async function getCurrentAppUser(req) {
  if (isStackAuthBypassed()) {
    return {
      id: 'bypass-admin',
      auth_provider_user_id: 'bypass-admin',
      email: getBootstrapAdminEmail(),
      full_name: 'Bypass Admin',
      role: 'admin',
      access_status: 'approved',
      is_active: true,
      can_access_app: true,
    }
  }

  const stackUser = await getStackUser(req)
  if (!stackUser?.id) {
    return null
  }

  const db = getDatabaseClient()
  if (!db) {
    return null
  }

  const providerUserId = stackUser.id
  const email = (stackUser.email ?? '').toLowerCase().trim()

  // Try to find existing record
  let rows
  try {
    rows = await db.sql`
      SELECT id, auth_provider_user_id, email, full_name, role,
             access_status, is_active, can_access_app
      FROM app_user_access
      WHERE auth_provider_user_id = ${providerUserId}
      LIMIT 1
    `
  } catch {
    return null
  }

  if (rows && rows.length > 0) {
    const user = rows[0]
    // Update last_login_at in background (non-blocking)
    db.sql`
      UPDATE app_user_access
      SET last_login_at = now(), updated_at = now()
      WHERE auth_provider_user_id = ${providerUserId}
    `.catch(() => {})
    return user
  }

  // Auto-provision new user as 'pending'
  if (!email) {
    return null
  }

  try {
    const inserted = await db.sql`
      INSERT INTO app_user_access
        (auth_provider_user_id, email, full_name, role, access_status, is_active, can_access_app, last_login_at)
      VALUES
        (${providerUserId}, ${email}, ${stackUser.name ?? null}, 'user', 'pending', true, false, now())
      ON CONFLICT (auth_provider_user_id) DO UPDATE
        SET last_login_at = now(), updated_at = now()
      RETURNING id, auth_provider_user_id, email, full_name, role,
                access_status, is_active, can_access_app
    `
    // Write audit entry
    if (inserted && inserted.length > 0) {
      const newUser = inserted[0]
      db.sql`
        INSERT INTO app_user_access_audit
          (target_user_id, action, new_status, new_role, notes)
        VALUES
          (${newUser.id}, 'user_created_pending', 'pending', 'user',
           ${'Auto-provisioned on first login'})
      `.catch(() => {})
      return newUser
    }
  } catch {
    // provisioning failed — return null so the caller treats the user as unauthenticated
    return null
  }

  return null
}

