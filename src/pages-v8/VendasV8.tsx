/**
 * Flow V8 - Vendas Page
 * 6-step wizard for Sales proposals
 */

import React, { useState, useMemo } from 'react'
import { FlowShellV8 } from '../components/flow-v8/FlowShellV8'
import { StepperV8 } from '../components/flow-v8/StepperV8'
import { StepPanelV8 } from '../components/flow-v8/StepPanelV8'
import { SummarySidebarV8 } from '../components/flow-v8/SummarySidebarV8'
import {
  type StepIndex,
  isStepComplete,
  getAllMissingFields,
} from '../components/flow-v8/validation.v8'
import { focusField } from '../components/flow-v8/focusField.v8'

export interface VendasV8Props {
  values: Record<string, unknown>
  outputs: Record<string, unknown>
  onGenerateProposal: () => void | Promise<void>
}

const STEP_LABELS = [
  'Cliente',
  'Consumo & Tarifa',
  'Sistema',
  'Kit & Custos',
  'Resultados',
  'Revisão',
]

export function VendasV8({ values, outputs, onGenerateProposal }: VendasV8Props): JSX.Element {
  const [currentStep, setCurrentStep] = useState<StepIndex>(0)

  // Calculate step completion
  const steps = useMemo(() => {
    return STEP_LABELS.map((label, index) => ({
      index: index as StepIndex,
      label,
      completed: isStepComplete(index as StepIndex, values, 'vendas'),
    }))
  }, [values])

  // Calculate KPIs from outputs
  const kpis = useMemo(() => {
    return [
      {
        label: 'Potência (kWp)',
        value: outputs.potenciaKwp ? `${outputs.potenciaKwp} kWp` : '',
        fallback: '—',
      },
      {
        label: 'Investimento',
        value: outputs.valorTotal ? `R$ ${Number(outputs.valorTotal).toLocaleString('pt-BR')}` : '',
        fallback: '—',
      },
      {
        label: 'Payback',
        value: outputs.payback ? `${outputs.payback} anos` : '',
        fallback: '—',
      },
    ]
  }, [outputs])

  // Calculate checklist from missing fields
  const checklist = useMemo(() => {
    const missing = getAllMissingFields(values, 'vendas')
    return missing.map((m) => ({
      label: m.label,
      completed: false,
      step: m.step,
      field: m.field,
    }))
  }, [values])

  // Check if manual badge should show
  const showManualBadge = useMemo(() => {
    const tipoInstalacao = values.tipoInstalacao as string
    const tipoSistema = values.tipoSistema as string
    return (
      tipoInstalacao === 'solo' ||
      tipoInstalacao === 'outros' ||
      tipoSistema === 'HIBRIDO' ||
      tipoSistema === 'OFF_GRID'
    )
  }, [values])

  const manualBadgeReason = useMemo(() => {
    const tipoInstalacao = values.tipoInstalacao as string
    const tipoSistema = values.tipoSistema as string
    if (tipoInstalacao === 'solo' || tipoInstalacao === 'outros') {
      return 'Tipo de instalação requer orçamento manual.'
    }
    if (tipoSistema === 'HIBRIDO' || tipoSistema === 'OFF_GRID') {
      return 'Sistema híbrido ou off-grid requer configuração manual.'
    }
    return ''
  }, [values])

  // Navigation handlers
  const handleStepClick = (stepIndex: StepIndex) => {
    setCurrentStep(stepIndex)
  }

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as StepIndex)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((currentStep - 1) as StepIndex)
    }
  }

  const handleChecklistItemClick = (item: { step: StepIndex; field: string }) => {
    setCurrentStep(item.step)
    setTimeout(() => {
      focusField(item.field, '.v8-step-content')
    }, 100)
  }

  const handleCTAClick = () => {
    if (checklist.length > 0) {
      // Navigate to first incomplete step
      const firstIncomplete = checklist[0]
      handleChecklistItemClick(firstIncomplete)
    } else {
      onGenerateProposal()
    }
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="v8-field-grid">
            <div className="v8-alert info">
              <p>
                <strong>Etapa 1: Cliente</strong>
                <br />
                Placeholder - Os campos de cliente serão integrados na Fase 2 (headless extraction).
              </p>
            </div>
          </div>
        )
      case 1:
        return (
          <div className="v8-field-grid">
            <div className="v8-alert info">
              <p>
                <strong>Etapa 2: Consumo & Tarifa</strong>
                <br />
                Placeholder - Os campos de consumo serão integrados na Fase 2 (headless extraction).
                <br />
                <br />
                <em>Esta etapa deve estar funcional com campos reais antes de considerar completo.</em>
              </p>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="v8-field-grid">
            <div className="v8-alert info">
              <p>
                <strong>Etapa 3: Sistema</strong>
                <br />
                Placeholder - Tipo de instalação e sistema serão integrados na Fase 2.
              </p>
            </div>
            {showManualBadge && (
              <div className="v8-alert warning">
                <p>
                  <strong>⚠️ {manualBadgeReason}</strong>
                </p>
              </div>
            )}
          </div>
        )
      case 3:
        return (
          <div className="v8-field-grid">
            <div className="v8-alert info">
              <p>
                <strong>Etapa 4: Kit & Custos</strong>
                <br />
                Placeholder - Campos de kit e custos serão integrados na Fase 2.
              </p>
            </div>
          </div>
        )
      case 4:
        return (
          <div className="v8-field-grid">
            <div className="v8-alert info">
              <p>
                <strong>Etapa 5: Resultados</strong>
                <br />
                Placeholder - KPIs e gráficos de resultados serão integrados na Fase 2.
              </p>
            </div>
          </div>
        )
      case 5:
        return (
          <div className="v8-field-grid">
            <div className="v8-alert success">
              <p>
                <strong>Etapa 6: Revisão & Gerar Proposta</strong>
                <br />
                Revise todas as informações antes de gerar a proposta.
                <br />
                <br />
                <em>Esta etapa deve ter ações funcionais antes de considerar completo.</em>
              </p>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  const stepTitles = [
    'Dados do Cliente',
    'Consumo & Tarifa Elétrica',
    'Configuração do Sistema',
    'Kit e Custos do Projeto',
    'Análise de Resultados',
    'Revisão Final & Proposta',
  ]

  const stepDescriptions = [
    'Informações básicas do cliente e contato',
    'Consumo médio mensal e tarifa aplicável',
    'Tipo de instalação e configuração do sistema',
    'Seleção de equipamentos e valores do projeto',
    'Análise financeira e projeções de economia',
    'Revise e gere a proposta comercial',
  ]

  return (
    <FlowShellV8
      title="Vendas"
      subtitle="Simulador de proposta comercial"
      stepper={
        <StepperV8 steps={steps} currentStep={currentStep} onStepClick={handleStepClick} />
      }
      content={
        <StepPanelV8
          currentStep={currentStep}
          totalSteps={6}
          title={stepTitles[currentStep]}
          description={stepDescriptions[currentStep]}
          onPrevious={handlePrevious}
          onNext={handleNext}
          canGoNext={currentStep < 5}
          canGoPrevious={currentStep > 0}
          nextLabel={currentStep === 5 ? 'Concluir' : 'Próximo'}
        >
          {renderStepContent()}
        </StepPanelV8>
      }
      sidebar={
        <SummarySidebarV8
          kpis={kpis}
          checklist={checklist}
          showManualBadge={showManualBadge}
          manualBadgeReason={manualBadgeReason}
          ctaLabel="Gerar Proposta"
          ctaDisabled={false}
          onCTAClick={handleCTAClick}
          onChecklistItemClick={handleChecklistItemClick}
        />
      }
    />
  )
}
