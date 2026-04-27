// src/features/simulacoes/useAprovacaoStore.ts
// Dedicated store for AF approval state (Fase 3.7-A).
// Migrated from App.tsx useState + useCallback declarations.

import { createStore } from '../../store/createStore'
import type { AprovacaoChecklistKey, AprovacaoStatus } from './simulacoesConstants'

export interface AprovacaoState {
  aprovacaoStatus: AprovacaoStatus
  aprovacaoChecklist: Record<AprovacaoChecklistKey, boolean>
  ultimaDecisaoTimestamp: number | null
}

export interface AprovacaoActions {
  registrarDecisaoInterna: (status: AprovacaoStatus) => void
  toggleAprovacaoChecklist: (key: AprovacaoChecklistKey) => void
  resetAprovacao: () => void
}

export type AprovacaoStore = AprovacaoState & AprovacaoActions

const APROVACAO_DEFAULTS: AprovacaoState = {
  aprovacaoStatus: 'pendente',
  aprovacaoChecklist: {
    roi: true,
    tir: true,
    spread: false,
    vpl: false,
    payback: true,
    eficiencia: true,
    lucro: true,
  },
  ultimaDecisaoTimestamp: null,
}

export const useAprovacaoStore = createStore<AprovacaoStore>((set) => ({
  ...APROVACAO_DEFAULTS,
  registrarDecisaoInterna: (status) =>
    set({ aprovacaoStatus: status, ultimaDecisaoTimestamp: Date.now() }),
  toggleAprovacaoChecklist: (key) =>
    set((prev) => ({
      aprovacaoChecklist: {
        ...prev.aprovacaoChecklist,
        [key]: !prev.aprovacaoChecklist[key],
      },
    })),
  resetAprovacao: () => set(() => ({ ...APROVACAO_DEFAULTS })),
}))

// Selectors
export const selectAprovacaoStatus = (s: AprovacaoStore) => s.aprovacaoStatus
export const selectAprovacaoChecklist = (s: AprovacaoStore) => s.aprovacaoChecklist
export const selectUltimaDecisaoTimestamp = (s: AprovacaoStore) => s.ultimaDecisaoTimestamp
export const selectRegistrarDecisaoInterna = (s: AprovacaoStore) => s.registrarDecisaoInterna
export const selectToggleAprovacaoChecklist = (s: AprovacaoStore) => s.toggleAprovacaoChecklist
