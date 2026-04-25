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
    id: 'ia',
    label: 'Análises IA (AI Analytics)',
    description: 'Insights automáticos sobre KPIs, alavancagem e oportunidades.',
  },
  {
    id: 'risco',
    label: 'Risco & Monte Carlo',
    description: 'Cenários de risco e volatilidade com distribuição full-width.',
  },
  {
    id: 'packs',
    label: 'Packs',
    description: 'Agrupe propostas e combos comerciais para reutilizar.',
  },
  {
    id: 'packs-inteligentes',
    label: 'Packs Inteligentes',
    description: 'Automatize packs com IA e premissas dinâmicas.',
  },
  {
    id: 'analise',
    label: 'Análise Financeira',
    description: 'Checklist interno para aprovar, reprovar ou salvar decisões.',
  },
]

export const SIMULACOES_SECTION_COPY: Record<SimulacoesSection, string> = {
  nova: 'Abra novas simulações em layout de tela cheia e compare resultados lado a lado.',
  salvas: 'Revise simulações existentes sem sair do módulo dedicado.',
  ia: 'Centralize análises assistidas por IA e recomendações automáticas.',
  risco: 'Use Monte Carlo e cenários de risco com gráficos em largura total.',
  packs: 'Organize pacotes comerciais para acelerar a operação.',
  'packs-inteligentes': 'Combine inteligência artificial e packs dinâmicos.',
  analise: 'Aplique regras SolarInvest, checklist interno e selo de aprovação.',
}

export const APROVACAO_SELLOS: Record<AprovacaoStatus, string> = {
  pendente: 'Decisão pendente',
  aprovado: 'Aprovado SolarInvest',
  reprovado: 'Reprovado SolarInvest',
}
