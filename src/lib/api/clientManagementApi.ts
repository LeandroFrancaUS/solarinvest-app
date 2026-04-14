// src/lib/api/clientManagementApi.ts
// REST client for /api/client-management/* and /api/dashboard/portfolio/* endpoints.

import { resolveApiUrl } from '../../utils/apiUrl'
import type {
  ManagedClientListResult,
  ClientManagementDetail,
  ClientLifecycle,
  ClientContract,
  ClientProjectStatus,
  ClientBillingProfile,
  ClientBillingInstallment,
  ClientNote,
  ClientReminder,
  PortfolioSummary,
  PortfolioUpcomingBilling,
  PortfolioStatusBreakdownRow,
  PortfolioAlert,
  ClientManagementFilters,
} from '../../types/clientManagement'

const BASE = resolveApiUrl('/api/client-management')
const DASHBOARD_BASE = resolveApiUrl('/api/dashboard/portfolio')

type GetAccessToken = () => Promise<string | null>
let tokenProvider: GetAccessToken | null = null

export function setClientManagementTokenProvider(fn: GetAccessToken): void {
  tokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await tokenProvider?.()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: await authHeaders() })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    const msg = body?.error?.message ?? res.statusText
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

async function patch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    const msg = b?.error?.message ?? res.statusText
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    const msg = b?.error?.message ?? res.statusText
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

// ─── Client list ──────────────────────────────────────────────────────────────

export async function listManagedClients(filters: Partial<ClientManagementFilters> = {}): Promise<ManagedClientListResult> {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.lifecycleStatus) params.set('lifecycle_status', filters.lifecycleStatus)
  if (filters.modalidade) params.set('modalidade', filters.modalidade)
  if (filters.page) params.set('page', String(filters.page))
  const qs = params.toString()
  return get<ManagedClientListResult>(`${BASE}${qs ? '?' + qs : ''}`)
}

// ─── Client detail ────────────────────────────────────────────────────────────

export async function getClientManagementDetail(clientId: number | string): Promise<ClientManagementDetail> {
  const result = await get<{ data: ClientManagementDetail }>(`${BASE}/${clientId}`)
  return result.data
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function patchClientLifecycle(clientId: number | string, data: Partial<ClientLifecycle>): Promise<ClientLifecycle> {
  const result = await patch<{ data: ClientLifecycle }>(`${BASE}/${clientId}/lifecycle`, data)
  return result.data
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export async function listClientContracts(clientId: number | string): Promise<ClientContract[]> {
  const result = await get<{ data: ClientContract[] }>(`${BASE}/${clientId}/contracts`)
  return result.data
}

export async function createClientContract(clientId: number | string, data: Partial<ClientContract>): Promise<ClientContract> {
  const result = await post<{ data: ClientContract }>(`${BASE}/${clientId}/contracts`, data)
  return result.data
}

export async function patchClientContract(clientId: number | string, contractId: number | string, data: Partial<ClientContract>): Promise<ClientContract> {
  const result = await patch<{ data: ClientContract }>(`${BASE}/${clientId}/contracts/${contractId}`, data)
  return result.data
}

// ─── Project status ───────────────────────────────────────────────────────────

export async function patchClientProject(clientId: number | string, data: Partial<ClientProjectStatus>): Promise<ClientProjectStatus> {
  const result = await patch<{ data: ClientProjectStatus }>(`${BASE}/${clientId}/project`, data)
  return result.data
}

// ─── Billing profile ─────────────────────────────────────────────────────────

export async function patchClientBilling(clientId: number | string, data: Partial<ClientBillingProfile>): Promise<ClientBillingProfile> {
  const result = await patch<{ data: ClientBillingProfile }>(`${BASE}/${clientId}/billing`, data)
  return result.data
}

// ─── Installments ─────────────────────────────────────────────────────────────

export async function listClientInstallments(clientId: number | string, status?: string): Promise<ClientBillingInstallment[]> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  const qs = params.toString()
  const result = await get<{ data: ClientBillingInstallment[] }>(`${BASE}/${clientId}/installments${qs ? '?' + qs : ''}`)
  return result.data
}

export async function patchInstallment(clientId: number | string, installmentId: number | string, data: Partial<ClientBillingInstallment>): Promise<ClientBillingInstallment> {
  const result = await patch<{ data: ClientBillingInstallment }>(`${BASE}/${clientId}/installments/${installmentId}`, data)
  return result.data
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function listClientNotes(clientId: number | string): Promise<ClientNote[]> {
  const result = await get<{ data: ClientNote[] }>(`${BASE}/${clientId}/notes`)
  return result.data
}

export async function createClientNote(clientId: number | string, data: { content: string; entry_type?: string; title?: string }): Promise<ClientNote> {
  const result = await post<{ data: ClientNote }>(`${BASE}/${clientId}/notes`, data)
  return result.data
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export async function listClientReminders(clientId: number | string, status?: string): Promise<ClientReminder[]> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  const qs = params.toString()
  const result = await get<{ data: ClientReminder[] }>(`${BASE}/${clientId}/reminders${qs ? '?' + qs : ''}`)
  return result.data
}

export async function createClientReminder(clientId: number | string, data: { title: string; due_at: string; reminder_type?: string; notes?: string }): Promise<ClientReminder> {
  const result = await post<{ data: ClientReminder }>(`${BASE}/${clientId}/reminders`, data)
  return result.data
}

export async function patchClientReminder(clientId: number | string, reminderId: number | string, data: Partial<ClientReminder>): Promise<ClientReminder> {
  const result = await patch<{ data: ClientReminder }>(`${BASE}/${clientId}/reminders/${reminderId}`, data)
  return result.data
}

// ─── Dashboard / Portfolio ────────────────────────────────────────────────────

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const result = await get<{ data: PortfolioSummary }>(`${DASHBOARD_BASE}/summary`)
  return result.data
}

export async function getPortfolioUpcomingBillings(days = 30): Promise<PortfolioUpcomingBilling[]> {
  const result = await get<{ data: PortfolioUpcomingBilling[] }>(`${DASHBOARD_BASE}/upcoming-billings?days=${days}`)
  return result.data
}

export async function getPortfolioStatusBreakdown(): Promise<PortfolioStatusBreakdownRow[]> {
  const result = await get<{ data: PortfolioStatusBreakdownRow[] }>(`${DASHBOARD_BASE}/status-breakdown`)
  return result.data
}

export async function getPortfolioAlerts(): Promise<PortfolioAlert[]> {
  const result = await get<{ data: PortfolioAlert[] }>(`${DASHBOARD_BASE}/alerts`)
  return result.data
}
