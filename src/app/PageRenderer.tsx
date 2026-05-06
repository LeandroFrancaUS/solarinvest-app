// src/app/PageRenderer.tsx
// Pure rendering dispatcher: decides which page to show based on activePage.
// Receives all content via render-prop functions — no internal state, no hooks.

import type React from 'react'

import type { ActivePage } from '../types/navigation'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PageRendererProps {
  activePage: ActivePage
  renderDashboard: () => React.ReactNode
  renderCrm: () => React.ReactNode
  renderBudgetSearch: () => React.ReactNode
  renderClientes: () => React.ReactNode
  renderSimulacoes: () => React.ReactNode
  renderSettings: () => React.ReactNode
  renderAdminUsers: () => React.ReactNode
  renderCarteira: () => React.ReactNode
  renderFinancialManagement: () => React.ReactNode
  renderOperationalDashboard: () => React.ReactNode
  /** Default / proposal-form page (activePage === 'app' or unrecognised). */
  renderApp: () => React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PageRenderer({
  activePage,
  renderDashboard,
  renderCrm,
  renderBudgetSearch,
  renderClientes,
  renderSimulacoes,
  renderSettings,
  renderAdminUsers,
  renderCarteira,
  renderFinancialManagement,
  renderOperationalDashboard,
  renderApp,
}: PageRendererProps): React.ReactNode {
  if (activePage === 'dashboard') return renderDashboard()
  if (activePage === 'crm') return renderCrm()
  if (activePage === 'consultar') return renderBudgetSearch()
  if (activePage === 'clientes') return renderClientes()
  if (activePage === 'simulacoes') return renderSimulacoes()
  if (activePage === 'settings') return renderSettings()
  if (activePage === 'admin-users') return renderAdminUsers()
  if (activePage === 'carteira') return renderCarteira()
  if (activePage === 'financial-management') return renderFinancialManagement()
  if (activePage === 'operational-dashboard') return renderOperationalDashboard()
  return renderApp()
}
