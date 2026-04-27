// src/features/projectHub/ProjectChargesTab.tsx
// "Cobranças" tab for the Project Hub detail page.
//
// Displays a summary of monthly charges for a project and a table of
// installments with a "Marcar como paga" action.
//
// For leasing projects with no charges a "Gerar mensalidades" button is shown.
// For venda projects a short informational message is rendered.

import React, { useCallback, useEffect, useState } from 'react'
import {
  listProjectCharges,
  generateProjectCharges,
  updateProjectCharge,
} from './projectChargesApi'
import { fetchProjectFinance } from '../project-finance/api'
import type { ProjectMonthlyCharge, ChargeStatus } from './projectChargesTypes'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  projectType: 'leasing' | 'venda'
  /** commissioning_date from PortfolioClientRow — used as default start date */
  activationDate?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GENERATE_MONTHS = 60
const GENERATE_DUE_DAY = 10

const STATUS_LABELS: Record<ChargeStatus, string> = {
  prevista: 'Prevista',
  emitida: 'Emitida',
  paga: 'Paga',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
}

const STATUS_BADGE_CLASS: Record<ChargeStatus, string> = {
  prevista: 'fm-badge fm-badge--status-planned',
  emitida: 'fm-badge fm-badge--status-planned',
  paga: 'fm-badge fm-badge--status-paid',
  vencida: 'fm-badge fm-badge--status-due',
  cancelada: 'fm-badge fm-badge--status-cancelled',
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
  // date strings arrive as "YYYY-MM-DD" — parse as local date to avoid UTC offset shift
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR')
}

