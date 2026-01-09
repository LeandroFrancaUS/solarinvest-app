/**
 * Flow V8 - Proposal Mode Selector
 * Toggle between Simple and Complete proposal workflows
 */

import React from 'react'

export type ProposalMode = 'simple' | 'complete'

export interface ProposalModeSelectorProps {
  mode: ProposalMode
  onModeChange: (mode: ProposalMode) => void
  flowType: 'vendas' | 'leasing'
}

export function ProposalModeSelector({
  mode,
  onModeChange,
  flowType,
}: ProposalModeSelectorProps): JSX.Element {
  const simpleLabel = flowType === 'vendas' ? 'Simples (Automático)' : 'Simples (Básico)'
  const completeLabel = flowType === 'vendas' ? 'Completa (Manual)' : 'Completa (Avançado)'
  
  const simpleDesc = flowType === 'vendas' 
    ? 'Orçamento automático, geração rápida'
    : 'Sem campos avançados, mais rápido'
    
  const completeDesc = flowType === 'vendas'
    ? 'Seleção manual de equipamentos e análise completa'
    : 'Configuração completa com projeções financeiras'

  return (
    <div className="v8-mode-selector">
      <button
        type="button"
        className={`v8-mode-option${mode === 'simple' ? ' active' : ''}`}
        onClick={() => onModeChange('simple')}
      >
        <div className="v8-mode-option-header">
          <span className="v8-mode-radio">{mode === 'simple' ? '●' : '○'}</span>
          <strong>{simpleLabel}</strong>
        </div>
        <p className="v8-mode-option-desc">{simpleDesc}</p>
      </button>
      
      <button
        type="button"
        className={`v8-mode-option${mode === 'complete' ? ' active' : ''}`}
        onClick={() => onModeChange('complete')}
      >
        <div className="v8-mode-option-header">
          <span className="v8-mode-radio">{mode === 'complete' ? '●' : '○'}</span>
          <strong>{completeLabel}</strong>
        </div>
        <p className="v8-mode-option-desc">{completeDesc}</p>
      </button>
    </div>
  )
}
