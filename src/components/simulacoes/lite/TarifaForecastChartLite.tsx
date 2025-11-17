import React from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SimulacaoLiteSerieAnoItem } from '../../../lib/finance/simulacaoEngineLite'

export type TarifaForecastChartLiteProps = {
  data: SimulacaoLiteSerieAnoItem[]
}

const tarifaFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
})

export const TarifaForecastChartLite: React.FC<TarifaForecastChartLiteProps> = ({ data }) => {
  if (!data.length) {
    return <p className="chart-placeholder">Sem projeção disponível.</p>
  }
  return (
    <div className="chart-card">
      <h4 className="chart-title">Tarifa projetada (R$/kWh)</h4>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 16, left: 8, right: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.4)" />
          <XAxis dataKey="ano" stroke="#475569" />
          <YAxis tickFormatter={(value) => tarifaFormatter.format(value)} stroke="#475569" />
          <Tooltip formatter={(value: number) => tarifaFormatter.format(value)} labelFormatter={(label) => `Ano ${label}`} />
          <Line type="monotone" dataKey="tarifaProjetada" stroke="#fb7185" strokeWidth={3} dot={false} name="Tarifa" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
