// src/lib/auth/logout.ts
// Centralized logout orchestrator — browser-safe, Safari-hardened.
//
// All sign-out triggers in the app (sidebar button, AccessPendingPage, etc.)
// must go through performLogout() to guarantee consistent cleanup of client
// state, the server-side session cookie, and the auth provider session.

import { clearAllClientData } from '../persist/clearOnLogout'

/**
 * Optional callback that signs out from the auth provider (e.g. Stack Auth).
 * Passed as a callback so this module stays free of React hook dependencies.
 */
type SignOutFn = () => Promise<unknown>

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
 * @param signOut Optional Stack Auth signOut callback (user.signOut or app.signOut).
 */
export async function performLogout(signOut?: SignOutFn): Promise<void> {
  if (import.meta.env.DEV) console.debug('[auth][logout] started')

  // Step 1: Clear all client-side persisted data (sync keys first, then async IndexedDB).
  try {
    await clearAllClientData()
    if (import.meta.env.DEV) console.debug('[auth][logout] client data cleared')
  } catch {
    // Non-fatal: proceed even if storage clear partially fails
  }

  // Step 2: Invalidate the server-side session cookie.
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch((err) => {
      // Non-fatal: if the server is unreachable the cookie will expire naturally
      if (import.meta.env.DEV) console.debug('[auth][logout] server logout failed (non-fatal):', err)
    })
  } catch {
    // Non-fatal
  }

  // Step 3: Sign out from the auth provider (fire-and-forget).
  // We do NOT await this because we rely on our own hard redirect (step 4) to
  // navigate away. Awaiting signOut() can cause hangs if the SDK's internal
  // redirect fires mid-call and the Promise never settles — a known issue in
  // Safari when page navigation interrupts async continuations.
  if (signOut) {
    try {
      signOut().catch((err) => {
        if (import.meta.env.DEV) console.debug('[auth][logout] signOut error (non-fatal):', err)
      })
    } catch {
      // Non-fatal
    }
  }

  // Step 4: Hard redirect — clears all in-memory React and SDK state.
  // This is the Safari-safe path: window.location.assign() triggers a full
  // browser navigation that cannot be intercepted by in-memory state, unlike
  // SPA-only navigate() calls which may leave stale subscriptions running.
  if (import.meta.env.DEV) console.debug('[auth][logout] hard redirect to /')
  window.location.assign('/')
}
