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

export function useAuthSession(): UseAuthSessionResult {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [loading, setLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const data = await fetchMe(controller.signal)
      if (controller.signal.aborted) return
      setMe(data)
      setAuthState(data.authenticated ? 'authenticated' : 'anonymous')
    } catch {
      if (controller.signal.aborted) return
      setMe(null)
      setAuthState('anonymous')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => { void load() }, POLL_INTERVAL_MS)
    return () => {
      clearInterval(timer)
      abortRef.current?.abort()
    }
  }, [load])

  const accessState = deriveAccessState(me, loading)
  const refresh = useCallback(() => { void load() }, [load])

  return { authState, accessState, me, refresh }
}
