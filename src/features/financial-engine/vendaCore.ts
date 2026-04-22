// src/features/financial-engine/vendaCore.ts
// Pure domain logic for the Venda financial summary shown in ProjectDetailPage.
// No React, no side-effects. Safe to unit-test in isolation.
//
// Scope (PR 4): operational system-level metrics only.
// Excluded: dedicated module, new simulation, saved simulations, AI analysis,
// risk/Monte Carlo, packs, approval checklist, seal and decision.

import type { PortfolioClientRow } from '../../types/clientPortfolio'
import type { ProjectPvData } from '../../domain/projects/types'

export interface VendaFinancialSummary {
  // Technical system data
  potencia_sistema_kwp: number | null
  geracao_estimada_kwh_mes: number | null
  consumo_kwh_mes: number | null

  // Derived metric
  autonomia_percent: number | null

  // Context
  tarifa_atual: number | null
}

/**
 * Derives the venda financial summary from portfolio client data and pv_data.
 * Autonomia = min(geracao / consumo, 100%) — no new financial model introduced.
 */
export function computeVendaFinancialSummary(
  client: PortfolioClientRow,
  pv: ProjectPvData | null,
): VendaFinancialSummary {
  const geracao = pv?.geracao_estimada_kwh_mes ?? null
  const consumo = pv?.consumo_kwh_mes ?? client.consumption_kwh_month ?? null

  const autonomia_percent =
    geracao != null && consumo != null && consumo > 0
      ? Math.min((geracao / consumo) * 100, 100)
      : null

  return {
    potencia_sistema_kwp: pv?.potencia_sistema_kwp ?? null,
    geracao_estimada_kwh_mes: geracao,
    consumo_kwh_mes: consumo,
    autonomia_percent,
    tarifa_atual: client.tarifa_atual ?? null,
  }
}
