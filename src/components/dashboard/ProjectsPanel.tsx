// src/components/dashboard/ProjectsPanel.tsx
// Dashboard panel: aggregated project + financial KPIs.
// Reuses formatCurrencyBRL from src/utils/formatters (Phase 11 — no new formatters).

import type { ProjectsPanelKPIs } from '../../domain/projects/projectsPanelKpis.js'
import { formatCurrencyBRL } from '../../utils/formatters.js'

type Props = {
  kpis: ProjectsPanelKPIs
}

function pct(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'
}

type PanelCardDef = {
  label: string
  value: string
  icon: string
  borderClass: string
  valueClass: string
}

export function ProjectsPanel({ kpis }: Props) {
  if (kpis.totalProjects === 0) return null

  const cards: PanelCardDef[] = [
    {
      label: 'Total de Projetos',
      value: String(kpis.totalProjects),
      icon: '🏗️',
      borderClass: 'border-ds-primary/30',
      valueClass: 'text-ds-primary',
    },
    {
      label: 'Aguardando',
      value: String(kpis.aguardando),
      icon: '⏳',
      borderClass: 'border-ds-warning/30',
      valueClass: 'text-ds-warning',
    },
    {
      label: 'Em Andamento',
      value: String(kpis.emAndamento),
      icon: '🔨',
      borderClass: 'border-ds-success/30',
      valueClass: 'text-ds-success',
    },
    {
      label: 'Concluídos',
      value: String(kpis.concluido),
      icon: '✅',
      borderClass: 'border-ds-success/30',
      valueClass: 'text-ds-success',
    },
    {
      label: 'Proj. Leasing',
      value: String(kpis.leasingCount),
      icon: '🔄',
      borderClass: 'border-ds-primary/30',
      valueClass: 'text-ds-primary',
    },
    {
      label: 'Proj. Venda',
      value: String(kpis.vendaCount),
      icon: '🤝',
      borderClass: 'border-ds-primary/30',
      valueClass: 'text-ds-primary',
    },
  ]

  const financialCards: PanelCardDef[] = [
    {
      label: 'Receita Projetada',
      value: formatCurrencyBRL(kpis.receitaProjetada),
      icon: '📈',
      borderClass: 'border-ds-success/30',
      valueClass: 'text-ds-success',
    },
    {
      label: 'Receita Realizada',
      value: formatCurrencyBRL(kpis.receitaRealizada),
      icon: '✅',
      borderClass: 'border-ds-success/30',
      valueClass: 'text-ds-success',
    },
    {
      label: 'CAPEX Total',
      value: formatCurrencyBRL(kpis.capexTotal),
      icon: '💸',
      borderClass: 'border-ds-error/30',
      valueClass: 'text-ds-error',
    },
    {
      label: 'MRR (Leasing)',
      value: formatCurrencyBRL(kpis.mrrLeasing),
      icon: '🔄',
      borderClass: 'border-ds-primary/30',
      valueClass: 'text-ds-primary',
    },
    {
      label: 'Lucro Líquido',
      value: formatCurrencyBRL(kpis.lucroLiquido),
      icon: '💰',
      borderClass: kpis.lucroLiquido >= 0 ? 'border-ds-success/30' : 'border-ds-error/30',
      valueClass: kpis.lucroLiquido >= 0 ? 'text-ds-success' : 'text-ds-error',
    },
    {
      label: 'ROI Médio',
      value: pct(kpis.avgRoiPercent),
      icon: '📊',
      borderClass: 'border-ds-primary/30',
      valueClass: 'text-ds-primary',
    },
  ]

  const showFinancial = kpis.receitaProjetada > 0 || kpis.receitaRealizada > 0 || kpis.capexTotal > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-ds-text-primary">🏗️ Projetos</h2>
        <span className="rounded-full bg-ds-primary/10 px-2 py-0.5 text-xs text-ds-primary">
          {kpis.totalProjects} total
        </span>
      </div>

      {/* Project counts */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border bg-ds-surface p-4 shadow-sm transition-colors hover:bg-ds-surface-hover ${c.borderClass}`}
          >
            <div className="mb-1 text-lg">{c.icon}</div>
            <div className={`text-2xl font-bold ${c.valueClass}`}>{c.value}</div>
            <div className="mt-1 text-xs font-medium text-ds-text-muted">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Financial aggregates (only shown when data exists) */}
      {showFinancial && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <h3 className="text-sm font-medium text-ds-text-secondary">📊 Financeiro Consolidado</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {financialCards.map((c) => (
              <div
                key={c.label}
                className={`rounded-xl border bg-ds-surface p-4 shadow-sm transition-colors hover:bg-ds-surface-hover ${c.borderClass}`}
              >
                <div className="mb-1 text-lg">{c.icon}</div>
                <div className={`text-xl font-bold ${c.valueClass}`}>{c.value}</div>
                <div className="mt-1 text-xs font-medium text-ds-text-muted">{c.label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
