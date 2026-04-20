// server/routes/engineers.js
// CRUD endpoints for /api/engineers
// Accessible to admin (write) and privileged users (read).

import { resolveActor } from '../proposals/permissions.js'

const CODE_REGEX = /^[A-Za-z0-9]{4}$/

function requireAdmin(actor, sendJson) {
  if (!actor) {
    sendJson(401, { error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } })
    return false
  }
  if (!actor.isAdmin) {
    sendJson(403, { error: { code: 'FORBIDDEN', message: 'Apenas administradores podem gerenciar engenheiros.' } })
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

function validateEngineerBody(body, requireCode = true) {
  const errors = []
  if (requireCode) {
    if (!body.engineer_code || !CODE_REGEX.test(body.engineer_code)) {
      errors.push('engineer_code deve ter exatamente 4 caracteres alfanuméricos.')
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
  if (!body.crea || !String(body.crea).trim()) {
    errors.push('CREA é obrigatório.')
  }
  return errors
}

/**
 * GET /api/engineers
 * Lists all engineers. Optional ?active=true to return only active.
 */
export async function handleEngineersListRequest(req, res, { sendJson, getScopedSql, url }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  let sql
  try {
    sql = await getScopedSql(actor)
  } catch {
    sendJson(200, { engineers: [] })
    return
  }

  const urlObj = typeof url === 'string' ? new URL(url, 'http://localhost') : url
  const activeOnly = urlObj ? urlObj.searchParams.get('active') === 'true' : false

  let rows
  try {
    rows = activeOnly
      ? await sql`
          SELECT id, engineer_code, full_name, phone, email, crea, linked_user_id,
                 is_active, created_at, updated_at, created_by_user_id
          FROM public.engineers
          WHERE is_active = true
          ORDER BY LOWER(full_name) ASC
        `
      : await sql`
          SELECT id, engineer_code, full_name, phone, email, crea, linked_user_id,
                 is_active, created_at, updated_at, created_by_user_id
          FROM public.engineers
          ORDER BY LOWER(full_name) ASC
        `
  } catch (err) {
    if (err?.code === '42P01') {
      sendJson(200, { engineers: [] })
      return
    }
    throw err
  }

  console.info('[engineers][list]', { count: rows.length, activeOnly })
  sendJson(200, { engineers: rows })
}

/**
 * POST /api/engineers
 * Creates a new engineer. Admin only.
 */
export async function handleEngineersCreateRequest(req, res, { sendJson, getScopedSql, readJsonBody }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
    return
  }

  const errors = validateEngineerBody(body)
  if (errors.length > 0) {
    sendJson(422, { error: { code: 'VALIDATION_ERROR', message: errors.join(' ') } })
    return
  }

  const sql = await getScopedSql(actor)

  // Check code uniqueness
  const existing = await sql`
    SELECT id FROM public.engineers WHERE engineer_code = ${body.engineer_code}
  `
  if (existing.length > 0) {
    sendJson(409, { error: { code: 'DUPLICATE_CODE', message: `Código ${body.engineer_code} já está em uso.` } })
    return
  }

  const rows = await sql`
    INSERT INTO public.engineers (
      engineer_code, full_name, phone, email, crea,
      linked_user_id, is_active, created_by_user_id, updated_by_user_id,
      created_at, updated_at
    ) VALUES (
      ${body.engineer_code},
      ${String(body.full_name).trim()},
      ${String(body.phone).trim()},
      ${String(body.email).trim().toLowerCase()},
      ${String(body.crea).trim()},
      ${body.linked_user_id ?? null},
      true,
      ${actor.userId ?? null},
      ${actor.userId ?? null},
      now(), now()
    )
    RETURNING *
  `

  console.info('[engineers][create]', { id: rows[0]?.id, code: body.engineer_code })
  sendJson(201, { engineer: rows[0] })
}

/**
 * PUT /api/engineers/:id
 * Updates an existing engineer. Admin only.
 */
export async function handleEngineersUpdateRequest(req, res, { sendJson, getScopedSql, readJsonBody, engineerId }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
    return
  }

  const errors = validateEngineerBody(body, false)
  if (errors.length > 0) {
    sendJson(422, { error: { code: 'VALIDATION_ERROR', message: errors.join(' ') } })
    return
  }

  const sql = await getScopedSql(actor)

  const rows = await sql`
    UPDATE public.engineers SET
      full_name          = ${String(body.full_name).trim()},
      phone              = ${String(body.phone).trim()},
      email              = ${String(body.email).trim().toLowerCase()},
      crea               = ${String(body.crea).trim()},
      linked_user_id     = ${body.linked_user_id ?? null},
      updated_by_user_id = ${actor.userId ?? null},
      updated_at         = now()
    WHERE id = ${engineerId}
    RETURNING *
  `

  if (rows.length === 0) {
    sendJson(404, { error: { code: 'NOT_FOUND', message: 'Engenheiro não encontrado.' } })
    return
  }

  console.info('[engineers][update]', { id: engineerId })
  sendJson(200, { engineer: rows[0] })
}

/**
 * PATCH /api/engineers/:id/deactivate
 * Soft-deletes (deactivates) an engineer. Admin only.
 */
export async function handleEngineersDeactivateRequest(req, res, { sendJson, getScopedSql, engineerId }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  const sql = await getScopedSql(actor)

  const rows = await sql`
    UPDATE public.engineers SET
      is_active          = false,
      updated_by_user_id = ${actor.userId ?? null},
      updated_at         = now()
    WHERE id = ${engineerId}
    RETURNING *
  `

  if (rows.length === 0) {
    sendJson(404, { error: { code: 'NOT_FOUND', message: 'Engenheiro não encontrado.' } })
    return
  }

  console.info('[engineers][deactivate]', { id: engineerId })
  sendJson(200, { engineer: rows[0] })
}
