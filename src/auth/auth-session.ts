// src/auth/auth-session.ts
// Hook to get current auth + authorization state from the backend.
// Authentication is via Stack Auth; authorization is via internal DB.

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchMe } from '../services/auth/me'
import type { MeResponse, AuthState, AccessState } from '../lib/auth/access-types'
import { deriveAccessState } from '../lib/auth/access-mappers'

interface UseAuthSessionResult {
  authState: AuthState
  accessState: AccessState
  me: MeResponse | null
  refresh: () => void
}

const POLL_INTERVAL_MS = 15 * 60 * 1000 // re-check every 15 minutes
/** Retry delay after a transient server/network error (before the next poll fires). */
const ERROR_RETRY_MS = 8 * 1000
/** After this many consecutive failures we stop retrying and show an error screen. */
const MAX_RETRIES = 3

export function useAuthSession(): UseAuthSessionResult {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [loading, setLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failCountRef = useRef(0)

  const load = useCallback(async () => {
    if (retryRef.current) {
      clearTimeout(retryRef.current)
      retryRef.current = null
    }
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const data = await fetchMe(controller.signal)
      if (controller.signal.aborted) return
      failCountRef.current = 0
      setMe(data)
      setAuthState(data.authenticated ? 'authenticated' : 'anonymous')
    } catch (err) {
      if (controller.signal.aborted) return
      // Network error or unexpected server error (5xx):
      // Do NOT set authState to 'anonymous' — that would bypass the authorization
      // check and allow unauthenticated users to reach the app.
      // Retry up to MAX_RETRIES times; after that expose an 'error' state so the
      // user sees an actionable error screen instead of an infinite spinner.
      failCountRef.current += 1
      console.warn('[auth] fetchMe failed (attempt', failCountRef.current, ') —', err instanceof Error ? err.message : err)
      if (failCountRef.current < MAX_RETRIES) {
        retryRef.current = setTimeout(() => { void load() }, ERROR_RETRY_MS)
      } else {
        setAuthState('error')
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => { void load() }, POLL_INTERVAL_MS)
    return () => {
      clearInterval(timer)
      if (retryRef.current) clearTimeout(retryRef.current)
      abortRef.current?.abort()
    }
  }, [load])

  const accessState = deriveAccessState(me, loading)
  const refresh = useCallback(() => {
    failCountRef.current = 0
    void load()
  }, [load])

  return { authState, accessState, me, refresh }
}
