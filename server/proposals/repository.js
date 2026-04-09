// server/proposals/repository.js
// Database queries for proposals using the Neon SQL client.
// The neon sql tag returns rows directly as an array (not { rows: [...] }).

const DEFAULT_PAGE_LIMIT = 20
const MAX_PAGE_LIMIT = 100

/**
 * Insert a new proposal row and return the created record.
 */
export async function createProposal(sql, ownerUserId, data) {
  const {
    proposal_type,
    proposal_code = null,
    version = 1,
    status = 'draft',
    owner_email = null,
    owner_display_name = null,
    created_by_user_id,
    client_name = null,
    client_document = null,
    client_city = null,
    client_state = null,
    client_phone = null,
    client_email = null,
    consumption_kwh_month = null,
    system_kwp = null,
    capex_total = null,
    contract_value = null,
    term_months = null,
    payload_json = {},
  } = data

  const rows = await sql`
    INSERT INTO proposals (
      proposal_type, proposal_code, version, status,
      owner_user_id, owner_email, owner_display_name,
      created_by_user_id, updated_by_user_id,
      client_name, client_document, client_city, client_state,
      client_phone, client_email,
      consumption_kwh_month, system_kwp, capex_total, contract_value, term_months,
      payload_json
    ) VALUES (
      ${proposal_type}, ${proposal_code}, ${version}, ${status},
      ${ownerUserId}, ${owner_email}, ${owner_display_name},
      ${created_by_user_id ?? ownerUserId}, ${created_by_user_id ?? ownerUserId},
      ${client_name}, ${client_document}, ${client_city}, ${client_state},
      ${client_phone}, ${client_email},
      ${consumption_kwh_month}, ${system_kwp}, ${capex_total}, ${contract_value}, ${term_months},
      ${JSON.stringify(payload_json)}::jsonb
    )
    RETURNING *
  `
  return rows[0] ?? null
}

/**
 * Fetch a single non-deleted proposal by its UUID.
 */
export async function getProposalById(sql, id) {
  const rows = await sql`
    SELECT p.*, up.primary_role AS owner_role
    FROM proposals p
    LEFT JOIN app_user_profiles up ON up.stack_user_id = p.owner_user_id
    WHERE p.id = ${id}
      AND p.deleted_at IS NULL
    LIMIT 1
  `
  return rows[0] ?? null
}

/**
 * List proposals with optional filters and pagination.
 * filter: { ownerUserId?, officeUserId?, page, limit, proposal_type?, status? }
 *
 * When officeUserId is set (office role), the query returns:
 *   - proposals where owner_user_id = officeUserId (own)
 *   - proposals where the owner has primary_role = 'role_comercial'
 *
 * Uses the neon callable form sql(queryText, params) to support dynamic
 * WHERE clauses without duplicating query branches.
 */
