/**
 * Flow V8 - Leasing Page
 * 6-step wizard for Leasing proposals with integrated headless fields
 */

import React, { useState, useMemo } from 'react'
import { FlowShellV8 } from '../components/flow-v8/FlowShellV8'
import { StepperV8 } from '../components/flow-v8/StepperV8'
import { StepPanelV8 } from '../components/flow-v8/StepPanelV8'
import { SummarySidebarV8 } from '../components/flow-v8/SummarySidebarV8'
import { ProposalPreviewModal } from '../components/flow-v8/ProposalPreviewModal'
import { ProposalModeSelector, type ProposalMode } from '../components/flow-v8/ProposalModeSelector'
import {
  ClienteFields,
  ConsumoTarifaFields,
  SistemaFields,
  GerarPropostaActions,
  Field,
} from '../legacy/headlessFields'
import {
  type StepIndex,
  isStepComplete,
  getMissingForStep,
  getAllMissingFields,
  canGenerateProposal,
} from '../components/flow-v8/validation.v8'
import { focusField } from '../components/flow-v8/focusField.v8'
import type { ClienteDados } from '../types/printableProposal'
import { labelWithTooltip } from '../components/InfoTooltip'
import { calcularMensalidadeSolarInvest } from '../lib/finance/calculations'
import type { TipoRede } from '../app/config'

export interface LeasingV8Props {
  // Client data
  cliente: ClienteDados
  onClienteChange: <K extends keyof ClienteDados>(key: K, value: ClienteDados[K]) => void
  segmentoCliente: string
  // Consumo & Tarifa
  kcKwhMes: number
  tarifaCheia: number
  taxaMinima: number
  encargosFixosExtras: number
  ufTarifa: string
  distribuidoraTarifa: string
  irradiacaoMedia: number
  ufsDisponiveis: string[]
  distribuidorasDisponiveis: string[]
  ufLabels: Record<string, string>
  taxaMinimaInputEmpty?: boolean
  onKcKwhMesChange: (value: number) => void
  onTarifaCheiaChange: (value: number) => void
  onTaxaMinimaChange: (value: string) => void
  onEncargosFixosExtrasChange: (value: number) => void
  onUfChange: (uf: string) => void
  onDistribuidoraChange: (dist: string) => void
  onIrradiacaoMediaChange: (value: number) => void
  // Sistema
  tipoInstalacao: string
  tipoInstalacaoOutro: string
  tipoSistema: string
  tiposInstalacao: Array<{ value: string; label: string }>
  tipoSistemaValues: string[]
  onTipoInstalacaoChange: (value: string) => void
  onTipoInstalacaoOutroChange: (value: string) => void
  onTipoSistemaChange: (value: string) => void
  isManualBudgetForced: boolean
  manualBudgetForceReason: string
  // Leasing specific
  leasingPrazo: number
  onLeasingPrazoChange: (value: number) => void
  // Outputs
  outputs: {
    potenciaKwp?: number | null
    mensalidade?: number | null
    prazo?: number | null
  }
  // Handlers
  onGenerateProposal: () => void | Promise<void>
}

const STEP_LABELS_SIMPLE = [
  'Cliente',
  'Consumo & Tarifa',
  'Sistema',
  'Revisão',
]

const STEP_LABELS_COMPLETE = [
  'Cliente',
  'Consumo & Tarifa',
  'Sistema',
  'Oferta de Leasing',
  'Projeções',
  'Revisão',
]

