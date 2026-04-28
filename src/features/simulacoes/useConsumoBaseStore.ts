import { createStore } from '../../store/createStore'

export interface ConsumoBaseState {
  kcKwhMes: number
  consumoManual: boolean
}

export interface ConsumoBaseActions {
  setKcKwhMes: (value: number, origin?: 'user' | 'auto') => void
  setConsumoManual: (value: boolean) => void
  resetConsumoBase: () => void
}

export type ConsumoBaseStore = ConsumoBaseState & ConsumoBaseActions

const CONSUMO_BASE_DEFAULTS: ConsumoBaseState = {
  kcKwhMes: 0,
  consumoManual: false,
}

export const useConsumoBaseStore = createStore<ConsumoBaseStore>((set) => ({
  ...CONSUMO_BASE_DEFAULTS,
  setKcKwhMes: (value, origin) => {
    const normalized = Math.max(0, Number(value) || 0)
    if (origin === 'user') {
      set({ kcKwhMes: normalized, consumoManual: true })
    } else {
      set({ kcKwhMes: normalized })
    }
  },
  setConsumoManual: (value) => set({ consumoManual: value }),
  resetConsumoBase: () => set({ ...CONSUMO_BASE_DEFAULTS }),
}))

// State selectors
export const selectKcKwhMes = (s: ConsumoBaseStore) => s.kcKwhMes
export const selectConsumoManual = (s: ConsumoBaseStore) => s.consumoManual

// Action selectors
export const selectSetKcKwhMes = (s: ConsumoBaseStore) => s.setKcKwhMes
export const selectSetConsumoManual = (s: ConsumoBaseStore) => s.setConsumoManual
export const selectResetConsumoBase = (s: ConsumoBaseStore) => s.resetConsumoBase
