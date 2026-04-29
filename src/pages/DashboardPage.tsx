// src/pages/DashboardPage.tsx

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

  const loadData = useCallback(async () => {
    const [clients, proposals, portfolio] = await Promise.all([
      listClients({ limit: 1000 }),
      listProposals({ limit: 1000 }),
      fetchPortfolioClients(),
    ])

    const map = new Map<string, AnalyticsRecord>()

    // Portfolio FIRST (source of truth)
    for (const p of portfolio) {
      const rec = normalizePortfolio(p as unknown as Record<string, unknown>)
      map.set(rec.id, rec)
    }

    // Clients (only if not in portfolio)
    for (const c of clients.data) {
      const rec = normalizeClient(c as unknown as Record<string, unknown>)
      if (!map.has(rec.id)) map.set(rec.id, rec)
    }

    // Proposals (only if not already covered)
    for (const p of proposals.data) {
      const rec = normalizeProposal(p as unknown as Record<string, unknown>)
      if (!map.has(rec.id)) map.set(rec.id, rec)
    }

    invalidateSnapshotCache()
    setRecords(Array.from(map.values()))
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const snapshot = useMemo(() => computeDashboardSnapshot(records, filters), [records, filters])

  return null
}
