// src/lib/auth/authorizationSnapshot.ts
// Types and offline-capable storage for the user's authorization snapshot.
//
// The snapshot is fetched from GET /api/authz/me after login and stored in
// localStorage so it can be read while the app is offline.  It is always
// revalidated as soon as the app comes back online.

export type AppRole =
  | 'role_admin'
  | 'role_financeiro'
  | 'role_office'
  | 'role_comercial'
  | 'unknown'

export interface AuthorizationCapabilities {
  canManageUsers: boolean

  canReadAllClients: boolean
  canWriteAllClients: boolean
  canReadOwnClients: boolean
  canWriteOwnClients: boolean
  canReadCommercialClients: boolean
  canWriteCommercialClients: boolean

  canReadAllProposals: boolean
  canWriteAllProposals: boolean
  canReadOwnProposals: boolean
  canWriteOwnProposals: boolean
  canReadCommercialProposals: boolean
  canWriteCommercialProposals: boolean
}

export interface AuthorizationSnapshot {
  stackUserId: string
  primaryEmail: string | null
  displayName: string | null
  permissions: string[]
  role: AppRole
  capabilities: AuthorizationCapabilities
  fetchedAt: string
}

// ─── Offline cache ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'solarinvest_authz_snapshot_v1'

/**
 * Saves the snapshot to localStorage (best-effort).
 */
export function saveSnapshotOffline(snapshot: AuthorizationSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // localStorage unavailable or quota exceeded — silently skip
  }
}

/**
 * Loads the last saved snapshot from localStorage.
 * Returns null if nothing is cached or the cache is invalid.
 */
export function loadOfflineSnapshot(): AuthorizationSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthorizationSnapshot>
    if (!parsed.stackUserId || !parsed.role) return null
    return parsed as AuthorizationSnapshot
  } catch {
    return null
  }
}

/**
 * Clears the offline snapshot (call on logout or session expiry).
 */
export function clearOfflineSnapshot(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
