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
 *
 * Defense-in-depth: when actorRole is 'role_comercial' and actorUserId is
 * provided, an additional WHERE owner_user_id = actorUserId clause is injected
 * at the application layer.  This mirrors the behavior of listClients() and
 * getClientById() and ensures comercial users cannot mutate records they do
 * not own even on connections where BYPASSRLS is set on the DB role.
 *
 * @param {Function} sql                         - user-scoped sql handle
 * @param {string}   clientId                    - UUID of the client
 * @param {object}   data                        - fields to update
 * @param {object}   [options]
 * @param {string}   [options.actorUserId]        - requester's Stack Auth user ID
 * @param {string}   [options.actorRole]          - canonical role ('role_comercial', etc.)
 */
export async function updateClient(sql, clientId, data, options = {}) {
  const { actorUserId = null, actorRole: role = null } = options
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

  // Defense-in-depth: scope UPDATE to owner for role_comercial callers.
  // ownerClause is a hardcoded SQL fragment (never user-derived) that appends
  // an extra parameterized predicate when scoping is required.
  const scopeByOwner = role === 'role_comercial' && Boolean(actorUserId)
  // $14 = clientId; $15 = actorUserId (only appended when scopeByOwner)
  const ownerClause = scopeByOwner ? 'AND owner_user_id = $15' : ''
  const params = [
    name ?? null,
    phone ?? null,
    email ?? null,
    city ?? null,
    state ?? null,
    address ?? null,
    cpf_normalized ?? null,
    cpf_raw ?? null,
    cnpj_normalized ?? null,
    cnpj_raw ?? null,
    document_type ?? null,
    identity_status ?? null,
    metadata ? JSON.stringify(metadata) : null,
    clientId,
    ...(scopeByOwner ? [actorUserId] : []),
  ]
  const rows = await sql(
    `UPDATE clients SET
       name             = COALESCE($1,  name),
       phone            = COALESCE($2,  phone),
       email            = COALESCE($3,  email),
       city             = COALESCE($4,  city),
       state            = COALESCE($5,  state),
       address          = COALESCE($6,  address),
       cpf_normalized   = COALESCE($7,  cpf_normalized),
       cpf_raw          = COALESCE($8,  cpf_raw),
       cnpj_normalized  = COALESCE($9,  cnpj_normalized),
       cnpj_raw         = COALESCE($10, cnpj_raw),
       document_type    = COALESCE($11, document_type),
       identity_status  = COALESCE($12, identity_status),
       metadata         = COALESCE($13::jsonb, metadata),
       updated_at       = now()
     WHERE id = $14
       AND deleted_at IS NULL
       ${ownerClause}
     RETURNING *`,
    params,
  )
  return rows[0] ?? null
}


/**
 * Soft-delete a client by setting deleted_at.
 *
 * Defense-in-depth: when actorRole is 'role_comercial', an additional
 * WHERE owner_user_id = actorUserId clause is injected at the application
 * layer so comercial users cannot delete records they do not own even on
 * connections where BYPASSRLS is set on the DB role.
 *
 * @param {Function} sql         - user-scoped sql handle
 * @param {string}   clientId    - UUID of the client
 * @param {string}   actorUserId - requester's Stack Auth user ID
 * @param {string}   [actorRole] - canonical role ('role_comercial', etc.)
 */
