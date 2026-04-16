// src/hooks/useClientPortfolio.ts
// Hook to fetch and manage the list of portfolio clients.
//
// PORTFOLIO REHYDRATION RULE (Etapa 2.4):
// usePortfolioClient() is the ONLY hook that should hydrate portfolio detail
// panels. It fetches exclusively from GET /api/client-portfolio/:id and
// normalises via normalizePortfolioClientPayload.
//
// NEVER mix portfolio state with:
//   - /api/clients/:id responses
//   - /api/clients?page=... listing responses
//   - latest_proposal_profile
//   - legacy store data

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PortfolioClientRow, PortfolioSummary } from '../types/clientPortfolio'
import {
  fetchPortfolioClients,
  fetchPortfolioClient,
  fetchDashboardPortfolioSummary,
  exportClientToPortfolio as apiExportClient,
  removeClientFromPortfolio as apiRemoveClient,
  updateClientFromPortfolio as apiUpdateClient,
  deleteClientFromPortfolio as apiDeleteClient,
} from '../services/clientPortfolioApi'
import { normalizePortfolioClientPayload } from '../utils/normalizePortfolioPayload'

export interface UseClientPortfolioResult {
  clients: PortfolioClientRow[]
  isLoading: boolean
  error: string | null
  reload: () => void
  setSearch: (q: string) => void
  removeClient: (clientId: number) => void
}

export function useClientPortfolio(): UseClientPortfolioResult {
  const [clients, setClients] = useState<PortfolioClientRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchPortfolioClients(search || undefined)
      .then((rows) => setClients(rows))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Não foi possível carregar a carteira de clientes.'),
      )
      .finally(() => setIsLoading(false))
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const setSearchDebounced = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(q), 300)
  }, [])

  const removeClient = useCallback((clientId: number) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId))
  }, [])

  return { clients, isLoading, error, reload: load, setSearch: setSearchDebounced, removeClient }
}

export interface UsePortfolioClientResult {
  client: PortfolioClientRow | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

export function usePortfolioClient(clientId: number | null): UsePortfolioClientResult {
  const [client, setClient] = useState<PortfolioClientRow | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!clientId) { setClient(null); return }
    setIsLoading(true)
    setError(null)
    fetchPortfolioClient(clientId)
      .then((row) => {
        if (!row) setError('Cliente não encontrado na carteira.')
        else setClient(normalizePortfolioClientPayload(row))
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Erro ao carregar cliente.'))
      .finally(() => setIsLoading(false))
  }, [clientId])

  useEffect(() => { load() }, [load])

  return { client, isLoading, error, reload: load }
}

export interface UsePortfolioExportResult {
  exporting: boolean
  exportError: string | null
  exportClient: (clientId: number) => Promise<boolean>
}

export function usePortfolioExport(): UsePortfolioExportResult {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const exportClient = useCallback(async (clientId: number): Promise<boolean> => {
    setExporting(true)
    setExportError(null)
    try {
      await apiExportClient(clientId)
      return true
    } catch (err: unknown) {
      setExportError(
        err instanceof Error ? err.message : 'Não foi possível exportar o cliente para a carteira.',
      )
      return false
    } finally {
      setExporting(false)
    }
  }, [])

  return { exporting, exportError, exportClient }
}

export interface UsePortfolioRemoveResult {
  removing: boolean
  removeError: string | null
  removeClient: (clientId: number) => Promise<boolean>
}

export function usePortfolioRemove(): UsePortfolioRemoveResult {
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const removeClient = useCallback(async (clientId: number): Promise<boolean> => {
    setRemoving(true)
    setRemoveError(null)
    try {
      await apiRemoveClient(clientId)
      return true
    } catch (err: unknown) {
      setRemoveError(
        err instanceof Error ? err.message : 'Não foi possível remover o cliente da carteira.',
      )
      return false
    } finally {
      setRemoving(false)
    }
  }, [])

  return { removing, removeError, removeClient }
}

export interface UsePortfolioUpdateResult {
  updating: boolean
  updateError: string | null
  updateClient: (clientId: number, payload: Record<string, unknown>) => Promise<boolean>
}

export function usePortfolioUpdate(): UsePortfolioUpdateResult {
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const updateClient = useCallback(
    async (clientId: number, payload: Record<string, unknown>): Promise<boolean> => {
      setUpdating(true)
      setUpdateError(null)
      try {
        await apiUpdateClient(clientId, payload)
        return true
      } catch (err: unknown) {
        setUpdateError(
          err instanceof Error ? err.message : 'Não foi possível salvar as alterações do cliente.',
        )
        return false
      } finally {
        setUpdating(false)
      }
    },
    [],
  )

  return { updating, updateError, updateClient }
}

export interface UsePortfolioDeleteResult {
  deleting: boolean
  deleteError: string | null
  deleteClient: (clientId: number) => Promise<boolean>
}

export function usePortfolioDelete(): UsePortfolioDeleteResult {
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const deleteClient = useCallback(async (clientId: number): Promise<boolean> => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await apiDeleteClient(clientId)
      return true
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'Não foi possível excluir o cliente.',
      )
      return false
    } finally {
      setDeleting(false)
    }
  }, [])

  return { deleting, deleteError, deleteClient }
}

export interface UseDashboardPortfolioSummaryResult {
  summary: PortfolioSummary | null
  isLoading: boolean
  error: string | null
}

export function useDashboardPortfolioSummary(): UseDashboardPortfolioSummaryResult {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    fetchDashboardPortfolioSummary()
      .then((s) => setSummary(s))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Erro ao carregar resumo.'))
      .finally(() => setIsLoading(false))
  }, [])

  return { summary, isLoading, error }
}
