// src/features/project-finance/calculations.ts
// Pure functions for deriving financial KPIs from a profile form state.
// Uses the same engine functions as the Análise Financeira:
//   - computeIRR, computeNPV, computePayback (from investmentMetrics)
//
// System sizing values (potência, geração, consumo) come from the project's
// Usina Fotovoltaica (ProjectPvData) — NOT from the financial form itself.
// No React, no side effects — safe to call from anywhere.

import {
  computeIRR,
  computeNPV,
  computePayback,
  toMonthlyRate,
} from '../../lib/finance/investmentMetrics'
import type {
  ProjectFinanceFormState,
  ProjectFinanceSummaryKPIs,
  ProjectFinanceContractType,
  ProjectFinanceComputed,
  ProjectFinanceOverrides,
  ProjectFinanceTechnicalParams,
  OverridableField,
} from './types'
import type { ProjectPvData } from '../../domain/projects/types'

// ─── Cost helpers ─────────────────────────────────────────────────────────────

/** Sum all cost fields, treating nulls as 0. Returns null if ALL are null. */
export function computeCustoTotal(form: ProjectFinanceFormState): number | null {
  const fields: (number | null | undefined)[] = [
    form.custo_equipamentos,
    form.custo_instalacao,
    form.custo_engenharia,
    form.custo_homologacao,
    form.custo_frete_logistica,
    form.custo_comissao,
    form.custo_impostos,
    form.custo_diversos,
  ]
  const anyNonNull = fields.some((v) => v != null)
  if (!anyNonNull) return null
  return fields.reduce<number>((sum, v) => sum + (v ?? 0), 0)
}

export function computeLucroEsperado(
  receita: number | null | undefined,
  custoTotal: number | null,
): number | null {
  if (receita == null || custoTotal == null) return null
  return receita - custoTotal
}

export function computeMargemEsperadaPct(
  receita: number | null | undefined,
  lucro: number | null,
): number | null {
  if (receita == null || receita === 0 || lucro == null) return null
  return (lucro / receita) * 100
}

// ─── Shared engine bridge ─────────────────────────────────────────────────────

/**
 * Computes the auto-calculated financial KPIs for a project using the
 * SAME engine as the Análise Financeira (computeIRR, computeNPV, computePayback).
 *
 * System sizing values (consumo, potência, geração) come from pvData
 * (Usina Fotovoltaica) — not from the financial form.
 *
 * Returns null for any metric that cannot be computed due to missing inputs.
 */
