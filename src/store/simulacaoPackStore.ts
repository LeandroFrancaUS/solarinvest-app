import { createStore } from './createStore'
import type { PackInteligente } from '../lib/ai/packSmartGrouper'

type PreferenciasPacks = {
  heatmapView?: 'roi' | 'risco' | 'margem'
  ordenarPor?: 'roi' | 'risco' | 'margem'
}

type PackManual = {
  id: string
  nome: string
  simulacaoIds: string[]
}

type PackStoreState = {
  packsManuais: Record<string, PackManual>
  packsInteligentes: Record<string, PackInteligente>
  preferencias: PreferenciasPacks
  salvarPackManual: (pack: PackManual) => void
  salvarPacksInteligentes: (packs: PackInteligente[]) => void
  atualizarPreferencias: (preferencias: Partial<PreferenciasPacks>) => void
  removerPackManual: (id: string) => void
  reset: () => void
}

export const useSimulacaoPackStore = createStore<PackStoreState>((set, get) => ({
  packsManuais: {},
  packsInteligentes: {},
  preferencias: {},
  salvarPackManual: (pack) =>
    set(() => ({
      packsManuais: { ...get().packsManuais, [pack.id]: pack },
    })),
  salvarPacksInteligentes: (packs) =>
    set(() => {
      const mapa = packs.reduce<Record<string, PackInteligente>>((acc, item) => {
        acc[item.id] = item
        return acc
      }, {})
      return { packsInteligentes: mapa }
    }),
  atualizarPreferencias: (preferencias) =>
    set(() => ({
      preferencias: { ...get().preferencias, ...preferencias },
    })),
  removerPackManual: (id) =>
    set(() => {
      const { [id]: _, ...resto } = get().packsManuais
      return { packsManuais: resto }
    }),
  reset: () =>
    set(() => ({
      packsManuais: {},
      packsInteligentes: {},
      preferencias: {},
    })),
}))
