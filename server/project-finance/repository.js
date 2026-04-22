// server/project-finance/repository.js
// Database queries for project_financial_profiles.
// Reads from: project_financial_profiles, projects, client_contracts, clients.
// Writes to:  project_financial_profiles.

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

// Canonical contract_type → profile contract_type mapping.
// client_contracts uses 'leasing' | 'sale' | 'buyout'.
// project_financial_profiles stores 'leasing' | 'venda'.
function resolveContractType(contractType, projectType) {
  // Priority: contractType from client_contracts first
  if (contractType === 'leasing') return 'leasing'
  if (contractType === 'sale' || contractType === 'buyout') return 'venda'
  // Fallback to project_type
  if (projectType === 'leasing') return 'leasing'
  if (projectType === 'venda') return 'venda'
  return 'leasing'
}

function mapProfileRow(row) {
  if (!row) return null
  return {
    id: row.id,
    project_id: row.project_id,
    client_id: row.client_id == null ? null : Number(row.client_id),
    contract_type: row.contract_type,
    status: row.status,
    snapshot_source: row.snapshot_source,

    // Technical
    consumo_kwh_mes: row.consumo_kwh_mes == null ? null : Number(row.consumo_kwh_mes),
    potencia_instalada_kwp: row.potencia_instalada_kwp == null ? null : Number(row.potencia_instalada_kwp),
    geracao_estimada_kwh_mes: row.geracao_estimada_kwh_mes == null ? null : Number(row.geracao_estimada_kwh_mes),
    prazo_contratual_meses: row.prazo_contratual_meses == null ? null : Number(row.prazo_contratual_meses),

    // Costs
    custo_equipamentos: row.custo_equipamentos == null ? null : Number(row.custo_equipamentos),
    custo_instalacao: row.custo_instalacao == null ? null : Number(row.custo_instalacao),
    custo_engenharia: row.custo_engenharia == null ? null : Number(row.custo_engenharia),
    custo_homologacao: row.custo_homologacao == null ? null : Number(row.custo_homologacao),
    custo_frete_logistica: row.custo_frete_logistica == null ? null : Number(row.custo_frete_logistica),
    custo_comissao: row.custo_comissao == null ? null : Number(row.custo_comissao),
    custo_impostos: row.custo_impostos == null ? null : Number(row.custo_impostos),
    custo_diversos: row.custo_diversos == null ? null : Number(row.custo_diversos),
    custo_total_projeto: row.custo_total_projeto == null ? null : Number(row.custo_total_projeto),

    // Revenue
    receita_esperada: row.receita_esperada == null ? null : Number(row.receita_esperada),
    lucro_esperado: row.lucro_esperado == null ? null : Number(row.lucro_esperado),
    margem_esperada_pct: row.margem_esperada_pct == null ? null : Number(row.margem_esperada_pct),

    // Leasing-specific
    mensalidade_base: row.mensalidade_base == null ? null : Number(row.mensalidade_base),
    desconto_percentual: row.desconto_percentual == null ? null : Number(row.desconto_percentual),
    reajuste_anual_pct: row.reajuste_anual_pct == null ? null : Number(row.reajuste_anual_pct),
    inadimplencia_pct: row.inadimplencia_pct == null ? null : Number(row.inadimplencia_pct),
    opex_pct: row.opex_pct == null ? null : Number(row.opex_pct),
    custo_seguro: row.custo_seguro == null ? null : Number(row.custo_seguro),
    custo_manutencao: row.custo_manutencao == null ? null : Number(row.custo_manutencao),

    // Venda-specific
    valor_venda: row.valor_venda == null ? null : Number(row.valor_venda),
    entrada_pct: row.entrada_pct == null ? null : Number(row.entrada_pct),
    parcelamento_meses: row.parcelamento_meses == null ? null : Number(row.parcelamento_meses),
    custo_financeiro_pct: row.custo_financeiro_pct == null ? null : Number(row.custo_financeiro_pct),

    // KPIs
    payback_meses: row.payback_meses == null ? null : Number(row.payback_meses),
    roi_pct: row.roi_pct == null ? null : Number(row.roi_pct),
    tir_pct: row.tir_pct == null ? null : Number(row.tir_pct),
    vpl: row.vpl == null ? null : Number(row.vpl),

    notas: row.notas,
    last_calculated_at: row.last_calculated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by_user_id: row.created_by_user_id,
    updated_by_user_id: row.updated_by_user_id,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export async function findProjectFinanceByProjectId(sql, projectId) {
  const rows = await sql`
    SELECT
      pfp.id::text,
      pfp.project_id::text,
      pfp.client_id,
      pfp.contract_type,
      pfp.status,
      pfp.snapshot_source,
      pfp.consumo_kwh_mes,
      pfp.potencia_instalada_kwp,
      pfp.geracao_estimada_kwh_mes,
      pfp.prazo_contratual_meses,
      pfp.custo_equipamentos,
      pfp.custo_instalacao,
      pfp.custo_engenharia,
      pfp.custo_homologacao,
      pfp.custo_frete_logistica,
      pfp.custo_comissao,
      pfp.custo_impostos,
      pfp.custo_diversos,
      pfp.custo_total_projeto,
      pfp.receita_esperada,
      pfp.lucro_esperado,
      pfp.margem_esperada_pct,
      pfp.mensalidade_base,
      pfp.desconto_percentual,
      pfp.reajuste_anual_pct,
      pfp.inadimplencia_pct,
      pfp.opex_pct,
      pfp.custo_seguro,
      pfp.custo_manutencao,
      pfp.valor_venda,
      pfp.entrada_pct,
      pfp.parcelamento_meses,
      pfp.custo_financeiro_pct,
      pfp.payback_meses,
      pfp.roi_pct,
      pfp.tir_pct,
      pfp.vpl,
      pfp.notas,
      pfp.last_calculated_at,
      pfp.created_at,
      pfp.updated_at,
      pfp.created_by_user_id,
      pfp.updated_by_user_id
    FROM project_financial_profiles pfp
    WHERE pfp.project_id = ${String(projectId)}::uuid
      AND pfp.status != 'archived'
    ORDER BY pfp.updated_at DESC
    LIMIT 1
  `
  return mapProfileRow(rows[0])
}

/**
 * Resolves the contract type for a project by joining with client_contracts
 * and falling back to the project's own project_type.
 */
export async function resolveProjectContractType(sql, projectId) {
  const rows = await sql`
    SELECT
      p.project_type,
      cc.contract_type
    FROM projects p
    LEFT JOIN client_contracts cc ON cc.id = p.contract_id
    WHERE p.id = ${String(projectId)}::uuid
      AND p.deleted_at IS NULL
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return resolveContractType(row.contract_type, row.project_type)
}

/**
 * Upserts the financial profile for a project.
 * On conflict (same project_id, non-archived) updates all editable fields.
 * Derived fields (custo_total_projeto, lucro_esperado, margem_esperada_pct)
 * are computed server-side from the submitted values.
 */
export async function upsertProjectFinance(sql, projectId, fields, userId = null) {
  // Normalise all numeric inputs
  const f = {
    contract_type: ['leasing', 'venda'].includes(fields.contract_type) ? fields.contract_type : 'leasing',
    status: ['draft', 'active', 'archived'].includes(fields.status) ? fields.status : 'draft',
    snapshot_source: toTextOrNull(fields.snapshot_source) ?? 'manual',
    client_id: toIntOrNull(fields.client_id),

    consumo_kwh_mes: toNumberOrNull(fields.consumo_kwh_mes),
    potencia_instalada_kwp: toNumberOrNull(fields.potencia_instalada_kwp),
    geracao_estimada_kwh_mes: toNumberOrNull(fields.geracao_estimada_kwh_mes),
    prazo_contratual_meses: toIntOrNull(fields.prazo_contratual_meses),

    custo_equipamentos: toNumberOrNull(fields.custo_equipamentos),
    custo_instalacao: toNumberOrNull(fields.custo_instalacao),
    custo_engenharia: toNumberOrNull(fields.custo_engenharia),
    custo_homologacao: toNumberOrNull(fields.custo_homologacao),
    custo_frete_logistica: toNumberOrNull(fields.custo_frete_logistica),
    custo_comissao: toNumberOrNull(fields.custo_comissao),
    custo_impostos: toNumberOrNull(fields.custo_impostos),
    custo_diversos: toNumberOrNull(fields.custo_diversos),

    receita_esperada: toNumberOrNull(fields.receita_esperada),

    mensalidade_base: toNumberOrNull(fields.mensalidade_base),
    desconto_percentual: toNumberOrNull(fields.desconto_percentual),
    reajuste_anual_pct: toNumberOrNull(fields.reajuste_anual_pct),
    inadimplencia_pct: toNumberOrNull(fields.inadimplencia_pct),
    opex_pct: toNumberOrNull(fields.opex_pct),
    custo_seguro: toNumberOrNull(fields.custo_seguro),
    custo_manutencao: toNumberOrNull(fields.custo_manutencao),

    valor_venda: toNumberOrNull(fields.valor_venda),
    entrada_pct: toNumberOrNull(fields.entrada_pct),
    parcelamento_meses: toIntOrNull(fields.parcelamento_meses),
    custo_financeiro_pct: toNumberOrNull(fields.custo_financeiro_pct),

    payback_meses: toNumberOrNull(fields.payback_meses),
    roi_pct: toNumberOrNull(fields.roi_pct),
    tir_pct: toNumberOrNull(fields.tir_pct),
    vpl: toNumberOrNull(fields.vpl),

    notas: toTextOrNull(fields.notas),
  }

  // Derive custo_total_projeto server-side
  const costFields = [
    f.custo_equipamentos,
    f.custo_instalacao,
    f.custo_engenharia,
    f.custo_homologacao,
    f.custo_frete_logistica,
    f.custo_comissao,
    f.custo_impostos,
    f.custo_diversos,
  ]
  const anyNonNull = costFields.some((v) => v != null)
  const custo_total_projeto = anyNonNull
    ? costFields.reduce((sum, v) => sum + (v ?? 0), 0)
    : null

  // Derive lucro_esperado and margem_esperada_pct
  let lucro_esperado = null
  let margem_esperada_pct = null
  if (f.receita_esperada != null && custo_total_projeto != null) {
    lucro_esperado = f.receita_esperada - custo_total_projeto
    if (f.receita_esperada > 0) {
      margem_esperada_pct = (lucro_esperado / f.receita_esperada) * 100
    }
  }

  const rows = await sql`
    INSERT INTO project_financial_profiles (
      project_id,
      client_id,
      contract_type,
      status,
      snapshot_source,
      consumo_kwh_mes,
      potencia_instalada_kwp,
      geracao_estimada_kwh_mes,
      prazo_contratual_meses,
      custo_equipamentos,
      custo_instalacao,
      custo_engenharia,
      custo_homologacao,
      custo_frete_logistica,
      custo_comissao,
      custo_impostos,
      custo_diversos,
      custo_total_projeto,
      receita_esperada,
      lucro_esperado,
      margem_esperada_pct,
      mensalidade_base,
      desconto_percentual,
      reajuste_anual_pct,
      inadimplencia_pct,
      opex_pct,
      custo_seguro,
      custo_manutencao,
      valor_venda,
      entrada_pct,
      parcelamento_meses,
      custo_financeiro_pct,
      payback_meses,
      roi_pct,
      tir_pct,
      vpl,
      notas,
      last_calculated_at,
      created_by_user_id,
      updated_by_user_id
    ) VALUES (
      ${String(projectId)}::uuid,
      ${f.client_id},
      ${f.contract_type},
      ${f.status},
      ${f.snapshot_source},
      ${f.consumo_kwh_mes},
      ${f.potencia_instalada_kwp},
      ${f.geracao_estimada_kwh_mes},
      ${f.prazo_contratual_meses},
      ${f.custo_equipamentos},
      ${f.custo_instalacao},
      ${f.custo_engenharia},
      ${f.custo_homologacao},
      ${f.custo_frete_logistica},
      ${f.custo_comissao},
      ${f.custo_impostos},
      ${f.custo_diversos},
      ${custo_total_projeto},
      ${f.receita_esperada},
      ${lucro_esperado},
      ${margem_esperada_pct},
      ${f.mensalidade_base},
      ${f.desconto_percentual},
      ${f.reajuste_anual_pct},
      ${f.inadimplencia_pct},
      ${f.opex_pct},
      ${f.custo_seguro},
      ${f.custo_manutencao},
      ${f.valor_venda},
      ${f.entrada_pct},
      ${f.parcelamento_meses},
      ${f.custo_financeiro_pct},
      ${f.payback_meses},
      ${f.roi_pct},
      ${f.tir_pct},
      ${f.vpl},
      ${f.notas},
      now(),
      ${userId},
      ${userId}
    )
    ON CONFLICT ON CONSTRAINT pfp_project_id_unique
    DO UPDATE SET
      client_id                = EXCLUDED.client_id,
      contract_type            = EXCLUDED.contract_type,
      status                   = EXCLUDED.status,
      snapshot_source          = EXCLUDED.snapshot_source,
      consumo_kwh_mes          = EXCLUDED.consumo_kwh_mes,
      potencia_instalada_kwp   = EXCLUDED.potencia_instalada_kwp,
      geracao_estimada_kwh_mes = EXCLUDED.geracao_estimada_kwh_mes,
      prazo_contratual_meses   = EXCLUDED.prazo_contratual_meses,
      custo_equipamentos       = EXCLUDED.custo_equipamentos,
      custo_instalacao         = EXCLUDED.custo_instalacao,
      custo_engenharia         = EXCLUDED.custo_engenharia,
      custo_homologacao        = EXCLUDED.custo_homologacao,
      custo_frete_logistica    = EXCLUDED.custo_frete_logistica,
      custo_comissao           = EXCLUDED.custo_comissao,
      custo_impostos           = EXCLUDED.custo_impostos,
      custo_diversos           = EXCLUDED.custo_diversos,
      custo_total_projeto      = EXCLUDED.custo_total_projeto,
      receita_esperada         = EXCLUDED.receita_esperada,
      lucro_esperado           = EXCLUDED.lucro_esperado,
      margem_esperada_pct      = EXCLUDED.margem_esperada_pct,
      mensalidade_base         = EXCLUDED.mensalidade_base,
      desconto_percentual      = EXCLUDED.desconto_percentual,
      reajuste_anual_pct       = EXCLUDED.reajuste_anual_pct,
      inadimplencia_pct        = EXCLUDED.inadimplencia_pct,
      opex_pct                 = EXCLUDED.opex_pct,
      custo_seguro             = EXCLUDED.custo_seguro,
      custo_manutencao         = EXCLUDED.custo_manutencao,
      valor_venda              = EXCLUDED.valor_venda,
      entrada_pct              = EXCLUDED.entrada_pct,
      parcelamento_meses       = EXCLUDED.parcelamento_meses,
      custo_financeiro_pct     = EXCLUDED.custo_financeiro_pct,
      payback_meses            = EXCLUDED.payback_meses,
      roi_pct                  = EXCLUDED.roi_pct,
      tir_pct                  = EXCLUDED.tir_pct,
      vpl                      = EXCLUDED.vpl,
      notas                    = EXCLUDED.notas,
      last_calculated_at       = now(),
      updated_by_user_id       = EXCLUDED.updated_by_user_id
    RETURNING
      id::text,
      project_id::text,
      client_id,
      contract_type,
      status,
      snapshot_source,
      consumo_kwh_mes,
      potencia_instalada_kwp,
      geracao_estimada_kwh_mes,
      prazo_contratual_meses,
      custo_equipamentos,
      custo_instalacao,
      custo_engenharia,
      custo_homologacao,
      custo_frete_logistica,
      custo_comissao,
      custo_impostos,
      custo_diversos,
      custo_total_projeto,
      receita_esperada,
      lucro_esperado,
      margem_esperada_pct,
      mensalidade_base,
      desconto_percentual,
      reajuste_anual_pct,
      inadimplencia_pct,
      opex_pct,
      custo_seguro,
      custo_manutencao,
      valor_venda,
      entrada_pct,
      parcelamento_meses,
      custo_financeiro_pct,
      payback_meses,
      roi_pct,
      tir_pct,
      vpl,
      notas,
      last_calculated_at,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id
  `
  return mapProfileRow(rows[0])
}
