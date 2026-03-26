const LOGOUT_MARKER_KEY = 'solarinvest:auth:logout-started-at'
const MARKER_TTL_MS = 60_000

function now(): number {
  return Date.now()
}

export function markLogoutStarted(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(LOGOUT_MARKER_KEY, String(now()))
  } catch {
    // non-fatal
  }
}

export function clearLogoutMarker(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(LOGOUT_MARKER_KEY)
  } catch {
    // non-fatal
  }
}

export function isLogoutMarkerActive(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.sessionStorage.getItem(LOGOUT_MARKER_KEY)
    if (!raw) return false
    const startedAt = Number(raw)
    if (!Number.isFinite(startedAt) || startedAt <= 0) {
      window.sessionStorage.removeItem(LOGOUT_MARKER_KEY)
      return false
    }
    const active = now() - startedAt <= MARKER_TTL_MS
    if (!active) {
      window.sessionStorage.removeItem(LOGOUT_MARKER_KEY)
    }
    return active
  } catch {
    return false
  }
}
