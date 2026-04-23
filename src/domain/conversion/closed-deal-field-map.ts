/**
 * src/domain/conversion/closed-deal-field-map.ts
 *
 * DECLARATIVE FIELD MAP — "Negócio Fechado" distribution rules.
 *
 * Maps ClosedDealResolvedPayload keys → destination table columns for
 * Carteira de Cliente (portfolio) and Gestão Financeira (project finance).
 *
 * Rules:
 *   • Only maps fields explicitly listed here.
 *   • Does not contain any business logic or fallback chains.
 *   • Used by convert-client-to-closed-deal.ts to build patch payloads
 *     without repeating the field-name list in each call site.
 */

import type { ClosedDealResolvedPayload } from './resolve-closed-deal-payload'

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Keys of ClosedDealResolvedPayload that are distributable */
export type ClosedDealField = keyof Omit<ClosedDealResolvedPayload, '_sourceMeta'>

/**
 * A single field mapping entry: resolved key → destination column.
 * The `destination` column name is what the API or DB accepts.
 */
export interface FieldMapEntry {
  /** Key in ClosedDealResolvedPayload */
  resolvedKey: ClosedDealField
  /** Column/key name in the destination record */
  destKey: string
}

// ─── Portfolio (Carteira de Cliente) field map ─────────────────────────────────

/**
 * Fields distributed to the clients table via PATCH /api/client-portfolio/:id/profile.
 * Server uses COALESCE — only fills empty fields, preserves manual edits.
 */
export const PORTFOLIO_PROFILE_FEED: FieldMapEntry[] = [
  { resolvedKey: 'nome',         destKey: 'client_name' },
  { resolvedKey: 'cpfCnpj',      destKey: 'client_document' },
  { resolvedKey: 'email',        destKey: 'client_email' },
  { resolvedKey: 'telefone',     destKey: 'client_phone' },
  { resolvedKey: 'cidade',       destKey: 'client_city' },
  { resolvedKey: 'uf',           destKey: 'client_state' },
  { resolvedKey: 'endereco',     destKey: 'client_address' },
  { resolvedKey: 'cep',          destKey: 'client_cep' },
  { resolvedKey: 'distribuidora', destKey: 'distribuidora' },
  { resolvedKey: 'ucGeradora',   destKey: 'uc_geradora' },
  { resolvedKey: 'ucBeneficiaria', destKey: 'uc_beneficiaria' },
  { resolvedKey: 'consumoKwhMes', destKey: 'consumption_kwh_month' },
  { resolvedKey: 'potenciaInstaladaKwp', destKey: 'system_kwp' },
  { resolvedKey: 'prazoMeses',   destKey: 'term_months' },
]

/**
 * Fields distributed to client_contracts via PATCH /api/client-portfolio/:id/contract.
 * Server uses COALESCE — preserves existing values.
 */
export const PORTFOLIO_CONTRACT_FEED: FieldMapEntry[] = [
  { resolvedKey: 'consultantId', destKey: 'consultant_id' },
  { resolvedKey: 'consultantLabel', destKey: 'consultant_name' },
  { resolvedKey: 'prazoMeses',   destKey: 'contractual_term_months' },
  { resolvedKey: 'valorMercado', destKey: 'buyout_amount_reference' },
  { resolvedKey: 'proposalId',   destKey: 'source_proposal_id' },
]

/**
 * Fields distributed to client_energy_profile via PATCH /api/client-portfolio/:id/plan.
 * Server uses COALESCE — preserves existing values.
 */
export const PORTFOLIO_PLAN_FEED: FieldMapEntry[] = [
  { resolvedKey: 'tipoRede',        destKey: 'tipo_rede' },
  { resolvedKey: 'tarifaCheia',     destKey: 'tarifa_atual' },
  { resolvedKey: 'desconto',        destKey: 'desconto_percentual' },
  { resolvedKey: 'mensalidadeBase', destKey: 'mensalidade' },
  { resolvedKey: 'prazoMeses',      destKey: 'prazo_meses' },
  { resolvedKey: 'potenciaInstaladaKwp', destKey: 'potencia_kwp' },
  { resolvedKey: 'consumoKwhMes',   destKey: 'kwh_contratado' },
]

