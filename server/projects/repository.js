// server/projects/repository.js
// Database queries for the Projects (Projeto) entity.
// Reads from: projects, project_pv_data, clients, client_contracts, client_energy_profile.
// Writes to:  projects, project_pv_data, project_financial_link.
//
// Dynamic-filter queries use the sql(text, params) form (the Neon driver
// does not support nested sql`` fragments inside ternaries) — same pattern
// used in server/financial-management/repository.js.

import { isUuid } from './planMapper.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toNumberOrNull(value) {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function toIntOrNull(value) {
  const n = toNumberOrNull(value)
  return n === null ? null : Math.trunc(n)
}

function toTextOrNull(value) {
  if (value == null) return null
  const t = String(value).trim()
  return t.length ? t : null
}

function mapProjectRow(row) {
  if (!row) return null
  return {
    id: row.id,
    client_id: Number(row.client_id),
    plan_id: row.plan_id,
    contract_id: row.contract_id == null ? null : Number(row.contract_id),
    proposal_id: row.proposal_id,
    project_type: row.project_type,
    status: row.status,
    client_name_snapshot: row.client_name_snapshot,
    cpf_cnpj_snapshot: row.cpf_cnpj_snapshot,
    city_snapshot: row.city_snapshot,
    state_snapshot: row.state_snapshot,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by_user_id: row.created_by_user_id,
    updated_by_user_id: row.updated_by_user_id,
    deleted_at: row.deleted_at,
  }
}

