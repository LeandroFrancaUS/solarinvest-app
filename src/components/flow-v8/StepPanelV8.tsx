/**
 * Flow V8 - Step Panel Component
 * Renders one step at a time with navigation controls
 */

import React from 'react'
import type { StepIndex } from './validation.v8'

export interface StepPanelV8Props {
  currentStep: StepIndex
  totalSteps: number
  title: string
  description: string
  children: React.ReactNode
  onPrevious: () => void
  onNext: () => void
  canGoNext: boolean
  canGoPrevious: boolean
  nextLabel?: string
}

export function StepPanelV8({
  currentStep,
  totalSteps,
  title,
  description,
  children,
  onPrevious,
  onNext,
  canGoNext,
  canGoPrevious,
  nextLabel = 'Próximo',
}: StepPanelV8Props): JSX.Element {
  return (
    <div className="v8-step-panel">
      <header className="v8-step-header">
        <p className="v8-step-description" style={{ marginBottom: '4px', fontSize: '12px', color: 'var(--v8-text-tertiary)' }}>
          Etapa {currentStep + 1} de {totalSteps}
        </p>
        <h2 className="v8-step-title">{title}</h2>
        <p className="v8-step-description">{description}</p>
      </header>
      
      <div className="v8-step-content">{children}</div>
      
      <footer className="v8-step-footer">
        <button
          type="button"
          className="v8-btn v8-btn-ghost"
          onClick={onPrevious}
          disabled={!canGoPrevious}
        >
          ← Voltar
        </button>
        
        <div className="v8-step-footer-actions">
          <button
            type="button"
            className="v8-btn v8-btn-primary"
            onClick={onNext}
            disabled={!canGoNext}
          >
            {nextLabel} →
          </button>
        </div>
      </footer>
    </div>
  )
}
