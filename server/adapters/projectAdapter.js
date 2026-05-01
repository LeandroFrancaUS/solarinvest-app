// server/adapters/projectAdapter.js
//
// Compatibility adapter: new app Project model ↔ production projects table.
//
// Production schema (migration 0045):
//   projects         — UUID PK, client_id BIGINT, proposal_id UUID, plan_id TEXT
//   project_pv_data  — 1:1 with projects (technical PV data)
//
// Constraints enforced by adapter:
//   project_type  IN ('leasing','venda')
//   status        IN ('Aguardando','Em andamento','Concluído')
//
// Soft-delete: projects has deleted_at column.
// This module is a PURE DATA-MAPPING layer — no DB access.

const VALID_PROJECT_TYPES = new Set(['leasing', 'venda'])
const VALID_PROJECT_STATUSES = new Set(['Aguardando', 'Em andamento', 'Concluído'])

// ─────────────────────────────────────────────────────────────────────────────
// projects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a projects row to the app Project model.
 *
 * @param {object} row - Raw row from the projects table (may include pv_data sub-object)
 * @returns {object} App Project model
 */
export function fromDb(row) {
  if (!row || typeof row !== 'object') {
    return null
  }

  return {
    id:                    row.id,
    client_id:             row.client_id          ?? null,   // BIGINT
    plan_id:               row.plan_id            ?? null,   // TEXT
    contract_id:           row.contract_id        ?? null,   // BIGINT | null
    proposal_id:           row.proposal_id        ?? null,   // UUID  | null
    project_type:          row.project_type       ?? null,
    status:                row.status             ?? 'Aguardando',
    // Snapshots (kept in sync on upsert)
    client_name_snapshot:  row.client_name_snapshot ?? null,
    cpf_cnpj_snapshot:     row.cpf_cnpj_snapshot    ?? null,
    city_snapshot:         row.city_snapshot         ?? null,
    state_snapshot:        row.state_snapshot        ?? null,
    // Audit
    created_by_user_id:    row.created_by_user_id  ?? null,
    updated_by_user_id:    row.updated_by_user_id  ?? null,
    created_at:            row.created_at          ?? null,
    updated_at:            row.updated_at          ?? null,
    deleted_at:            row.deleted_at          ?? null,
    // Optional nested pv_data (present when query joins project_pv_data)
    pv_data:               row.pv_data ? fromPvDataDb(row.pv_data) : undefined,
  }
}

/**
 * Map an app Project model to a DB INSERT/UPDATE shape.
 *
 * @param {object} model
 * @param {{ authProviderUserId: string }} actor
 * @param {'insert'|'update'} [mode='insert']
 * @returns {object} DB-ready object
 */
export function toDb(model, actor, mode = 'insert') {
  if (!model || typeof model !== 'object') {
    throw new TypeError('ProjectAdapter.toDb: model must be a non-null object')
  }
  if (!actor?.authProviderUserId) {
    throw new TypeError('ProjectAdapter.toDb: actor.authProviderUserId is required')
  }

  const projectType = model.project_type
  if (projectType !== undefined && !VALID_PROJECT_TYPES.has(projectType)) {
    throw new TypeError(
      `ProjectAdapter.toDb: project_type must be one of [${[...VALID_PROJECT_TYPES].join(', ')}], got "${projectType}"`,
    )
  }

  const status = model.status
  if (status !== undefined && !VALID_PROJECT_STATUSES.has(status)) {
    throw new TypeError(
      `ProjectAdapter.toDb: status must be one of [${[...VALID_PROJECT_STATUSES].join(', ')}], got "${status}"`,
    )
  }

  const userId = actor.authProviderUserId

  const base = {
    client_id:             model.client_id           ?? null,
    plan_id:               model.plan_id             ?? null,
    contract_id:           model.contract_id         ?? null,
    proposal_id:           model.proposal_id         ?? null,
    project_type:          projectType               ?? null,
    status:                status                    ?? 'Aguardando',
    client_name_snapshot:  model.client_name_snapshot ?? null,
    cpf_cnpj_snapshot:     model.cpf_cnpj_snapshot    ?? null,
    city_snapshot:         model.city_snapshot        ?? null,
    state_snapshot:        model.state_snapshot       ?? null,
    updated_by_user_id:    userId,
  }

  if (mode === 'insert') {
    base.created_by_user_id = userId
  }

  return base
}

/**
 * Soft-delete shape for a project.
 *
 * @param {string} id - Project UUID
 * @param {{ authProviderUserId: string }} actor
 * @returns {{ id: string, deleted_at: Date, updated_by_user_id: string }}
 */
export function toSoftDelete(id, actor) {
  if (!id) {
    throw new TypeError('ProjectAdapter.toSoftDelete: id is required')
  }
  if (!actor?.authProviderUserId) {
    throw new TypeError('ProjectAdapter.toSoftDelete: actor.authProviderUserId is required')
  }
  return {
    id,
    deleted_at:         new Date(),
    updated_by_user_id: actor.authProviderUserId,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// project_pv_data (1:1 with projects)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a project_pv_data row to the app PvData model.
 *
 * @param {object} row
 * @returns {object}
 */
export function fromPvDataDb(row) {
  if (!row || typeof row !== 'object') {
    return null
  }

  return {
    id:                          row.id,
    project_id:                  row.project_id                  ?? null,
    consumo_kwh_mes:             row.consumo_kwh_mes             ?? null,
    potencia_modulo_wp:          row.potencia_modulo_wp          ?? null,
    numero_modulos:              row.numero_modulos              ?? null,
    tipo_rede:                   row.tipo_rede                   ?? null,
    potencia_sistema_kwp:        row.potencia_sistema_kwp        ?? null,
    geracao_estimada_kwh_mes:    row.geracao_estimada_kwh_mes    ?? null,
    area_utilizada_m2:           row.area_utilizada_m2           ?? null,
    modelo_modulo:               row.modelo_modulo               ?? null,
    modelo_inversor:             row.modelo_inversor             ?? null,
    created_at:                  row.created_at                  ?? null,
    updated_at:                  row.updated_at                  ?? null,
  }
}

/**
 * Map an app PvData model to a DB INSERT/UPDATE shape for project_pv_data.
 *
 * @param {object} pvModel
 * @returns {object} DB-ready object
 */
export function toPvDataDb(pvModel) {
  if (!pvModel || typeof pvModel !== 'object') {
    throw new TypeError('ProjectAdapter.toPvDataDb: pvModel must be a non-null object')
  }

  return {
    project_id:                 pvModel.project_id                  ?? null,
    consumo_kwh_mes:            pvModel.consumo_kwh_mes             ?? null,
    potencia_modulo_wp:         pvModel.potencia_modulo_wp          ?? null,
    numero_modulos:             pvModel.numero_modulos              ?? null,
    tipo_rede:                  pvModel.tipo_rede                   ?? null,
    potencia_sistema_kwp:       pvModel.potencia_sistema_kwp        ?? null,
    geracao_estimada_kwh_mes:   pvModel.geracao_estimada_kwh_mes    ?? null,
    area_utilizada_m2:          pvModel.area_utilizada_m2           ?? null,
    modelo_modulo:              pvModel.modelo_modulo               ?? null,
    modelo_inversor:            pvModel.modelo_inversor             ?? null,
  }
}