export async function softDeleteClient(sql, clientId, actorUserId, actorRole = null) {
  const scopeByOwner = actorRole === 'role_comercial' && Boolean(actorUserId)

  // Run the soft-delete.  When includeUpdatedBy is false (schema-compat retry),
  // the param list shifts so every placeholder maps to the correct position.
  const runDelete = async (includeUpdatedBy) => {
    if (includeUpdatedBy) {
      // $1=id, $2=updated_by_user_id, $3=owner (when scopeByOwner)
      const ownerClause = scopeByOwner ? 'AND owner_user_id = $3' : ''
      const params = [clientId, actorUserId, ...(scopeByOwner ? [actorUserId] : [])]
      return sql(
        `UPDATE clients
         SET deleted_at = now(), updated_at = now(), updated_by_user_id = $2
         WHERE id = $1 AND deleted_at IS NULL ${ownerClause}
         RETURNING id`,
        params,
      )
    } else {
      // Retry without updated_by_user_id (column absent on older schemas).
      // $1=id, $2=owner (when scopeByOwner)
      const ownerClause = scopeByOwner ? 'AND owner_user_id = $2' : ''
      const params = [clientId, ...(scopeByOwner ? [actorUserId] : [])]
      return sql(
        `UPDATE clients
         SET deleted_at = now(), updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL ${ownerClause}
         RETURNING id`,
        params,
      )
    }
  }

  try {
    const rows = await runDelete(true)
    return rows[0] ?? null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('updated_by_user_id')) throw error
    // Retry without updated_by_user_id for older schemas that lack the column.
    const rows = await runDelete(false)
    return rows[0] ?? null
  }
}

/**
 * List clients with filters.
 * Uses parameterized queries for all user-supplied values.
 * Sort column is validated against an allowlist to prevent SQL injection.
 *
 * Access control is enforced by PostgreSQL RLS (migration 0021) via the
 * app.can_access_owner() function.  The sql parameter should be a
 * user-scoped sql handle (createUserScopedSql) so that app.current_user_id
 * and app.current_user_role are set for each query.
 *
 * Defense-in-depth: when actorUserId and actorRole are provided and the role
 * is role_comercial, an additional WHERE c.owner_user_id = actorUserId clause
 * is injected at the application layer.  This ensures comercial users can only
 * see their own clients even if RLS is not enforced on the connection (e.g.
 * when the database role has the BYPASSRLS attribute).
 */
