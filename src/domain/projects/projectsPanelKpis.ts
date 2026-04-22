// src/domain/projects/projectsPanelKpis.ts
// Pure domain logic: derives the ProjectsPanelKPIs displayed on the Dashboard.
// No React, no side-effects. Safe to unit-test in isolation.
//
// Inputs are the shapes returned by:
//   - GET /api/projects/summary  → ProjectSummary
//   - GET /api/financial-management/dashboard-feed → FinancialDashboardFeed
//
// The calculation is intentionally trivial (no duplicate formulas): all
// aggregated numbers come from server-side DB queries; we only reshape
// them here for the panel component.

import type { ProjectSummary } from './types.js'

export interface FinancialDashboardFeed {
  total_projected_revenue: number
  total_realized_revenue: number
  total_cost: number
  net_profit: number
  avg_roi_percent: number
  avg_payback_months: number
  mrr_leasing: number
  closed_sales_revenue: number
}

export interface ProjectsPanelKPIs {
  totalProjects: number
  aguardando: number
  emAndamento: number
  concluido: number
  leasingCount: number
  vendaCount: number
  capexTotal: number
  receitaProjetada: number
  receitaRealizada: number
  mrrLeasing: number
  lucroLiquido: number
  avgRoiPercent: number
}

/**
 * Derives the dashboard ProjectsPanel KPIs from server-side aggregates.
 * Both inputs are optional (handles load failures gracefully).
 */
export function deriveProjectsPanelKPIs(
  summary: ProjectSummary | null,
  feed: FinancialDashboardFeed | null,
): ProjectsPanelKPIs {
  return {
    totalProjects: summary?.total ?? 0,
    aguardando: summary?.by_status['Aguardando'] ?? 0,
    emAndamento: summary?.by_status['Em andamento'] ?? 0,
    concluido: summary?.by_status['Concluído'] ?? 0,
    leasingCount: summary?.by_type['leasing'] ?? 0,
    vendaCount: summary?.by_type['venda'] ?? 0,
    capexTotal: feed?.total_cost ?? 0,
    receitaProjetada: feed?.total_projected_revenue ?? 0,
    receitaRealizada: feed?.total_realized_revenue ?? 0,
    mrrLeasing: feed?.mrr_leasing ?? 0,
    lucroLiquido: feed?.net_profit ?? 0,
    avgRoiPercent: feed?.avg_roi_percent ?? 0,
  }
}
