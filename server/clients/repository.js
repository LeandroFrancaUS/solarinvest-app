// server/clients/repository.js
// Database queries for clients with CPF and CNPJ deduplication.

/**
 * Normalize CPF: strip non-digits, validate 11 digits.
 */
export function normalizeCpfServer(raw) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length === 11 ? digits : null
}

/**
 * Normalize CNPJ: strip non-digits, validate 14 digits.
 */
export function normalizeCnpjServer(raw) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length === 14 ? digits : null
}

/**
 * Auto-detect and normalize document (CPF or CNPJ).
 * Returns { type: 'cpf'|'cnpj'|'unknown', normalized: string|null }
 */
export function normalizeDocumentServer(raw) {
  if (!raw) return { type: 'unknown', normalized: null }
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) return { type: 'cpf', normalized: digits }
  if (digits.length === 14) return { type: 'cnpj', normalized: digits }
  return { type: 'unknown', normalized: null }
}

/**
 * Find a client by normalized CPF.
 */
export async function findClientByCpf(sql, cpfNormalized) {
  const rows = await sql`
    SELECT * FROM clients
    WHERE cpf_normalized = ${cpfNormalized}
      AND deleted_at IS NULL
      AND merged_into_client_id IS NULL
    LIMIT 1
  `
  return rows[0] ?? null
}

/**
 * Find a client by normalized CNPJ.
 */
export async function findClientByCnpj(sql, cnpjNormalized) {
  const rows = await sql`
    SELECT * FROM clients
    WHERE cnpj_normalized = ${cnpjNormalized}
      AND deleted_at IS NULL
      AND merged_into_client_id IS NULL
    LIMIT 1
  `
  return rows[0] ?? null
}

/**
 * Find a client by normalized document (CPF or CNPJ), auto-detected by length.
 */
export async function findClientByDocument(sql, normalizedDocument) {
  if (!normalizedDocument) return null
  if (normalizedDocument.length === 14) return findClientByCnpj(sql, normalizedDocument)
  if (normalizedDocument.length === 11) return findClientByCpf(sql, normalizedDocument)
  return null
}

/**
 * Find a client by offline_origin_id (idempotency check).
 */
export async function findClientByOfflineOriginId(sql, offlineOriginId) {
  const rows = await sql`
    SELECT * FROM clients
    WHERE offline_origin_id = ${offlineOriginId}
      AND deleted_at IS NULL
    LIMIT 1
  `
  return rows[0] ?? null
}

/**
 * Create a new client.
 */
export async function createClient(sql, data) {
  const {
    name,
    cpf_normalized = null,
    cpf_raw = null,
    cnpj_normalized = null,
    cnpj_raw = null,
    document_type = null,
    phone = null,
    email = null,
    city = null,
    state = null,
    address = null,
    document = null,
    uc = null,
    distribuidora = null,
    created_by_user_id = null,
    owner_user_id = null,
    identity_status = 'pending_cpf',
    origin = 'online',
    offline_origin_id = null,
    metadata = null,
  } = data

  const resolvedOwner = owner_user_id ?? created_by_user_id
  const rows = await sql`
    INSERT INTO clients (
      name, document, cpf_normalized, cpf_raw,
      cnpj_normalized, cnpj_raw, document_type,
      phone, email, city, state, address, uc, distribuidora,
      created_by_user_id, owner_user_id, user_id, owner_stack_user_id,
      identity_status, origin, offline_origin_id,
      metadata, created_at, updated_at
    ) VALUES (
      ${name}, ${document ?? cpf_raw ?? cnpj_raw}, ${cpf_normalized}, ${cpf_raw},
      ${cnpj_normalized}, ${cnpj_raw}, ${document_type},
      ${phone}, ${email}, ${city}, ${state}, ${address}, ${uc}, ${distribuidora},
      ${created_by_user_id}, ${resolvedOwner}, ${resolvedOwner}, ${resolvedOwner},
      ${identity_status}, ${origin}, ${offline_origin_id},
      ${metadata ? JSON.stringify(metadata) : null}::jsonb, now(), now()
    )
    RETURNING *
  `
  return rows[0] ?? null
}

/**
 * Update an existing client (non-destructive — preserves created_by_user_id).
 */
export async function updateClient(sql, clientId, data) {
  const {
    name,
    phone,
    email,
    city,
    state,
    address,
    cpf_normalized,
    cpf_raw,
    cnpj_normalized,
    cnpj_raw,
    document_type,
    identity_status,
    metadata,
  } = data

  const rows = await sql`
    UPDATE clients SET
      name             = COALESCE(${name ?? null}, name),
      phone            = COALESCE(${phone ?? null}, phone),
      email            = COALESCE(${email ?? null}, email),
      city             = COALESCE(${city ?? null}, city),
      state            = COALESCE(${state ?? null}, state),
      address          = COALESCE(${address ?? null}, address),
      cpf_normalized   = COALESCE(${cpf_normalized ?? null}, cpf_normalized),
      cpf_raw          = COALESCE(${cpf_raw ?? null}, cpf_raw),
      cnpj_normalized  = COALESCE(${cnpj_normalized ?? null}, cnpj_normalized),
      cnpj_raw         = COALESCE(${cnpj_raw ?? null}, cnpj_raw),
      document_type    = COALESCE(${document_type ?? null}, document_type),
      identity_status  = COALESCE(${identity_status ?? null}, identity_status),
      metadata         = COALESCE(${metadata ? JSON.stringify(metadata) : null}::jsonb, metadata),
      updated_at       = now()
    WHERE id = ${clientId}
      AND deleted_at IS NULL
    RETURNING *
  `
  return rows[0] ?? null
}

