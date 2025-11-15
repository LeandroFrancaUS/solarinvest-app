import React from 'react'
import { labelWithTooltip } from '../../../components/InfoTooltip'
import type { SimulationComparisonResult } from '../../../workers/simulationWorker'
import { TabelaComparacao } from './TabelaComparacao'
import { TabelaCenarios } from './TabelaCenarios'

type ComparadorSimulacoesProps = {
  rows: SimulationComparisonResult[]
  comparisonHorizon: number
  horizonOptions: readonly number[]
  onChangeHorizon: (value: number) => void
  onClearSelection: () => void
  selectedCount: number
  expandedRows: Record<string, boolean>
  onToggleRow: (id: string) => void
}

export function ComparadorSimulacoes({
  rows,
  comparisonHorizon,
  horizonOptions,
  onChangeHorizon,
  onClearSelection,
  selectedCount,
  expandedRows,
  onToggleRow,
}: ComparadorSimulacoesProps) {
  return (
    <section className="result-section simulations-table" id="simulacoes-comparador">
      <div className="simulations-table-header">
        <div>
          <h5>Comparativo de cenários</h5>
          <p>Selecione na lista de simulações salvas os cenários desejados para gerar o comparativo.</p>
        </div>
        <div className="simulations-table-actions">
          <label htmlFor="economy-horizon">
            {labelWithTooltip(
              'Economia (anos)',
              'Seleciona o horizonte usado para calcular a coluna "Economia (N anos)" no comparativo.',
            )}
          </label>
          <select
            className="cfg-input"
            id="economy-horizon"
            value={comparisonHorizon}
            onChange={(event) => onChangeHorizon(Number(event.target.value))}
          >
            {horizonOptions.map((anos) => (
              <option key={anos} value={anos}>
                {anos} anos
              </option>
            ))}
          </select>
          <button type="button" className="secondary" onClick={onClearSelection} disabled={selectedCount === 0}>
            Limpar seleção
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="muted simulations-empty">Selecione ao menos uma simulação salva para comparar.</p>
      ) : (
        <>
          <TabelaComparacao
            rows={rows}
            comparisonHorizon={comparisonHorizon}
            expandedRows={expandedRows}
            onToggleRow={onToggleRow}
          />
          <TabelaCenarios rows={rows} comparisonHorizon={comparisonHorizon} />
        </>
      )}
    </section>
  )
}
