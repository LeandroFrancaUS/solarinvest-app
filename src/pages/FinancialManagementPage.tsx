// src/pages/FinancialManagementPage.tsx
// Gestão Financeira — Central de monitoramento e gestão financeira da SolarInvest.
// Access: admin | page_financial_management permission only.

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import '../styles/financial-management.css'
import '../styles/financial-import.css'
import { FinancialImportModal } from '../components/financial-import/FinancialImportModal'
import {
  fetchFinancialSummary,
  fetchFinancialProjects,
  fetchFinancialCashflow,
  type FinancialSummary,
  type FinancialProject,
  type CashflowPeriod,
} from '../services/financialManagementApi'
import { fetchPortfolioClients } from '../services/clientPortfolioApi'
import { formatCurrencyBRL } from '../utils/formatters'
import { useProjectsStore } from '../store/useProjectsStore'
import { ProjectDetailPage } from './ProjectDetailPage'
import type { ProjectType, ProjectStatus } from '../domain/projects/types'
import { PROJECT_TYPES, PROJECT_STATUSES } from '../domain/projects/types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'projects' | 'cashflow' | 'leasing' | 'sales' | 'faturas'

type PeriodFilter = 'month' | 'quarter' | 'year' | 'custom'

interface Props {
  onBack: () => void
  /** Called when the user wants to open a specific project from another page. */
  initialProjectId?: string | null
  /** Deep-link to a specific tab when the page first mounts. */
  initialTab?: Tab
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(1)}%`
}

function formatMonths(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(1)} meses`
}

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Visão Geral',
  projects: 'Projetos',
  cashflow: 'Fluxo de Caixa',
  leasing: 'Leasing',
  sales: 'Vendas',
  faturas: 'Faturas a Pagar',
}

const PROJECT_KIND_LABELS: Record<string, string> = {
  leasing: 'Leasing',
  sale: 'Venda',
  buyout: 'Buyout',
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  icon?: string
  color?: string
  subtitle?: string
}

