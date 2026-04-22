// src/features/project-finance/ProjectFinanceSummary.tsx
// Shows a compact read-only summary of the project financial profile.
// Used inside the collapsed state of ProjectFinanceSection.

import React from 'react'
import type { ProjectFinanceSummaryKPIs } from './types'

// ─── Locale helpers ──────────────────────────────────────────────────────────

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—'
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`
}

function fmtNum(value: number | null | undefined, unit?: string): string {
  if (value == null) return '—'
  const formatted = value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return unit ? `${formatted} ${unit}` : formatted
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div
      className="fm-detail-field"
      style={highlight ? { background: 'var(--bg-card-highlight, rgba(59,130,246,0.08))', borderRadius: 6, padding: '6px 10px' } : undefined}
    >
      <span className="fm-detail-field-label">{label}</span>
      <span className="fm-detail-field-value">{value}</span>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  summary: ProjectFinanceSummaryKPIs
}

export function ProjectFinanceSummary({ summary }: Props) {
  const statusLabel: Record<string, string> = {
    draft: 'Rascunho',
    active: 'Ativo',
    archived: 'Arquivado',
  }

  return (
    <div className="fm-detail-subsection">
      <div className="fm-detail-grid">
        <MetricCard label="Custo total do projeto" value={fmtCurrency(summary.custo_total_projeto)} />
        <MetricCard label="Receita esperada" value={fmtCurrency(summary.receita_esperada)} />
        <MetricCard
          label="Lucro esperado"
          value={fmtCurrency(summary.lucro_esperado)}
          highlight={summary.lucro_esperado != null && summary.lucro_esperado > 0}
        />
        <MetricCard label="Margem esperada" value={fmtPct(summary.margem_esperada_pct)} />
        {summary.payback_meses != null ? (
          <MetricCard label="Payback" value={fmtNum(summary.payback_meses, 'meses')} />
        ) : null}
        {summary.roi_pct != null ? (
          <MetricCard label="ROI" value={fmtPct(summary.roi_pct)} />
        ) : null}
        <MetricCard
          label="Status do financeiro"
          value={statusLabel[summary.status] ?? summary.status}
        />
      </div>
      {summary.updated_at ? (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
          Atualizado em: {new Date(summary.updated_at).toLocaleString('pt-BR')}
        </p>
      ) : null}
    </div>
  )
}
