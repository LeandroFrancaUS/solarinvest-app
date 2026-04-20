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

type CardDef = {
  label: string
  value: string
  icon: string
  accent: string
}

export function KpiCards({ kpis }: Props) {
  const cards: CardDef[] = [
    {
      label: 'Contratos Fechados',
      value: formatNumber(kpis.closedContracts),
      icon: '📄',
      accent: 'border-ds-success/30 text-ds-success',
    },
    {
      label: 'Clientes Ativos',
      value: formatNumber(kpis.activeClients),
      icon: '👥',
      accent: 'border-ds-primary/30 text-ds-primary',
    },
    {
      label: 'Valor Total Contratado',
      value: formatCurrency(kpis.totalContractValue),
      icon: '💰',
      accent: 'border-ds-warning/30 text-ds-warning',
    },
    {
      label: 'Ticket Médio',
      value: formatCurrency(kpis.averageTicket),
      icon: '🎫',
      accent: 'border-ds-primary/30 text-ds-primary',
    },
    {
      label: 'Consumo Total (kWh)',
      value: formatNumber(kpis.totalConsumption),
      icon: '⚡',
      accent: 'border-ds-warning/30 text-ds-warning',
    },
    {
      label: 'Consumo Médio (kWh)',
      value: formatNumber(kpis.averageConsumption, 1),
      icon: '📊',
      accent: 'border-ds-primary/30 text-ds-primary',
    },
    {
      label: 'Taxa de Conversão',
      value: formatPercent(kpis.conversionRate),
      icon: '📈',
      accent: 'border-ds-success/30 text-ds-success',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border bg-ds-surface p-4 shadow-sm transition-colors hover:bg-ds-surface-hover ${c.accent.split(' ')[0]}`}
        >
          <div className="mb-1 text-lg">{c.icon}</div>
          <div className={`text-2xl font-bold ${c.accent.split(' ')[1]}`}>{c.value}</div>
          <div className="mt-1 text-xs font-medium text-ds-text-muted">{c.label}</div>
        </div>
      ))}
    </div>
  )
}

