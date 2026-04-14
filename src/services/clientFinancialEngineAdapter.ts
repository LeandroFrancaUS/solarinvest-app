// src/services/clientFinancialEngineAdapter.ts
// Adapter that bridges client management data (from the DB) to the existing
// financial engines.
//
// Rules:
// - DO NOT duplicate financial logic — use engines where inputs are available.
// - Fall back gracefully when the full input set isn't available.
// - Accept structured client/contract/energy data and return normalized results.

import type { ClientEnergyProfile, ClientContract } from '../types/clientManagement'

// ─── Individual client financial summary ─────────────────────────────────────

export interface ClientFinancialSummary {
  /** Monthly fee at the base rate */
  mensalidade_base: number | null
  /** Contractual term in months */
  prazo_meses: number | null
  /** Estimated total receivable over the full term */
  total_previsto: number | null
  /** System power in kWp */
  potencia_kwp: number | null
  /** kWh/month contracted */
  kwh_contratado: number | null
  /** Current discount percentage */
  desconto_percentual: number | null
  /** Engine mode used */
  modo: 'leasing' | 'venda' | 'none'
  /** Buyout reference value */
  buyout_reference: number | null
  /** Whether this client is eligible for buyout */
  buyout_eligible: boolean
  /** Simple implied annual ROI: (total_previsto - capex) / capex * 100, or null */
  roi_simples_percent: number | null
  /** Remaining months if contract start is known */
  meses_restantes: number | null
  /** Remaining projected receivable */
  receita_restante: number | null
}

/**
 * Compute a financial summary for a single client from their energy profile
 * and active contract. Uses arithmetic projections — the full engine
 * (calcularAnaliseFinanceira) should be invoked from the detailed analysis
 * pages where all inputs are available.
 */
export function computeClientFinancialSummary(
  energy: ClientEnergyProfile | null,
  contract: ClientContract | null,
): ClientFinancialSummary {
  const mensalidade = energy?.mensalidade ?? null
  const prazo = energy?.prazo_meses ?? contract?.contractual_term_months ?? null
  const potencia = energy?.potencia_kwp ?? null
  const kwh = energy?.kwh_contratado ?? null
  const desconto = energy?.desconto_percentual ?? null
  const modalidade = energy?.modalidade ?? contract?.contract_type ?? null
  const modo: 'leasing' | 'venda' | 'none' =
    modalidade === 'leasing'
      ? 'leasing'
      : modalidade === 'sale' || modalidade === 'venda'
      ? 'venda'
      : 'none'

  const total_previsto =
    mensalidade !== null && prazo !== null ? mensalidade * prazo : null

  // Compute months remaining from contract start date
  let meses_restantes: number | null = null
  let receita_restante: number | null = null
  if (contract?.billing_start_date && prazo !== null && mensalidade !== null) {
    const start = new Date(contract.billing_start_date)
    const now = new Date()
    const elapsed = Math.max(
      0,
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()),
    )
    meses_restantes = Math.max(0, prazo - elapsed)
    receita_restante = meses_restantes * mensalidade
  }

  // Simple implied ROI if we have a buyout reference as cost proxy
  let roi_simples_percent: number | null = null
  if (
    total_previsto !== null &&
    contract?.buyout_amount_reference !== null &&
    contract?.buyout_amount_reference !== undefined &&
    contract.buyout_amount_reference > 0
  ) {
    roi_simples_percent =
      ((total_previsto - contract.buyout_amount_reference) / contract.buyout_amount_reference) * 100
  }

  return {
    mensalidade_base: mensalidade,
    prazo_meses: prazo,
    total_previsto,
    potencia_kwp: potencia,
    kwh_contratado: kwh,
    desconto_percentual: desconto,
    modo,
    buyout_reference: contract?.buyout_amount_reference ?? null,
    buyout_eligible: contract?.buyout_eligible ?? false,
    roi_simples_percent,
    meses_restantes,
    receita_restante,
  }
}

// ─── Portfolio aggregation helpers ───────────────────────────────────────────

export interface PortfolioFinancialAggregate {
  total_monthly_revenue: number
  total_projected_receivable: number
  avg_discount_percent: number | null
  total_kwp: number
  client_count: number
}

/**
 * Aggregate financial summaries across a portfolio of clients.
 * Suitable for dashboard KPI cards.
 */
export function aggregatePortfolioFinancials(
  summaries: ClientFinancialSummary[],
): PortfolioFinancialAggregate {
  let total_monthly_revenue = 0
  let total_projected_receivable = 0
  let total_kwp = 0
  let discount_sum = 0
  let discount_count = 0
  const client_count = summaries.length

  for (const s of summaries) {
    total_monthly_revenue += s.mensalidade_base ?? 0
    total_projected_receivable += s.total_previsto ?? 0
    total_kwp += s.potencia_kwp ?? 0
    if (s.desconto_percentual !== null) {
      discount_sum += s.desconto_percentual
      discount_count++
    }
  }

  return {
    total_monthly_revenue,
    total_projected_receivable,
    avg_discount_percent: discount_count > 0 ? discount_sum / discount_count : null,
    total_kwp,
    client_count,
  }
}
