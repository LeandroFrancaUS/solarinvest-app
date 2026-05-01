// server/adapters/financeAdapter.js
//
// Compatibility adapter: new app Finance models ↔ production financial tables.
//
// Tables covered:
//   financial_entries         — income/expense records
//   financial_categories      — category catalogue
//   client_invoices           — per-UC utility invoices
//   financial_import_batches  — Excel import audit trail
//   financial_import_items    — per-row import audit
//
// ⚠️  Type mismatch: financial_entries.client_id is UUID in the original schema
//     (migration 0043) while clients.id is BIGINT.  The adapter surfaces
//     client_id as a string for safe in-memory comparison.  Do NOT use it as a
//     JOIN key against clients.id without an explicit CAST in SQL.
//
// Soft-delete: financial_entries and financial_projects have deleted_at columns.
//   client_invoices uses payment_status ('vencida') — no hard deleted_at.
//
// This module is a PURE DATA-MAPPING layer — no DB access.

const VALID_ENTRY_TYPES = new Set(['income', 'expense'])
const VALID_SCOPE_TYPES = new Set(['company', 'project'])
const VALID_ENTRY_STATUSES = new Set(['planned', 'due', 'paid', 'received', 'cancelled'])

// ─────────────────────────────────────────────────────────────────────────────
// financial_entries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a financial_entries row to the app FinancialEntry model.
 *
 * NOTE: client_id is stored as UUID in the DB (schema mismatch vs clients.id BIGINT).
 *       It is surfaced here as a string; do not use for BIGINT FK joins.
 *
 * @param {object} row
 * @returns {object} App FinancialEntry model
 */
export function fromEntryDb(row) {
  if (!row || typeof row !== 'object') {
    return null
  }

  return {
    id:                   row.id,
    entry_type:           row.entry_type            ?? null,
    scope_type:           row.scope_type            ?? null,
    category:             row.category              ?? null,
    subcategory:          row.subcategory           ?? null,
    description:          row.description           ?? null,
    amount:               row.amount                ?? 0,
    currency:             row.currency              ?? 'BRL',
    competence_date:      row.competence_date       ?? null,
    payment_date:         row.payment_date          ?? null,
    status:               row.status                ?? 'planned',
    is_recurring:         row.is_recurring          ?? false,
    recurrence_frequency: row.recurrence_frequency  ?? null,
    project_kind:         row.project_kind          ?? null,
    // client_id is UUID in this table — surface as string to avoid BIGINT confusion
    client_id:            row.client_id != null ? String(row.client_id) : null,
    project_id:           row.project_id            ?? null,
    proposal_id:          row.proposal_id           ?? null,
    consultant_id:        row.consultant_id         ?? null,
    notes:                row.notes                 ?? null,
    created_by_user_id:   row.created_by_user_id    ?? null,
    updated_by_user_id:   row.updated_by_user_id    ?? null,
    created_at:           row.created_at            ?? null,
    updated_at:           row.updated_at            ?? null,
    deleted_at:           row.deleted_at            ?? null,
  }
}

/**
 * Map an app FinancialEntry model to a DB INSERT/UPDATE shape.
 *
 * @param {object} model
 * @param {{ authProviderUserId: string }} actor
 * @param {'insert'|'update'} [mode='insert']
 * @returns {object} DB-ready object
 */
export function toEntryDb(model, actor, mode = 'insert') {
  if (!model || typeof model !== 'object') {
    throw new TypeError('FinanceAdapter.toEntryDb: model must be a non-null object')
  }
  if (!actor?.authProviderUserId) {
    throw new TypeError('FinanceAdapter.toEntryDb: actor.authProviderUserId is required')
  }

  const entryType = model.entry_type
  if (entryType !== undefined && !VALID_ENTRY_TYPES.has(entryType)) {
    throw new TypeError(
      `FinanceAdapter.toEntryDb: entry_type must be one of [${[...VALID_ENTRY_TYPES].join(', ')}], got "${entryType}"`,
    )
  }

  const scopeType = model.scope_type
  if (scopeType !== undefined && !VALID_SCOPE_TYPES.has(scopeType)) {
    throw new TypeError(
      `FinanceAdapter.toEntryDb: scope_type must be one of [${[...VALID_SCOPE_TYPES].join(', ')}], got "${scopeType}"`,
    )
  }

  const status = model.status
  if (status !== undefined && !VALID_ENTRY_STATUSES.has(status)) {
    throw new TypeError(
      `FinanceAdapter.toEntryDb: status must be one of [${[...VALID_ENTRY_STATUSES].join(', ')}], got "${status}"`,
    )
  }

  const userId = actor.authProviderUserId

  const base = {
    entry_type:            entryType              ?? null,
    scope_type:            scopeType              ?? 'company',
    category:              model.category         ?? null,
    subcategory:           model.subcategory      ?? null,
    description:           model.description      ?? null,
    amount:                model.amount           ?? 0,
    currency:              model.currency         ?? 'BRL',
    competence_date:       model.competence_date  ?? null,
    payment_date:          model.payment_date     ?? null,
    status:                status                 ?? 'planned',
    is_recurring:          model.is_recurring     ?? false,
    recurrence_frequency:  model.recurrence_frequency ?? null,
    project_kind:          model.project_kind     ?? null,
    // client_id is UUID column — pass through as-is (caller must provide UUID, not BIGINT)
    client_id:             model.client_id        ?? null,
    project_id:            model.project_id       ?? null,
    proposal_id:           model.proposal_id      ?? null,
    consultant_id:         model.consultant_id    ?? null,
    notes:                 model.notes            ?? null,
    updated_by_user_id:    userId,
  }

  if (mode === 'insert') {
    base.created_by_user_id = userId
  }

  return base
}

