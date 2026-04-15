// src/services/clientPortfolioApi.ts
// REST client for /api/client-portfolio and related portfolio endpoints.

import { resolveApiUrl } from '../utils/apiUrl'
import type {
  PortfolioClientRow,
  ClientNote,
  PortfolioSummary,
} from '../types/clientPortfolio'
import { updateClientById, deleteClientById, type UpdateClientInput } from '../lib/api/clientsApi'

type GetAccessToken = () => Promise<string | null>
let portfolioTokenProvider: GetAccessToken | null = null

export function setPortfolioTokenProvider(fn: GetAccessToken): void {
  portfolioTokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = portfolioTokenProvider ? await portfolioTokenProvider() : null
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


function friendlyErrorMessage(operation: 'list' | 'export' | 'remove' | 'update' | 'delete', fallback: string): string {
  const messages: Record<string, string> = {
    list: 'Não foi possível carregar a carteira de clientes.',
    export: 'Não foi possível exportar o cliente para a carteira.',
    remove: 'Não foi possível remover o cliente da carteira.',
    update: 'Não foi possível salvar as alterações do cliente.',
    delete: 'Não foi possível excluir o cliente.',
  }
  return messages[operation] ?? fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio list
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPortfolioClients(search?: string): Promise<PortfolioClientRow[]> {
  try {
    const url = new URL(resolveApiUrl('/api/client-portfolio'))
    if (search) url.searchParams.set('search', search)
    const res = await apiFetch<{ data: PortfolioClientRow[] }>(url.toString())
    return res.data
  } catch {
    throw new Error(friendlyErrorMessage('list', 'Erro ao carregar carteira.'))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio client detail
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPortfolioClient(clientId: number): Promise<PortfolioClientRow | null> {
  try {
    const res = await apiFetch<{ data: PortfolioClientRow }>(
      resolveApiUrl(`/api/client-portfolio/${clientId}`),
    )
    return res.data
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('404') && !msg.toLowerCase().includes('not found')) {
      console.error('[portfolio] fetchPortfolioClient error', err)
    }
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export client to portfolio
// ─────────────────────────────────────────────────────────────────────────────
export async function exportClientToPortfolio(clientId: number): Promise<void> {
  try {
    await apiFetch(resolveApiUrl(`/api/clients/${clientId}/portfolio-export`), { method: 'PATCH' })
  } catch {
    throw new Error(friendlyErrorMessage('export', 'Erro ao exportar cliente.'))
  }
}

export async function removeClientFromPortfolio(clientId: number): Promise<PortfolioClientRow> {
  try {
    const res = await apiFetch<{ data: PortfolioClientRow }>(
      resolveApiUrl(`/api/clients/${clientId}/portfolio-remove`),
      { method: 'PATCH' },
    )
    return res.data
  } catch {
    throw new Error(friendlyErrorMessage('remove', 'Erro ao remover cliente da carteira.'))
  }
}

export async function updateClientFromPortfolio(
  clientId: number,
  payload: UpdateClientInput,
): Promise<void> {
  try {
    await updateClientById(String(clientId), payload)
  } catch {
    throw new Error(friendlyErrorMessage('update', 'Erro ao atualizar cliente.'))
  }
}

export async function deleteClientFromPortfolio(clientId: number): Promise<void> {
  try {
    await deleteClientById(String(clientId))
  } catch {
    throw new Error(friendlyErrorMessage('delete', 'Erro ao excluir cliente.'))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Patch sub-resources
// ─────────────────────────────────────────────────────────────────────────────
export async function patchPortfolioProfile(clientId: number, data: Record<string, unknown>): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/client-portfolio/${clientId}/profile`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function patchPortfolioContract(clientId: number, data: Record<string, unknown>): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/client-portfolio/${clientId}/contract`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function patchPortfolioProject(clientId: number, data: Record<string, unknown>): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/client-portfolio/${clientId}/project`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function patchPortfolioBilling(clientId: number, data: Record<string, unknown>): Promise<void> {
  await apiFetch(resolveApiUrl(`/api/client-portfolio/${clientId}/billing`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPortfolioNotes(clientId: number): Promise<ClientNote[]> {
  const res = await apiFetch<{ data: ClientNote[] }>(
    resolveApiUrl(`/api/client-portfolio/${clientId}/notes`),
  )
  return res.data
}

export async function addPortfolioNote(
  clientId: number,
  note: { entry_type?: string; title?: string; content: string },
): Promise<ClientNote> {
  const res = await apiFetch<{ data: ClientNote }>(
    resolveApiUrl(`/api/client-portfolio/${clientId}/notes`),
    { method: 'POST', body: JSON.stringify(note) },
  )
  return res.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard summary
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDashboardPortfolioSummary(): Promise<PortfolioSummary> {
  const res = await apiFetch<{ data: PortfolioSummary }>(
    resolveApiUrl('/api/dashboard/portfolio/summary'),
  )
  return res.data
}


export const listPortfolioClients = fetchPortfolioClients
export const getPortfolioClient = fetchPortfolioClient
