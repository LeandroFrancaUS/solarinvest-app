import type { ReactNode } from 'react'
import './flow-v5.css'

interface SummaryItem {
  label: string
  value?: string | number | ReactNode
  hint?: string
}

interface PendingItem {
  label: string
  fieldId?: string
  stepIndex?: number
}

interface SummarySidebarProps {
  title?: string
  modeBadge?: string
  manualReason?: string
  items: SummaryItem[]
  pending: PendingItem[]
  onNavigateToPending?: (pending: PendingItem) => void
  onGenerate?: () => void
  ctaLabel?: string
}

export function SummarySidebar({
  title = 'Resumo',
  modeBadge,
  manualReason,
  items,
  pending,
  onNavigateToPending,
  onGenerate,
  ctaLabel = 'Gerar Proposta',
}: SummarySidebarProps) {
  const hasPending = pending.length > 0
  const buttonLabel = hasPending ? 'Ver pendências' : ctaLabel

  return (
    <div className="card summary-sidebar">
      <header className="summary-sidebar__header">
        <div>
          <p className="summary-sidebar__eyebrow">Proposta</p>
          <h3>{title}</h3>
          {manualReason ? <p className="summary-sidebar__manual">{manualReason}</p> : null}
        </div>
        {modeBadge ? <span className="summary-sidebar__badge">{modeBadge}</span> : null}
      </header>

      <div className="summary-sidebar__content">
        <dl className="summary-sidebar__list">
          {items.map((item) => (
            <div key={item.label} className="summary-sidebar__row">
              <dt>{item.label}</dt>
              <dd>{item.value ?? '—'}</dd>
              {item.hint ? <small className="muted">{item.hint}</small> : null}
            </div>
          ))}
        </dl>

        <div className="summary-sidebar__pending">
          <p className="summary-sidebar__pending-title">
            {hasPending ? 'Pendências para gerar a proposta' : 'Tudo pronto'}
          </p>
          {hasPending ? (
            <ul>
              {pending.map((item) => (
                <li key={item.label}>
                  <button type="button" onClick={() => onNavigateToPending?.(item)}>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nenhuma pendência identificada.</p>
          )}
        </div>
      </div>

      <div className="summary-sidebar__footer">
        <button
          type="button"
          className={`primary${hasPending ? ' ghost' : ''}`}
          onClick={() => (hasPending ? onNavigateToPending?.(pending[0]) : onGenerate?.())}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}

export default SummarySidebar
