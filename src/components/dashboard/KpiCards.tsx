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
  color: string
}

export function KpiCards({ kpis }: Props) {
  const cards: CardDef[] = [
    {
      label: 'Contratos Fechados',
      value: formatNumber(kpis.closedContracts),
      icon: '📄',
      color: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    },
    {
      label: 'Clientes Ativos',
      value: formatNumber(kpis.activeClients),
      icon: '👥',
      color: 'bg-blue-50 border-blue-200 text-blue-800',
    },
    {
      label: 'Valor Total Contratado',
      value: formatCurrency(kpis.totalContractValue),
      icon: '💰',
      color: 'bg-amber-50 border-amber-200 text-amber-800',
    },
    {
      label: 'Ticket Médio',
      value: formatCurrency(kpis.averageTicket),
      icon: '🎫',
      color: 'bg-purple-50 border-purple-200 text-purple-800',
    },
    {
      label: 'Consumo Total (kWh)',
      value: formatNumber(kpis.totalConsumption),
      icon: '⚡',
      color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    },
    {
      label: 'Consumo Médio (kWh)',
      value: formatNumber(kpis.averageConsumption, 1),
      icon: '📊',
      color: 'bg-cyan-50 border-cyan-200 text-cyan-800',
    },
    {
      label: 'Taxa de Conversão',
      value: formatPercent(kpis.conversionRate),
      icon: '📈',
      color: 'bg-rose-50 border-rose-200 text-rose-800',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border p-4 shadow-sm ${c.color}`}
        >
          <div className="mb-1 text-lg">{c.icon}</div>
          <div className="text-2xl font-bold">{c.value}</div>
          <div className="mt-1 text-xs font-medium opacity-70">{c.label}</div>
        </div>
      ))}
    </div>
  )
}
