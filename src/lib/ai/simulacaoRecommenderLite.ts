import type { SimulacaoLiteResultado } from '../finance/simulacaoEngineLite'

export type PlanoSimulacaoLite = {
  planoId: string
  nomePlano: string
  resultado: SimulacaoLiteResultado
}

export type RecomendacaoLite = {
  planoId: string
  nomePlano: string
  motivoResumo: string
}

const pesoROI = 0.5
const pesoLucro = 0.3
const pesoPayback = 0.2

const normalize = (value: number, max: number): number => {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(max) || max <= 0) {
    return 0
  }
  return value / max
}

export const gerarRecomendacaoLite = (planos: PlanoSimulacaoLite[]): RecomendacaoLite | null => {
  if (planos.length === 0) {
    return null
  }
  const baseDados = planos.map((plano) => {
    const base = plano.resultado.cenarios.base
    return {
      plano,
      roi: base.kpisEssenciais.roiPercent,
      payback: base.kpisEssenciais.paybackMeses,
      lucroTotal: base.kpisEssenciais.lucroLiquidoTotal,
    }
  })
  const maxLucro = Math.max(...baseDados.map((item) => item.lucroTotal), 0)
  const maxRoi = Math.max(...baseDados.map((item) => item.roi), 0)
  const maxPayback = Math.max(...baseDados.map((item) => item.payback), 0)
  let melhor: { plano: PlanoSimulacaoLite; score: number } | null = null
  baseDados.forEach((item) => {
    const roiScore = normalize(item.roi, maxRoi)
    const lucroScore = normalize(item.lucroTotal, maxLucro)
    const paybackScore = normalize(item.payback, maxPayback)
    const score = pesoROI * roiScore + pesoLucro * lucroScore - pesoPayback * paybackScore
    if (!melhor || score > melhor.score) {
      melhor = { plano: item.plano, score }
    }
  })
  if (!melhor) {
    return null
  }
  const plano = melhor.plano
  const base = plano.resultado.cenarios.base
  const roi = base.kpisEssenciais.roiPercent
  const payback = base.kpisEssenciais.paybackMeses
  return {
    planoId: plano.planoId,
    nomePlano: plano.nomePlano,
    motivoResumo: `Recomendação: O plano ${plano.nomePlano} apresenta o melhor equilíbrio entre retorno e prazo, com ROI de ${roi.toFixed(
      1,
    )}% e payback estimado em ${Math.round(payback)} meses, considerando a projeção de tarifa da distribuidora.`,
  }
}
