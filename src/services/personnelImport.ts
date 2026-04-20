// src/services/personnelImport.ts
// REST client for the personnel import helper endpoints.
// These are read-only endpoints that search existing users/clients so the
// admin can pre-fill consultant/engineer/installer forms without merging entities.

import { apiFetch } from '../app/services/httpClient'

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
  const path = q?.trim()
    ? `/api/personnel/importable-users?q=${encodeURIComponent(q.trim())}`
    : '/api/personnel/importable-users'
  const res = await apiFetch<{ users: ImportableUser[] }>(path)
  return res.users ?? []
}

export async function fetchImportableClients(q?: string): Promise<ImportableClient[]> {
  const path = q?.trim()
    ? `/api/personnel/importable-clients?q=${encodeURIComponent(q.trim())}`
    : '/api/personnel/importable-clients'
  const res = await apiFetch<{ clients: ImportableClient[] }>(path)
  return res.clients ?? []
}
