// src/pages/DashboardPage.tsx
// Main analytics dashboard: fetches real data, applies filters, and renders KPIs + charts.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { listClients } from '../lib/api/clientsApi.js'
import { listProposals } from '../lib/api/proposalsApi.js'
import { fetchPortfolioClients } from '../services/clientPortfolioApi.js'
import { fetchProjectsSummary } from '../services/projectsApi.js'
import { fetchFinancialDashboardFeed } from '../services/financialManagementApi.js'
import {
  computeDashboardSnapshot,
  defaultFilters,
  invalidateSnapshotCache,
  normalizeClient,
  normalizeProposal,
  normalizePortfolio,
  trackEvent,
} from '../domain/analytics/index.js'
import type { AnalyticsRecord, DashboardFilters } from '../domain/analytics/types.js'
import type { ProjectSummary } from '../domain/projects/types.js'
import type { FinancialDashboardFeed } from '../domain/projects/projectsPanelKpis.js'
import { deriveProjectsPanelKPIs } from '../domain/projects/projectsPanelKpis.js'
import {
  DashboardFiltersPanel,
  KpiCards,
  ContractsChart,
  RevenueChart,
  ForecastPanel,
  DrilldownTable,
  ProjectsPanel,
} from '../components/dashboard/index.js'
import { useAppAuth } from '../auth/guards/RequireAuthorizedUser.js'

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error'

export function DashboardPage() {
  const [records, setRecords] = useState<AnalyticsRecord[]>([])
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters())
  const [loadState, setLoadState] = useState<LoadingState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null)
  const [financialFeed, setFinancialFeed] = useState<FinancialDashboardFeed | null>(null)

  const { me } = useAppAuth()
  const isAuthenticated = Boolean(me?.authenticated)

  const loadData = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    try {
      const [clientsRes, proposalsRes, portfolioRes, projectSummaryRes, financialFeedRes] = await Promise.allSettled([
        listClients({ limit: 1000 }),
        listProposals({ limit: 1000 }),
        fetchPortfolioClients(),
        fetchProjectsSummary(),
        fetchFinancialDashboardFeed(),
      ])

      const recordsById = new Map<string, AnalyticsRecord>()

      // Carteira Ativa is the source of truth for active/contracted customers.
      if (portfolioRes.status === 'fulfilled') {
        for (const row of portfolioRes.value) {
          const rec = normalizePortfolio(row as unknown as Record<string, unknown>)
          recordsById.set(rec.id, rec)
        }
      }

      if (clientsRes.status === 'fulfilled') {
        for (const c of clientsRes.value.data) {
          const rec = normalizeClient(c as unknown as Record<string, unknown>)
          if (!recordsById.has(rec.id)) recordsById.set(rec.id, rec)
        }
      }

      if (proposalsRes.status === 'fulfilled') {
        for (const p of proposalsRes.value.data) {
          const rec = normalizeProposal(p as unknown as Record<string, unknown>)
          const proposalClientId = String(p.client_id ?? rec.id)
          if (!recordsById.has(proposalClientId) && !recordsById.has(rec.id)) {
            recordsById.set(rec.id, rec)
          }
        }
      }

      if (projectSummaryRes.status === 'fulfilled') setProjectSummary(projectSummaryRes.value)
      if (financialFeedRes.status === 'fulfilled') setFinancialFeed(financialFeedRes.value)

      invalidateSnapshotCache()
      setRecords(Array.from(recordsById.values()))
      setLoadState('loaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    void loadData()
    trackEvent('dashboard_viewed')
  }, [isAuthenticated, loadData])

  const snapshot = useMemo(
    () => computeDashboardSnapshot(records, filters),
    [records, filters],
  )

  const projectsPanelKPIs = useMemo(
    () => deriveProjectsPanelKPIs(projectSummary, financialFeed),
    [projectSummary, financialFeed],
  )

  const availableConsultants = useMemo(
    () => [...new Set(records.map((r) => r.consultant).filter((c): c is string => c != null))].sort(),
    [records],
  )
  const availableStates = useMemo(
    () => [...new Set(records.map((r) => r.state).filter((s): s is string => s != null))].sort(),
    [records],
  )
  const availableRegions = useMemo(
    () => [...new Set(records.map((r) => r.region).filter((r): r is string => r != null))].sort(),
    [records],
  )

  if (loadState === 'idle' || loadState === 'loading') {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-sm text-ds-text-muted">Carregando dashboard…</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ds-text-primary">Dashboard Analítico</h1>
        <button
          type="button"
          onClick={() => void loadData()}
          className="cursor-pointer rounded-lg border border-ds-border px-3 py-1.5 text-xs text-ds-text-secondary transition-colors hover:border-ds-primary/50 hover:text-ds-primary"
        >
          ↻ Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-ds-warning/30 bg-ds-warning/10 px-4 py-2 text-sm text-ds-warning">
          {error} — exibindo dados parciais.
        </div>
      )}

      <DashboardFiltersPanel
        filters={filters}
        onChange={setFilters}
        availableConsultants={availableConsultants}
        availableStates={availableStates}
        availableRegions={availableRegions}
      />

      <KpiCards kpis={snapshot.kpis} />
      <ProjectsPanel kpis={projectsPanelKPIs} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ContractsChart data={snapshot.timeSeries} />
        <RevenueChart data={snapshot.timeSeries} />
      </div>

      <ForecastPanel forecast={snapshot.forecast} />
      <DrilldownTable records={snapshot.filtered} />
    </div>
  )
}
