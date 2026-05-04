// server/adapters/proposalAdapter.js
// Pure mapping adapter for proposal field compatibility.
//
// Proposals store client context as prefixed fields (client_name,
// client_document, client_city, client_state, client_phone, client_email)
// alongside the canonical payload_json blob which must always be preserved
// intact.  These functions bridge the gap when upstream code supplies data
// under different shapes.
//
// These functions are intentionally pure:
//   - No DB access
//   - No SQL execution
//   - No RLS manipulation
//   - No side effects

/**
 * Normalize a raw proposal row (DB or API shape) to a consistent object
 * where all client context fields use the canonical prefixed names and
 * payload_json is kept as-is.
 *
 * @param {object} raw - Proposal row or partial object.
 * @returns {object}   - Normalized proposal with canonical field names.
 */
export function toCanonicalProposal(raw) {
  if (!raw || typeof raw !== 'object') return {}

  return {
    ...raw,
    client_name:     raw.client_name     ?? raw.name     ?? null,
    client_document: raw.client_document ?? raw.document ?? null,
    client_email:    raw.client_email    ?? raw.email    ?? null,
    client_phone:    raw.client_phone    ?? raw.phone    ?? null,
    client_city:     raw.client_city     ?? raw.city     ?? null,
    client_state:    raw.client_state    ?? raw.state    ?? null,
    // payload_json is always preserved as received — never rewritten.
    payload_json:    raw.payload_json    ?? null,
  }
}

/**
 * Build a safe write payload from inbound data for a proposal INSERT/UPDATE.
 * Resolves legacy/canonical aliases for client context fields and ensures
 * payload_json is present and valid before returning.
 *
 * Throws when payload_json is absent or empty, mirroring the guard in
 * server/proposals/repository.js#assertPayloadJsonValid.
 *
 * @param {object} input - Inbound data from a request or form.
 * @returns {object}     - Write-safe object ready for the proposals table.
 */
export function toProposalWritePayload(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('proposal input must be a non-null object')
  }

  const payload_json = input.payload_json
  if (
    payload_json == null ||
    typeof payload_json !== 'object' ||
    Array.isArray(payload_json) ||
    Object.keys(payload_json).length === 0
  ) {
    const err = new Error('payload_json must be a non-empty object')
    err.code = 'INVALID_PAYLOAD'
    throw err
  }

  return {
    proposal_type:   input.proposal_type   ?? undefined,
    proposal_code:   input.proposal_code   ?? undefined,
    version:         input.version         ?? undefined,
    status:          input.status          ?? undefined,
    client_name:     input.client_name     ?? input.name     ?? undefined,
    client_document: input.client_document ?? input.document ?? undefined,
    client_email:    input.client_email    ?? input.email    ?? undefined,
    client_phone:    input.client_phone    ?? input.phone    ?? undefined,
    client_city:     input.client_city     ?? input.city     ?? undefined,
    client_state:    input.client_state    ?? input.state    ?? undefined,
    // payload_json is preserved untouched.
    payload_json,
  }
}

/**
 * Extract the client context fields from a proposal row.
 * Useful when the caller only needs the denormalized client snapshot without
 * the full proposal record.
 *
 * @param {object} proposal - Proposal row (canonical or legacy shape).
 * @returns {object}        - Plain object with client context only.
 */
export function extractClientContext(proposal) {
  if (!proposal || typeof proposal !== 'object') return {}

  return {
    client_name:     proposal.client_name     ?? proposal.name     ?? null,
    client_document: proposal.client_document ?? proposal.document ?? null,
    client_email:    proposal.client_email    ?? proposal.email    ?? null,
    client_phone:    proposal.client_phone    ?? proposal.phone    ?? null,
    client_city:     proposal.client_city     ?? proposal.city     ?? null,
    client_state:    proposal.client_state    ?? proposal.state    ?? null,
  }
}
