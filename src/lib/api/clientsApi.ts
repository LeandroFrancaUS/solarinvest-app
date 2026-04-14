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

export interface ClientEnergyProfile {
  kwh_contratado: number | null
  potencia_kwp: number | null
  tipo_rede: string | null
  tarifa_atual: number | null
  desconto_percentual: number | null
  mensalidade: number | null
  indicacao: string | null
  modalidade: string | null
  prazo_meses: number | null
  marca_inversor: string | null
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
  cep: string | null
  uc: string | null
  distribuidora: string | null
  metadata: Record<string, unknown> | null
  owner_user_id: string | null
  created_by_user_id: string | null
  /** Set from a LEFT JOIN to app_user_profiles when listing clients */
  owner_display_name: string | null
  /** Set from a LEFT JOIN to app_user_profiles when listing clients */
  owner_email: string | null
  /** Energy/commercial profile from client_energy_profile table (null if not yet set) */
  energy_profile: ClientEnergyProfile | null
  created_at: string
  updated_at: string
  /** Soft-delete timestamp; null means active. The API already filters these out but the field is included for defensive use. */
  deleted_at: string | null
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
  cep?: string
  uc?: string
  distribuidora?: string
  metadata?: Record<string, unknown>
  energyProfile?: Partial<ClientEnergyProfile>
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
  cep?: string
  uc?: string
  distribuidora?: string
  metadata?: Record<string, unknown>
  energyProfile?: Partial<ClientEnergyProfile>
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

export function isClientNotFoundError(error: unknown): boolean {
  if (error instanceof ClientsApiError) {
    return error.status === 404 || error.code === 'NOT_FOUND'
  }
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Client not found') || message.includes('404') || message.includes('NOT_FOUND')
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

export async function deleteClientById(id: string): Promise<void> {
  await apiFetch<void>(`/${encodeURIComponent(id)}`, {
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

// ─── Bulk Import ─────────────────────────────────────────────────────────────

export interface BulkImportRowInput {
  name: string
  document?: string | null
  uc?: string | null
  email?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
  address?: string | null
  distribuidora?: string | null
  metadata?: Record<string, unknown> | null
  energyProfile?: {
    kwh_contratado?: number | null
    potencia_kwp?: number | null
    tipo_rede?: string | null
    tarifa_atual?: number | null
    desconto_percentual?: number | null
    mensalidade?: number | null
    indicacao?: string | null
    modalidade?: string | null
    prazo_meses?: number | null
  } | null
}

export type PreviewMatchLevel = 'hard' | 'medium' | 'soft' | 'none'
export type PreviewStatus = 'new' | 'existing' | 'possible_duplicate'
export type PreviewConfidence = 'high' | 'medium' | 'low'
export type PreviewAction = 'import' | 'ignore' | 'merge'

export interface BulkImportPreviewRow {
  rowIndex: number
  name: string
  matchLevel: PreviewMatchLevel
  status: PreviewStatus
  confidence: PreviewConfidence
  suggestedAction: PreviewAction
  matchReason: string | null
  existingClient: { id: string | number; name: string } | null
  matchFields: string[]
  error?: string
}

export interface BulkImportPreviewResult {
  data: BulkImportPreviewRow[]
}

export interface BulkImportResultRow {
  rowIndex: number
  name: string
  action: 'created' | 'merged' | 'skipped' | 'error'
  clientId?: string | number | null
  hasEnergyProfile?: boolean
  error?: string
}

export interface BulkImportResult {
  summary: { created: number; merged: number; skipped: number; errors: number }
  results: BulkImportResultRow[]
}

/**
 * Run deduplication preview without persisting any data.
 */
export async function bulkImportPreview(rows: BulkImportRowInput[]): Promise<BulkImportPreviewResult> {
  return apiFetch<BulkImportPreviewResult>('/bulk-import/preview', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
}

/**
 * Execute the bulk import: creates/merges clients and energy profiles.
 */
export async function bulkImport(
  rows: BulkImportRowInput[],
  options: { autoMerge?: boolean } = {},
): Promise<BulkImportResult> {
  return apiFetch<BulkImportResult>('/bulk-import', {
    method: 'POST',
    body: JSON.stringify({ rows, autoMerge: options.autoMerge ?? false }),
  })
}
