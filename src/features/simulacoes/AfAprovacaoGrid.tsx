// src/features/simulacoes/AfAprovacaoGrid.tsx
// Extracted from AnaliseFinanceiraSection.tsx (Subfase 2B.12.4F).
// Renders the approval checklist and decision stamp block.

import {
  APROVACAO_SELLOS,
  type AprovacaoChecklistKey,
  type AprovacaoStatus,
} from './simulacoesConstants'

const formatAprovacaoData = (timestamp: number | null): string => {
  if (!timestamp) {
    return '—'
  }
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(timestamp),
    )
  } catch (_error) {
    return '—'
  }
}

export interface AfAprovacaoGridProps {
  afModo: 'venda' | 'leasing'
  aprovacaoChecklist: Record<AprovacaoChecklistKey, boolean>
  toggleAprovacaoChecklist: (key: AprovacaoChecklistKey) => void
  aprovacaoStatus: AprovacaoStatus
  ultimaDecisaoTimestamp: number | null
  registrarDecisaoInterna: (status: AprovacaoStatus) => void
  isAnaliseMobileSimpleView: boolean
}

export function AfAprovacaoGrid({
  afModo,
  aprovacaoChecklist,
  toggleAprovacaoChecklist,
  aprovacaoStatus,
  ultimaDecisaoTimestamp,
  registrarDecisaoInterna,
  isAnaliseMobileSimpleView,
}: AfAprovacaoGridProps) {
  return (
    <div className="simulacoes-approval-grid" style={{ marginTop: '1.5rem' }}>
      <div className="simulacoes-module-tile">
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
      </div>
      {isAnaliseMobileSimpleView ? null : (
        <div className="simulacoes-module-tile">
          <h4>Selo e decisão</h4>
          <p className={`simulacoes-status status-${aprovacaoStatus}`}>{APROVACAO_SELLOS[aprovacaoStatus]}</p>
          <p className="simulacoes-description">
            Última decisão registrada: {formatAprovacaoData(ultimaDecisaoTimestamp)}
          </p>
          <div className="simulacoes-hero-buttons">
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
        </div>
      )}
    </div>
  )
}
