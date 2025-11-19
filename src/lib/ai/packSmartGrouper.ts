import type { RecomendacaoPlano } from './simulacaoRecommender'
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
  destaque?: RecomendacaoPlano['destaque']
}

type Grupo = {
  id: string
  nome: string
  criterio: string
  simulacoes: SimulacaoResultado[]
}

const media = (valores: number[]) => (valores.length ? valores.reduce((acc, valor) => acc + valor, 0) / valores.length : 0)

const buildPack = (grupo: Grupo): PackInteligente => {
  const simulacaoIds = grupo.simulacoes.map((sim) => sim.input.metadata?.planoId ?? sim.input.metadata?.nome ?? sim.input.distribuidoraId)
  const roiMedio = media(grupo.simulacoes.map((sim) => sim.kpisAvancados.roi))
  const riscoMedio = media(
    grupo.simulacoes.map((sim) => sim.riscoMonteCarlo?.estatisticas.desvioPadraoRoi ?? 0.05),
  )
  const margemMedia = media(grupo.simulacoes.map((sim) => sim.kpisAvancados.margemMedia))
  return {
    id: grupo.id,
    nome: grupo.nome,
    criterio: grupo.criterio,
    simulacaoIds,
    kpisResumo: {
      roiMedio,
      riscoMedio,
      margemMedia,
    },
  }
}

const agruparPorTipoSistema = (simulacoes: SimulacaoResultado[]): Grupo[] => {
  const grupos = new Map<string, SimulacaoResultado[]>()
  simulacoes.forEach((sim) => {
    const tipo = sim.input.metadata?.tipoSistema ?? 'Convencional'
    const arr = grupos.get(tipo) ?? []
    arr.push(sim)
    grupos.set(tipo, arr)
  })
  return Array.from(grupos.entries()).map(([tipo, sims]) => ({
    id: `tipo-${tipo.toLowerCase()}`,
    nome: `Sistemas ${tipo}`,
    criterio: `Tipo de sistema: ${tipo}`,
    simulacoes: sims,
  }))
}

const agruparPorFaixaROI = (simulacoes: SimulacaoResultado[]): Grupo[] => {
  const buckets: Array<{ id: string; nome: string; range: [number, number] }> = [
    { id: 'roi-negativo', nome: 'ROI Negativo', range: [-Infinity, 0] },
    { id: 'roi-baixo', nome: 'ROI até 10%', range: [0, 0.1] },
    { id: 'roi-medio', nome: 'ROI 10% a 20%', range: [0.1, 0.2] },
    { id: 'roi-alto', nome: 'ROI acima 20%', range: [0.2, Infinity] },
  ]
  return buckets
    .map((bucket) => {
      const simulacoesBucket = simulacoes.filter((sim) => sim.kpisAvancados.roi >= bucket.range[0] && sim.kpisAvancados.roi < bucket.range[1])
      return simulacoesBucket.length
        ? {
            id: bucket.id,
            nome: bucket.nome,
            criterio: 'Faixa de ROI',
            simulacoes: simulacoesBucket,
          }
        : undefined
    })
    .filter((grupo): grupo is Grupo => Boolean(grupo))
}

const agruparPorRisco = (simulacoes: SimulacaoResultado[]): Grupo[] => {
  const baixo = simulacoes.filter((sim) => (sim.riscoMonteCarlo?.estatisticas.desvioPadraoRoi ?? 0.05) < 0.05)
  const medio = simulacoes.filter((sim) => {
    const risco = sim.riscoMonteCarlo?.estatisticas.desvioPadraoRoi ?? 0.05
    return risco >= 0.05 && risco < 0.12
  })
  const alto = simulacoes.filter((sim) => (sim.riscoMonteCarlo?.estatisticas.desvioPadraoRoi ?? 0.05) >= 0.12)

  return [
    baixo.length
      ? { id: 'risco-baixo', nome: 'Perfil Risco Baixo', criterio: 'Desvio padrão de ROI', simulacoes: baixo }
      : undefined,
    medio.length
      ? { id: 'risco-medio', nome: 'Perfil Risco Médio', criterio: 'Desvio padrão de ROI', simulacoes: medio }
      : undefined,
    alto.length
      ? { id: 'risco-alto', nome: 'Perfil Risco Alto', criterio: 'Desvio padrão de ROI', simulacoes: alto }
      : undefined,
  ].filter((grupo): grupo is Grupo => Boolean(grupo))
}

const agruparPorDistribuidora = (simulacoes: SimulacaoResultado[]): Grupo[] => {
  const grupos = new Map<string, SimulacaoResultado[]>()
  simulacoes.forEach((sim) => {
    const id = sim.input.distribuidoraId
    const arr = grupos.get(id) ?? []
    arr.push(sim)
    grupos.set(id, arr)
  })

  return Array.from(grupos.entries()).map(([id, sims]) => ({
    id: `dist-${id}`,
    nome: `Distribuidora ${id}`,
    criterio: 'Região / distribuidora',
    simulacoes: sims,
  }))
}

const dedupePacks = (packs: PackInteligente[]): PackInteligente[] => {
  const seen = new Set<string>()
  return packs.filter((pack) => {
    if (seen.has(pack.id)) {
      return false
    }
    seen.add(pack.id)
    return true
  })
}

export const buildSmartPacks = (simulacoes: SimulacaoResultado[]): PackInteligente[] => {
  if (!simulacoes.length) {
    return []
  }

  const grupos: Grupo[] = [
    ...agruparPorTipoSistema(simulacoes),
    ...agruparPorFaixaROI(simulacoes),
    ...agruparPorRisco(simulacoes),
    ...agruparPorDistribuidora(simulacoes),
  ]

  const packs = grupos.map((grupo) => buildPack(grupo))
  return dedupePacks(packs)
}
