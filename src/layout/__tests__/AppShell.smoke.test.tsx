import React from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { AppShell } from '../AppShell'

const minimalSidebarGroups = [
  {
    id: 'main',
    label: '',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
    ],
  },
]

describe('AppShell smoke', () => {
  it('renderiza a estrutura de layout sem erros', () => {
    const { container } = render(
      <AppShell
        topbar={{}}
        sidebar={{
          groups: minimalSidebarGroups,
          activeItemId: 'dashboard',
        }}
        content={{}}
      >
        <div data-testid="page-content">Conteúdo da página</div>
      </AppShell>,
    )

    expect(container.querySelector('.app-shell')).not.toBeNull()
    expect(container.querySelector('.app-body')).not.toBeNull()
    expect(container.querySelector('.topbar')).not.toBeNull()
    expect(container.querySelector('.sidebar')).not.toBeNull()
    expect(container.querySelector('.content-wrap')).not.toBeNull()
    expect(container.textContent).toContain('Conteúdo da página')
  })

  it('aplica a classe sidebar-collapsed quando collapsed=true', () => {
    const { container } = render(
      <AppShell
        topbar={{}}
        sidebar={{
          groups: minimalSidebarGroups,
          collapsed: true,
        }}
        content={{}}
      >
        <span>child</span>
      </AppShell>,
    )

    expect(container.querySelector('.app-body')?.classList.contains('sidebar-collapsed')).toBe(true)
  })

  it('renderiza o botão flutuante de menu mobile quando mobileMenuButton é fornecido', () => {
    const { container } = render(
      <AppShell
        topbar={{}}
        sidebar={{
          groups: minimalSidebarGroups,
          mobileOpen: false,
        }}
        content={{}}
        mobileMenuButton={{
          onToggle: () => { /* noop */ },
          label: 'Abrir menu',
          expanded: false,
        }}
      >
        <span>child</span>
      </AppShell>,
    )

    expect(container.querySelector('.sidebar-floating-toggle')).not.toBeNull()
  })
})
