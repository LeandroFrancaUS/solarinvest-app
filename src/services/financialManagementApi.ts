// src/services/financialManagementApi.ts
// REST client for /api/financial-management endpoints.
//
// Provides typed access to the Financial Management API, including:
// - Summary KPIs
// - Project financials
// - Cash flow
// - Financial entries (CRUD)
// - Categories

import { resolveApiUrl } from '../utils/apiUrl'

// ─────────────────────────────────────────────────────────────────────────────
// Token provider
// ─────────────────────────────────────────────────────────────────────────────

type GetAccessToken = () => Promise<string | null>
let financialTokenProvider: GetAccessToken | null = null

// Maximum time to wait for a single API response before aborting.
const API_FETCH_TIMEOUT_MS = 12_000

export function setFinancialManagementTokenProvider(fn: GetAccessToken): void {
  financialTokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = financialTokenProvider ? await financialTokenProvider() : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_FETCH_TIMEOUT_MS)

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
        (body as { error?: { message?: string } | string })?.error instanceof Object
          ? (body as { error: { message?: string } }).error.message ?? `HTTP ${res.status}`
          : typeof (body as { error?: string }).error === 'string'
            ? (body as { error: string }).error
            : `HTTP ${res.status}`
      throw new Error(msg)
    }
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeoutId)
  }
}

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const resolved = resolveApiUrl(path)
  const url = new URL(resolved, window.location.origin)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value)
      }
    }
  }
  return url.toString()
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FinancialSummary {
  total_projected_revenue: number
  total_realized_revenue: number
  total_cost: number
  net_profit: number
  avg_roi_percent: number
  avg_payback_months: number
  active_projects_count: number
  mrr_leasing: number
  closed_sales_revenue: number
  avg_default_rate_percent: number
  avg_net_margin_percent: number
}

export interface FinancialProject {
  id: string
  project_kind: 'leasing' | 'sale' | 'buyout'
  client_name: string | null
  consultant_name: string | null
  uf: string | null
  status: string | null
  capex_total: number | null
  projected_revenue: number | null
  realized_revenue: number | null
  projected_profit: number | null
  roi_percent: number | null
  payback_months: number | null
  irr_annual: number | null
  monthly_revenue: number | null
  default_rate_percent: number | null
  commission_amount: number | null
  created_at: string | null
}

export interface CashflowPeriod {
  period_label: string
  total_income: number
  total_expense: number
  net: number
  cumulative: number
}

export interface FinancialEntry {
  id: string
  entry_type: 'income' | 'expense'
  scope_type: 'company' | 'project'
  category: string | null
  subcategory: string | null
  description: string | null
  amount: number
  currency: string
  competence_date: string | null
  payment_date: string | null
  status: 'planned' | 'due' | 'paid' | 'received' | 'cancelled'
  is_recurring: boolean | null
  recurrence_frequency: 'monthly' | 'quarterly' | 'yearly' | 'custom' | null
  project_kind: 'leasing' | 'sale' | 'buyout' | null
  project_id: string | null
  proposal_id: string | null
  client_id: string | null
  consultant_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FinancialEntryInput {
  entry_type: 'income' | 'expense'
  scope_type: 'company' | 'project'
  category: string
  subcategory: string | null
  description: string | null
  amount: number
  competence_date: string | null
  payment_date: string | null
  status: 'planned' | 'due' | 'paid' | 'received' | 'cancelled'
  is_recurring: boolean | null
  recurrence_frequency: 'monthly' | 'quarterly' | 'yearly' | 'custom' | null
  project_kind: 'leasing' | 'sale' | 'buyout' | null
  project_id: string | null
  proposal_id: string | null
  client_id: string | null
  consultant_id: string | null
  notes: string | null
}

export interface FinancialCategory {
  id: string
  name: string
  type: 'income' | 'expense' | 'both'
  scope: 'company' | 'project' | 'both'
  is_active: boolean
  sort_order: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Period params type
// ─────────────────────────────────────────────────────────────────────────────

interface PeriodParams {
  from?: string
  to?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFinancialSummary(params?: PeriodParams): Promise<FinancialSummary> {
  const url = buildUrl('/api/financial-management/summary', params)
  const res = await apiFetch<{ data: FinancialSummary }>(url)
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFinancialProjects(params?: PeriodParams): Promise<FinancialProject[]> {
  const url = buildUrl('/api/financial-management/projects', params)
  const res = await apiFetch<{ data: FinancialProject[] }>(url)
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Cashflow
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFinancialCashflow(params?: PeriodParams): Promise<CashflowPeriod[]> {
  const url = buildUrl('/api/financial-management/cashflow', params)
  const res = await apiFetch<{ data: CashflowPeriod[] }>(url)
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Entries (CRUD)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFinancialEntries(params?: PeriodParams): Promise<FinancialEntry[]> {
  const url = buildUrl('/api/financial-management/entries', params)
  const res = await apiFetch<{ data: FinancialEntry[] }>(url)
  return res.data
}

export async function createFinancialEntry(data: FinancialEntryInput): Promise<FinancialEntry> {
  const url = buildUrl('/api/financial-management/entries')
  const res = await apiFetch<{ data: FinancialEntry }>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function updateFinancialEntry(id: string, data: FinancialEntryInput): Promise<FinancialEntry> {
  const url = buildUrl(`/api/financial-management/entries/${id}`)
  const res = await apiFetch<{ data: FinancialEntry }>(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function deleteFinancialEntry(id: string): Promise<void> {
  const url = buildUrl(`/api/financial-management/entries/${id}`)
  await apiFetch<void>(url, { method: 'DELETE' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFinancialCategories(): Promise<FinancialCategory[]> {
  const url = buildUrl('/api/financial-management/categories')
  const res = await apiFetch<{ data: FinancialCategory[] }>(url)
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard feed
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFinancialDashboardFeed(params?: PeriodParams): Promise<FinancialSummary> {
  const url = buildUrl('/api/financial-management/dashboard-feed', params)
  const res = await apiFetch<{ data: FinancialSummary }>(url)
  return res.data
}