/**
 * List clients with filters.
 * Uses parameterized queries for all user-supplied values.
 * Sort column is validated against an allowlist to prevent SQL injection.
 */
export async function listClients(sql, filter = {}) {
  const {
    ownerUserId = null,
    officeUserId = null,
    createdByUserId = null,
    city = null,
    state: uf = null,
    identityStatus = null,
    search = null,
    page = 1,
    limit = 20,
    sortBy = 'updated_at',
    sortDir = 'DESC',
  } = filter

  const pageNum = Math.max(1, parseInt(String(page), 10))
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)))
  const offset = (pageNum - 1) * limitNum

  const allowedSortBy = ['updated_at', 'created_at', 'name', 'city', 'state']
  const allowedSortDir = ['ASC', 'DESC']
  const safeSort = allowedSortBy.includes(sortBy) ? sortBy : 'updated_at'
  const safeSortDir = allowedSortDir.includes(sortDir.toUpperCase()) ? sortDir.toUpperCase() : 'DESC'

  const conditions = ['c.deleted_at IS NULL', 'c.merged_into_client_id IS NULL']
  const params = []

  if (officeUserId) {
    // Office: own clients OR clients owned by users with role_comercial
    params.push(officeUserId)
    conditions.push(`(c.owner_user_id = $${params.length} OR up.primary_role = 'role_comercial')`)
  } else if (ownerUserId) {
    params.push(ownerUserId)
    conditions.push(`c.owner_user_id = $${params.length}`)
  }
  if (createdByUserId) {
    params.push(createdByUserId)
    conditions.push(`c.created_by_user_id = $${params.length}`)
  }
  if (city) {
    params.push(`%${city}%`)
    conditions.push(`c.city ILIKE $${params.length}`)
  }
  if (uf) {
    params.push(uf)
    conditions.push(`c.state = $${params.length}`)
  }
  if (identityStatus) {
    params.push(identityStatus)
    conditions.push(`c.identity_status = $${params.length}`)
  }
  if (search) {
    params.push(`%${search}%`)
    const idx = params.length
    conditions.push(`(c.name ILIKE $${idx} OR c.cpf_normalized ILIKE $${idx} OR c.cnpj_normalized ILIKE $${idx} OR c.email ILIKE $${idx} OR c.phone ILIKE $${idx})`)
  }

  // Always JOIN app_user_profiles to return owner display name and email.
  // The office filter condition (up.primary_role = 'role_comercial') relies on this JOIN too.
  const joinClause = 'LEFT JOIN app_user_profiles up ON up.stack_user_id = c.owner_user_id'
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  // safeSort and safeSortDir are validated against allowlists above — safe to interpolate
  const countQuery = `SELECT COUNT(*) FROM clients c ${joinClause} ${where}`
  const dataQuery = `
    SELECT c.*,
      up.display_name AS owner_display_name,
      up.email AS owner_email,
      (SELECT COUNT(*) FROM proposals p WHERE p.client_id = c.id AND p.deleted_at IS NULL) AS proposal_count
    FROM clients c
    ${joinClause}
    ${where}
    ORDER BY c.${safeSort} ${safeSortDir}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `

  const [countResult, dataResult] = await Promise.all([
    sql(countQuery, params),
    sql(dataQuery, [...params, limitNum, offset]),
  ])

  const total = parseInt(countResult[0]?.count ?? '0', 10)
  return {
    data: dataResult,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  }
}

/**
 * Get all proposals for a client.
 */
export async function getClientProposals(sql, clientId) {
  const rows = await sql`
    SELECT id, proposal_type, status, version, proposal_code,
           consumption_kwh_month, system_kwp, capex_total,
           client_city, client_state, created_by_user_id,
           owner_user_id, owner_display_name,
           created_at, updated_at, is_pending_sync, is_conflicted
    FROM proposals
    WHERE client_id = ${clientId}
      AND deleted_at IS NULL
    ORDER BY created_at DESC
  `
  return rows
}

/**
 * Append to client audit log.
 */
export async function appendClientAuditLog(sql, clientId, actorUserId, actorEmail, action, oldValue, newValue, reason = null, adminId = null) {
  await sql`
    INSERT INTO client_audit_log (
      client_id, actor_user_id, actor_email, action,
      old_value_json, new_value_json, changed_by_admin_id, reason
    ) VALUES (
      ${clientId}, ${actorUserId}, ${actorEmail}, ${action},
      ${oldValue ? JSON.stringify(oldValue) : null}::jsonb,
      ${newValue ? JSON.stringify(newValue) : null}::jsonb,
      ${adminId}, ${reason}
    )
  `
}
