import type { SimulacaoResultado } from '../finance/simulacaoEngineV35'

type RecommenderInput = {
  planos: Array<{
    planoId: string
    label: string
    resultado: SimulacaoResultado
  }>
}

type RecomendacaoPlano = {
  planoId: string
  label: string
  rankingGlobal: number
  motivosChave: string[]
  destaque: 'melhorROI' | 'melhorPayback' | 'melhorRisco' | 'equilibrado'
}

type RecomendacaoConsolidada = {
  melhorPlanoId: string
  recomendacoesOrdenadas: RecomendacaoPlano[]
  resumoTexto: string
}

export function rankPlanos(input: RecommenderInput): RecomendacaoConsolidada {
  const scores: RecomendacaoPlano[] = input.planos.map((plano) => {
    const { kpisEssenciais, kpisAvancados, riscoMonteCarlo } = plano.resultado
    const roiScore = kpisEssenciais.roiAnualPercent * 0.3
    const paybackScore = kpisEssenciais.paybackMeses > 0 ? (30 / kpisEssenciais.paybackMeses) * 0.3 : 0
    const tirScore = kpisAvancados.tirRealPercent * 0.2
    const spreadScore = kpisAvancados.spreadEnergiaPercent * 0.1
    const riscoScore = riscoMonteCarlo ? -(riscoMonteCarlo.estatisticas.probRoiNegativo * 20) : 0

    const rankingGlobal = roiScore + paybackScore + tirScore + spreadScore + riscoScore

    const motivosChave = [
      `ROI anual: ${kpisEssenciais.roiAnualPercent.toFixed(1)}%`,
      `Payback: ${kpisEssenciais.paybackMeses} meses`,
      `TIR real: ${kpisAvancados.tirRealPercent.toFixed(1)}%`,
      `Spread energético: ${kpisAvancados.spreadEnergiaPercent.toFixed(1)}%`,
    ]

    const destaque: RecomendacaoPlano['destaque'] =
      kpisEssenciais.roiAnualPercent === Math.max(...input.planos.map((p) => p.resultado.kpisEssenciais.roiAnualPercent))
        ? 'melhorROI'
        : kpisEssenciais.paybackMeses ===
            Math.min(...input.planos.map((p) => p.resultado.kpisEssenciais.paybackMeses))
          ? 'melhorPayback'
          : riscoMonteCarlo &&
              riscoMonteCarlo.estatisticas.probPrejuizo ===
                Math.min(
                  ...input.planos
                    .map((p) => p.resultado.riscoMonteCarlo?.estatisticas.probPrejuizo ?? Number.POSITIVE_INFINITY),
                )
            ? 'melhorRisco'
            : 'equilibrado'

    return { planoId: plano.planoId, label: plano.label, rankingGlobal, motivosChave, destaque }
  })

  const recomendacoesOrdenadas = scores.sort((a, b) => b.rankingGlobal - a.rankingGlobal)
  const melhorPlano = recomendacoesOrdenadas[0]
  const resumoTexto = melhorPlano
    ? `Com base nas projeções e KPIs internos da SolarInvest, o plano ${melhorPlano.label} apresenta ROI anual de ${melhorPlano.rankingGlobal.toFixed(
        2,
      )} pontos de score e payback previsto em ${
        input.planos.find((p) => p.planoId === melhorPlano.planoId)?.resultado.kpisEssenciais.paybackMeses
      } meses, sendo o mais recomendado no momento.`
    : 'Nenhum plano disponível para recomendação.'

  return { melhorPlanoId: melhorPlano?.planoId ?? '', recomendacoesOrdenadas, resumoTexto }
}

export type { RecomendacaoConsolidada, RecomendacaoPlano, RecommenderInput }
