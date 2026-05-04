// server/routes/engineers.js
// CRUD endpoints for /api/engineers
// Accessible to admin (write) and privileged users (read).
// engineer_code is auto-generated server-side (prefix 'E' + 3 random chars).

import { resolveActor } from '../proposals/permissions.js'
import { jsonResponse, noContentResponse } from '../response.js'

// Regex for auto-generated engineer codes: E/e + 3 alphanumerics
const CODE_REGEX = /^[Ee][A-Za-z0-9]{3}$/
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generates a random engineer code: 'E' + 3 random chars from CODE_CHARS.
 * @returns {string} e.g. "EA3M"
 */
function generateEngineerCode() {
  let code = 'E'
  for (let i = 0; i < 3; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

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

function validateEngineerBody(body) {
  const errors = []
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
  if (!body.document || !String(body.document).trim()) {
    errors.push('CPF/CNPJ é obrigatório.')
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
          SELECT id, engineer_code, full_name, phone, email, crea, document, linked_user_id,
                 is_active, created_at, updated_at, created_by_user_id
          FROM public.engineers
          WHERE is_active = true
          ORDER BY LOWER(full_name) ASC
        `
      : await sql`
          SELECT id, engineer_code, full_name, phone, email, crea, document, linked_user_id,
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
 * The engineer_code is auto-generated server-side (prefix 'E' + 3 random chars).
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

  // Check document uniqueness
  const docStr = String(body.document).trim()
  const docExisting = await sql`
    SELECT id FROM public.engineers WHERE document = ${docStr}
  `.catch(() => [])
  if (docExisting.length > 0) {
    sendJson(409, { error: { code: 'DUPLICATE_DOCUMENT', message: 'Já existe um engenheiro cadastrado com este CPF/CNPJ.' } })
    return
  }

  // Auto-generate a unique engineer_code (max 10 attempts)
  let engineerCode = null
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateEngineerCode()
    const exists = await sql`SELECT id FROM public.engineers WHERE engineer_code = ${candidate}`.catch(() => [])
    if (exists.length === 0) {
      engineerCode = candidate
      break
    }
  }
  if (!engineerCode) {
    sendJson(500, { error: { code: 'CODE_GENERATION_FAILED', message: 'Não foi possível gerar um código único. Tente novamente.' } })
    return
  }

  const rows = await sql`
    INSERT INTO public.engineers (
      engineer_code, full_name, phone, email, crea, document,
      linked_user_id, is_active, created_by_user_id, updated_by_user_id,
      created_at, updated_at
    ) VALUES (
      ${engineerCode},
      ${String(body.full_name).trim()},
      ${String(body.phone).trim()},
      ${String(body.email).trim().toLowerCase()},
      ${String(body.crea).trim()},
      ${docStr},
      ${body.linked_user_id ?? null},
      true,
      ${actor.userId ?? null},
      ${actor.userId ?? null},
      now(), now()
    )
    RETURNING *
  `

  console.info('[engineers][create]', { id: rows[0]?.id, code: engineerCode })
  sendJson(201, { engineer: rows[0] })
}

/**
 * PUT /api/engineers/:id
 * Updates an existing engineer. Admin only.
 * engineer_code is immutable — ignored if sent.
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

  const errors = validateEngineerBody(body)
  if (errors.length > 0) {
    sendJson(422, { error: { code: 'VALIDATION_ERROR', message: errors.join(' ') } })
    return
  }

  const sql = await getScopedSql(actor)
  const docStr = String(body.document).trim()

  // Check document uniqueness (excluding current record)
  const docExisting = await sql`
    SELECT id FROM public.engineers WHERE document = ${docStr} AND id != ${engineerId}
  `.catch(() => [])
  if (docExisting.length > 0) {
    sendJson(409, { error: { code: 'DUPLICATE_DOCUMENT', message: 'Já existe um engenheiro cadastrado com este CPF/CNPJ.' } })
    return
  }

  const rows = await sql`
    UPDATE public.engineers SET
      full_name          = ${String(body.full_name).trim()},
      phone              = ${String(body.phone).trim()},
      email              = ${String(body.email).trim().toLowerCase()},
      crea               = ${String(body.crea).trim()},
      document           = ${docStr},
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


/**
 * Registers all /api/engineers routes on the given router.
 *
 * @param {ReturnType<import('../router.js').createRouter>} router
 * @param {{
 *   getScopedSql:  (actor: object) => Promise<object>,
 *   readJsonBody:  (req: object)   => Promise<object>,
 * }} moduleCtx
 */
export function registerEngineersRoutes(router, moduleCtx) {
  const { getScopedSql, readJsonBody } = moduleCtx

  // ── GET,POST /api/engineers ──────────────────────────────────────────────
  // GET  — list engineers (privileged read)
  // POST — create engineer (admin only)
  router.register('*', '/api/engineers', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    const url = new URL(req.url, 'http://localhost')
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,OPTIONS' }); return }
    if (method === 'GET') {
      await handleEngineersListRequest(req, res, { sendJson, getScopedSql, url })
    } else if (method === 'POST') {
      await handleEngineersCreateRequest(req, res, { sendJson, getScopedSql, readJsonBody })
    } else {
      jsonResponse(res, 405, { error: 'Método não suportado.' })
    }
  })

  // ── PUT /api/engineers/:id ───────────────────────────────────────────────
  // Update engineer — admin only.
  router.register('*', '/api/engineers/:id', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    const engineerId = Number(reqCtx.params?.id)
    if (!Number.isFinite(engineerId) || engineerId < 1) { jsonResponse(res, 404, { error: 'Not found.' }); return }
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PUT,OPTIONS' }); return }
    if (method !== 'PUT') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    await handleEngineersUpdateRequest(req, res, { sendJson, getScopedSql, readJsonBody, engineerId })
  })

  // ── PATCH /api/engineers/:id/deactivate ──────────────────────────────────
  // Deactivate engineer — admin only.
  router.register('*', '/api/engineers/:id/deactivate', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    const engineerId = Number(reqCtx.params?.id)
    if (!Number.isFinite(engineerId) || engineerId < 1) { jsonResponse(res, 404, { error: 'Not found.' }); return }
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,OPTIONS' }); return }
    if (method !== 'PATCH') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    await handleEngineersDeactivateRequest(req, res, { sendJson, getScopedSql, engineerId })
  })
}
