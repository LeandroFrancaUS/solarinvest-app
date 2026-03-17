// src/services/auth/me.ts
// Fetches the /api/auth/me endpoint to get authentication + authorization status.

import { resolveApiUrl } from '../../utils/apiUrl'
import type { MeResponse } from '../../lib/auth/access-types'

const ME_ENDPOINT = resolveApiUrl('/api/auth/me')

export async function fetchMe(signal?: AbortSignal): Promise<MeResponse> {
  const init: RequestInit = {
    method: 'GET',
    credentials: 'include',
  }
  if (signal) init.signal = signal

  const response = await fetch(ME_ENDPOINT, init)

  if (response.status === 401) {
    return { authenticated: false, authorized: false, role: null, accessStatus: null }
  }

  if (!response.ok) {
    throw new Error(`/api/auth/me returned ${response.status}`)
  }

  return response.json() as Promise<MeResponse>
}
