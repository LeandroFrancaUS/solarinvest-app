// server/adapters/proposalAdapter.js
//
// Compatibility adapter: new app Proposal model ↔ production proposals table.
//
// Key production constraints:
//   • proposal_type IN ('leasing','venda')
//   • proposals.id  UUID PRIMARY KEY
//   • proposals.client_id  BIGINT NULL FK → clients(id)   [added in migration 0049]
//   • source_proposal_id TEXT on client_contracts (legacy — no FK enforcement)
//   • deleted_at IS NULL  for active rows
//
// This module is a PURE DATA-MAPPING layer — no DB access.

const VALID_PROPOSAL_TYPES = new Set(['leasing', 'venda'])

/**
 * Map a production proposals row to the normalized app Proposal model.
 *
 * Handles legacy rows where client_id may be null (created before migration 0049).
 *
 * @param {object} row - Raw row from the proposals table
 * @returns {object} App-model proposal
 */
export function fromDb(row) {
  if (!row || typeof row !== 'object') {
    return null
  }

  return {
    id:                     row.id,
    proposal_type:          row.proposal_type    ?? null,
    proposal_code:          row.proposal_code    ?? null,
    version:                row.version          ?? 1,
    status:                 row.status           ?? 'draft',
    // client_id was added in migration 0049; may be null on legacy rows
    client_id:              row.client_id        ?? null,  // BIGINT | null
    client_name:            row.client_name      ?? null,
    client_document:        row.client_document  ?? null,
    client_city:            row.client_city      ?? null,
    client_state:           row.client_state     ?? null,
    client_phone:           row.client_phone     ?? null,
    client_email:           row.client_email     ?? null,
    // Financial snapshot fields
    consumption_kwh_month:  row.consumption_kwh_month ?? null,
    system_kwp:             row.system_kwp            ?? null,
    capex_total:            row.capex_total            ?? null,
    contract_value:         row.contract_value         ?? null,
    term_months:            row.term_months            ?? null,
    // Full payload (source of truth for all proposal details)
    payload_json:           row.payload_json    ?? {},
    // Ownership / audit
    owner_user_id:          row.owner_user_id         ?? null,
    owner_email:            row.owner_email           ?? null,
    owner_display_name:     row.owner_display_name    ?? null,
    created_by_user_id:     row.created_by_user_id    ?? null,
    updated_by_user_id:     row.updated_by_user_id    ?? null,
    created_at:             row.created_at            ?? null,
    updated_at:             row.updated_at            ?? null,
    deleted_at:             row.deleted_at            ?? null,
  }
}

/**
 * Map an app Proposal model to a DB INSERT/UPDATE shape.
 *
 * @param {object} model - App-model proposal fields
 * @param {{ authProviderUserId: string }} actor
 * @param {'insert'|'update'} [mode='insert']
 * @returns {object} DB-ready object
 * @throws {TypeError} if proposal_type is invalid
 */
export function toDb(model, actor, mode = 'insert') {
  if (!model || typeof model !== 'object') {
    throw new TypeError('ProposalAdapter.toDb: model must be a non-null object')
  }
  if (!actor?.authProviderUserId) {
    throw new TypeError('ProposalAdapter.toDb: actor.authProviderUserId is required')
  }

  const proposalType = model.proposal_type
  if (proposalType !== undefined && !VALID_PROPOSAL_TYPES.has(proposalType)) {
    throw new TypeError(
      `ProposalAdapter.toDb: proposal_type must be one of [${[...VALID_PROPOSAL_TYPES].join(', ')}], got "${proposalType}"`,
    )
  }

  const userId = actor.authProviderUserId

  const base = {
    proposal_type:          proposalType                     ?? null,
    proposal_code:          model.proposal_code              ?? null,
    version:                model.version                    ?? 1,
    status:                 model.status                     ?? 'draft',
    // client_id is BIGINT nullable — preserve as-is (null for legacy proposals)
    client_id:              model.client_id                  ?? null,
    client_name:            model.client_name                ?? null,
    client_document:        model.client_document            ?? null,
    client_city:            model.client_city                ?? null,
    client_state:           model.client_state               ?? null,
    client_phone:           model.client_phone               ?? null,
    client_email:           model.client_email               ?? null,
    consumption_kwh_month:  model.consumption_kwh_month      ?? null,
    system_kwp:             model.system_kwp                 ?? null,
    capex_total:            model.capex_total                ?? null,
    contract_value:         model.contract_value             ?? null,
    term_months:            model.term_months                ?? null,
    // Always preserve payload_json — never null
    payload_json:           model.payload_json               ?? {},
    owner_user_id:          model.owner_user_id              ?? userId,
    owner_email:            model.owner_email                ?? null,
    owner_display_name:     model.owner_display_name         ?? null,
    updated_by_user_id:     userId,
  }

  if (mode === 'insert') {
    base.created_by_user_id = userId
  }

  return base
}

/**
 * Soft-delete shape for a proposal.
 *
 * @param {string} id - Proposal UUID
 * @param {{ authProviderUserId: string }} actor
 * @returns {{ id: string, deleted_at: Date, updated_by_user_id: string }}
 */
export function toSoftDelete(id, actor) {
  if (!id) {
    throw new TypeError('ProposalAdapter.toSoftDelete: id is required')
  }
  if (!actor?.authProviderUserId) {
    throw new TypeError('ProposalAdapter.toSoftDelete: actor.authProviderUserId is required')
  }
  return {
    id,
    deleted_at:         new Date(),
    updated_by_user_id: actor.authProviderUserId,
  }
}
