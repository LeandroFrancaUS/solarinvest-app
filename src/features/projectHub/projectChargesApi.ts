// src/features/projectHub/projectChargesApi.ts
// REST client for project monthly charges endpoints.
//
// Routes consumed:
//   GET  /api/projects/:id/charges          → listProjectCharges
//   POST /api/projects/:id/charges/generate → generateProjectCharges
//   PATCH /api/charges/:id                  → updateProjectCharge
//
// Mirrors the pattern used by src/features/project-finance/api.ts.

import { resolveApiUrl } from '../../utils/apiUrl'
import type {
  ProjectMonthlyCharge,
  GenerateChargesPayload,
  UpdateChargePayload,
} from './projectChargesTypes'

// ─────────────────────────────────────────────────────────────────────────────
// Auth token provider (injected by App.tsx, same pattern as other API modules)
// ─────────────────────────────────────────────────────────────────────────────

type GetAccessToken = () => Promise<string | null>
let tokenProvider: GetAccessToken | null = null
const API_TIMEOUT_MS = 12_000

export function setProjectChargesTokenProvider(fn: GetAccessToken): void {
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
// Response shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateChargesResult {
  inserted: ProjectMonthlyCharge[]
  meta: { generated: number; inserted: number }
}

// ─────────────────────────────────────────────────────────────────────────────
// API functions
// ─────────────────────────────────────────────────────────────────────────────

export async function listProjectCharges(
  projectId: string,
): Promise<ProjectMonthlyCharge[]> {
  const url = resolveApiUrl(`/api/projects/${encodeURIComponent(projectId)}/charges`)
  const res = await apiFetch<{ data: ProjectMonthlyCharge[] }>(url)
  return res.data
}

export async function generateProjectCharges(
  projectId: string,
  payload: GenerateChargesPayload,
): Promise<GenerateChargesResult> {
  const url = resolveApiUrl(
    `/api/projects/${encodeURIComponent(projectId)}/charges/generate`,
  )
  const res = await apiFetch<{
    data: ProjectMonthlyCharge[]
    meta: { generated: number; inserted: number }
  }>(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return { inserted: res.data, meta: res.meta }
}

export async function updateProjectCharge(
  chargeId: string,
  patch: UpdateChargePayload,
): Promise<ProjectMonthlyCharge> {
  const url = resolveApiUrl(`/api/charges/${encodeURIComponent(chargeId)}`)
  const res = await apiFetch<{ data: ProjectMonthlyCharge }>(url, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return res.data
}
