// server/routes/personnelImport.js
// Read-only search endpoints used to pre-fill personnel forms from existing
// app-users or clients.
//
// These endpoints ONLY read data — they never write, link, or merge entities.
// Access is restricted to admin (same read-access level as the other personnel
// list endpoints).
//
// Endpoints:
//   GET /api/personnel/importable-users?q=<search>
//   GET /api/personnel/importable-clients?q=<search>

import { resolveActor } from '../proposals/permissions.js'

function requireAdmin(actor, sendJson) {
  if (!actor) {
    sendJson(401, { error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } })
    return false
  }
  if (!actor.isAdmin) {
    sendJson(403, { error: { code: 'FORBIDDEN', message: 'Apenas administradores podem usar importação de dados.' } })
    return false
  }
  return true
}

/**
 * GET /api/personnel/importable-users?q=<search>
 *
 * Returns a lightweight list of app users for personnel form pre-fill.
 * Returns only fields needed for the import modal — no passwords, no tokens.
 *
 * @param {string} [q] — optional search term (searches name + email)
 */
export async function handlePersonnelImportableUsers(req, res, { sendJson, getScopedSql, url }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  const urlObj = typeof url === 'string' ? new URL(url, 'http://localhost') : url
  const q = urlObj?.searchParams.get('q')?.trim() ?? ''

  let sql
  try {
    sql = await getScopedSql(actor)
  } catch {
    sendJson(200, { users: [] })
    return
  }

  let rows
  try {
    if (q) {
      const pattern = `%${q.toLowerCase()}%`
      rows = await sql`
        SELECT id, full_name, email
        FROM public.app_user_access
        WHERE is_active = true
          AND can_access_app = true
          AND (lower(full_name) LIKE ${pattern} OR lower(email) LIKE ${pattern})
        ORDER BY lower(full_name) ASC
        LIMIT 30
      `
    } else {
      rows = await sql`
        SELECT id, full_name, email
        FROM public.app_user_access
        WHERE is_active = true
          AND can_access_app = true
        ORDER BY lower(full_name) ASC
        LIMIT 30
      `
    }
  } catch (err) {
    if (err?.code === '42P01') {
      sendJson(200, { users: [] })
      return
    }
    throw err
  }

  // Enrich with phone from app_user_profiles if the table exists
  let profiles = []
  try {
    const ids = rows.map((r) => r.id)
    if (ids.length > 0) {
      profiles = await sql`
        SELECT user_access_id, phone
        FROM public.app_user_profiles
        WHERE user_access_id = ANY(${sql.array(ids)})
      `
    }
  } catch {
    // app_user_profiles may not exist in all environments — silently ignore
  }

  const phoneMap = new Map(profiles.map((p) => [p.user_access_id, p.phone ?? '']))

  const users = rows.map((u) => ({
    id: u.id,
    full_name: u.full_name ?? '',
    email: u.email ?? '',
    phone: phoneMap.get(u.id) ?? '',
  }))

  console.info('[personnel-import][users]', { count: users.length, q: q || '(all)' })
  sendJson(200, { users })
}

/**
 * GET /api/personnel/importable-clients?q=<search>
 *
 * Returns a lightweight list of clients for personnel form pre-fill.
 * Returns only fields needed for the import modal.
 *
 * @param {string} [q] — optional search term (searches name + email + document)
 */
export async function handlePersonnelImportableClients(req, res, { sendJson, getScopedSql, url }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  const urlObj = typeof url === 'string' ? new URL(url, 'http://localhost') : url
  const q = urlObj?.searchParams.get('q')?.trim() ?? ''

  let sql
  try {
    sql = await getScopedSql(actor)
  } catch {
    sendJson(200, { clients: [] })
    return
  }

  let rows
  try {
    if (q) {
      const pattern = `%${q.toLowerCase()}%`
      rows = await sql`
        SELECT id, name, email, phone, document, state, city
        FROM public.clients
        WHERE deleted_at IS NULL
          AND (
            lower(name)     LIKE ${pattern} OR
            lower(email)    LIKE ${pattern} OR
            lower(document) LIKE ${pattern} OR
            lower(phone)    LIKE ${pattern}
          )
        ORDER BY lower(name) ASC
        LIMIT 30
      `
    } else {
      rows = await sql`
        SELECT id, name, email, phone, document, state, city
        FROM public.clients
        WHERE deleted_at IS NULL
        ORDER BY lower(name) ASC
        LIMIT 30
      `
    }
  } catch (err) {
    if (err?.code === '42P01') {
      sendJson(200, { clients: [] })
      return
    }
    throw err
  }

  const clients = rows.map((c) => ({
    id: c.id,
    name: c.name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    document: c.document ?? '',
    state: c.state ?? '',
    city: c.city ?? '',
  }))

  console.info('[personnel-import][clients]', { count: clients.length, q: q || '(all)' })
  sendJson(200, { clients })
}
