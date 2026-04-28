// src/features/relatorios/RelatoriosPage.tsx
// Área Relatórios (Etapa 9) — UI-only page.
// Reuses existing API clients. Does NOT alter DB, calculation engines, or business rules.
// Five report tabs: Propostas / Contratos / Financeiro / Clientes / Operação.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listProposals,
  type ProposalRow,
  type ProposalStatus,
  type ProposalType,
} from '../../lib/api/proposalsApi'
import {
  listClients,
  type ClientRow,
} from '../../lib/api/clientsApi'
import { listOperationalTasks } from '../../lib/api/operationalDashboardApi'
import { fetchProjects } from '../../services/projectsApi'
import { listProjectCharges } from '../projectHub/projectChargesApi'
import type { ProjectMonthlyCharge } from '../projectHub/projectChargesTypes'
import type { ProjectRow } from '../../domain/projects/types'
import { hasPermission, type UserRole } from '../auth/permissions'
import { NoPermissionPage } from '../../pages/NoPermissionPage'
import type { DashboardOperationalTask } from '../../types/operationalDashboard'
import type { RelatoriosTab } from './reportTypes'
import { RELATORIOS_TAB_LABELS } from './reportTypes'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface RelatoriosPageProps {
  /** Which tab to show on initial render. Controlled by the sidebar navigation. */
  tab: RelatoriosTab
  onTabChange: (tab: RelatoriosTab) => void
  userRole: UserRole
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtBRL(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parts = value.slice(0, 10).split('-').map(Number)
  if (parts.length < 3) return '—'
  const date = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1)
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR')
}

