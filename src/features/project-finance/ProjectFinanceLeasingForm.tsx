// src/features/project-finance/ProjectFinanceLeasingForm.tsx
// Editable form for the Leasing variant of the project financial profile.
// Shows cost, revenue, leasing-specific and KPI fields.
// Does NOT include modules: Nova Simulação, Simulações Salvas, IA, Monte Carlo,
// Packs, Análise Financeira checklist, Módulo Dedicado (Aprovar/Reprovar).

import React from 'react'
import type { ProjectFinanceFormState } from './types'
import { computeCustoTotal } from './calculations'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
      <input
        id={id}
        className="fm-form-input"
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
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
  setField: <K extends keyof ProjectFinanceFormState>(key: K, value: ProjectFinanceFormState[K]) => void
}

export function ProjectFinanceLeasingForm({ form, setField }: Props) {
  const custoTotal = computeCustoTotal(form)

  return (
    <div>
      {/* ── Sistema Fotovoltaico ─────────────────────────────── */}
      <SectionTitle title="Sistema Fotovoltaico" />
      <div className="fm-detail-grid fm-detail-grid--edit">
        <FieldNumber
          id="pf-leasing-consumo"
          label="Consumo"
          unit="kWh/mês"
          value={form.consumo_kwh_mes}
          onChange={(v) => setField('consumo_kwh_mes', v ?? undefined)}
        />
        <FieldNumber
          id="pf-leasing-potencia"
          label="Potência instalada"
          unit="kWp"
          value={form.potencia_instalada_kwp}
          onChange={(v) => setField('potencia_instalada_kwp', v ?? undefined)}
          step={0.001}
        />
        <FieldNumber
          id="pf-leasing-geracao"
          label="Geração estimada"
          unit="kWh/mês"
          value={form.geracao_estimada_kwh_mes}
          onChange={(v) => setField('geracao_estimada_kwh_mes', v ?? undefined)}
        />
        <FieldNumber
          id="pf-leasing-prazo"
          label="Prazo contratual"
          unit="meses"
          value={form.prazo_contratual_meses}
          onChange={(v) => setField('prazo_contratual_meses', v ?? undefined)}
          step={1}
        />
      </div>

      {/* ── Custos do Projeto ────────────────────────────────── */}
      <SectionTitle title="Custos do Projeto" />
      <div className="fm-detail-grid fm-detail-grid--edit">
        <FieldNumber
          id="pf-leasing-equipamentos"
          label="Equipamentos (Kit)"
          unit="R$"
          value={form.custo_equipamentos}
          onChange={(v) => setField('custo_equipamentos', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-leasing-instalacao"
          label="Instalação"
          unit="R$"
          value={form.custo_instalacao}
          onChange={(v) => setField('custo_instalacao', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-leasing-engenharia"
          label="Engenharia / Projeto"
          unit="R$"
          value={form.custo_engenharia}
          onChange={(v) => setField('custo_engenharia', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-leasing-homologacao"
          label="Homologação / CREA"
          unit="R$"
          value={form.custo_homologacao}
          onChange={(v) => setField('custo_homologacao', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-leasing-frete"
          label="Frete / Logística"
          unit="R$"
          value={form.custo_frete_logistica}
          onChange={(v) => setField('custo_frete_logistica', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-leasing-comissao"
          label="Comissão (CAC)"
          unit="R$"
          value={form.custo_comissao}
          onChange={(v) => setField('custo_comissao', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-leasing-impostos"
          label="Impostos / Taxas"
          unit="R$"
          value={form.custo_impostos}
          onChange={(v) => setField('custo_impostos', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-leasing-diversos"
          label="Custos diversos"
          unit="R$"
          value={form.custo_diversos}
          onChange={(v) => setField('custo_diversos', v ?? undefined)}
          step={0.01}
        />
        {/* Custo total — read only, auto-computed */}
        <ReadonlyField
          label="Custo total do projeto"
          value={
            <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>
              {fmtCurrency(custoTotal)}
            </strong>
          }
        />
      </div>

      {/* ── Leasing — Receitas e Premissas ───────────────────── */}
      <SectionTitle title="Receitas e Premissas (Leasing)" />
      <div className="fm-detail-grid fm-detail-grid--edit">
        <FieldNumber
          id="pf-leasing-mensalidade"
          label="Mensalidade base"
          unit="R$/mês"
          value={form.mensalidade_base}
          onChange={(v) => setField('mensalidade_base', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-leasing-desconto"
          label="Desconto ao cliente"
          unit="%"
          value={form.desconto_percentual}
          onChange={(v) => setField('desconto_percentual', v ?? undefined)}
          step={0.01}
          min={0}
        />
        <FieldNumber
          id="pf-leasing-reajuste"
          label="Reajuste anual"
          unit="% a.a."
          value={form.reajuste_anual_pct}
          onChange={(v) => setField('reajuste_anual_pct', v ?? undefined)}
          step={0.01}
          min={0}
        />
        <FieldNumber
          id="pf-leasing-inadimplencia"
          label="Taxa de inadimplência"
          unit="%"
          value={form.inadimplencia_pct}
          onChange={(v) => setField('inadimplencia_pct', v ?? undefined)}
          step={0.01}
          min={0}
        />
        <FieldNumber
          id="pf-leasing-opex"
          label="OpEx operacional"
          unit="% a.a."
          value={form.opex_pct}
          onChange={(v) => setField('opex_pct', v ?? undefined)}
          step={0.01}
          min={0}
        />
        <FieldNumber
          id="pf-leasing-seguro"
          label="Seguro"
          unit="R$"
          value={form.custo_seguro}
          onChange={(v) => setField('custo_seguro', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-leasing-manutencao"
          label="Manutenção"
          unit="R$"
          value={form.custo_manutencao}
          onChange={(v) => setField('custo_manutencao', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-leasing-receita"
          label="Receita total esperada"
          unit="R$"
          value={form.receita_esperada}
          onChange={(v) => setField('receita_esperada', v ?? undefined)}
          step={0.01}
          hint="(contrato completo)"
        />
      </div>

      {/* ── KPIs ────────────────────────────────────────────── */}
      <SectionTitle title="KPIs Financeiros" />
      <div className="fm-detail-grid fm-detail-grid--edit">
        <FieldNumber
          id="pf-leasing-payback"
          label="Payback"
          unit="meses"
          value={form.payback_meses}
          onChange={(v) => setField('payback_meses', v ?? undefined)}
          step={0.1}
        />
        <FieldNumber
          id="pf-leasing-roi"
          label="ROI"
          unit="%"
          value={form.roi_pct}
          onChange={(v) => setField('roi_pct', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-leasing-tir"
          label="TIR (IRR)"
          unit="% a.a."
          value={form.tir_pct}
          onChange={(v) => setField('tir_pct', v ?? undefined)}
          step={0.01}
        />
        <FieldNumber
          id="pf-leasing-vpl"
          label="VPL (NPV)"
          unit="R$"
          value={form.vpl}
          onChange={(v) => setField('vpl', v ?? undefined)}
          step={0.01}
        />
      </div>

      {/* ── Observações ─────────────────────────────────────── */}
      <SectionTitle title="Observações" />
      <div className="fm-detail-grid">
        <FieldText
          id="pf-leasing-notas"
          label="Notas / Observações"
          value={form.notas}
          onChange={(v) => setField('notas', v || undefined)}
          rows={3}
        />
      </div>
    </div>
  )
}
