// src/features/project-finance/financialAnalysisApi.ts
// Frontend API client for the project financial-analysis snapshot endpoints.
//
//   GET  /api/projects/:id/financial-analysis
//   PUT  /api/projects/:id/financial-analysis
//
// inputs_json  → AfInputState snapshot (restores the AF UI store state)
// outputs_json → AnaliseFinanceiraOutput snapshot (computed by the AF engine on the frontend)

import { resolveApiUrl } from '../../utils/apiUrl'
import type { AfInputState } from '../simulacoes/useAfInputStore'
import type { AnaliseFinanceiraOutput } from '../../types/analiseFinanceira'

// ─────────────────────────────────────────────────────────────────────────────
// Auth token provider (mirrors pattern in src/features/project-finance/api.ts)
// ─────────────────────────────────────────────────────────────────────────────

type GetAccessToken = () => Promise<string | null>
let tokenProvider: GetAccessToken | null = null
const API_TIMEOUT_MS = 12_000

export function setProjectAfTokenProvider(fn: GetAccessToken): void {
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
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectAfSnapshotResponse {
  project_id: string
  /** Contract type derived from the project row ('leasing' | 'venda'). */
  contract_type: 'leasing' | 'venda'
  /** Stored AF input-store state. Null when no snapshot has been saved yet. */
  inputs_json: Partial<AfInputState> | null
  /** Stored AF output (computed by the engine on the frontend). Null when unsaved. */
  outputs_json: AnaliseFinanceiraOutput | null
  /** ISO timestamp of the last save, or null when never saved. */
  saved_at: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// API functions
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchProjectAfSnapshot(
  projectId: string,
): Promise<ProjectAfSnapshotResponse> {
  const url = resolveApiUrl(`/api/projects/${encodeURIComponent(projectId)}/financial-analysis`)
  const res = await apiFetch<{ data: ProjectAfSnapshotResponse }>(url)
  return res.data
}

export async function saveProjectAfSnapshot(
  projectId: string,
  payload: {
    inputs_json: Partial<AfInputState>
    outputs_json: AnaliseFinanceiraOutput | null
  },
): Promise<ProjectAfSnapshotResponse> {
  const url = resolveApiUrl(`/api/projects/${encodeURIComponent(projectId)}/financial-analysis`)
  const res = await apiFetch<{ data: ProjectAfSnapshotResponse }>(url, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res.data
}
