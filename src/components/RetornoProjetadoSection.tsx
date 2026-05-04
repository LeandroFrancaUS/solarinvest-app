// src/components/RetornoProjetadoSection.tsx
// "Retorno Financeiro" card shown in the vendas and leasing tabs.
// All state and handlers remain in App.tsx; this component is purely presentational.

import * as React from 'react'
import type { RetornoProjetado } from '../lib/finance/roi'
import { currency } from '../utils/formatters'

export type RetornoProjetadoSectionProps = {
  retornoProjetado: RetornoProjetado | null
  retornoStatus: 'idle' | 'calculating'
  retornoError: string | null
  capexTotal: number
  onCalcular: () => void
}

function formatPaybackDuration(meses: number): string {
  if (!Number.isFinite(meses) || meses <= 0) {
    return '0 meses'
  }
  const anosInteiros = Math.floor(meses / 12)
  const mesesRestantes = meses % 12
  const partes: string[] = []
  if (anosInteiros > 0) {
    partes.push(`${anosInteiros} ${anosInteiros === 1 ? 'ano' : 'anos'}`)
  }
  if (mesesRestantes > 0 || partes.length === 0) {
    partes.push(`${mesesRestantes} ${mesesRestantes === 1 ? 'mês' : 'meses'}`)
  }
  return partes.join(' e ')
}

