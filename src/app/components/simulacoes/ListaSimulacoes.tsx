import React from 'react'
import type { Simulacao } from '../../../lib/finance/simulation'
import { CenarioCard } from './CenarioCard'

type ListaSimulacoesProps = {
  simulations: Simulacao[]
  selectedIds: string[]
  activeSimulationId?: string
  onToggleSelection: (id: string) => void
  formatUpdatedAt: (timestamp: number | undefined) => string
}

export function ListaSimulacoes({
  simulations,
  selectedIds,
  activeSimulationId,
  onToggleSelection,
  formatUpdatedAt,
}: ListaSimulacoesProps) {
  return (
    <section className="result-section simulacoes-saved" id="simulacoes-salvas">
      <header className="simulacoes-saved__header">
        <h3>Simulações salvas</h3>
        <p>Selecione os cenários que devem aparecer no comparativo financeiro.</p>
      </header>
      {simulations.length === 0 ? (
        <p className="muted">Nenhuma simulação salva até o momento.</p>
      ) : (
        <div className="simulacoes-card-grid">
          {simulations.map((sim) => (
            <CenarioCard
              key={sim.id}
              title={sim.nome?.trim() || sim.id}
              subtitle={`Atualizado em ${formatUpdatedAt(sim.updatedAt)}`}
              selectable
              selected={selectedIds.includes(sim.id)}
              active={activeSimulationId === sim.id}
              onToggle={() => onToggleSelection(sim.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
