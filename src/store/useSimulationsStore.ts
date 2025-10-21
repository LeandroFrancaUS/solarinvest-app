import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { makeSimId, type Simulacao } from '../lib/finance/simulation'

const STORAGE_KEY = 'solarinvest:simulacoes:v1'

export type SimulationsState = {
  items: Record<string, Simulacao>
  selectedIds: string[]
  add: (simulacao: Simulacao) => void
  update: (id: string, patch: Partial<Simulacao>) => void
  remove: (id: string) => void
  duplicate: (id: string) => Simulacao | undefined
  select: (ids: string[]) => void
  clearSelection: () => void
}

const storage = createJSONStorage(
  () => (typeof window !== 'undefined' ? window.localStorage : undefined),
  { delayMs: 300 },
)

export const useSimulationsStore = create<SimulationsState>()(
  persist(
    (set, get) => ({
      items: {},
      selectedIds: [],
      add(simulacao) {
        const now = Date.now()
        const payload: Simulacao = {
          ...simulacao,
          createdAt: simulacao.createdAt ?? now,
          updatedAt: now,
        }
        set((state) => ({
          items: {
            ...state.items,
            [payload.id]: payload,
          },
        }))
      },
      update(id, patch) {
        set((state) => {
          const existente = state.items[id]
          if (!existente) {
            return state
          }
          const now = Date.now()
          const atualizado: Simulacao = {
            ...existente,
            ...patch,
            id,
            updatedAt: now,
          }
          return {
            items: {
              ...state.items,
              [id]: atualizado,
            },
          }
        })
      },
      remove(id) {
        set((state) => {
          if (!state.items[id]) {
            return state
          }
          const { [id]: _removido, ...resto } = state.items
          return {
            items: resto,
            selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
          }
        })
      },
      duplicate(id) {
        const existente = get().items[id]
        if (!existente) {
          return undefined
        }
        const now = Date.now()
        const novoId = makeSimId()
        const copia: Simulacao = {
          ...existente,
          id: novoId,
          nome: existente.nome ? `${existente.nome} (cópia)` : undefined,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          items: {
            ...state.items,
            [copia.id]: copia,
          },
        }))
        return copia
      },
      select(ids) {
        const base = get().items
        const unique = Array.from(new Set(ids)).filter((identifier) => Boolean(base[identifier]))
        set({ selectedIds: unique })
      },
      clearSelection() {
        set({ selectedIds: [] })
      },
    }),
    {
      name: STORAGE_KEY,
      storage,
      partialize: (state) => ({ items: state.items, selectedIds: state.selectedIds }),
    },
  ),
)

export const simulationsSelectors = {
  list: (state: SimulationsState): Simulacao[] =>
    Object.values(state.items).sort((a, b) => b.updatedAt - a.updatedAt),
  getById: (state: SimulationsState, id: string): Simulacao | undefined => state.items[id],
}
