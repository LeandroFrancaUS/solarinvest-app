// src/lib/api/clientsApi.ts
// REST client for /api/clients and /api/consultants endpoints.

import { resolveApiUrl } from '../../utils/apiUrl'

const BASE_URL = resolveApiUrl('/api/clients')
const CONSULTANTS_URL = resolveApiUrl('/api/consultants')

type GetAccessToken = () => Promise<string | null>
let clientsTokenProvider: GetAccessToken | null = null

export function setClientsTokenProvider(fn: GetAccessToken): void {
  clientsTokenProvider = fn
}

export interface ClientRow {
  id: string
  name: string
  document: string | null
  cpf_raw: string | null
  cnpj_raw: string | null
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  address: string | null
  uc: string | null
  distribuidora: string | null
  metadata: Record<string, unknown> | null
  owner_user_id: string | null
  created_by_user_id: string | null
  /** Set from a LEFT JOIN to app_user_profiles when listing clients */
  owner_display_name: string | null
  /** Set from a LEFT JOIN to app_user_profiles when listing clients */
  owner_email: string | null
  created_at: string
  updated_at: string
}

export interface ClientListFilters {
  page?: number
  limit?: number
  search?: string
  city?: string
  state?: string
}

export interface ClientListResult {
  data: ClientRow[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface UpsertClientInput {
  name: string
  document?: string
  cpf_raw?: string
  cnpj_raw?: string
  email?: string
  phone?: string
  city?: string
  state?: string
  address?: string
  uc?: string
  distribuidora?: string
  metadata?: Record<string, unknown>
}

export interface UpdateClientInput {
  name?: string
  document?: string
  cpf_raw?: string
  cnpj_raw?: string
  email?: string
  phone?: string
  city?: string
  state?: string
  address?: string
  uc?: string
  distribuidora?: string
  metadata?: Record<string, unknown>
}

export class ClientsApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ClientsApiError'
    this.status = status
    this.code = code
  }
}

async function parseErrorResponse(res: Response): Promise<ClientsApiError> {
  let code = 'INTERNAL_ERROR'
  let message = `HTTP ${res.status}`
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } | string; message?: string }
    if (typeof body?.error === 'string') {
      code = body.error
      message = body.message ?? body.error
    } else {
      code = body?.error?.code ?? code
      message = body?.error?.message ?? body?.message ?? message
    }
  } catch {
    // ignore parse errors
  }
  return new ClientsApiError(res.status, code, message)
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let authHeader: Record<string, string> = {}
  if (clientsTokenProvider) {
    try {
      const token = await clientsTokenProvider()
      if (token) {
        authHeader = { Authorization: `Bearer ${token}` }
      }
    } catch {
      // ignore – fall back to cookie-only auth
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    throw await parseErrorResponse(res)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

export async function upsertClientByDocument(input: UpsertClientInput): Promise<ClientRow> {
  const result = await apiFetch<{ data: ClientRow }>('/upsert-by-cpf', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return result.data
}

export async function updateClientById(id: string, input: UpdateClientInput): Promise<ClientRow> {
  const result = await apiFetch<{ data: ClientRow }>(`/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return result.data
}

export async function deleteClientById(id: string): Promise<{ deletedId: string }> {
  return apiFetch<{ deletedId: string }>(`/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/**
 * List clients with optional filters. The server enforces RBAC:
 *   admin/financeiro → all clients
 *   office           → own + role_comercial users' clients
 *   comercial        → own clients only
 */
export async function listClients(filters: ClientListFilters = {}): Promise<ClientListResult> {
  const params = new URLSearchParams()
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.search) params.set('search', filters.search)
  if (filters.city) params.set('city', filters.city)
  if (filters.state) params.set('uf', filters.state)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiFetch<ClientListResult>(qs)
}

export interface ConsultantEntry {
  id: string
  name: string
  email: string | null
}

/**
 * List all registered consultant profiles.
 * Only accessible to privileged users (admin, office, financeiro).
 * Used to populate the consultant filter on the client management page.
 */
export async function listConsultants(): Promise<ConsultantEntry[]> {
  let authHeader: Record<string, string> = {}
  if (clientsTokenProvider) {
    try {
      const token = await clientsTokenProvider()
      if (token) {
        authHeader = { Authorization: `Bearer ${token}` }
      }
    } catch {
      // ignore – fall back to cookie-only auth
    }
  }
  const res = await fetch(CONSULTANTS_URL, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeader },
  })
  if (!res.ok) return []
  const body = (await res.json()) as { consultants: ConsultantEntry[] }
  return Array.isArray(body.consultants) ? body.consultants : []
}
