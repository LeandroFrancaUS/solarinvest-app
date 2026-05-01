// src/services/revenueBillingApi.ts
// REST client for /api/revenue-billing endpoints.
// Provides typed access to the deduplicated canonical-client list used by
// the Receita e Cobrança → Projetos tab.

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
// Types
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
 * Fetches the deduplicated canonical client list for the Projetos tab.
 * Exactly one row per canonical active client (deduplicated by CPF/CNPJ).
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
