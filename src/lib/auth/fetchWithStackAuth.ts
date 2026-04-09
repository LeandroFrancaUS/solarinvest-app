/**
 * fetchWithStackAuth
 *
 * Drop-in replacement for `fetch()` that automatically attaches the current
 * Stack Auth access token to every request via the `x-stack-access-token`
 * header (and mirrors it as `Authorization: Bearer` for backward compatibility).
 *
 * Usage:
 *   import { fetchWithStackAuth } from '@/lib/auth/fetchWithStackAuth'
 *   const res = await fetchWithStackAuth('/api/clients')
 *
 * If the user is not authenticated the request is still sent (without auth
 * headers) so that public endpoints and offline-fallback paths continue to
 * work. Protected backend routes will return 401 in that case.
 */

type GetAccessToken = () => Promise<string | null>

let _tokenProvider: GetAccessToken | null = null

/**
 * Register the Stack Auth access-token getter.
 * Call this once, early in the app lifecycle (e.g., inside the useEffect
 * that runs when the Stack Auth `user` object becomes available).
 *
 * Example (App.tsx):
 *   setFetchAuthTokenProvider(() => user.getAccessToken())
 */
export function setFetchAuthTokenProvider(fn: GetAccessToken | null): void {
  _tokenProvider = fn
}

/**
 * Returns the current access token, or null if no provider is registered
 * or if the session is not yet ready.
 */
export async function getAccessTokenForFetch(): Promise<string | null> {
  if (!_tokenProvider) return null
  try {
    return await _tokenProvider()
  } catch {
    return null
  }
}

/**
 * Authenticated fetch wrapper.
 *
 * Injects Stack Auth credentials into the request headers when a token
 * provider is registered and the session is active. Passes all other
 * arguments through to the native `fetch` API unchanged.
 */
export async function fetchWithStackAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessTokenForFetch()

  if (!token) {
    // No token available — send the request unauthenticated.
    return fetch(input, init)
  }

  const headers = new Headers(init.headers)
  // Stack Auth SDK native header
  headers.set('x-stack-access-token', token)
  // Standard HTTP Authorization header (backward compat with existing backend check)
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, { ...init, headers })
}
