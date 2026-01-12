import { createStore } from './createStore'
import {
  DEFAULT_VENDAS_CONFIG,
  normalizeVendasConfig,
  type VendasConfig,
} from '../types/vendasConfig'
import { storageClient } from '../app/services/serverStorage'

const STORAGE_KEY = 'solarinvest:vendas:v1'

export type VendasConfigState = {
  config: VendasConfig
  update: (patch: Partial<VendasConfig>) => void
  replace: (value: VendasConfig) => void
  reset: () => void
}

type PersistedShape = {
  config: Partial<VendasConfig>
}

const loadPersistedConfig = (): VendasConfig | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }
  try {
    const raw = storageClient.getItem(STORAGE_KEY)
    if (!raw) {
      return undefined
    }
    const parsed = JSON.parse(raw) as PersistedShape | Partial<VendasConfig>
    if (parsed && typeof parsed === 'object' && 'config' in parsed) {
      return normalizeVendasConfig((parsed as PersistedShape).config)
    }
    return normalizeVendasConfig(parsed as Partial<VendasConfig>)
  } catch (error) {
    console.warn('[useVendasConfigStore] Falha ao carregar configuração', error)
    return undefined
  }
}

const persistConfig = (config: VendasConfig) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    storageClient.setItem(STORAGE_KEY, JSON.stringify({ config }))
  } catch (error) {
    console.warn('[useVendasConfigStore] Falha ao salvar configuração', error)
  }
}

export const useVendasConfigStore = createStore<VendasConfigState>((set, get) => ({
  config: DEFAULT_VENDAS_CONFIG,
  update(patch) {
    const next = normalizeVendasConfig({ ...get().config, ...patch })
    set({ config: next })
  },
  replace(value) {
    const next = normalizeVendasConfig(value)
    set({ config: next })
  },
  reset() {
    set({ config: DEFAULT_VENDAS_CONFIG })
  },
}))

const persisted = loadPersistedConfig()
if (persisted) {
  useVendasConfigStore.setState({ config: persisted })
}

if (typeof window !== 'undefined') {
  useVendasConfigStore.subscribe((state, previous) => {
    if (state.config !== previous.config) {
      persistConfig(state.config)
    }
  })
}

export const vendasConfigSelectors = {
  config: (state: VendasConfigState) => state.config,
}