function fmtMonth(value: string | null | undefined): string {
  if (!value) return '—'
  const parts = value.slice(0, 7).split('-').map(Number)
  if (parts.length < 2) return '—'
  const date = new Date(parts[0]!, parts[1]! - 1, 1)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function isWithinPeriod(dateStr: string | null | undefined, from: string, to: string): boolean {
  if (!dateStr) return true
  const d = dateStr.slice(0, 10)
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

/** Convert an array of objects to a CSV blob URL. */
function buildCsvUrl(rows: Record<string, string | number | null | undefined>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0]!)
  const lines = [
    headers.join(';'),
    ...rows.map((row) =>
      headers.map((h) => {
        const v = row[h]
        if (v == null) return ''
        const s = String(v)
        // Escape double-quotes and wrap cells containing separator/newline
        if (s.includes(';') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`
        }
        return s
      }).join(';'),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  return URL.createObjectURL(blob)
}

function downloadCsv(filename: string, rows: Record<string, string | number | null | undefined>[]): void {
  if (rows.length === 0) return
  const url = buildCsvUrl(rows)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="fm-project-section-placeholder" role="status" aria-live="polite">
      <span>Carregando...</span>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="fm-project-section-placeholder" role="alert">
      <p style={{ color: 'var(--color-danger, #ef4444)' }}>Erro ao carregar dados: {message}</p>
      <button type="button" className="fm-btn fm-btn--secondary" onClick={onRetry} style={{ marginTop: '0.5rem' }}>
        Tentar novamente
      </button>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="fm-project-section-placeholder">
      <p>{message}</p>
    </div>
  )
}

function PeriodFilterBar({
  from,
  to,
  onFromChange,
  onToChange,
  extraFilters,
}: {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  extraFilters?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'flex-end',
        marginBottom: '1rem',
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
        De
        <input
          type="date"
          value={from}
          onChange={(e) => { onFromChange(e.target.value) }}
          className="fm-input"
          style={{ padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-color, #d1d5db)' }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
        Até
        <input
          type="date"
          value={to}
          onChange={(e) => { onToChange(e.target.value) }}
          className="fm-input"
          style={{ padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-color, #d1d5db)' }}
        />
      </label>
      {extraFilters}
    </div>
  )
}

function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="fm-btn fm-btn--secondary"
      onClick={onClick}
      disabled={disabled}
      style={{ marginBottom: '1rem' }}
      title={disabled ? 'Sem dados para exportar' : 'Exportar como CSV'}
    >
      ⬇️ Exportar CSV
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Propostas
// ─────────────────────────────────────────────────────────────────────────────

const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  approved: 'Aprovada',
  rejected: 'Recusada',
  cancelled: 'Cancelada',
}

const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  leasing: 'Leasing',
  venda: 'Venda',
}

function PropostasTab() {
  const [rows, setRows] = useState<ProposalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<ProposalType | 'all'>('all')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        // Fetch up to 500 proposals — sufficient for current scale
        const result = await listProposals({ limit: 500 })
        if (!cancelled) setRows(result.data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar propostas.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [tick])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!isWithinPeriod(r.created_at, from, to)) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (typeFilter !== 'all' && r.proposal_type !== typeFilter) return false
      return true
    })
  }, [rows, from, to, statusFilter, typeFilter])

  const handleExport = useCallback(() => {
    const csvRows = filtered.map((r) => ({
      Código: r.proposal_code ?? '',
      Tipo: PROPOSAL_TYPE_LABELS[r.proposal_type],
      Status: PROPOSAL_STATUS_LABELS[r.status],
      Cliente: r.client_name ?? '',
      Cidade: r.client_city ?? '',
      UF: r.client_state ?? '',
      'Sistema (kWp)': r.system_kwp ?? '',
      'CAPEX (R$)': r.capex_total ?? '',
      'Criado em': fmtDate(r.created_at),
    }))
    downloadCsv('relatorio-propostas.csv', csvRows)
  }, [filtered])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => { setTick((t) => t + 1) }} />

  return (
    <div>
      <PeriodFilterBar
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        extraFilters={
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
              Status
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as ProposalStatus | 'all') }}
                style={{ padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-color, #d1d5db)' }}
              >
                <option value="all">Todos</option>
                {(Object.keys(PROPOSAL_STATUS_LABELS) as ProposalStatus[]).map((s) => (
                  <option key={s} value={s}>{PROPOSAL_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
              Tipo
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value as ProposalType | 'all') }}
                style={{ padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-color, #d1d5db)' }}
              >
                <option value="all">Todos</option>
                <option value="leasing">Leasing</option>
                <option value="venda">Venda</option>
              </select>
            </label>
          </>
        }
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #6b7280)' }}>
          {filtered.length} proposta{filtered.length !== 1 ? 's' : ''}
        </span>
        <ExportButton onClick={handleExport} disabled={filtered.length === 0} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState message="Nenhuma proposta encontrada com os filtros aplicados." />
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Cliente</th>
                <th>Cidade / UF</th>
                <th>Sistema (kWp)</th>
                <th>CAPEX</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.proposal_code ?? '—'}</td>
                  <td>{PROPOSAL_TYPE_LABELS[r.proposal_type]}</td>
                  <td>
                    <span className={`fm-badge${r.status === 'approved' ? ' fm-badge--status-paid' : r.status === 'rejected' || r.status === 'cancelled' ? ' fm-badge--status-cancelled' : ' fm-badge--status-planned'}`}>
                      {PROPOSAL_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td>{r.client_name ?? '—'}</td>
                  <td>{[r.client_city, r.client_state].filter(Boolean).join(' / ') || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.system_kwp != null ? r.system_kwp.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(r.capex_total)}</td>
                  <td>{fmtDate(r.created_at)}</td>
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
// Tab: Contratos (propostas com status 'approved')
// ─────────────────────────────────────────────────────────────────────────────

function ContratosTab() {
  const [rows, setRows] = useState<ProposalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [typeFilter, setTypeFilter] = useState<ProposalType | 'all'>('all')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const result = await listProposals({ limit: 500, status: 'approved' })
        if (!cancelled) setRows(result.data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar contratos.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [tick])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!isWithinPeriod(r.updated_at, from, to)) return false
      if (typeFilter !== 'all' && r.proposal_type !== typeFilter) return false
      return true
    })
  }, [rows, from, to, typeFilter])

  const handleExport = useCallback(() => {
    const csvRows = filtered.map((r) => ({
      Código: r.proposal_code ?? '',
      Tipo: PROPOSAL_TYPE_LABELS[r.proposal_type],
      Cliente: r.client_name ?? '',
      Documento: r.client_document ?? '',
      Cidade: r.client_city ?? '',
      UF: r.client_state ?? '',
      'Sistema (kWp)': r.system_kwp ?? '',
      'Prazo (meses)': r.term_months ?? '',
      'Valor contrato (R$)': r.contract_value ?? '',
      'Assinado em': fmtDate(r.updated_at),
    }))
    downloadCsv('relatorio-contratos.csv', csvRows)
  }, [filtered])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => { setTick((t) => t + 1) }} />

  return (
    <div>
      <PeriodFilterBar
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        extraFilters={
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
            Tipo
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as ProposalType | 'all') }}
              style={{ padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-color, #d1d5db)' }}
            >
              <option value="all">Todos</option>
              <option value="leasing">Leasing</option>
              <option value="venda">Venda</option>
            </select>
          </label>
        }
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #6b7280)' }}>
          {filtered.length} contrato{filtered.length !== 1 ? 's' : ''}
        </span>
        <ExportButton onClick={handleExport} disabled={filtered.length === 0} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState message="Nenhum contrato assinado encontrado com os filtros aplicados." />
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Cidade / UF</th>
                <th>Sistema (kWp)</th>
                <th>Prazo</th>
                <th>Valor contrato</th>
                <th>Assinado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.proposal_code ?? '—'}</td>
                  <td>{PROPOSAL_TYPE_LABELS[r.proposal_type]}</td>
                  <td>{r.client_name ?? '—'}</td>
                  <td>{[r.client_city, r.client_state].filter(Boolean).join(' / ') || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.system_kwp != null ? r.system_kwp.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—'}</td>
                  <td>{r.term_months != null ? `${r.term_months} meses` : '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(r.contract_value)}</td>
                  <td>{fmtDate(r.updated_at)}</td>
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
// Tab: Financeiro (mensalidades de todos os projetos)
// ─────────────────────────────────────────────────────────────────────────────

type ChargeStatus = 'prevista' | 'emitida' | 'paga' | 'vencida' | 'cancelada' | 'all'

const CHARGE_STATUS_LABELS: Record<Exclude<ChargeStatus, 'all'>, string> = {
  prevista: 'Prevista',
  emitida: 'Emitida',
  paga: 'Paga',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
}

interface EnrichedCharge extends ProjectMonthlyCharge {
  client_name: string
}

function useCharges(): { charges: EnrichedCharge[]; loading: boolean; error: string | null; reload: () => void } {
  const [charges, setCharges] = useState<EnrichedCharge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const { rows: projects } = await fetchProjects({ limit: 500 })
        const leasingProjects = projects.filter(
          (p: ProjectRow) => p.project_type === 'leasing' && p.deleted_at == null,
        )

        const results = await Promise.all(
          leasingProjects.map(async (project: ProjectRow) => {
            try {
              const projectCharges = await listProjectCharges(project.id)
              return projectCharges.map(
                (c): EnrichedCharge => ({
                  ...c,
                  client_name: project.client_name_snapshot ?? `Cliente #${project.client_id}`,
                }),
              )
            } catch {
              return [] as EnrichedCharge[]
            }
          }),
        )

        if (!cancelled) setCharges(results.flat())
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar mensalidades.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [tick])

  return { charges, loading, error, reload: () => { setTick((t) => t + 1) } }
}

