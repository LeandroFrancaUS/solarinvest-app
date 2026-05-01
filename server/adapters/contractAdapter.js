// server/adapters/contractAdapter.js
//
// Compatibility adapter: new app Contract model ↔ production client_contracts table.
//
// Key production schema notes (migration 0029 + 0063):
//   • id               BIGSERIAL PRIMARY KEY
//   • client_id        BIGINT NOT NULL FK → clients(id)
//   • source_proposal_id TEXT  (legacy — no FK, no UUID enforcement)
//   • consultant_id      TEXT  (legacy — no FK to consultants table)
//   • contract_type   IN ('leasing','sale','buyout')
//   • contract_status IN ('draft','active','suspended','completed','cancelled')
//   • No deleted_at column — cancellation uses contract_status = 'cancelled'
//
// This module is a PURE DATA-MAPPING layer — no DB access.

const VALID_CONTRACT_TYPES   = new Set(['leasing', 'sale', 'buyout'])
const VALID_CONTRACT_STATUSES = new Set(['draft', 'active', 'suspended', 'completed', 'cancelled'])

/**
 * Map a client_contracts row to the app Contract model.
 *
 * Legacy TEXT fields (source_proposal_id, consultant_id) are surfaced as-is
 * without any type coercion to avoid breaking existing data.
 *
 * @param {object} row - Raw row from client_contracts
 * @returns {object} App Contract model
 */
export function fromDb(row) {
  if (!row || typeof row !== 'object') {
    return null
  }

  return {
    id:                          row.id,
    client_id:                   row.client_id                    ?? null,  // BIGINT
    contract_type:               row.contract_type                ?? null,
    contract_status:             row.contract_status              ?? null,
    contract_signed_at:          row.contract_signed_at           ?? null,
    contract_start_date:         row.contract_start_date          ?? null,
    billing_start_date:          row.billing_start_date           ?? null,
    expected_billing_end_date:   row.expected_billing_end_date    ?? null,
    contractual_term_months:     row.contractual_term_months      ?? null,
    buyout_eligible:             row.buyout_eligible              ?? false,
    buyout_status:               row.buyout_status                ?? null,
    buyout_date:                 row.buyout_date                  ?? null,
    buyout_amount_reference:     row.buyout_amount_reference      ?? null,
    notes:                       row.notes                        ?? null,
    // Legacy TEXT identifiers — no FK; preserved verbatim
    source_proposal_id:          row.source_proposal_id           ?? null,
    consultant_id:               row.consultant_id                ?? null,
    // Optional JSON attachment list
    contract_attachments_json:   row.contract_attachments_json    ?? null,
    // Audit
    created_at:                  row.created_at                   ?? null,
    updated_at:                  row.updated_at                   ?? null,
  }
}

/**
 * Map an app Contract model to a DB INSERT/UPDATE shape.
 *
 * Legacy fields (source_proposal_id, consultant_id) are passed through as TEXT
 * without modification — no FK validation is applied here.
 *
 * @param {object} model
 * @param {{ authProviderUserId: string }} actor
 * @param {'insert'|'update'} [mode='insert']
 * @returns {object} DB-ready object
 * @throws {TypeError} on invalid contract_type or contract_status
 */
export function toDb(model, actor, mode = 'insert') {
  if (!model || typeof model !== 'object') {
    throw new TypeError('ContractAdapter.toDb: model must be a non-null object')
  }
  if (!actor?.authProviderUserId) {
    throw new TypeError('ContractAdapter.toDb: actor.authProviderUserId is required')
  }

  const contractType = model.contract_type
  if (contractType !== undefined && !VALID_CONTRACT_TYPES.has(contractType)) {
    throw new TypeError(
      `ContractAdapter.toDb: contract_type must be one of [${[...VALID_CONTRACT_TYPES].join(', ')}], got "${contractType}"`,
    )
  }

  const contractStatus = model.contract_status
  if (contractStatus !== undefined && !VALID_CONTRACT_STATUSES.has(contractStatus)) {
    throw new TypeError(
      `ContractAdapter.toDb: contract_status must be one of [${[...VALID_CONTRACT_STATUSES].join(', ')}], got "${contractStatus}"`,
    )
  }

  const base = {
    client_id:                   model.client_id                    ?? null,
    contract_type:               contractType                       ?? 'leasing',
    contract_status:             contractStatus                     ?? 'draft',
    contract_signed_at:          model.contract_signed_at           ?? null,
    contract_start_date:         model.contract_start_date          ?? null,
    billing_start_date:          model.billing_start_date           ?? null,
    expected_billing_end_date:   model.expected_billing_end_date    ?? null,
    contractual_term_months:     model.contractual_term_months      ?? null,
    buyout_eligible:             model.buyout_eligible              ?? false,
    buyout_status:               model.buyout_status                ?? null,
    buyout_date:                 model.buyout_date                  ?? null,
    buyout_amount_reference:     model.buyout_amount_reference      ?? null,
    notes:                       model.notes                        ?? null,
    // Legacy TEXT fields — pass through unchanged, no FK enforcement
    source_proposal_id:          model.source_proposal_id           ?? null,
    consultant_id:               model.consultant_id                ?? null,
    contract_attachments_json:   model.contract_attachments_json    ?? null,
  }

  // client_contracts does not have created_by_user_id / updated_by_user_id columns
  // but we include them defensively in case a future migration adds them.
  // They are ignored by DB drivers when the column is absent.
  if (mode === 'insert') {
    base._created_by_user_id = actor.authProviderUserId
  }
  base._updated_by_user_id = actor.authProviderUserId

  return base
}

/**
 * Cancel a contract (no deleted_at — uses status field).
 *
 * @param {string|number} id - Contract PK
 * @param {{ authProviderUserId: string }} actor
 * @returns {{ id: string|number, contract_status: 'cancelled' }}
 */
export function toCancel(id, actor) {
  if (!id) {
    throw new TypeError('ContractAdapter.toCancel: id is required')
  }
  if (!actor?.authProviderUserId) {
    throw new TypeError('ContractAdapter.toCancel: actor.authProviderUserId is required')
  }
  return {
    id,
    contract_status:      'cancelled',
    _updated_by_user_id:  actor.authProviderUserId,
  }
}
