import { currency } from '../utils/formatters'

const ECONOMIA_ESTIMATIVA_PADRAO_ANOS = 5

export interface VendaResumoPublicoSectionProps {
  valorTotalPropostaNormalizado: number
  economiaEstimativaValorCalculado: number | null
}

export function VendaResumoPublicoSection({
  valorTotalPropostaNormalizado,
  economiaEstimativaValorCalculado,
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
