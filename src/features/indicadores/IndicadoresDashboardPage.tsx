// src/features/indicadores/IndicadoresDashboardPage.tsx
// Área Indicadores — análise estratégica do negócio SolarInvest.
// Etapa 6: Thin wrapper over FinancialManagementPage that deep-links into the
// correct tab based on the active sidebar Indicadores section.
//
// Map:
//   indicadores-visao-geral  → FinancialManagementPage tab 'overview'
//   indicadores-leasing      → FinancialManagementPage tab 'leasing'
//   indicadores-vendas       → FinancialManagementPage tab 'sales'
//   indicadores-fluxo-caixa  → FinancialManagementPage tab 'cashflow'
//
// financial-management (legacy) → treated as alias for indicadores-visao-geral.

import React from 'react'
import { FinancialManagementPage } from '../../pages/FinancialManagementPage'

export type IndicadoresTab = 'visao-geral' | 'leasing' | 'vendas' | 'fluxo-caixa'

// Maps Indicadores sidebar tab IDs to FinancialManagementPage internal tab IDs.
const INDICADORES_TAB_MAP: Record<IndicadoresTab, 'overview' | 'leasing' | 'sales' | 'cashflow'> = {
  'visao-geral': 'overview',
  'leasing': 'leasing',
  'vendas': 'sales',
  'fluxo-caixa': 'cashflow',
}

export interface IndicadoresDashboardPageProps {
  tab: IndicadoresTab
  onBack: () => void
  initialProjectId?: string | null
}

export function IndicadoresDashboardPage({ tab, onBack, initialProjectId }: IndicadoresDashboardPageProps) {
  return (
    <FinancialManagementPage
      onBack={onBack}
      initialProjectId={initialProjectId}
      initialTab={INDICADORES_TAB_MAP[tab]}
    />
  )
}
