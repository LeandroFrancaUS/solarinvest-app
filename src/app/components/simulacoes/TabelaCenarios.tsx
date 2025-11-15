import React from 'react'
import { formatMoneyBR, formatNumberBR, formatPercentBR } from '../../../lib/locale/br-number'
import type { SimulationComparisonResult } from '../../../workers/simulationWorker'
import { CenarioCard } from './CenarioCard'

type TabelaCenariosProps = {
  rows: SimulationComparisonResult[]
  comparisonHorizon: number
}

export function TabelaCenarios({ rows, comparisonHorizon }: TabelaCenariosProps) {
  if (rows.length === 0) {
    return null
  }

  return (
    <div className="tabela-cenarios" aria-live="polite">
      {rows.map(({ sim, indicadores, economiaContratoSim, economiaHorizon, tarifaDesconto, encargoTusd }) => (
        <CenarioCard
          key={sim.id}
          title={sim.nome?.trim() || sim.id}
          subtitle={`${sim.anos_contrato} anos • ${formatNumberBR(sim.kc_kwh_mes)} kWh/mês`}
          metrics={[
            { label: 'ROI', value: formatPercentBR(indicadores.roi) },
            { label: 'Payback', value: indicadores.paybackMeses > 0 ? `${Math.round(indicadores.paybackMeses)} meses` : '—' },
            { label: 'Economia contratual', value: formatMoneyBR(economiaContratoSim) },
            { label: `Economia (${comparisonHorizon}a)`, value: formatMoneyBR(economiaHorizon) },
            { label: 'Tarifa c/ desconto', value: formatMoneyBR(tarifaDesconto) },
            { label: 'Encargo TUSD', value: formatMoneyBR(encargoTusd) },
          ]}
        >
          <div className="tabela-cenarios__extra">
            <span>
              {formatMoneyBR(indicadores.receitaTotal)} em receita • {formatMoneyBR(indicadores.lucroLiquido)} de lucro
            </span>
            <small>{sim.obs?.trim() || 'Sem observações adicionais.'}</small>
          </div>
        </CenarioCard>
      ))}
    </div>
  )
}