function fmtMonth(value: string | null | undefined): string {
  if (!value) return '—'
  const [y, m] = value.slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isOverdue(charge: ProjectMonthlyCharge): boolean {
  if (charge.status === 'paga' || charge.status === 'cancelada') return false
  if (!charge.due_date) return false
  return charge.due_date < todayIso()
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary component
// ─────────────────────────────────────────────────────────────────────────────

interface SummaryProps {
  charges: ProjectMonthlyCharge[]
}

function ChargeSummary({ charges }: SummaryProps) {
  const totalPrevisto = charges.reduce((acc, c) => acc + (c.valor_previsto ?? 0), 0)
  const totalPago = charges.reduce((acc, c) => acc + (c.valor_pago ?? 0), 0)
  const emAberto = charges
    .filter((c) => c.status !== 'paga' && c.status !== 'cancelada')
    .reduce((acc, c) => acc + (c.valor_cobrado ?? c.valor_previsto ?? 0), 0)
  const vencidas = charges.filter(isOverdue).length

  return (
    <div className="fm-kpi-grid">
      <div className="fm-kpi-card">
        <span className="fm-kpi-icon" aria-hidden="true">📋</span>
        <div className="fm-kpi-body">
          <span className="fm-kpi-label">Total previsto</span>
          <span className="fm-kpi-value">{fmtBRL(totalPrevisto)}</span>
          <span className="fm-kpi-subtitle">{charges.length} parcelas</span>
        </div>
      </div>
      <div className="fm-kpi-card fm-kpi-card--green">
        <span className="fm-kpi-icon" aria-hidden="true">✅</span>
        <div className="fm-kpi-body">
          <span className="fm-kpi-label">Total pago</span>
          <span className="fm-kpi-value">{fmtBRL(totalPago)}</span>
          <span className="fm-kpi-subtitle">
            {charges.filter((c) => c.status === 'paga').length} pagas
          </span>
        </div>
      </div>
      <div className="fm-kpi-card">
        <span className="fm-kpi-icon" aria-hidden="true">💳</span>
        <div className="fm-kpi-body">
          <span className="fm-kpi-label">Em aberto</span>
          <span className="fm-kpi-value">{fmtBRL(emAberto)}</span>
          <span className="fm-kpi-subtitle">
            {charges.filter((c) => c.status !== 'paga' && c.status !== 'cancelada').length} pendentes
          </span>
        </div>
      </div>
      <div className={`fm-kpi-card${vencidas > 0 ? ' fm-kpi-card--red' : ''}`}>
        <span className="fm-kpi-icon" aria-hidden="true">⚠️</span>
        <div className="fm-kpi-body">
          <span className="fm-kpi-label">Vencidas</span>
          <span className="fm-kpi-value">{vencidas}</span>
          <span className="fm-kpi-subtitle">parcelas em atraso</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectChargesTab
// ─────────────────────────────────────────────────────────────────────────────

export function ProjectChargesTab({ projectId, projectType, activationDate }: Props) {
  const [charges, setCharges] = useState<ProjectMonthlyCharge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)
  const [markPaidError, setMarkPaidError] = useState<string | null>(null)

  // Mensalidade loaded lazily from the project finance profile (leasing only)
  const [mensalidade, setMensalidade] = useState<number | null>(null)
  const [mensalidadeLoading, setMensalidadeLoading] = useState(false)

  // Load charges on mount
  const loadCharges = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listProjectCharges(projectId)
      setCharges(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cobranças.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadCharges()
  }, [loadCharges])

  // For leasing projects with no charges, also load mensalidade from finance profile
  useEffect(() => {
    if (projectType !== 'leasing') return
    setMensalidadeLoading(true)
    fetchProjectFinance(projectId)
      .then((res) => {
        setMensalidade(res.mensalidade_base ?? null)
      })
      .catch(() => {
        // Non-fatal — generate button still works if user enters 0
      })
      .finally(() => {
        setMensalidadeLoading(false)
      })
  }, [projectId, projectType])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setGenerateError(null)
    try {
      const startDate = activationDate ?? todayIso()
      const valorMensalidade = mensalidade ?? 0
      await generateProjectCharges(projectId, {
        startDate,
        months: GENERATE_MONTHS,
        valorMensalidade,
        dueDay: GENERATE_DUE_DAY,
      })
      await loadCharges()
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Erro ao gerar mensalidades.')
    } finally {
      setGenerating(false)
    }
  }, [projectId, activationDate, mensalidade, loadCharges])

  const handleMarkPaid = useCallback(
    async (charge: ProjectMonthlyCharge) => {
      setMarkingPaidId(charge.id)
      setMarkPaidError(null)
      try {
        const updated = await updateProjectCharge(charge.id, {
          status: 'paga',
          valor_pago: charge.valor_cobrado ?? charge.valor_previsto ?? 0,
          paid_at: new Date().toISOString(),
        })
        setCharges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      } catch (err) {
        setMarkPaidError(err instanceof Error ? err.message : 'Erro ao marcar como paga.')
      } finally {
        setMarkingPaidId(null)
      }
    },
    [],
  )

  // ── Render: venda ──────────────────────────────────────────────────────────

  if (projectType === 'venda') {
    return (
      <div className="fm-project-section">
        <div className="fm-project-section-header">
          <span className="fm-project-section-icon" aria-hidden="true">💳</span>
          <h2 className="fm-project-section-title">Cobranças</h2>
        </div>
        <div className="fm-project-section-body">
          <div className="fm-project-section-placeholder">
            <p>Projeto de venda não possui mensalidades recorrentes.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fm-project-section">
        <div className="fm-project-section-header">
          <span className="fm-project-section-icon" aria-hidden="true">💳</span>
          <h2 className="fm-project-section-title">Cobranças</h2>
        </div>
        <div className="fm-project-section-body">
          <div className="fm-loading">
            <span className="fm-loading-spinner fm-loading-spinner--sm" aria-hidden="true" />
            Carregando cobranças…
          </div>
        </div>
      </div>
    )
  }

  // ── Render: error ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="fm-project-section">
        <div className="fm-project-section-header">
          <span className="fm-project-section-icon" aria-hidden="true">💳</span>
          <h2 className="fm-project-section-title">Cobranças</h2>
        </div>
        <div className="fm-project-section-body">
          <div className="fm-error-banner fm-error-banner--inline" role="alert">
            ⚠️ {error}{' '}
            <button type="button" className="ghost" onClick={() => void loadCharges()}>
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: leasing — no charges ───────────────────────────────────────────

  if (charges.length === 0) {
    return (
      <div className="fm-project-section">
        <div className="fm-project-section-header">
          <span className="fm-project-section-icon" aria-hidden="true">💳</span>
          <h2 className="fm-project-section-title">Cobranças</h2>
        </div>
        <div className="fm-project-section-body">
          <div className="fm-project-section-placeholder">
            <p>Nenhuma cobrança gerada para este projeto.</p>
            {mensalidadeLoading ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Carregando mensalidade…
              </p>
            ) : mensalidade != null ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Mensalidade: {fmtBRL(mensalidade)} · {GENERATE_MONTHS} parcelas · vencimento dia {GENERATE_DUE_DAY}
              </p>
            ) : null}
            {generateError ? (
              <div className="fm-error-banner fm-error-banner--inline" role="alert" style={{ marginTop: 8 }}>
                ⚠️ {generateError}
              </div>
            ) : null}
            <button
              type="button"
              className="primary"
              style={{ marginTop: 12 }}
              onClick={() => { void handleGenerate() }}
              disabled={generating || mensalidadeLoading}
            >
              {generating ? 'Gerando…' : '💰 Gerar mensalidades'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: leasing — charges table ───────────────────────────────────────

  return (
    <div className="fm-project-section">
      <div className="fm-project-section-header">
        <span className="fm-project-section-icon" aria-hidden="true">💳</span>
        <h2 className="fm-project-section-title">Cobranças</h2>
        <span className="fm-kpi-subtitle" style={{ marginLeft: 8 }}>
          {charges.length} parcelas
        </span>
      </div>
      <div className="fm-project-section-body">

        <ChargeSummary charges={charges} />

        {markPaidError ? (
          <div className="fm-error-banner fm-error-banner--inline" role="alert" style={{ marginBottom: 12 }}>
            ⚠️ {markPaidError}
          </div>
        ) : null}

        <div className="fm-table-wrapper">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Parcela</th>
                <th>Mês referência</th>
                <th>Vencimento</th>
                <th>Valor previsto</th>
                <th>Valor pago</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => {
                const isPaid = charge.status === 'paga'
                const isCancelled = charge.status === 'cancelada'
                const isMarkingThis = markingPaidId === charge.id
                return (
                  <tr key={charge.id}>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {charge.installment_num}
                    </td>
                    <td>{fmtMonth(charge.reference_month)}</td>
                    <td>{fmtDate(charge.due_date)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtBRL(charge.valor_previsto)}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {isPaid ? (
                        <span className="fm-value--positive">{fmtBRL(charge.valor_pago)}</span>
                      ) : (
                        fmtBRL(charge.valor_pago)
                      )}
                    </td>
                    <td>
                      <span className={STATUS_BADGE_CLASS[charge.status] ?? 'fm-badge'}>
                        {STATUS_LABELS[charge.status] ?? charge.status}
                      </span>
                    </td>
                    <td>
                      <div className="fm-actions-cell">
                        {!isPaid && !isCancelled ? (
                          <button
                            type="button"
                            className="ghost fm-action-btn"
                            onClick={() => { void handleMarkPaid(charge) }}
                            disabled={isMarkingThis || markingPaidId !== null}
                            title="Marcar como paga"
                          >
                            {isMarkingThis ? '…' : '✅ Paga'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
