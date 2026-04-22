// src/features/project-finance/ProjectFinanceVendaForm.tsx
// Editable form for the Venda variant of the project financial profile.

import React from 'react'
import type {
  ProjectFinanceFormState,
  ProjectFinanceComputed,
  ProjectFinanceOverrides,
  OverridableField,
} from './types'
import { computeCustoTotal } from './calculations'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtNum(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// ─── Field components ────────────────────────────────────────────────────────

function FieldNumber({
  id, label, value, onChange, unit, min = 0, step = 'any', hint,
}: {
  id: string
  label: string
  value: number | null | undefined
  onChange: (v: number | null) => void
  unit?: string
  min?: number
  step?: string | number
  hint?: string
}) {
  return (
    <div className="fm-detail-field fm-detail-field--edit">
      <label className="fm-detail-field-label" htmlFor={id}>
        {label}
        {unit ? <span className="fm-field-hint"> ({unit})</span> : null}
        {hint ? <span className="fm-field-hint"> {hint}</span> : null}
      </label>
      <input
        id={id}
        className="fm-form-input"
        type="number"
        min={min}
        step={step}
        value={value ?? ''}
        onChange={(e) => {
          const n = e.target.valueAsNumber
          onChange(isNaN(n) ? null : n)
        }}
      />
    </div>
  )
}

function FieldText({
  id, label, value, onChange, rows,
}: {
  id: string
  label: string
  value: string | null | undefined
  onChange: (v: string) => void
  rows?: number
}) {
  if (rows && rows > 1) {
    return (
      <div className="fm-detail-field fm-detail-field--edit" style={{ gridColumn: '1 / -1' }}>
        <label className="fm-detail-field-label" htmlFor={id}>{label}</label>
        <textarea
          id={id}
          className="fm-form-input"
          rows={rows}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </div>
    )
  }
  return (
    <div className="fm-detail-field fm-detail-field--edit">
      <label className="fm-detail-field-label" htmlFor={id}>{label}</label>
      <input id={id} className="fm-form-input" type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function ReadonlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="fm-detail-field">
      <span className="fm-detail-field-label">{label}</span>
      <span className="fm-detail-field-value">{value}</span>
    </div>
  )
}

/**
 * A field that is auto-computed by the engine but can be manually overridden.
 */
function FieldWithOverride({
  id,
  label,
  field,
  effectiveValue,
  isOverridden,
  overrideValue,
  unit,
  step = 'any',
  format,
  onOverride,
  onRestore,
}: {
  id: string
  label: string
  field: OverridableField
  effectiveValue: number | null
  isOverridden: boolean
  overrideValue: number | null
  unit?: string
  step?: string | number
  format?: (v: number | null) => string
  onOverride: (field: OverridableField, value: number) => void
  onRestore: (field: OverridableField) => void
}) {
  const displayValue = isOverridden ? overrideValue : effectiveValue

  return (
    <div className="fm-detail-field fm-detail-field--edit">
      <label className="fm-detail-field-label" htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {unit ? <span className="fm-field-hint"> ({unit})</span> : null}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '1px 5px',
            borderRadius: 3,
            marginLeft: 4,
            background: isOverridden ? 'var(--ds-warning-bg, rgba(245,158,11,0.15))' : 'var(--ds-success-bg, rgba(34,197,94,0.12))',
            color: isOverridden ? 'var(--ds-warning, #f59e0b)' : 'var(--ds-success, #22c55e)',
          }}
        >
          {isOverridden ? 'Manual' : 'Automático'}
        </span>
        {isOverridden ? (
          <button
            type="button"
            onClick={() => onRestore(field)}
            style={{
              fontSize: 10,
              padding: '1px 5px',
              marginLeft: 2,
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 3,
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
            title="Restaurar valor automático"
          >
            ↺ Auto
          </button>
        ) : null}
      </label>
      {isOverridden ? (
        <input
          id={id}
          className="fm-form-input"
          type="number"
          step={step}
          value={displayValue ?? ''}
          onChange={(e) => {
            const n = e.target.valueAsNumber
            if (!isNaN(n)) onOverride(field, n)
          }}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="fm-detail-field-value" style={{ flex: 1 }}>
            {format ? format(effectiveValue) : fmtNum(effectiveValue)}
          </span>
          <button
            type="button"
            onClick={() => onOverride(field, effectiveValue ?? 0)}
            style={{
              fontSize: 10,
              padding: '2px 6px',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 3,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
            title="Editar manualmente"
          >
            ✏️ Editar
          </button>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="fm-detail-subsection-title" style={{ marginTop: 20, marginBottom: 8 }}>
      {title}
    </h3>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  form: ProjectFinanceFormState
  /** Contract term in months from the contract. Readonly. */
  contractTermMonths: number | null
  calculated: ProjectFinanceComputed
  effective: ProjectFinanceComputed
  overrides: ProjectFinanceOverrides
  setField: <K extends keyof ProjectFinanceFormState>(key: K, value: ProjectFinanceFormState[K]) => void
  setOverride: (field: OverridableField, value: number) => void
  restoreAuto: (field: OverridableField) => void
}

export function ProjectFinanceVendaForm({
  form,
  contractTermMonths,
  calculated,
  effective,
  overrides,
  setField,
  setOverride,
  restoreAuto,
}: Props) {
  const custoTotal = computeCustoTotal(form)
  const prazoDisplay = contractTermMonths ?? form.prazo_contratual_meses

  return (
    <div>
      {/* ── Sistema Fotovoltaico ──────────────────────────────── */}
      <SectionTitle title="Sistema Fotovoltaico" />
      <div className="fm-detail-grid fm-detail-grid--edit">
        <FieldNumber
          id="pf-venda-consumo"
          label="Consumo"
          unit="kWh/mês"
          value={form.consumo_kwh_mes}
          onChange={(v) => setField('consumo_kwh_mes', v ?? undefined)}
        />

        {/* Potência — auto-computed from consumo, overrideable */}
        <FieldWithOverride
          id="pf-venda-potencia"
          label="Potência instalada"
          field="potencia_instalada_kwp"
          effectiveValue={calculated.potencia_instalada_kwp}
          isOverridden={'potencia_instalada_kwp' in overrides}
          overrideValue={overrides.potencia_instalada_kwp ?? null}
          unit="kWp"
          step={0.001}
          format={(v) => fmtNum(v, 3)}
          onOverride={setOverride}
          onRestore={restoreAuto}
        />

        {/* Geração — auto-computed from consumo, overrideable */}
        <FieldWithOverride
          id="pf-venda-geracao"
          label="Geração estimada"
          field="geracao_estimada_kwh_mes"
          effectiveValue={calculated.geracao_estimada_kwh_mes}
          isOverridden={'geracao_estimada_kwh_mes' in overrides}
          overrideValue={overrides.geracao_estimada_kwh_mes ?? null}
          unit="kWh/mês"
          step={1}
          format={(v) => fmtNum(v, 0)}
          onOverride={setOverride}
          onRestore={restoreAuto}
        />

        {/* Prazo de garantia — readonly, comes from contract */}
        <ReadonlyField
          label="Prazo de garantia (meses)"
          value={
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong>{prazoDisplay ?? '—'}</strong>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                🔒 Contrato
              </span>
            </span>
          }
        />
      </div>

      {/* ── Custos do Projeto ────────────────────────────────── */}
      <SectionTitle title="Custos do Projeto" />
      <div className="fm-detail-grid fm-detail-grid--edit">
        <FieldNumber
          id="pf-venda-equipamentos"
          label="Equipamentos (Kit)"
          unit="R$"
          value={form.custo_equipamentos}
          onChange={(v) => setField('custo_equipamentos', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-venda-instalacao"
          label="Instalação"
          unit="R$"
          value={form.custo_instalacao}
          onChange={(v) => setField('custo_instalacao', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-venda-engenharia"
          label="Engenharia / Projeto"
          unit="R$"
          value={form.custo_engenharia}
          onChange={(v) => setField('custo_engenharia', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-venda-homologacao"
          label="Homologação / CREA"
          unit="R$"
          value={form.custo_homologacao}
          onChange={(v) => setField('custo_homologacao', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-venda-frete"
          label="Frete / Logística"
          unit="R$"
          value={form.custo_frete_logistica}
          onChange={(v) => setField('custo_frete_logistica', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-venda-comissao"
          label="Comissão (CAC)"
          unit="R$"
          value={form.custo_comissao}
          onChange={(v) => setField('custo_comissao', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-venda-impostos"
          label="Impostos / Taxas"
          unit="R$"
          value={form.custo_impostos}
          onChange={(v) => setField('custo_impostos', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-venda-financeiro"
          label="Custo financeiro"
          unit="%"
          value={form.custo_financeiro_pct}
          onChange={(v) => setField('custo_financeiro_pct', v ?? undefined)}
          step={0.01}
          hint="(sobre venda)"
        />
        <FieldNumber
          id="pf-venda-diversos"
          label="Custos diversos"
          unit="R$"
          value={form.custo_diversos}
          onChange={(v) => setField('custo_diversos', v ?? undefined)}
          step={0.01}
        />
        <ReadonlyField
          label="Custo total do projeto"
          value={
            <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>
              {fmtCurrency(custoTotal)}
            </strong>
          }
        />
      </div>

      {/* ── Venda — Receitas e Condições ─────────────────────── */}
      <SectionTitle title="Receitas e Condições (Venda)" />
      <div className="fm-detail-grid fm-detail-grid--edit">
        <FieldNumber
          id="pf-venda-valor-venda"
          label="Valor de venda"
          unit="R$"
          value={form.valor_venda}
          onChange={(v) => setField('valor_venda', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-venda-entrada"
          label="Entrada"
          unit="%"
          value={form.entrada_pct}
          onChange={(v) => setField('entrada_pct', v ?? undefined)}
          step={0.1}
          min={0}
        />
        <FieldNumber
          id="pf-venda-parcelamento"
          label="Parcelamento"
          unit="x"
          value={form.parcelamento_meses}
          onChange={(v) => setField('parcelamento_meses', v ?? undefined)}
          step={1}
          min={1}
        />
        <FieldNumber
          id="pf-venda-receita"
          label="Receita total esperada"
          unit="R$"
          value={form.receita_esperada}
          onChange={(v) => setField('receita_esperada', v ?? undefined)}
          step={0.01}
          hint="(total recebido)"
        />
      </div>

      {/* ── KPIs Financeiros ─────────────────────────────────── */}
      <SectionTitle title="KPIs Financeiros (calculados pelo motor)" />
      <div className="fm-detail-grid fm-detail-grid--edit">
        <FieldWithOverride
          id="pf-venda-payback"
          label="Payback"
          field="payback_meses"
          effectiveValue={calculated.payback_meses}
          isOverridden={'payback_meses' in overrides}
          overrideValue={overrides.payback_meses ?? null}
          unit="meses"
          step={0.1}
          format={(v) => fmtNum(v, 1)}
          onOverride={setOverride}
          onRestore={restoreAuto}
        />
        <FieldWithOverride
          id="pf-venda-roi"
          label="ROI"
          field="roi_pct"
          effectiveValue={calculated.roi_pct}
          isOverridden={'roi_pct' in overrides}
          overrideValue={overrides.roi_pct ?? null}
          unit="%"
          step={0.01}
          format={(v) => v != null ? `${fmtNum(v, 1)}%` : '—'}
          onOverride={setOverride}
          onRestore={restoreAuto}
        />
        <FieldWithOverride
          id="pf-venda-tir"
          label="TIR (IRR anual)"
          field="tir_pct"
          effectiveValue={calculated.tir_pct}
          isOverridden={'tir_pct' in overrides}
          overrideValue={overrides.tir_pct ?? null}
          unit="% a.a."
          step={0.01}
          format={(v) => v != null ? `${fmtNum(v, 1)}%` : '—'}
          onOverride={setOverride}
          onRestore={restoreAuto}
        />
        <FieldWithOverride
          id="pf-venda-vpl"
          label="VPL (NPV)"
          field="vpl"
          effectiveValue={calculated.vpl}
          isOverridden={'vpl' in overrides}
          overrideValue={overrides.vpl ?? null}
          unit="R$"
          step={0.01}
          format={fmtCurrency}
          onOverride={setOverride}
          onRestore={restoreAuto}
        />
      </div>

      {/* ── Observações ─────────────────────────────────────── */}
      <SectionTitle title="Observações" />
      <div className="fm-detail-grid">
        <FieldText
          id="pf-venda-notas"
          label="Notas / Observações"
          value={form.notas}
          onChange={(v) => setField('notas', v || undefined)}
          rows={3}
        />
      </div>
    </div>
  )
}
