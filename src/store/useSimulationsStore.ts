import { createStore } from './createStore'
import { makeSimId, type Simulacao } from '../lib/finance/simulation'

const STORAGE_KEY = 'solarinvest:simulacoes:v1'
const STORAGE_SAVE_DELAY = 300

export type SimulationsState = {
  items: Record<string, Simulacao>
  selectedIds: string[]
  activeId: string | null
  add: (simulacao: Simulacao) => void
  update: (id: string, patch: Partial<Simulacao>) => void
  remove: (id: string) => void
  duplicate: (id: string) => Simulacao | undefined
  select: (ids: string[]) => void
  clearSelection: () => void
  setActive: (id: string | null) => void
}

type PersistedState = Pick<SimulationsState, 'items' | 'selectedIds' | 'activeId'>

const loadPersistedState = (): PersistedState | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return undefined
    }

    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      items: parsed.items ?? {},
      selectedIds: parsed.selectedIds ?? [],
      activeId: parsed.activeId ?? null,
    }
  } catch (error) {
    console.warn('Falha ao carregar simulações salvas', error)
    return undefined
  }
}

const queuePersist = (() => {
  let timeout: ReturnType<typeof setTimeout> | undefined

  return (state: SimulationsState) => {
    if (typeof window === 'undefined') {
      return
    }

    const snapshot: PersistedState = {
      items: state.items,
      selectedIds: state.selectedIds,
      activeId: state.activeId,
    }

    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
      } catch (error) {
        console.warn('Falha ao salvar simulações', error)
      }
    }, STORAGE_SAVE_DELAY)
  }
})()

export const useSimulationsStore = createStore<SimulationsState>((set, get) => ({
  items: {},
  selectedIds: [],
  activeId: null,
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
      const filteredSelected = state.selectedIds.filter((selectedId) => selectedId !== id)
      const nextActive = state.activeId === id ? null : state.activeId
      return {
        items: resto,
        selectedIds: filteredSelected,
        activeId: nextActive,
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
    const { nome, ...resto } = existente
    const copia: Simulacao = {
      ...resto,
      ...(nome ? { nome: `${nome} (cópia)` } : {}),
      id: novoId,
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({
      items: {
        ...state.items,
        [copia.id]: copia,
      },
      activeId: state.activeId,
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
  setActive(id) {
    if (id === null) {
      set((state) => (state.activeId === null ? state : { ...state, activeId: null }))
      return
    }
    set((state) => {
      if (!state.items[id] || state.activeId === id) {
        return state
      }
      return { ...state, activeId: id }
    })
  },
}))

const persisted = loadPersistedState()
if (persisted) {
  useSimulationsStore.setState({
    items: persisted.items,
    selectedIds: persisted.selectedIds,
    activeId: persisted.activeId ?? null,
  })
}

if (typeof window !== 'undefined') {
  useSimulationsStore.subscribe((state, previous) => {
    if (
      state.items !== previous.items ||
      state.selectedIds !== previous.selectedIds ||
      state.activeId !== previous.activeId
    ) {
      queuePersist(state)
    }
  })
}

export const simulationsSelectors = {
  list: (state: SimulationsState): Simulacao[] =>
    Object.values(state.items).sort((a, b) => b.updatedAt - a.updatedAt),
  getById: (state: SimulationsState, id: string): Simulacao | undefined => state.items[id],
}
