// src/features/project-finance/types.ts
// Domain types for the project financial profile.

export type ProjectFinanceContractType = 'leasing' | 'venda'
export type ProjectFinanceStatus = 'draft' | 'active' | 'archived'

// ─── Override types ──────────────────────────────────────────────────────────

/**
 * Auto-computable fields that can be manually overridden.
 * System sizing (potencia, geracao) is NOT overrideable here —
 * those values come read-only from the Usina Fotovoltaica (ProjectPvData).
 */
export type OverridableField =
  | 'payback_meses'
  | 'roi_pct'
  | 'tir_pct'
  | 'vpl'

export type ProjectFinanceOverrides = Partial<Record<OverridableField, number | null>>

// ─── Optional technical parameters used by the shared engine ─────────────────

export interface ProjectFinanceTechnicalParams {
  irradiacao_kwh_m2_dia?: number
  performance_ratio?: number
  dias_mes?: number
  potencia_modulo_wp?: number
  taxa_desconto_aa_pct?: number
  /**
   * Tax rate applied to gross revenue before computing net cash flows.
   * Mirrors the `impostos_percent` field in AnaliseFinanceiraInput so that
   * the project finance form uses the exact same calculation methodology.
   */
  impostos_percent?: number
}

// ─── Auto-computed result from the shared engine ─────────────────────────────

/** KPI fields computed by the shared engine. Overrideable via manual entry. */
export interface ProjectFinanceComputed {
  payback_meses: number | null
  roi_pct: number | null
  tir_pct: number | null
  vpl: number | null
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface ProjectFinanceProfile {
  id: string
  project_id: string
  client_id: number | null
  contract_type: ProjectFinanceContractType
  status: ProjectFinanceStatus
  snapshot_source: string

  // Technical
  consumo_kwh_mes: number | null
  potencia_instalada_kwp: number | null
  geracao_estimada_kwh_mes: number | null
  prazo_contratual_meses: number | null

  // Costs
  custo_equipamentos: number | null
  custo_instalacao: number | null
  custo_engenharia: number | null
  custo_homologacao: number | null
  custo_frete_logistica: number | null
  custo_comissao: number | null
  custo_impostos: number | null
  custo_diversos: number | null
  custo_total_projeto: number | null

  // Revenue
  receita_esperada: number | null
  lucro_esperado: number | null
  margem_esperada_pct: number | null

  // Leasing-specific
  mensalidade_base: number | null
  desconto_percentual: number | null
  reajuste_anual_pct: number | null
  inadimplencia_pct: number | null
  opex_pct: number | null
  custo_seguro: number | null
  custo_manutencao: number | null

  // Venda-specific
  valor_venda: number | null
  entrada_pct: number | null
  parcelamento_meses: number | null
  custo_financeiro_pct: number | null

  // KPIs (stored for display; auto-computed from engine on save)
  payback_meses: number | null
  roi_pct: number | null
  tir_pct: number | null
  vpl: number | null

  notas: string | null
  last_calculated_at: string | null
  created_at: string
  updated_at: string
  created_by_user_id: string | null
  updated_by_user_id: string | null

  // Override / technical params (migration 0048)
  override_payload_json: ProjectFinanceOverrides | null
  technical_params_json: ProjectFinanceTechnicalParams | null
}

/** Fields that can be submitted in a PUT /api/projects/:id/finance */
export type ProjectFinanceFormState = Partial<Omit<ProjectFinanceProfile,
  | 'id' | 'project_id' | 'custo_total_projeto' | 'lucro_esperado' | 'margem_esperada_pct'
  | 'last_calculated_at' | 'created_at' | 'updated_at' | 'created_by_user_id' | 'updated_by_user_id'
>>

/** Summary KPIs shown in the collapsed card */
export interface ProjectFinanceSummaryKPIs {
  custo_total_projeto: number | null
  receita_esperada: number | null
  lucro_esperado: number | null
  margem_esperada_pct: number | null
  payback_meses: number | null
  roi_pct: number | null
  contract_type: ProjectFinanceContractType
  status: ProjectFinanceStatus
  updated_at: string | null
}

/** Shape returned by GET /api/projects/:id/finance */
export interface ProjectFinanceGetResponse {
  profile: ProjectFinanceProfile | null
  contract_type: ProjectFinanceContractType
  /** Contractual term in months, sourced from client_contracts. Readonly. */
  contract_term_months: number | null
  project_id: string
}
