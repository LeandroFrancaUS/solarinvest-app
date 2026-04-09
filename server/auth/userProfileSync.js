// server/auth/userProfileSync.js
//
// Upserts a row into app_user_profiles whenever a user's role is known.
// Called from authorizationSnapshot.js on every /api/authz/me request and
// from adminUsers.js after every permission grant/revoke so the local table
// stays in sync with Stack Auth.
//
// The upsert is idempotent and safe to call from concurrent requests.

import { getDatabaseClient } from '../database/neonClient.js'

/**
 * Upserts the user's primary role into app_user_profiles.
 *
 * @param {string} stackUserId
 * @param {string} primaryRole - one of role_admin|role_financeiro|role_office|role_comercial|unknown
 * @param {string|null} email
 * @param {string|null} displayName
 */
export async function syncUserProfile(stackUserId, primaryRole, email, displayName) {
  if (!stackUserId) return

  const db = getDatabaseClient()
  if (!db) return

  const { sql } = db

  await sql`
    INSERT INTO public.app_user_profiles (stack_user_id, primary_role, email, display_name, updated_at)
    VALUES (
      ${stackUserId},
      ${primaryRole ?? 'unknown'},
      ${email ?? null},
      ${displayName ?? null},
      now()
    )
    ON CONFLICT (stack_user_id) DO UPDATE
      SET primary_role  = EXCLUDED.primary_role,
          email         = COALESCE(EXCLUDED.email, app_user_profiles.email),
          display_name  = COALESCE(EXCLUDED.display_name, app_user_profiles.display_name),
          updated_at    = now()
  `
}
