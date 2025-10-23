import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'

const CHART_PALETTE = {
  Leasing: '#38BDF8',
  Financiamento: '#F97316',
} as const

type ChartTheme = {
  grid: string
  tick: string
  legend: string
  tooltipBg: string
  tooltipText: string
}

type LeasingBeneficioChartProps = {
  leasingROI: number[]
  financiamentoROI: number[]
  mostrarFinanciamento: boolean
  exibirLeasingLinha: boolean
  onToggleLeasing: (value: boolean) => void
  exibirFinLinha: boolean
  onToggleFinanciamento: (value: boolean) => void
  chartTheme: ChartTheme
  theme: 'light' | 'dark'
  currency: (value: number) => string
  formatAxis: (value: number) => string
}

const ANALISE_ANOS_PADRAO = 30

export function LeasingBeneficioChart({
  leasingROI,
  financiamentoROI,
  mostrarFinanciamento,
  exibirLeasingLinha,
  onToggleLeasing,
  exibirFinLinha,
  onToggleFinanciamento,
  chartTheme,
  theme,
  currency,
  formatAxis,
}: LeasingBeneficioChartProps) {
  const chartData = useMemo(
    () =>
      Array.from({ length: ANALISE_ANOS_PADRAO }, (_, index) => {
        const ano = index + 1
        return {
          ano,
          Leasing: leasingROI[index] ?? 0,
          Financiamento: financiamentoROI[index] ?? 0,
        }
      }),
    [financiamentoROI, leasingROI],
  )

  const beneficioAno30 = useMemo(
    () => chartData.find((row) => row.ano === 30) ?? null,
    [chartData],
  )

  const valoresGrafico = useMemo(() => chartData.flatMap((row) => [row.Leasing, row.Financiamento]), [chartData])

  const yDomain = useMemo(() => {
    const minValor = Math.min(...valoresGrafico, 0)
    const maxValor = Math.max(...valoresGrafico, 0)
    const padding = Math.max(5_000, Math.round((maxValor - minValor) * 0.1))
    const inferior = Math.floor((minValor - padding) / 1000) * 1000
    const superior = Math.ceil((maxValor + padding) / 1000) * 1000
    return [inferior, superior] as [number, number]
  }, [valoresGrafico])

  const allCurvesHidden = !exibirLeasingLinha && (!mostrarFinanciamento || !exibirFinLinha)

  return (
    <section className="card">
      <div className="card-header">
        <h2>Beneficio acumulado em 30 anos</h2>
        <div className="legend-toggle">
          <label>
            <input
              type="checkbox"
              checked={exibirLeasingLinha}
              onChange={(event) => onToggleLeasing(event.target.checked)}
            />
            <span style={{ color: CHART_PALETTE.Leasing }}>Leasing</span>
          </label>
          {mostrarFinanciamento ? (
            <label>
              <input
                type="checkbox"
                checked={exibirFinLinha}
                onChange={(event) => onToggleFinanciamento(event.target.checked)}
              />
              <span style={{ color: CHART_PALETTE.Financiamento }}>Financiamento</span>
            </label>
          ) : null}
        </div>
      </div>
      <div className="chart">
        {!allCurvesHidden ? (
          <div className="chart-explainer">
            <strong>ROI Leasing – Benefício financeiro</strong>
            <span>Economia acumulada versus concessionária.</span>
            {beneficioAno30 ? (
              <span className="chart-highlight">
                <strong>Beneficio acumulado em 30 anos:</strong>{' '}
                <strong style={{ color: CHART_PALETTE.Leasing }}>{currency(beneficioAno30.Leasing)}</strong>
                {mostrarFinanciamento && exibirFinLinha ? (
                  <>
                    {' • '}Financiamento:{' '}
                    <strong style={{ color: CHART_PALETTE.Financiamento }}>{currency(beneficioAno30.Financiamento)}</strong>
                  </>
                ) : null}
              </span>
            ) : null}
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 16, right: 24, bottom: 20, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis
              dataKey="ano"
              stroke={chartTheme.grid}
              tick={{ fill: chartTheme.tick, fontSize: 12, fontWeight: 600 }}
              label={{
                value: 'Anos',
                position: 'insideBottomRight',
                offset: -5,
                fill: chartTheme.legend,
                fontWeight: 700,
              }}
            />
            <YAxis
              stroke={chartTheme.grid}
              tick={{ fill: chartTheme.tick, fontSize: 12, fontWeight: 600 }}
              tickFormatter={formatAxis}
              domain={yDomain}
              width={92}
              label={{
                value: 'Beneficio em Reais',
                angle: -90,
                position: 'insideLeft',
                offset: 12,
                fill: chartTheme.legend,
                fontWeight: 700,
              }}
            />
            <Tooltip
              formatter={(value: number) => currency(Number(value))}
              contentStyle={{
                background: chartTheme.tooltipBg,
                border: '1px solid var(--border)',
                color: chartTheme.tooltipText,
              }}
              itemStyle={{ color: chartTheme.tooltipText }}
              labelStyle={{ color: chartTheme.tooltipText }}
            />
            <Legend verticalAlign="bottom" align="right" wrapperStyle={{ paddingTop: 16, color: chartTheme.legend }} />
            <ReferenceLine
              y={0}
              stroke={theme === 'dark' ? 'rgba(239,68,68,0.45)' : 'rgba(239,68,68,0.35)'}
            />
            {exibirLeasingLinha ? (
              <Line type="monotone" dataKey="Leasing" stroke={CHART_PALETTE.Leasing} strokeWidth={2} dot />
            ) : null}
            {mostrarFinanciamento && exibirFinLinha ? (
              <Line type="monotone" dataKey="Financiamento" stroke={CHART_PALETTE.Financiamento} strokeWidth={2} dot />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default LeasingBeneficioChart
