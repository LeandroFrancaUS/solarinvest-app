// src/features/relatorios/reportTypes.ts
// Shared type definitions for the Área Relatórios (Etapa 9).
// These are thin view-model types — no business logic, no engine changes.

/** The five report tabs available in RelatoriosPage. */
export type RelatoriosTab =
  | 'propostas'
  | 'contratos'
  | 'financeiro'
  | 'clientes'
  | 'operacao'

export const RELATORIOS_TAB_LABELS: Record<RelatoriosTab, string> = {
  propostas: 'Propostas',
  contratos: 'Contratos',
  financeiro: 'Financeiro',
  clientes: 'Clientes',
  operacao: 'Operação',
}

/** Generic period filter shared across report tabs. */
export interface PeriodFilter {
  from: string  // ISO date "YYYY-MM-DD", empty string = no filter
  to: string    // ISO date "YYYY-MM-DD", empty string = no filter
}
