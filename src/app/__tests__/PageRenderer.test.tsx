// src/app/__tests__/PageRenderer.test.tsx
// Smoke tests: PageRenderer calls the correct render prop for each activePage value.

import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { PageRenderer } from '../PageRenderer'
import type { PageRendererProps } from '../PageRenderer'
import { render } from '../../test-utils/testing-library-react'

function makeProps(overrides: Partial<PageRendererProps> = {}): PageRendererProps {
  return {
    activePage: 'app',
    renderDashboard: vi.fn(() => <div data-testid="dashboard" />),
    renderCrm: vi.fn(() => <div data-testid="crm" />),
    renderBudgetSearch: vi.fn(() => <div data-testid="budget-search" />),
    renderClientes: vi.fn(() => <div data-testid="clientes" />),
    renderSimulacoes: vi.fn(() => <div data-testid="simulacoes" />),
    renderSettings: vi.fn(() => <div data-testid="settings" />),
    renderAdminUsers: vi.fn(() => <div data-testid="admin-users" />),
    renderCarteira: vi.fn(() => <div data-testid="carteira" />),
    renderFinancialManagement: vi.fn(() => <div data-testid="financial-management" />),
    renderOperationalDashboard: vi.fn(() => <div data-testid="operational-dashboard" />),
    renderApp: vi.fn(() => <div data-testid="app-page" />),
    ...overrides,
  }
}

describe('PageRenderer', () => {
  const cases: Array<{ activePage: PageRendererProps['activePage']; renderKey: keyof PageRendererProps; testId: string }> = [
    { activePage: 'dashboard', renderKey: 'renderDashboard', testId: 'dashboard' },
    { activePage: 'crm', renderKey: 'renderCrm', testId: 'crm' },
    { activePage: 'consultar', renderKey: 'renderBudgetSearch', testId: 'budget-search' },
    { activePage: 'clientes', renderKey: 'renderClientes', testId: 'clientes' },
    { activePage: 'simulacoes', renderKey: 'renderSimulacoes', testId: 'simulacoes' },
    { activePage: 'settings', renderKey: 'renderSettings', testId: 'settings' },
    { activePage: 'admin-users', renderKey: 'renderAdminUsers', testId: 'admin-users' },
    { activePage: 'carteira', renderKey: 'renderCarteira', testId: 'carteira' },
    { activePage: 'financial-management', renderKey: 'renderFinancialManagement', testId: 'financial-management' },
    { activePage: 'operational-dashboard', renderKey: 'renderOperationalDashboard', testId: 'operational-dashboard' },
    { activePage: 'app', renderKey: 'renderApp', testId: 'app-page' },
  ]

  it.each(cases)(
    'renders $activePage by calling $renderKey',
    ({ activePage, renderKey, testId }) => {
      const props = makeProps({ activePage })
      const { container } = render(<PageRenderer {...props} />)

      expect(container.querySelector(`[data-testid="${testId}"]`)).not.toBeNull()
      expect(props[renderKey]).toHaveBeenCalledOnce()
    },
  )

  it('does not call other render functions when a specific page is active', () => {
    const props = makeProps({ activePage: 'dashboard' })
    render(<PageRenderer {...props} />)

    const idle: Array<keyof PageRendererProps> = [
      'renderCrm', 'renderBudgetSearch', 'renderClientes', 'renderSimulacoes',
      'renderSettings', 'renderAdminUsers', 'renderCarteira', 'renderFinancialManagement',
      'renderOperationalDashboard', 'renderApp',
    ]
    idle.forEach((key) => {
      expect(props[key]).not.toHaveBeenCalled()
    })
  })
})
