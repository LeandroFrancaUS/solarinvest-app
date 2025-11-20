import type { SimulacaoResultado } from '../finance/simulacaoEngineV35'

export type PackInteligente = {
  id: string
  nome: string
  criterio: string
  simulacaoIds: string[]
  kpisResumo: {
    roiMedio: number
    riscoMedio: number
    margemMedia: number
  }
}

export function buildSmartPacks(simulacoes: SimulacaoResultado[]): PackInteligente[] {
  if (!simulacoes.length) return []

  const byTipo = groupBy(simulacoes, (s) => s.input.tipoSistema)
  const packs: PackInteligente[] = []

  Object.entries(byTipo).forEach(([tipo, sims]) => {
    const roiMedio = average(sims.map((s) => s.kpisEssenciais.roiTotalPercent))
    const riscoMedio = average(
      sims.map((s) => s.riscoMonteCarlo?.estatisticas.desvioPadraoRoi ?? Math.abs(s.kpisEssenciais.roiAnualPercent) * 0.1),
    )
    const margemMedia = average(sims.map((s) => s.kpisEssenciais.margemLiquidaPercent))

    packs.push({
      id: `pack-${tipo}`,
      nome: `Pacote ${tipo}`,
      criterio: `Agrupado por tipo de sistema (${tipo})`,
      simulacaoIds: sims.map((s) => s.input.id ?? s.input.tipoSistema),
      kpisResumo: { roiMedio, riscoMedio, margemMedia },
    })
  })

  const altoROI = simulacoes
    .filter((s) => s.kpisEssenciais.roiAnualPercent > 30)
    .map((s) => s.input.id ?? s.input.tipoSistema)
  if (altoROI.length) {
    packs.push({
      id: 'pack-roi-alto',
      nome: 'ROI Elevado',
      criterio: 'ROI anual acima de 30%',
      simulacaoIds: altoROI,
      kpisResumo: {
        roiMedio: average(simulacoes.map((s) => s.kpisEssenciais.roiAnualPercent)),
        riscoMedio: average(
          simulacoes.map((s) => s.riscoMonteCarlo?.estatisticas.desvioPadraoRoi ?? Math.abs(s.kpisEssenciais.roiAnualPercent) * 0.1),
        ),
        margemMedia: average(simulacoes.map((s) => s.kpisEssenciais.margemLiquidaPercent)),
      },
    })
  }

  return packs
}

const groupBy = <T, K extends string | number>(items: T[], key: (item: T) => K): Record<K, T[]> => {
  return items.reduce((acc, item) => {
    const groupKey = key(item)
    acc[groupKey] = acc[groupKey] ?? []
    acc[groupKey].push(item)
    return acc
  }, {} as Record<K, T[]>)
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)
