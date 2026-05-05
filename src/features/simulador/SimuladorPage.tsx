// src/features/simulador/SimuladorPage.tsx
// UI composition for the Simulações page.
// Extracted from App.tsx (PR D — Extract SimuladorPage UI).
// Receives all data via props — no internal state, no direct store access.

import React from 'react'
import type { TipoSistema } from '../../lib/finance/roi'
import type { SimulacoesSection } from '../../types/navigation'
import { SimulacoesHeroCard } from '../simulacoes/SimulacoesHeroCard'
import { SimulacoesNav } from '../simulacoes/SimulacoesNav'
import { SimulacoesStaticModuleCard } from '../simulacoes/SimulacoesStaticModuleCard'
import {
  AnaliseFinanceiraSection,
  type AnaliseFinanceiraSectionProps,
} from '../simulacoes/AnaliseFinanceiraSection'
import { SIMULACOES_SECTION_COPY } from '../simulacoes/simulacoesConstants'
import { selectNumberInputOnFocus } from '../../utils/focusHandlers'

const SimulacoesTab = React.lazy(() =>
  import('../../components/simulacoes/SimulacoesTab').then((m) => ({ default: m.SimulacoesTab })),
)

export interface SimuladorPageProps
  extends Omit<AnaliseFinanceiraSectionProps, 'isAnaliseMobileSimpleView' | 'selectNumberInputOnFocus'> {
  simulacoesSection: SimulacoesSection
  isMobileSimpleEnabled: boolean
  isMobileViewport: boolean
  abrirSimulacoes: (section: SimulacoesSection) => void
  capexSolarInvest: number
  leasingPrazo: number
  tipoSistema: TipoSistema
}

export function SimuladorPage({
  simulacoesSection,
  isMobileSimpleEnabled,
  isMobileViewport,
  abrirSimulacoes,
  capexSolarInvest,
  leasingPrazo,
  tipoSistema,
  ...afProps
}: SimuladorPageProps) {
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
  const isSimulacoesWorkspaceActive = simulacoesSection === 'nova' || simulacoesSection === 'salvas'

  return (
    <div
      className={`simulacoes-page${
        isMobileViewport && simulacoesSection === 'analise'
          ? ' simulacoes-page--analise-mobile'
          : ''
      }`}
    >
      <SimulacoesHeroCard
        aprovacaoStatus={afProps.aprovacaoStatus}
        ultimaDecisaoTimestamp={afProps.ultimaDecisaoTimestamp}
        onRegistrarDecisao={afProps.registrarDecisaoInterna}
        isAnaliseMobileSimpleView={isAnaliseMobileSimpleView}
        sectionCopy={sectionCopy}
      />

      <SimulacoesNav
        simulacoesSection={simulacoesSection}
        hiddenAnaliseMobileMenuIds={
          isAnaliseMobileSimpleView ? hiddenAnaliseMobileMenuIds : new Set<SimulacoesSection>()
        }
        onAbrirSimulacoes={abrirSimulacoes}
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
              consumoKwhMes={afProps.kcKwhMes}
              valorInvestimento={capexSolarInvest}
              tipoSistema={tipoSistema}
              prazoLeasingAnos={leasingPrazo}
            />
          </React.Suspense>
        </section>

        <SimulacoesStaticModuleCard section={simulacoesSection} />

        {simulacoesSection === 'analise' ? (
          <AnaliseFinanceiraSection
            {...afProps}
            isAnaliseMobileSimpleView={isAnaliseMobileSimpleView}
            selectNumberInputOnFocus={selectNumberInputOnFocus}
          />
        ) : null}
      </div>
    </div>
  )
}
