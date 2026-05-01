// server/adapters/clientAdapter.js
//
// Compatibility adapter: new app Client model ↔ production clients table.
//
// Production column names (after migration 0027/0028):
//   client_name, client_document, client_email, client_phone,
//   client_city, client_state, client_address
//
// New app model fields:
//   name, document, email, phone, city, state, address, owner
//
// This module is a PURE DATA-MAPPING layer — no DB access.
// It must be used by route handlers that already hold a RLS-scoped sql handle.

import { normalizeDocumentServer } from '../clients/repository.js'

/**
 * Map a production DB row to the normalized app Client model.
 *
 * @param {object} row - Raw row from the clients table
 * @returns {object} App-model client
 */
export function fromDb(row) {
  if (!row || typeof row !== 'object') {
    return null
  }

  return {
    id:                    row.id,
    name:                  row.client_name   ?? null,
    document:              row.client_document ?? null,
    email:                 row.client_email  ?? null,
    phone:                 row.client_phone  ?? null,
    city:                  row.client_city   ?? null,
    state:                 row.client_state  ?? null,
    address:               row.client_address ?? null,
    cep:                   row.client_cep    ?? null,
    owner:                 row.owner_user_id ?? null,
    // Document normalization fields
    cpf_normalized:        row.cpf_normalized  ?? null,
    cnpj_normalized:       row.cnpj_normalized ?? null,
    document_type:         row.document_type   ?? null,
    // Energy / commercial fields
    uc:                    row.uc_geradora      ?? null,
    uc_beneficiaria:       row.uc_beneficiaria  ?? null,
    system_kwp:            row.system_kwp       ?? null,
    term_months:           row.term_months      ?? null,
    consumption_kwh_month: row.consumption_kwh_month ?? null,
    distribuidora:         row.distribuidora    ?? null,
    // Lifecycle / status
    status_comercial:      row.status_comercial ?? null,
    status_cliente:        row.status_cliente   ?? null,
    in_portfolio:          row.in_portfolio     ?? false,
    // Audit
    created_by_user_id:    row.created_by_user_id ?? null,
    updated_by_user_id:    row.updated_by_user_id ?? null,
    created_at:            row.created_at ?? null,
    updated_at:            row.updated_at ?? null,
    deleted_at:            row.deleted_at ?? null,
    // Misc
    consultant_id:         row.consultant_id ?? null,
    metadata:              row.metadata      ?? null,
    identity_status:       row.identity_status ?? null,
    origin:                row.origin          ?? null,
    offline_origin_id:     row.offline_origin_id ?? null,
  }
}

/**
 * Map the new app Client model to a DB INSERT/UPDATE shape.
 * Runs document normalization and stamps audit fields.
 *
 * @param {object} model - App-model client fields
 * @param {{ authProviderUserId: string }} actor - RLS actor (from AuthAdapter)
 * @param {'insert'|'update'} [mode='insert'] - Controls which audit fields are set
 * @returns {object} DB-ready object
 */
export function toDb(model, actor, mode = 'insert') {
  if (!model || typeof model !== 'object') {
    throw new TypeError('ClientAdapter.toDb: model must be a non-null object')
  }
  if (!actor?.authProviderUserId) {
    throw new TypeError('ClientAdapter.toDb: actor.authProviderUserId is required')
  }

  const userId = actor.authProviderUserId

  // Normalize document
  const rawDocument = model.document ?? null
  const { type: detectedType, normalized } = normalizeDocumentServer(rawDocument)
  const cpf_normalized  = detectedType === 'cpf'  ? normalized : (model.cpf_normalized  ?? null)
  const cnpj_normalized = detectedType === 'cnpj' ? normalized : (model.cnpj_normalized ?? null)
  const document_type   = detectedType !== 'unknown' ? detectedType : (model.document_type ?? null)

  const base = {
    client_name:           model.name     ?? null,
    client_document:       rawDocument,
    client_email:          model.email    ?? null,
    client_phone:          model.phone    ?? null,
    client_city:           model.city     ?? null,
    client_state:          model.state    ?? null,
    client_address:        model.address  ?? null,
    client_cep:            model.cep      ?? null,
    owner_user_id:         model.owner    ?? userId,
    cpf_normalized,
    cnpj_normalized,
    document_type,
    uc_geradora:           model.uc                    ?? null,
    uc_beneficiaria:       model.uc_beneficiaria        ?? null,
    system_kwp:            model.system_kwp             ?? null,
    term_months:           model.term_months            ?? null,
    consumption_kwh_month: model.consumption_kwh_month  ?? null,
    distribuidora:         model.distribuidora           ?? null,
    status_comercial:      model.status_comercial        ?? undefined,
    status_cliente:        model.status_cliente          ?? undefined,
    consultant_id:         model.consultant_id           ?? null,
    metadata:              model.metadata                ?? null,
    identity_status:       model.identity_status         ?? undefined,
    origin:                model.origin                  ?? undefined,
    offline_origin_id:     model.offline_origin_id       ?? null,
    updated_by_user_id:    userId,
  }

  if (mode === 'insert') {
    base.created_by_user_id = userId
    base.user_id             = userId
    base.owner_stack_user_id = model.owner ?? userId
  }

  return base
}

/**
 * Returns a partial update shape for soft-deleting a client.
 *
 * @param {string|number} id - Client PK
 * @param {{ authProviderUserId: string }} actor
 * @returns {{ id: string|number, deleted_at: Date, updated_by_user_id: string }}
 */
export function toSoftDelete(id, actor) {
  if (!id) {
    throw new TypeError('ClientAdapter.toSoftDelete: id is required')
  }
  if (!actor?.authProviderUserId) {
    throw new TypeError('ClientAdapter.toSoftDelete: actor.authProviderUserId is required')
  }
  return {
    id,
    deleted_at:         new Date(),
    updated_by_user_id: actor.authProviderUserId,
  }
}
