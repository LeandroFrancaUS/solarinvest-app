import React from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SimulacaoLiteSerieAnoItem } from '../../../lib/finance/simulacaoEngineLite'

export type RevenueCostProfitChartLiteProps = {
  data: SimulacaoLiteSerieAnoItem[]
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

export const RevenueCostProfitChartLite: React.FC<RevenueCostProfitChartLiteProps> = ({ data }) => {
  if (!data.length) {
    return <p className="chart-placeholder">Nenhum dado disponível.</p>
  }
  return (
    <div className="chart-card">
      <h4 className="chart-title">Receita x OPEX x Lucro</h4>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 16, left: 8, right: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.4)" />
          <XAxis dataKey="ano" stroke="#475569" />
          <YAxis tickFormatter={(value) => currencyFormatter.format(value / 1000) + 'k'} stroke="#475569" />
          <Tooltip formatter={(value: number) => currencyFormatter.format(value)} labelFormatter={(label) => `Ano ${label}`} />
          <Legend />
          <Line type="monotone" dataKey="receitaBruta" stroke="#ff8c00" strokeWidth={2} dot={false} name="Receita" />
          <Line type="monotone" dataKey="opex" stroke="#0ea5e9" strokeWidth={2} dot={false} name="OPEX" />
          <Line type="monotone" dataKey="lucroLiquido" stroke="#22c55e" strokeWidth={2} dot={false} name="Lucro" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