function KpiCard({ label, value, icon, color, subtitle }: KpiCardProps) {
  return (
    <div className={`fm-kpi-card${color ? ` fm-kpi-card--${color}` : ''}`}>
      {icon ? <span className="fm-kpi-icon" aria-hidden="true">{icon}</span> : null}
      <div className="fm-kpi-body">
        <span className="fm-kpi-label">{label}</span>
        <span className="fm-kpi-value">{value}</span>
        {subtitle ? <span className="fm-kpi-subtitle">{subtitle}</span> : null}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Error Banner
// ─────────────────────────────────────────────────────────────────────────────

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="fm-error" role="alert">
      <strong>Erro ao carregar:</strong> {message}
      <button type="button" className="ghost" onClick={onRetry}>
        Tentar novamente
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab (PR 6: augmented with real project status counts via loadSummary)
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({ summary, error, onRetry }: { summary: FinancialSummary | null; error: string | null; onRetry: () => void }) {
  // Load server-side aggregated project counts on mount (no 500-row load).
  const loadSummary = useProjectsStore((s) => s.loadSummary)
  const projectSummary = useProjectsStore((s) => s.summary)
  const summaryLoading = useProjectsStore((s) => s.summaryLoading)

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  if (error) return <SectionError message={error} onRetry={onRetry} />
  if (!summary) {
    return <div className="fm-empty">Carregando indicadores…</div>
  }

  const totalProjects = projectSummary?.total ?? summary.active_projects_count

  return (
    <div className="fm-overview">
      <div className="fm-kpi-grid">
        <KpiCard label="Receita Projetada" value={formatCurrencyBRL(summary.total_projected_revenue)} icon="📈" color="green" />
        <KpiCard label="Receita Realizada" value={formatCurrencyBRL(summary.total_realized_revenue)} icon="✅" color="green" />
        <KpiCard label="CAPEX Total" value={formatCurrencyBRL(summary.total_cost)} icon="💸" color="red" />
        <KpiCard label="Lucro Líquido" value={formatCurrencyBRL(summary.net_profit)} icon="💰" color={summary.net_profit >= 0 ? 'green' : 'red'} />
        <KpiCard label="ROI Médio" value={formatPct(summary.avg_roi_percent)} icon="📊" />
        <KpiCard label="Payback Médio" value={formatMonths(summary.avg_payback_months)} icon="⏱️" />
        <KpiCard label="Projetos (total)" value={String(totalProjects)} icon="🏗️" />
        <KpiCard label="MRR (Leasing)" value={formatCurrencyBRL(summary.mrr_leasing)} icon="🔄" subtitle="Mensalidade recorrente" />
        <KpiCard label="Vendas Fechadas" value={formatCurrencyBRL(summary.closed_sales_revenue)} icon="🤝" />
        <KpiCard label="Inadimplência" value={formatPct(summary.avg_default_rate_percent)} icon="⚠️" color={summary.avg_default_rate_percent > 5 ? 'red' : 'green'} />
        <KpiCard label="Margem Líquida" value={formatPct(summary.avg_net_margin_percent)} icon="📉" />
      </div>
      {!summaryLoading && projectSummary ? (
        <div className="fm-overview-projects">
          <h3 className="fm-overview-section-title">Projetos por Status</h3>
          <div className="fm-kpi-grid">
            <KpiCard label="Aguardando" value={String(projectSummary.by_status['Aguardando'] ?? 0)} icon="⏳" />
            <KpiCard label="Em andamento" value={String(projectSummary.by_status['Em andamento'] ?? 0)} icon="🔨" color="green" />
            <KpiCard label="Concluídos" value={String(projectSummary.by_status['Concluído'] ?? 0)} icon="✅" color="green" />
          </div>
          <h3 className="fm-overview-section-title" style={{ marginTop: 16 }}>Projetos por Tipo</h3>
          <div className="fm-kpi-grid">
            <KpiCard label="Leasing" value={String(projectSummary.by_type['leasing'] ?? 0)} icon="🔄" />
            <KpiCard label="Venda" value={String(projectSummary.by_type['venda'] ?? 0)} icon="🤝" />
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Real Projects Tab (PR 2) — reads from /api/projects via useProjectsStore
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_TYPE_LABELS_TAB: Record<ProjectType, string> = {
  leasing: 'Leasing',
  venda: 'Venda',
}

const STATUS_BADGE_CLASS_TAB: Record<ProjectStatus, string> = {
  'Aguardando': 'fm-badge fm-badge--project-status-aguardando',
  'Em andamento': 'fm-badge fm-badge--project-status-andamento',
  'Concluído': 'fm-badge fm-badge--project-status-concluido',
}

interface RealProjectsTabProps {
  onOpenProject: (id: string) => void
}

function RealProjectsTab({ onOpenProject }: RealProjectsTabProps) {
  const list = useProjectsStore((s) => s.list)
  const listTotal = useProjectsStore((s) => s.listTotal)
  const isLoading = useProjectsStore((s) => s.listLoading)
  const listError = useProjectsStore((s) => s.listError)
  const loadProjects = useProjectsStore((s) => s.loadProjects)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ProjectType | ''>('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('')

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    void loadProjects({
      search: value || undefined,
      project_type: typeFilter || undefined,
      status: statusFilter || undefined,
    })
  }, [typeFilter, statusFilter, loadProjects])

  const handleTypeFilter = useCallback((value: ProjectType | '') => {
    setTypeFilter(value)
    void loadProjects({
      search: search || undefined,
      project_type: value || undefined,
      status: statusFilter || undefined,
    })
  }, [search, statusFilter, loadProjects])

  const handleStatusFilter = useCallback((value: ProjectStatus | '') => {
    setStatusFilter(value)
    void loadProjects({
      search: search || undefined,
      project_type: typeFilter || undefined,
      status: value || undefined,
    })
  }, [search, typeFilter, loadProjects])

  useEffect(() => {
    void loadProjects({ order_by: 'updated_at', order_dir: 'desc', limit: 100 })
  }, [loadProjects])

  if (isLoading && list.length === 0) {
    return (
      <div className="fm-loading">
        <span className="fm-loading-spinner" aria-hidden="true" />
        Carregando projetos…
      </div>
    )
  }

  if (listError && list.length === 0) {
    return <SectionError message={listError} onRetry={() => void loadProjects()} />
  }

  return (
    <div className="fm-projects">
      <div className="fm-real-projects-header">
        <div className="fm-filters">
          <input
            type="search"
            className="fm-filter-input"
            placeholder="Buscar nome, CPF/CNPJ, cidade…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <select
            className="fm-filter-select"
            value={typeFilter}
            onChange={(e) => handleTypeFilter(e.target.value as ProjectType | '')}
          >
            <option value="">Todos os tipos</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>{PROJECT_TYPE_LABELS_TAB[t]}</option>
            ))}
          </select>
          <select
            className="fm-filter-select"
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value as ProjectStatus | '')}
          >
            <option value="">Todos os status</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <span className="fm-real-projects-meta">
          {listTotal > 0 ? `${listTotal} projeto${listTotal !== 1 ? 's' : ''}` : null}
        </span>
      </div>
      {list.length === 0 ? (
        <div className="fm-empty">Nenhum projeto encontrado com os filtros aplicados.</div>
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>CPF / CNPJ</th>
                <th>Cidade / UF</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const locationLabel =
                  p.city_snapshot && p.state_snapshot
                    ? `${p.city_snapshot} / ${p.state_snapshot}`
                    : p.city_snapshot ?? p.state_snapshot ?? '—'
                const updatedAt = p.updated_at
                  ? new Date(p.updated_at).toLocaleDateString('pt-BR')
                  : '—'
                return (
                  <tr key={p.id}>
                    <td className="fm-td-link">
                      <button type="button" onClick={() => onOpenProject(p.id)}>
                        {p.client_name_snapshot ?? '—'}
                      </button>
                    </td>
                    <td>{p.cpf_cnpj_snapshot ?? '—'}</td>
                    <td>{locationLabel}</td>
                    <td>
                      <span className={`fm-badge fm-badge--${p.project_type}`}>
                        {PROJECT_TYPE_LABELS_TAB[p.project_type] ?? p.project_type}
                      </span>
                    </td>
                    <td>
                      <span className={STATUS_BADGE_CLASS_TAB[p.status] ?? 'fm-badge'}>
                        {p.status}
                      </span>
                    </td>
                    <td>{updatedAt}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cashflow Tab
// ─────────────────────────────────────────────────────────────────────────────

function CashflowTab({ cashflow, error, onRetry }: { cashflow: CashflowPeriod[]; error: string | null; onRetry: () => void }) {
  if (error) return <SectionError message={error} onRetry={onRetry} />
  return (
    <div className="fm-cashflow">
      {cashflow.length === 0 ? (
        <div className="fm-empty">Sem dados de fluxo de caixa para exibir.</div>
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Período</th>
                <th>Entradas</th>
                <th>Saídas</th>
                <th>Saldo Líquido</th>
                <th>Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {cashflow.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.period_label}</td>
                  <td className="fm-value--positive">{formatCurrencyBRL(row.total_income)}</td>
                  <td className="fm-value--negative">{formatCurrencyBRL(row.total_expense)}</td>
                  <td className={row.net >= 0 ? 'fm-value--positive' : 'fm-value--negative'}>
                    {formatCurrencyBRL(row.net)}
                  </td>
                  <td className={row.cumulative >= 0 ? 'fm-value--positive' : 'fm-value--negative'}>
                    {formatCurrencyBRL(row.cumulative)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Leasing Tab
// ─────────────────────────────────────────────────────────────────────────────

function LeasingTab({ projects, error, onRetry }: { projects: FinancialProject[]; error: string | null; onRetry: () => void }) {
  // Load real leasing projects from store as fallback when snapshots are empty.
  const loadProjects = useProjectsStore((s) => s.loadProjects)
  const realProjects = useProjectsStore((s) => s.list)

  useEffect(() => {
    if (projects.length === 0 && !error) {
      void loadProjects({ project_type: 'leasing', order_by: 'updated_at', order_dir: 'desc', limit: 100 })
    }
  }, [projects.length, error, loadProjects])

  // useMemo must be called before any conditional return to satisfy Rules of Hooks.
  const leasingProjects = useMemo(() => (error ? [] : projects.filter((p) => p.project_kind === 'leasing')), [projects, error])
  const realLeasingProjects = useMemo(() => realProjects.filter((p) => p.project_type === 'leasing'), [realProjects])

  const totals = useMemo(() => {
    const totalMrr = leasingProjects.reduce((sum, p) => sum + (p.monthly_revenue ?? 0), 0)
    const totalProjectedRevenue = leasingProjects.reduce((sum, p) => sum + (p.projected_revenue ?? 0), 0)
    const totalCapex = leasingProjects.reduce((sum, p) => sum + (p.capex_total ?? 0), 0)
    const avgRoi = leasingProjects.length > 0
      ? leasingProjects.reduce((sum, p) => sum + (p.roi_percent ?? 0), 0) / leasingProjects.length
      : null
    const avgPayback = leasingProjects.length > 0
      ? leasingProjects.reduce((sum, p) => sum + (p.payback_months ?? 0), 0) / leasingProjects.length
      : null
    return { totalMrr, totalProjectedRevenue, totalCapex, avgRoi, avgPayback }
  }, [leasingProjects])

  if (error) return <SectionError message={error} onRetry={onRetry} />

  // When no financial snapshots exist, render a basic table from the projects store.
  if (leasingProjects.length === 0) {
    if (realLeasingProjects.length === 0) {
      return <div className="fm-empty">Nenhum projeto de leasing disponível.</div>
    }
    return (
      <div className="fm-leasing">
        <div className="fm-kpi-grid">
          <KpiCard label="Projetos Leasing" value={String(realLeasingProjects.length)} icon="📋" />
        </div>
        <p className="fm-empty" style={{ fontSize: 13, marginBottom: 8 }}>
          Dados financeiros detalhados ainda não disponíveis. Exibindo projetos cadastrados.
        </p>
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>CPF / CNPJ</th>
                <th>Cidade / UF</th>
                <th>Status</th>
                <th>Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {realLeasingProjects.map((p) => (
                <tr key={p.id}>
                  <td>{p.client_name_snapshot ?? '—'}</td>
                  <td>{p.cpf_cnpj_snapshot ?? '—'}</td>
                  <td>
                    {p.city_snapshot && p.state_snapshot
                      ? `${p.city_snapshot} / ${p.state_snapshot}`
                      : p.city_snapshot ?? p.state_snapshot ?? '—'}
                  </td>
                  <td>
                    <span className={STATUS_BADGE_CLASS_TAB[p.status] ?? 'fm-badge'}>{p.status}</span>
                  </td>
                  <td>{p.updated_at ? new Date(p.updated_at).toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="fm-leasing">
      <div className="fm-kpi-grid">
        <KpiCard label="Contratos Ativos" value={String(leasingProjects.length)} icon="📋" />
        <KpiCard label="MRR Total" value={formatCurrencyBRL(totals.totalMrr)} icon="🔄" color="green" subtitle="Mensalidade recorrente" />
        <KpiCard label="Receita Proj. Total" value={formatCurrencyBRL(totals.totalProjectedRevenue)} icon="📈" color="green" />
        <KpiCard label="CAPEX Total" value={formatCurrencyBRL(totals.totalCapex)} icon="💸" color="red" />
        <KpiCard label="ROI Médio" value={formatPct(totals.avgRoi)} icon="📊" />
        <KpiCard label="Payback Médio" value={formatMonths(totals.avgPayback)} icon="⏱️" />
      </div>
      <div className="fm-table-wrapper">
        <table className="fm-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Mensalidade</th>
              <th>Receita Proj.</th>
              <th>CAPEX</th>
              <th>ROI</th>
              <th>Payback</th>
              <th>Inadimpl.</th>
              <th>Status</th>
              <th>UF</th>
            </tr>
          </thead>
          <tbody>
            {leasingProjects.map((p) => (
              <tr key={p.id}>
                <td>{p.client_name ?? '—'}</td>
                <td>{formatCurrencyBRL(p.monthly_revenue)}</td>
                <td>{formatCurrencyBRL(p.projected_revenue)}</td>
                <td>{formatCurrencyBRL(p.capex_total)}</td>
                <td>{formatPct(p.roi_percent)}</td>
                <td>{formatMonths(p.payback_months)}</td>
                <td>{formatPct(p.default_rate_percent)}</td>
                <td>{p.status ?? '—'}</td>
                <td>{p.uf ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales Tab
// ─────────────────────────────────────────────────────────────────────────────

function SalesTab({ projects, error, onRetry }: { projects: FinancialProject[]; error: string | null; onRetry: () => void }) {
  // Load real venda projects from store as fallback when snapshots are empty.
  const loadProjects = useProjectsStore((s) => s.loadProjects)
  const realProjects = useProjectsStore((s) => s.list)

  useEffect(() => {
    if (projects.length === 0 && !error) {
      void loadProjects({ project_type: 'venda', order_by: 'updated_at', order_dir: 'desc', limit: 100 })
    }
  }, [projects.length, error, loadProjects])

  // useMemo must be called before any conditional return to satisfy Rules of Hooks.
  const saleProjects = useMemo(() => (error ? [] : projects.filter((p) => p.project_kind === 'sale' || p.project_kind === 'buyout')), [projects, error])
  const realVendaProjects = useMemo(() => realProjects.filter((p) => p.project_type === 'venda'), [realProjects])

  const totals = useMemo(() => {
    const totalRevenue = saleProjects.reduce((sum, p) => sum + (p.realized_revenue ?? p.projected_revenue ?? 0), 0)
    const totalCapex = saleProjects.reduce((sum, p) => sum + (p.capex_total ?? 0), 0)
    const totalProfit = saleProjects.reduce((sum, p) => sum + (p.projected_profit ?? 0), 0)
    const avgMargin = saleProjects.length > 0
      ? saleProjects.reduce((sum, p) => sum + (p.roi_percent ?? 0), 0) / saleProjects.length
      : null
    const ticketMedio = saleProjects.length > 0 ? totalRevenue / saleProjects.length : null
    return { totalRevenue, totalCapex, totalProfit, avgMargin, ticketMedio }
  }, [saleProjects])

  if (error) return <SectionError message={error} onRetry={onRetry} />

  // When no financial snapshots exist, render a basic table from the projects store.
  if (saleProjects.length === 0) {
    if (realVendaProjects.length === 0) {
      return <div className="fm-empty">Nenhum projeto de venda disponível.</div>
    }
    return (
      <div className="fm-sales">
        <div className="fm-kpi-grid">
          <KpiCard label="Projetos Venda" value={String(realVendaProjects.length)} icon="🤝" />
        </div>
        <p className="fm-empty" style={{ fontSize: 13, marginBottom: 8 }}>
          Dados financeiros detalhados ainda não disponíveis. Exibindo projetos cadastrados.
        </p>
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>CPF / CNPJ</th>
                <th>Cidade / UF</th>
                <th>Status</th>
                <th>Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {realVendaProjects.map((p) => (
                <tr key={p.id}>
                  <td>{p.client_name_snapshot ?? '—'}</td>
                  <td>{p.cpf_cnpj_snapshot ?? '—'}</td>
                  <td>
                    {p.city_snapshot && p.state_snapshot
                      ? `${p.city_snapshot} / ${p.state_snapshot}`
                      : p.city_snapshot ?? p.state_snapshot ?? '—'}
                  </td>
                  <td>
                    <span className={STATUS_BADGE_CLASS_TAB[p.status] ?? 'fm-badge'}>{p.status}</span>
                  </td>
                  <td>{p.updated_at ? new Date(p.updated_at).toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="fm-sales">
      <div className="fm-kpi-grid">
        <KpiCard label="Vendas Realizadas" value={String(saleProjects.length)} icon="🤝" />
        <KpiCard label="Receita Total" value={formatCurrencyBRL(totals.totalRevenue)} icon="💵" color="green" />
        <KpiCard label="CAPEX Total" value={formatCurrencyBRL(totals.totalCapex)} icon="💸" color="red" />
        <KpiCard label="Lucro Total" value={formatCurrencyBRL(totals.totalProfit)} icon="💰" color={totals.totalProfit >= 0 ? 'green' : 'red'} />
        <KpiCard label="Margem Média" value={formatPct(totals.avgMargin)} icon="📊" />
        <KpiCard label="Ticket Médio" value={formatCurrencyBRL(totals.ticketMedio)} icon="🎫" />
      </div>
      <div className="fm-table-wrapper">
        <table className="fm-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Receita</th>
              <th>CAPEX</th>
              <th>Lucro Est.</th>
              <th>Margem</th>
              <th>Comissão</th>
              <th>Status</th>
              <th>UF</th>
            </tr>
          </thead>
          <tbody>
            {saleProjects.map((p) => (
              <tr key={p.id}>
                <td>{p.client_name ?? '—'}</td>
                <td>
                  <span className={`fm-badge fm-badge--${p.project_kind}`}>
                    {PROJECT_KIND_LABELS[p.project_kind] ?? p.project_kind}
                  </span>
                </td>
                <td>{formatCurrencyBRL(p.realized_revenue ?? p.projected_revenue)}</td>
                <td>{formatCurrencyBRL(p.capex_total)}</td>
                <td>{formatCurrencyBRL(p.projected_profit)}</td>
                <td>{formatPct(p.roi_percent)}</td>
                <td>{formatCurrencyBRL(p.commission_amount)}</td>
                <td>{p.status ?? '—'}</td>
                <td>{p.uf ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Faturas a Pagar Tab — Consolidated invoice tracking for all SolarInvest-owned accounts
// ─────────────────────────────────────────────────────────────────────────────
function FaturasAPagarTab() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load all clients with is_contratante_titular = false
  useEffect(() => {
    async function loadClients() {
      setLoading(true)
      setError(null)
      try {
        const allClients = await fetchPortfolioClients()
        // Filter clients where titularidade is with SolarInvest
        const solarInvestClients = allClients.filter((c) => c.is_contratante_titular === false)
        setClients(solarInvestClients)
      } catch (err) {
        console.error('[faturas-a-pagar] load error', err)
        setError(err instanceof Error ? err.message : 'Erro ao carregar faturas')
      } finally {
        setLoading(false)
      }
    }
    void loadClients()
  }, [])

  // Flatten all installments from all clients
  const allInvoices = useMemo(() => {
    const invoices: Array<{
      clientId: number
      clientName: string
      installmentNumber: number
      dueDate: Date
      amount: number
      status: string
      isPaid: boolean
    }> = []

    clients.forEach((client) => {
      if (!client.installments_json) return
      client.installments_json.forEach((inst: any) => {
        // Calculate due date based on installment number and billing start
        const termMonths = client.contractual_term_months ?? client.term_months ?? 0
        if (termMonths === 0) return

        // Estimate due date (simplified - should use billing dates engine in production)
        const startDate = client.commissioning_date_billing || client.commissioning_date
        if (!startDate) return

        const dueDay = client.due_day ?? 5
        const start = new Date(startDate)
        const dueDate = new Date(start.getFullYear(), start.getMonth() + inst.number, dueDay)

        invoices.push({
          clientId: client.id,
          clientName: client.name ?? `Cliente #${client.id}`,
          installmentNumber: inst.number,
          dueDate,
          amount: client.valor_mensalidade ?? 0,
          status: inst.status ?? 'pendente',
          isPaid: inst.status === 'confirmado' || inst.status === 'pago',
        })
      })
    })

    // Sort by due date (nearest first)
    return invoices.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  }, [clients])

  // Filter to show only upcoming and overdue
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const relevantInvoices = allInvoices.filter((inv) => {
    const due = new Date(inv.dueDate)
    due.setHours(0, 0, 0, 0)
    // Show if not paid or if due within next 30 days
    return !inv.isPaid || due >= today
  })

  // Group by status
  const overdue = relevantInvoices.filter((inv) => {
    const due = new Date(inv.dueDate)
    due.setHours(0, 0, 0, 0)
    return !inv.isPaid && due < today
  })
  const dueThisMonth = relevantInvoices.filter((inv) => {
    const due = new Date(inv.dueDate)
    due.setHours(0, 0, 0, 0)
    const nextMonth = new Date(today)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    return !inv.isPaid && due >= today && due < nextMonth
  })

  if (loading) {
    return <div className="fm-empty">Carregando faturas a pagar...</div>
  }

  if (error) {
    return <SectionError message={error} onRetry={() => window.location.reload()} />
  }

  if (clients.length === 0) {
    return (
      <div className="fm-empty">
        Nenhum cliente com titularidade da SolarInvest encontrado.
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
        Faturas sob responsabilidade da SolarInvest ({clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}).
        Estas faturas devem ser monitoradas mensalmente para garantir pagamento à distribuidora.
      </p>

      {/* Summary cards */}
      <div className="fm-kpi-grid" style={{ marginBottom: 24 }}>
        <KpiCard
          label="Vencidas"
          value={String(overdue.length)}
          icon="⚠️"
          color={overdue.length > 0 ? 'red' : 'green'}
          subtitle={overdue.length > 0 ? formatCurrencyBRL(overdue.reduce((sum, inv) => sum + inv.amount, 0)) : undefined}
        />
        <KpiCard
          label="Vencem este Mês"
          value={String(dueThisMonth.length)}
          icon="📅"
          color="yellow"
          subtitle={dueThisMonth.length > 0 ? formatCurrencyBRL(dueThisMonth.reduce((sum, inv) => sum + inv.amount, 0)) : undefined}
        />
        <KpiCard
          label="Total Pendente"
          value={String(relevantInvoices.filter(i => !i.isPaid).length)}
          icon="💰"
          subtitle={formatCurrencyBRL(relevantInvoices.filter(i => !i.isPaid).reduce((sum, inv) => sum + inv.amount, 0))}
        />
      </div>

      {/* Invoice table */}
      <div className="fm-table-container">
        <table className="fm-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Parcela</th>
              <th>Vencimento</th>
              <th className="right">Valor</th>
              <th className="center">Status</th>
              <th className="center">Dias</th>
            </tr>
          </thead>
          <tbody>
            {relevantInvoices.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhuma fatura pendente
                </td>
              </tr>
            ) : (
              relevantInvoices.map((inv, idx) => {
                const due = new Date(inv.dueDate)
                due.setHours(0, 0, 0, 0)
                const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                const isOverdue = diffDays < 0
                const isDueToday = diffDays === 0

                return (
                  <tr key={`${inv.clientId}-${inv.installmentNumber}`}>
                    <td>{inv.clientName}</td>
                    <td>#{inv.installmentNumber}</td>
                    <td>
                      {inv.dueDate.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="right">{formatCurrencyBRL(inv.amount)}</td>
                    <td className="center">
                      {inv.isPaid ? (
                        <span className="fm-badge fm-badge--success">✓ Paga</span>
                      ) : isOverdue ? (
                        <span className="fm-badge fm-badge--danger">Vencida</span>
                      ) : isDueToday ? (
                        <span className="fm-badge fm-badge--warning">Vence Hoje</span>
                      ) : (
                        <span className="fm-badge">Pendente</span>
                      )}
                    </td>
                    <td className="center" style={{
                      color: isOverdue ? 'var(--color-danger)' : isDueToday ? 'var(--color-warning)' : 'var(--text-muted)'
                    }}>
                      {isOverdue ? `${Math.abs(diffDays)}d atrás` : isDueToday ? 'Hoje' : `${diffDays}d`}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function FinancialManagementPage({ onBack, initialProjectId, initialTab }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'overview')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('year')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)

  // Sub-navigation: drill into a project detail without leaving the financial page.
  const [detailProjectId, setDetailProjectId] = useState<string | null>(initialProjectId ?? null)

  // When arriving with an initialProjectId, jump straight to the projects tab.
  useEffect(() => {
    if (initialProjectId) {
      setActiveTab('projects')
    }
  }, [initialProjectId])

  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const [projects, setProjects] = useState<FinancialProject[]>([])
  const [projectsError, setProjectsError] = useState<string | null>(null)

  const [cashflow, setCashflow] = useState<CashflowPeriod[]>([])
  const [cashflowError, setCashflowError] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(true)

  const getPeriodParams = useCallback(() => {
    const now = new Date()
    if (periodFilter === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10)
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10)
      return { from, to }
    }
    if (periodFilter === 'quarter') {
      const q = Math.floor(now.getMonth() / 3)
      const from = new Date(now.getFullYear(), q * 3, 1).toISOString().substring(0, 10)
      const to = new Date(now.getFullYear(), q * 3 + 3, 0).toISOString().substring(0, 10)
      return { from, to }
    }
    if (periodFilter === 'custom') {
      return { from: customFrom || undefined, to: customTo || undefined }
    }
    // year
    const from = new Date(now.getFullYear(), 0, 1).toISOString().substring(0, 10)
    const to = new Date(now.getFullYear(), 11, 31).toISOString().substring(0, 10)
    return { from, to }
  }, [periodFilter, customFrom, customTo])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    // Clear per-section errors before reload
    setSummaryError(null)
    setProjectsError(null)
    setCashflowError(null)

    const params = getPeriodParams()

    // Load each section independently so one failure doesn't break the whole page
    const [summaryRes, projectsRes, cashflowRes] = await Promise.allSettled([
      fetchFinancialSummary(params),
      fetchFinancialProjects(params),
      fetchFinancialCashflow(params),
    ])

    if (summaryRes.status === 'fulfilled') {
      setSummary(summaryRes.value)
    } else {
      console.error('[financial-management] summary error', summaryRes.reason)
      setSummaryError(summaryRes.reason instanceof Error ? summaryRes.reason.message : 'Erro ao carregar indicadores.')
    }

    if (projectsRes.status === 'fulfilled') {
      setProjects(projectsRes.value)
    } else {
      console.error('[financial-management] projects error', projectsRes.reason)
      setProjectsError(projectsRes.reason instanceof Error ? projectsRes.reason.message : 'Erro ao carregar projetos.')
    }

    if (cashflowRes.status === 'fulfilled') {
      setCashflow(cashflowRes.value)
    } else {
      console.error('[financial-management] cashflow error', cashflowRes.reason)
      setCashflowError(cashflowRes.reason instanceof Error ? cashflowRes.reason.message : 'Erro ao carregar fluxo de caixa.')
    }

    setIsLoading(false)
  }, [getPeriodParams])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const TABS: Tab[] = ['overview', 'projects', 'cashflow', 'leasing', 'sales', 'faturas']

  // ── Project detail sub-view ──────────────────────────────────────────────
  if (detailProjectId !== null) {
    return (
      <ProjectDetailPage
        projectId={detailProjectId}
        onBack={() => setDetailProjectId(null)}
      />
    )
  }

  return (
    <div className="fm-page">
      {showImportModal && (
        <FinancialImportModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => { void loadData() }}
        />
      )}
      {/* Header */}
      <div className="fm-page-header">
        <div className="fm-page-header-left">
          <button type="button" className="ghost fm-back-btn" onClick={onBack}>
            ← Voltar
          </button>
          <div>
            <h1 className="fm-page-title">💰 Gestão Financeira</h1>
            <p className="fm-page-subtitle">Central de monitoramento e análise financeira da SolarInvest</p>
          </div>
        </div>
        <div className="fm-page-header-right">
          <button
            type="button"
            className="primary fm-import-btn"
            onClick={() => {
              console.log('[fm-import] button clicked — opening modal')
              setShowImportModal(true)
            }}
            title="Importar dados via planilha Excel (.xlsx)"
          >
            📥 Importar Excel
          </button>
          <div className="fm-period-filters">
            {(['month', 'quarter', 'year', 'custom'] as PeriodFilter[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`fm-period-btn${periodFilter === p ? ' active' : ''}`}
                onClick={() => setPeriodFilter(p)}
              >
                {p === 'month' ? 'Mês' : p === 'quarter' ? 'Trimestre' : p === 'year' ? 'Ano' : 'Personalizado'}
              </button>
            ))}
          </div>
          {periodFilter === 'custom' ? (
            <div className="fm-custom-period">
              <input
                type="date"
                className="fm-filter-input"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="Data inicial"
              />
              <span>até</span>
              <input
                type="date"
                className="fm-filter-input"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="Data final"
              />
              <button type="button" className="primary" onClick={() => void loadData()}>
                Aplicar
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="fm-tab-bar" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`fm-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="fm-tab-content" role="tabpanel">
        {isLoading ? (
          <div className="fm-loading">
            <span className="fm-loading-spinner" aria-hidden="true" />
            Carregando dados financeiros…
          </div>
        ) : (
          <>
            {activeTab === 'overview' && <OverviewTab summary={summary} error={summaryError} onRetry={() => void loadData()} />}
            {activeTab === 'projects' && <RealProjectsTab onOpenProject={(id) => setDetailProjectId(id)} />}
            {activeTab === 'cashflow' && <CashflowTab cashflow={cashflow} error={cashflowError} onRetry={() => void loadData()} />}
            {activeTab === 'leasing' && <LeasingTab projects={projects} error={projectsError} onRetry={() => void loadData()} />}
            {activeTab === 'sales' && <SalesTab projects={projects} error={projectsError} onRetry={() => void loadData()} />}
            {activeTab === 'faturas' && <FaturasAPagarTab />}
          </>
        )}
      </div>
    </div>
  )
}
