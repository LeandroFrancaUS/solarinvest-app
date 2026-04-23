/**
 * Thin wrapper around localStorage that stores a timestamp alongside the payload.
 * Allows form stores to survive tab/browser restarts while still expiring stale drafts.
 *
 * Format stored in localStorage:
 *   { _savedAt: number (epoch ms), _ttlMs: number, data: T }
 */

const WRAPPER_VERSION = 1

interface StorageEnvelope<T> {
  /** Schema version for future migrations. */
  _v: typeof WRAPPER_VERSION
  /** Unix timestamp (ms) when the data was last written. */
  _savedAt: number
  /** Time-to-live in milliseconds. */
  _ttlMs: number
  /** The actual payload. */
  data: T
}

const canUseLocalStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

/**
 * Writes `value` to `localStorage` under `key`, tagging it with the current timestamp and TTL.
 */
export function setWithTtl<T>(key: string, value: T, ttlMs: number): void {
  if (!canUseLocalStorage()) return
  try {
    const envelope: StorageEnvelope<T> = {
      _v: WRAPPER_VERSION,
      _savedAt: Date.now(),
      _ttlMs: ttlMs,
      data: value,
    }
    window.localStorage.setItem(key, JSON.stringify(envelope))
  } catch (error) {
    console.warn(`[localStorageWithTtl] failed to write key="${key}"`, error)
  }
}

/**
 * Reads and returns the value stored under `key`, or `null` when:
 * - The key does not exist
 * - The stored data has expired (age > ttlMs)
 * - The stored data cannot be parsed
 */
export function getWithTtl<T>(key: string): T | null {
  if (!canUseLocalStorage()) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const envelope = JSON.parse(raw) as Partial<StorageEnvelope<T>>
    if (envelope._v !== WRAPPER_VERSION || typeof envelope._savedAt !== 'number' || typeof envelope._ttlMs !== 'number') {
      // Legacy format (e.g. old sessionStorage snapshot without envelope) — discard
      return null
    }
    const ageMs = Date.now() - envelope._savedAt
    if (ageMs > envelope._ttlMs) {
      window.localStorage.removeItem(key)
      return null
    }
    return envelope.data ?? null
  } catch (error) {
    console.warn(`[localStorageWithTtl] failed to read key="${key}"`, error)
    return null
  }
}

/**
 * Removes the key from localStorage.
 */
export function removeWithTtl(key: string): void {
  if (!canUseLocalStorage()) return
  try {
    window.localStorage.removeItem(key)
  } catch (error) {
    console.warn(`[localStorageWithTtl] failed to remove key="${key}"`, error)
  }
}
