import React from 'react'
import './flow-v6.css'

type SummaryKpi = {
  label: string
  value?: string | number | null
}

type Pendencia = {
  label: string
  step: number
}

type SummarySidebarV6Props = {
  kpis: SummaryKpi[]
  pendencias: Pendencia[]
  modoLabel?: string
  onVerPendencias: () => void
  onGerarProposta: () => void
}

export function SummarySidebarV6({
  kpis,
  pendencias,
  modoLabel,
  onVerPendencias,
  onGerarProposta,
}: SummarySidebarV6Props) {
  const hasPendencias = pendencias.length > 0

  return (
    <div>
      <h3>Resumo</h3>
      <div className="flow-v6-kpi">
        <span>Modo</span>
        <strong>{modoLabel ?? '—'}</strong>
      </div>
      {kpis.map((kpi) => (
        <div key={kpi.label} className="flow-v6-kpi">
          <span>{kpi.label}</span>
          <strong>{kpi.value ?? '—'}</strong>
        </div>
      ))}

      {hasPendencias ? (
        <div className="flow-v6-pendencias">
          <h4>Pendências</h4>
          <ul>
            {pendencias.map((item) => (
              <li key={`${item.label}-${item.step}`}>{item.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flow-v6-cta">
        {hasPendencias ? (
          <button type="button" className="ghost" onClick={onVerPendencias}>
            Ver pendências
          </button>
        ) : null}
        <button type="button" className="primary" onClick={hasPendencias ? onVerPendencias : onGerarProposta}>
          {hasPendencias ? 'Revisar antes de gerar' : 'Gerar Proposta'}
        </button>
      </div>
    </div>
  )
}
