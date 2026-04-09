// src/services/auth/authz.ts
// Fetches GET /api/authz/me — the backend's authoritative authorization snapshot.

import { resolveApiUrl } from '../../utils/apiUrl'
import type { AuthorizationSnapshot } from '../../lib/auth/authorizationSnapshot'

const AUTHZ_ENDPOINT = resolveApiUrl('/api/authz/me')
const REQUEST_TIMEOUT_MS = 5_000

/**
 * Fetches the user's full authorization snapshot from the backend.
 *
 * @param authHeaders  Optional `Authorization: Bearer <token>` header.
 * @param signal       Optional AbortSignal.
 * @returns The snapshot, or null if unauthenticated (401).
 * @throws  On server errors (5xx) or network failure.
 */
export async function fetchAuthorizationSnapshot(
  authHeaders?: Record<string, string>,
  signal?: AbortSignal,
): Promise<AuthorizationSnapshot | null> {
  const timeoutController = new AbortController()
  const timer = setTimeout(() => { timeoutController.abort() }, REQUEST_TIMEOUT_MS)
  if (signal) {
    signal.addEventListener('abort', () => { timeoutController.abort() }, { once: true })
  }

  try {
    const response = await fetch(AUTHZ_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      ...(authHeaders ? { headers: authHeaders } : {}),
      signal: timeoutController.signal,
    })

    if (response.status === 401) return null

    if (!response.ok) {
      throw new Error(`/api/authz/me returned ${response.status}`)
    }

    const body = await response.json() as { ok: boolean; data?: AuthorizationSnapshot }
    return body.data ?? null
  } finally {
    clearTimeout(timer)
  }
}
