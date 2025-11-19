import type { SimulacaoResultado } from '../finance/simulacaoEngineV35'

export type RecomendacaoPlano = {
  planoId: string
  rankingGlobal: number
  motivosChave: string[]
  destaque: 'melhorROI' | 'melhorPayback' | 'melhorRisco' | 'equilibrado'
}

type ResultadoComPlano = SimulacaoResultado & { input: SimulacaoResultado['input'] & { metadata?: { planoId?: string } } }

type MetricasPlano = {
  planoId: string
  roi: number
  payback: number | null
  vpl: number
  tir: number
  risco: number
  tusd: number
}

const normalizar = (valor: number, min: number, max: number, invert = false) => {
  if (max - min === 0) {
    return 0.5
  }
  const normalized = (valor - min) / (max - min)
  return invert ? 1 - normalized : normalized
}

const extrairMetricas = (simulacoes: ResultadoComPlano[]): MetricasPlano[] =>
  simulacoes.map((resultado) => {
    const planoId = resultado.input.metadata?.planoId ?? resultado.input.metadata?.nome ?? 'plano-desconhecido'
    const risco = resultado.riscoMonteCarlo?.estatisticas.desvioPadraoRoi ?? 0.05
    const tusd = resultado.seriesAno.reduce((acc, item) => acc + item.tusdAbsorvida, 0) / Math.max(1, resultado.seriesAno.length)
    return {
      planoId,
      roi: resultado.kpisAvancados.roi,
      payback: resultado.kpisAvancados.payback,
      vpl: resultado.kpisAvancados.vpl,
      tir: resultado.kpisAvancados.tir,
      risco,
      tusd,
    }
  })

const resolverFaixa = (metricas: MetricasPlano[], campo: keyof MetricasPlano) => {
  const valores = metricas.map((item) => item[campo]).filter((value): value is number => value !== null)
  if (valores.length === 0) {
    return { min: 0, max: 1 }
  }
  return { min: Math.min(...valores), max: Math.max(...valores) }
}

const PESOS = {
  roi: 0.3,
  payback: 0.25,
  vpl: 0.2,
  tir: 0.15,
  risco: 0.05,
  tusd: 0.05,
}

export const recomendarPlanos = (resultados: ResultadoComPlano[]): RecomendacaoPlano[] => {
  if (!resultados.length) {
    return []
  }

  const metricas = extrairMetricas(resultados)
  const faixaROI = resolverFaixa(metricas, 'roi')
  const faixaPayback = resolverFaixa(metricas, 'payback')
  const faixaVPL = resolverFaixa(metricas, 'vpl')
  const faixaTIR = resolverFaixa(metricas, 'tir')
  const faixaRisco = resolverFaixa(metricas, 'risco')
  const faixaTUSD = resolverFaixa(metricas, 'tusd')

  const recomendacoes = metricas.map((metrica) => {
    const scoreROI = normalizar(metrica.roi, faixaROI.min, faixaROI.max)
    const scorePayback = normalizar(metrica.payback ?? faixaPayback.max, faixaPayback.min, faixaPayback.max, true)
    const scoreVPL = normalizar(metrica.vpl, faixaVPL.min, faixaVPL.max)
    const scoreTIR = normalizar(metrica.tir, faixaTIR.min, faixaTIR.max)
    const scoreRisco = normalizar(metrica.risco, faixaRisco.min, faixaRisco.max, true)
    const scoreTUSD = normalizar(metrica.tusd, faixaTUSD.min, faixaTUSD.max, true)

    const rankingGlobal =
      scoreROI * PESOS.roi +
      scorePayback * PESOS.payback +
      scoreVPL * PESOS.vpl +
      scoreTIR * PESOS.tir +
      scoreRisco * PESOS.risco +
      scoreTUSD * PESOS.tusd

    const motivos = buildMotivos(metrica, faixaROI, faixaPayback, faixaVPL)
    const destaque = resolverDestaque(metrica, metricas)

    return {
      planoId: metrica.planoId,
      rankingGlobal,
      motivosChave: motivos,
      destaque,
    }
  })

  return recomendacoes.sort((a, b) => b.rankingGlobal - a.rankingGlobal)
}

const buildMotivos = (
  metrica: MetricasPlano,
  faixaROI: { min: number; max: number },
  faixaPayback: { min: number; max: number },
  faixaVPL: { min: number; max: number },
): string[] => {
  const motivos: string[] = []
  const roiRelativo = normalizar(metrica.roi, faixaROI.min, faixaROI.max)
  if (roiRelativo > 0.8) {
    motivos.push(`ROI projetado ${Math.round(metrica.roi * 100)}% acima da média`)
  }
  if (metrica.payback !== null) {
    const paybackRelativo = normalizar(
      metrica.payback,
      faixaPayback.min,
      faixaPayback.max,
      true,
    )
    if (paybackRelativo > 0.75) {
      motivos.push(`Payback estimado em ${metrica.payback.toFixed(1)} anos`)
    }
  }
  const vplRelativo = normalizar(metrica.vpl, faixaVPL.min, faixaVPL.max)
  if (vplRelativo > 0.7) {
    motivos.push(`VPL positivo em R$ ${metrica.vpl.toFixed(0)}`)
  }
  return motivos
}

const resolverDestaque = (metrica: MetricasPlano, metricas: MetricasPlano[]): RecomendacaoPlano['destaque'] => {
  const melhorRoi = metricas.reduce((acc, item) => (item.roi > acc.roi ? item : acc))
  if (metrica.planoId === melhorRoi.planoId) {
    return 'melhorROI'
  }
  const melhorPayback = metricas
    .filter((item) => item.payback !== null)
    .reduce((acc, item) => (acc === null || (item.payback ?? Infinity) < (acc.payback ?? Infinity) ? item : acc), null as MetricasPlano | null)
  if (melhorPayback && metrica.planoId === melhorPayback.planoId) {
    return 'melhorPayback'
  }
  const menorRisco = metricas.reduce((acc, item) => (item.risco < acc.risco ? item : acc))
  if (menorRisco && metrica.planoId === menorRisco.planoId) {
    return 'melhorRisco'
  }
  return 'equilibrado'
}

export const gerarResumoRecomendacao = (recomendacao: RecomendacaoPlano): string => {
  const [motivoPrincipal, ...extras] = recomendacao.motivosChave
  const base = motivoPrincipal ?? 'Plano equilibrado considerando ROI e payback.'
  if (!extras.length) {
    return base
  }
  return `${base} ${extras.join(' | ')}`
}
