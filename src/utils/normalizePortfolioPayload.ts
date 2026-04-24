// src/utils/normalizePortfolioPayload.ts
// Normalises the raw payload from GET /api/client-portfolio/:id into the
// canonical PortfolioClientRow shape consumed by every portfolio tab/form.
//
// ═══════════════════════════════════════════════════════════════════════════
// PORTFOLIO REHYDRATION RULE (Etapa 2.4)
// ═══════════════════════════════════════════════════════════════════════════
// This is the SINGLE source of truth for transforming the portfolio API
// response into UI form state. All portfolio tabs consume its output.
//
// PRIORITY CHAIN (mandatory):
//   1. Top-level field explicitly returned by the API
//   2. Derived / structural alias (e.g. usina_potencia_modulo_wp)
//   3. metadata.* as a last-resort fallback
//   4. UI default (null / empty)
//
// PROHIBITED SOURCES (never use for portfolio hydration):
//   - latest_proposal_profile (proposal data ≠ portfolio data)
//   - /api/clients/:id responses
//   - /api/clients?page=... listing responses
//
// When energy_profile is null the UI must show empty fields — never
// substitute with proposal-derived values.
// ═══════════════════════════════════════════════════════════════════════════

import type { PortfolioClientRow, ContractAttachment } from '../types/clientPortfolio'

/** Shape of the raw API row (superset — may contain aliases + metadata blob). */
interface RawPortfolioRow extends Partial<PortfolioClientRow> {
  metadata?: Record<string, unknown> | null
  // Aliases produced by the SQL query (usina_* prefixed columns)
  usina_potencia_modulo_wp?: number | null
  usina_numero_modulos?: number | null
  usina_modelo_modulo?: string | null
  usina_modelo_inversor?: string | null
  usina_tipo_instalacao?: string | null
  usina_area_instalacao_m2?: number | null
  usina_geracao_estimada_kwh?: number | null
  usina_valordemercado?: number | null
  // Energy-profile alias used for plano leasing
  kwh_contratado?: number | null
  marca_inversor?: string | null
  // Raw JSONB from DB before parsing
  contract_attachments_json?: ContractAttachment[] | null
}

/**
 * Return the first non-null / non-undefined value from the candidates list.
 * Treats empty strings as valid values (not fallback-worthy) — only null/undefined skip.
 */
function first<T>(...candidates: Array<T | null | undefined>): T | null {
  for (const v of candidates) {
    if (v !== null && v !== undefined) return v
  }
  return null
}

/**
 * Coerce a raw DB value to a finite number.
 *
 * PostgreSQL `numeric` / `float8` columns are returned as **strings** by
 * node-postgres unless a custom type-parser is configured. This helper
 * converts those strings (and proper JS numbers) to `number`, returning
 * `null` for anything that is absent or cannot be parsed as a finite
 * number.
 */
function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Safely read a metadata value and cast it to the expected primitive type.
 * Returns null when the key is absent, null, or undefined in metadata.
 */
function metaNum(meta: Record<string, unknown>, key: string): number | null {
  const v = meta[key]
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function metaStr(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key]
  if (v == null) return null
  return typeof v === 'string' ? v : null
}

/**
 * Normalise a raw API response row into a clean PortfolioClientRow.
 *
 * The returned object is safe to spread directly into any tab's local form
 * state without further priority-resolution logic.
 */
