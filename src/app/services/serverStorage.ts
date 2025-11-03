const STORAGE_ENDPOINT = '/api/storage'

type StorageEntry = {
  key: string
  value: string | null
}

type StorageResponse = {
  entries?: StorageEntry[]
}

let initializationPromise: Promise<void> | null = null

const cache = new Map<string, string>()
const pendingUploads = new Map<string, AbortController>()
let syncEnabled = true

const createHeaders = () => new Headers({ 'Content-Type': 'application/json' })

const persistPut = (key: string, value: string) => {
  if (!syncEnabled) {
    return
  }

  const controller = new AbortController()
  const previous = pendingUploads.get(key)
  if (previous) {
    previous.abort()
  }
  pendingUploads.set(key, controller)

  fetch(STORAGE_ENDPOINT, {
    method: 'PUT',
    headers: createHeaders(),
    body: JSON.stringify({ key, value }),
    credentials: 'include',
    signal: controller.signal,
  })
    .catch((error) => {
      if (error?.name === 'AbortError') {
        return
      }
      console.warn('[serverStorage] Falha ao sincronizar chave com o backend Neon.', error)
      syncEnabled = false
    })
    .finally(() => {
      if (pendingUploads.get(key) === controller) {
        pendingUploads.delete(key)
      }
    })
}

const persistDelete = (key: string | null) => {
  if (!syncEnabled) {
    return
  }

  const controller = new AbortController()
  if (key) {
    const previous = pendingUploads.get(key)
    if (previous) {
      previous.abort()
    }
    pendingUploads.set(key, controller)
  }

  fetch(STORAGE_ENDPOINT, {
    method: 'DELETE',
    headers: createHeaders(),
    body: JSON.stringify(key ? { key } : {}),
    credentials: 'include',
    signal: controller.signal,
  })
    .catch((error) => {
      if (error?.name === 'AbortError') {
        return
      }
      console.warn('[serverStorage] Falha ao excluir chave no backend Neon.', error)
      syncEnabled = false
    })
    .finally(() => {
      if (key && pendingUploads.get(key) === controller) {
        pendingUploads.delete(key)
      }
    })
}

const loadRemoteEntries = async (): Promise<StorageEntry[]> => {
  const response = await fetch(STORAGE_ENDPOINT, { credentials: 'include' })
  if (!response.ok) {
    throw new Error(`Falha ao consultar armazenamento (status ${response.status})`)
  }
  const payload = (await response.json()) as StorageResponse
  return payload.entries ?? []
}

const initializeSync = async () => {
  const storage = window.localStorage
  const originalGetItem = storage.getItem.bind(storage)
  const originalSetItem = storage.setItem.bind(storage)
  const originalRemoveItem = storage.removeItem.bind(storage)
  const originalKey = storage.key ? storage.key.bind(storage) : undefined
  const originalClear = storage.clear ? storage.clear.bind(storage) : undefined

  const existingLocal = new Map<string, string>()
  for (let index = 0; index < storage.length; index += 1) {
    const key = originalKey ? originalKey(index) : storage.key(index)
    if (!key) {
      continue
    }
    const value = originalGetItem(key)
    if (value !== null) {
      existingLocal.set(key, value)
    }
  }

  let remoteEntries: StorageEntry[] = []
  try {
    remoteEntries = await loadRemoteEntries()
  } catch (error) {
    console.warn('[serverStorage] Não foi possível carregar dados remotos, mantendo armazenamento local.', error)
    syncEnabled = false
    return
  }

  syncEnabled = true

  const remoteMap = new Map<string, string>()
  remoteEntries.forEach(({ key, value }) => {
    if (value !== null && value !== undefined) {
      remoteMap.set(key, value)
    }
  })

  const missingOnRemote: StorageEntry[] = []
  existingLocal.forEach((value, key) => {
    if (!remoteMap.has(key)) {
      remoteMap.set(key, value)
      missingOnRemote.push({ key, value })
    }
  })

  // Reset local storage to ensure consistência com o backend
  if (originalClear) {
    originalClear()
  } else {
    Array.from(existingLocal.keys()).forEach((key) => originalRemoveItem(key))
  }

  cache.clear()

  remoteMap.forEach((value, key) => {
    originalSetItem(key, value)
    cache.set(key, value)
  })

  missingOnRemote.forEach(({ key, value }) => {
    persistPut(key, value)
  })

  storage.getItem = (key: string) => {
    if (cache.has(key)) {
      return cache.get(key) ?? null
    }
    const fallback = originalGetItem(key)
    if (fallback !== null) {
      cache.set(key, fallback)
    }
    return fallback
  }

  storage.setItem = (key: string, value: string) => {
    originalSetItem(key, value)
    cache.set(key, value)
    persistPut(key, value)
  }

  storage.removeItem = (key: string) => {
    originalRemoveItem(key)
    cache.delete(key)
    persistDelete(key)
  }

  storage.clear = () => {
    if (originalClear) {
      originalClear()
    } else {
      Array.from(cache.keys()).forEach((key) => originalRemoveItem(key))
    }
    cache.clear()
    persistDelete(null)
  }
}

export function ensureServerStorageSync(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }
  if (!initializationPromise) {
    initializationPromise = initializeSync().catch((error) => {
      console.error('[serverStorage] Erro ao inicializar sincronização com o backend Neon.', error)
    })
  }
  return initializationPromise
}
