// src/components/VendaResumoPublicoSection.tsx
// "Resumo de valores (Página pública)" card shown in the vendas tab.
// Pure presentational component; all state and handlers remain in App.tsx.

import * as React from 'react'

const ECONOMIA_ESTIMATIVA_PADRAO_ANOS = 5

export type VendaResumoPublicoSectionProps = {
  valorTotalPropostaNormalizado: number
  economiaEstimativaValorCalculado: number | null
  currency: (value: number) => string
}

export function VendaResumoPublicoSection({
  valorTotalPropostaNormalizado,
  economiaEstimativaValorCalculado,
  currency,
}: VendaResumoPublicoSectionProps) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>Resumo de valores (Página pública)</h2>
      </div>
      <div className="kpi-grid">
        <div className="kpi kpi-highlight">
          <span>Valor total da proposta</span>
          <strong>{currency(valorTotalPropostaNormalizado)}</strong>
        </div>
        {economiaEstimativaValorCalculado != null ? (
          <div className="kpi">
            <span>{`Economia estimada (${ECONOMIA_ESTIMATIVA_PADRAO_ANOS} anos)`}</span>
            <strong>{currency(economiaEstimativaValorCalculado)}</strong>
          </div>
        ) : null}
      </div>
      <p className="muted">
        Preço final para aquisição da usina completa. Valores técnicos internos não são cobrados do cliente.
      </p>
    </section>
  )
}
