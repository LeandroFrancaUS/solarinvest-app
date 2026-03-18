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
const ERROR_RETRY_MS = 3 * 1000
/** After this many consecutive failures we stop retrying and show an error screen. */
const MAX_RETRIES = 2

/**
 * Optional function that returns the current Stack Auth access token (a JWT).
 * When provided, the token is sent as `Authorization: Bearer <token>` so the
 * server can verify the caller's identity via its JWKS endpoint.
 *
 * Keeping this as a callback (rather than accepting the token value directly)
 * lets the hook always use the most up-to-date token on every fetch, including
 * after background token refreshes performed by the Stack Auth SDK.
 */
type GetAccessToken = () => Promise<string | null>

export function useAuthSession(getAccessToken?: GetAccessToken | null): UseAuthSessionResult {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [loading, setLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failCountRef = useRef(0)

  // Keep the latest getAccessToken in a ref so the stable `load` callback always
  // calls the most recent version without appearing in its own dependency array.
  const getAccessTokenRef = useRef<GetAccessToken | null | undefined>(getAccessToken)
  getAccessTokenRef.current = getAccessToken

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
      // Build auth headers: if a token getter was supplied, resolve the current
      // access token and forward it as a Bearer header so the server can verify
      // the caller's identity using the Stack Auth JWKS endpoint.
      // Any error from the token getter propagates to the outer catch so the
      // retry / error-state logic applies (avoids a silent fallback to 401).
      let authHeaders: Record<string, string> | undefined
      const getter = getAccessTokenRef.current
      if (getter) {
        const token = await getter()
        if (token) {
          authHeaders = { Authorization: `Bearer ${token}` }
        }
      }

      if (controller.signal.aborted) return

      const data = await fetchMe(controller.signal, authHeaders)
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
