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
  expected_amount: number | null
  realized_amount: number | null
  currency: string
  competence_date: string | null
  payment_date: string | null
  due_date: string | null
  receipt_date: string | null
  status: 'planned' | 'due' | 'paid' | 'received' | 'partial' | 'cancelled'
  is_recurring: boolean | null
  recurrence_frequency: 'monthly' | 'quarterly' | 'yearly' | 'custom' | null
  project_kind: 'leasing' | 'sale' | 'buyout' | null
  project_id: string | null
  proposal_id: string | null
  client_id: number | null
  consultant_id: number | null
  project_financial_item_id: string | null
  installment_number: number | null
  installment_total: number | null
  origin_source: string | null
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
  expected_amount: number | null
  realized_amount: number | null
  competence_date: string | null
  payment_date: string | null
  due_date: string | null
  receipt_date: string | null
  status: 'planned' | 'due' | 'paid' | 'received' | 'partial' | 'cancelled'
  is_recurring: boolean | null
  recurrence_frequency: 'monthly' | 'quarterly' | 'yearly' | 'custom' | null
  project_kind: 'leasing' | 'sale' | 'buyout' | null
  project_id: string | null
  proposal_id: string | null
  client_id: number | string | null
  consultant_id: number | string | null
  project_financial_item_id: string | null
  installment_number: number | null
  installment_total: number | null
  origin_source: string | null
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

// ─────────────────────────────────────────────────────────────────────────────
// Item Templates (catálogo reutilizável)
// ─────────────────────────────────────────────────────────────────────────────

export interface FinancialItemTemplate {
  id: string
  name: string
  normalized_name: string
  nature: 'income' | 'expense'
  scope: 'project' | 'company' | 'both'
  project_kind: 'leasing' | 'sale' | 'buyout' | 'both'
  value_mode: 'fixed' | 'variable' | 'formula' | 'manual'
  default_amount: number | null
  default_unit: string | null
  formula_code: string | null
  formula_config_json: unknown
  category: string | null
  is_system: boolean
  is_active: boolean
  can_user_edit: boolean
  sort_order: number
}

export interface FinancialItemTemplateInput {
  name: string
  nature: 'income' | 'expense'
  scope?: 'project' | 'company' | 'both'
  project_kind?: 'leasing' | 'sale' | 'buyout' | 'both'
  value_mode?: 'fixed' | 'variable' | 'formula' | 'manual'
  default_amount?: number | null
  default_unit?: string | null
  category?: string | null
  sort_order?: number
}

export async function fetchFinancialItemTemplates(filters?: {
  nature?: 'income' | 'expense'
  project_kind?: 'leasing' | 'sale' | 'buyout' | 'both'
  scope?: 'project' | 'company' | 'both'
}): Promise<FinancialItemTemplate[]> {
  const url = buildUrl('/api/financial-management/templates', filters as Record<string, string | undefined>)
  const res = await apiFetch<{ data: FinancialItemTemplate[] }>(url)
  return res.data
}

export async function createFinancialItemTemplate(
  data: FinancialItemTemplateInput,
): Promise<FinancialItemTemplate> {
  const url = buildUrl('/api/financial-management/templates')
  const res = await apiFetch<{ data: FinancialItemTemplate }>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Financial Items (composição prevista)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectFinancialItem {
  id: string
  proposal_id: string | null
  client_id: number | null
  project_kind: 'leasing' | 'sale' | 'buyout'
  template_id: string | null
  item_name: string
  item_code: string | null
  nature: 'income' | 'expense'
  category: string
  subcategory: string | null
  value_mode: 'fixed' | 'variable' | 'formula' | 'manual'
  expected_amount: number | null
  expected_quantity: number | null
  expected_total: number | null
  pricing_source: string | null
  is_required: boolean
  is_system_generated: boolean
  sort_order: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProjectFinancialItemInput {
  proposal_id?: string | null
  client_id?: number | string | null
  project_kind: 'leasing' | 'sale' | 'buyout'
  template_id?: string | null
  item_name: string
  item_code?: string | null
  nature: 'income' | 'expense'
  category: string
  subcategory?: string | null
  value_mode?: 'fixed' | 'variable' | 'formula' | 'manual'
  expected_amount?: number | null
  expected_quantity?: number | null
  expected_total?: number | null
  pricing_source?: string | null
  is_required?: boolean
  sort_order?: number
  notes?: string | null
}

export async function fetchProjectFinancialItems(filters?: {
  proposal_id?: string
  client_id?: string | number
  project_kind?: 'leasing' | 'sale' | 'buyout'
}): Promise<ProjectFinancialItem[]> {
  const params: Record<string, string | undefined> = {}
  if (filters?.proposal_id) params.proposal_id = filters.proposal_id
  if (filters?.client_id != null) params.client_id = String(filters.client_id)
  if (filters?.project_kind) params.project_kind = filters.project_kind
  const url = buildUrl('/api/financial-management/project-items', params)
  const res = await apiFetch<{ data: ProjectFinancialItem[] }>(url)
  return res.data
}

export async function createProjectFinancialItem(
  data: ProjectFinancialItemInput,
): Promise<ProjectFinancialItem> {
  const url = buildUrl('/api/financial-management/project-items')
  const res = await apiFetch<{ data: ProjectFinancialItem }>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function updateProjectFinancialItem(
  id: string,
  data: Partial<ProjectFinancialItemInput>,
): Promise<ProjectFinancialItem> {
  const url = buildUrl(`/api/financial-management/project-items/${id}`)
  const res = await apiFetch<{ data: ProjectFinancialItem }>(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function deleteProjectFinancialItem(id: string): Promise<void> {
  const url = buildUrl(`/api/financial-management/project-items/${id}`)
  await apiFetch<void>(url, { method: 'DELETE' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap project structure from a proposal
// ─────────────────────────────────────────────────────────────────────────────

export interface BootstrapResult {
  project_kind: 'leasing' | 'sale' | 'buyout'
  created_count: number
  items: ProjectFinancialItem[]
}

export async function bootstrapProjectFinancialStructure(proposalId: string): Promise<BootstrapResult> {
  const url = buildUrl(`/api/financial-management/projects/${proposalId}/bootstrap-structure`)
  const res = await apiFetch<{ data: BootstrapResult }>(url, { method: 'POST' })
  return res.data
}
