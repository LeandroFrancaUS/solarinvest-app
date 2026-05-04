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
  InstallmentPayment,
} from '../types/clientPortfolio'

type GetAccessToken = () => Promise<string | null>
let portfolioTokenProvider: GetAccessToken | null = null

export function setPortfolioTokenProvider(fn: GetAccessToken): void {
  portfolioTokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = portfolioTokenProvider ? await portfolioTokenProvider() : null
  return token ? { Authorization: ['Bearer', token].join(' ') } : {}
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
  // Handle 204 No Content responses (e.g., from DELETE endpoints)
  if (res.status === 204) {
    return {} as T
  }
  return res.json() as Promise<T>
}

function normalizePortfolioWifi(row: PortfolioClientRow): PortfolioClientRow {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const wifiStatus = row.wifi_status ?? (metadata as Record<string, unknown>).wifi_status ?? null
  return { ...row, wifi_status: wifiStatus as PortfolioClientRow['wifi_status'] } as PortfolioClientRow
}

function withWifiMetadata(data: Record<string, unknown>): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(data, 'wifi_status')) return data
  const currentMetadata = data.metadata && typeof data.metadata === 'object'
    ? data.metadata as Record<string, unknown>
    : {}
  return {
    ...data,
    metadata: {
      ...currentMetadata,
      wifi_status: data.wifi_status || null,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio list
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPortfolioClients(search?: string): Promise<PortfolioClientRow[]> {
  const resolved = resolveApiUrl('/api/client-portfolio')
  // `new URL()` requires an absolute URL. When VITE_API_URL is not set (e.g.
  // in a preview deployment without that env var), resolveApiUrl returns a
  // relative path like '/api/client-portfolio'. Use window.location.origin as
  // the base so the constructor never throws "Invalid URL".
  const url = new URL(resolved, window.location.origin)
  if (search) url.searchParams.set('search', search)
  const res = await apiFetch<{ data: PortfolioClientRow[] }>(url.toString())
  return (res.data ?? []).map(normalizePortfolioWifi)
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio client detail
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPortfolioClient(clientId: number): Promise<PortfolioClientRow | null> {
  try {
    const res = await apiFetch<{ data: PortfolioClientRow }>(
      resolveApiUrl(`/api/client-portfolio/${clientId}`),
    )
    return res.data ? normalizePortfolioWifi(res.data) : null
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
    { method: 'PUT', body: JSON.stringify(withWifiMetadata(payload)) },
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

export async function patchPortfolioContract(clientId: number, data: Record<string, unknown>): Promise<number> {
  const res = await apiFetch<{ data: { id: number } }>(resolveApiUrl(`/api/client-portfolio/${clientId}/contract`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  return res.data.id
}

export async function patchPortfolioProject(clientId: number, data: Record<string, unknown>): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/client-portfolio/${clientId}/project`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function patchPortfolioBilling(
  clientId: number,
  data: Record<string, unknown>,
): Promise<InstallmentPayment[] | null> {
  const res = await apiFetch<{ data: { installments_json?: InstallmentPayment[] | null } }>(
    resolveApiUrl(`/api/client-portfolio/${clientId}/billing`),
    { method: 'PATCH', body: JSON.stringify(data) },
  )
  return res.data?.installments_json ?? null
}

export async function patchPortfolioUsina(clientId: number, data: Record<string, unknown>): Promise<void> {
  // Usina fields are persisted through the general client update endpoint.
  // WiFi is additionally mirrored into metadata so migration 0061 can sync it
  // into client_usina_config.wifi_status even before the handler accepts the
  // column directly in usinaKeys.
  await apiFetch(resolveApiUrl(`/api/clients/${clientId}`), {
    method: 'PUT',
    body: JSON.stringify(withWifiMetadata(data)),
  })
}

export async function patchPortfolioPlan(clientId: number, data: Record<string, unknown>): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/client-portfolio/${clientId}/plan`), {
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
