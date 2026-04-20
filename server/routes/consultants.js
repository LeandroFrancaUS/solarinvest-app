// server/routes/consultants.js
// CRUD endpoints for /api/consultants
// Accessible to admin (write) and privileged users (read).
// The consultants table is a dedicated entity distinct from app user accounts.
// consultant_code is auto-generated server-side (prefix 'C' + 3 random chars).
// GET /api/consultants/picker is accessible to any authenticated user (used by
// the proposal form to populate the consultant dropdown).

import { resolveActor } from '../proposals/permissions.js'

// Regex for auto-generated consultant codes: C/c + 3 alphanumerics
const CODE_REGEX = /^[Cc][A-Za-z0-9]{3}$/
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generates a random consultant code: 'C' + 3 random chars from CODE_CHARS.
 * @returns {string} e.g. "CA3M"
 */
function generateConsultantCode() {
  let code = 'C'
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
    sendJson(403, { error: { code: 'FORBIDDEN', message: 'Apenas administradores podem gerenciar consultores.' } })
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

function validateConsultantBody(body) {
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
  const regions = body.regions
  if (!Array.isArray(regions) || regions.length === 0) {
    errors.push('Ao menos uma região (UF) é obrigatória.')
  }
  return errors
}

/**
 * GET /api/consultants
 * Lists all consultants. Optional ?active=true to return only active.
 * Privileged access (admin, office, financeiro).
 */
export async function handleConsultantsListRequest(req, res, { sendJson, getScopedSql, url }) {
  const actor = await resolveActor(req)
  if (!requireReadAccess(actor, sendJson)) return

  // Fallback for environments where consultants table may not yet exist
  // (migration 0040 not applied). Returns empty array gracefully.
  let sql
  try {
    sql = await getScopedSql(actor)
  } catch {
    sendJson(200, { consultants: [] })
    return
  }

  const urlObj = typeof url === 'string' ? new URL(url, 'http://localhost') : url
  const activeOnly = urlObj ? urlObj.searchParams.get('active') === 'true' : false

  let rows
  try {
    rows = activeOnly
      ? await sql`
          SELECT id, consultant_code, full_name, phone, email, document, regions,
                 linked_user_id, is_active, created_at, updated_at, created_by_user_id
          FROM public.consultants
          WHERE is_active = true
          ORDER BY LOWER(full_name) ASC
        `
      : await sql`
          SELECT id, consultant_code, full_name, phone, email, document, regions,
                 linked_user_id, is_active, created_at, updated_at, created_by_user_id
          FROM public.consultants
          ORDER BY LOWER(full_name) ASC
        `
  } catch (err) {
    // consultants table does not exist yet → return empty list
    if (err?.code === '42P01') {
      sendJson(200, { consultants: [] })
      return
    }
    throw err
  }

  console.info('[consultants][list]', { count: rows.length, activeOnly })
  sendJson(200, { consultants: rows })
}

/**
 * GET /api/consultants/picker
 * Returns a lightweight list of active consultants for use in proposal form dropdowns.
 * Accessible to any authenticated user (no privileged role required).
 * Only exposes: id, full_name, email, linked_user_id — no CPF/document.
 */
export async function handleConsultantsPickerRequest(req, res, { sendJson, getScopedSql }) {
  const actor = await resolveActor(req)
  if (!actor) {
    sendJson(401, { error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } })
    return
  }

  let sql
  try {
    sql = await getScopedSql(actor)
  } catch {
    sendJson(200, { consultants: [] })
    return
  }

  let rows
  try {
    rows = await sql`
      SELECT id, full_name, email, linked_user_id
      FROM public.consultants
      WHERE is_active = true
      ORDER BY LOWER(full_name) ASC
    `
  } catch (err) {
    if (err?.code === '42P01') {
      sendJson(200, { consultants: [] })
      return
    }
    throw err
  }

  sendJson(200, { consultants: rows })
}


/**
 * POST /api/consultants
 * Creates a new consultant. Admin only.
 * The consultant_code is auto-generated server-side (prefix 'C' + 3 random chars).
 */