export function normalizePortfolioClientPayload(raw: RawPortfolioRow): PortfolioClientRow {
  const meta: Record<string, unknown> = (raw.metadata && typeof raw.metadata === 'object') ? raw.metadata : {}

  // ── Core client fields (always from top-level) ──
  const base: PortfolioClientRow = {
    id: raw.id!,
    name: raw.name ?? null,
    metadata: raw.metadata ?? null,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    address: raw.address ?? null,
    document: raw.document ?? null,
    document_type: raw.document_type ?? null,
    consumption_kwh_month: raw.consumption_kwh_month ?? null,
    system_kwp: raw.system_kwp ?? null,
    term_months: raw.term_months ?? null,
    distribuidora: raw.distribuidora ?? null,
    uc: raw.uc ?? null,
    uc_beneficiaria: raw.uc_beneficiaria ?? null,
    owner_user_id: raw.owner_user_id ?? null,
    created_by_user_id: raw.created_by_user_id ?? null,
    client_created_at: raw.client_created_at ?? '',
    client_updated_at: raw.client_updated_at ?? null,

    // Portfolio lifecycle
    is_converted_customer: raw.is_converted_customer ?? false,
    exported_to_portfolio_at: raw.exported_to_portfolio_at ?? null,
    exported_by_user_id: raw.exported_by_user_id ?? null,

    // ── Lifecycle (optional table) ──
    lifecycle_id: raw.lifecycle_id ?? null,
    lifecycle_status: raw.lifecycle_status ?? null,
    onboarding_status: raw.onboarding_status ?? null,
    is_active_portfolio_client: raw.is_active_portfolio_client ?? null,

    // ── Energy profile (optional table) ──
    energy_profile_id: raw.energy_profile_id ?? null,
    modalidade: raw.modalidade ?? null,
    tarifa_atual: toNum(raw.tarifa_atual),
    desconto_percentual: toNum(raw.desconto_percentual),
    mensalidade: toNum(raw.mensalidade),
    prazo_meses: toNum(raw.prazo_meses),
    kwh_contratado: toNum(raw.kwh_contratado),
    potencia_kwp: toNum(raw.potencia_kwp),
    tipo_rede: raw.tipo_rede ?? null,
    marca_inversor: raw.marca_inversor ?? null,
    indicacao: raw.indicacao ?? null,

    // ── Usina (UF) — priority: top-level > usina_* alias > metadata ──
    potencia_modulo_wp: toNum(first(raw.potencia_modulo_wp, raw.usina_potencia_modulo_wp)) ?? metaNum(meta, 'potencia_modulo_wp'),
    numero_modulos: toNum(first(raw.numero_modulos, raw.usina_numero_modulos)) ?? metaNum(meta, 'numero_modulos'),
    modelo_modulo: first(raw.modelo_modulo, raw.usina_modelo_modulo, metaStr(meta, 'modelo_modulo')),
    // marca_inversor from client_energy_profile is an alias for modelo_inversor (used by backend enrichPortfolioClientRow)
    modelo_inversor: first(raw.modelo_inversor, raw.usina_modelo_inversor, metaStr(meta, 'modelo_inversor'), raw.marca_inversor),
    tipo_instalacao: first(raw.tipo_instalacao, raw.usina_tipo_instalacao, metaStr(meta, 'tipo_instalacao')),
    area_instalacao_m2: toNum(first(raw.area_instalacao_m2, raw.usina_area_instalacao_m2)) ?? metaNum(meta, 'area_instalacao_m2'),
    geracao_estimada_kwh: toNum(first(raw.geracao_estimada_kwh, raw.usina_geracao_estimada_kwh)) ?? metaNum(meta, 'geracao_estimada_kwh'),
    // valordemercado: top-level (set by enrichPortfolioClientRow) > usina alias > null
    valordemercado: toNum(first(raw.valordemercado, raw.usina_valordemercado)),

    // ── Contract (top-level only — never from metadata) ──
    contract_id: raw.contract_id ?? null,
    contract_type: raw.contract_type ?? null,
    contract_status: raw.contract_status ?? null,
    source_proposal_id: raw.source_proposal_id ?? null,
    source_proposal_record_id: raw.source_proposal_record_id ?? null,
    source_proposal_code: raw.source_proposal_code ?? null,
    source_proposal_client_name: raw.source_proposal_client_name ?? null,
    source_proposal_created_at: raw.source_proposal_created_at ?? null,
    source_proposal_type: raw.source_proposal_type ?? null,
    source_proposal_preview_url: raw.source_proposal_preview_url ?? null,
    source_proposal_download_url: raw.source_proposal_download_url ?? null,
    contract_signed_at: raw.contract_signed_at ?? null,
    contract_start_date: raw.contract_start_date ?? null,
    billing_start_date: raw.billing_start_date ?? null,
    expected_billing_end_date: raw.expected_billing_end_date ?? null,
    contractual_term_months: toNum(raw.contractual_term_months),
    // Default null so CobrancaTab / ContratoTab can apply their own type-specific defaults
    buyout_eligible: raw.buyout_eligible ?? null,
    buyout_status: raw.buyout_status ?? null,
    buyout_date: raw.buyout_date ?? null,
    buyout_amount_reference: raw.buyout_amount_reference ?? null,
    contract_notes: raw.contract_notes ?? null,
    contract_file_name: raw.contract_file_name ?? null,
    contract_file_url: raw.contract_file_url ?? null,
    contract_file_type: raw.contract_file_type ?? null,
    consultant_id: raw.consultant_id ?? null,
    consultant_name: raw.consultant_name ?? null,
    // Multiple attachments — prefer contract_attachments (set by enrichPortfolioClientRow),
    // fall back to contract_attachments_json (raw DB array), else null.
    contract_attachments: Array.isArray(raw.contract_attachments)
      ? raw.contract_attachments
      : (Array.isArray(raw.contract_attachments_json) ? raw.contract_attachments_json : null),

    // ── Project (top-level only — never from metadata) ──
    project_id: raw.project_id ?? null,
    project_status: raw.project_status ?? null,
    installation_status: raw.installation_status ?? null,
    engineering_status: raw.engineering_status ?? null,
    homologation_status: raw.homologation_status ?? null,
    commissioning_status: raw.commissioning_status ?? null,
    commissioning_date: raw.commissioning_date ?? null,
    first_injection_date: raw.first_injection_date ?? null,
    first_generation_date: raw.first_generation_date ?? null,
    expected_go_live_date: raw.expected_go_live_date ?? null,
    integrator_name: raw.integrator_name ?? null,
    engineer_name: raw.engineer_name ?? null,
    engineer_id: raw.engineer_id ?? null,
    installer_id: raw.installer_id ?? null,
    art_number: raw.art_number ?? null,
    art_issued_at: raw.art_issued_at ?? null,
    art_status: raw.art_status ?? null,
    timeline_velocity_score: raw.timeline_velocity_score ?? null,
    project_notes: raw.project_notes ?? null,

    // ── Billing (top-level only — never from metadata) ──
    billing_id: raw.billing_id ?? null,
    due_day: toNum(raw.due_day),
    reading_day: toNum(raw.reading_day),
    first_billing_date: raw.first_billing_date ?? null,
    expected_last_billing_date: raw.expected_last_billing_date ?? null,
    recurrence_type: raw.recurrence_type ?? null,
    billing_payment_status: raw.billing_payment_status ?? null,
    delinquency_status: raw.delinquency_status ?? null,
    collection_stage: raw.collection_stage ?? null,
    auto_reminder_enabled: raw.auto_reminder_enabled ?? null,
    // installments_json is the persisted array of confirmed/pending payments.
    // Must be mapped here so CobrancaTab can seed confirmedPayments on remount.
    installments_json: Array.isArray(raw.installments_json) ? raw.installments_json : null,

    // ── Leasing plan ──
    // kwh_contratado from client_energy_profile is the backend alias for kwh_mes_contratado
    kwh_mes_contratado: toNum(first(raw.kwh_mes_contratado, raw.kwh_contratado)),
    valor_mensalidade: toNum(raw.valor_mensalidade),

    // ── Billing extensions ──
    commissioning_date_billing: raw.commissioning_date_billing ?? null,
    inicio_da_mensalidade: raw.inicio_da_mensalidade ?? null,
    inicio_mensalidade_fixa: raw.inicio_mensalidade_fixa ?? null,
    is_contratante_titular: raw.is_contratante_titular ?? null,
  }

  return base
}
