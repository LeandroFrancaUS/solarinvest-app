import React from 'react'

type Metric = {
  label: string
  value: React.ReactNode
  align?: 'left' | 'right'
}

type CenarioCardProps = {
  title: string
  subtitle?: string
  selectable?: boolean
  selected?: boolean
  active?: boolean
  onToggle?: () => void
  metrics?: Metric[]
  children?: React.ReactNode
}

export function CenarioCard({
  title,
  subtitle,
  selectable = false,
  selected = false,
  active = false,
  onToggle,
  metrics,
  children,
}: CenarioCardProps) {
  const Element: 'div' | 'label' = selectable ? 'label' : 'div'
  const classes = [
    'cenario-card',
    selectable ? 'is-selectable' : '',
    selected ? 'is-selected' : '',
    active ? 'is-active' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Element className={classes}>
      {selectable ? (
        <span className="cenario-card__checkbox">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => {
              event.stopPropagation()
              onToggle?.()
            }}
          />
        </span>
      ) : null}
      <div className="cenario-card__content">
        <div className="cenario-card__heading">
          <strong>{title}</strong>
          {subtitle ? <small>{subtitle}</small> : null}
        </div>
        {metrics && metrics.length > 0 ? (
          <dl className="cenario-card__metrics">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className={`cenario-card__metric${metric.align === 'right' ? ' align-right' : ''}`}
              >
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {children ? <div className="cenario-card__extra">{children}</div> : null}
      </div>
    </Element>
  )
}