export async function handleConsultantsCreateRequest(req, res, { sendJson, getScopedSql, readJsonBody }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
    return
  }

  const errors = validateConsultantBody(body)
  if (errors.length > 0) {
    sendJson(422, { error: { code: 'VALIDATION_ERROR', message: errors.join(' ') } })
    return
  }

  const sql = await getScopedSql(actor)

  // Check document uniqueness
  const docStr = String(body.document).trim()
  const docExisting = await sql`
    SELECT id FROM public.consultants WHERE document = ${docStr}
  `.catch(() => [])
  if (docExisting.length > 0) {
    sendJson(409, { error: { code: 'DUPLICATE_DOCUMENT', message: 'Já existe um consultor cadastrado com este CPF/CNPJ.' } })
    return
  }

  // Auto-generate a unique consultant_code (max 10 attempts)
  let consultantCode = null
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateConsultantCode()
    const exists = await sql`SELECT id FROM public.consultants WHERE consultant_code = ${candidate}`.catch(() => [])
    if (exists.length === 0) {
      consultantCode = candidate
      break
    }
  }
  if (!consultantCode) {
    sendJson(500, { error: { code: 'CODE_GENERATION_FAILED', message: 'Não foi possível gerar um código único. Tente novamente.' } })
    return
  }

  // Normalize regions: deduplicate, uppercase, strip empty values.
  // Pass the JS array directly — @neondatabase/serverless serializes it as TEXT[].
  const regions = Array.isArray(body.regions)
    ? [...new Set(body.regions.map((uf) => String(uf).trim().toUpperCase()).filter(Boolean))]
    : []

  console.info('[consultants][create] regions normalized', { count: regions.length, regions })

  const rows = await sql`
    INSERT INTO public.consultants (
      consultant_code, full_name, phone, email, document, regions,
      linked_user_id, is_active, created_by_user_id, updated_by_user_id,
      created_at, updated_at
    ) VALUES (
      ${consultantCode},
      ${String(body.full_name).trim()},
      ${String(body.phone).trim()},
      ${String(body.email).trim().toLowerCase()},
      ${docStr},
      ${regions},
      ${body.linked_user_id ?? null},
      true,
      ${actor.userId ?? null},
      ${actor.userId ?? null},
      now(), now()
    )
    RETURNING *
  `

  console.info('[consultants][create]', { id: rows[0]?.id, code: consultantCode })
  sendJson(201, { consultant: rows[0] })
}

/**
 * PUT /api/consultants/:id
 * Updates an existing consultant. Admin only.
 * consultant_code is immutable — ignored if sent.
 */
export async function handleConsultantsUpdateRequest(req, res, { sendJson, getScopedSql, readJsonBody, consultantId }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
    return
  }

  const errors = validateConsultantBody(body)
  if (errors.length > 0) {
    sendJson(422, { error: { code: 'VALIDATION_ERROR', message: errors.join(' ') } })
    return
  }

  const sql = await getScopedSql(actor)
  // Normalize regions: deduplicate, uppercase, strip empty values.
  // Pass the JS array directly — @neondatabase/serverless serializes it as TEXT[].
  const regions = Array.isArray(body.regions)
    ? [...new Set(body.regions.map((uf) => String(uf).trim().toUpperCase()).filter(Boolean))]
    : []
  const docStr = String(body.document).trim()

  // Check document uniqueness (excluding current record)
  const docExisting = await sql`
    SELECT id FROM public.consultants WHERE document = ${docStr} AND id != ${consultantId}
  `.catch(() => [])
  if (docExisting.length > 0) {
    sendJson(409, { error: { code: 'DUPLICATE_DOCUMENT', message: 'Já existe um consultor cadastrado com este CPF/CNPJ.' } })
    return
  }

  const rows = await sql`
    UPDATE public.consultants SET
      full_name          = ${String(body.full_name).trim()},
      phone              = ${String(body.phone).trim()},
      email              = ${String(body.email).trim().toLowerCase()},
      document           = ${docStr},
      regions            = ${regions},
      linked_user_id     = ${body.linked_user_id ?? null},
      updated_by_user_id = ${actor.userId ?? null},
      updated_at         = now()
    WHERE id = ${consultantId}
    RETURNING *
  `

  if (rows.length === 0) {
    sendJson(404, { error: { code: 'NOT_FOUND', message: 'Consultor não encontrado.' } })
    return
  }

  console.info('[consultants][update]', { id: consultantId })
  sendJson(200, { consultant: rows[0] })
}

/**
 * PATCH /api/consultants/:id/deactivate
 * Soft-deletes (deactivates) a consultant. Admin only.
 */
export async function handleConsultantsDeactivateRequest(req, res, { sendJson, getScopedSql, consultantId }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  const sql = await getScopedSql(actor)

  const rows = await sql`
    UPDATE public.consultants SET
      is_active          = false,
      updated_by_user_id = ${actor.userId ?? null},
      updated_at         = now()
    WHERE id = ${consultantId}
    RETURNING *
  `

  if (rows.length === 0) {
    sendJson(404, { error: { code: 'NOT_FOUND', message: 'Consultor não encontrado.' } })
    return
  }

  console.info('[consultants][deactivate]', { id: consultantId })
  sendJson(200, { consultant: rows[0] })
}

