// server/routes/consultants.js
// CRUD endpoints for /api/consultants
// Accessible to admin (write) and privileged users (read).
// The consultants table is a dedicated entity distinct from app user accounts.
// consultant_code is auto-generated server-side (prefix 'C' + 3 random chars).
// GET /api/consultants/picker is accessible to any authenticated user (used by
// the proposal form to populate the consultant dropdown).

import { resolveActor } from '../proposals/permissions.js'
import { jsonResponse, noContentResponse } from '../response.js'

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
          SELECT id, consultant_code, full_name, apelido, phone, email, document, regions,
                 linked_user_id, is_active, created_at, updated_at, created_by_user_id
          FROM public.consultants
          WHERE is_active = true
          ORDER BY LOWER(full_name) ASC
        `
      : await sql`
          SELECT id, consultant_code, full_name, apelido, phone, email, document, regions,
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
    // apelido column does not exist yet (migration 0042 pending) → retry without it
    if (err?.code === '42703') {
      rows = activeOnly
        ? await sql`
            SELECT id, consultant_code, full_name, NULL AS apelido, phone, email, document, regions,
                   linked_user_id, is_active, created_at, updated_at, created_by_user_id
            FROM public.consultants
            WHERE is_active = true
            ORDER BY LOWER(full_name) ASC
          `
        : await sql`
            SELECT id, consultant_code, full_name, NULL AS apelido, phone, email, document, regions,
                   linked_user_id, is_active, created_at, updated_at, created_by_user_id
            FROM public.consultants
            ORDER BY LOWER(full_name) ASC
          `
    } else {
      throw err
    }
  }

  console.info('[consultants][list]', { count: rows.length, activeOnly })
  sendJson(200, { consultants: rows })
}

/**
 * GET /api/consultants/picker
 * Returns a lightweight list of active consultants for use in proposal form dropdowns.
 * Accessible to any authenticated user (no privileged role required).
 * Only exposes: id, full_name, apelido, email, linked_user_id — no CPF/document.
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
      SELECT id, full_name, apelido, email, linked_user_id
      FROM public.consultants
      WHERE is_active = true
      ORDER BY LOWER(full_name) ASC
    `
  } catch (err) {
    if (err?.code === '42P01') {
      sendJson(200, { consultants: [] })
      return
    }
    // apelido column does not exist yet (migration 0042 pending) → retry without it
    if (err?.code === '42703') {
      rows = await sql`
        SELECT id, full_name, NULL AS apelido, email, linked_user_id
        FROM public.consultants
        WHERE is_active = true
        ORDER BY LOWER(full_name) ASC
      `
    } else {
      throw err
    }
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

  // Derive apelido: use provided value, or default to the first word of full_name.
  const fullNameTrimmed = String(body.full_name).trim()
  const apelidoRaw = body.apelido != null ? String(body.apelido).trim() : null
  const apelidoValue = apelidoRaw !== null && apelidoRaw !== '' ? apelidoRaw : (fullNameTrimmed.split(' ')[0] ?? fullNameTrimmed)

  let rows
  try {
    rows = await sql`
      INSERT INTO public.consultants (
        consultant_code, full_name, apelido, phone, email, document, regions,
        linked_user_id, is_active, created_by_user_id, updated_by_user_id,
        created_at, updated_at
      ) VALUES (
        ${consultantCode},
        ${fullNameTrimmed},
        ${apelidoValue},
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
  } catch (err) {
    // apelido column does not exist yet (migration 0042 pending) → insert without it
    if (err?.code === '42703') {
      rows = await sql`
        INSERT INTO public.consultants (
          consultant_code, full_name, phone, email, document, regions,
          linked_user_id, is_active, created_by_user_id, updated_by_user_id,
          created_at, updated_at
        ) VALUES (
          ${consultantCode},
          ${fullNameTrimmed},
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
    } else {
      throw err
    }
  }

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

  let rows
  try {
    rows = await sql`
      UPDATE public.consultants SET
        full_name          = ${String(body.full_name).trim()},
        apelido            = ${body.apelido != null ? String(body.apelido).trim() || null : null},
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
  } catch (err) {
    // apelido column does not exist yet (migration 0042 pending) → update without it
    if (err?.code === '42703') {
      rows = await sql`
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
    } else {
      throw err
    }
  }

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

/**
 * POST /api/consultants/:id/link
 * Links a consultant to a user. Admin only.
 * Body: { userId: string }
 * A user can only be linked to ONE consultant, but a consultant can be linked to multiple users.
 */
