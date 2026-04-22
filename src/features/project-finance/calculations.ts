// src/features/project-finance/calculations.ts
// Pure functions for deriving financial KPIs from a profile form state.
// Uses the same engine functions as the Análise Financeira:
//   - calcularKpis (from analiseFinanceiraSpreadsheet) for KPI computation
//   - impostos_percent applied to fator_liquido, matching AnaliseFinanceiraInput
//
// System sizing values (potência, geração, consumo) come from the project's
// Usina Fotovoltaica (ProjectPvData) — NOT from the financial form itself.
// No React, no side effects — safe to call from anywhere.

import { calcularKpis } from '../../lib/finance/analiseFinanceiraSpreadsheet'
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
 * SAME engine as the Análise Financeira (calcularKpis from
 * analiseFinanceiraSpreadsheet, which internally uses computeIRR, computeNPV,
 * computePayback).
 *
 * Cash-flow construction mirrors the Análise Financeira methodology:
 *  - Leasing: fator_liquido = 1 − impostos − inadimplência − opex
 *             investment base = capex (costs already include seguro/CAC)
 *  - Venda:   lucro líquido = lucro bruto − impostos sobre a receita
 *             single-period flow: t0 = −capex, t1 = capex + lucro_liquido
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
  const impostosPercent = technicalParams?.impostos_percent ?? 0

  const capex = computeCustoTotal(form)

  const nullKPIs: ProjectFinanceComputed = { payback_meses: null, roi_pct: null, tir_pct: null, vpl: null }

  if (capex == null || capex <= 0) return nullKPIs

  if (contractType === 'leasing') {
    const prazo = contractTermMonths
    const mensalidade = form.mensalidade_base ?? null

    if (!mensalidade || mensalidade <= 0 || prazo <= 0) return nullKPIs

    // fator_liquido mirrors analiseFinanceiraSpreadsheet.calcularAnaliseLeasing:
    // 1 − impostos − inadimplência − custo_operacional
    const impostos = impostosPercent / 100
    const inadimplencia = (form.inadimplencia_pct ?? 0) / 100
    const opex = (form.opex_pct ?? 0) / 100
    const fatorLiquido = Math.max(0, 1 - impostos - inadimplencia - opex)
    const mensalidadeLiquida = mensalidade * fatorLiquido

    // fluxos = net inflows only (without t0) — calcularKpis prepends −capex
    const fluxos: number[] = Array<number>(prazo).fill(mensalidadeLiquida)

    const receitaLiquida = mensalidadeLiquida * prazo
    const lucro = receitaLiquida - capex

    const kpis = calcularKpis(fluxos, capex, lucro, taxaDesconto)

    return {
      payback_meses: kpis.payback_meses,
      roi_pct: kpis.roi_percent,
      tir_pct: kpis.tir_anual_percent,
      vpl: kpis.vpl,
    }
  }

  // venda: mirrors analiseFinanceiraSpreadsheet.calcularAnaliseVenda KPI path.
  // t0: −capex, t1: capex + lucro_liquido  (single-period transaction)
  const receita = form.receita_esperada ?? form.valor_venda ?? null
  if (!receita || receita <= 0) return nullKPIs

  const impostosRs = receita * (impostosPercent / 100)
  const lucroBruto = receita - capex
  const lucroLiquido = lucroBruto - impostosRs

  // fluxos = inflow at t1 only (without t0) — calcularKpis prepends −capex
  const fluxos: number[] = [capex + lucroLiquido]

  const kpis = calcularKpis(fluxos, capex, lucroLiquido, taxaDesconto)

  return {
    payback_meses: kpis.payback_meses,
    roi_pct: kpis.roi_percent,
    tir_pct: kpis.tir_anual_percent,
    vpl: kpis.vpl,
  }
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
