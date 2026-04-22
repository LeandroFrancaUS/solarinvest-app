// src/features/financial-engine/leasingCore.ts
// Pure domain logic for the Leasing financial summary shown in ProjectDetailPage.
// No React, no side-effects. Safe to unit-test in isolation.
//
// Scope (PR 4): operational contractual metrics only.
// Excluded: dedicated module, new simulation, saved simulations, AI analysis,
// risk/Monte Carlo, packs, approval checklist, seal and decision.

import type { PortfolioClientRow } from '../../types/clientPortfolio'
import type { ProjectPvData } from '../../domain/projects/types'

export interface LeasingFinancialSummary {
  // Contractual plan — sourced from client_energy_profile / plan columns
  mensalidade: number | null
  prazo_meses: number | null
  kwh_mes_contratado: number | null
  desconto_percentual: number | null
  tarifa_atual: number | null

  // Derived metrics (no new formulas — these are basic arithmetic)
  receita_total_projetada: number | null
  economia_mensal_estimada: number | null
  economia_total_projetada: number | null

  // Technical system data
  potencia_sistema_kwp: number | null
  geracao_estimada_kwh_mes: number | null

  // Contract timeline
  billing_start_date: string | null
  expected_billing_end_date: string | null
  contract_status: string | null
}

/**
 * Derives the leasing financial summary from portfolio client data and pv_data.
 * All arithmetic is basic (multiply/divide) — no new financial model introduced.
 */
export function computeLeasingFinancialSummary(
  client: PortfolioClientRow,
  pv: ProjectPvData | null,
): LeasingFinancialSummary {
  // Resolve field aliases — the schema has evolved; prefer the newer column names.
  const mensalidade = client.mensalidade ?? client.valor_mensalidade ?? null
  const prazo = client.prazo_meses ?? client.contractual_term_months ?? null
  const kwh = client.kwh_mes_contratado ?? client.kwh_contratado ?? null
  const desconto = client.desconto_percentual ?? null
  const tarifa = client.tarifa_atual ?? null

  // Derived metrics
  const receita_total_projetada =
    mensalidade != null && prazo != null ? mensalidade * prazo : null

  const economia_mensal_estimada =
    tarifa != null && kwh != null && desconto != null
      ? tarifa * kwh * (desconto / 100)
      : null

  const economia_total_projetada =
    economia_mensal_estimada != null && prazo != null
      ? economia_mensal_estimada * prazo
      : null

  return {
    mensalidade,
    prazo_meses: prazo,
    kwh_mes_contratado: kwh,
    desconto_percentual: desconto,
    tarifa_atual: tarifa,
    receita_total_projetada,
    economia_mensal_estimada,
    economia_total_projetada,
    potencia_sistema_kwp: pv?.potencia_sistema_kwp ?? null,
    geracao_estimada_kwh_mes: pv?.geracao_estimada_kwh_mes ?? null,
    billing_start_date: client.billing_start_date ?? null,
    expected_billing_end_date: client.expected_billing_end_date ?? null,
    contract_status: client.contract_status ?? null,
  }
}
