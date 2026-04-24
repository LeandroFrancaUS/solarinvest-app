// src/features/project-finance/ProjectFinanceEditor.tsx
// Expanded editor container: shows the correct form variant (leasing or venda)
// based on the resolved contract type. Includes save, cancel and totals bar.

import React from 'react'
import type {
  ProjectFinanceFormState,
  ProjectFinanceContractType,
  ProjectFinanceComputed,
  ProjectFinanceOverrides,
  ProjectFinanceTechnicalParams,
  OverridableField,
} from './types'
import type { ProjectPvData } from '../../domain/projects/types'
import { ProjectFinanceLeasingForm } from './ProjectFinanceLeasingForm'
import { ProjectFinanceVendaForm } from './ProjectFinanceVendaForm'
import { computeCustoTotal, computeLucroEsperado, computeMargemEsperadaPct } from './calculations'

// ─── Locale helpers ──────────────────────────────────────────────────────────

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

// ─── Totals bar ───────────────────────────────────────────────────────────────

function TotalsBar({
  form,
  contractType,
  isSaving,
  isDirty,
  onSave,
  onCancel,
  onRestoreAll,
  error,
  hasOverrides,
}: {
  form: ProjectFinanceFormState
  contractType: ProjectFinanceContractType
  isSaving: boolean
  isDirty: boolean
  onSave: () => void
  onCancel: () => void
  onRestoreAll: () => void
  error: string | null
  hasOverrides: boolean
}) {
  const custo = computeCustoTotal(form)
  const lucro = computeLucroEsperado(form.receita_esperada, custo)
  const margem = computeMargemEsperadaPct(form.receita_esperada, lucro)

  const contractLabel = contractType === 'leasing' ? 'Leasing' : 'Venda'

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        background: 'var(--bg-card, #1e293b)',
        borderTop: '1px solid var(--border)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          marginRight: 8,
          whiteSpace: 'nowrap',
        }}
      >
        📊 {contractLabel}
      </span>

      <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
        <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Custo:</span>
        <strong>{fmtCurrency(custo)}</strong>
      </span>

      {form.receita_esperada != null ? (
        <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Receita:</span>
          <strong>{fmtCurrency(form.receita_esperada)}</strong>
        </span>
      ) : null}

      {lucro != null ? (
        <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Lucro:</span>
          <strong style={{ color: lucro >= 0 ? 'var(--ds-success, #22c55e)' : 'var(--ds-danger, #ef4444)' }}>
            {fmtCurrency(lucro)}
          </strong>
        </span>
      ) : null}

      {margem != null && contractType !== 'leasing' ? (
        <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Margem:</span>
          <strong>{fmtPct(margem)}</strong>
        </span>
      ) : null}

      <span style={{ flex: 1 }} />

      {hasOverrides ? (
        <button
          type="button"
          className="ghost"
          onClick={onRestoreAll}
          style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--ds-warning, #f59e0b)' }}
          title="Restaurar todos os campos para automático"
        >
          ↺ Restaurar tudo
        </button>
      ) : null}

      {error ? (
        <span style={{ fontSize: 12, color: 'var(--ds-danger, #ef4444)', marginRight: 8 }}>
          ⚠️ {error}
        </span>
      ) : null}

      <button
        type="button"
        className="ghost"
        onClick={onCancel}
        disabled={isSaving}
        style={{ whiteSpace: 'nowrap' }}
      >
        Cancelar
      </button>
      <button
        type="button"
        className="primary"
        onClick={onSave}
        disabled={isSaving || !isDirty}
        style={{ whiteSpace: 'nowrap' }}
      >
        {isSaving ? 'Salvando…' : '💾 Salvar'}
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  form: ProjectFinanceFormState
  contractType: ProjectFinanceContractType
  /** Contract term in months from the contract. Readonly. */
  contractTermMonths: number | null
  /** PV system data from Usina Fotovoltaica. Displayed as readonly info. */
  pvData: ProjectPvData | null
  calculated: ProjectFinanceComputed
  effective: ProjectFinanceComputed
  overrides: ProjectFinanceOverrides
  technicalParams: ProjectFinanceTechnicalParams
  isSaving: boolean
  isDirty: boolean
  error: string | null
  /**
   * When true, the "Preencher com motor" button is shown.
   * Only enabled when pvData has enough data to derive costs.
   */
  canDeriveFromEngine?: boolean
  setField: <K extends keyof ProjectFinanceFormState>(key: K, value: ProjectFinanceFormState[K]) => void
  setTechnicalParam: <K extends keyof ProjectFinanceTechnicalParams>(key: K, value: ProjectFinanceTechnicalParams[K]) => void
  setOverride: (field: OverridableField, value: number) => void
  restoreAuto: (field: OverridableField) => void
  restoreAll: () => void
  onSave: () => void
  onCancel: () => void
  /**
   * Called when the user clicks "Preencher com motor".
   * force=false fills only null fields; force=true overwrites all.
   */
  onDeriveFromEngine?: (force: boolean) => void
}

export function ProjectFinanceEditor({
  form,
  contractType,
  contractTermMonths,
  pvData,
  calculated,
  overrides,
  technicalParams,
  isSaving,
  isDirty,
  error,
  canDeriveFromEngine = false,
  setField,
  setTechnicalParam,
  setOverride,
  restoreAuto,
  restoreAll,
  onSave,
  onCancel,
  onDeriveFromEngine,
}: Props) {
  const hasOverrides = Object.keys(overrides).length > 0

  return (
    <div>
      {/* Engine auto-fill toolbar */}
      {canDeriveFromEngine && onDeriveFromEngine ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 4px',
            borderBottom: '1px solid var(--border)',
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            🔄 Motor de Análise Financeira:
          </span>
          <button
            type="button"
            className="ghost"
            onClick={() => onDeriveFromEngine(false)}
            title="Preenche apenas campos ainda vazios com valores calculados pelo motor da Análise Financeira"
            style={{ fontSize: 12, padding: '3px 10px' }}
          >
            Preencher campos vazios
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => onDeriveFromEngine(true)}
            title="Recalcula e substitui todos os campos de custo com valores do motor da Análise Financeira"
            style={{ fontSize: 12, padding: '3px 10px', color: 'var(--ds-warning, #f59e0b)' }}
          >
            Recalcular tudo
          </button>
        </div>
      ) : null}

      <div style={{ padding: '0 4px' }}>
        {contractType === 'leasing' ? (
          <ProjectFinanceLeasingForm
            form={form}
            contractTermMonths={contractTermMonths}
            pvData={pvData}
            calculated={calculated}
            overrides={overrides}
            setField={setField}
            setOverride={setOverride}
            restoreAuto={restoreAuto}
          />
        ) : (
          <ProjectFinanceVendaForm
            form={form}
            contractTermMonths={contractTermMonths}
            pvData={pvData}
            calculated={calculated}
            overrides={overrides}
            setField={setField}
            setOverride={setOverride}
            restoreAuto={restoreAuto}
          />
        )}
      </div>
      <TotalsBar
        form={form}
        contractType={contractType}
        isSaving={isSaving}
        isDirty={isDirty}
        onSave={onSave}
        onCancel={onCancel}
        onRestoreAll={restoreAll}
        error={error}
        hasOverrides={hasOverrides}
      />
    </div>
  )
}
