import { create } from 'zustand'
import type {
  SimulacaoLiteResultado,
  SimulacaoLiteScenarioKey,
  SimulacaoLiteInput,
} from '../lib/finance/simulacaoEngineLite'
import type { RecomendacaoLite } from '../lib/ai/simulacaoRecommenderLite'

export type SimulacaoLitePlano = {
  id: string
  nome: string
  input: SimulacaoLiteInput
  resultado: SimulacaoLiteResultado
}

export type SimulacoesLiteState = {
  planos: SimulacaoLitePlano[]
  selectedPlanoId: string | null
  selectedScenario: SimulacaoLiteScenarioKey
  recomendacao: RecomendacaoLite | null
  upsertPlano: (plano: SimulacaoLitePlano) => void
  removePlano: (id: string) => void
  setSelectedPlano: (id: string | null) => void
  setSelectedScenario: (scenario: SimulacaoLiteScenarioKey) => void
  setRecomendacao: (recomendacao: RecomendacaoLite | null) => void
  reset: () => void
}

const defaultState: Omit<SimulacoesLiteState, 'upsertPlano' | 'removePlano' | 'setSelectedPlano' | 'setSelectedScenario' | 'setRecomendacao' | 'reset'>
  = {
    planos: [],
    selectedPlanoId: null,
    selectedScenario: 'base',
    recomendacao: null,
  }

export const useSimulacoesLiteStore = create<SimulacoesLiteState>((set) => ({
  ...defaultState,
  upsertPlano: (plano) =>
    set((state) => {
      const existenteIndex = state.planos.findIndex((p) => p.id === plano.id)
      const planos = [...state.planos]
      if (existenteIndex >= 0) {
        planos[existenteIndex] = plano
      } else {
        planos.push(plano)
      }
      const selectedPlanoId = plano.id
      return { ...state, planos, selectedPlanoId }
    }),
  removePlano: (id) =>
    set((state) => ({
      planos: state.planos.filter((plano) => plano.id !== id),
      selectedPlanoId: state.selectedPlanoId === id ? null : state.selectedPlanoId,
    })),
  setSelectedPlano: (id) => set((state) => ({ ...state, selectedPlanoId: id })),
  setSelectedScenario: (scenario) => set((state) => ({ ...state, selectedScenario: scenario })),
  setRecomendacao: (recomendacao) => set((state) => ({ ...state, recomendacao })),
  reset: () => set({ ...defaultState }),
}))

export const makeLitePlanoId = (nome: string): string => {
  const base = nome.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (base) {
    return base
  }
  return `plano-${Date.now()}`
}