export async function listProposals(sql, filter = {}) {
  const page = Math.max(1, parseInt(filter.page ?? 1, 10))
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(filter.limit ?? DEFAULT_PAGE_LIMIT, 10)))
  const offset = (page - 1) * limit

  const params = []

  // Build the access-control WHERE fragment
  let accessFragment = ''
  if (filter.officeUserId) {
    // Office: own proposals OR proposals owned by comercial users
    params.push(filter.officeUserId)
    accessFragment = `(p.owner_user_id = $${params.length} OR up.primary_role = 'role_comercial')`
  } else if (filter.ownerUserId) {
    params.push(filter.ownerUserId)
    accessFragment = `p.owner_user_id = $${params.length}`
  }

  const conditions = ['p.deleted_at IS NULL']
  if (accessFragment) conditions.push(accessFragment)

  if (filter.proposal_type) {
    params.push(filter.proposal_type)
    conditions.push(`p.proposal_type = $${params.length}`)
  }
  if (filter.status) {
    params.push(filter.status)
    conditions.push(`p.status = $${params.length}`)
  }

  const whereClause = conditions.join(' AND ')
  const joinClause = 'LEFT JOIN app_user_profiles up ON up.stack_user_id = p.owner_user_id'

  const countRows = await sql(
    `SELECT COUNT(*) AS total FROM proposals p ${joinClause} WHERE ${whereClause}`,
    params
  )

  const listParams = [...params, limit, offset]
  const limitPlaceholder = `$${params.length + 1}`
  const offsetPlaceholder = `$${params.length + 2}`
  const rows = await sql(
    `SELECT p.*, up.primary_role AS owner_role
     FROM proposals p ${joinClause}
     WHERE ${whereClause}
     ORDER BY p.updated_at DESC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    listParams
  )

  const total = parseInt(countRows[0]?.total ?? 0, 10)

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

/**
 * Update a proposal by id. Only provided fields are updated.
 * Returns the updated row or null if not found.
 */
export async function updateProposal(sql, id, data) {
  const {
    proposal_code,
    version,
    status,
    owner_email,
    owner_display_name,
    updated_by_user_id = null,
    client_name,
    client_document,
    client_city,
    client_state,
    client_phone,
    client_email,
    consumption_kwh_month,
    system_kwp,
    capex_total,
    contract_value,
    term_months,
    payload_json,
  } = data

  // Build SET clause dynamically using a raw query approach
  const setClauses = ['updated_at = now()']
  const values = []
  let paramIndex = 1

  const addField = (col, val) => {
    setClauses.push(`${col} = $${paramIndex++}`)
    values.push(val)
  }

  if ('proposal_code' in data) addField('proposal_code', proposal_code)
  if ('version' in data) addField('version', version)
  if ('status' in data) addField('status', status)
  if ('owner_email' in data) addField('owner_email', owner_email)
  if ('owner_display_name' in data) addField('owner_display_name', owner_display_name)
  if ('updated_by_user_id' in data) addField('updated_by_user_id', updated_by_user_id)
  if ('client_name' in data) addField('client_name', client_name)
  if ('client_document' in data) addField('client_document', client_document)
  if ('client_city' in data) addField('client_city', client_city)
  if ('client_state' in data) addField('client_state', client_state)
  if ('client_phone' in data) addField('client_phone', client_phone)
  if ('client_email' in data) addField('client_email', client_email)
  if ('consumption_kwh_month' in data) addField('consumption_kwh_month', consumption_kwh_month)
  if ('system_kwp' in data) addField('system_kwp', system_kwp)
  if ('capex_total' in data) addField('capex_total', capex_total)
  if ('contract_value' in data) addField('contract_value', contract_value)
  if ('term_months' in data) addField('term_months', term_months)
  if ('payload_json' in data) {
    setClauses.push(`payload_json = $${paramIndex++}::jsonb`)
    values.push(JSON.stringify(payload_json))
  }

  values.push(id)
  const idParam = `$${paramIndex}`

  const queryText = `
    UPDATE proposals
    SET ${setClauses.join(', ')}
    WHERE id = ${idParam}
      AND deleted_at IS NULL
    RETURNING *
  `

  // Use the neon callable form sql(queryText, params) for the dynamic
  // SET clause — the same function supports both tagged-template and
  // regular function call signatures.
  const rows = await sql(queryText, values)
  return rows[0] ?? null
}

/**
 * Soft-delete a proposal by setting deleted_at.
 * Returns the updated row or null if not found.
 */
export async function softDeleteProposal(sql, id, userId) {
  const rows = await sql`
    UPDATE proposals
    SET deleted_at = now(), updated_at = now(), updated_by_user_id = ${userId}
    WHERE id = ${id}
      AND deleted_at IS NULL
    RETURNING *
  `
  return rows[0] ?? null
}

/**
 * Append a row to proposal_audit_log. Best-effort: errors are swallowed.
 */
export async function appendAuditLog(sql, proposalId, actorUserId, actorEmail, action, oldValue, newValue) {
  try {
    await sql`
      INSERT INTO proposal_audit_log (
        proposal_id, actor_user_id, actor_email, action,
        old_value_json, new_value_json
      ) VALUES (
        ${proposalId},
        ${actorUserId},
        ${actorEmail ?? null},
        ${action},
        ${oldValue != null ? JSON.stringify(oldValue) : null}::jsonb,
        ${newValue != null ? JSON.stringify(newValue) : null}::jsonb
      )
    `
  } catch (err) {
    console.warn('[proposals] appendAuditLog error:', err?.message)
  }
}