export async function handleConsultantsLinkRequest(req, res, { sendJson, getScopedSql, readJsonBody, consultantId }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(400, { error: { code: 'INVALID_JSON', message: 'JSON inválido na requisição.' } })
    return
  }

  if (!body.userId || typeof body.userId !== 'string') {
    sendJson(422, { error: { code: 'VALIDATION_ERROR', message: 'userId é obrigatório.' } })
    return
  }

  const sql = await getScopedSql(actor)

  // Check if consultant exists
  const consultant = await sql`
    SELECT id FROM public.consultants WHERE id = ${consultantId}
  `
  if (consultant.length === 0) {
    sendJson(404, { error: { code: 'NOT_FOUND', message: 'Consultor não encontrado.' } })
    return
  }

  // Check if the user is already linked to a different consultant
  const existingLink = await sql`
    SELECT id, full_name FROM public.consultants
    WHERE linked_user_id = ${body.userId} AND id != ${consultantId}
  `
  if (existingLink.length > 0) {
    sendJson(409, {
      error: {
        code: 'USER_ALREADY_LINKED',
        message: `Este usuário já está vinculado ao consultor "${existingLink[0].full_name}". Desvincule primeiro.`
      }
    })
    return
  }

  // Link the consultant to the user
  const rows = await sql`
    UPDATE public.consultants SET
      linked_user_id     = ${body.userId},
      updated_by_user_id = ${actor.userId ?? null},
      updated_at         = now()
    WHERE id = ${consultantId}
    RETURNING *
  `

  console.info('[consultants][link]', { id: consultantId, userId: body.userId })
  sendJson(200, { consultant: rows[0] })
}

/**
 * DELETE /api/consultants/:id/link
 * Unlinks a consultant from a user. Admin only.
 */
export async function handleConsultantsUnlinkRequest(req, res, { sendJson, getScopedSql, consultantId }) {
  const actor = await resolveActor(req)
  if (!requireAdmin(actor, sendJson)) return

  const sql = await getScopedSql(actor)

  const rows = await sql`
    UPDATE public.consultants SET
      linked_user_id     = NULL,
      updated_by_user_id = ${actor.userId ?? null},
      updated_at         = now()
    WHERE id = ${consultantId}
    RETURNING *
  `

  if (rows.length === 0) {
    sendJson(404, { error: { code: 'NOT_FOUND', message: 'Consultor não encontrado.' } })
    return
  }

  console.info('[consultants][unlink]', { id: consultantId })
  sendJson(200, { consultant: rows[0] })
}

/**
 * GET /api/consultants/auto-detect
 * Attempts to auto-detect a consultant linked to the current user.
 * Returns the consultant if found by:
 *   1) linked_user_id matching the current user's ID
 *   2) email matching (case-insensitive)
 *   3) first and last name matching (case-insensitive, normalized)
 * Accessible to any authenticated user.
 */
