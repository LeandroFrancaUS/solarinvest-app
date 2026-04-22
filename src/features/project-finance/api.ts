// src/features/project-finance/api.ts
// API client for /api/projects/:id/finance endpoints.
// Mirrors the pattern used in src/services/projectsApi.ts.

import { resolveApiUrl } from '../../utils/apiUrl'
import type { ProjectFinanceFormState, ProjectFinanceGetResponse, ProjectFinanceProfile } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Auth token provider (injected by App.tsx via setProjectsTokenProvider)
// ─────────────────────────────────────────────────────────────────────────────

type GetAccessToken = () => Promise<string | null>
let tokenProvider: GetAccessToken | null = null
const API_TIMEOUT_MS = 12_000

export function setProjectFinanceTokenProvider(fn: GetAccessToken): void {
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
// API functions
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchProjectFinance(projectId: string): Promise<ProjectFinanceGetResponse> {
  const url = resolveApiUrl(`/api/projects/${encodeURIComponent(projectId)}/finance`)
  const res = await apiFetch<{ data: ProjectFinanceGetResponse }>(url)
  return res.data
}

export async function saveProjectFinance(
  projectId: string,
  form: ProjectFinanceFormState,
): Promise<ProjectFinanceProfile> {
  const url = resolveApiUrl(`/api/projects/${encodeURIComponent(projectId)}/finance`)
  const res = await apiFetch<{ ok: boolean; data: ProjectFinanceProfile }>(url, {
    method: 'PUT',
    body: JSON.stringify(form),
  })
  return res.data
}