export async function listClients(sql, filter = {}) {
  const {
    createdByUserId = null,
    city = null,
    state: uf = null,
    identityStatus = null,
    search = null,
    page = 1,
    limit = 20,
    sortBy = 'updated_at',
    sortDir = 'DESC',
    actorUserId = null,
    actorRole: filterActorRole = null,
  } = filter

  const pageNum = Math.max(1, parseInt(String(page), 10))
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)))
  const offset = (pageNum - 1) * limitNum

  const allowedSortBy = ['updated_at', 'created_at', 'name', 'city', 'state']
  const allowedSortDir = ['ASC', 'DESC']
  const safeSort = allowedSortBy.includes(sortBy) ? sortBy : 'updated_at'
  const safeSortDir = allowedSortDir.includes(sortDir.toUpperCase()) ? sortDir.toUpperCase() : 'DESC'

  const baseConditions = ['c.deleted_at IS NULL']
  const conditions = [...baseConditions, 'c.merged_into_client_id IS NULL']
  const params = []

  if (createdByUserId) {
    params.push(createdByUserId)
    conditions.push(`c.created_by_user_id = $${params.length}`)
  }

  // Defense-in-depth: for role_comercial, always enforce owner_user_id at the
  // application layer regardless of RLS context.  This protects against
  // connections where BYPASSRLS is set on the DB role (e.g. neondb_owner) or
  // where set_config() did not propagate correctly via the pooler endpoint.
  if (filterActorRole === 'role_comercial' && actorUserId) {
    params.push(actorUserId)
    conditions.push(`c.owner_user_id = $${params.length}`)
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
    conditions.push(`(c.name ILIKE $${idx} OR c.cpf_normalized ILIKE $${idx} OR c.cnpj_normalized ILIKE $${idx} OR c.email ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.uc ILIKE $${idx} OR c.city ILIKE $${idx} OR c.state ILIKE $${idx} OR c.address ILIKE $${idx} OR c.cep ILIKE $${idx} OR c.distribuidora ILIKE $${idx})`)
  }

  const buildQueries = ({
    withMergedFilter = true,
    withOptionalJoin = true,
    withProposalCount = true,
  } = {}) => {
    const queryConditions = withMergedFilter ? conditions : baseConditions
    const where = queryConditions.length ? `WHERE ${queryConditions.join(' AND ')}` : ''
    const joinClause = withOptionalJoin
      ? 'LEFT JOIN app_user_profiles up ON up.stack_user_id = c.owner_user_id'
      : ''
    const proposalCountExpr = withProposalCount
      ? '(SELECT COUNT(*) FROM proposals p WHERE p.client_id = c.id AND p.deleted_at IS NULL) AS proposal_count'
      : '0::int AS proposal_count'
    const ownerNameExpr = withOptionalJoin ? 'up.display_name AS owner_display_name' : 'NULL::text AS owner_display_name'
    const ownerEmailExpr = withOptionalJoin ? 'up.email AS owner_email' : 'NULL::text AS owner_email'
    const countQuery = `SELECT COUNT(*) AS count FROM clients c ${joinClause} ${where}`
    const dataQuery = `
      SELECT c.*,
        ${ownerNameExpr},
        ${ownerEmailExpr},
        ${proposalCountExpr}
      FROM clients c
      ${joinClause}
      ${where}
      ORDER BY c.${safeSort} ${safeSortDir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    return { countQuery, dataQuery }
  }

  let countResult
  let dataResult
  const full = buildQueries({ withMergedFilter: true, withOptionalJoin: true, withProposalCount: true })

  try {
    ;[countResult, dataResult] = await Promise.all([
      sql(full.countQuery, params),
      sql(full.dataQuery, [...params, limitNum, offset]),
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = error?.code ?? null
    const missingMergedColumn =
      code === '42703' || message.includes('merged_into_client_id')
    const missingOptionalJoin =
      message.includes('app_user_profiles') || message.includes('proposals')

    const fallback = buildQueries({
      withMergedFilter: !missingMergedColumn,
      withOptionalJoin: !missingOptionalJoin,
      withProposalCount: !missingOptionalJoin,
    })
    console.warn('[clients][list] retrying with compatibility mode', {
      missingMergedColumn,
      missingOptionalJoin,
      message,
      code,
    })
    ;[countResult, dataResult] = await Promise.all([
      sql(fallback.countQuery, params),
      sql(fallback.dataQuery, [...params, limitNum, offset]),
    ])
  }

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
 * Fetch a single client by ID, respecting RLS context.
 *
 * For role_comercial callers, an additional application-layer owner_user_id
 * filter is added as defense-in-depth (mirrors the behavior in listClients).
 *
 * Returns the client row or null when not found / not accessible.
 *
 * @param {Function} sql         - user-scoped sql handle from createUserScopedSql
 * @param {string}   clientId    - UUID of the client
 * @param {object}   [options]
 * @param {string}   [options.actorUserId]  - Stack Auth user ID of the requester
 * @param {string}   [options.actorRole]    - canonical role (e.g. 'role_comercial')
 */
export async function getClientById(sql, clientId, { actorUserId = null, actorRole: role = null } = {}) {
  const isComercial = role === 'role_comercial'
  let rows
  if (isComercial && actorUserId) {
    // Defense-in-depth: for comercial callers, scope by owner at the SQL layer
    // in addition to whatever the RLS SELECT policy enforces.
    rows = await sql`
      SELECT c.*,
        up.display_name AS owner_display_name,
        up.email        AS owner_email
      FROM clients c
      LEFT JOIN app_user_profiles up ON up.stack_user_id = c.owner_user_id
      WHERE c.id = ${clientId}
        AND c.deleted_at IS NULL
        AND c.owner_user_id = ${actorUserId}
    `
  } else {
    rows = await sql`
      SELECT c.*,
        up.display_name AS owner_display_name,
        up.email        AS owner_email
      FROM clients c
      LEFT JOIN app_user_profiles up ON up.stack_user_id = c.owner_user_id
      WHERE c.id = ${clientId}
        AND c.deleted_at IS NULL
    `
  }
  return rows[0] ?? null
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
