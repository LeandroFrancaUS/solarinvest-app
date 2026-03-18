// src/services/auth/me.ts
// Fetches the /api/auth/me endpoint to get authentication + authorization status.

import { resolveApiUrl } from '../../utils/apiUrl'
import type { MeResponse } from '../../lib/auth/access-types'

const ME_ENDPOINT = resolveApiUrl('/api/auth/me')
/** Abort the request if the server doesn't respond within this many ms. */
const REQUEST_TIMEOUT_MS = 5_000

export async function fetchMe(signal?: AbortSignal): Promise<MeResponse> {
  // Combine the caller's abort signal with a hard timeout so a hung connection
  // is never treated as perpetual loading — it will throw and be counted as a
  // failure by the MAX_RETRIES logic in useAuthSession.
  // NOTE: Do NOT use `new DOMException(...)` here — SES (Secure ECMAScript) lockdown
  // run by browser extensions such as Yoroi wallet may remove DOMException from the
  // global scope, which would cause the callback to throw silently and the abort to
  // never fire. Calling abort() without arguments is always safe.
  const timeoutController = new AbortController()
  const timer = setTimeout(() => { timeoutController.abort() }, REQUEST_TIMEOUT_MS)
  if (signal) {
    signal.addEventListener('abort', () => { timeoutController.abort() }, { once: true })
  }

  try {
    const response = await fetch(ME_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      signal: timeoutController.signal,
    })

    if (response.status === 401) {
      return { authenticated: false, authorized: false, role: null, accessStatus: null }
    }

    if (!response.ok) {
      throw new Error(`/api/auth/me returned ${response.status}`)
    }

    return response.json() as Promise<MeResponse>
  } finally {
    clearTimeout(timer)
  }
}
