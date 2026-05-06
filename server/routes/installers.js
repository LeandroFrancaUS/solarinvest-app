// server/routes/installers.js
// CRUD endpoints for /api/installers
// Accessible to admin (write) and privileged users (read).
// installer_code is auto-generated server-side (prefix 'I' + 3 random chars).

import { resolveActor } from '../proposals/permissions.js'
import { jsonResponse, noContentResponse } from '../response.js'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generates a random installer code: 'I' + 3 random chars from CODE_CHARS.
 * @returns {string} e.g. "IA3M"
 */
function generateInstallerCode() {
  let code = 'I'
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

function validateInstallerBody(body) {
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
  if (!body.document || !String(body.document).trim()) {
    errors.push('CPF/CNPJ é obrigatório.')
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
          SELECT id, installer_code, full_name, phone, email, document, linked_user_id,
                 is_active, created_at, updated_at, created_by_user_id
          FROM public.installers
          WHERE is_active = true
          ORDER BY LOWER(full_name) ASC
        `
      : await sql`
          SELECT id, installer_code, full_name, phone, email, document, linked_user_id,
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
 * The installer_code is auto-generated server-side (prefix 'I' + 3 random chars).
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

  // Check document uniqueness
  const docStr = String(body.document).trim()
  const docExisting = await sql`
    SELECT id FROM public.installers WHERE document = ${docStr}
  `.catch(() => [])
  if (docExisting.length > 0) {
    sendJson(409, { error: { code: 'DUPLICATE_DOCUMENT', message: 'Já existe um instalador cadastrado com este CPF/CNPJ.' } })
    return
  }

  // Auto-generate a unique installer_code (max 10 attempts)
  let installerCode = null
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateInstallerCode()
    const exists = await sql`SELECT id FROM public.installers WHERE installer_code = ${candidate}`.catch(() => [])
    if (exists.length === 0) {
      installerCode = candidate
      break
    }
  }
  if (!installerCode) {
    sendJson(500, { error: { code: 'CODE_GENERATION_FAILED', message: 'Não foi possível gerar um código único. Tente novamente.' } })
    return
  }

  const rows = await sql`
    INSERT INTO public.installers (
      installer_code, full_name, phone, email, document,
      linked_user_id, is_active, created_by_user_id, updated_by_user_id,
      created_at, updated_at
    ) VALUES (
      ${installerCode},
      ${String(body.full_name).trim()},
      ${String(body.phone).trim()},
      ${String(body.email).trim().toLowerCase()},
      ${docStr},
      ${body.linked_user_id ?? null},
      true,
      ${actor.userId ?? null},
      ${actor.userId ?? null},
      now(), now()
    )
    RETURNING *
  `

  console.info('[installers][create]', { id: rows[0]?.id, code: installerCode })
  sendJson(201, { installer: rows[0] })
}

/**
 * PUT /api/installers/:id
 * Updates an existing installer. Admin only.
 * installer_code is immutable — ignored if sent.
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

  const errors = validateInstallerBody(body)
  if (errors.length > 0) {
    sendJson(422, { error: { code: 'VALIDATION_ERROR', message: errors.join(' ') } })
    return
  }

  const sql = await getScopedSql(actor)
  const docStr = String(body.document).trim()

  // Check document uniqueness (excluding current record)
  const docExisting = await sql`
    SELECT id FROM public.installers WHERE document = ${docStr} AND id != ${installerId}
  `.catch(() => [])
  if (docExisting.length > 0) {
    sendJson(409, { error: { code: 'DUPLICATE_DOCUMENT', message: 'Já existe um instalador cadastrado com este CPF/CNPJ.' } })
    return
  }

  const rows = await sql`
    UPDATE public.installers SET
      full_name          = ${String(body.full_name).trim()},
      phone              = ${String(body.phone).trim()},
      email              = ${String(body.email).trim().toLowerCase()},
      document           = ${docStr},
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


/**
 * Registers all /api/installers routes on the given router.
 *
 * @param {ReturnType<import('../router.js').createRouter>} router
 * @param {{
 *   getScopedSql:  (actor: object) => Promise<object>,
 *   readJsonBody:  (req: object)   => Promise<object>,
 * }} moduleCtx
 */
export function registerInstallersRoutes(router, moduleCtx) {
  const { getScopedSql, readJsonBody } = moduleCtx

  // ── GET,POST /api/installers ─────────────────────────────────────────────
  // GET  — list installers (privileged read)
  // POST — create installer (admin only)
  router.register('*', '/api/installers', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    const url = new URL(req.url, 'http://localhost')
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,OPTIONS' }); return }
    if (method === 'GET') {
      await handleInstallersListRequest(req, res, { sendJson, getScopedSql, url })
    } else if (method === 'POST') {
      await handleInstallersCreateRequest(req, res, { sendJson, getScopedSql, readJsonBody })
    } else {
      jsonResponse(res, 405, { error: 'Método não suportado.' })
    }
  })

  // ── PUT /api/installers/:id ──────────────────────────────────────────────
  // Update installer — admin only.
  router.register('*', '/api/installers/:id', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    const installerId = Number(reqCtx.params?.id)
    if (!Number.isFinite(installerId) || installerId < 1) { jsonResponse(res, 404, { error: 'Not found.' }); return }
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PUT,OPTIONS' }); return }
    if (method !== 'PUT') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    await handleInstallersUpdateRequest(req, res, { sendJson, getScopedSql, readJsonBody, installerId })
  })

  // ── PATCH /api/installers/:id/deactivate ─────────────────────────────────
  // Deactivate installer — admin only.
  router.register('*', '/api/installers/:id/deactivate', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    const installerId = Number(reqCtx.params?.id)
    if (!Number.isFinite(installerId) || installerId < 1) { jsonResponse(res, 404, { error: 'Not found.' }); return }
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,OPTIONS' }); return }
    if (method !== 'PATCH') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    await handleInstallersDeactivateRequest(req, res, { sendJson, getScopedSql, installerId })
  })
}
