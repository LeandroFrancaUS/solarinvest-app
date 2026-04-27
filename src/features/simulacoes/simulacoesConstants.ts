// src/features/simulacoes/simulacoesConstants.ts
// Shared constants and types for the Simulações module.
// Extracted from App.tsx (Subfase 2B.12.0) so they can be imported by the
// future SimulacoesPage component without creating a circular dependency.

import type { SimulacoesSection } from '../../types/navigation'

export type AprovacaoStatus = 'pendente' | 'aprovado' | 'reprovado'
export type AprovacaoChecklistKey = 'roi' | 'tir' | 'spread' | 'vpl' | 'payback' | 'eficiencia' | 'lucro'

export const SIMULACOES_MENU: { id: SimulacoesSection; label: string; description: string }[] = [
  {
    id: 'nova',
    label: 'Nova Simulação',
    description: 'Monte um cenário do zero com premissas de consumo, tarifas e capex.',
  },
  {
    id: 'salvas',
    label: 'Simulações Salvas',
    description: 'Acesse e compare simulações gravadas sem voltar para Preferências.',
  },
  {
    id: 'analise',
    label: 'Análise Financeira',
    description: 'Cálculo completo de Venda e Leasing com preço mínimo saudável.',
  },
]

export const SIMULACOES_SECTION_COPY: Record<SimulacoesSection, string> = {
  nova: 'Abra novas simulações em layout de tela cheia e compare resultados lado a lado.',
  salvas: 'Revise simulações existentes sem sair do módulo dedicado.',
  analise: 'Análise financeira de Venda e Leasing com custos, parâmetros e resultados.',
}

export const APROVACAO_SELLOS: Record<AprovacaoStatus, string> = {
  pendente: 'Decisão pendente',
  aprovado: 'Aprovado SolarInvest',
  reprovado: 'Reprovado SolarInvest',
}
