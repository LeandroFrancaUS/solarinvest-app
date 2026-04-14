// server/proposals/validators.js
// Validates proposal create/update payloads.

const VALID_TYPES = ['leasing', 'venda']
const VALID_STATUSES = ['draft', 'sent', 'approved', 'rejected', 'cancelled']

const OPTIONAL_STRING_FIELDS = [
  'client_name',
  'client_document',
  'client_city',
  'client_state',
  'client_phone',
  'client_email',
  'proposal_code',
  'owner_email',
  'owner_display_name',
  'uc_geradora_nm',
  'uc_beneficiaria',
]

const OPTIONAL_NUMBER_FIELDS = [
  'consumption_kwh_month',
  'system_kwp',
  'capex_total',
  'contract_value',
]

function pickAllowedFields(body) {
  const data = {}

  for (const field of OPTIONAL_STRING_FIELDS) {
    if (field in body) {
      if (body[field] !== null && typeof body[field] !== 'string') {
        return { valid: false, error: `Field '${field}' must be a string or null` }
      }
      data[field] = body[field] === null ? null : String(body[field]).trim() || null
    }
  }

  for (const field of OPTIONAL_NUMBER_FIELDS) {
    if (field in body) {
      if (body[field] !== null && typeof body[field] !== 'number') {
        return { valid: false, error: `Field '${field}' must be a number or null` }
      }
      data[field] = body[field]
    }
  }

  if ('term_months' in body) {
    if (body.term_months !== null) {
      const v = Number(body.term_months)
      if (!Number.isInteger(v) || v < 0) {
        return { valid: false, error: "Field 'term_months' must be a non-negative integer or null" }
      }
      data.term_months = v
    } else {
      data.term_months = null
    }
  }

  if ('version' in body) {
    if (body.version !== null) {
      const v = Number(body.version)
      if (!Number.isInteger(v) || v < 1) {
        return { valid: false, error: "Field 'version' must be a positive integer or null" }
      }
      data.version = v
    }
  }

  if ('status' in body) {
    if (!VALID_STATUSES.includes(body.status)) {
      return { valid: false, error: `Field 'status' must be one of: ${VALID_STATUSES.join(', ')}` }
    }
    data.status = body.status
  }

  if ('payload_json' in body) {
    if (body.payload_json === null || typeof body.payload_json !== 'object' || Array.isArray(body.payload_json)) {
      return { valid: false, error: "Field 'payload_json' must be a JSON object" }
    }
    data.payload_json = body.payload_json
  }

  return { valid: true, data }
}

/**
 * Validates a proposal create request body.
 * Returns { valid: true, data: {...} } or { valid: false, error: '...' }
 */
export function validateCreateProposal(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' }
  }

  if (!body.proposal_type) {
    return { valid: false, error: "Field 'proposal_type' is required" }
  }
  if (!VALID_TYPES.includes(body.proposal_type)) {
    return { valid: false, error: `Field 'proposal_type' must be one of: ${VALID_TYPES.join(', ')}` }
  }

  if (!body.payload_json || typeof body.payload_json !== 'object' || Array.isArray(body.payload_json)) {
    return { valid: false, error: "Field 'payload_json' is required and must be a JSON object" }
  }

  const result = pickAllowedFields(body)
  if (!result.valid) return result

  return {
    valid: true,
    data: {
      proposal_type: body.proposal_type,
      ...result.data,
      payload_json: body.payload_json,
    },
  }
}

/**
 * Validates a proposal update (PATCH) request body.
 * Returns { valid: true, data: {...} } or { valid: false, error: '...' }
 */
export function validateUpdateProposal(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' }
  }

  if (Object.keys(body).length === 0) {
    return { valid: false, error: 'Request body must contain at least one field to update' }
  }

  // proposal_type is immutable via PATCH — reject if provided
  if ('proposal_type' in body) {
    return { valid: false, error: "Field 'proposal_type' cannot be changed after creation" }
  }

  const result = pickAllowedFields(body)
  if (!result.valid) return result

  if (Object.keys(result.data).length === 0) {
    return { valid: false, error: 'No updatable fields provided' }
  }

  return { valid: true, data: result.data }
}
