/**
 * Flow V8 - Stepper Component
 * Side navigation showing 6 steps with completion status
 */

import React from 'react'
import type { StepIndex } from './validation.v8'

export interface Step {
  index: StepIndex
  label: string
  completed: boolean
}

export interface StepperV8Props {
  steps: Step[]
  currentStep: StepIndex
  onStepClick: (stepIndex: StepIndex) => void
}

export function StepperV8({ steps, currentStep, onStepClick }: StepperV8Props): JSX.Element {
  return (
    <nav className="v8-stepper" aria-label="Progress">
      <ol className="v8-stepper-list">
        {steps.map((step) => {
          const isActive = step.index === currentStep
          const isCompleted = step.completed
          const isPending = !isActive && !isCompleted
          
          return (
            <li
              key={step.index}
              className={`v8-stepper-item${isActive ? ' active' : ''}${
                isCompleted ? ' completed' : ''
              }${isPending ? ' pending' : ''}`}
              onClick={() => onStepClick(step.index)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onStepClick(step.index)
                }
              }}
              aria-current={isActive ? 'step' : undefined}
            >
              <div className="v8-stepper-number" aria-hidden="true">
                {isCompleted ? '✓' : step.index + 1}
              </div>
              <div className="v8-stepper-label">{step.label}</div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
