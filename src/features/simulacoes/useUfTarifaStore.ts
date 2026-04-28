// src/features/simulacoes/useUfTarifaStore.ts
// Dedicated store for ufTarifa (Fase 3.7-B-4.1).
// Dual-write target — App.tsx useState remains the source of truth for now.

import { createStore } from '../../store/createStore'

export interface UfTarifaState {
  ufTarifa: string
}

export interface UfTarifaActions {
  setUfTarifa: (value: string) => void
  resetUfTarifa: () => void
}

export type UfTarifaStore = UfTarifaState & UfTarifaActions

const UF_TARIFA_DEFAULTS: UfTarifaState = {
  ufTarifa: 'GO',
}

export const useUfTarifaStore = createStore<UfTarifaStore>((set) => ({
  ...UF_TARIFA_DEFAULTS,
  setUfTarifa: (value) => set({ ufTarifa: value }),
  resetUfTarifa: () => set({ ...UF_TARIFA_DEFAULTS }),
}))

// State selectors
export const selectUfTarifa = (s: UfTarifaStore) => s.ufTarifa

// Action selectors
export const selectSetUfTarifa = (s: UfTarifaStore) => s.setUfTarifa
export const selectResetUfTarifa = (s: UfTarifaStore) => s.resetUfTarifa
