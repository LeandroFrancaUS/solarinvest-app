// src/auth/auth-session.ts
// Central hook that merges Stack Auth identity with internal authorization state.
import { useCallback, useEffect, useRef, useState } from "react"
import type { AuthState, AccessState, MeResponse } from "../lib/auth/access-types"
import { fetchMe } from "../services/auth/me"

export interface AuthSession {
  authState: AuthState
  accessState: AccessState
  me: MeResponse | null
  /** Re-fetch /auth/me (e.g. after logout or admin action). */
  refresh: () => Promise<void>
}

/**
 * Whether Stack Auth env vars are configured so the auth flow is active.
 * When false, the app runs in bypass/dev mode (no authentication required).
 */
export function isAuthConfigured(): boolean {
  const projectId =
    import.meta.env.VITE_STACK_PROJECT_ID ??
    import.meta.env.NEXT_PUBLIC_STACK_PROJECT_ID ??
    ""
  const key =
    import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY ??
    import.meta.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY ??
    ""
  return Boolean(projectId && key)
}

/**
 * Fetches the user's authorization status from the backend and returns a
 * stable session object. Safe to call in multiple components — it only issues
 * one request per mount / refresh call.
 */
export function useAuthSession(): AuthSession {
  const [authState, setAuthState] = useState<AuthState>("loading")
  const [accessState, setAccessState] = useState<AccessState>("loading")
  const [me, setMe] = useState<MeResponse | null>(null)
  const fetchingRef = useRef(false)

  const doFetch = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      // If auth isn't configured, treat as fully authorized (bypass/dev mode)
      if (!isAuthConfigured()) {
        setAuthState("authenticated")
        setAccessState("approved")
        setMe({
          authenticated: true,
          authorized: true,
          role: "admin",
          accessStatus: "approved",
          user: {
            id: "bypass",
            email: "dev@solarinvest.info",
            fullName: "Dev Mode",
            providerUserId: "bypass",
            stackEmail: "dev@solarinvest.info",
          },
        })
        return
      }

      const data = await fetchMe()

      if (!data) {
        // Network error or server down — treat as anonymous to avoid locking out
        setAuthState("anonymous")
        setAccessState("loading")
        setMe(null)
        return
      }

      setMe(data)

      if (!data.authenticated) {
        setAuthState("anonymous")
        setAccessState("loading")
        return
      }

      setAuthState("authenticated")

      switch (data.accessStatus) {
        case "approved":
          setAccessState(data.authorized ? "approved" : "pending")
          break
        case "blocked":
          setAccessState("blocked")
          break
        case "revoked":
          setAccessState("revoked")
          break
        default:
          setAccessState("pending")
      }
    } finally {
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    void doFetch()
  }, [doFetch])

  const refresh = useCallback(async () => {
    fetchingRef.current = false
    setAuthState("loading")
    setAccessState("loading")
    await doFetch()
  }, [doFetch])

  return { authState, accessState, me, refresh }
}
