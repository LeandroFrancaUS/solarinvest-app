// src/features/cobrancas/CobrancasDashboardPage.tsx
// Área Cobranças — visão global consolidada de mensalidades, recebimentos e inadimplência.
// Etapa 4: UI/frontend read-only. Não recalcula mensalidade, não gera cobranças.
//
// Dados: agrega GET /api/projects/:id/charges via Promise.all para todos os
// projetos de tipo 'leasing' retornados por GET /api/projects.

import React, { useEffect, useState } from 'react'
import { fetchProjects } from '../../services/projectsApi'
import { listProjectCharges } from '../projectHub/projectChargesApi'
import type { ProjectMonthlyCharge } from '../projectHub/projectChargesTypes'
import type { ProjectRow } from '../../domain/projects/types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CobrancasTab = 'mensalidades' | 'recebimentos' | 'inadimplencia'

export interface Props {
  tab: CobrancasTab
  onTabChange: (tab: CobrancasTab) => void
}

interface EnrichedCharge extends ProjectMonthlyCharge {
  client_name: string
  project_type: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TAB_LABELS: Record<CobrancasTab, string> = {
  mensalidades: 'Mensalidades',
  recebimentos: 'Recebimentos',
  inadimplencia: 'Inadimplência',
}

const STATUS_LABELS: Record<string, string> = {
  prevista: 'Prevista',
  emitida: 'Emitida',
  paga: 'Paga',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  prevista: 'fm-badge fm-badge--status-planned',
  emitida: 'fm-badge fm-badge--status-planned',
  paga: 'fm-badge fm-badge--status-paid',
  vencida: 'fm-badge fm-badge--status-due',
  cancelada: 'fm-badge fm-badge--status-cancelled',
}

function fmtBRL(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parts = value.slice(0, 10).split('-').map(Number)
  if (parts.length < 3) return '—'
  const date = new Date(parts[0]!, parts[1]! - 1, parts[2]!)
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR')
}

function fmtMonth(value: string | null | undefined): string {
  if (!value) return '—'
  const parts = value.slice(0, 10).split('-').map(Number)
  if (parts.length < 2) return '—'
  const date = new Date(parts[0]!, parts[1]! - 1, 1)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function diasAtraso(dueDate: string): number {
  const today = new Date()
  const parts = dueDate.slice(0, 10).split('-').map(Number)
  if (parts.length < 3) return 0
  const due = new Date(parts[0]!, parts[1]! - 1, parts[2]!)
  const diff = today.getTime() - due.getTime()
  return Math.max(0, Math.floor(diff / 86_400_000))
}

// ─────────────────────────────────────────────────────────────────────────────
// Data loading hook
// ─────────────────────────────────────────────────────────────────────────────

function useAllCharges(): {
  charges: EnrichedCharge[]
  loading: boolean
  error: string | null
  reload: () => void
} {
  const [charges, setCharges] = useState<EnrichedCharge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Fetch all projects (up to 500 — sufficient for current scale)
        const { rows: projects } = await fetchProjects({ limit: 500 })

        // Only leasing projects have monthly charges
        const leasingProjects = projects.filter(
          (p: ProjectRow) => p.project_type === 'leasing' && p.deleted_at == null,
        )

        // Fetch charges for each project in parallel.
        // Limit 500 is sufficient for current scale; pagination can be added
        // when the portfolio grows significantly beyond this threshold.
        const results = await Promise.all(
          leasingProjects.map(async (project: ProjectRow) => {
            try {
              const projectCharges = await listProjectCharges(project.id)
              return projectCharges.map(
                (c): EnrichedCharge => ({
                  ...c,
                  client_name: project.client_name_snapshot ?? `Cliente #${project.client_id}`,
                  project_type: project.project_type,
                }),
              )
            } catch {
              // Non-fatal — skip projects that fail to load charges
              return [] as EnrichedCharge[]
            }
          }),
        )

        if (!cancelled) {
          setCharges(results.flat())
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar cobranças.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [tick])

  return {
    charges,
    loading,
    error,
    reload: () => { setTick((t) => t + 1) },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI summary bar
// ─────────────────────────────────────────────────────────────────────────────

function KpiBar({ charges }: { charges: EnrichedCharge[] }) {
  const totalMensalidades = charges.length
  const totalPago = charges.filter((c) => c.status === 'paga').reduce((s, c) => s + (c.valor_pago ?? 0), 0)
  const totalVencido = charges.filter((c) => c.status === 'vencida').reduce((s, c) => s + (c.valor_cobrado ?? c.valor_previsto ?? 0), 0)
  const vencidasCount = charges.filter((c) => c.status === 'vencida').length

  return (
    <div className="fm-kpi-grid">
      <div className="fm-kpi-card">
        <span className="fm-kpi-icon" aria-hidden="true">📋</span>
        <div className="fm-kpi-body">
          <span className="fm-kpi-label">Total de mensalidades</span>
          <span className="fm-kpi-value">{totalMensalidades}</span>
        </div>
      </div>
      <div className="fm-kpi-card fm-kpi-card--green">
        <span className="fm-kpi-icon" aria-hidden="true">✅</span>
        <div className="fm-kpi-body">
          <span className="fm-kpi-label">Total recebido</span>
          <span className="fm-kpi-value">{fmtBRL(totalPago)}</span>
          <span className="fm-kpi-subtitle">{charges.filter((c) => c.status === 'paga').length} pagas</span>
        </div>
      </div>
      <div className={`fm-kpi-card${vencidasCount > 0 ? ' fm-kpi-card--red' : ''}`}>
        <span className="fm-kpi-icon" aria-hidden="true">⚠️</span>
        <div className="fm-kpi-body">
          <span className="fm-kpi-label">Em inadimplência</span>
          <span className="fm-kpi-value">{fmtBRL(totalVencido)}</span>
          <span className="fm-kpi-subtitle">{vencidasCount} vencidas</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Mensalidades
// ─────────────────────────────────────────────────────────────────────────────

function MensalidadesTab({ charges }: { charges: EnrichedCharge[] }) {
  if (charges.length === 0) {
    return (
      <div className="fm-project-section-placeholder">
        <p>Nenhuma mensalidade encontrada nos projetos.</p>
      </div>
    )
  }

  return (
    <div className="fm-table-wrapper">
      <table className="fm-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Mês referência</th>
            <th>Vencimento</th>
            <th>Valor previsto</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {charges.map((c) => (
            <tr key={c.id}>
              <td>{c.client_name}</td>
              <td>{c.project_type === 'leasing' ? 'Leasing' : 'Venda'}</td>
              <td>{fmtMonth(c.reference_month)}</td>
              <td>{fmtDate(c.due_date)}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(c.valor_previsto)}</td>
              <td>
                <span className={STATUS_BADGE_CLASS[c.status] ?? 'fm-badge'}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Recebimentos
// ─────────────────────────────────────────────────────────────────────────────

function RecebimentosTab({ charges }: { charges: EnrichedCharge[] }) {
  const paid = charges.filter((c) => c.status === 'paga')

  if (paid.length === 0) {
    return (
      <div className="fm-project-section-placeholder">
        <p>Nenhum recebimento registrado ainda.</p>
      </div>
    )
  }

  return (
    <div className="fm-table-wrapper">
      <table className="fm-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Mês referência</th>
            <th>Valor pago</th>
            <th>Data pagamento</th>
            <th>Nº recibo</th>
          </tr>
        </thead>
        <tbody>
          {paid.map((c) => (
            <tr key={c.id}>
              <td>{c.client_name}</td>
              <td>{fmtMonth(c.reference_month)}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                <span className="fm-value--positive">{fmtBRL(c.valor_pago)}</span>
              </td>
              <td>{fmtDate(c.paid_at)}</td>
              <td>{c.receipt_number ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Inadimplência
// ─────────────────────────────────────────────────────────────────────────────

function InadimplenciaTab({ charges }: { charges: EnrichedCharge[] }) {
  const today = todayIso()
  // ISO date strings (YYYY-MM-DD) are lexicographically comparable.
  // All due_date values from the API are guaranteed to be in this format.
  const overdue = charges.filter(
    (c) => c.status === 'vencida' && c.due_date != null && c.due_date < today,
  )

  if (overdue.length === 0) {
    return (
      <div className="fm-project-section-placeholder">
        <p>Nenhuma cobrança em atraso. 🎉</p>
      </div>
    )
  }

  return (
    <div className="fm-table-wrapper">
      <table className="fm-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Mês referência</th>
            <th>Vencimento</th>
            <th>Valor em aberto</th>
            <th>Dias em atraso</th>
          </tr>
        </thead>
        <tbody>
          {overdue.map((c) => {
            const valor = c.valor_cobrado ?? c.valor_previsto
            const dias = c.due_date ? diasAtraso(c.due_date) : 0
            return (
              <tr key={c.id}>
                <td>{c.client_name}</td>
                <td>{fmtMonth(c.reference_month)}</td>
                <td>{fmtDate(c.due_date)}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <span className="fm-value--negative">{fmtBRL(valor)}</span>
                </td>
                <td>
                  <span className="fm-badge fm-badge--status-due">{dias}d</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CobrancasDashboardPage
// ─────────────────────────────────────────────────────────────────────────────

export function CobrancasDashboardPage({ tab, onTabChange }: Props) {
  const { charges, loading, error, reload } = useAllCharges()

  const tabs: CobrancasTab[] = ['mensalidades', 'recebimentos', 'inadimplencia']

  return (
    <div className="fm-root">
      {/* Header */}
      <div className="fm-header">
        <div className="fm-header-content">
          <h1 className="fm-title">💳 Cobranças</h1>
          <p className="fm-subtitle">Visão global consolidada de mensalidades, recebimentos e inadimplência.</p>
        </div>
      </div>

      {/* KPI summary */}
      {!loading && !error && <KpiBar charges={charges} />}

      {/* Tab nav */}
      <div className="fm-tabs" role="tablist" aria-label="Seções de cobranças">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            className={`fm-tab${tab === t ? ' active' : ''}`}
            aria-selected={tab === t}
            onClick={() => { onTabChange(t) }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="fm-tab-content" role="tabpanel">
        {loading ? (
          <div className="fm-loading">
            <span className="fm-loading-spinner fm-loading-spinner--sm" aria-hidden="true" />
            Carregando cobranças de todos os projetos…
          </div>
        ) : error ? (
          <div className="fm-error" role="alert">
            <strong>Erro ao carregar:</strong> {error}
            <button type="button" className="ghost" onClick={reload} style={{ marginLeft: 8 }}>
              Tentar novamente
            </button>
          </div>
        ) : tab === 'mensalidades' ? (
          <MensalidadesTab charges={charges} />
        ) : tab === 'recebimentos' ? (
          <RecebimentosTab charges={charges} />
        ) : (
          <InadimplenciaTab charges={charges} />
        )}
      </div>

      {!loading && !error && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
          {charges.length} mensalidade{charges.length !== 1 ? 's' : ''} carregada{charges.length !== 1 ? 's' : ''}.
          Apenas projetos de leasing possuem mensalidades recorrentes.
        </p>
      )}
    </div>
  )
}
