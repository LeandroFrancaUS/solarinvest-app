import React, { useMemo } from 'react'

export type BenefitChartPoint = {
  ano: number
  label: string
  value: number
  marker?: string | null
}

export type BenefitChartHighlight = {
  label: string
  value: string
  description?: React.ReactNode
}

type BenefitBarChartProps = {
  id?: string
  title: string
  subtitle?: React.ReactNode
  note?: React.ReactNode
  points: BenefitChartPoint[]
  highlights?: BenefitChartHighlight[]
  formatValue: (value: number) => string
  emptyMessage: string
  variant?: 'leasing' | 'venda'
}

const BenefitBarChart: React.FC<BenefitBarChartProps> = ({
  id,
  title,
  subtitle,
  note,
  points,
  highlights,
  formatValue,
  emptyMessage,
  variant,
}) => {
  const safePoints = useMemo(
    () => points.filter((point) => Number.isFinite(point.value)),
    [points],
  )

  if (safePoints.length === 0) {
    return (
      <section
        id={id}
        className={`print-section print-chart-section keep-together avoid-break print-benefit-chart${
          variant ? ` print-benefit-chart--${variant}` : ''
        }`}
      >
        <h2 className="section-title keep-with-next">{title}</h2>
        {subtitle ? <div className="section-subtitle keep-with-next">{subtitle}</div> : null}
        <p className="muted no-break-inside">{emptyMessage}</p>
        {note ? <div className="print-benefit-chart__note no-break-inside">{note}</div> : null}
      </section>
    )
  }

  const maxPositive = safePoints.reduce((acc, point) => (point.value > acc ? point.value : acc), 0)
  const maxNegative = safePoints.reduce(
    (acc, point) => (point.value < 0 && Math.abs(point.value) > acc ? Math.abs(point.value) : acc),
    0,
  )
  const totalRange = maxPositive + maxNegative

  let positiveArea = 50
  let negativeArea = 50
  if (totalRange > 0) {
    positiveArea = maxPositive > 0 ? (maxPositive / totalRange) * 100 : 0
    negativeArea = maxNegative > 0 ? (maxNegative / totalRange) * 100 : 0
  }

  return (
    <section
      id={id}
      className={`print-section print-chart-section keep-together avoid-break print-benefit-chart${
        variant ? ` print-benefit-chart--${variant}` : ''
      }`}
    >
      <h2 className="section-title keep-with-next">{title}</h2>
      {subtitle ? <div className="section-subtitle keep-with-next">{subtitle}</div> : null}
      <div className="print-chart-layout print-benefit-chart__layout">
        <div className="print-chart" data-print-chart>
          <div className="print-benefit-chart__bars" role="list">
            {safePoints.map((point) => {
              const positiveHeight =
                point.value > 0 && maxPositive > 0 ? (point.value / maxPositive) * 100 : 0
              const negativeHeight =
                point.value < 0 && maxNegative > 0 ? (Math.abs(point.value) / maxNegative) * 100 : 0

              return (
                <div className="print-benefit-chart__bar" role="listitem" key={point.ano}>
                  <div className="print-benefit-chart__bar-track" aria-hidden="true">
                    <div
                      className="print-benefit-chart__positive-zone"
                      style={{ height: `${positiveArea}%` }}
                    >
                      <div
                        className="print-benefit-chart__bar-fill print-benefit-chart__bar-fill--positive"
                        style={{ height: `${positiveHeight}%` }}
                      />
                    </div>
                    <div className="print-benefit-chart__axis" />
                    <div
                      className="print-benefit-chart__negative-zone"
                      style={{ height: `${negativeArea}%` }}
                    >
                      <div
                        className="print-benefit-chart__bar-fill print-benefit-chart__bar-fill--negative"
                        style={{ height: `${negativeHeight}%` }}
                      />
                    </div>
                  </div>
                  {point.marker ? (
                    <span className="print-benefit-chart__marker">{point.marker}</span>
                  ) : null}
                  <span className="print-benefit-chart__value">{formatValue(point.value)}</span>
                  <span className="print-benefit-chart__label">{point.label}</span>
                </div>
              )
            })}
          </div>
        </div>
        {highlights?.length ? (
          <ul className="print-benefit-chart__highlights">
            {highlights.map((highlight, index) => (
              <li className="print-benefit-chart__highlights-item" key={`${highlight.label}-${index}`}>
                <span className="print-benefit-chart__highlights-label">{highlight.label}</span>
                <span className="print-benefit-chart__highlights-value">{highlight.value}</span>
                {highlight.description ? (
                  <span className="print-benefit-chart__highlights-description">
                    {highlight.description}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {note ? <div className="print-benefit-chart__note no-break-inside">{note}</div> : null}
    </section>
  )
}

export default BenefitBarChart
