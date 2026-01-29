import { createStore } from './createStore'

export type FieldSyncKey = 'uf' | 'cidade' | 'distribuidora' | 'cep' | 'endereco'
export type FieldSyncSource = 'cliente' | 'parametros'

type FieldSyncEntry = {
  locked: boolean
  lastSource: FieldSyncSource | null
}

type FieldSyncMap = Record<FieldSyncKey, FieldSyncEntry>

type FieldSyncState = {
  syncMap: FieldSyncMap
}

const createInitialEntry = (): FieldSyncEntry => ({ locked: false, lastSource: null })

const createInitialSyncMap = (): FieldSyncMap => ({
  uf: createInitialEntry(),
  cidade: createInitialEntry(),
  distribuidora: createInitialEntry(),
  cep: createInitialEntry(),
  endereco: createInitialEntry(),
})

export const useFieldSyncStore = createStore<FieldSyncState>(() => ({
  syncMap: createInitialSyncMap(),
}))

export const fieldSyncActions = {
  reset() {
    useFieldSyncStore.setState({ syncMap: createInitialSyncMap() })
  },
}

type ApplySyncResult = { locked: boolean; lockedNow: boolean }

export const applyFieldSyncChange = (
  field: FieldSyncKey,
  source: FieldSyncSource,
  replicate: () => void,
): ApplySyncResult => {
  const { syncMap } = useFieldSyncStore.getState()
  const current = syncMap[field]

  if (current.locked) {
    return { locked: true, lockedNow: false }
  }

  if (current.lastSource && current.lastSource !== source) {
    useFieldSyncStore.setState((state) => ({
      syncMap: {
        ...state.syncMap,
        [field]: { ...state.syncMap[field], locked: true },
      },
    }))
    return { locked: true, lockedNow: true }
  }

  replicate()

  useFieldSyncStore.setState((state) => ({
    syncMap: {
      ...state.syncMap,
      [field]: { locked: false, lastSource: source },
    },
  }))

  return { locked: false, lockedNow: false }
}

