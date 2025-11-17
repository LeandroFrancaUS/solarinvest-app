import { renderToStaticMarkup } from 'react-dom/server'

import { SimulationReportLite } from '../../export/SimulationReportLite'
import type { RecomendacaoLite } from '../../../lib/ai/simulacaoRecommenderLite'
import type { SimulacaoLitePlano } from '../../../store/simulacoesLiteStore'

export const openSimulacaoLiteReport = (
  plano: SimulacaoLitePlano,
  recomendacao: RecomendacaoLite | null,
): void => {
  const markup = renderToStaticMarkup(
    <SimulationReportLite resultado={plano.resultado} recomendacao={recomendacao} />,
  )
  if (typeof window === 'undefined') {
    return
  }
  const popup = window.open('', '_blank')
  if (!popup) {
    return
  }
  popup.document.write(
    `<!doctype html><html><head><meta charset="utf-8" /><title>Relatório LITE</title></head><body>${markup}</body></html>`,
  )
  popup.document.close()
  popup.focus()
  popup.print()
}
