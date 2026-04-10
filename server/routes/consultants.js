// server/routes/consultants.js
// GET /api/consultants — returns a list of all registered user profiles.
// Accessible to privileged users (admin, office, financeiro) so they can
// populate the consultant filter in the client management page.

import { resolveActor } from '../proposals/permissions.js'
import { query } from '../db.js'

/**
 * GET /api/consultants
 * Returns all user profiles with display_name, email, and stack_user_id.
 * Requires the caller to be a privileged user (admin, office, or financeiro).
 */
export async function handleConsultantsListRequest(req, res, { sendJson }) {
  const actor = await resolveActor(req)
  if (!actor) {
    sendJson(res, 401, { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } })
    return
  }
  if (!actor.isAdmin && !actor.isOffice && !actor.isFinanceiro) {
    sendJson(res, 403, { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    return
  }

  const result = await query(
    `SELECT stack_user_id AS id,
            COALESCE(display_name, email, stack_user_id) AS name,
            email
     FROM public.app_user_profiles
     ORDER BY LOWER(COALESCE(display_name, email, stack_user_id)) ASC`,
    [],
  )

  sendJson(res, 200, { consultants: result.rows })
}