export function RetornoProjetadoSection({
  retornoProjetado,
  retornoStatus,
  retornoError,
  capexTotal,
  onCalcular,
}: RetornoProjetadoSectionProps) {
  const resultado = retornoProjetado

  const paybackLabel = resultado?.payback
    ? `${resultado.payback} meses`
    : 'Não atingido em 30 anos'
  const roiLabel = resultado
    ? new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(resultado.roi)
    : ''
  const showVpl = Boolean(resultado && typeof resultado.vpl === 'number')
  const vplLabel = showVpl && resultado ? currency(resultado.vpl as number) : ''

  const kpis: { label: string; value: string }[] = [
    { label: 'Payback (meses)', value: paybackLabel },
    { label: 'ROI acumulado (30 anos): ', value: roiLabel },
  ]

  if (showVpl) {
    kpis.push({ label: 'VPL', value: vplLabel })
  }

  let financialReturnChart: React.ReactNode = null

  if (resultado) {
    const years = [5, 10, 15, 20, 30] as const
    const capexTotalNorm = Number.isFinite(capexTotal) ? Math.max(0, Number(capexTotal)) : 0
    const investimentoInicialResultado = Number.isFinite(resultado.investimentoInicial)
      ? Math.max(0, Number(resultado.investimentoInicial))
      : 0
    const investimentoConsiderado = Math.max(capexTotalNorm, investimentoInicialResultado)
    const cumulativeSavings: number[] = []
    let saldoAcumuladoVista = investimentoConsiderado > 0 ? -investimentoConsiderado : 0

    for (let mes = 0; mes < resultado.economia.length; mes += 1) {
      saldoAcumuladoVista += resultado.economia[mes] ?? 0
      cumulativeSavings.push(saldoAcumuladoVista)
    }

    const paybackIndexVista = cumulativeSavings.findIndex((value) => value >= 0)
    const paybackMesesVista = paybackIndexVista >= 0 ? paybackIndexVista + 1 : null
    const paybackLabelVista =
      paybackMesesVista != null ? formatPaybackDuration(paybackMesesVista) : 'Não alcançado em 30 anos'

    const yearsData = years.map((year) => {
      const monthIndex = Math.min(year * 12 - 1, cumulativeSavings.length - 1)
      const value =
        monthIndex >= 0
          ? cumulativeSavings[monthIndex]
          : cumulativeSavings.length > 0
          ? cumulativeSavings[cumulativeSavings.length - 1]
          : saldoAcumuladoVista
      return { year, value }
    })

    const paybackYearIndex =
      paybackMesesVista != null ? years.findIndex((year) => paybackMesesVista <= year * 12) : -1

    const chartValues = yearsData.map((item) => item.value ?? 0)
    const maxPositive = Math.max(0, ...chartValues)
    const minNegative = Math.min(0, ...chartValues)
    const hasPositive = maxPositive > 0
    const hasNegative = minNegative < 0
    let zeroPositionPercent = 0
    if (hasPositive && hasNegative) {
      const totalSpan = maxPositive + Math.abs(minNegative)
      zeroPositionPercent = totalSpan > 0 ? (Math.abs(minNegative) / totalSpan) * 100 : 0
    } else if (!hasPositive && hasNegative) {
      zeroPositionPercent = 100
    } else {
      zeroPositionPercent = 0
    }
    const positiveSpan = 100 - zeroPositionPercent
    const negativeSpan = zeroPositionPercent
    const zeroPositionStyle = {
      '--zero-position': `${zeroPositionPercent}%`,
    } as React.CSSProperties

    financialReturnChart = (
      <div className="financial-return-chart">
        <div className="financial-return-chart-header">
          <div>
            <h3>Benefício acumulado em 30 anos</h3>
            <p>
              Evolução das economias projetadas frente ao investimento à vista
              {investimentoConsiderado > 0 ? (
                <>
                  {' '}
                  de <strong>{currency(investimentoConsiderado)}</strong>
                </>
              ) : null}
              .
            </p>
          </div>
          <div className="financial-return-chart-payback-summary">
            <span>Payback estimado: </span>
            <strong>{paybackMesesVista != null ? paybackLabelVista : 'Não alcançado em 30 anos'}</strong>
          </div>
        </div>
        <ul className="financial-return-chart-list">
          {yearsData.map((item, index) => {
            const value = item.value ?? 0
            const valueLabel = currency(value)
            const isPositive = value >= 0
            const spanLimit = isPositive ? positiveSpan : negativeSpan
            let proportionalWidth = 0
            if (isPositive) {
              proportionalWidth = hasPositive && spanLimit > 0 ? (value / maxPositive) * spanLimit : 0
            } else {
              proportionalWidth = hasNegative && spanLimit > 0 ? (Math.abs(value) / Math.abs(minNegative)) * spanLimit : 0
            }
            const width = Number.isFinite(proportionalWidth)
              ? Math.min(spanLimit, Math.max(0, proportionalWidth))
              : 0
            const left = isPositive ? zeroPositionPercent : zeroPositionPercent - width
            const barStyle = {
              width: `${width.toFixed(2)}%`,
              left: `${left.toFixed(2)}%`,
            } as React.CSSProperties
            const valueClassName = [
              'financial-return-chart-value',
              isPositive ? 'positive' : 'negative',
            ].join(' ')
            const barClassName = [
              'financial-return-chart-bar',
              isPositive ? 'positive' : 'negative',
              paybackYearIndex === index && paybackMesesVista != null ? 'is-payback' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <li key={item.year} className="financial-return-chart-row">
                <div className="financial-return-chart-year">{item.year} anos</div>
                <div className="financial-return-chart-bar-area" style={zeroPositionStyle}>
                  <div className="financial-return-chart-bar-track" aria-hidden="true" />
                  <div className="financial-return-chart-axis" aria-hidden="true" />
                  <div
                    className={barClassName}
                    style={barStyle}
                    aria-hidden="true"
                    title={`${valueLabel} em ${item.year} anos`}
                  />
                </div>
                <div className={valueClassName}>
                  <span>{valueLabel}</span>
                  {paybackYearIndex === index && paybackMesesVista != null ? (
                    <span className="financial-return-chart-chip">Payback em {paybackLabelVista}</span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Retorno Financeiro</h2>
        <button
          type="button"
          className="primary"
          onClick={onCalcular}
          disabled={retornoStatus === 'calculating'}
        >
          {retornoStatus === 'calculating'
            ? 'Calculando…'
            : resultado
            ? 'Recalcular retorno'
            : 'Calcular retorno'}
        </button>
      </div>
      {retornoError ? <p className="field-error">{retornoError}</p> : null}
      {resultado ? (
        <>
          <div className="kpi-grid">
            {kpis.map((item) => (
              <div key={item.label} className="kpi">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          {financialReturnChart}
        </>
      ) : retornoStatus === 'calculating' ? (
        <p className="muted">Calculando projeções…</p>
      ) : (
        <p className="muted">Preencha os dados e clique em "Calcular retorno".</p>
      )}
    </section>
  )
}
