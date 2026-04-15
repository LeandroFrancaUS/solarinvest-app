// src/components/dashboard/RevenueChart.tsx
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { TimeSeriesPoint } from '../../domain/analytics/types.js'

type Props = {
  data: TimeSeriesPoint[]
}

function formatBRL(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  return `R$ ${value.toLocaleString('pt-BR')}`
}

export function RevenueChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
        Sem dados de receita
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Receita Contratada</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatBRL} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number) => [formatBRL(value), 'Receita']}
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            fill="#6366f1"
            fillOpacity={0.15}
            stroke="#6366f1"
            strokeWidth={2}
            name="Receita"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
