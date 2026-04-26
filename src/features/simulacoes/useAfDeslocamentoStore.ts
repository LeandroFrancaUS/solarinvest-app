import type { CidadeDB } from '../../data/cidades'
import { createStore } from '../../store/createStore'

export type AfDeslocamentoStatus = 'idle' | 'loading' | 'isenta' | 'ok' | 'error'

export interface AfDeslocamentoState {
  afCidadeDestino: string
  afDeslocamentoKm: number
  afDeslocamentoRs: number
  afDeslocamentoStatus: AfDeslocamentoStatus
  afDeslocamentoCidadeLabel: string
  afDeslocamentoErro: string
  afCidadeSuggestions: CidadeDB[]
  afCidadeShowSuggestions: boolean
}

export interface AfDeslocamentoActions {
  setAfCidadeDestino: (value: string) => void
  setAfDeslocamentoKm: (value: number) => void
  setAfDeslocamentoRs: (value: number) => void
  setAfDeslocamentoStatus: (value: AfDeslocamentoStatus) => void
  setAfDeslocamentoCidadeLabel: (value: string) => void
  setAfDeslocamentoErro: (value: string) => void
  setAfCidadeSuggestions: (value: CidadeDB[]) => void
  setAfCidadeShowSuggestions: (value: boolean) => void
  resetAfDeslocamento: () => void
}

export type AfDeslocamentoStore = AfDeslocamentoState & AfDeslocamentoActions

const AF_DESLOCAMENTO_DEFAULTS: AfDeslocamentoState = {
  afCidadeDestino: '',
  afDeslocamentoKm: 0,
  afDeslocamentoRs: 0,
  afDeslocamentoStatus: 'idle',
  afDeslocamentoCidadeLabel: '',
  afDeslocamentoErro: '',
  afCidadeSuggestions: [],
  afCidadeShowSuggestions: false,
}

export const useAfDeslocamentoStore = createStore<AfDeslocamentoStore>((set) => ({
  ...AF_DESLOCAMENTO_DEFAULTS,
  setAfCidadeDestino: (value) => set({ afCidadeDestino: value }),
  setAfDeslocamentoKm: (value) => set({ afDeslocamentoKm: value }),
  setAfDeslocamentoRs: (value) => set({ afDeslocamentoRs: value }),
  setAfDeslocamentoStatus: (value) => set({ afDeslocamentoStatus: value }),
  setAfDeslocamentoCidadeLabel: (value) => set({ afDeslocamentoCidadeLabel: value }),
  setAfDeslocamentoErro: (value) => set({ afDeslocamentoErro: value }),
  setAfCidadeSuggestions: (value) => set({ afCidadeSuggestions: value }),
  setAfCidadeShowSuggestions: (value) => set({ afCidadeShowSuggestions: value }),
  resetAfDeslocamento: () => set({ ...AF_DESLOCAMENTO_DEFAULTS }),
}))
