// src/features/simulacoes/SimulacoesHeroCard.tsx
// Hero card displayed at the top of the Simulações page.
// Extracted from App.tsx (Subfase 2B.12.1).
// Approval state is read directly from useAprovacaoStore (Fase 3.7-A).
// Fase 4A: Hero is read-only — approval buttons moved to AfAprovacaoGrid.

import { APROVACAO_SELLOS } from './simulacoesConstants'
import {
  useAprovacaoStore,
  selectAprovacaoStatus,
  selectUltimaDecisaoTimestamp,
} from './useAprovacaoStore'
import { formatAprovacaoData } from '../../utils/formatters'

interface SimulacoesHeroCardProps {
  isAnaliseMobileSimpleView: boolean
  sectionCopy: string
}

export function SimulacoesHeroCard({
  isAnaliseMobileSimpleView,
  sectionCopy,
}: SimulacoesHeroCardProps) {
  const aprovacaoStatus = useAprovacaoStore(selectAprovacaoStatus)
  const ultimaDecisaoTimestamp = useAprovacaoStore(selectUltimaDecisaoTimestamp)
  if (isAnaliseMobileSimpleView) {
    return null
  }

  return (
    <div className="simulacoes-hero-card">
      <div>
        <p className="simulacoes-tag">Módulo dedicado</p>
        <h2>Simulações &amp; análise financeira</h2>
        <p>{sectionCopy}</p>
      </div>
      <div className="simulacoes-hero-actions">
        <span className={`simulacoes-status status-${aprovacaoStatus}`}>{APROVACAO_SELLOS[aprovacaoStatus]}</span>
        <small>Última decisão: {formatAprovacaoData(ultimaDecisaoTimestamp)}</small>
      </div>
    </div>
  )
}
