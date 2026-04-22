// src/pages/DashboardPage.tsx
// Main analytics dashboard: fetches real data, applies filters, and renders KPIs + charts.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { listClients } from '../lib/api/clientsApi.js'
import { listProposals } from '../lib/api/proposalsApi.js'
import { fetchProjectsSummary } from '../services/projectsApi.js'
import { fetchFinancialDashboardFeed } from '../services/financialManagementApi.js'
import {
  computeDashboardSnapshot,
  defaultFilters,
  invalidateSnapshotCache,
  normalizeClient,
  normalizeProposal,
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

  // Gate data loading on a confirmed authenticated session from the auth context.
  // DashboardPage is rendered inside RequireAuthorizedUser which guarantees the user
  // is authenticated, but the API token providers (proposalsApi, clientsApi) are
  // registered in a parent component's useEffect that runs AFTER child effects.
  // Reading `me` from the auth context lets us defer the API call until after the
  // parent's effect has set the token providers.
  const { me } = useAppAuth()
  const isAuthenticated = Boolean(me?.authenticated)

  // ── Fetch data from real APIs ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    try {
      const [clientsRes, proposalsRes, projectSummaryRes, financialFeedRes] = await Promise.allSettled([
        listClients({ limit: 1000 }),
        listProposals({ limit: 1000 }),
        fetchProjectsSummary(),
        fetchFinancialDashboardFeed(),
      ])

      const allRecords: AnalyticsRecord[] = []

      if (clientsRes.status === 'fulfilled') {
        for (const c of clientsRes.value.data) {
          allRecords.push(normalizeClient(c as unknown as Record<string, unknown>))
        }
      }

      if (proposalsRes.status === 'fulfilled') {
        // Only add proposals that don't overlap with clients (by client_id).
        const clientIds = new Set(allRecords.map((r) => r.id))
        for (const p of proposalsRes.value.data) {
          const rec = normalizeProposal(p as unknown as Record<string, unknown>)
          if (!clientIds.has(p.client_id ?? '')) {
            allRecords.push(rec)
          }
        }
      }

      // Project summary and financial feed are loaded independently (may fail for
      // users without the required permissions — handled gracefully).
      if (projectSummaryRes.status === 'fulfilled') {
        setProjectSummary(projectSummaryRes.value)
      }
      if (financialFeedRes.status === 'fulfilled') {
        setFinancialFeed(financialFeedRes.value)
      }

      invalidateSnapshotCache()
      setRecords(allRecords)
      setLoadState('loaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    // Only load data after auth is fully established so token providers are ready.
    if (!isAuthenticated) return
    void loadData()
    trackEvent('dashboard_viewed')
  }, [isAuthenticated, loadData])

  // ── Compute snapshot (memoised inside engine) ───────────────────────────
  const snapshot = useMemo(
    () => computeDashboardSnapshot(records, filters),
    [records, filters],
  )

  // ── Project/financial panel KPIs (server-aggregated, no re-derivation) ──
  const projectsPanelKPIs = useMemo(
    () => deriveProjectsPanelKPIs(projectSummary, financialFeed),
    [projectSummary, financialFeed],
  )

  // ── Extract available filter values ─────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────────────

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

      {/* Filters */}
      <DashboardFiltersPanel
        filters={filters}
        onChange={setFilters}
        availableConsultants={availableConsultants}
        availableStates={availableStates}
        availableRegions={availableRegions}
      />

      {/* KPI Cards */}
      <KpiCards kpis={snapshot.kpis} />

      {/* Projects + financial aggregation panel */}
      <ProjectsPanel kpis={projectsPanelKPIs} />

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ContractsChart data={snapshot.timeSeries} />
        <RevenueChart data={snapshot.timeSeries} />
      </div>

      {/* Forecast */}
      <ForecastPanel forecast={snapshot.forecast} />

      {/* Drilldown table */}
      <DrilldownTable records={snapshot.filtered} />
    </div>
  )
}
