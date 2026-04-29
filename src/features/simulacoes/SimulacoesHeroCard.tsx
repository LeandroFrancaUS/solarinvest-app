// src/features/simulacoes/SimulacoesHeroCard.tsx
// Hero card displayed at the top of the Simulações page.
// Extracted from App.tsx (Subfase 2B.12.1).

import { type AprovacaoStatus, APROVACAO_SELLOS } from './simulacoesConstants'

interface SimulacoesHeroCardProps {
  aprovacaoStatus: AprovacaoStatus
  ultimaDecisaoTimestamp: number | null
  onRegistrarDecisao: (status: AprovacaoStatus) => void
  isAnaliseMobileSimpleView: boolean
  sectionCopy: string
}

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

export function SimulacoesHeroCard({
  aprovacaoStatus,
  ultimaDecisaoTimestamp,
  onRegistrarDecisao,
  isAnaliseMobileSimpleView,
  sectionCopy,
}: SimulacoesHeroCardProps) {
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
        <div className="simulacoes-hero-buttons">
          <button type="button" className="primary" onClick={() => onRegistrarDecisao('aprovado')}>
            Aprovar
          </button>
          <button type="button" className="secondary" onClick={() => onRegistrarDecisao('reprovado')}>
            Reprovar
          </button>
        </div>
      </div>
    </div>
  )
}