export async function handleConsultantsAutoDetectRequest(req, res, { sendJson, getScopedSql }) {
  const actor = await resolveActor(req)
  if (!actor) {
    sendJson(401, { error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } })
    return
  }

  let sql
  try {
    sql = await getScopedSql(actor)
  } catch {
    sendJson(200, { consultant: null })
    return
  }

  // First, try to find by linked_user_id (highest priority)
  let rows
  try {
    rows = await sql`
      SELECT id, consultant_code, full_name, apelido, phone, email, document, regions,
             linked_user_id, is_active, created_at, updated_at, created_by_user_id
      FROM public.consultants
      WHERE linked_user_id = ${actor.userId} AND is_active = true
      LIMIT 1
    `
  } catch (err) {
    if (err?.code === '42P01') {
      sendJson(200, { consultant: null })
      return
    }
    // apelido column does not exist yet (migration 0042 pending) → retry without it
    if (err?.code === '42703') {
      rows = await sql`
        SELECT id, consultant_code, full_name, NULL AS apelido, phone, email, document, regions,
               linked_user_id, is_active, created_at, updated_at, created_by_user_id
        FROM public.consultants
        WHERE linked_user_id = ${actor.userId} AND is_active = true
        LIMIT 1
      `
    } else {
      throw err
    }
  }

  if (rows.length > 0) {
    console.info('[consultants][auto-detect] found by linked_user_id', { consultantId: rows[0].id, userId: actor.userId })
    sendJson(200, { consultant: rows[0], matchType: 'linked_user_id' })
    return
  }

  // Second, try to find by email match (case-insensitive)
  if (actor.email) {
    const userEmail = actor.email.toLowerCase().trim()
    try {
      rows = await sql`
        SELECT id, consultant_code, full_name, apelido, phone, email, document, regions,
               linked_user_id, is_active, created_at, updated_at, created_by_user_id
        FROM public.consultants
        WHERE LOWER(email) = ${userEmail} AND is_active = true
        LIMIT 1
      `
    } catch (err) {
      if (err?.code === '42703') {
        rows = await sql`
          SELECT id, consultant_code, full_name, NULL AS apelido, phone, email, document, regions,
                 linked_user_id, is_active, created_at, updated_at, created_by_user_id
          FROM public.consultants
          WHERE LOWER(email) = ${userEmail} AND is_active = true
          LIMIT 1
        `
      } else {
        throw err
      }
    }

    if (rows.length > 0) {
      console.info('[consultants][auto-detect] found by email', { consultantId: rows[0].id, email: userEmail })
      sendJson(200, { consultant: rows[0], matchType: 'email' })
      return
    }
  }

  // Third, try to find by name match (first + last name, case-insensitive)
  if (actor.fullName) {
    const nameParts = actor.fullName.trim().split(/\s+/).filter(Boolean)
    if (nameParts.length >= 2) {
      const firstName = nameParts[0].toLowerCase()
      const lastName = nameParts[nameParts.length - 1].toLowerCase()

      try {
        rows = await sql`
          SELECT id, consultant_code, full_name, apelido, phone, email, document, regions,
                 linked_user_id, is_active, created_at, updated_at, created_by_user_id
          FROM public.consultants
          WHERE is_active = true
            AND LOWER(SPLIT_PART(full_name, ' ', 1)) = ${firstName}
            AND LOWER(SPLIT_PART(full_name, ' ', ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1))) = ${lastName}
          LIMIT 1
        `
      } catch (err) {
        if (err?.code === '42703') {
          rows = await sql`
            SELECT id, consultant_code, full_name, NULL AS apelido, phone, email, document, regions,
                   linked_user_id, is_active, created_at, updated_at, created_by_user_id
            FROM public.consultants
            WHERE is_active = true
              AND LOWER(SPLIT_PART(full_name, ' ', 1)) = ${firstName}
              AND LOWER(SPLIT_PART(full_name, ' ', ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1))) = ${lastName}
            LIMIT 1
          `
        } else {
          throw err
        }
      }

      if (rows.length > 0) {
        console.info('[consultants][auto-detect] found by name', { consultantId: rows[0].id, firstName, lastName })
        sendJson(200, { consultant: rows[0], matchType: 'name' })
        return
      }
    }
  }

  // No match found
  console.info('[consultants][auto-detect] no match found', { userId: actor.userId })
  sendJson(200, { consultant: null })
}


