import { useCallback, useEffect, useMemo, useState } from 'react'
import { listClients } from '../lib/api/clientsApi.js'
import { listProposals } from '../lib/api/proposalsApi.js'
import { fetchPortfolioClients } from '../services/clientPortfolioApi.js'
import {
  computeDashboardSnapshot,
  defaultFilters,
  invalidateSnapshotCache,
  normalizeClient,
  normalizeProposal,
  normalizePortfolio,
} from '../domain/analytics/index.js'
import type { AnalyticsRecord, DashboardFilters } from '../domain/analytics/types.js'

export function DashboardPage() {
  const [records, setRecords] = useState<AnalyticsRecord[]>([])
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters())
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)

    const [clients, proposals, portfolio] = await Promise.all([
      listClients({ limit: 1000 }),
      listProposals({ limit: 1000 }),
      fetchPortfolioClients(),
    ])

    const map = new Map<string, AnalyticsRecord>()

    // 🔥 Carteira ativa primeiro (fonte da verdade)
    for (const p of portfolio) {
      const rec = normalizePortfolio(p as unknown as Record<string, unknown>)
      map.set(rec.id, rec)
    }

    // fallback clients
    for (const c of clients.data) {
      const rec = normalizeClient(c as unknown as Record<string, unknown>)
      if (!map.has(rec.id)) map.set(rec.id, rec)
    }

    // fallback proposals
    for (const p of proposals.data) {
      const rec = normalizeProposal(p as unknown as Record<string, unknown>)
      if (!map.has(rec.id)) map.set(rec.id, rec)
    }

    invalidateSnapshotCache()
    setRecords(Array.from(map.values()))
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const snapshot = useMemo(
    () => computeDashboardSnapshot(records, filters),
    [records, filters]
  )

  // ✅ loading state (evita tela branca)
  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-sm text-gray-500">Carregando dashboard…</div>
      </div>
    )
  }

  // ✅ render mínimo (dashboard volta a aparecer)
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <h1 className="text-xl font-bold">Dashboard Analítico</h1>

      <div>
        <strong>Clientes ativos:</strong> {snapshot.kpis.activeClients}
      </div>

      <div>
        <strong>Contratos fechados:</strong> {snapshot.kpis.closedContracts}
      </div>

      <div>
        <strong>Valor contratado:</strong> R$ {snapshot.kpis.totalValue}
      </div>
    </div>
  )
}
