// src/services/clientPortfolioApi.ts
// REST client for /api/client-portfolio and related portfolio endpoints.
//
// PORTFOLIO REHYDRATION RULE (Etapa 2.4):
// All portfolio data MUST be fetched through these functions.
// Portfolio detail panels must NEVER fall back to /api/clients/:id or use
// latest_proposal_profile for hydration.

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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('404') && !msg.toLowerCase().includes('not found')) {
      console.error('[portfolio] fetchPortfolioClient error', err)
    }
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
// Remove client from portfolio (does NOT delete client from system)
// ─────────────────────────────────────────────────────────────────────────────
export async function removeClientFromPortfolio(clientId: number): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/clients/${clientId}/portfolio-remove`), { method: 'PATCH' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Update client data from portfolio (reuses PUT /api/clients/:id)
// ─────────────────────────────────────────────────────────────────────────────
export async function updateClientFromPortfolio(
  clientId: number,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await apiFetch<{ data: Record<string, unknown> }>(
    resolveApiUrl(`/api/clients/${clientId}`),
    { method: 'PUT', body: JSON.stringify(payload) },
  )
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete client (soft delete via DELETE /api/clients/:id)
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteClientFromPortfolio(clientId: number): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/clients/${clientId}`), { method: 'DELETE' })
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

export async function patchPortfolioUsina(clientId: number, data: Record<string, unknown>): Promise<void> {
  // Usina fields are persisted through the general client update endpoint
  // which upserts into client_usina_config. We route through the same PUT
  // /api/clients/:id that the backend already uses for usina persistence.
  await apiFetch(resolveApiUrl(`/api/clients/${clientId}`), {
    method: 'PUT',
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
