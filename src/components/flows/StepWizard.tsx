import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { InlineValidationBar } from './InlineValidationBar'
import './flows.css'

export interface StepConfig {
  id: string
  title: string
  description?: string
  render: () => ReactNode
  validate?: () => string[]
}

interface StepWizardProps {
  steps: StepConfig[]
  initialStep?: number
  activeStep?: number
  onStepChange?: (index: number) => void
  onComplete?: () => void
}

export function StepWizard({ steps, initialStep = 0, activeStep, onStepChange, onComplete }: StepWizardProps) {
  const [internalStep, setInternalStep] = useState(initialStep)
  const stepIndex = activeStep ?? internalStep

  const currentMissing = useMemo(() => steps[stepIndex]?.validate?.() ?? [], [stepIndex, steps])
  const progressLabel = `${Math.min(stepIndex + 1, steps.length)}/${steps.length}`

  const setStep = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), steps.length - 1)
    if (activeStep == null) {
      setInternalStep(clamped)
    }
    onStepChange?.(clamped)
  }

  const goNext = () => {
    if (stepIndex >= steps.length - 1) {
      onComplete?.()
      return
    }
    setStep(stepIndex + 1)
  }

  const goPrev = () => setStep(stepIndex - 1)

  return (
    <div className="wizard">
      <div className="wizard-header">
        <div>
          <p className="wizard-progress">Etapa {progressLabel}</p>
          <h2>{steps[stepIndex]?.title}</h2>
          {steps[stepIndex]?.description ? <p className="wizard-description">{steps[stepIndex]?.description}</p> : null}
        </div>
        <div className="wizard-nav">
          <button className="ghost" onClick={goPrev} disabled={stepIndex === 0}>
            Voltar
          </button>
          <button className="primary" onClick={goNext} disabled={currentMissing.length > 0}>
            {stepIndex === steps.length - 1 ? 'Concluir' : 'Próximo'}
          </button>
        </div>
      </div>

      {currentMissing.length > 0 ? <InlineValidationBar messages={currentMissing} /> : null}

      <div className="wizard-body">{steps[stepIndex]?.render()}</div>

      <div className="wizard-footer">
        <div className="wizard-progress-bar">
          <div className="wizard-progress-bar-inner" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="wizard-steps">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              className={`wizard-step ${idx === stepIndex ? 'active' : ''}`}
              onClick={() => setStep(idx)}
            >
              <span className="wizard-step-index">{idx + 1}</span>
              <span className="wizard-step-title">{step.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
