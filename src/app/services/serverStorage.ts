import { resolveApiUrl } from '../../utils/apiUrl'

const STORAGE_ENDPOINT = resolveApiUrl('/api/storage')

const DEFAULT_INITIALIZATION_TIMEOUT_MS = 2000

type RemoteStorageEntry = {
  key: string
  value: unknown
}

type StorageResponse = {
  entries?: RemoteStorageEntry[]
}

class ServerStorageUnauthorizedError extends Error {
  status: number

  constructor(status: number) {
    super(`Falha ao consultar armazenamento (status ${status})`)
    this.name = 'ServerStorageUnauthorizedError'
    this.status = status
  }
}

let initializationPromise: Promise<void> | null = null

const cache = new Map<string, string>()
const pendingUploads = new Map<string, AbortController>()
let syncEnabled = true
let initializationWaitPromise: Promise<void> | null = null

const createHeaders = () => new Headers({ 'Content-Type': 'application/json' })

const normalizeRemoteValue = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value)
  } catch (error) {
    console.warn('[serverStorage] Não foi possível serializar valor remoto para string.', error)
    return null
  }
}

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

const loadRemoteEntries = async (signal?: AbortSignal): Promise<RemoteStorageEntry[]> => {
  const response = await fetch(STORAGE_ENDPOINT, { credentials: 'include', signal })
  if (response.status === 401 || response.status === 403) {
    throw new ServerStorageUnauthorizedError(response.status)
  }
  if (!response.ok) {
    throw new Error(`Falha ao consultar armazenamento (status ${response.status})`)
  }
  const payload = (await response.json()) as StorageResponse
  return payload.entries ?? []
}

const initializeSync = async (signal?: AbortSignal) => {
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

  let remoteEntries: RemoteStorageEntry[] = []
  try {
    remoteEntries = await loadRemoteEntries(signal)
  } catch (error) {
    if ((error as DOMException | undefined)?.name === 'AbortError') {
      console.warn('[serverStorage] Sincronização com backend interrompida por timeout. Mantendo armazenamento local.')
    } else if (error instanceof ServerStorageUnauthorizedError) {
      console.info(
        '[serverStorage] Sincronização remota desabilitada para sessões não autenticadas. Mantendo armazenamento local.',
      )
    } else {
      console.warn('[serverStorage] Não foi possível carregar dados remotos, mantendo armazenamento local.', error)
    }
    syncEnabled = false
    return
  }

  syncEnabled = true

  const remoteMap = new Map<string, string>()
  remoteEntries.forEach(({ key, value }) => {
    const normalized = normalizeRemoteValue(value)
    if (normalized !== null) {
      remoteMap.set(key, normalized)
    }
  })

  const missingOnRemote: { key: string; value: string }[] = []
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

export function ensureServerStorageSync(options?: { timeoutMs?: number }): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }
  const timeoutMs = Math.max(options?.timeoutMs ?? DEFAULT_INITIALIZATION_TIMEOUT_MS, 0)
  if (!initializationPromise) {
    const controller = new AbortController()
    initializationPromise = initializeSync(controller.signal).catch((error) => {
      console.error('[serverStorage] Erro ao inicializar sincronização com o backend Neon.', error)
    })

    initializationWaitPromise = (() => {
      let timeoutId: number | undefined
      const timeoutPromise = new Promise<void>((resolve) => {
        timeoutId = window.setTimeout(() => {
          controller.abort()
          resolve()
        }, timeoutMs)
      })

      return Promise.race([initializationPromise, timeoutPromise]).finally(() => {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId)
        }
      })
    })()
  }
  return initializationWaitPromise ?? Promise.resolve()
}
