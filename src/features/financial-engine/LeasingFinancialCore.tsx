// src/features/financial-engine/LeasingFinancialCore.tsx
// Renders the core leasing financial KPIs inside the Financeiro section
// of ProjectDetailPage. Uses existing fm-detail-* CSS classes.
//
// Scope (PR 4): operational contractual metrics only.
// Excluded: dedicated module, new simulation, saved simulations, AI analysis,
// risk/Monte Carlo, packs, approval checklist, seal and decision.

import React from 'react'
import { formatCurrencyBRL } from '../../utils/formatters'
import type { LeasingFinancialSummary } from './leasingCore'

// ─── Locale helpers ──────────────────────────────────────────────────────────

function fmtNum(value: number | null | undefined, unit?: string): string {
  if (value == null) return '—'
  const formatted = value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  return unit ? `${formatted} ${unit}` : formatted
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return formatCurrencyBRL(value)
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

// ─── Contract status label ────────────────────────────────────────────────────

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  signed: 'Assinado',
  suspended: 'Suspenso',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  summary: LeasingFinancialSummary
}

export function LeasingFinancialCore({ summary }: Props) {
  const contractStatusLabel = summary.contract_status
    ? (CONTRACT_STATUS_LABELS[summary.contract_status] ?? summary.contract_status)
    : null

  return (
    <>
      {/* Contractual plan */}
      <div className="fm-detail-subsection">
        <h3 className="fm-detail-subsection-title">Plano Contratual</h3>
        <div className="fm-detail-grid">
          <Field label="Mensalidade" value={fmtCurrency(summary.mensalidade)} />
          <Field label="Prazo" value={fmtNum(summary.prazo_meses, 'meses')} />
          <Field label="kWh/mês contratado" value={fmtNum(summary.kwh_mes_contratado, 'kWh')} />
          <Field label="Desconto" value={fmtNum(summary.desconto_percentual, '%')} />
          <Field label="Tarifa atual" value={summary.tarifa_atual != null ? `R$ ${summary.tarifa_atual.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}/kWh` : '—'} />
          {contractStatusLabel ? (
            <Field label="Status do contrato" value={contractStatusLabel} />
          ) : null}
          {summary.billing_start_date ? (
            <Field label="Início da cobrança" value={fmtDate(summary.billing_start_date)} />
          ) : null}
          {summary.expected_billing_end_date ? (
            <Field label="Fim previsto" value={fmtDate(summary.expected_billing_end_date)} />
          ) : null}
        </div>
      </div>

      {/* Derived projections */}
      {(summary.receita_total_projetada != null || summary.economia_mensal_estimada != null) ? (
        <div className="fm-detail-subsection">
          <h3 className="fm-detail-subsection-title">Projeções Derivadas</h3>
          <div className="fm-detail-grid">
            {summary.receita_total_projetada != null ? (
              <Field label="Receita total projetada" value={fmtCurrency(summary.receita_total_projetada)} />
            ) : null}
            {summary.economia_mensal_estimada != null ? (
              <Field label="Economia estimada/mês" value={fmtCurrency(summary.economia_mensal_estimada)} />
            ) : null}
            {summary.economia_total_projetada != null ? (
              <Field label="Economia total projetada" value={fmtCurrency(summary.economia_total_projetada)} />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* System reference */}
      {(summary.potencia_sistema_kwp != null || summary.geracao_estimada_kwh_mes != null) ? (
        <div className="fm-detail-subsection">
          <h3 className="fm-detail-subsection-title">Sistema Fotovoltaico</h3>
          <div className="fm-detail-grid">
            {summary.potencia_sistema_kwp != null ? (
              <Field label="Potência instalada" value={fmtNum(summary.potencia_sistema_kwp, 'kWp')} />
            ) : null}
            {summary.geracao_estimada_kwh_mes != null ? (
              <Field label="Geração estimada" value={fmtNum(summary.geracao_estimada_kwh_mes, 'kWh/mês')} />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