export function LeasingV8(props: LeasingV8Props): JSX.Element {
  const [proposalMode, setProposalMode] = useState<ProposalMode>('simple')
  const [currentStep, setCurrentStep] = useState<StepIndex>(0)
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Auto-calculate mensalidade using annual composition
  // Formula: mensalidade = energiaContratadaBase * tarifaComDesconto + tusdMedio
  // This matches the leasing proposal printable formula (annual aggregated composition)
  const calculatedMensalidade = useMemo(() => {
    // energiaContratadaBase: Contracted energy in kWh/month
    const energiaContratadaBase = Math.max(0, props.kcKwhMes || 0)
    
    // Desconto contratual: Default 0% for now (could be made configurable)
    const descontoContratualPct = 0 // TODO: Make this configurable when added to props
    const descontoFracao = descontoContratualPct / 100
    
    // Inflação energética: 8% default for first year projection
    const inflacaoEnergetica = 0.08
    const fatorInflacao = Math.pow(1 + inflacaoEnergetica, 0) // Year 1, so exponent is 0
    
    // Tarifa cheia com inflação
    const tarifaCheiaAno = Math.max(0, props.tarifaCheia || 0) * fatorInflacao
    
    // Tarifa com desconto aplicado
    const tarifaComDesconto = tarifaCheiaAno * (1 - descontoFracao)
    
    // TUSD médio: Estimate from TUSD components
    // Approximation: taxaMinima + encargosFixosExtras as monthly TUSD average
    // This is a simplified estimate since we don't have full parcelasLeasing data here
    const tusdMedio = Math.max(0, props.taxaMinima || 0) + Math.max(0, props.encargosFixosExtras || 0)
    
    // Final formula: mensalidade = energiaContratadaBase * tarifaComDesconto + tusdMedio
    const mensalidade = energiaContratadaBase * tarifaComDesconto + tusdMedio
    
    return mensalidade
  }, [props.kcKwhMes, props.tarifaCheia, props.taxaMinima, props.encargosFixosExtras])

  // Build values object for validation
  const values = useMemo(() => ({
    nomeCliente: props.cliente.nome,
    email: props.cliente.email,
    consumoMedioMensal: props.kcKwhMes,
    tipoInstalacao: props.tipoInstalacao,
    tipoSistema: props.tipoSistema,
    leasingPrazo: props.leasingPrazo,
  }), [props.cliente.nome, props.cliente.email, props.kcKwhMes, props.tipoInstalacao, props.tipoSistema, props.leasingPrazo])

  // Define step labels based on mode
  const stepLabels = useMemo(() => {
    if (proposalMode === 'simple') {
      return ['Cliente', 'Consumo & Tarifa', 'Sistema', 'Condições do Leasing', 'Revisão']
    }
    return ['Cliente', 'Consumo & Tarifa', 'Sistema', 'Oferta de Leasing', 'Projeções', 'Revisão']
  }, [proposalMode])

  // Calculate step completion
  const steps = useMemo(() => {
    return stepLabels.map((label, index) => ({
      index: index as StepIndex,
      label,
      completed: isStepComplete(index as StepIndex, values, 'leasing', currentStep),
    }))
  }, [stepLabels, values, currentStep])

  // Calculate KPIs from outputs (use calculated mensalidade if not provided)
  const kpis = useMemo(() => {
    const { potenciaKwp, prazo } = props.outputs
    const mensalidadeToShow = props.outputs.mensalidade || calculatedMensalidade
    return [
      {
        label: 'Potência (kWp)',
        value: potenciaKwp ? `${potenciaKwp.toFixed(2)} kWp` : '',
        fallback: '—',
      },
      {
        label: 'Mensalidade projetada',
        value: mensalidadeToShow ? `R$ ${Number(mensalidadeToShow).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '',
        fallback: '—',
      },
      {
        label: 'Prazo',
        value: prazo ? `${prazo} meses` : '',
        fallback: '—',
      },
    ]
  }, [props.outputs, calculatedMensalidade])

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
    return (
      props.tipoInstalacao === 'solo' ||
      props.tipoInstalacao === 'outros' ||
      props.tipoSistema === 'HIBRIDO' ||
      props.tipoSistema === 'OFF_GRID'
    )
  }, [props.tipoInstalacao, props.tipoSistema])

  const manualBadgeReason = useMemo(() => {
    if (props.tipoInstalacao === 'solo' || props.tipoInstalacao === 'outros') {
      return 'Tipo de instalação requer orçamento manual.'
    }
    if (props.tipoSistema === 'HIBRIDO' || props.tipoSistema === 'OFF_GRID') {
      return 'Sistema híbrido ou off-grid requer configuração manual.'
    }
    return ''
  }, [props.tipoInstalacao, props.tipoSistema])

  // Navigation handlers
  const handleStepClick = (stepIndex: StepIndex) => {
    setCurrentStep(stepIndex)
  }

  const handleNext = () => {
    const maxStep = proposalMode === 'simple' ? 4 : 5
    if (currentStep < maxStep) {
      // Check if current step is complete before allowing navigation
      const missing = getMissingForStep(currentStep, values, 'leasing')
      if (missing.length > 0) {
        // Highlight missing fields with visual feedback
        missing.forEach(fieldName => {
          // Find the input element by data-field attribute
          const selector = `[data-field="${fieldName}"]`
          const element = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector)
          
          if (element) {
            // Mark as invalid
            element.classList.add('invalid')
            element.setAttribute('aria-invalid', 'true')
            
            // Add shake animation to parent field
            const fieldContainer = element.closest('.v8-field')
            if (fieldContainer) {
              fieldContainer.classList.add('shake', 'has-error')
              // Remove shake class after animation
              setTimeout(() => {
                fieldContainer.classList.remove('shake')
              }, 500)
            }
            
            // Remove invalid state when user starts typing
            const clearInvalid = () => {
              element.classList.remove('invalid')
              element.removeAttribute('aria-invalid')
              const fieldContainer = element.closest('.v8-field')
              if (fieldContainer) {
                fieldContainer.classList.remove('has-error')
              }
              element.removeEventListener('input', clearInvalid)
              element.removeEventListener('change', clearInvalid)
            }
            element.addEventListener('input', clearInvalid)
            element.addEventListener('change', clearInvalid)
          }
        })
        
        // Focus first missing field
        if (missing[0]) {
          setTimeout(() => {
            focusField(missing[0] || '', '.v8-step-content')
          }, 100)
        }
        
        // Don't proceed - user needs to complete required fields
        return
      }
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
      if (firstIncomplete) {
        handleChecklistItemClick(firstIncomplete)
      }
    } else {
      // Show preview modal instead of directly generating
      setShowPreview(true)
    }
  }

  const handleAcceptProposal = async () => {
    setShowPreview(false)
    setIsSaving(true)
    try {
      await props.onGenerateProposal()
    } finally {
      setIsSaving(false)
    }
  }

  const handleRejectProposal = () => {
    setShowPreview(false)
    // Return to first step or stay on current step
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="v8-field-grid cols-2">
            <ClienteFields
              cliente={props.cliente}
              segmentoCliente={props.segmentoCliente}
              onClienteChange={props.onClienteChange}
            />
          </div>
        )
      case 1:
        return (
          <div className="v8-field-grid cols-2">
            <ConsumoTarifaFields
              kcKwhMes={props.kcKwhMes}
              tarifaCheia={props.tarifaCheia}
              taxaMinima={props.taxaMinima}
              encargosFixosExtras={props.encargosFixosExtras}
              ufTarifa={props.ufTarifa}
              distribuidoraTarifa={props.distribuidoraTarifa}
              irradiacaoMedia={props.irradiacaoMedia}
              ufsDisponiveis={props.ufsDisponiveis}
              distribuidorasDisponiveis={props.distribuidorasDisponiveis}
              ufLabels={props.ufLabels}
              taxaMinimaInputEmpty={props.taxaMinimaInputEmpty}
              onKcKwhMesChange={props.onKcKwhMesChange}
              onTarifaCheiaChange={props.onTarifaCheiaChange}
              onTaxaMinimaChange={props.onTaxaMinimaChange}
              onEncargosFixosExtrasChange={props.onEncargosFixosExtrasChange}
              onUfChange={props.onUfChange}
              onDistribuidoraChange={props.onDistribuidoraChange}
              onIrradiacaoMediaChange={props.onIrradiacaoMediaChange}
            />
          </div>
        )
      case 2:
        return (
          <div className="v8-field-grid cols-2">
            <SistemaFields
              tipoInstalacao={props.tipoInstalacao}
              tipoInstalacaoOutro={props.tipoInstalacaoOutro}
              tipoSistema={props.tipoSistema}
              tiposInstalacao={props.tiposInstalacao}
              tipoSistemaValues={props.tipoSistemaValues}
              onTipoInstalacaoChange={props.onTipoInstalacaoChange}
              onTipoInstalacaoOutroChange={props.onTipoInstalacaoOutroChange}
              onTipoSistemaChange={props.onTipoSistemaChange}
              isManualBudgetForced={props.isManualBudgetForced}
              manualBudgetForceReason={props.manualBudgetForceReason}
            />
          </div>
        )
      case 3:
        // Step 3: Condições do Leasing (Simple mode) OR Oferta de Leasing (Complete mode)
        return (
          <div className="v8-field-grid cols-2">
            <Field
              label={labelWithTooltip(
                'Prazo do leasing (meses)',
                'Duração total do contrato de leasing em meses.',
              )}
            >
              <select
                data-field="leasingPrazo"
                value={props.leasingPrazo}
                onChange={(e) => props.onLeasingPrazoChange(Number(e.target.value))}
                className="v8-field-select"
              >
                <option value={60}>60 meses (5 anos)</option>
                <option value={66}>66 meses (5,5 anos)</option>
                <option value={72}>72 meses (6 anos)</option>
                <option value={78}>78 meses (6,5 anos)</option>
                <option value={84}>84 meses (7 anos)</option>
                <option value={90}>90 meses (7,5 anos)</option>
                <option value={96}>96 meses (8 anos)</option>
                <option value={102}>102 meses (8,5 anos)</option>
                <option value={108}>108 meses (9 anos)</option>
                <option value={114}>114 meses (9,5 anos)</option>
                <option value={120}>120 meses (10 anos)</option>
              </select>
            </Field>
            {proposalMode === 'complete' && (
              <div className="v8-alert info">
                <p>
                  <strong>Oferta de Leasing</strong>
                  <br />
                  Campos adicionais de leasing (entrada, taxa, etc.) serão integrados em uma próxima iteração.
                </p>
              </div>
            )}
          </div>
        )
      case 4:
        // Step 4: Revisão (Simple mode) OR Projeções (Complete mode)
        if (proposalMode === 'simple') {
          // Simple mode: Show Revisão with preview at step 4
          const validation = canGenerateProposal(values, 'leasing')
          return (
            <div>
              {showPreview ? (
                <ProposalPreviewModal
                  cliente={props.cliente}
                  potenciaKwp={props.outputs.potenciaKwp || 0}
                  mensalidade={calculatedMensalidade}
                  prazo={props.leasingPrazo}
                  onAccept={handleAcceptProposal}
                  onReject={handleRejectProposal}
                />
              ) : (
                <GerarPropostaActions
                  onGenerateProposal={handleCTAClick}
                  isSaving={isSaving}
                  canGenerate={validation.valid}
                  missingFields={validation.missing}
                />
              )}
            </div>
          )
        } else {
          // Complete mode: Show Projeções
          return (
            <div className="v8-field-grid">
              <div className="v8-alert info">
                <p>
                  <strong>Etapa 5: Projeções</strong>
                  <br />
                  Projeções financeiras serão integradas em uma próxima iteração.
                </p>
              </div>
            </div>
          )
        }
      case 5:
        // Step 5: Revisão (Complete mode only)
        const validation = canGenerateProposal(values, 'leasing')
        return (
          <div>
            {showPreview ? (
              <ProposalPreviewModal
                cliente={props.cliente}
                potenciaKwp={props.outputs.potenciaKwp || 0}
                mensalidade={calculatedMensalidade}
                prazo={props.leasingPrazo}
                onAccept={handleAcceptProposal}
                onReject={handleRejectProposal}
              />
            ) : (
              <GerarPropostaActions
                onGenerateProposal={handleCTAClick}
                isSaving={isSaving}
                canGenerate={validation.valid}
                missingFields={validation.missing}
              />
            )}
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
    <>
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
            title={stepTitles[currentStep] ?? 'Etapa'}
            description={stepDescriptions[currentStep] ?? ''}
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
            onChecklistItemClick={handleChecklistItemClick}
          />
        }
      />
      
      <ProposalPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onAccept={handleAcceptProposal}
        onReject={handleRejectProposal}
        cliente={props.cliente}
        sistema={{
          tipoInstalacao: props.tipoInstalacao,
          tipoSistema: props.tipoSistema,
          potenciaKwp: props.outputs.potenciaKwp ?? null,
        }}
        financeiro={{
          mensalidade: props.outputs.mensalidade || calculatedMensalidade,
          prazo: props.leasingPrazo,
        }}
        isLeasing={true}
      />
    </>
  )
}
