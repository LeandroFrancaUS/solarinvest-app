// src/components/dashboard/ContractsChart.tsx
import {
  BarChart,
  Bar,
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

export function ContractsChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-ds-border bg-ds-surface p-4 text-sm text-ds-text-muted">
        Sem dados para exibir
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-ds-border bg-ds-surface p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ds-text-primary">Contratos Fechados</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F3D66" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B8BB5' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B8BB5' }} />
          <Tooltip
            formatter={(value: number) => [value, 'Contratos']}
            contentStyle={{
              borderRadius: 8,
              fontSize: 12,
              backgroundColor: '#122B4A',
              border: '1px solid #1F3D66',
              color: '#A8C1E0',
            }}
          />
          <Bar dataKey="contracts" fill="#22C55E" radius={[4, 4, 0, 0]} name="Contratos" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

