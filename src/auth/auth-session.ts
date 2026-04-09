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
 * When Stack Auth is configured (getAccessToken is provided) but the access token
 * is not yet available (session initializing, token being refreshed, or session
 * expired), we defer the /me call by this many ms instead of sending a request
 * without an Authorization header.  Sending /me without auth would return a
 * noisy 401 in the DevTools network tab even for authenticated users.
 */
const TOKEN_UNAVAILABLE_RETRY_MS = 1_000
/** How many times we retry a deferred /me call before giving up with 'error'. */
const MAX_TOKEN_RETRIES = 3

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
  /**
   * Separate counter for "token unavailable" deferrals so they don't consume
   * the same MAX_RETRIES budget as network/server errors.
   */
  const tokenRetryRef = useRef(0)

  // Keep the latest getAccessToken in a ref so the stable `load` callback always
  // calls the most recent version without appearing in its own dependency array.
  const getAccessTokenRef = useRef<GetAccessToken | null | undefined>(getAccessToken)
  getAccessTokenRef.current = getAccessToken

  // Track the previous getter value so we can detect the null→function transition.
  const prevGetterRef = useRef<GetAccessToken | null | undefined>(getAccessToken)

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
          tokenRetryRef.current = 0  // reset deferral counter on success
          authHeaders = { Authorization: `Bearer ${token}` }
          if (import.meta.env.DEV) console.debug('[auth] /me — access token ready, sending request')
        } else {
          // Stack Auth is configured but the access token is not yet available.
          // This happens when:
          //   1. The session is still initializing on first load.
          //   2. The access token is being refreshed (e.g., page load > 75 s after last issue).
          //   3. The session is genuinely expired (RequireAuth will re-show sign-in shortly).
          // In all three cases we MUST NOT call /me without auth — that would produce a
          // noisy HTTP 401 in DevTools even for fully authenticated users.
          tokenRetryRef.current += 1
          if (import.meta.env.DEV) {
            console.debug(
              '[auth] /me deferred — access token unavailable (attempt',
              tokenRetryRef.current, '/',
              MAX_TOKEN_RETRIES, ')',
            )
          }
          if (tokenRetryRef.current <= MAX_TOKEN_RETRIES) {
            retryRef.current = setTimeout(() => { void load() }, TOKEN_UNAVAILABLE_RETRY_MS)
          } else {
            // After MAX_TOKEN_RETRIES attempts the session appears permanently broken.
            // Surface an error state so the user sees an actionable screen.
            console.warn('[auth] access token still unavailable after', MAX_TOKEN_RETRIES, 'attempts — showing error')
            setAuthState('error')
          }
          setLoading(false)
          return
        }
      } else {
        if (import.meta.env.DEV) console.debug('[auth] /me — no token getter (bypass mode), calling without auth')
      }

      if (controller.signal.aborted) return

      const data = await fetchMe(controller.signal, authHeaders)
      if (controller.signal.aborted) return
      failCountRef.current = 0
      setMe(data)
      const nextState = data.authenticated ? 'authenticated' : 'anonymous'
      // Safe production log: confirms auth completion + source (no PII / secrets)
      console.info('[auth] /me authenticated=%s source=%s', data.authenticated ? 'yes' : 'no', data.authSource ?? 'none')
      if (import.meta.env.DEV) {
        // Consolidated DEV diagnostic — auth source, role, state transition
        console.debug(
          '[auth] /me diagnostic: authenticated=%s authSource=%s authorized=%s role=%s → authState=%s',
          data.authenticated ? 'yes' : 'no',
          data.authSource ?? 'unknown',
          data.authorized ? 'yes' : 'no',
          data.role ?? 'none',
          nextState,
        )
      }
      setAuthState(nextState)
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
      tokenRetryRef.current = 0
    }
  }, [load])

  // Re-trigger /me when getAccessToken transitions from null/undefined to a function.
  // This handles the case where the hook is first rendered with no getter (user not yet
  // resolved), sends an unauthenticated /me → 401, and then the user resolves and a
  // valid getter becomes available.  Without this effect the next /me call would only
  // happen at the 15-minute poll interval.
  useEffect(() => {
    const prev = prevGetterRef.current
    prevGetterRef.current = getAccessToken
    if (getAccessToken && !prev) {
      // Getter just became available — reset counters and reload immediately.
      failCountRef.current = 0
      tokenRetryRef.current = 0
      void load()
    }
  }, [getAccessToken, load])

  const accessState = deriveAccessState(me, loading)
  const refresh = useCallback(() => {
    failCountRef.current = 0
    tokenRetryRef.current = 0
    void load()
  }, [load])

  return { authState, accessState, me, refresh }
}