/**
 * Fields distributed to client_usina_config via PUT /api/clients/:id (patchPortfolioUsina).
 * Server uses COALESCE-style logic — preserves existing values.
 *
 * NOTE on missing destinations:
 *   - bairro / numero / complemento / telefone_secundario columns exist on
 *     public.clients (migration 0039) but the PATCH /profile and PUT /clients/:id
 *     handlers do not yet UPDATE them (see server/client-portfolio/repository.js
 *     `updatePortfolioClientProfile`). Adding entries here is harmless but a
 *     no-op until the server-side UPDATE statements are extended.
 */
export const PORTFOLIO_USINA_FEED: FieldMapEntry[] = [
  { resolvedKey: 'potenciaInstaladaKwp', destKey: 'system_kwp' },
  { resolvedKey: 'potenciaModuloWp',     destKey: 'potencia_modulo_wp' },
  { resolvedKey: 'numeroModulos',        destKey: 'numero_modulos' },
  { resolvedKey: 'areaUtilizadaM2',      destKey: 'area_instalacao_m2' },
  { resolvedKey: 'geracaoEstimadaKwhMes', destKey: 'geracao_estimada_kwh' },
  { resolvedKey: 'tipoInstalacao',       destKey: 'tipo_instalacao' },
  { resolvedKey: 'valorMercado',         destKey: 'valordemercado' },
  { resolvedKey: 'modeloModulo',         destKey: 'modelo_modulo' },
  { resolvedKey: 'modeloInversor',       destKey: 'modelo_inversor' },
]

// ─── Gestão Financeira (Project Finance) field map ─────────────────────────────

/**
 * Fields distributed to project_financial_profiles (ProjectFinanceFormState).
 * Seeded once when a project is created from the contract.
 *
 * NOTE — minimum-inputs gap (Financeiro engine):
 *   The spec also asks for `tipo_rede`, `tipo_instalacao`, `distribuidora`,
 *   `potencia_modulo_wp`, `numero_modulos`, `area_utilizada_m2`,
 *   `tarifa_cheia`, `uc_geradora`, `uc_beneficiaria`, `consultant_id`,
 *   `client_name`, `client_document` to be seeded into the project finance
 *   profile so the Financeiro tab can compute without further input.
 *
 *   Those columns do NOT exist on `project_financial_profiles`
 *   (see migrations 0047/0048 and `ProjectFinanceProfile` in
 *   src/features/project-finance/types.ts). They live on the linked
 *   `projects` row (`client_id`) and on the linked `client_*` tables
 *   (`distribuidora`, `tipo_rede`, `uc_*`, …) which the Financeiro engine
 *   already joins to. Adding more keys here would be silently dropped by
 *   the server. A schema migration is required to push them through this
 *   feed; tracked as out-of-scope per the implementation plan.
 *
 *   `potencia_modulo_wp` is forwarded via `technical_params_json`
 *   (handled by `buildProjectFinanceForm` in the orchestrator), not via
 *   this map.
 */
export const PROJECT_FINANCE_FEED: FieldMapEntry[] = [
  { resolvedKey: 'consumoKwhMes',         destKey: 'consumo_kwh_mes' },
  { resolvedKey: 'potenciaInstaladaKwp',  destKey: 'potencia_instalada_kwp' },
  { resolvedKey: 'geracaoEstimadaKwhMes', destKey: 'geracao_estimada_kwh_mes' },
  { resolvedKey: 'prazoMeses',            destKey: 'prazo_contratual_meses' },
  { resolvedKey: 'mensalidadeBase',       destKey: 'mensalidade_base' },
  { resolvedKey: 'desconto',              destKey: 'desconto_percentual' },
  { resolvedKey: 'valorMercado',          destKey: 'valor_venda' },
  // NOTE: client_id is added by the orchestrator (buildProjectFinanceForm),
  // not via this feed map, because ClosedDealResolvedPayload.clientId is a
  // string (uniform encoding) while ProjectFinanceProfile.client_id is a number.
]

// ─── Utility: build destination payload from field map ─────────────────────────

/**
 * Build a plain object for a destination record by applying a FieldMapEntry[].
 * Only includes fields that are non-null in the resolved payload.
 *
 * @example
 * ```ts
 * const profilePatch = buildDestPayload(resolved, PORTFOLIO_PROFILE_FEED)
 * await patchPortfolioProfile(clientId, profilePatch)
 * ```
 */
export function buildDestPayload(
  resolved: ClosedDealResolvedPayload,
  feed: FieldMapEntry[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const { resolvedKey, destKey } of feed) {
    const value = resolved[resolvedKey]
    if (value !== null && value !== undefined) {
      result[destKey] = value
    }
  }
  return result
}
