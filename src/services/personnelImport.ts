// src/services/personnelImport.ts
// REST client for the personnel import helper endpoints.
// These are read-only endpoints that search existing users/clients so the
// admin can pre-fill consultant/engineer/installer forms without merging entities.

import { resolveApiUrl } from '../utils/apiUrl'

type GetAccessToken = () => Promise<string | null>
let importTokenProvider: GetAccessToken | null = null

export function setPersonnelImportTokenProvider(fn: GetAccessToken): void {
  importTokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = importTokenProvider ? await importTokenProvider() : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { ...(await authHeaders()) },
  })
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}))
    const msg = (body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportableUser {
  id: string
  full_name: string
  email: string
  phone: string
}

export interface ImportableClient {
  id: number
  name: string
  email: string
  phone: string
  document: string
  state: string
  city: string
}

// ─────────────────────────────────────────────────────────────────────────────
// API calls
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchImportableUsers(q?: string): Promise<ImportableUser[]> {
  const url = new URL(resolveApiUrl('/api/personnel/importable-users'), window.location.origin)
  if (q?.trim()) url.searchParams.set('q', q.trim())
  const res = await apiFetch<{ users: ImportableUser[] }>(url.toString())
  return res.users ?? []
}

export async function fetchImportableClients(q?: string): Promise<ImportableClient[]> {
  const url = new URL(resolveApiUrl('/api/personnel/importable-clients'), window.location.origin)
  if (q?.trim()) url.searchParams.set('q', q.trim())
  const res = await apiFetch<{ clients: ImportableClient[] }>(url.toString())
  return res.clients ?? []
}
