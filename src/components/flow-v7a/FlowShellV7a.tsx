import './flow-v7a.css'
import React from 'react'

export type FlowV7aStep = {
  id: string
  title: string
  description?: string
  content: React.ReactNode
}

export type FlowShellV7aProps = {
  title: string
  subtitle?: string
  currentStep: number
  steps: FlowV7aStep[]
  kpis?: { label: string; value: string | number | null }[]
  pending?: string[]
  manualReason?: string | null
  onChangeStep: (next: number) => void
  onGenerateProposal: () => void
}

export function FlowShellV7a({
  title,
  subtitle,
  currentStep,
  steps,
  kpis = [],
  pending = [],
  manualReason,
  onChangeStep,
  onGenerateProposal,
}: FlowShellV7aProps) {
  const totalSteps = steps.length
  const goPrev = () => onChangeStep(Math.max(0, currentStep - 1))
  const goNext = () => onChangeStep(Math.min(totalSteps - 1, currentStep + 1))

  return (
    <div className="v7a-shell">
      <div className="v7a-header">
        <div className="v7a-header__top">
          <div>
            <div className="v7a-title">{title}</div>
            {subtitle ? <div className="v7a-subtitle">{subtitle}</div> : null}
          </div>
          <div className="v7a-chip">Flow V7a</div>
        </div>
        <div className="v7a-subtitle">Etapa {currentStep + 1} de {totalSteps}</div>
      </div>

      <div className="v7a-grid">
        <aside className="v7a-panel v7a-stepper">
          {steps.map((step, index) => {
            const status = index === currentStep ? 'Em andamento' : index < currentStep ? 'Concluído' : 'Pendente'
            return (
              <button
                key={step.id}
                type="button"
                className={`v7a-stepper__item${index === currentStep ? ' v7a-stepper__item--active' : ''}`}
                onClick={() => onChangeStep(index)}
              >
                <div className="v7a-stepper__number">{index + 1}</div>
                <div className="v7a-stepper__label">
                  <span className="v7a-stepper__title">{step.title}</span>
                  <span className="v7a-stepper__status">{status}</span>
                </div>
              </button>
            )
          })}
        </aside>

        <section className="v7a-panel v7a-step-panel">
          <div className="v7a-step-panel__heading">
            <div className="v7a-step-panel__title">{steps[currentStep]?.title}</div>
            {steps[currentStep]?.description ? <div className="v7a-step-panel__desc">{steps[currentStep]?.description}</div> : null}
          </div>

          <div className="v7a-fields-grid">{steps[currentStep]?.content}</div>

          <div className="v7a-footer">
            <button type="button" className="v7a-cta secondary" onClick={goPrev} disabled={currentStep === 0}>
              Voltar
            </button>
            <button type="button" className="v7a-cta" onClick={goNext}>
              Próximo
            </button>
          </div>
        </section>

        <aside className="v7a-panel v7a-sidebar">
          {manualReason ? (
            <div className="v7a-placeholder" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Caso manual</div>
              <div style={{ color: 'var(--v7a-muted)' }}>{manualReason}</div>
            </div>
          ) : null}

          {kpis.map((kpi) => (
            <div key={kpi.label} className="v7a-kpi">
              <div className="v7a-kpi__label">{kpi.label}</div>
              <div className="v7a-kpi__value">{kpi.value ?? '—'}</div>
            </div>
          ))}

          {pending.length ? (
            <div className="v7a-placeholder">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Pendências</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--v7a-muted)' }}>
                {pending.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            className="v7a-cta"
            onClick={() => {
              if (pending.length) {
                onChangeStep(Math.max(0, currentStep))
                return
              }
              onGenerateProposal()
            }}
          >
            {pending.length ? 'Ver pendências' : 'Gerar Proposta'}
          </button>
        </aside>
      </div>
    </div>
  )
}