// ─────────────────────────────────────────────────────────────────────────────
// client_invoices
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a client_invoices row to the app ClientInvoice model.
 *
 * @param {object} row
 * @returns {object}
 */
export function fromInvoiceDb(row) {
  if (!row || typeof row !== 'object') {
    return null
  }

  return {
    id:                           row.id,
    client_id:                    row.client_id                   ?? null,
    uc:                           row.uc                          ?? null,
    invoice_number:               row.invoice_number              ?? null,
    reference_month:              row.reference_month             ?? null,
    due_date:                     row.due_date                    ?? null,
    amount:                       row.amount                      ?? 0,
    payment_status:               row.payment_status              ?? 'pendente',
    paid_at:                      row.paid_at                     ?? null,
    payment_receipt_number:       row.payment_receipt_number      ?? null,
    payment_transaction_number:   row.payment_transaction_number  ?? null,
    payment_attachment_url:       row.payment_attachment_url      ?? null,
    confirmed_by_user_id:         row.confirmed_by_user_id        ?? null,
    notes:                        row.notes                       ?? null,
    created_at:                   row.created_at                  ?? null,
    updated_at:                   row.updated_at                  ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// financial_import_batches
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a financial_import_batches row to the app ImportBatch model.
 *
 * @param {object} row
 * @returns {object}
 */
export function fromImportBatchDb(row) {
  if (!row || typeof row !== 'object') {
    return null
  }

  return {
    id:                       row.id,
    source_file_name:         row.source_file_name          ?? null,
    source_mime_type:         row.source_mime_type          ?? null,
    source_file_size_bytes:   row.source_file_size_bytes    ?? null,
    source_file_hash:         row.source_file_hash          ?? null,
    import_type:              row.import_type               ?? null,
    status:                   row.status                    ?? null,
    preview_only:             row.preview_only              ?? false,
    merge_mode:               row.merge_mode                ?? false,
    total_worksheets:         row.total_worksheets          ?? 0,
    total_detected_items:     row.total_detected_items      ?? 0,
    total_created_clients:    row.total_created_clients     ?? 0,
    total_updated_clients:    row.total_updated_clients     ?? 0,
    total_created_proposals:  row.total_created_proposals   ?? 0,
    total_updated_proposals:  row.total_updated_proposals   ?? 0,
    total_created_projects:   row.total_created_projects    ?? 0,
    total_updated_projects:   row.total_updated_projects    ?? 0,
    total_created_entries:    row.total_created_entries     ?? 0,
    total_ignored_items:      row.total_ignored_items       ?? 0,
    total_conflicts:          row.total_conflicts           ?? 0,
    warnings:                 row.warnings_json             ?? [],
    summary:                  row.summary_json              ?? {},
    created_by_user_id:       row.created_by_user_id        ?? null,
    started_at:               row.started_at                ?? null,
    completed_at:             row.completed_at              ?? null,
    created_at:               row.created_at                ?? null,
    updated_at:               row.updated_at                ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// financial_import_items
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a financial_import_items row to the app ImportItem model.
 *
 * @param {object} row
 * @returns {object}
 */
export function fromImportItemDb(row) {
  if (!row || typeof row !== 'object') {
    return null
  }

  return {
    id:                     row.id,
    batch_id:               row.batch_id               ?? null,
    source_sheet_name:      row.source_sheet_name      ?? null,
    worksheet_type:         row.worksheet_type         ?? null,
    source_row_start:       row.source_row_start       ?? null,
    source_row_end:         row.source_row_end         ?? null,
    detected_client_name:   row.detected_client_name   ?? null,
    detected_uf:            row.detected_uf            ?? null,
    detected_project_type:  row.detected_project_type  ?? null,
    match_type:             row.match_type             ?? null,
    match_confidence:       row.match_confidence       ?? 0,
    linked_client_id:       row.linked_client_id       ?? null,
    linked_proposal_id:     row.linked_proposal_id     ?? null,
    linked_project_id:      row.linked_project_id      ?? null,
    created_client_id:      row.created_client_id      ?? null,
    created_proposal_id:    row.created_proposal_id    ?? null,
    created_project_id:     row.created_project_id     ?? null,
    status:                 row.status                 ?? null,
    raw:                    row.raw_json               ?? {},
    normalized:             row.normalized_json        ?? {},
    warnings:               row.warnings_json          ?? [],
    errors:                 row.errors_json            ?? [],
    created_at:             row.created_at             ?? null,
    updated_at:             row.updated_at             ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Soft-delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a partial update shape for soft-deleting a financial entry or project.
 *
 * @param {string} id - UUID of the entry or project
 * @param {{ authProviderUserId: string }} actor
 * @returns {{ id: string, deleted_at: Date, updated_by_user_id: string }}
 */
export function toSoftDelete(id, actor) {
  if (!id) {
    throw new TypeError('FinanceAdapter.toSoftDelete: id is required')
  }
  if (!actor?.authProviderUserId) {
    throw new TypeError('FinanceAdapter.toSoftDelete: actor.authProviderUserId is required')
  }
  return {
    id,
    deleted_at:         new Date(),
    updated_by_user_id: actor.authProviderUserId,
  }
}
