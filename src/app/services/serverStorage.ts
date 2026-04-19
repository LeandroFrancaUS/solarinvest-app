import { resolveApiUrl } from '../../utils/apiUrl'

const STORAGE_ENDPOINT = resolveApiUrl('/api/storage')
const AUTH_COOKIE_NAME = import.meta.env.VITE_AUTH_COOKIE_NAME ?? 'solarinvest_session'

const DEFAULT_INITIALIZATION_TIMEOUT_MS = 2000

type RemoteStorageEntry = {
  key: string
  value: unknown
}

type StorageResponse = {
  entries?: RemoteStorageEntry[]
}

type GetAccessToken = () => Promise<string | null>

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

/**
 * Optional Bearer-token provider for Stack Auth.
 * When set, all requests to /api/storage include an Authorization: Bearer header.
 * This is the primary auth mechanism when AUTH_COOKIE_SECRET is not configured.
 */
let storageTokenProvider: GetAccessToken | null = null

/**
 * Register the Stack Auth token provider for server storage.
 * Must be called once the authenticated user is available (e.g. in App.tsx).
 * If the previous initialization ran without auth (syncEnabled === false), it
 * resets the singleton so the next ensureServerStorageSync() call re-runs with auth.
 */
export function setStorageTokenProvider(fn: GetAccessToken): void {
  storageTokenProvider = fn
  // If the previous init ran unauthenticated, reset so we can retry with auth.
  // However, do NOT reset if we recently received a 503 (storage unavailable) —
  // avoid hammering a consistently failing backend on every auth token refresh.
  if (!syncEnabled) {
    const sinceLastUnavailable = Date.now() - lastStorageUnavailableAt
    if (lastStorageUnavailableAt > 0 && sinceLastUnavailable < STORAGE_UNAVAILABLE_COOLDOWN_MS) {
      if (import.meta.env.DEV) {
        console.debug(
          `[serverStorage] Storage unavailable cooldown active — skipping reset (${Math.round((STORAGE_UNAVAILABLE_COOLDOWN_MS - sinceLastUnavailable) / 1000)}s remaining)`,
        )
      }
      return
    }
    initializationPromise = null
    initializationWaitPromise = null
  }
}

const hasAuth = () => {
  if (storageTokenProvider !== null) {
    return true
  }
  if (typeof document === 'undefined') {
    return false
  }
  return document.cookie.split(';').some((entry) => entry.trim().startsWith(`${AUTH_COOKIE_NAME}=`))
}

const buildHeaders = async (): Promise<Headers> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (storageTokenProvider) {
    try {
      const token = await storageTokenProvider()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    } catch {
      // ignore – fall back to cookie-only auth
    }
  }
  return new Headers(headers)
}

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

/** Consecutive sync failure counter — used to temporarily back off without
 *  permanently disabling sync on a single transient error. */
let consecutiveSyncFailures = 0
/** Maximum consecutive failures before temporarily pausing sync. */
const MAX_SYNC_FAILURES = 5
/** Base delay (ms) for exponential backoff on sync failures. */
const SYNC_BACKOFF_BASE_MS = 2_000
/** Whether sync is temporarily paused due to consecutive failures. */
let syncPaused = false
/** Timeout ID for the backoff timer so it can be cleaned up. */
let syncBackoffTimer: ReturnType<typeof setTimeout> | null = null
/**
 * Timestamp (ms) of the last 503/service-unavailable response from /api/storage.
 * Used to prevent re-initialization during a cooldown window so the same unavailable
 * backend is not hammered on every auth change.
 */
let lastStorageUnavailableAt = 0
/** Cooldown window after a 503 — do not retry during this period. */
const STORAGE_UNAVAILABLE_COOLDOWN_MS = 60_000

function handleSyncFailure(): void {
  consecutiveSyncFailures += 1
  if (consecutiveSyncFailures >= MAX_SYNC_FAILURES) {
    syncPaused = true
    const backoffMs = Math.min(SYNC_BACKOFF_BASE_MS * 2 ** (consecutiveSyncFailures - MAX_SYNC_FAILURES), 60_000)
    console.warn(`[serverStorage] ${consecutiveSyncFailures} consecutive sync failures — pausing for ${backoffMs}ms`)
    if (syncBackoffTimer != null) clearTimeout(syncBackoffTimer)
    syncBackoffTimer = setTimeout(() => {
      syncPaused = false
      syncBackoffTimer = null
      console.info('[serverStorage] Sync resumed after backoff')
    }, backoffMs)
  }
}

function handleSyncSuccess(): void {
  consecutiveSyncFailures = 0
  syncPaused = false
}

/** Maximum safe body size for a single /api/storage PUT request. */
const SAFE_STORAGE_PAYLOAD_BYTES = 250_000

/** Returns the byte size of the serialised JSON. */
const getJsonSizeBytes = (str: string): number => {
  try {
    if (typeof Blob !== 'undefined') {
      return new Blob([str]).size
    }
    return str.length * 2 // worst-case UTF-16 estimate
  } catch {
    return str.length * 2
  }
}

