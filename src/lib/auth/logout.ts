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
 * 3. Awaits the auth provider sign-out (Stack Auth) with a 3 s timeout so the
 *    SDK clears its own tokens before the redirect.  The timeout is the
 *    Safari-safe guard against Promises that never settle mid-navigation.
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

  // Step 3: Sign out from the auth provider.
  // We await signOut() with a bounded timeout so the SDK can clear its own
  // tokens (localStorage/cookies) before we redirect.  Without this, the new
  // page load finds live Stack Auth tokens and re-authenticates the user
  // silently — making logout appear to do nothing.
  //
  // The race against SIGN_OUT_TIMEOUT_MS is the Safari-safe guard: if the SDK's
  // internal redirect fires mid-call and the Promise never settles (a known
  // Safari issue), we fall through after the timeout and let the hard redirect
  // in step 4 clean up the remaining in-memory state.
  const SIGN_OUT_TIMEOUT_MS = 3000
  if (signOut) {
    try {
      await Promise.race([
        signOut(),
        new Promise<void>((resolve) => { setTimeout(resolve, SIGN_OUT_TIMEOUT_MS) }),
      ])
    } catch (err) {
      if (import.meta.env.DEV) console.debug('[auth][logout] signOut error (non-fatal):', err)
      // Non-fatal: proceed to hard redirect regardless
    }
  }

  // Step 4: Hard redirect — clears all in-memory React and SDK state.
  // This is the Safari-safe path: window.location.assign() triggers a full
  // browser navigation that cannot be intercepted by in-memory state, unlike
  // SPA-only navigate() calls which may leave stale subscriptions running.
  if (import.meta.env.DEV) console.debug('[auth][logout] hard redirect to /')
  window.location.assign('/')
}
