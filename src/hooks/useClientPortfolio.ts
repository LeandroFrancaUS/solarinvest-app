// src/hooks/useClientPortfolio.ts
// Hook to fetch and manage the list of portfolio clients.

import { useState, useEffect, useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { PortfolioClientRow, PortfolioSummary } from '../types/clientPortfolio'
import {
  fetchPortfolioClients,
  fetchPortfolioClient,
  fetchDashboardPortfolioSummary,
  exportClientToPortfolio as apiExportClient,
} from '../services/clientPortfolioApi'

export interface UseClientPortfolioResult {
  clients: PortfolioClientRow[]
  isLoading: boolean
  error: string | null
  reload: () => void
  setSearch: (q: string) => void
  setClients: Dispatch<SetStateAction<PortfolioClientRow[]>>
}

export function useClientPortfolio(): UseClientPortfolioResult {
  const [clients, setClients] = useState<PortfolioClientRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchPortfolioClients(search || undefined)
      .then((rows) => setClients(rows))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Erro ao carregar carteira.'))
      .finally(() => setIsLoading(false))
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  return { clients, isLoading, error, reload: load, setSearch, setClients }
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
        else setClient(row)
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
      setExportError(err instanceof Error ? err.message : 'Erro ao exportar cliente.')
      return false
    } finally {
      setExporting(false)
    }
  }, [])

  return { exporting, exportError, exportClient }
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
