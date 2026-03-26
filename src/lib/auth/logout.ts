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
 * Clears all Stack Auth token cookies that may still be present in the browser.
 *
 * Stack Auth (tokenStore: "cookie") stores tokens under these naming patterns:
 *
 *   • `stack-access`
 *       Access token — always uses the plain "stack-" prefix.
 *
 *   • `stack-refresh-{projectId}--default`   (HTTP / dev)
 *   • `__Host-stack-refresh-{projectId}--default`  (HTTPS / production)
 *       Refresh token — the SDK prepends `__Host-` in secure contexts so it
 *       qualifies as a "Cookie Prefix" cookie (enforces Secure + Path=/).
 *
 *   • Legacy names: `stack-refresh`, `stack-refresh-{projectId}`
 *
 * Our previous implementation only matched `stack-*` cookies, so it silently
 * skipped `__Host-stack-*` cookies.  On every reload, the SDK found the intact
 * refresh token, issued a new access token, and the user appeared still signed
 * in — the root cause of the "logout not working" bug.
 *
 * Deletion nuances:
 *   1. `__Host-` cookies: Must include `Secure` and `Path=/`; must NOT include
 *      `Domain`.
 *   2. Partitioned cookies (Safari CHIPS): The SDK uses `SameSite=None;
 *      Partitioned` in contexts where regular cookies can't be set (certain
 *      Safari embedded or cross-site scenarios).  We try both partitioned and
 *      non-partitioned deletion to cover all cases.
 *   3. Non-HTTPS dev: `stack-*` cookies are set without `Secure`; plain deletion
 *      is sufficient.
 */
function clearStackAuthCookies(): void {
  if (typeof document === 'undefined') return
  try {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
    const cookies = document.cookie.split(';')
    for (const rawCookie of cookies) {
      const eqIdx = rawCookie.indexOf('=')
      const name = (eqIdx >= 0 ? rawCookie.slice(0, eqIdx) : rawCookie).trim()
      if (!name) continue
      // Match both the plain `stack-*` prefix (access token, legacy refresh) and
      // the `__Host-stack-*` prefix (HTTPS refresh token with cookie-prefix).
      if (!name.startsWith('stack-') && !name.startsWith('__Host-stack-')) continue

      // `__Host-` cookies require Secure + Path=/ with no Domain attribute.
      // For plain `stack-*` on HTTPS we also add Secure to match how they were set.
      const secureAttr = (isHttps || name.startsWith('__Host-')) ? '; Secure' : ''

      // 1. Standard deletion (SameSite=Lax — covers most browsers/Chrome).
      document.cookie = `${name}=; Max-Age=0; Path=/${secureAttr}; SameSite=Lax`

      // 2. SameSite=None without Partitioned (covers some HTTPS Safari scenarios).
      if (secureAttr) {
        document.cookie = `${name}=; Max-Age=0; Path=/; Secure; SameSite=None`
        // 3. SameSite=None with Partitioned (Safari CHIPS — Cookies Having
        //    Independent Partitioned State).  The SDK uses this variant when it
        //    detects that regular cookies cannot be set in a given context.
        document.cookie = `${name}=; Max-Age=0; Path=/; Secure; SameSite=None; Partitioned`
      }
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
