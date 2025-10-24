import type { PartialState, StateCreator } from './zustand-shim'

type MaybePromise<T> = T | Promise<T>

export type StateStorage = {
  getItem: (name: string) => MaybePromise<string | null>
  setItem: (name: string, value: string) => MaybePromise<void>
  removeItem: (name: string) => MaybePromise<void>
}

export type PersistOptions<T> = {
  name: string
  storage?: StateStorage
  partialize?: (state: T) => unknown
  version?: number
  merge?: (persistedState: Partial<T>, currentState: T) => T
  skipHydration?: boolean
}

type PersistedState = {
  state?: unknown
  version?: number
}

export const persist = <T>(
  config: StateCreator<T>,
  options: PersistOptions<T>,
): StateCreator<T> => {
  const { name, storage, partialize, version = 0, merge, skipHydration } = options

  return (set, get, api) => {
    const targetStorage = storage
    let hasHydrated = false

    const persistState = () => {
      if (!targetStorage || !hasHydrated) {
        return
      }
      try {
        const rawState = get()
        const data = partialize ? partialize(rawState) : rawState
        const payload = JSON.stringify({ state: data, version })
        void targetStorage.setItem(name, payload)
      } catch (error) {
        console.error('[zustand-persist] Failed to save state', error)
      }
    }

    const wrappedSet = (partial: PartialState<T>, replace?: boolean) => {
      set(partial, replace)
      persistState()
    }

    const initialState = config(wrappedSet, get, api)

    if (!skipHydration && targetStorage) {
      try {
        const stored = targetStorage.getItem(name)
        const raw = stored instanceof Promise ? stored : Promise.resolve(stored)
        void raw
          .then((value) => {
            if (!value) {
              return
            }
            const parsed: PersistedState = JSON.parse(value)
            if (parsed && typeof parsed === 'object' && 'state' in parsed) {
              const incoming = parsed.state as Partial<T>
              const nextState = merge ? merge(incoming, initialState) : ({ ...initialState, ...incoming } as T)
              set(() => nextState, true)
            }
          })
          .catch((error) => {
            console.error('[zustand-persist] Failed to rehydrate state', error)
          })
          .finally(() => {
            hasHydrated = true
            persistState()
          })
      } catch (error) {
        console.error('[zustand-persist] Failed during hydration', error)
        hasHydrated = true
      }
    } else {
      hasHydrated = true
      persistState()
    }

    return initialState
  }
}

export type CreateJSONStorageOptions = {
  delayMs?: number
}

export const createJSONStorage = (
  getStorage: () => Storage | undefined,
  options: CreateJSONStorageOptions = { delayMs: 300 },
): StateStorage | undefined => {
  const storage = getStorage()
  if (!storage) {
    return undefined
  }

  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const delay = options.delayMs ?? 0

  const schedule = (name: string, action: () => void) => {
    if (delay <= 0) {
      action()
      return
    }
    const existing = timers.get(name)
    if (existing) {
      clearTimeout(existing)
    }
    const handle = setTimeout(() => {
      try {
        action()
      } finally {
        timers.delete(name)
      }
    }, delay)
    timers.set(name, handle)
  }

  return {
    getItem(name) {
      return storage.getItem(name)
    },
    setItem(name, value) {
      schedule(name, () => {
        storage.setItem(name, value)
      })
    },
    removeItem(name) {
      const existing = timers.get(name)
      if (existing) {
        clearTimeout(existing)
        timers.delete(name)
      }
      storage.removeItem(name)
    },
  }
}

export type { StateCreator }