/**
 * Registers all /api/consultants routes on the given router.
 *
 * Exact-path routes (/picker, /auto-detect, /consultants) are registered first;
 * parameterised routes (/:id, /:id/deactivate, /:id/link) follow.  The router's
 * two-pass matching guarantees exact routes always win over patterns.
 *
 * @param {ReturnType<import('../router.js').createRouter>} router
 * @param {{
 *   getScopedSql:  (actor: object) => Promise<object>,
 *   readJsonBody:  (req: object)   => Promise<object>,
 * }} moduleCtx
 */
export function registerConsultantsRoutes(router, moduleCtx) {
  const { getScopedSql, readJsonBody } = moduleCtx

  // ── GET /api/consultants/picker ──────────────────────────────────────────
  // Lightweight list for form dropdowns — any authenticated user.
  router.register('*', '/api/consultants/picker', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    await handleConsultantsPickerRequest(req, res, { sendJson, getScopedSql })
  })

  // ── GET /api/consultants/auto-detect ─────────────────────────────────────
  // Auto-detect linked consultant for the current user — any authenticated user.
  router.register('*', '/api/consultants/auto-detect', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    await handleConsultantsAutoDetectRequest(req, res, { sendJson, getScopedSql })
  })

  // ── GET,POST /api/consultants ────────────────────────────────────────────
  // GET  — list consultants (privileged read)
  // POST — create consultant (admin only)
  router.register('*', '/api/consultants', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    const url = new URL(req.url, 'http://localhost')
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,OPTIONS' }); return }
    if (method === 'GET') {
      await handleConsultantsListRequest(req, res, { sendJson, getScopedSql, url })
    } else if (method === 'POST') {
      await handleConsultantsCreateRequest(req, res, { sendJson, getScopedSql, readJsonBody })
    } else {
      jsonResponse(res, 405, { error: 'Método não suportado.' })
    }
  })

  // ── PUT /api/consultants/:id ─────────────────────────────────────────────
  // Update consultant — admin only.
  router.register('*', '/api/consultants/:id', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    const consultantId = Number(reqCtx.params?.id)
    if (!Number.isFinite(consultantId) || consultantId < 1) { jsonResponse(res, 404, { error: 'Not found.' }); return }
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PUT,OPTIONS' }); return }
    if (method !== 'PUT') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    await handleConsultantsUpdateRequest(req, res, { sendJson, getScopedSql, readJsonBody, consultantId })
  })

  // ── PATCH /api/consultants/:id/deactivate ────────────────────────────────
  // Deactivate consultant — admin only.
  router.register('*', '/api/consultants/:id/deactivate', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    const consultantId = Number(reqCtx.params?.id)
    if (!Number.isFinite(consultantId) || consultantId < 1) { jsonResponse(res, 404, { error: 'Not found.' }); return }
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'PATCH,OPTIONS' }); return }
    if (method !== 'PATCH') { jsonResponse(res, 405, { error: 'Método não suportado.' }); return }
    await handleConsultantsDeactivateRequest(req, res, { sendJson, getScopedSql, consultantId })
  })

  // ── POST,DELETE /api/consultants/:id/link ────────────────────────────────
  // POST   — link consultant to a user account (admin only)
  // DELETE — unlink consultant from a user account (admin only)
  router.register('*', '/api/consultants/:id/link', async (req, res, reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    const sendJson = (s, b) => jsonResponse(res, s, b)
    const consultantId = Number(reqCtx.params?.id)
    if (!Number.isFinite(consultantId) || consultantId < 1) { jsonResponse(res, 404, { error: 'Not found.' }); return }
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'POST,DELETE,OPTIONS' }); return }
    if (method === 'POST') {
      await handleConsultantsLinkRequest(req, res, { sendJson, getScopedSql, readJsonBody, consultantId })
    } else if (method === 'DELETE') {
      await handleConsultantsUnlinkRequest(req, res, { sendJson, getScopedSql, consultantId })
    } else {
      jsonResponse(res, 405, { error: 'Método não suportado.' })
    }
  })
}