const persistPut = (key: string, value: string) => {
  if (!syncEnabled || syncPaused) {
    return
  }

  const sizeBytes = getJsonSizeBytes(value)
  if (sizeBytes > SAFE_STORAGE_PAYLOAD_BYTES) {
    console.warn(
      `[serverStorage] Skipping remote sync for key "${key}" — payload too large (${Math.round(sizeBytes / 1024)} KB > ${Math.round(SAFE_STORAGE_PAYLOAD_BYTES / 1024)} KB limit). Data is preserved locally.`,
    )
    return
  }

  const controller = new AbortController()
  const previous = pendingUploads.get(key)
  if (previous) {
    previous.abort()
  }
  pendingUploads.set(key, controller)

  void buildHeaders().then((headers) =>
    fetch(STORAGE_ENDPOINT, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ key, value }),
      credentials: 'include',
      signal: controller.signal,
    }),
  )
    .then((response) => {
      if (response.status === 413) {
        // Payload too large — log a clear warning but do NOT count as sync failure
        // since the data is preserved in localStorage.
        console.warn(
          `[serverStorage] Remote rejected key "${key}" — payload too large (413). Data preserved locally.`,
        )
        return
      }
      if (response.status === 503 || response.status === 502 || response.status === 504) {
        // Service unavailable — apply the same cooldown enforced during initialization
        // so we don't hammer a consistently failing backend on every key write.
        recordStorageUnavailable()
        syncEnabled = false
        console.warn(
          `[serverStorage] Storage unavailable (${response.status}) — sync disabled for ${STORAGE_UNAVAILABLE_COOLDOWN_MS / 1000}s cooldown. Data preserved locally.`,
        )
        return
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      handleSyncSuccess()
    })
    .catch((error) => {
      if (error?.name === 'AbortError') {
        return
      }
      console.warn('[serverStorage] Falha ao sincronizar chave com o backend Neon.', error)
      handleSyncFailure()
    })
    .finally(() => {
      if (pendingUploads.get(key) === controller) {
        pendingUploads.delete(key)
      }
    })
}

const persistDelete = (key: string | null) => {
  if (!syncEnabled || syncPaused) {
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

  void buildHeaders().then((headers) =>
    fetch(STORAGE_ENDPOINT, {
      method: 'DELETE',
      headers,
      body: JSON.stringify(key ? { key } : {}),
      credentials: 'include',
      signal: controller.signal,
    }),
  )
    .then((response) => {
      if (response.status === 503 || response.status === 502 || response.status === 504) {
        recordStorageUnavailable()
        syncEnabled = false
        console.warn(
          `[serverStorage] Storage unavailable (${response.status}) during delete — sync disabled for cooldown. Data preserved locally.`,
        )
        return
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      handleSyncSuccess()
    })
    .catch((error) => {
      if (error?.name === 'AbortError') {
        return
      }
      console.warn('[serverStorage] Falha ao excluir chave no backend Neon.', error)
      handleSyncFailure()
    })
    .finally(() => {
      if (key && pendingUploads.get(key) === controller) {
        pendingUploads.delete(key)
      }
    })
}

export const persistRemoteStorageEntry = async (
  key: string,
  value: string,
): Promise<void> => {
  if (!hasAuth()) {
    return
  }

  const headers = await buildHeaders()
  await fetch(STORAGE_ENDPOINT, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ key, value }),
    credentials: 'include',
  })
}

/** Record a storage-unavailable event and timestamp for cooldown enforcement. */
function recordStorageUnavailable(): void {
  lastStorageUnavailableAt = Date.now()
}

const loadRemoteEntries = async (signal?: AbortSignal): Promise<RemoteStorageEntry[]> => {
  const headers = await buildHeaders()
  const response = await fetch(STORAGE_ENDPOINT, { headers, credentials: 'include', signal })
  if (response.status === 401 || response.status === 403) {
    throw new ServerStorageUnauthorizedError(response.status)
  }
  if (response.status === 503 || response.status === 502 || response.status === 504) {
    // Record timestamp so the cooldown in setStorageTokenProvider can take effect.
    recordStorageUnavailable()
    throw new Error(`Falha ao consultar armazenamento (status ${response.status})`)
  }
  if (!response.ok) {
    throw new Error(`Falha ao consultar armazenamento (status ${response.status})`)
  }
  const payload = (await response.json()) as StorageResponse
  return payload.entries ?? []
}

export const fetchRemoteStorageEntry = async (
  key: string,
  options?: { timeoutMs?: number },
): Promise<string | null | undefined> => {
  if (!hasAuth()) {
    return undefined
  }
  const timeoutMs = Math.max(options?.timeoutMs ?? DEFAULT_INITIALIZATION_TIMEOUT_MS, 0)
  const controller = new AbortController()
  let timeoutId: number | undefined

  try {
    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutId = window.setTimeout(() => {
        controller.abort()
        resolve()
      }, timeoutMs)
    })

    const entriesPromise = loadRemoteEntries(controller.signal)
    const entries = await Promise.race([entriesPromise, timeoutPromise]).then(() => entriesPromise)
    const match = entries.find((entry) => entry.key === key)
    return match ? normalizeRemoteValue(match.value) : null
  } catch (error) {
    if (error instanceof ServerStorageUnauthorizedError) {
      console.info('[serverStorage] Consulta remota ignorada: sessão não autenticada.')
      return undefined
    }
    if ((error as DOMException | undefined)?.name === 'AbortError') {
      console.warn('[serverStorage] Consulta remota interrompida por timeout.')
      return undefined
    }
    throw error
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
    }
  }
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
  if (!hasAuth()) {
    syncEnabled = false
    return
  }
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
      // Record the unavailability so setStorageTokenProvider enforces a cooldown
      // and avoids hammering the backend on every token refresh.
      recordStorageUnavailable()
      console.warn('[serverStorage] Não foi possível carregar dados remotos, mantendo armazenamento local. Próxima tentativa após cooldown de 60s.')
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
