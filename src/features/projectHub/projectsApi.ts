// src/features/projectHub/projectsApi.ts
// REST client for POST /api/projects/from-analise.
//
// Mirrors the auth/timeout pattern used by src/services/projectsApi.ts.

import { resolveApiUrl } from '../../utils/apiUrl'
import type { ProjectRow } from '../../domain/projects/types'

// ─────────────────────────────────────────────────────────────────────────────
// Auth token provider (injected by App.tsx, same pattern as other API modules)
// ─────────────────────────────────────────────────────────────────────────────

type GetAccessToken = () => Promise<string | null>
let tokenProvider: GetAccessToken | null = null
const API_TIMEOUT_MS = 12_000

export function setProjectHubTokenProvider(fn: GetAccessToken): void {
  tokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = tokenProvider ? await tokenProvider() : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...(await authHeaders()),
  }
  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal })
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => ({}))
      const msg =
        (body as { error?: { message?: string } })?.error?.message ??
        (typeof (body as { error?: string }).error === 'string'
          ? (body as { error: string }).error
          : `HTTP ${res.status}`)
      throw new Error(msg)
    }
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload type
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateProjectFromAnalisePayload {
  /** Backend client id — required for DB persistence. */
  client_id: number
  project_type: 'leasing' | 'venda'
  /**
   * Stable identifier for this analise run. Used as the idempotency key so
   * that retried calls with the same analise_id return the existing project
   * instead of creating a duplicate.
   * Recommended: pass crypto.randomUUID() generated once per analise session.
   */
  analise_id?: string
  /** Snapshot fields — stored alongside the project for listing performance. */
  client_name?: string
  cpf_cnpj?: string
  city?: string
  state?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// API function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates (or reuses) a backend project from an Análise Financeira result.
 * Idempotent: repeated calls with the same analise_id return the existing project.
 * Returns the project row (with real UUID) and a `created` flag.
 */
export async function createProjectFromAnalise(
  payload: CreateProjectFromAnalisePayload,
): Promise<{ project: ProjectRow; created: boolean }> {
  const url = resolveApiUrl('/api/projects/from-analise')
  const res = await apiFetch<{ data: ProjectRow; meta: { created: boolean } }>(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return { project: res.data, created: res.meta.created }
}
