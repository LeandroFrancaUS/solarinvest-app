// src/services/invoicesApi.ts
// REST client for /api/invoices endpoints.

import { resolveApiUrl } from '../utils/apiUrl'
import type {
  ClientInvoice,
  InvoiceNotificationConfig,
  InvoiceNotificationAlert,
  InvoicePaymentStatus,
} from '../types/clientPortfolio'

type GetAccessToken = () => Promise<string | null>
let invoicesTokenProvider: GetAccessToken | null = null

export function setInvoicesTokenProvider(fn: GetAccessToken): void {
  invoicesTokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = invoicesTokenProvider ? await invoicesTokenProvider() : null
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
// List invoices for a client
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchClientInvoices(clientId: number): Promise<ClientInvoice[]> {
  const url = new URL(resolveApiUrl('/api/invoices'), window.location.origin)
  url.searchParams.set('client_id', String(clientId))
  const res = await apiFetch<{ data: ClientInvoice[] }>(url.toString())
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// List all invoices (for dashboard)
// ─────────────────────────────────────────────────────────────────────────────
export interface ListInvoicesParams {
  client_id?: number
  limit?: number
}

export async function listInvoices(params?: ListInvoicesParams): Promise<{ data: ClientInvoice[] }> {
  const url = new URL(resolveApiUrl('/api/invoices'), window.location.origin)
  if (params?.client_id) url.searchParams.set('client_id', String(params.client_id))
  if (params?.limit) url.searchParams.set('limit', String(params.limit))
  return apiFetch<{ data: ClientInvoice[] }>(url.toString())
}

// ─────────────────────────────────────────────────────────────────────────────
// Create a new invoice
// ─────────────────────────────────────────────────────────────────────────────
export interface CreateInvoicePayload {
  client_id: number
  uc: string
  invoice_number?: string | null
  reference_month: string // YYYY-MM-01
  due_date: string // ISO date
  amount: number
  notes?: string | null
}

export async function createInvoice(payload: CreateInvoicePayload): Promise<ClientInvoice> {
  const res = await apiFetch<{ data: ClientInvoice }>(resolveApiUrl('/api/invoices'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Update an invoice
// ─────────────────────────────────────────────────────────────────────────────
export interface UpdateInvoicePayload {
  invoice_number?: string | null
  reference_month?: string
  due_date?: string
  amount?: number
  payment_status?: InvoicePaymentStatus
  notes?: string | null
}

export async function updateInvoice(
  invoiceId: number,
  payload: UpdateInvoicePayload,
): Promise<ClientInvoice> {
  const res = await apiFetch<{ data: ClientInvoice }>(
    resolveApiUrl(`/api/invoices/${invoiceId}`),
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete an invoice
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteInvoice(invoiceId: number): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/invoices/${invoiceId}`), { method: 'DELETE' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Register payment for an invoice
// ─────────────────────────────────────────────────────────────────────────────
export interface RegisterPaymentPayload {
  payment_status: InvoicePaymentStatus
  receipt_number?: string | null
  transaction_number?: string | null
  attachment_url?: string | null
}

export async function registerInvoicePayment(
  invoiceId: number,
  payload: RegisterPaymentPayload,
): Promise<ClientInvoice> {
  const res = await apiFetch<{ data: ClientInvoice }>(
    resolveApiUrl(`/api/invoices/${invoiceId}/payment`),
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Get invoice notifications
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchInvoiceNotifications(): Promise<InvoiceNotificationAlert[]> {
  const res = await apiFetch<{ data: InvoiceNotificationAlert[] }>(
    resolveApiUrl('/api/invoices/notifications'),
  )
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Get invoice notification configuration
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchInvoiceNotificationConfig(): Promise<InvoiceNotificationConfig> {
  const res = await apiFetch<{ data: InvoiceNotificationConfig }>(
    resolveApiUrl('/api/invoices/notification-config'),
  )
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Update invoice notification configuration
// ─────────────────────────────────────────────────────────────────────────────
export interface UpdateNotificationConfigPayload {
  days_before_due?: number[]
  notify_on_due_date?: boolean
  days_after_due?: number[]
  visual_notifications_enabled?: boolean
  audio_notifications_enabled?: boolean
}

export async function updateInvoiceNotificationConfig(
  payload: UpdateNotificationConfigPayload,
): Promise<InvoiceNotificationConfig> {
  const res = await apiFetch<{ data: InvoiceNotificationConfig }>(
    resolveApiUrl('/api/invoices/notification-config'),
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return res.data
}
