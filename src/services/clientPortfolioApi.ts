// src/services/clientPortfolioApi.ts
// REST client for /api/client-portfolio and related portfolio endpoints.

import { resolveApiUrl } from '../utils/apiUrl'
import type {
  PortfolioClientRow,
  ClientNote,
  PortfolioSummary,
} from '../types/clientPortfolio'

type GetAccessToken = () => Promise<string | null>
let portfolioTokenProvider: GetAccessToken | null = null

export function setPortfolioTokenProvider(fn: GetAccessToken): void {
  portfolioTokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = portfolioTokenProvider ? await portfolioTokenProvider() : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...(await authHeaders()),
  }
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}))
    const msg = (body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio list
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPortfolioClients(search?: string): Promise<PortfolioClientRow[]> {
  const url = new URL(resolveApiUrl('/api/client-portfolio'))
  if (search) url.searchParams.set('search', search)
  const res = await apiFetch<{ data: PortfolioClientRow[] }>(url.toString())
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio client detail
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPortfolioClient(clientId: number): Promise<PortfolioClientRow | null> {
  try {
    const res = await apiFetch<{ data: PortfolioClientRow }>(
      resolveApiUrl(`/api/client-portfolio/${clientId}`),
    )
    return res.data
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export client to portfolio
// ─────────────────────────────────────────────────────────────────────────────
export async function exportClientToPortfolio(clientId: number): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/clients/${clientId}/portfolio-export`), { method: 'PATCH' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Patch sub-resources
// ─────────────────────────────────────────────────────────────────────────────
export async function patchPortfolioProfile(clientId: number, data: Record<string, unknown>): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/client-portfolio/${clientId}/profile`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function patchPortfolioContract(clientId: number, data: Record<string, unknown>): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/client-portfolio/${clientId}/contract`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function patchPortfolioProject(clientId: number, data: Record<string, unknown>): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/client-portfolio/${clientId}/project`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function patchPortfolioBilling(clientId: number, data: Record<string, unknown>): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/client-portfolio/${clientId}/billing`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPortfolioNotes(clientId: number): Promise<ClientNote[]> {
  const res = await apiFetch<{ data: ClientNote[] }>(
    resolveApiUrl(`/api/client-portfolio/${clientId}/notes`),
  )
  return res.data
}

export async function addPortfolioNote(
  clientId: number,
  note: { entry_type?: string; title?: string; content: string },
): Promise<ClientNote> {
  const res = await apiFetch<{ data: ClientNote }>(
    resolveApiUrl(`/api/client-portfolio/${clientId}/notes`),
    { method: 'POST', body: JSON.stringify(note) },
  )
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard summary
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDashboardPortfolioSummary(): Promise<PortfolioSummary> {
  const res = await apiFetch<{ data: PortfolioSummary }>(
    resolveApiUrl('/api/dashboard/portfolio/summary'),
  )
  return res.data
}
