// src/lib/api/proposalsApi.ts
// REST client for the /api/proposals endpoints.
// All network errors surface as ProposalApiError instances.

import { resolveApiUrl } from '../../utils/apiUrl'

const BASE_URL = resolveApiUrl('/api/proposals')

// ─── Token provider ───────────────────────────────────────────────────────────

type GetAccessToken = () => Promise<string | null>
let proposalsTokenProvider: GetAccessToken | null = null

/**
 * Register the Stack Auth token provider for the proposals API.
 * Must be called once the authenticated user is available (e.g. in App.tsx).
 * This enables Authorization: Bearer <token> on every request to /api/proposals.
 */
export function setProposalsTokenProvider(fn: GetAccessToken): void {
  proposalsTokenProvider = fn
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProposalType = 'leasing' | 'venda'
export type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'cancelled'

export interface ProposalRow {
  id: string
  proposal_type: ProposalType
  proposal_code: string | null
  version: number
  status: ProposalStatus
  owner_user_id: string
  owner_email: string | null
  owner_display_name: string | null
  created_by_user_id: string
  updated_by_user_id: string | null
  client_name: string | null
  client_document: string | null
  client_city: string | null
  client_state: string | null
  client_phone: string | null
  client_email: string | null
  consumption_kwh_month: number | null
  system_kwp: number | null
  capex_total: number | null
  contract_value: number | null
  term_months: number | null
  payload_json: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ProposalListResult {
  data: ProposalRow[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface CreateProposalInput {
  proposal_type: ProposalType
  payload_json: Record<string, unknown>
  proposal_code?: string
  status?: ProposalStatus
  client_name?: string
  client_document?: string
  client_city?: string
  client_state?: string
  client_phone?: string
  client_email?: string
  consumption_kwh_month?: number
  system_kwp?: number
  capex_total?: number
  contract_value?: number
  term_months?: number
}

export type UpdateProposalInput = Partial<Omit<CreateProposalInput, 'proposal_type'>>

export interface ProposalListFilters {
  page?: number
  limit?: number
  proposal_type?: ProposalType
  status?: ProposalStatus
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class ProposalApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ProposalApiError'
    this.status = status
    this.code = code
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function parseErrorResponse(res: Response): Promise<ProposalApiError> {
  let code = 'INTERNAL_ERROR'
  let message = `HTTP ${res.status}`
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } }
    code = body?.error?.code ?? code
    message = body?.error?.message ?? message
  } catch {
    // ignore parse errors
  }
  return new ProposalApiError(res.status, code, message)
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let authHeader: Record<string, string> = {}
  if (proposalsTokenProvider) {
    try {
      const token = await proposalsTokenProvider()
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

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * List proposals with optional filters and pagination.
 */
export async function listProposals(filters: ProposalListFilters = {}): Promise<ProposalListResult> {
  const params = new URLSearchParams()
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.proposal_type) params.set('proposal_type', filters.proposal_type)
  if (filters.status) params.set('status', filters.status)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiFetch<ProposalListResult>(qs)
}

/**
 * Fetch a single proposal by ID.
 * Returns null when the server responds with 404.
 */
export async function getProposal(id: string): Promise<ProposalRow | null> {
  try {
    const result = await apiFetch<{ data: ProposalRow }>(`/${encodeURIComponent(id)}`)
    return result.data
  } catch (err) {
    if (err instanceof ProposalApiError && err.status === 404) return null
    throw err
  }
}

/**
 * Create a new proposal. Returns the created ProposalRow.
 */
export async function createProposal(input: CreateProposalInput): Promise<ProposalRow> {
  const result = await apiFetch<{ data: ProposalRow }>('', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return result.data
}

/**
 * Update an existing proposal by ID. Returns the updated ProposalRow.
 */
export async function updateProposal(id: string, input: UpdateProposalInput): Promise<ProposalRow> {
  const result = await apiFetch<{ data: ProposalRow }>(`/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return result.data
}

/**
 * Soft-delete a proposal by ID.
 */
export async function deleteProposal(id: string): Promise<void> {
  await apiFetch<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
