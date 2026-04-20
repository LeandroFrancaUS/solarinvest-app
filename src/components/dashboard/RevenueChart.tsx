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
      <div className="flex h-64 items-center justify-center rounded-xl border border-ds-border bg-ds-surface p-4 text-sm text-ds-text-muted">
        Sem dados de receita
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-ds-border bg-ds-surface p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ds-text-primary">Receita Contratada</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F3D66" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B8BB5' }} />
          <YAxis tickFormatter={formatBRL} tick={{ fontSize: 11, fill: '#6B8BB5' }} />
          <Tooltip
            formatter={(value: number) => [formatBRL(value), 'Receita']}
            contentStyle={{
              borderRadius: 8,
              fontSize: 12,
              backgroundColor: '#122B4A',
              border: '1px solid #1F3D66',
              color: '#A8C1E0',
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            fill="#2D8CFF"
            fillOpacity={0.15}
            stroke="#2D8CFF"
            strokeWidth={2}
            name="Receita"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

