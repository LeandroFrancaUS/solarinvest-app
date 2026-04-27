import { createStore } from '../../store/createStore'
import { IRRADIACAO_FALLBACK } from '../../utils/irradiacao'
import { INITIAL_VALUES } from '../../app/config'

export interface SimulacaoBaseState {
  irradiacao: number
  eficiencia: number
  diasMes: number
}

export interface SimulacaoBaseActions {
  setIrradiacao: (value: number) => void
  setEficiencia: (value: number) => void
  setDiasMes: (value: number) => void
  resetSimulacaoBase: () => void
}

export type SimulacaoBaseStore = SimulacaoBaseState & SimulacaoBaseActions

const SIMULACAO_BASE_DEFAULTS: SimulacaoBaseState = {
  irradiacao: IRRADIACAO_FALLBACK,
  eficiencia: INITIAL_VALUES.eficiencia,
  diasMes: INITIAL_VALUES.diasMes,
}

export const useSimulacaoBaseStore = createStore<SimulacaoBaseStore>((set) => ({
  ...SIMULACAO_BASE_DEFAULTS,
  setIrradiacao: (value) => set({ irradiacao: value }),
  setEficiencia: (value) => set({ eficiencia: value }),
  setDiasMes: (value) => set({ diasMes: value }),
  resetSimulacaoBase: () => set({ ...SIMULACAO_BASE_DEFAULTS }),
}))

// State selectors
export const selectIrradiacao = (s: SimulacaoBaseStore) => s.irradiacao
export const selectEficiencia = (s: SimulacaoBaseStore) => s.eficiencia
export const selectDiasMes = (s: SimulacaoBaseStore) => s.diasMes

// Action selectors
export const selectSetIrradiacao = (s: SimulacaoBaseStore) => s.setIrradiacao
export const selectSetEficiencia = (s: SimulacaoBaseStore) => s.setEficiencia
export const selectSetDiasMes = (s: SimulacaoBaseStore) => s.setDiasMes

// Derived selectors
export const selectBaseIrradiacao = (s: SimulacaoBaseStore) =>
  s.irradiacao > 0 ? s.irradiacao : 0

export const selectEficienciaNormalizada = (s: SimulacaoBaseStore) => {
  if (s.eficiencia <= 0) return 0
  if (s.eficiencia >= 1.5) return s.eficiencia / 100
  return s.eficiencia
}

export const selectDiasMesNormalizado = (s: SimulacaoBaseStore) =>
  s.diasMes > 0 ? s.diasMes : 0
