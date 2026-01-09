/**
 * Flow V8 - Leasing Page
 * 6-step wizard for Leasing proposals
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

export interface LeasingV8Props {
  values: Record<string, unknown>
  outputs: Record<string, unknown>
  onGenerateProposal: () => void | Promise<void>
}

const STEP_LABELS = [
  'Cliente',
  'Consumo & Tarifa',
  'Sistema',
  'Oferta de Leasing',
  'Projeções',
  'Revisão',
]

export function LeasingV8({ values, outputs, onGenerateProposal }: LeasingV8Props): JSX.Element {
  const [currentStep, setCurrentStep] = useState<StepIndex>(0)

  // Calculate step completion
  const steps = useMemo(() => {
    return STEP_LABELS.map((label, index) => ({
      index: index as StepIndex,
      label,
      completed: isStepComplete(index as StepIndex, values, 'leasing'),
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
        label: 'Mensalidade',
        value: outputs.mensalidade ? `R$ ${Number(outputs.mensalidade).toLocaleString('pt-BR')}` : '',
        fallback: '—',
      },
      {
        label: 'Prazo',
        value: outputs.prazo ? `${outputs.prazo} meses` : '',
        fallback: '—',
      },
    ]
  }, [outputs])

  // Calculate checklist from missing fields
  const checklist = useMemo(() => {
    const missing = getAllMissingFields(values, 'leasing')
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
                <strong>Etapa 4: Oferta de Leasing</strong>
                <br />
                Placeholder - Campos de oferta de leasing serão integrados na Fase 2.
              </p>
            </div>
          </div>
        )
      case 4:
        return (
          <div className="v8-field-grid">
            <div className="v8-alert info">
              <p>
                <strong>Etapa 5: Projeções</strong>
                <br />
                Placeholder - Projeções financeiras serão integradas na Fase 2.
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
    'Condições do Leasing',
    'Projeções Financeiras',
    'Revisão Final & Proposta',
  ]

  const stepDescriptions = [
    'Informações básicas do cliente e contato',
    'Consumo médio mensal e tarifa aplicável',
    'Tipo de instalação e configuração do sistema',
    'Prazo, entrada e condições do leasing',
    'Análise financeira e benefícios projetados',
    'Revise e gere a proposta de leasing',
  ]

  return (
    <FlowShellV8
      title="Leasing"
      subtitle="Simulador de proposta de leasing"
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
