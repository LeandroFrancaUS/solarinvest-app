/**
 * Connectivity service.
 * Provides robust online/offline detection beyond navigator.onLine.
 *
 * States:
 *   offline           — confirmed no connectivity
 *   online_unverified — navigator.onLine = true but not yet confirmed
 *   online_verified   — a successful healthcheck confirmed connectivity
 *   syncing           — sync is in progress
 *   sync_error        — sync failed
 */

export type ConnectivityState =
  | 'offline'
  | 'online_unverified'
  | 'online_verified'
  | 'syncing'
  | 'sync_error'

type Listener = (state: ConnectivityState) => void

const HEALTHCHECK_URL = '/api/me'
const HEALTHCHECK_TIMEOUT_MS = 5000
const VERIFY_DEBOUNCE_MS = 1500

let _state: ConnectivityState = navigator.onLine ? 'online_unverified' : 'offline'
let _listeners: Listener[] = []
let _verifyTimer: ReturnType<typeof setTimeout> | null = null

function setState(next: ConnectivityState) {
  if (_state === next) return
  _state = next
  _listeners.forEach((fn) => fn(next))
}

/**
 * Perform an actual HTTP healthcheck to confirm connectivity.
 */
async function verifyConnectivity(): Promise<void> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS)
    const response = await fetch(HEALTHCHECK_URL, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (response.ok || response.status === 401 || response.status === 403) {
      setState('online_verified')
    } else {
      setState('online_unverified')
    }
  } catch {
    if (navigator.onLine) {
      setState('online_unverified')
    } else {
      setState('offline')
    }
  }
}

function scheduleVerify() {
  if (_verifyTimer) clearTimeout(_verifyTimer)
  _verifyTimer = setTimeout(() => {
    void verifyConnectivity()
  }, VERIFY_DEBOUNCE_MS)
}

function handleOnline() {
  setState('online_unverified')
  scheduleVerify()
}

function handleOffline() {
  setState('offline')
}

window.addEventListener('online', handleOnline)
window.addEventListener('offline', handleOffline)

// Initial verification
if (navigator.onLine) {
  scheduleVerify()
}

/**
 * Get the current connectivity state.
 */
export function getConnectivityState(): ConnectivityState {
  return _state
}

/**
 * Returns true if the connection is verified or unverified online.
 */
export function isOnline(): boolean {
  return _state === 'online_verified' || _state === 'online_unverified'
}

/**
 * Subscribe to connectivity state changes.
 */
export function onConnectivityChange(listener: Listener): () => void {
  _listeners.push(listener)
  return () => {
    _listeners = _listeners.filter((l) => l !== listener)
  }
}

/**
 * Set state to syncing (called by sync engine).
 */
export function markSyncing() {
  setState('syncing')
}

/**
 * Set state back to online after sync.
 */
export function markSyncDone() {
  setState('online_verified')
}

/**
 * Set state to sync_error after sync failure.
 */
export function markSyncError() {
  setState('sync_error')
}

/**
 * Force a connectivity re-check.
 */
export function recheckConnectivity(): void {
  scheduleVerify()
}
