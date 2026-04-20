// server/routes/installers.js
// CRUD endpoints for /api/installers
// Accessible to admin (write) and privileged users (read).

import { resolveActor } from '../proposals/permissions.js'

const CODE_REGEX = /^[A-Za-z0-9]{4}$/

function requireAdmin(actor, sendJson) {
  if (!actor) {
    sendJson(401, { error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } })
    return false
  }
  if (!actor.isAdmin) {
    sendJson(403, { error: { code: 'FORBIDDEN', message: 'Apenas administradores podem gerenciar instaladores.' } })
    return false
  }
  return true
}

function requireReadAccess(actor, sendJson) {
  if (!actor) {
    sendJson(401, { error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } })
    return false
  }
  if (!actor.isAdmin && !actor.isOffice && !actor.isFinanceiro) {
    sendJson(403, { error: { code: 'FORBIDDEN', message: 'Permissão insuficiente.' } })
    return false
  }
  return true
}

function validateInstallerBody(body, requireCode = true) {
  const errors = []
  if (requireCode) {
    if (!body.installer_code || !CODE_REGEX.test(body.installer_code)) {
      errors.push('installer_code deve ter exatamente 4 caracteres alfanuméricos.')
    }
  }
  if (!body.full_name || !String(body.full_name).trim()) {
    errors.push('Nome completo é obrigatório.')
  }
  if (!body.phone || !String(body.phone).trim()) {
    errors.push('Telefone é obrigatório.')
  }
  if (!body.email || !String(body.email).trim()) {
    errors.push('E-mail é obrigatório.')
  }
  return errors
}

/**
 * GET /api/installers
 * Lists all installers. Optional ?active=true to return only active.
 */
export async function handleInstallersListRequest(req, res, { sendJson, getScopedSql, url }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  let sql
  try {
    sql = await getScopedSql(actor)
  } catch {
    sendJson(200, { installers: [] })
    return
  }

  const urlObj = typeof url === 'string' ? new URL(url, 'http://localhost') : url
  const activeOnly = urlObj ? urlObj.searchParams.get('active') === 'true' : false

  let rows
  try {
    rows = activeOnly
      ? await sql`
          SELECT id, installer_code, full_name, phone, email, linked_user_id,
                 is_active, created_at, updated_at, created_by_user_id
          FROM public.installers
          WHERE is_active = true
          ORDER BY LOWER(full_name) ASC
        `
      : await sql`
          SELECT id, installer_code, full_name, phone, email, linked_user_id,
                 is_active, created_at, updated_at, created_by_user_id
          FROM public.installers
          ORDER BY LOWER(full_name) ASC
        `
  } catch (err) {
    if (err?.code === '42P01') {
      sendJson(200, { installers: [] })
      return
    }
    throw err
  }

  console.info('[installers][list]', { count: rows.length, activeOnly })
  sendJson(200, { installers: rows })
}

/**
 * POST /api/installers
 * Creates a new installer. Admin only.
 */
export async function handleInstallersCreateRequest(req, res, { sendJson, getScopedSql, readJsonBody }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
    return
  }

  const errors = validateInstallerBody(body)
  if (errors.length > 0) {
    sendJson(422, { error: { code: 'VALIDATION_ERROR', message: errors.join(' ') } })
    return
  }

  const sql = await getScopedSql(actor)

  // Check code uniqueness
  const existing = await sql`
    SELECT id FROM public.installers WHERE installer_code = ${body.installer_code}
  `
  if (existing.length > 0) {
    sendJson(409, { error: { code: 'DUPLICATE_CODE', message: `Código ${body.installer_code} já está em uso.` } })
    return
  }

  const rows = await sql`
    INSERT INTO public.installers (
      installer_code, full_name, phone, email,
      linked_user_id, is_active, created_by_user_id, updated_by_user_id,
      created_at, updated_at
    ) VALUES (
      ${body.installer_code},
      ${String(body.full_name).trim()},
      ${String(body.phone).trim()},
      ${String(body.email).trim().toLowerCase()},
      ${body.linked_user_id ?? null},
      true,
      ${actor.userId ?? null},
      ${actor.userId ?? null},
      now(), now()
    )
    RETURNING *
  `

  console.info('[installers][create]', { id: rows[0]?.id, code: body.installer_code })
  sendJson(201, { installer: rows[0] })
}

/**
 * PUT /api/installers/:id
 * Updates an existing installer. Admin only.
 */
export async function handleInstallersUpdateRequest(req, res, { sendJson, getScopedSql, readJsonBody, installerId }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
    return
  }

  const errors = validateInstallerBody(body, false)
  if (errors.length > 0) {
    sendJson(422, { error: { code: 'VALIDATION_ERROR', message: errors.join(' ') } })
    return
  }

  const sql = await getScopedSql(actor)

  const rows = await sql`
    UPDATE public.installers SET
      full_name          = ${String(body.full_name).trim()},
      phone              = ${String(body.phone).trim()},
      email              = ${String(body.email).trim().toLowerCase()},
      linked_user_id     = ${body.linked_user_id ?? null},
      updated_by_user_id = ${actor.userId ?? null},
      updated_at         = now()
    WHERE id = ${installerId}
    RETURNING *
  `

  if (rows.length === 0) {
    sendJson(404, { error: { code: 'NOT_FOUND', message: 'Instalador não encontrado.' } })
    return
  }

  console.info('[installers][update]', { id: installerId })
  sendJson(200, { installer: rows[0] })
}

/**
 * PATCH /api/installers/:id/deactivate
 * Soft-deletes (deactivates) an installer. Admin only.
 */
export async function handleInstallersDeactivateRequest(req, res, { sendJson, getScopedSql, installerId }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  const sql = await getScopedSql(actor)

  const rows = await sql`
    UPDATE public.installers SET
      is_active          = false,
      updated_by_user_id = ${actor.userId ?? null},
      updated_at         = now()
    WHERE id = ${installerId}
    RETURNING *
  `

  if (rows.length === 0) {
    sendJson(404, { error: { code: 'NOT_FOUND', message: 'Instalador não encontrado.' } })
    return
  }

  console.info('[installers][deactivate]', { id: installerId })
  sendJson(200, { installer: rows[0] })
}
