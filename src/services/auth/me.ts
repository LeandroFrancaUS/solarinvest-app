// src/services/auth/me.ts
import type { MeResponse } from "../../lib/auth/access-types"

export async function fetchMe(): Promise<MeResponse | null> {
  try {
    const res = await fetch("/auth/me", {
      credentials: "include",
    })
    if (!res.ok) {
      if (res.status === 401) {
        return { authenticated: false, authorized: false, role: null, accessStatus: null, user: null }
      }
      return null
    }
    return (await res.json()) as MeResponse
  } catch {
    return null
  }
}
