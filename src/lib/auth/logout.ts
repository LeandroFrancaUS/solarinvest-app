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
 * Clears any Stack Auth token cookies that may still be present in the browser.
 *
 * Stack Auth stores its access/refresh tokens in cookies prefixed with "stack-"
 * when tokenStore: "cookie" is configured. This helper is a safety net for cases
 * where user.signOut() cannot complete its own cleanup (e.g., CORS errors when
 * calling api.stack-auth.com, or when a navigation interrupt stops the SDK
 * mid-operation). By clearing these cookies explicitly we ensure the user is
 * fully signed out on the next page load even if the SDK did not finish.
 */
function clearStackAuthCookies(): void {
  if (typeof document === 'undefined') return
  try {
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const eqIdx = cookie.indexOf('=')
      const name = (eqIdx >= 0 ? cookie.slice(0, eqIdx) : cookie).trim()
      if (!name.startsWith('stack-')) continue
      // Clear on the root path (covers all sub-paths).
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
    }
  } catch {
    // Non-fatal: cookie clearing is a best-effort safety net.
  }
}

/**
 * Orchestrates a complete, browser-safe logout:
 *
 * 1. Clears all local client data: IndexedDB, sessionStorage form keys,
 *    localStorage app data keys.
 * 2. Calls POST /api/auth/logout to invalidate the server-side session cookie
 *    (required when AUTH_COOKIE_SECRET is configured).
 * 3. Awaits the auth provider sign-out (Stack Auth) with a 1500 ms timeout so
 *    the SDK has time to clear its own token cookies before navigation. The
 *    timeout guards against indefinite hangs when the SDK's internal redirect
 *    (redirectMethod: "window") fires mid-call and the Promise never settles —
 *    a known issue in Safari.
 * 4. Clears any remaining Stack Auth cookies as a belt-and-suspenders fallback,
 *    in case the SDK could not finish its own cleanup (e.g., CORS errors on
 *    api.stack-auth.com).
 * 5. Performs a hard redirect to '/' via window.location.assign().
 *
 * The hard redirect in step 5 is the Safari-safe guarantee: it forces a full
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

  // Step 3: Sign out from the auth provider, awaited with a timeout.
  //
  // Why await (instead of fire-and-forget): the Stack Auth SDK stores tokens in
  // browser cookies. If we navigate away immediately the SDK never gets to run
  // its async cookie-clearing logic, leaving the user re-authenticated on reload.
  // Awaiting gives the SDK time to clear its local state.
  //
  // Why the 1500 ms timeout: when redirectMethod: "window" is set, the SDK may
  // fire window.location.assign() internally, which prevents the Promise from
  // ever settling. The timeout ensures we always move on — if the SDK already
  // navigated the page away, our subsequent window.location.assign('/') below is
  // a no-op anyway.
  if (signOut) {
    try {
      await Promise.race([
        signOut().catch((err) => {
          if (import.meta.env.DEV) console.debug('[auth][logout] signOut error (non-fatal):', err)
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 1500)),
      ])
    } catch {
      // Non-fatal
    }
  }

  // Step 4: Belt-and-suspenders cookie clear.
  // If the SDK could not finish its own cleanup (e.g., CORS error blocked the
  // api.stack-auth.com session-deletion call), wipe any remaining Stack Auth
  // token cookies directly so they do not survive the hard redirect below.
  clearStackAuthCookies()

  // Step 5: Hard redirect — clears all in-memory React and SDK state.
  // This is the Safari-safe path: window.location.assign() triggers a full
  // browser navigation that cannot be intercepted by in-memory state, unlike
  // SPA-only navigate() calls which may leave stale subscriptions running.
  if (import.meta.env.DEV) console.debug('[auth][logout] hard redirect to /')
  window.location.assign('/')
}
