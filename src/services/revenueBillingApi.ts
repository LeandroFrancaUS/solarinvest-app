// src/services/revenueBillingApi.ts
// REST client for /api/revenue-billing endpoints.
// Provides typed access to:
//   - /api/revenue-billing/projects  — deduplicated active-project list (Projetos tab)
//   - /api/revenue-billing/clients   — canonical active-client list (legacy, kept for compat)

import { resolveApiUrl } from '../utils/apiUrl'

// ─────────────────────────────────────────────────────────────────────────────
// Token provider
// ─────────────────────────────────────────────────────────────────────────────

type GetAccessToken = () => Promise<string | null>
let tokenProvider: GetAccessToken | null = null

export function setRevenueBillingTokenProvider(fn: GetAccessToken): void {
  tokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = tokenProvider ? await tokenProvider() : null
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
    const msg =
      (body as { error?: { message?: string } })?.error?.message ??
      `HTTP ${res.status}`
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — Projects
// ─────────────────────────────────────────────────────────────────────────────

export interface RevenueProjectRow {
  project_id: string
  client_id: number
  client_name: string | null
  /** Raw normalised digits (no formatting). Format in the UI with formatCpfCnpj(). */
  document_key: string | null
  document_type: 'cpf' | 'cnpj' | null
  city: string | null
  state: string | null
  project_type: string | null
  project_status: string | null
  contract_id: string | null
  contract_type: string | null
  contract_status: string | null
  contract_start_date: string | null
  updated_at: string | null
}

export interface RevenueProjectsResponse {
  data: RevenueProjectRow[]
  total: number
  limit: number
  offset: number
}

export interface RevenueProjectsFilters {
  search?: string
  contract_type?: string
  order_by?: string
  order_dir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — Clients (legacy)
// ─────────────────────────────────────────────────────────────────────────────

export interface RevenueClientRow {
  client_id: number
  client_name: string | null
  /** Raw normalised digits (no formatting). Format in the UI with formatCpfCnpj(). */
  document_key: string | null
  document_type: 'cpf' | 'cnpj' | null
  city: string | null
  state: string | null
  contract_id: string | null
  contract_type: string | null
  contract_status: string | null
  contract_start_date: string | null
  client_updated_at: string | null
}

export interface RevenueClientsResponse {
  data: RevenueClientRow[]
  total: number
  limit: number
  offset: number
}

export interface RevenueClientsFilters {
  search?: string
  contract_type?: string
  order_by?: string
  order_dir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the active-project list for the Receita e Cobrança → Projetos tab.
 * Returns one row per project whose client is activated (in portfolio or has
 * an active contract). The query is rooted in the projects table, so the list
 * represents projects — not clients.
 */
export async function fetchRevenueProjects(
  filters: RevenueProjectsFilters = {},
): Promise<RevenueProjectsResponse> {
  const base = resolveApiUrl('/api/revenue-billing/projects')
  const url = new URL(base, window.location.origin)

  if (filters.search) url.searchParams.set('search', filters.search)
  if (filters.contract_type) url.searchParams.set('contract_type', filters.contract_type)
  if (filters.order_by) url.searchParams.set('order_by', filters.order_by)
  if (filters.order_dir) url.searchParams.set('order_dir', filters.order_dir)
  if (filters.limit != null) url.searchParams.set('limit', String(filters.limit))
  if (filters.offset != null) url.searchParams.set('offset', String(filters.offset))

  return apiFetch<RevenueProjectsResponse>(url.toString())
}

/**
 * Fetches the deduplicated canonical client list (legacy endpoint).
 * Kept for backward compatibility; the Projetos tab now uses fetchRevenueProjects.
 */
export async function fetchRevenueClients(
  filters: RevenueClientsFilters = {},
): Promise<RevenueClientsResponse> {
  const base = resolveApiUrl('/api/revenue-billing/clients')
  const url = new URL(base, window.location.origin)

  if (filters.search) url.searchParams.set('search', filters.search)
  if (filters.contract_type) url.searchParams.set('contract_type', filters.contract_type)
  if (filters.order_by) url.searchParams.set('order_by', filters.order_by)
  if (filters.order_dir) url.searchParams.set('order_dir', filters.order_dir)
  if (filters.limit != null) url.searchParams.set('limit', String(filters.limit))
  if (filters.offset != null) url.searchParams.set('offset', String(filters.offset))

  return apiFetch<RevenueClientsResponse>(url.toString())
}
