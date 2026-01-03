import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import './flow-v5.css'

export interface WizardStep {
  id: string
  title: string
  description?: ReactNode
  content: ReactNode
}

interface WizardProps {
  steps: WizardStep[]
  initialStep?: number
  onChangeStep?: (index: number, step: WizardStep) => void
  footer?: (props: { currentStep: number; totalSteps: number; goNext: () => void; goPrev: () => void }) => ReactNode
}

export function Wizard({ steps, initialStep = 0, onChangeStep, footer }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(() => Math.min(initialStep, steps.length - 1))

  const step = useMemo(() => steps[currentStep], [steps, currentStep])
  const totalSteps = steps.length

  const goPrev = () => {
    setCurrentStep((prev) => {
      const next = Math.max(0, prev - 1)
      if (next !== prev) {
        onChangeStep?.(next, steps[next])
      }
      return next
    })
  }

  const goNext = () => {
    setCurrentStep((prev) => {
      const next = Math.min(totalSteps - 1, prev + 1)
      if (next !== prev) {
        onChangeStep?.(next, steps[next])
      }
      return next
    })
  }

  return (
    <div className="wizard">
      <div className="wizard__progress" aria-label={`Etapa ${currentStep + 1} de ${totalSteps}`}>
        {steps.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`wizard__dot${index === currentStep ? ' is-active' : ''}${index < currentStep ? ' is-complete' : ''}`}
            onClick={() => {
              setCurrentStep(index)
              onChangeStep?.(index, steps[index])
            }}
            aria-current={index === currentStep}
          >
            <span className="wizard__dot-label">{index + 1}</span>
            <span className="wizard__dot-title">{item.title}</span>
          </button>
        ))}
      </div>
      <div className="wizard__content" role="group" aria-label={`Etapa: ${step.title}`}>
        {step.content}
      </div>
      <div className="wizard__footer">
        <div className="wizard__footer-left">
          <span>
            Etapa {currentStep + 1} de {totalSteps}
          </span>
          <strong>{step.title}</strong>
        </div>
        <div className="wizard__footer-actions">
          <button type="button" className="ghost" onClick={goPrev} disabled={currentStep === 0}>
            Voltar
          </button>
          <button type="button" className="primary" onClick={goNext} disabled={currentStep === totalSteps - 1}>
            Avançar
          </button>
        </div>
      </div>
      {footer ? footer({ currentStep, totalSteps, goNext, goPrev }) : null}
    </div>
  )
}

export default Wizard
