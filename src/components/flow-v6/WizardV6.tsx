import React from 'react'
import './flow-v6.css'

type WizardStep = {
  title: string
  content: React.ReactNode
}

type WizardV6Props = {
  steps: WizardStep[]
  stepIndex: number
  onStepChange: (next: number) => void
  onFinish?: () => void
}

export function WizardV6({ steps, stepIndex, onStepChange, onFinish }: WizardV6Props) {
  const isFirst = stepIndex === 0
  const isLast = stepIndex === steps.length - 1
  const current = steps[stepIndex]

  const goPrev = () => {
    if (!isFirst) {
      onStepChange(stepIndex - 1)
    }
  }

  const goNext = () => {
    if (isLast) {
      onFinish?.()
      return
    }
    onStepChange(stepIndex + 1)
  }

  return (
    <div>
      <div>{current?.content}</div>
      <div className="flow-v6-wizard-nav">
        <button type="button" className="ghost" onClick={goPrev} disabled={isFirst}>
          Voltar
        </button>
        <button type="button" className="primary" onClick={goNext}>
          {isLast ? 'Gerar Proposta' : 'Próximo'}
        </button>
      </div>
    </div>
  )
}
