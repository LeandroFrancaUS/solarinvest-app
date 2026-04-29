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
// Área Cobranças (Etapa 4)
| 'cobrancas-mensalidades'
| 'cobrancas-recebimentos'
| 'cobrancas-inadimplencia'
// Operação
| 'operacao-agenda'
| 'operacao-chamados'
| 'operacao-manutencoes'
| 'operacao-limpezas'
| 'operacao-seguros'
// Indicadores
| 'indicadores-visao-geral'
| 'indicadores-leasing'
| 'indicadores-vendas'
| 'indicadores-fluxo-caixa'
// Relatórios
| 'relatorios-propostas'
| 'relatorios-contratos'
| 'relatorios-financeiro'
| 'relatorios-clientes'
| 'relatorios-operacao'
// Permissão
| 'no-permission'
  | 'operacao-agenda'
  | 'operacao-chamados'
  | 'operacao-manutencoes'
  | 'operacao-limpezas'
  | 'operacao-seguros'
// Área Indicadores (Etapa 6) — financial-management kept as alias → indicadores-visao-geral
| 'indicadores-visao-geral'
| 'indicadores-leasing'
| 'indicadores-vendas'
| 'indicadores-fluxo-caixa'
// Área Relatórios (Etapa 9)
| 'relatorios-propostas'
| 'relatorios-contratos'
| 'relatorios-financeiro'
| 'relatorios-clientes'
| 'relatorios-operacao'
// Etapa 8: Permissions UI — shown when the user lacks permission for the requested page
| 'no-permission'
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
