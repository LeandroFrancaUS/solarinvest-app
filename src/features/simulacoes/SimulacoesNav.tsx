// src/features/simulacoes/SimulacoesNav.tsx
// Navigation bar for the Simulações module.
// Extracted from App.tsx (Subfase 2B.12.2).

import type { SimulacoesSection } from '../../types/navigation'
import { SIMULACOES_MENU } from './simulacoesConstants'

interface SimulacoesNavProps {
  simulacoesSection: SimulacoesSection
  hiddenAnaliseMobileMenuIds: Set<SimulacoesSection>
  onAbrirSimulacoes: (section: SimulacoesSection) => void
}

export function SimulacoesNav({
  simulacoesSection,
  hiddenAnaliseMobileMenuIds,
  onAbrirSimulacoes,
}: SimulacoesNavProps) {
  return (
    <nav className="simulacoes-nav" aria-label="Navegação do módulo de simulações">
      {SIMULACOES_MENU.filter((item) => !hiddenAnaliseMobileMenuIds.has(item.id)).map((item) => (
        <button
          key={item.id}
          type="button"
          className={`simulacoes-nav-btn${simulacoesSection === item.id ? ' is-active' : ''}`}
          onClick={() => void onAbrirSimulacoes(item.id)}
          aria-current={simulacoesSection === item.id ? 'page' : undefined}
        >
          <strong>{item.label}</strong>
          <span>{item.description}</span>
        </button>
      ))}
    </nav>
  )
}
