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
import { jsonResponse, noContentResponse } from '../response.js'
import {
  searchImportableUsers,
  getUserProfiles,
  searchImportableClients,
} from '../personnel-import/repository.js'

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

  const rows = await searchImportableUsers(sql, q.toLowerCase())
  if (rows === null) {
    sendJson(200, { users: [] })
    return
  }

  // Enrich with phone from app_user_profiles if the table exists
  const ids = rows.map((r) => r.id)
  const profiles = ids.length > 0 ? await getUserProfiles(sql, ids) : []

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

  const rows = await searchImportableClients(sql, q.toLowerCase())
  if (rows === null) {
    sendJson(200, { clients: [] })
    return
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

/**
 * Registers all /api/personnel import routes on the given router.
 *
 * @param {ReturnType<import('../router.js').createRouter>} router
 * @param {{
 *   getScopedSql: (actor: object) => Promise<object>,
 * }} moduleCtx
 */
export function registerPersonnelImportRoutes(router, moduleCtx) {
  const { getScopedSql } = moduleCtx

  // ── GET /api/personnel/importable-users ──────────────────────────────────
  // List app users eligible for import into consultant/engineer/installer — admin only.
  router.register('*', '/api/personnel/importable-users', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    const url = new URL(req.url, 'http://localhost')
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    await handlePersonnelImportableUsers(req, res, { sendJson, getScopedSql, url })
  })

  // ── GET /api/personnel/importable-clients ────────────────────────────────
  // List clients eligible for import into personnel records — admin only.
  router.register('*', '/api/personnel/importable-clients', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    const url = new URL(req.url, 'http://localhost')
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    await handlePersonnelImportableClients(req, res, { sendJson, getScopedSql, url })
  })
}