export function computeProjectKPIs(
  form: ProjectFinanceFormState,
  contractType: ProjectFinanceContractType,
  contractTermMonths: number,
  pvData: ProjectPvData | null,
  technicalParams?: ProjectFinanceTechnicalParams,
): ProjectFinanceComputed {
  const taxaDesconto = technicalParams?.taxa_desconto_aa_pct ?? null

  const capex = computeCustoTotal(form)

  const nullKPIs: ProjectFinanceComputed = { payback_meses: null, roi_pct: null, tir_pct: null, vpl: null }

  if (capex == null || capex <= 0) return nullKPIs

  if (contractType === 'leasing') {
    const prazo = contractTermMonths
    const mensalidade = form.mensalidade_base ?? null

    if (!mensalidade || mensalidade <= 0 || prazo <= 0) return nullKPIs

    const inadimplencia = (form.inadimplencia_pct ?? 0) / 100
    const opex = (form.opex_pct ?? 0) / 100
    const fatorLiquido = Math.max(0, 1 - inadimplencia - opex)
    const mensalidadeLiquida = mensalidade * fatorLiquido

    // Build monthly cash-flow series: t0 = −capex, t1..tn = mensalidade líquida
    const flows: number[] = [-capex, ...Array<number>(prazo).fill(mensalidadeLiquida)]

    const payback_meses = computePayback(flows)

    const tirMensal = computeIRR(flows)
    const tir_pct = tirMensal !== null ? (Math.pow(1 + tirMensal, 12) - 1) * 100 : null

    const taxaMensal = taxaDesconto != null && taxaDesconto > 0 ? toMonthlyRate(taxaDesconto) : 0
    const vpl = taxaMensal > 0 ? computeNPV(flows, taxaMensal) : null

    const receitaLiquida = mensalidadeLiquida * prazo
    const lucro = receitaLiquida - capex
    const roi_pct = capex > 0 ? (lucro / capex) * 100 : 0

    return { payback_meses, roi_pct, tir_pct, vpl }
  }

  // venda
  const receita = form.receita_esperada ?? form.valor_venda ?? null
  if (!receita || receita <= 0) return nullKPIs

  const lucro = receita - capex
  const roi_pct = (lucro / capex) * 100

  // Venda: single-period flow — t0: −capex, t1: +receita
  const flows: number[] = [-capex, receita]
  const payback_meses = computePayback(flows)
  const tirMensal = computeIRR(flows)
  // Annualize monthly IRR to % a.a. — same formula as leasing path above.
  const tir_pct = tirMensal !== null ? (Math.pow(1 + tirMensal, 12) - 1) * 100 : null

  const taxaMensal = taxaDesconto != null && taxaDesconto > 0 ? toMonthlyRate(taxaDesconto) : 0
  const vpl = taxaMensal > 0 ? computeNPV(flows, taxaMensal) : null

  return { payback_meses, roi_pct, tir_pct, vpl }
}

/**
 * Applies manual overrides on top of auto-calculated values.
 * A field is used from overrides only when it has been explicitly set
 * (i.e. the key exists in the overrides object with a non-undefined value).
 */
export function applyOverrides(
  calculated: ProjectFinanceComputed,
  overrides: ProjectFinanceOverrides,
): ProjectFinanceComputed {
  const effective = { ...calculated }
  const keys = Object.keys(overrides) as OverridableField[]
  for (const key of keys) {
    const v = overrides[key]
    if (v !== undefined) {
      effective[key] = v
    }
  }
  return effective
}

/**
 * Main orchestrator — maps inputs → calculated → effective.
 * System sizing values come from pvData (Usina Fotovoltaica), not the form.
 */
export function computeProjectFinancialState(
  form: ProjectFinanceFormState,
  contractType: ProjectFinanceContractType,
  contractTermMonths: number,
  pvData: ProjectPvData | null,
  overrides: ProjectFinanceOverrides = {},
  technicalParams?: ProjectFinanceTechnicalParams,
): { calculated: ProjectFinanceComputed; effective: ProjectFinanceComputed } {
  const calculated = computeProjectKPIs(form, contractType, contractTermMonths, pvData, technicalParams)
  const effective = applyOverrides(calculated, overrides)
  return { calculated, effective }
}

// ─── Summary KPIs ─────────────────────────────────────────────────────────────

/**
 * Compute all derived KPIs from a form state snapshot.
 * The returned object matches the ProjectFinanceSummaryKPIs shape.
 */
export function computeSummaryKPIs(
  form: ProjectFinanceFormState,
  contractType: ProjectFinanceContractType,
  updatedAt?: string | null,
): ProjectFinanceSummaryKPIs {
  const custo_total_projeto = computeCustoTotal(form)
  const lucro_esperado = computeLucroEsperado(form.receita_esperada, custo_total_projeto)
  const margem_esperada_pct = computeMargemEsperadaPct(form.receita_esperada, lucro_esperado)

  return {
    custo_total_projeto,
    receita_esperada: form.receita_esperada ?? null,
    lucro_esperado,
    margem_esperada_pct,
    payback_meses: form.payback_meses ?? null,
    roi_pct: form.roi_pct ?? null,
    contract_type: contractType,
    status: form.status ?? 'draft',
    updated_at: updatedAt ?? null,
  }
}
