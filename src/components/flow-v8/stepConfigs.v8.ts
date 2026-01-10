/**
 * Flow V8 - Step Configuration
 * Defines step configurations for Simple and Complete modes
 */

import type { ProposalMode } from './ProposalModeSelector'

export interface StepConfig {
  index: number
  label: string
  description: string
}

// Vendas step configurations
export const VENDAS_STEPS_SIMPLE: StepConfig[] = [
  { index: 0, label: 'Cliente', description: 'Informações básicas do cliente e contato' },
  { index: 1, label: 'Consumo & Tarifa', description: 'Consumo médio mensal e tarifa aplicável' },
  { index: 2, label: 'Sistema', description: 'Tipo de instalação e sistema' },
  { index: 3, label: 'Revisão', description: 'Revise e gere a proposta' },
]

export const VENDAS_STEPS_COMPLETE: StepConfig[] = [
  { index: 0, label: 'Cliente', description: 'Informações básicas do cliente e contato' },
  { index: 1, label: 'Consumo & Tarifa', description: 'Consumo médio mensal e tarifa aplicável' },
  { index: 2, label: 'Sistema', description: 'Tipo de instalação e sistema' },
  { index: 3, label: 'Kit & Custos', description: 'Seleção de equipamentos e custos' },
  { index: 4, label: 'Resultados', description: 'Análise financeira e projeções' },
  { index: 5, label: 'Revisão', description: 'Revise e gere a proposta' },
]

// Leasing step configurations
export const LEASING_STEPS_SIMPLE: StepConfig[] = [
  { index: 0, label: 'Cliente', description: 'Informações básicas do cliente e contato' },
  { index: 1, label: 'Consumo & Tarifa', description: 'Consumo médio mensal e tarifa aplicável' },
  { index: 2, label: 'Sistema', description: 'Tipo de instalação e sistema' },
  { index: 3, label: 'Revisão', description: 'Revise e gere a proposta' },
]

export const LEASING_STEPS_COMPLETE: StepConfig[] = [
  { index: 0, label: 'Cliente', description: 'Informações básicas do cliente e contato' },
  { index: 1, label: 'Consumo & Tarifa', description: 'Consumo médio mensal e tarifa aplicável' },
  { index: 2, label: 'Sistema', description: 'Tipo de instalação e sistema' },
  { index: 3, label: 'Oferta de Leasing', description: 'Configuração de prazo e condições' },
  { index: 4, label: 'Projeções', description: 'Projeções financeiras' },
  { index: 5, label: 'Revisão', description: 'Revise e gere a proposta' },
]

export function getStepConfigs(flowType: 'vendas' | 'leasing', mode: ProposalMode): StepConfig[] {
  if (flowType === 'vendas') {
    return mode === 'simple' ? VENDAS_STEPS_SIMPLE : VENDAS_STEPS_COMPLETE
  } else {
    return mode === 'simple' ? LEASING_STEPS_SIMPLE : LEASING_STEPS_COMPLETE
  }
}

export function getStepLabels(flowType: 'vendas' | 'leasing', mode: ProposalMode): string[] {
  return getStepConfigs(flowType, mode).map((s) => s.label)
}

export function isRevisaoStep(currentStepIndex: number, flowType: 'vendas' | 'leasing', mode: ProposalMode): boolean {
  const configs = getStepConfigs(flowType, mode)
  return currentStepIndex === configs.length - 1
}
