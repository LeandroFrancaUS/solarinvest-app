import './flows.css'

export interface SummaryKpi {
  label: string
  value: string
  hint?: string
}

export interface SummaryChecklistItem {
  label: string
  ok: boolean
  onClick?: () => void
}

interface StickySummaryProps {
  title?: string
  kpis: SummaryKpi[]
  checklist: SummaryChecklistItem[]
  primaryLabel: string
  onPrimaryAction: () => void
  disabled?: boolean
  secondary?: { label: string; onClick: () => void }
}

export function StickySummary({
  title = 'Resumo instantâneo',
  kpis,
  checklist,
  primaryLabel,
  onPrimaryAction,
  disabled,
  secondary,
}: StickySummaryProps) {
  const pending = checklist.filter((item) => !item.ok).length
  const primaryText = pending > 0 ? 'Ver pendências' : primaryLabel

  return (
    <div className="sticky-summary">
      <div className="sticky-summary-header">
        <h3>{title}</h3>
        <p className="sticky-summary-subtitle">Dados principais sempre visíveis</p>
      </div>

      <dl className="sticky-summary-kpis">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="sticky-summary-kpi">
            <dt>{kpi.label}</dt>
            <dd>
              <span>{kpi.value}</span>
              {kpi.hint ? <small>{kpi.hint}</small> : null}
            </dd>
          </div>
        ))}
      </dl>

      <div className="sticky-summary-checklist">
        <h4>Checklist</h4>
        <ul>
          {checklist.map((item) => (
            <li key={item.label} className={item.ok ? 'ok' : 'pending'}>
              <button type="button" onClick={item.onClick} className="linkish">
                {item.ok ? '✔' : '•'} {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sticky-summary-actions">
        <button className="primary" onClick={onPrimaryAction} disabled={disabled}>
          {primaryText}
        </button>
        {secondary ? (
          <button className="ghost" onClick={secondary.onClick}>
            {secondary.label}
          </button>
        ) : null}
        {pending > 0 ? <p className="sticky-summary-hint">Complete as pendências para gerar a proposta.</p> : null}
      </div>
    </div>
  )
}
