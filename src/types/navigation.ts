// src/types/navigation.ts
// Shared navigation type definitions used across App.tsx, sidebarConfig.ts, and useRouteGuard.ts.
// Single source of truth for page and section identifiers.

export type ActivePage =
  | 'dashboard'
  | 'operational-dashboard'
  | 'app'
  | 'crm'
  | 'consultar'
  | 'clientes'
  | 'settings'
  | 'simulacoes'
  | 'admin-users'
  | 'carteira'
  | 'financial-management'
  | 'project-hub'
  // Área Comercial (Etapa 3)
  | 'comercial-leads'
  | 'comercial-propostas'
  // Operação placeholder sections (Etapa 1 — sem página real ainda)
  | 'operacao-agenda'
  | 'operacao-chamados'
  | 'operacao-manutencoes'
  | 'operacao-limpezas'
  | 'operacao-seguros'

export type SimulacoesSection =
  | 'nova'
  | 'salvas'
  | 'analise'

/** Subset of ActivePage values that represent Operação placeholder sections. */
export type OperacaoSection =
  | 'operacao-agenda'
  | 'operacao-chamados'
  | 'operacao-manutencoes'
  | 'operacao-limpezas'
  | 'operacao-seguros'

export const OPERACAO_SECTION_LABELS: Record<OperacaoSection, string> = {
  'operacao-agenda': 'Agenda',
  'operacao-chamados': 'Chamados',
  'operacao-manutencoes': 'Manutenções',
  'operacao-limpezas': 'Limpezas',
  'operacao-seguros': 'Seguros',
}
