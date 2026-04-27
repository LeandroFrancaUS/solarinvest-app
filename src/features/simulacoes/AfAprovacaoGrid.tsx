// src/features/simulacoes/AfAprovacaoGrid.tsx
// Extracted from AnaliseFinanceiraSection.tsx (Subfase 2B.12.4F).
// Renders the approval checklist and decision stamp block.
// Approval state is read directly from useAprovacaoStore (Fase 3.7-A).

import {
  APROVACAO_SELLOS,
  type AprovacaoChecklistKey,
} from './simulacoesConstants'
import {
  useAprovacaoStore,
  selectAprovacaoStatus,
  selectAprovacaoChecklist,
  selectUltimaDecisaoTimestamp,
  selectRegistrarDecisaoInterna,
  selectToggleAprovacaoChecklist,
} from './useAprovacaoStore'
import { formatAprovacaoData } from '../../utils/formatters'

export interface AfAprovacaoGridProps {
  afModo: 'venda' | 'leasing'
  isAnaliseMobileSimpleView: boolean
}

export function AfAprovacaoGrid({
  afModo,
  isAnaliseMobileSimpleView,
}: AfAprovacaoGridProps) {
  const aprovacaoChecklist = useAprovacaoStore(selectAprovacaoChecklist)
  const toggleAprovacaoChecklist = useAprovacaoStore(selectToggleAprovacaoChecklist)
  const aprovacaoStatus = useAprovacaoStore(selectAprovacaoStatus)
  const ultimaDecisaoTimestamp = useAprovacaoStore(selectUltimaDecisaoTimestamp)
  const registrarDecisaoInterna = useAprovacaoStore(selectRegistrarDecisaoInterna)
  return (
    <div className="af-approval-panel" style={{ marginTop: '1.5rem' }}>
      <section className="af-approval-checklist">
        <h4>Checklist de aprovação</h4>
        <ul className="simulacoes-checklist">
          {(afModo === 'leasing'
            ? (['roi', 'tir', 'vpl', 'payback', 'eficiencia', 'lucro'] as AprovacaoChecklistKey[])
            : (['roi', 'tir', 'spread', 'vpl'] as AprovacaoChecklistKey[])
          ).map((item) => (
            <li key={item}>
              <label className="simulacoes-check">
                <input
                  type="checkbox"
                  checked={aprovacaoChecklist[item]}
                  onChange={() => toggleAprovacaoChecklist(item)}
                />
                <span>
                  {item === 'roi'
                    ? (afModo === 'leasing' ? 'ROI mínimo do leasing atendido' : 'ROI mínimo SolarInvest atendido')
                    : item === 'tir'
                      ? 'TIR anual acima do piso definido'
                      : item === 'spread'
                        ? 'Spread e margem dentro do range'
                        : item === 'vpl'
                          ? 'VPL positivo no horizonte definido'
                          : item === 'payback'
                            ? 'Payback dentro do limite aceitável'
                            : item === 'eficiencia'
                              ? 'Indicador de eficiência acima do mínimo'
                              : 'Lucro mensal positivo e saudável'}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>
      {isAnaliseMobileSimpleView ? null : (
        <section className="af-approval-decision">
          <h4>Decisão final</h4>
          <div className={`af-approval-status status-${aprovacaoStatus}`}>
            {APROVACAO_SELLOS[aprovacaoStatus]}
          </div>
          <p className="simulacoes-description">
            Última decisão registrada: {formatAprovacaoData(ultimaDecisaoTimestamp)}
          </p>
          <div className="af-approval-actions">
            <button type="button" className="primary" onClick={() => registrarDecisaoInterna('aprovado')}>
              Aprovar
            </button>
            <button type="button" className="secondary" onClick={() => registrarDecisaoInterna('reprovado')}>
              Reprovar
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => registrarDecisaoInterna(aprovacaoStatus)}
            >
              Salvar decisão
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
