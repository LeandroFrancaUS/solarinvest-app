// src/auth/useAuthorizationSnapshot.ts
// Hook that fetches the user's authorization snapshot from /api/authz/me,
// persists it for offline use, and revalidates automatically when the app
// comes back online.
// Also polls every ROLE_POLL_INTERVAL_MS to detect role changes made by an
// admin and triggers a full page reload when the permission set changes.

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchAuthorizationSnapshot } from '../services/auth/authz'
import {
  saveSnapshotOffline,
  loadOfflineSnapshot,
  clearOfflineSnapshot,
  type AuthorizationSnapshot,
} from '../lib/auth/authorizationSnapshot'
import { onConnectivityChange } from '../lib/connectivity/connectivityService'

interface UseAuthorizationSnapshotOptions {
  /** Current Stack Auth access token getter — same pattern as useAuthSession. */
  getAccessToken?: (() => Promise<string | null>) | null
  /** Set to true once the user is authenticated and we should fetch. */
  enabled?: boolean
  /** Set to true on logout to clear the cached snapshot. */
  cleared?: boolean
}

interface UseAuthorizationSnapshotResult {
  snapshot: AuthorizationSnapshot | null
  /** True while the initial fetch (or revalidation) is in progress. */
  loading: boolean
  /** True when we are serving a cached offline snapshot. */
  offline: boolean
  /** Trigger an immediate re-fetch (e.g. after an admin changes a role). */
  refresh: () => void
}

/**
 * How often to poll /api/authz/me for role changes (2 minutes).
 * Chosen to balance freshness with server load.
 */
const ROLE_POLL_INTERVAL_MS = 2 * 60 * 1000

/**
 * Returns a stable sorted key for a permissions array so we can detect
 * changes regardless of the order returned by the server.
 */
function permissionsKey(permissions: string[] | undefined | null): string {
  if (!Array.isArray(permissions) || permissions.length === 0) return ''
  return [...permissions].sort().join(',')
}

export function useAuthorizationSnapshot({
  getAccessToken,
  enabled = true,
  cleared = false,
}: UseAuthorizationSnapshotOptions = {}): UseAuthorizationSnapshotResult {
  const [snapshot, setSnapshot] = useState<AuthorizationSnapshot | null>(
    () => loadOfflineSnapshot()
  )
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const getAccessTokenRef = useRef(getAccessToken)
  getAccessTokenRef.current = getAccessToken
  const abortRef = useRef<AbortController | null>(null)
  // Track previously seen permissions so we can detect changes.
  const prevPermissionsKeyRef = useRef<string | null>(null)
  // Whether the initial fetch has completed (we only auto-reload on *changes*,
  // not on the very first load).
  const initialFetchDoneRef = useRef(false)

  const fetch = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      let authHeaders: Record<string, string> | undefined
      if (getAccessTokenRef.current) {
        try {
          const token = await getAccessTokenRef.current()
          if (token) authHeaders = { Authorization: `Bearer ${token}` }
        } catch {
          // proceed without auth header
        }
      }

      const result = await fetchAuthorizationSnapshot(authHeaders, controller.signal)

      if (controller.signal.aborted) return

      if (result) {
        const newKey = permissionsKey(result.permissions)

        // Detect permission changes after the initial load and trigger a full
        // page reload so React state, guards, and menus all re-hydrate cleanly.
        if (
          initialFetchDoneRef.current &&
          prevPermissionsKeyRef.current !== null &&
          newKey !== prevPermissionsKeyRef.current
        ) {
          console.info('[authz] permissions changed — reloading page', {
            prev: prevPermissionsKeyRef.current,
            next: newKey,
          })
          window.location.reload()
          return
        }

        prevPermissionsKeyRef.current = newKey
        initialFetchDoneRef.current = true

        setSnapshot(result)
        setOffline(false)
        saveSnapshotOffline(result)
      } else {
        // 401: session expired — clear cache
        clearOfflineSnapshot()
        setSnapshot(null)
        setOffline(false)
        initialFetchDoneRef.current = false
        prevPermissionsKeyRef.current = null
      }
    } catch {
      if (controller.signal.aborted) return
      // Network/server error — fall back to offline cache
      const cached = loadOfflineSnapshot()
      if (cached) {
        setSnapshot(cached)
        setOffline(true)
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  // Clear on logout
  useEffect(() => {
    if (cleared) {
      clearOfflineSnapshot()
      setSnapshot(null)
      setOffline(false)
      initialFetchDoneRef.current = false
      prevPermissionsKeyRef.current = null
    }
  }, [cleared])

  // Fetch when enabled (i.e. user just logged in)
  useEffect(() => {
    if (!enabled) return
    void fetch()
  }, [enabled, fetch])

  // Revalidate automatically when connectivity is restored
  useEffect(() => {
    const unsub = onConnectivityChange((state) => {
      if (state === 'online_verified' && enabled) {
        void fetch()
      }
    })
    return unsub
  }, [enabled, fetch])

  // Periodic polling: re-check permissions every ROLE_POLL_INTERVAL_MS.
  // The poll only runs while the user is authenticated (enabled === true).
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      void fetch()
    }, ROLE_POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [enabled, fetch])

  return { snapshot, loading, offline, refresh: () => { void fetch() } }
}
