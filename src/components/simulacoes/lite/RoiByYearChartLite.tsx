import React from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SimulacaoLiteSerieAnoItem } from '../../../lib/finance/simulacaoEngineLite'

export type RoiByYearChartLiteProps = {
  data: SimulacaoLiteSerieAnoItem[]
}

const roiFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
})

export const RoiByYearChartLite: React.FC<RoiByYearChartLiteProps> = ({ data }) => {
  if (!data.length) {
    return <p className="chart-placeholder">Sem ROI acumulado.</p>
  }
  return (
    <div className="chart-card">
      <h4 className="chart-title">ROI acumulado (%)</h4>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 16, left: 8, right: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.4)" />
          <XAxis dataKey="ano" stroke="#475569" />
          <YAxis tickFormatter={(value) => roiFormatter.format(value / 100)} stroke="#475569" />
          <Tooltip formatter={(value: number) => roiFormatter.format(value / 100)} labelFormatter={(label) => `Ano ${label}`} />
          <Bar dataKey="roiAcumulado" fill="#f97316" radius={[4, 4, 0, 0]} name="ROI" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
