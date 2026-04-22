// src/features/project-finance/calculations.ts
// Pure functions for deriving financial KPIs from a profile form state.
// Uses the same engine functions as the Análise Financeira:
//   - calcularBaseSistema (system sizing from consumo)
//   - computeIRR, computeNPV, computePayback (from investmentMetrics)
// No React, no side effects — safe to call from anywhere.

import { calcularBaseSistema } from '../../lib/finance/analiseFinanceiraSpreadsheet'
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

// ─── Defaults for system-sizing parameters ───────────────────────────────────
// Used when the caller does not supply explicit technical params.
// Values represent Brazilian average conditions.

export const DEFAULT_IRRADIACAO_KWH_M2_DIA = 4.5
export const DEFAULT_PERFORMANCE_RATIO = 0.75
export const DEFAULT_DIAS_MES = 30
export const DEFAULT_POTENCIA_MODULO_WP = 590

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
 * SAME engine as the Análise Financeira (calcularBaseSistema, computeIRR,
 * computeNPV, computePayback).
 *
 * Returns null for any metric that cannot be computed due to missing inputs.
 */
export function computeProjectKPIs(
  form: ProjectFinanceFormState,
  contractType: ProjectFinanceContractType,
  contractTermMonths: number,
  technicalParams?: ProjectFinanceTechnicalParams,
): ProjectFinanceComputed {
  const irradiacao = technicalParams?.irradiacao_kwh_m2_dia ?? DEFAULT_IRRADIACAO_KWH_M2_DIA
  const pr = technicalParams?.performance_ratio ?? DEFAULT_PERFORMANCE_RATIO
  const dias = technicalParams?.dias_mes ?? DEFAULT_DIAS_MES
  const moduloWp = technicalParams?.potencia_modulo_wp ?? DEFAULT_POTENCIA_MODULO_WP
  const taxaDesconto = technicalParams?.taxa_desconto_aa_pct ?? null

  // ── System sizing ─────────────────────────────────────────────────────────
  const consumo = form.consumo_kwh_mes ?? null
  let potencia_instalada_kwp: number | null = null
  let geracao_estimada_kwh_mes: number | null = null

  if (consumo != null && consumo > 0) {
    try {
      const sys = calcularBaseSistema({
        consumo_kwh_mes: consumo,
        irradiacao_kwh_m2_dia: irradiacao,
        performance_ratio: pr,
        dias_mes: dias,
        potencia_modulo_wp: moduloWp,
      })
      potencia_instalada_kwp = sys.potencia_sistema_kwp
      geracao_estimada_kwh_mes = sys.potencia_sistema_kwp * irradiacao * pr * dias
    } catch {
      // engine errors → leave null
    }
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const capex = computeCustoTotal(form)

  if (capex == null || capex <= 0) {
    return { potencia_instalada_kwp, geracao_estimada_kwh_mes, payback_meses: null, roi_pct: null, tir_pct: null, vpl: null }
  }

  if (contractType === 'leasing') {
    const prazo = contractTermMonths
    const mensalidade = form.mensalidade_base ?? null

    if (!mensalidade || mensalidade <= 0 || prazo <= 0) {
      return { potencia_instalada_kwp, geracao_estimada_kwh_mes, payback_meses: null, roi_pct: null, tir_pct: null, vpl: null }
    }

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

    return { potencia_instalada_kwp, geracao_estimada_kwh_mes, payback_meses, roi_pct, tir_pct, vpl }
  }

  // venda
  const receita = form.receita_esperada ?? form.valor_venda ?? null
  if (!receita || receita <= 0) {
    return { potencia_instalada_kwp, geracao_estimada_kwh_mes, payback_meses: null, roi_pct: null, tir_pct: null, vpl: null }
  }

  const lucro = receita - capex
  const roi_pct = (lucro / capex) * 100

  // Venda: single-period flow — t0: −capex, t1: +receita
  const flows: number[] = [-capex, receita]
  const payback_meses = computePayback(flows)
  const tirMensal = computeIRR(flows)
  const tir_pct = tirMensal !== null ? tirMensal * 100 : null

  const taxaMensal = taxaDesconto != null && taxaDesconto > 0 ? toMonthlyRate(taxaDesconto) : 0
  const vpl = taxaMensal > 0 ? computeNPV(flows, taxaMensal) : null

  return { potencia_instalada_kwp, geracao_estimada_kwh_mes, payback_meses, roi_pct, tir_pct, vpl }
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
 * Mirrors the pseudocode from the problem specification.
 */
export function computeProjectFinancialState(
  form: ProjectFinanceFormState,
  contractType: ProjectFinanceContractType,
  contractTermMonths: number,
  overrides: ProjectFinanceOverrides = {},
  technicalParams?: ProjectFinanceTechnicalParams,
): { calculated: ProjectFinanceComputed; effective: ProjectFinanceComputed } {
  const calculated = computeProjectKPIs(form, contractType, contractTermMonths, technicalParams)
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
