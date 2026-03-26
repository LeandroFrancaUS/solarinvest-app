// src/lib/auth/logout.ts
// Centralized logout orchestrator — browser-safe, Safari-hardened.
//
// All sign-out triggers in the app (sidebar button, AccessPendingPage, etc.)
// must go through performLogout() to guarantee consistent cleanup of client
// state, the server-side session cookie, and the auth provider session.

import { clearAllClientData } from '../persist/clearOnLogout'
import { markLogoutStarted } from './logoutMarker'

/**
 * Optional callback that signs out from the auth provider (e.g. Stack Auth).
 * Passed as a callback so this module stays free of React hook dependencies.
 */
type SignOutFn = () => Promise<unknown>

const STORAGE_CLEAR_TIMEOUT_MS = 1200
const SERVER_LOGOUT_TIMEOUT_MS = 1800
const SIGN_OUT_TIMEOUT_MS = 2200

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      if (import.meta.env.DEV) {
        console.debug(`[auth][logout] ${label} timed out after ${timeoutMs}ms; continuing`)
      }
      resolve(null)
    }, timeoutMs)
  })

  return Promise.race([
    promise
      .then((value) => value)
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.debug(`[auth][logout] ${label} failed (non-fatal):`, err)
        }
        return null
      }),
    timeoutPromise,
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

/**
 * Orchestrates a complete, browser-safe logout:
 *
 * 1. Clears all local client data: IndexedDB, sessionStorage form keys,
 *    localStorage app data keys.
 * 2. Calls POST /api/auth/logout to invalidate the server-side session cookie
 *    (required when AUTH_COOKIE_SECRET is configured).
 * 3. Calls the auth provider sign-out (Stack Auth) as a fire-and-forget so
 *    the SDK can clean up its own token state.
 * 4. Performs a hard redirect to '/' via window.location.assign().
 *
 * The hard redirect in step 4 is the Safari-safe guarantee: it forces a full
 * page reload that clears ALL in-memory React and SDK state, regardless of
 * whether the auth provider's own redirect fired correctly.
 *
 * Additional Safari hardening:
 * - Each pre-redirect step has a short timeout so logout never hangs for many seconds.
 * - Server logout uses `keepalive` + AbortController to avoid blocking on flaky networks.
 *
 * @param signOut Optional Stack Auth signOut callback (user.signOut or app.signOut).
 */
export async function performLogout(signOut?: SignOutFn): Promise<void> {
  if (import.meta.env.DEV) console.debug('[auth][logout] started')

  // Marker used by auth guards to prevent re-login loops while logout settles in Safari.
  markLogoutStarted()

  const clearDataTask = withTimeout(clearAllClientData(), STORAGE_CLEAR_TIMEOUT_MS, 'clearAllClientData')

  const serverLogoutTask = withTimeout(
    (async () => {
      const controller = new AbortController()
      const abortId = setTimeout(() => controller.abort(), SERVER_LOGOUT_TIMEOUT_MS)
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          signal: controller.signal,
        })
      } finally {
        clearTimeout(abortId)
      }
    })(),
    SERVER_LOGOUT_TIMEOUT_MS,
    'POST /api/auth/logout',
  )

  // Wait only for bounded tasks. This keeps logout deterministic on Safari.
  await Promise.allSettled([clearDataTask, serverLogoutTask])

  // Step 3: Ask provider to sign out as well.
  // Bounded wait avoids the Safari hang while still giving the SDK a chance
  // to clear its own auth cookies/tokens before we force a hard redirect.
  if (signOut) {
    await withTimeout(signOut(), SIGN_OUT_TIMEOUT_MS, 'provider signOut')
  }

  // Step 4: Hard redirect — clears all in-memory React and SDK state.
  // This is the Safari-safe path: window.location.assign() triggers a full
  // browser navigation that cannot be intercepted by in-memory state, unlike
  // SPA-only navigate() calls which may leave stale subscriptions running.
  if (import.meta.env.DEV) console.debug('[auth][logout] hard redirect to /')
  window.location.assign('/')
}
