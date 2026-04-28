// src/features/operacao/operationsApi.ts
// REST client for /api/operations/* endpoints.
//
// Routes consumed:
//   GET   /api/operations/tickets              → listTickets
//   POST  /api/operations/tickets              → createTicket
//   PATCH /api/operations/tickets/:id          → updateTicket
//
//   GET   /api/operations/maintenance          → listMaintenanceJobs
//   POST  /api/operations/maintenance          → createMaintenanceJob
//   PATCH /api/operations/maintenance/:id      → updateMaintenanceJob
//
//   GET   /api/operations/cleanings            → listCleaningJobs
//   POST  /api/operations/cleanings            → createCleaningJob
//   PATCH /api/operations/cleanings/:id        → updateCleaningJob
//
//   GET   /api/operations/insurance            → listInsurancePolicies
//   POST  /api/operations/insurance            → createInsurancePolicy
//   PATCH /api/operations/insurance/:id        → updateInsurancePolicy
//
//   GET   /api/operations/events               → listOperationEvents
//   POST  /api/operations/events               → createOperationEvent
//   PATCH /api/operations/events/:id           → updateOperationEvent
//
// Follows the same auth/timeout/error pattern as projectChargesApi.ts.

import { resolveApiUrl } from '../../utils/apiUrl'
import type {
  ServiceTicket,
  MaintenanceJob,
  CleaningJob,
  InsurancePolicy,
  OperationEvent,
  CreateTicketPayload,
  CreateMaintenanceJobPayload,
  CreateCleaningJobPayload,
  CreateInsurancePolicyPayload,
  CreateOperationEventPayload,
} from './operationTypes'

// ─────────────────────────────────────────────────────────────────────────────
// Auth token provider (injected by App.tsx)
// ─────────────────────────────────────────────────────────────────────────────

type GetAccessToken = () => Promise<string | null>
let tokenProvider: GetAccessToken | null = null
const API_TIMEOUT_MS = 12_000

export function setOperationsTokenProvider(fn: GetAccessToken): void {
  tokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = tokenProvider ? await tokenProvider() : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal fetch helper
// ─────────────────────────────────────────────────────────────────────────────

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
// Filter helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildQuery(filters: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tickets
// ─────────────────────────────────────────────────────────────────────────────

export interface TicketFilters {
  client_id?: number | null
  project_id?: string | null
  status?: string | null
}

export async function listTickets(filters: TicketFilters = {}): Promise<ServiceTicket[]> {
  const url = resolveApiUrl(`/api/operations/tickets${buildQuery(filters)}`)
  const res = await apiFetch<{ data: ServiceTicket[] }>(url)
  return res.data
}

export async function createTicket(payload: CreateTicketPayload): Promise<ServiceTicket> {
  const url = resolveApiUrl('/api/operations/tickets')
  const res = await apiFetch<{ data: ServiceTicket }>(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function updateTicket(
  id: string,
  patch: Partial<Omit<ServiceTicket, 'id' | 'client_id' | 'created_at' | 'updated_at'>>,
): Promise<ServiceTicket> {
  const url = resolveApiUrl(`/api/operations/tickets/${encodeURIComponent(id)}`)
  const res = await apiFetch<{ data: ServiceTicket }>(url, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance Jobs
// ─────────────────────────────────────────────────────────────────────────────

export interface MaintenanceFilters {
  client_id?: number | null
  project_id?: string | null
  status?: string | null
}

export async function listMaintenanceJobs(filters: MaintenanceFilters = {}): Promise<MaintenanceJob[]> {
  const url = resolveApiUrl(`/api/operations/maintenance${buildQuery(filters)}`)
  const res = await apiFetch<{ data: MaintenanceJob[] }>(url)
  return res.data
}

export async function createMaintenanceJob(payload: CreateMaintenanceJobPayload): Promise<MaintenanceJob> {
  const url = resolveApiUrl('/api/operations/maintenance')
  const res = await apiFetch<{ data: MaintenanceJob }>(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function updateMaintenanceJob(
  id: string,
  patch: Partial<Omit<MaintenanceJob, 'id' | 'client_id' | 'created_at' | 'updated_at'>>,
): Promise<MaintenanceJob> {
  const url = resolveApiUrl(`/api/operations/maintenance/${encodeURIComponent(id)}`)
  const res = await apiFetch<{ data: MaintenanceJob }>(url, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleaning Jobs
// ─────────────────────────────────────────────────────────────────────────────

export interface CleaningFilters {
  client_id?: number | null
  project_id?: string | null
  status?: string | null
}

export async function listCleaningJobs(filters: CleaningFilters = {}): Promise<CleaningJob[]> {
  const url = resolveApiUrl(`/api/operations/cleanings${buildQuery(filters)}`)
  const res = await apiFetch<{ data: CleaningJob[] }>(url)
  return res.data
}

export async function createCleaningJob(payload: CreateCleaningJobPayload): Promise<CleaningJob> {
  const url = resolveApiUrl('/api/operations/cleanings')
  const res = await apiFetch<{ data: CleaningJob }>(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function updateCleaningJob(
  id: string,
  patch: Partial<Omit<CleaningJob, 'id' | 'client_id' | 'created_at' | 'updated_at'>>,
): Promise<CleaningJob> {
  const url = resolveApiUrl(`/api/operations/cleanings/${encodeURIComponent(id)}`)
  const res = await apiFetch<{ data: CleaningJob }>(url, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Insurance Policies
// ─────────────────────────────────────────────────────────────────────────────

export interface InsuranceFilters {
  client_id?: number | null
  project_id?: string | null
  status?: string | null
}

export async function listInsurancePolicies(filters: InsuranceFilters = {}): Promise<InsurancePolicy[]> {
  const url = resolveApiUrl(`/api/operations/insurance${buildQuery(filters)}`)
  const res = await apiFetch<{ data: InsurancePolicy[] }>(url)
  return res.data
}

export async function createInsurancePolicy(payload: CreateInsurancePolicyPayload): Promise<InsurancePolicy> {
  const url = resolveApiUrl('/api/operations/insurance')
  const res = await apiFetch<{ data: InsurancePolicy }>(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function updateInsurancePolicy(
  id: string,
  patch: Partial<Omit<InsurancePolicy, 'id' | 'client_id' | 'created_at' | 'updated_at'>>,
): Promise<InsurancePolicy> {
  const url = resolveApiUrl(`/api/operations/insurance/${encodeURIComponent(id)}`)
  const res = await apiFetch<{ data: InsurancePolicy }>(url, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Operation Events (Agenda)
// ─────────────────────────────────────────────────────────────────────────────

export interface EventFilters {
  client_id?: number | null
  project_id?: string | null
  status?: string | null
}

export async function listOperationEvents(filters: EventFilters = {}): Promise<OperationEvent[]> {
  const url = resolveApiUrl(`/api/operations/events${buildQuery(filters)}`)
  const res = await apiFetch<{ data: OperationEvent[] }>(url)
  return res.data
}

export async function createOperationEvent(payload: CreateOperationEventPayload): Promise<OperationEvent> {
  const url = resolveApiUrl('/api/operations/events')
  const res = await apiFetch<{ data: OperationEvent }>(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function updateOperationEvent(
  id: string,
  patch: Partial<Omit<OperationEvent, 'id' | 'created_at' | 'updated_at'>>,
): Promise<OperationEvent> {
  const url = resolveApiUrl(`/api/operations/events/${encodeURIComponent(id)}`)
  const res = await apiFetch<{ data: OperationEvent }>(url, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return res.data
}
