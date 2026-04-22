// src/features/financial-engine/VendaFinancialCore.tsx
// Renders the core venda financial KPIs inside the Financeiro section
// of ProjectDetailPage. Uses existing fm-detail-* CSS classes.
//
// Scope (PR 4): operational system-level metrics only.
// Excluded: dedicated module, new simulation, saved simulations, AI analysis,
// risk/Monte Carlo, packs, approval checklist, seal and decision.

import React from 'react'
import type { VendaFinancialSummary } from './vendaCore'

// ─── Locale helpers ──────────────────────────────────────────────────────────

function fmtNum(value: number | null | undefined, unit?: string): string {
  if (value == null) return '—'
  const formatted = value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  return unit ? `${formatted} ${unit}` : formatted
}

// ─── Field component ─────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="fm-detail-field">
      <span className="fm-detail-field-label">{label}</span>
      <span className="fm-detail-field-value">{value}</span>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  summary: VendaFinancialSummary
}

export function VendaFinancialCore({ summary }: Props) {
  return (
    <>
      <div className="fm-detail-subsection">
        <h3 className="fm-detail-subsection-title">Sistema Fotovoltaico</h3>
        <div className="fm-detail-grid">
          {summary.potencia_sistema_kwp != null ? (
            <Field label="Potência instalada" value={fmtNum(summary.potencia_sistema_kwp, 'kWp')} />
          ) : null}
          {summary.geracao_estimada_kwh_mes != null ? (
            <Field label="Geração estimada" value={fmtNum(summary.geracao_estimada_kwh_mes, 'kWh/mês')} />
          ) : null}
          {summary.consumo_kwh_mes != null ? (
            <Field label="Consumo" value={fmtNum(summary.consumo_kwh_mes, 'kWh/mês')} />
          ) : null}
          {summary.autonomia_percent != null ? (
            <Field
              label="Autonomia estimada"
              value={`${summary.autonomia_percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
            />
          ) : null}
          {summary.tarifa_atual != null ? (
            <Field
              label="Tarifa atual"
              value={`R$ ${summary.tarifa_atual.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}/kWh`}
            />
          ) : null}
        </div>
      </div>
    </>
  )
}
