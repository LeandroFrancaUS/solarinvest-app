import tarifasRaw from '../data/tarifas_por_classe.json' assert { type: 'json' }
import type { MultiUcClasse, MultiUcTarifa } from '../types/multiUc'

type VigenciaTarifa = {
  data_inicio: string
  data_fim: string | null
  classes: Partial<Record<MultiUcClasse, MultiUcTarifa>>
}

type DistribuidoraTarifaConfig = {
  distribuidora: string
  vigencias: VigenciaTarifa[]
}

type VigenciaNormalizada = {
  inicio: Date
  fim: Date | null
  classes: Partial<Record<MultiUcClasse, MultiUcTarifa>>
}

type DistribuidoraNormalizada = {
  nomeOriginal: string
  chave: string
  vigencias: VigenciaNormalizada[]
}

const normalizarDistribuidora = (valor: string): string => valor.trim().toLowerCase()

const parseData = (valor: string | null): Date | null => {
  if (!valor) {
    return null
  }
  const date = new Date(valor)
  return Number.isNaN(date.getTime()) ? null : date
}

const distribuidoras: DistribuidoraNormalizada[] = (tarifasRaw as DistribuidoraTarifaConfig[]).map(
  (item) => ({
    nomeOriginal: item.distribuidora,
    chave: normalizarDistribuidora(item.distribuidora),
    vigencias: item.vigencias
      .map((vigencia) => ({
        inicio: parseData(vigencia.data_inicio) ?? new Date('1970-01-01'),
        fim: parseData(vigencia.data_fim),
        classes: vigencia.classes,
      }))
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime()),
  }),
)

const findDistribuidora = (nome: string): DistribuidoraNormalizada | undefined => {
  const chave = normalizarDistribuidora(nome)
  return distribuidoras.find((item) => item.chave === chave)
}

const DEFAULT_DISTRIBUIDORA = distribuidoras.find((item) => item.chave === 'default')

const selecionarVigencia = (
  distribuidora: DistribuidoraNormalizada,
  referencia: Date,
): VigenciaNormalizada | undefined => {
  const time = referencia.getTime()
  const encontradas = distribuidora.vigencias.filter((vigencia) => {
    const inicioMs = vigencia.inicio.getTime()
    const fimMs = vigencia.fim?.getTime()
    if (Number.isNaN(inicioMs)) {
      return false
    }
    if (inicioMs > time) {
      return false
    }
    if (typeof fimMs === 'number' && fimMs < time) {
      return false
    }
    return true
  })

  if (encontradas.length === 0) {
    return distribuidora.vigencias
      .slice()
      .sort((a, b) => b.inicio.getTime() - a.inicio.getTime())[0]
  }

  return encontradas.sort((a, b) => b.inicio.getTime() - a.inicio.getTime())[0]
}

export type TarifaClasseLookup = {
  vigencia?: { inicio: Date; fim: Date | null }
  classes: Partial<Record<MultiUcClasse, MultiUcTarifa>>
}

export const buscarTarifasPorDistribuidora = (
  distribuidora: string,
  referencia: Date,
): TarifaClasseLookup => {
  const candidato = findDistribuidora(distribuidora) ?? DEFAULT_DISTRIBUIDORA
  if (!candidato) {
    return { classes: {} }
  }

  const vigencia = selecionarVigencia(candidato, referencia)
  if (!vigencia) {
    return { classes: {} }
  }

  return {
    vigencia: { inicio: vigencia.inicio, fim: vigencia.fim },
    classes: vigencia.classes,
  }
}

export const buscarTarifaPorClasse = (
  distribuidora: string,
  classe: MultiUcClasse,
  referencia: Date,
): MultiUcTarifa | undefined => {
  const principal = findDistribuidora(distribuidora)
  const base = principal ?? DEFAULT_DISTRIBUIDORA
  if (!base) {
    return undefined
  }

  const vigenciaPrincipal = selecionarVigencia(base, referencia)
  const encontrada = vigenciaPrincipal?.classes[classe]
  if (encontrada) {
    return encontrada
  }

  if (principal && DEFAULT_DISTRIBUIDORA && principal !== DEFAULT_DISTRIBUIDORA) {
    const fallback = selecionarVigencia(DEFAULT_DISTRIBUIDORA, referencia)
    return fallback?.classes[classe] ?? undefined
  }

  return undefined
}
