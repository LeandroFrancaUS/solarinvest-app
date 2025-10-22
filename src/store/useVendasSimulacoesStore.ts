import { createStore } from './createStore'
const STORAGE_KEY = 'solarinvest:venda-sims:v1'

export type VendasSimulacao = {
  margemManualValor?: number | null
  descontos?: number
}

export type VendasSimulacoesState = {
  simulations: Record<string, VendasSimulacao>
  initialize: (id: string, defaults?: { margemManual?: number }) => void
  update: (id: string, patch: Partial<VendasSimulacao>) => void
  remove: (id: string) => void
  clear: () => void
}

type PersistedShape = {
  simulations: Record<string, VendasSimulacao>
}

const clampNonNegative = (value: number | undefined): number | undefined => {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return undefined
  }
  const parsed = Number(value)
  return parsed >= 0 ? parsed : 0
}

const sanitizeManualMargin = (value: number | null | undefined): number | undefined => {
  if (value === null || value === undefined) {
    return undefined
  }
  if (!Number.isFinite(value ?? Number.NaN)) {
    return undefined
  }
  return Number(value)
}

const normalizeSimulacao = (sim?: VendasSimulacao): VendasSimulacao | undefined => {
  if (!sim) {
    return undefined
  }
  const margemManualValor = sanitizeManualMargin(sim.margemManualValor)
  const descontos = clampNonNegative(sim.descontos)
  const result: VendasSimulacao = {}
  if (typeof margemManualValor === 'number') {
    result.margemManualValor = margemManualValor
  }
  if (typeof descontos === 'number') {
    result.descontos = descontos
  }
  return Object.keys(result).length > 0 ? result : undefined
}

const loadPersisted = (): PersistedShape | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return undefined
    }
    const parsed = JSON.parse(raw) as PersistedShape
    if (!parsed || typeof parsed !== 'object' || !parsed.simulations) {
      return undefined
    }
    const normalizedEntries = Object.entries(parsed.simulations)
      .map(([id, sim]) => {
        const normalized = normalizeSimulacao(sim)
        return normalized ? [id, normalized] : null
      })
      .filter((entry): entry is [string, VendasSimulacao] => Array.isArray(entry))
    return { simulations: Object.fromEntries(normalizedEntries) }
  } catch (error) {
    console.warn('[useVendasSimulacoesStore] Falha ao carregar dados', error)
    return undefined
  }
}

const persist = (state: PersistedShape) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('[useVendasSimulacoesStore] Falha ao salvar dados', error)
  }
}

export const useVendasSimulacoesStore = createStore<VendasSimulacoesState>((set, get) => ({
  simulations: {},
  initialize(id, defaults) {
    if (!id) {
      return
    }
    set((state) => {
      if (state.simulations[id]) {
        return state
      }
      const next: VendasSimulacao = {}
      if (
        defaults &&
        typeof defaults.margemManual === 'number' &&
        Number.isFinite(defaults.margemManual)
      ) {
        next.margemManualValor = Number(defaults.margemManual)
      }
      return {
        simulations: {
          ...state.simulations,
          [id]: next,
        },
      }
    })
  },
  update(id, patch) {
    if (!id) {
      return
    }
    set((state) => {
      const existente = state.simulations[id] ?? {}
      const merged = normalizeSimulacao({ ...existente, ...patch }) ?? {}
      return {
        simulations: {
          ...state.simulations,
          [id]: merged,
        },
      }
    })
  },
  remove(id) {
    if (!id) {
      return
    }
    set((state) => {
      if (!state.simulations[id]) {
        return state
      }
      const { [id]: _removed, ...rest } = state.simulations
      return { simulations: rest }
    })
  },
  clear() {
    set({ simulations: {} })
  },
}))

const persisted = loadPersisted()
if (persisted) {
  useVendasSimulacoesStore.setState({ simulations: persisted.simulations })
}

if (typeof window !== 'undefined') {
  useVendasSimulacoesStore.subscribe((state, previous) => {
    if (state.simulations !== previous.simulations) {
      persist({ simulations: state.simulations })
    }
  })
}
