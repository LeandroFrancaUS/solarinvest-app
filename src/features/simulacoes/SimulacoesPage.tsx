// src/features/simulacoes/SimulacoesPage.tsx
// Extracted from App.tsx (Subfase 2B-final).
// Orchestrates the full Simulações page. All internal blocks were previously extracted.

import React from 'react'
import type { SimulacoesSection } from '../../types/navigation'
import type { TipoSistema } from '../../lib/finance/roi'
import type { LeasingPrazoAnos } from '../../app/config'
import { SIMULACOES_SECTION_COPY } from './simulacoesConstants'
import { SimulacoesHeroCard } from './SimulacoesHeroCard'
import { SimulacoesNav } from './SimulacoesNav'
import { SimulacoesStaticModuleCard } from './SimulacoesStaticModuleCard'
import { AnaliseFinanceiraSection } from './AnaliseFinanceiraSection'
import type { AnaliseFinanceiraSectionProps } from './AnaliseFinanceiraSection'

const SimulacoesTab = React.lazy(() =>
  import('../../components/simulacoes/SimulacoesTab').then(m => ({ default: m.SimulacoesTab })),
)

type AnaliseFinanceiraSectionPassthroughProps = Omit<AnaliseFinanceiraSectionProps, 'isAnaliseMobileSimpleView'>

export interface SimulacoesPageProps extends AnaliseFinanceiraSectionPassthroughProps {
  simulacoesSection: SimulacoesSection
  isMobileViewport: boolean
  isMobileSimpleEnabled: boolean
  isSimulacoesWorkspaceActive: boolean
  onAbrirSimulacoes: (section: SimulacoesSection) => void
  capexSolarInvest: number
  tipoSistema: TipoSistema
  leasingPrazo: LeasingPrazoAnos
}

export function SimulacoesPage({
  simulacoesSection,
  isMobileViewport,
  isMobileSimpleEnabled,
  isSimulacoesWorkspaceActive,
  onAbrirSimulacoes,
  capexSolarInvest,
  tipoSistema,
  leasingPrazo,
  kcKwhMes,
  ...analiseFinanceiraProps
}: SimulacoesPageProps) {
  const sectionCopy = SIMULACOES_SECTION_COPY[simulacoesSection]
  const isAnaliseMobileSimpleView = isMobileSimpleEnabled && simulacoesSection === 'analise'
  const hiddenAnaliseMobileMenuIds = new Set<SimulacoesSection>([
    'nova',
    'salvas',
    'ia',
    'risco',
    'packs',
    'packs-inteligentes',
  ])

  return (
    <div
      className={`simulacoes-page${
        isMobileViewport && simulacoesSection === 'analise'
          ? ' simulacoes-page--analise-mobile'
          : ''
      }`}
    >
      <SimulacoesHeroCard
        isAnaliseMobileSimpleView={isAnaliseMobileSimpleView}
        sectionCopy={sectionCopy}
      />

      <SimulacoesNav
        simulacoesSection={simulacoesSection}
        hiddenAnaliseMobileMenuIds={isAnaliseMobileSimpleView ? hiddenAnaliseMobileMenuIds : new Set<SimulacoesSection>()}
        onAbrirSimulacoes={onAbrirSimulacoes}
      />

      <div className="simulacoes-panels">
        <section
          className="simulacoes-main-card"
          hidden={!isSimulacoesWorkspaceActive}
          aria-hidden={!isSimulacoesWorkspaceActive}
          style={{ display: isSimulacoesWorkspaceActive ? 'flex' : 'none' }}
        >
          <header>
            <div>
              <p className="simulacoes-tag ghost">Workspace</p>
              <h3>{simulacoesSection === 'nova' ? 'Nova simulação' : 'Simulações salvas'}</h3>
              <p className="simulacoes-description">
                Layout full-width para criação, comparação e duplicação de cenários com Monte Carlo e IA na mesma
                área.
              </p>
            </div>
          </header>
          <React.Suspense fallback={null}>
            <SimulacoesTab
              consumoKwhMes={kcKwhMes}
              valorInvestimento={capexSolarInvest}
              tipoSistema={tipoSistema}
              prazoLeasingAnos={leasingPrazo}
            />
          </React.Suspense>
        </section>

        <SimulacoesStaticModuleCard section={simulacoesSection} />

        {simulacoesSection === 'analise' ? (
          <AnaliseFinanceiraSection
            {...analiseFinanceiraProps}
            kcKwhMes={kcKwhMes}
            isAnaliseMobileSimpleView={isAnaliseMobileSimpleView}
          />
        ) : null}
      </div>
    </div>
  )
}

