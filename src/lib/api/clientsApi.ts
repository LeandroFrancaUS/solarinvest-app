// src/lib/api/clientsApi.ts
// REST client for /api/clients endpoints used by client autosave.

import { resolveApiUrl } from '../../utils/apiUrl'

const BASE_URL = resolveApiUrl('/api/clients')

type GetAccessToken = () => Promise<string | null>
let clientsTokenProvider: GetAccessToken | null = null

export function setClientsTokenProvider(fn: GetAccessToken): void {
  clientsTokenProvider = fn
}

export interface ClientRow {
  id: string
  name: string
  document: string | null
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  address: string | null
  uc: string | null
  distribuidora: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
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
    const body = (await res.json()) as { error?: { code?: string; message?: string } | string }
    if (typeof body?.error === 'string') {
      message = body.error
    } else {
      code = body?.error?.code ?? code
      message = body?.error?.message ?? message
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
