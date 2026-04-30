// src/components/dashboard/KpiCards.tsx
import type { DashboardKPIs } from '../../domain/analytics/types.js'

type Props = {
  kpis: DashboardKPIs
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: decimals })
}

function formatPercent(value: number): string {
  return (value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'
}

export function KpiCards({ kpis }: Props) {
  const cards = [
    {
      label: 'Contratos Fechados',
      value: formatNumber(kpis.closedContracts),
      icon: '📄',
    },
    {
      label: 'Clientes Ativos',
      value: formatNumber(kpis.activeClients),
      icon: '👥',
    },
    {
      label: 'Valor Contratado (Vendas)',
      value: formatCurrency(kpis.totalContractValue),
      icon: '💰',
    },
    {
      label: 'Receita Mensal (Leasing)',
      value: formatCurrency(kpis.leasingMonthlyContracted),
      icon: '🔁',
    },
    {
      label: 'Ticket Médio (Vendas)',
      value: formatCurrency(kpis.averageTicket),
      icon: '🎫',
    },
    {
      label: 'Consumo Total (kWh)',
      value: formatNumber(kpis.totalConsumption),
      icon: '⚡',
    },
    {
      label: 'Taxa de Conversão',
      value: formatPercent(kpis.conversionRate),
      icon: '📈',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border bg-ds-surface p-4 shadow-sm">
          <div className="mb-1 text-lg">{c.icon}</div>
          <div className="text-2xl font-bold">{c.value}</div>
          <div className="mt-1 text-xs font-medium text-ds-text-muted">{c.label}</div>
        </div>
      ))}
    </div>
  )
}