function FinanceiroTab() {
  const { charges, loading, error, reload } = useCharges()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<ChargeStatus>('all')

  const filtered = useMemo(() => {
    return charges.filter((c) => {
      if (!isWithinPeriod(c.due_date, from, to)) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      return true
    })
  }, [charges, from, to, statusFilter])

  const handleExport = useCallback(() => {
    const csvRows = filtered.map((c) => ({
      Cliente: c.client_name,
      'Mês referência': fmtMonth(c.reference_month),
      'Vencimento': fmtDate(c.due_date),
      Status: CHARGE_STATUS_LABELS[c.status as Exclude<ChargeStatus, 'all'>] ?? c.status,
      'Valor previsto (R$)': c.valor_previsto ?? '',
      'Valor cobrado (R$)': c.valor_cobrado ?? '',
      'Valor pago (R$)': c.valor_pago ?? '',
      'Data pagamento': fmtDate(c.paid_at),
      'Nº recibo': c.receipt_number ?? '',
    }))
    downloadCsv('relatorio-financeiro.csv', csvRows)
  }, [filtered])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <PeriodFilterBar
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        extraFilters={
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
            Status
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as ChargeStatus) }}
              style={{ padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-color, #d1d5db)' }}
            >
              <option value="all">Todos</option>
              {(Object.keys(CHARGE_STATUS_LABELS) as Exclude<ChargeStatus, 'all'>[]).map((s) => (
                <option key={s} value={s}>{CHARGE_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
        }
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #6b7280)' }}>
          {filtered.length} mensalidade{filtered.length !== 1 ? 's' : ''}
        </span>
        <ExportButton onClick={handleExport} disabled={filtered.length === 0} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState message="Nenhuma mensalidade encontrada com os filtros aplicados." />
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Mês referência</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Valor previsto</th>
                <th>Valor pago</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>{c.client_name}</td>
                  <td>{fmtMonth(c.reference_month)}</td>
                  <td>{fmtDate(c.due_date)}</td>
                  <td>
                    <span className={`fm-badge${c.status === 'paga' ? ' fm-badge--status-paid' : c.status === 'vencida' ? ' fm-badge--status-due' : c.status === 'cancelada' ? ' fm-badge--status-cancelled' : ' fm-badge--status-planned'}`}>
                      {CHARGE_STATUS_LABELS[c.status as Exclude<ChargeStatus, 'all'>] ?? c.status}
                    </span>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(c.valor_previsto)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(c.valor_pago)}</td>
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
// Tab: Clientes
// ─────────────────────────────────────────────────────────────────────────────

function ClientesTab() {
  const [rows, setRows] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [portfolioFilter, setPortfolioFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const result = await listClients({ limit: 500 })
        if (!cancelled) setRows(result.data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar clientes.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [tick])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!isWithinPeriod(r.created_at, from, to)) return false
      if (portfolioFilter === 'active' && !r.in_portfolio) return false
      if (portfolioFilter === 'inactive' && r.in_portfolio) return false
      return true
    })
  }, [rows, from, to, portfolioFilter])

  const handleExport = useCallback(() => {
    const csvRows = filtered.map((r) => ({
      Nome: r.name ?? r.client_name ?? '',
      Documento: r.document ?? r.client_document ?? '',
      Cidade: r.city ?? r.client_city ?? '',
      UF: r.state ?? r.client_state ?? '',
      Telefone: r.phone ?? r.client_phone ?? '',
      Email: r.email ?? r.client_email ?? '',
      'Carteira ativa': r.in_portfolio ? 'Sim' : 'Não',
      'Criado em': fmtDate(r.created_at),
    }))
    downloadCsv('relatorio-clientes.csv', csvRows)
  }, [filtered])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => { setTick((t) => t + 1) }} />

  return (
    <div>
      <PeriodFilterBar
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        extraFilters={
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
            Carteira
            <select
              value={portfolioFilter}
              onChange={(e) => { setPortfolioFilter(e.target.value as 'all' | 'active' | 'inactive') }}
              style={{ padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-color, #d1d5db)' }}
            >
              <option value="all">Todos</option>
              <option value="active">Ativos (na carteira)</option>
              <option value="inactive">Não na carteira</option>
            </select>
          </label>
        }
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #6b7280)' }}>
          {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
        </span>
        <ExportButton onClick={handleExport} disabled={filtered.length === 0} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState message="Nenhum cliente encontrado com os filtros aplicados." />
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Documento</th>
                <th>Cidade / UF</th>
                <th>Telefone</th>
                <th>Carteira</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.name ?? r.client_name ?? '—'}</td>
                  <td>{r.document ?? r.client_document ?? '—'}</td>
                  <td>{[r.city ?? r.client_city, r.state ?? r.client_state].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{r.phone ?? r.client_phone ?? '—'}</td>
                  <td>
                    <span className={`fm-badge${r.in_portfolio ? ' fm-badge--status-paid' : ' fm-badge--status-planned'}`}>
                      {r.in_portfolio ? 'Ativo' : 'Não ativo'}
                    </span>
                  </td>
                  <td>{fmtDate(r.created_at)}</td>
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
// Tab: Operação (chamados, manutenções, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const TASK_TYPE_LABELS: Record<string, string> = {
  KIT_DELIVERY: 'Entrega de Kit',
  INSTALLATION: 'Instalação',
  TECH_SUPPORT: 'Suporte Técnico',
  DOCUMENTATION: 'Documentação',
  BILLING: 'Cobrança',
  COLLECTION: 'Coleta',
  GRID_APPROVAL: 'Aprovação de Rede',
  CLEANING: 'Limpeza',
  // Fallback legacy keys
  installation: 'Instalação',
  maintenance: 'Manutenção',
  cleaning: 'Limpeza',
  support: 'Chamado',
  delivery: 'Entrega',
  inspection: 'Inspeção',
  other: 'Outro',
}

const TASK_STATUS_LABELS: Record<string, string> = {
  NOT_SCHEDULED: 'Não agendado',
  SCHEDULED: 'Agendado',
  IN_PROGRESS: 'Em andamento',
  BLOCKED: 'Bloqueado',
  DONE: 'Concluído',
  CANCELLED: 'Cancelado',
  RESCHEDULE_REQUIRED: 'Reagendar',
  // Fallback legacy keys
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  blocked: 'Bloqueado',
}

function OperacaoTab() {
  const [rows, setRows] = useState<DashboardOperationalTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const result = await listOperationalTasks({ limit: 500 })
        if (!cancelled) setRows(result.data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar tarefas operacionais.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [tick])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const dateField = r.scheduledFor ?? r.updatedAt
      if (!isWithinPeriod(dateField, from, to)) return false
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      return true
    })
  }, [rows, from, to, typeFilter, statusFilter])

  const taskTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.type))), [rows])
  const taskStatuses = useMemo(() => Array.from(new Set(rows.map((r) => r.status))), [rows])

  const handleExport = useCallback(() => {
    const csvRows = filtered.map((r) => ({
      Título: r.title,
      Tipo: TASK_TYPE_LABELS[r.type] ?? r.type,
      Status: TASK_STATUS_LABELS[r.status] ?? r.status,
      Cliente: r.clientName,
      Prioridade: r.priority,
      'Agendado para': fmtDate(r.scheduledFor),
      'Concluído em': fmtDate(r.completedAt),
      Notas: r.notes ?? '',
    }))
    downloadCsv('relatorio-operacao.csv', csvRows)
  }, [filtered])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => { setTick((t) => t + 1) }} />

  return (
    <div>
      <PeriodFilterBar
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        extraFilters={
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
              Tipo
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value) }}
                style={{ padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-color, #d1d5db)' }}
              >
                <option value="all">Todos</option>
                {taskTypes.map((t) => (
                  <option key={t} value={t}>{TASK_TYPE_LABELS[t] ?? t}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
              Status
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value) }}
                style={{ padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-color, #d1d5db)' }}
              >
                <option value="all">Todos</option>
                {taskStatuses.map((s) => (
                  <option key={s} value={s}>{TASK_STATUS_LABELS[s] ?? s}</option>
                ))}
              </select>
            </label>
          </>
        }
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #6b7280)' }}>
          {filtered.length} tarefa{filtered.length !== 1 ? 's' : ''}
        </span>
        <ExportButton onClick={handleExport} disabled={filtered.length === 0} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState message="Nenhuma tarefa operacional encontrada com os filtros aplicados." />
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Cliente</th>
                <th>Prioridade</th>
                <th>Agendado para</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{TASK_TYPE_LABELS[r.type] ?? r.type}</td>
                  <td>
                    <span className={`fm-badge${(r.status === 'DONE') ? ' fm-badge--status-paid' : (r.status === 'CANCELLED') ? ' fm-badge--status-cancelled' : (r.status === 'BLOCKED') ? ' fm-badge--status-due' : ' fm-badge--status-planned'}`}>
                      {TASK_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td>{r.clientName}</td>
                  <td>{r.priority}</td>
                  <td>{fmtDate(r.scheduledFor)}</td>
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
// Page-level tab-to-permission map
// ─────────────────────────────────────────────────────────────────────────────

import type { ActivePage } from '../../types/navigation'

const TAB_PAGE_MAP: Record<RelatoriosTab, ActivePage> = {
  propostas: 'relatorios-propostas',
  contratos: 'relatorios-contratos',
  financeiro: 'relatorios-financeiro',
  clientes: 'relatorios-clientes',
  operacao: 'relatorios-operacao',
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function RelatoriosPage({ tab, onTabChange, userRole }: RelatoriosPageProps) {
  const allTabs = Object.keys(RELATORIOS_TAB_LABELS) as RelatoriosTab[]
  const allowedTabs = allTabs.filter((t) => hasPermission(userRole, TAB_PAGE_MAP[t]))

  if (allowedTabs.length === 0) {
    return <NoPermissionPage />
  }

  // If the requested tab is not allowed, show the first allowed tab
  const activeTab: RelatoriosTab = allowedTabs.includes(tab) ? tab : allowedTabs[0]!

  return (
    <div className="fm-page">
      <div className="fm-page-header">
        <h1 className="fm-page-title">Relatórios</h1>
      </div>

      {/* Tab bar */}
      <div className="fm-tab-bar" role="tablist" aria-label="Relatórios">
        {allowedTabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === activeTab}
            className={`fm-tab${t === activeTab ? ' active' : ''}`}
            onClick={() => { onTabChange(t) }}
          >
            {RELATORIOS_TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="fm-tab-content" role="tabpanel">
        {activeTab === 'propostas' && <PropostasTab />}
        {activeTab === 'contratos' && <ContratosTab />}
        {activeTab === 'financeiro' && <FinanceiroTab />}
        {activeTab === 'clientes' && <ClientesTab />}
        {activeTab === 'operacao' && <OperacaoTab />}
      </div>
    </div>
  )
}