function mapPvDataRow(row) {
  if (!row) return null
  return {
    id: row.id,
    project_id: row.project_id,
    consumo_kwh_mes: row.consumo_kwh_mes == null ? null : Number(row.consumo_kwh_mes),
    potencia_modulo_wp: row.potencia_modulo_wp == null ? null : Number(row.potencia_modulo_wp),
    numero_modulos: row.numero_modulos == null ? null : Number(row.numero_modulos),
    tipo_rede: row.tipo_rede,
    potencia_sistema_kwp: row.potencia_sistema_kwp == null ? null : Number(row.potencia_sistema_kwp),
    geracao_estimada_kwh_mes:
      row.geracao_estimada_kwh_mes == null ? null : Number(row.geracao_estimada_kwh_mes),
    area_utilizada_m2: row.area_utilizada_m2 == null ? null : Number(row.area_utilizada_m2),
    modelo_modulo: row.modelo_modulo,
    modelo_inversor: row.modelo_inversor,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries — projects
// ─────────────────────────────────────────────────────────────────────────────

export async function findProjectByPlanId(sql, planId) {
  const rows = await sql`
    SELECT
      id::text,
      client_id,
      plan_id,
      contract_id,
      proposal_id::text,
      project_type,
      status,
      client_name_snapshot,
      cpf_cnpj_snapshot,
      city_snapshot,
      state_snapshot,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id,
      deleted_at
    FROM projects
    WHERE plan_id = ${String(planId)}
      AND deleted_at IS NULL
    LIMIT 1
  `
  return mapProjectRow(rows[0])
}

export async function findProjectById(sql, projectId) {
  const rows = await sql`
    SELECT
      id::text,
      client_id,
      plan_id,
      contract_id,
      proposal_id::text,
      project_type,
      status,
      client_name_snapshot,
      cpf_cnpj_snapshot,
      city_snapshot,
      state_snapshot,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id,
      deleted_at
    FROM projects
    WHERE id = ${String(projectId)}::uuid
      AND deleted_at IS NULL
    LIMIT 1
  `
  return mapProjectRow(rows[0])
}

export async function insertProject(sql, fields, userId = null) {
  const rows = await sql`
    INSERT INTO projects (
      client_id,
      plan_id,
      contract_id,
      proposal_id,
      project_type,
      status,
      client_name_snapshot,
      cpf_cnpj_snapshot,
      city_snapshot,
      state_snapshot,
      created_by_user_id,
      updated_by_user_id
    ) VALUES (
      ${fields.client_id},
      ${fields.plan_id},
      ${fields.contract_id},
      ${fields.proposal_id}::uuid,
      ${fields.project_type},
      ${fields.status},
      ${fields.client_name_snapshot},
      ${fields.cpf_cnpj_snapshot},
      ${fields.city_snapshot},
      ${fields.state_snapshot},
      ${userId},
      ${userId}
    )
    RETURNING
      id::text,
      client_id,
      plan_id,
      contract_id,
      proposal_id::text,
      project_type,
      status,
      client_name_snapshot,
      cpf_cnpj_snapshot,
      city_snapshot,
      state_snapshot,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id,
      deleted_at
  `
  return mapProjectRow(rows[0])
}

/**
 * Reads the plan snapshot for a contract_id. Returns null if the contract
 * does not exist, or if the referenced client is deleted.
 */
export async function getPlanSnapshotFromContract(sql, contractId) {
  const rows = await sql`
    SELECT
      cc.id                     AS contract_id,
      cc.contract_type,
      cc.source_proposal_id,
      c.id                      AS client_id,
      c.client_name             AS client_name,
      c.client_document         AS cpf_cnpj,
      c.client_city             AS city,
      c.client_state            AS state
    FROM client_contracts cc
    JOIN clients c ON c.id = cc.client_id
    WHERE cc.id = ${Number(contractId)}
      AND c.deleted_at IS NULL
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return null

  // source_proposal_id is stored as TEXT (may or may not be a UUID).
  const proposalId = isUuid(row.source_proposal_id) ? row.source_proposal_id : null

  return {
    client_id: Number(row.client_id),
    plan_id: `contract:${row.contract_id}`,
    contract_id: Number(row.contract_id),
    proposal_id: proposalId,
    contract_type: row.contract_type,
    client_name: row.client_name,
    cpf_cnpj: row.cpf_cnpj,
    city: row.city,
    state: row.state,
  }
}

export async function updateProject(sql, projectId, fields, userId = null) {
  // Only a controlled subset of fields is writable via PATCH.
  const rows = await sql`
    UPDATE projects SET
      client_name_snapshot = COALESCE(${fields.client_name_snapshot ?? null}, client_name_snapshot),
      cpf_cnpj_snapshot    = COALESCE(${fields.cpf_cnpj_snapshot ?? null},    cpf_cnpj_snapshot),
      city_snapshot        = COALESCE(${fields.city_snapshot ?? null},        city_snapshot),
      state_snapshot       = COALESCE(${fields.state_snapshot ?? null},       state_snapshot),
      proposal_id          = COALESCE(${fields.proposal_id ?? null}::uuid,    proposal_id),
      updated_by_user_id   = ${userId}
    WHERE id = ${String(projectId)}::uuid
      AND deleted_at IS NULL
    RETURNING
      id::text,
      client_id,
      plan_id,
      contract_id,
      proposal_id::text,
      project_type,
      status,
      client_name_snapshot,
      cpf_cnpj_snapshot,
      city_snapshot,
      state_snapshot,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id,
      deleted_at
  `
  return mapProjectRow(rows[0])
}

export async function updateProjectStatus(sql, projectId, status, userId = null) {
  const rows = await sql`
    UPDATE projects SET
      status             = ${status},
      updated_by_user_id = ${userId}
    WHERE id = ${String(projectId)}::uuid
      AND deleted_at IS NULL
    RETURNING
      id::text,
      client_id,
      plan_id,
      contract_id,
      proposal_id::text,
      project_type,
      status,
      client_name_snapshot,
      cpf_cnpj_snapshot,
      city_snapshot,
      state_snapshot,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id,
      deleted_at
  `
  return mapProjectRow(rows[0])
}

/**
 * Paginated project listing with optional search (name / document / city)
 * and type/status filters. Ordered by updated_at DESC by default.
 */
export async function listProjects(sql, filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200)
  const offset = Math.max(Number(filters.offset) || 0, 0)

  const conditions = ['p.deleted_at IS NULL']
  const params = []

  if (filters.project_type) {
    params.push(filters.project_type)
    conditions.push(`p.project_type = $${params.length}`)
  }
  if (filters.status) {
    params.push(filters.status)
    conditions.push(`p.status = $${params.length}`)
  }
  if (filters.client_id) {
    params.push(Number(filters.client_id))
    conditions.push(`p.client_id = $${params.length}`)
  }
  if (filters.search) {
    params.push(`%${filters.search}%`)
    const idx = params.length
    conditions.push(
      `(p.client_name_snapshot ILIKE $${idx} OR p.cpf_cnpj_snapshot ILIKE $${idx} OR p.city_snapshot ILIKE $${idx})`,
    )
  }

  // Whitelist ORDER BY via a static mapping — avoids ANY string
  // interpolation of caller-supplied values into the SQL text.
  const ORDER_BY_SQL = Object.freeze({
    updated_at: 'p.updated_at',
    created_at: 'p.created_at',
    client_name: 'p.client_name_snapshot',
  })
  const orderCol = ORDER_BY_SQL[filters.order_by] ? filters.order_by : 'updated_at'
  const orderColSql = ORDER_BY_SQL[orderCol]
  const orderDir = filters.order_dir === 'asc' ? 'ASC' : 'DESC'
  const orderSql = `${orderColSql} ${orderDir} NULLS LAST`

  params.push(limit)
  const limitIdx = params.length
  params.push(offset)
  const offsetIdx = params.length

  const queryText = `
    SELECT
      p.id::text,
      p.client_id,
      p.plan_id,
      p.contract_id,
      p.proposal_id::text,
      p.project_type,
      p.status,
      p.client_name_snapshot,
      p.cpf_cnpj_snapshot,
      p.city_snapshot,
      p.state_snapshot,
      p.created_at,
      p.updated_at,
      p.created_by_user_id,
      p.updated_by_user_id,
      p.deleted_at,
      COUNT(*) OVER() AS total_count
    FROM projects p
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${orderSql}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `

  const rows = await sql(queryText, params)
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0
  return {
    rows: rows.map(mapProjectRow),
    total,
    limit,
    offset,
  }
}

export async function getProjectSummary(sql) {
  const rows = await sql`
    SELECT project_type, status, COUNT(*)::int AS count
    FROM projects
    WHERE deleted_at IS NULL
    GROUP BY project_type, status
  `

  const by_status = { Aguardando: 0, 'Em andamento': 0, Concluído: 0 }
  const by_type = { leasing: 0, venda: 0 }
  let total = 0

  for (const row of rows) {
    const count = Number(row.count) || 0
    total += count
    if (row.status in by_status) by_status[row.status] += count
    if (row.project_type in by_type) by_type[row.project_type] += count
  }

  return { total, by_status, by_type }
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries — project_pv_data
// ─────────────────────────────────────────────────────────────────────────────

export async function findPvDataByProjectId(sql, projectId) {
  const rows = await sql`
    SELECT
      id::text,
      project_id::text,
      consumo_kwh_mes,
      potencia_modulo_wp,
      numero_modulos,
      tipo_rede,
      potencia_sistema_kwp,
      geracao_estimada_kwh_mes,
      area_utilizada_m2,
      modelo_modulo,
      modelo_inversor,
      created_at,
      updated_at
    FROM project_pv_data
    WHERE project_id = ${String(projectId)}::uuid
    LIMIT 1
  `
  return mapPvDataRow(rows[0])
}

export async function upsertPvData(sql, projectId, fields) {
  const normalized = {
    consumo_kwh_mes: toNumberOrNull(fields.consumo_kwh_mes),
    potencia_modulo_wp: toNumberOrNull(fields.potencia_modulo_wp),
    numero_modulos: toIntOrNull(fields.numero_modulos),
    tipo_rede: toTextOrNull(fields.tipo_rede),
    potencia_sistema_kwp: toNumberOrNull(fields.potencia_sistema_kwp),
    geracao_estimada_kwh_mes: toNumberOrNull(fields.geracao_estimada_kwh_mes),
    area_utilizada_m2: toNumberOrNull(fields.area_utilizada_m2),
    modelo_modulo: toTextOrNull(fields.modelo_modulo),
    modelo_inversor: toTextOrNull(fields.modelo_inversor),
  }

  const rows = await sql`
    INSERT INTO project_pv_data (
      project_id,
      consumo_kwh_mes,
      potencia_modulo_wp,
      numero_modulos,
      tipo_rede,
      potencia_sistema_kwp,
      geracao_estimada_kwh_mes,
      area_utilizada_m2,
      modelo_modulo,
      modelo_inversor
    ) VALUES (
      ${String(projectId)}::uuid,
      ${normalized.consumo_kwh_mes},
      ${normalized.potencia_modulo_wp},
      ${normalized.numero_modulos},
      ${normalized.tipo_rede},
      ${normalized.potencia_sistema_kwp},
      ${normalized.geracao_estimada_kwh_mes},
      ${normalized.area_utilizada_m2},
      ${normalized.modelo_modulo},
      ${normalized.modelo_inversor}
    )
    ON CONFLICT (project_id) DO UPDATE SET
      consumo_kwh_mes           = COALESCE(EXCLUDED.consumo_kwh_mes,           project_pv_data.consumo_kwh_mes),
      potencia_modulo_wp        = COALESCE(EXCLUDED.potencia_modulo_wp,        project_pv_data.potencia_modulo_wp),
      numero_modulos            = COALESCE(EXCLUDED.numero_modulos,            project_pv_data.numero_modulos),
      tipo_rede                 = COALESCE(EXCLUDED.tipo_rede,                 project_pv_data.tipo_rede),
      potencia_sistema_kwp      = COALESCE(EXCLUDED.potencia_sistema_kwp,      project_pv_data.potencia_sistema_kwp),
      geracao_estimada_kwh_mes  = COALESCE(EXCLUDED.geracao_estimada_kwh_mes,  project_pv_data.geracao_estimada_kwh_mes),
      area_utilizada_m2         = COALESCE(EXCLUDED.area_utilizada_m2,         project_pv_data.area_utilizada_m2),
      modelo_modulo             = COALESCE(EXCLUDED.modelo_modulo,             project_pv_data.modelo_modulo),
      modelo_inversor           = COALESCE(EXCLUDED.modelo_inversor,           project_pv_data.modelo_inversor)
    RETURNING
      id::text,
      project_id::text,
      consumo_kwh_mes,
      potencia_modulo_wp,
      numero_modulos,
      tipo_rede,
      potencia_sistema_kwp,
      geracao_estimada_kwh_mes,
      area_utilizada_m2,
      modelo_modulo,
      modelo_inversor,
      created_at,
      updated_at
  `
  return mapPvDataRow(rows[0])
}

/**
 * Seeds the PV-data row from existing client_energy_profile + clients data
 * captured during portfolio operations. No-op if a PV-data row already
 * exists for this project.
 */
export async function seedPvDataFromClient(sql, projectId, clientId) {
  const existing = await findPvDataByProjectId(sql, projectId)
  if (existing) return existing

  const rows = await sql`
    SELECT
      c.consumption_kwh_month   AS consumo_kwh_mes,
      c.system_kwp              AS potencia_sistema_kwp,
      ep.potencia_kwp           AS energy_potencia_kwp,
      ep.tipo_rede              AS tipo_rede,
      ep.kwh_contratado         AS consumo_contratado,
      ep.marca_inversor         AS modelo_inversor
    FROM clients c
    LEFT JOIN client_energy_profile ep ON ep.client_id = c.id
    WHERE c.id = ${Number(clientId)}
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return null

  return upsertPvData(sql, projectId, {
    consumo_kwh_mes: row.consumo_kwh_mes ?? row.consumo_contratado,
    tipo_rede: row.tipo_rede,
    potencia_sistema_kwp: row.potencia_sistema_kwp ?? row.energy_potencia_kwp,
    modelo_inversor: row.modelo_inversor,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Backfill helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns contracts that represent effectivated plans (status active/completed
 * and not draft) which do NOT yet have an associated project.
 */
export async function listEffectivatedContractsWithoutProject(sql) {
  const rows = await sql`
    SELECT
      cc.id                     AS contract_id,
      cc.contract_type,
      cc.source_proposal_id,
      cc.contract_status,
      c.id                      AS client_id,
      c.client_name,
      c.client_document         AS cpf_cnpj,
      c.client_city             AS city,
      c.client_state            AS state
    FROM client_contracts cc
    JOIN clients c ON c.id = cc.client_id
    LEFT JOIN projects p
      ON p.contract_id = cc.id
     AND p.deleted_at IS NULL
    WHERE c.deleted_at IS NULL
      AND cc.contract_status IN ('active','completed')
      AND p.id IS NULL
    ORDER BY cc.id ASC
  `
  return rows
}
