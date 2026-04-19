/**
 * Page State Persistence Service
 *
 * Provides a centralized, versioned, namespaced persistence layer for
 * page-level state (active page, active tab, open entity IDs, filter state,
 * scroll positions, etc.).
 *
 * Key design decisions:
 *   - Uses localStorage for lightweight, synchronous reads (critical for
 *     restoring state BEFORE first paint).
 *   - Each entry is wrapped in a versioned envelope with a timestamp and TTL
 *     so stale data auto-expires and schema migrations are safe.
 *   - All keys are namespaced under `solarinvest:pageState:` to avoid
 *     collisions with other storage consumers.
 */

const NAMESPACE = 'solarinvest:pageState:'
const SCHEMA_VERSION = 1

/** Default TTL: 24 hours — drafts older than this are auto-cleaned. */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

interface PageStateEnvelope<T = unknown> {
  /** Schema version — allows safe migrations. */
  v: number
  /** ISO timestamp of the last write. */
  ts: string
  /** Actual payload. */
  data: T
}

function makeKey(routeKey: string): string {
  return `${NAMESPACE}${routeKey}`
}

/**
 * Save page-level state for a given route/module.
 */
export function savePageState<T>(routeKey: string, payload: T): void {
  try {
    const envelope: PageStateEnvelope<T> = {
      v: SCHEMA_VERSION,
      ts: new Date().toISOString(),
      data: payload,
    }
    window.localStorage.setItem(makeKey(routeKey), JSON.stringify(envelope))
  } catch (e) {
    console.warn('[pageState] Failed to save:', routeKey, e)
  }
}

/**
 * Load page-level state for a given route/module.
 * Returns `null` if no state is found, schema version doesn't match, or TTL has expired.
 */
export function loadPageState<T>(routeKey: string, ttlMs: number = DEFAULT_TTL_MS): T | null {
  try {
    const raw = window.localStorage.getItem(makeKey(routeKey))
    if (!raw) return null

    const envelope: PageStateEnvelope<T> = JSON.parse(raw) as PageStateEnvelope<T>

    // Reject incompatible schema versions
    if (envelope.v !== SCHEMA_VERSION) return null

    // Reject expired entries
    const age = Date.now() - new Date(envelope.ts).getTime()
    if (age > ttlMs) {
      window.localStorage.removeItem(makeKey(routeKey))
      return null
    }

    return envelope.data
  } catch {
    return null
  }
}

/**
 * Clear persisted page state for a specific route/module.
 */
export function clearPageState(routeKey: string): void {
  try {
    window.localStorage.removeItem(makeKey(routeKey))
  } catch {
    // non-fatal
  }
}

/**
 * Clear all persisted page states (e.g. on logout).
 */
export function clearAllPageStates(): void {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(NAMESPACE)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k))
  } catch {
    // non-fatal
  }
}

// ─── Convenience: App-level navigation state ─────────────────────────────────

const NAV_KEY = 'nav'

export interface NavigationState {
  activePage: string
  activeTab: string
  simulacoesSection?: string
  /** ID of the client/proposal/entity currently open. */
  openEntityId?: string | null
  /** Any additional context (e.g. CRM sub-tab, filter state). */
  extra?: Record<string, unknown>
}

/**
 * Save the current navigation state (active page, tab, entity, etc.).
 * Should be called on every navigation action and periodically.
 */
export function saveNavigationState(state: NavigationState): void {
  savePageState(NAV_KEY, state)
}

/**
 * Load the last saved navigation state.
 */
export function loadNavigationState(): NavigationState | null {
  return loadPageState<NavigationState>(NAV_KEY)
}

/**
 * Clear the navigation state (e.g. on explicit logout).
 */
export function clearNavigationState(): void {
  clearPageState(NAV_KEY)
}
