import { createStore } from './createStore'
import type { RecomendacaoPlano } from '../lib/ai/simulacaoRecommender'

export type SimulacaoAIState = {
  recomendacoes: Record<string, RecomendacaoPlano>
  resumoGlobal?: string
  lastUpdated?: string
  setRecomendacoes: (lista: RecomendacaoPlano[]) => void
  setResumoGlobal: (texto?: string) => void
  reset: () => void
}

export const useSimulacaoAIStore = createStore<SimulacaoAIState>((set) => ({
  recomendacoes: {},
  resumoGlobal: undefined,
  lastUpdated: undefined,
  setRecomendacoes: (lista) =>
    set(() => {
      const mapa = lista.reduce<Record<string, RecomendacaoPlano>>((acc, rec) => {
        acc[rec.planoId] = rec
        return acc
      }, {})
      return {
        recomendacoes: mapa,
        lastUpdated: new Date().toISOString(),
      }
    }),
  setResumoGlobal: (texto) =>
    set(() => ({
      resumoGlobal: texto,
      lastUpdated: new Date().toISOString(),
    })),
  reset: () =>
    set(() => ({
      recomendacoes: {},
      resumoGlobal: undefined,
      lastUpdated: undefined,
    })),
}))
