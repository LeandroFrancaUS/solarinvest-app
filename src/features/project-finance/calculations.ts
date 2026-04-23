// src/features/project-finance/calculations.ts
// Pure functions for deriving financial KPIs from a profile form state.
// Uses the same engine functions as the Análise Financeira:
//   - calcularKpis (from analiseFinanceiraSpreadsheet) for KPI computation
//   - impostos_percent applied to fator_liquido, matching AnaliseFinanceiraInput
//   - deriveProjectFinanceCosts for auto-populating cost breakdown fields
//
// System sizing values (potência, geração, consumo) come from the project's
// Usina Fotovoltaica (ProjectPvData) — NOT from the financial form itself.
// No React, no side effects — safe to call from anywhere.

import {
  calcularKpis,
  resolveCustoProjetoPorFaixa,
  calcSeguroLeasing,
  SEGURO_LIMIAR_RS,
  SEGURO_FAIXA_BAIXA_PERCENT,
  SEGURO_FAIXA_ALTA_PERCENT,
  SEGURO_PISO_RS,
  CREA_GO_RS,
  CREA_DF_RS,
  PROJETO_FAIXAS,
} from '../../lib/finance/analiseFinanceiraSpreadsheet'
import { computeTaxes } from '../../domain/finance/taxation'
import type {
  ProjectFinanceFormState,
  ProjectFinanceSummaryKPIs,
  ProjectFinanceContractType,
  ProjectFinanceComputed,
  ProjectFinanceOverrides,
  ProjectFinanceTechnicalParams,
  ProjectFinanceDeriveParams,
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
    form.custo_seguro,
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
): Omit<ProjectFinanceComputed, 'mensalidade_base'> {
  const taxaDesconto = technicalParams?.taxa_desconto_aa_pct ?? null
  const impostosPercent = technicalParams?.impostos_percent ?? 0

  const capex = computeCustoTotal(form)

  const nullKPIs: Omit<ProjectFinanceComputed, 'mensalidade_base'> = { payback_meses: null, roi_pct: null, tir_pct: null, vpl: null }

  if (capex == null || capex <= 0) return nullKPIs

  if (contractType === 'leasing') {
    const prazo = contractTermMonths
    const mensalidade = form.mensalidade_base ?? null

    if (!mensalidade || mensalidade <= 0 || prazo <= 0) return nullKPIs

    // Imposto incide somente sobre a mensalidade (leasing) — usa computeTaxes.
    const taxResult = computeTaxes({
      modo: 'leasing',
      mensalidade,
      aliquota: impostosPercent / 100,
    })
    const impostosFrac = mensalidade > 0 ? taxResult.valorImposto / mensalidade : 0
    const inadimplencia = (form.inadimplencia_pct ?? 0) / 100
    const opex = (form.opex_pct ?? 0) / 100
    const fatorLiquido = Math.max(0, 1 - impostosFrac - inadimplencia - opex)
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

  // Imposto incide sobre o valor do contrato excluindo custo do kit e frete (venda).
  const custoKit = form.custo_equipamentos ?? 0
  const frete = form.custo_frete_logistica ?? 0
  const taxResult = computeTaxes({
    modo: 'venda',
    totalAntesImposto: receita,
    custoKit,
    frete,
    aliquota: impostosPercent / 100,
  })
  const impostosRs = taxResult.valorImposto
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
 * Computes the auto-calculated `mensalidade_base` for leasing using the same
 * formula as the Análise Financeira "Mensalidade bruta":
 *   mensalidade_base = consumo_kwh × tarifa_kwh × (1 − desconto / 100)
 *
 * Returns null when any required input (consumo, tarifa) is unavailable.
 * The discount defaults to 0 when not supplied — so the raw monthly energy
 * cost is returned when the discount is unknown.
 */
export function computeMensalidadeBaseAuto(
  pvData: ProjectPvData | null,
  form: ProjectFinanceFormState,
  technicalParams?: ProjectFinanceTechnicalParams,
): number | null {
  const consumo = pvData?.consumo_kwh_mes ?? null
  const tarifa = technicalParams?.tarifa_kwh ?? null
  if (consumo == null || consumo <= 0 || tarifa == null || tarifa <= 0) return null
  const desconto = form.desconto_percentual ?? 0
  return consumo * tarifa * (1 - desconto / 100)
}

/**
 * Main orchestrator — maps inputs → calculated → effective.
 * System sizing values come from pvData (Usina Fotovoltaica), not the form.
 *
 * mensalidade_base is auto-computed via the AF engine formula
 * (consumo × tarifa × (1 − desconto/100)) and added to the calculated/effective
 * objects. The effective value respects any manual override stored in overrides.
 * KPI computation uses the effective mensalidade_base so that overriding it
 * propagates correctly to payback, ROI, TIR, and VPL.
 */
export function computeProjectFinancialState(
  form: ProjectFinanceFormState,
  contractType: ProjectFinanceContractType,
  contractTermMonths: number,
  pvData: ProjectPvData | null,
  overrides: ProjectFinanceOverrides = {},
  technicalParams?: ProjectFinanceTechnicalParams,
): { calculated: ProjectFinanceComputed; effective: ProjectFinanceComputed } {
  // Step 1: compute auto mensalidade_base from tariff engine formula
  const mensalidadeBaseAuto = contractType === 'leasing'
    ? computeMensalidadeBaseAuto(pvData, form, technicalParams)
    : null

  // Step 2: determine effective mensalidade_base (override wins over auto)
  const effectiveMensalidadeBase: number | null =
    'mensalidade_base' in overrides && overrides.mensalidade_base != null
      ? overrides.mensalidade_base
      : mensalidadeBaseAuto

  // Step 3: inject effective mensalidade_base into form so KPI engine sees it.
  // Fall back to the existing form value when no effective value is available
  // (e.g. tarifa_kwh not yet loaded), so the KPI computation never silently
  // ignores a value that was already manually saved on the profile.
  const mensalidadeForKpis = effectiveMensalidadeBase ?? form.mensalidade_base ?? null
  const formForKpis: ProjectFinanceFormState = { ...form }
  if (mensalidadeForKpis != null) {
    formForKpis.mensalidade_base = mensalidadeForKpis
  }

  // Step 4: compute remaining KPIs
  const kpis = computeProjectKPIs(formForKpis, contractType, contractTermMonths, pvData, technicalParams)

  // Step 5: assemble calculated (auto values only) and effective (overrides applied)
  const calculated: ProjectFinanceComputed = { mensalidade_base: mensalidadeBaseAuto, ...kpis }

  // Apply overrides to KPI fields (mensalidade_base override was already handled above).
  // Build effective by starting from calculated and applying any KPI overrides explicitly.
  const effective: ProjectFinanceComputed = {
    mensalidade_base: effectiveMensalidadeBase,
    payback_meses: 'payback_meses' in overrides && overrides.payback_meses != null
      ? overrides.payback_meses
      : kpis.payback_meses,
    roi_pct: 'roi_pct' in overrides && overrides.roi_pct != null
      ? overrides.roi_pct
      : kpis.roi_pct,
    tir_pct: 'tir_pct' in overrides && overrides.tir_pct != null
      ? overrides.tir_pct
      : kpis.tir_pct,
    vpl: 'vpl' in overrides && overrides.vpl != null
      ? overrides.vpl
      : kpis.vpl,
  }

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

// ─── Engine-driven cost derivation ───────────────────────────────────────────

/**
 * Default leasing premises used by the AF (Análise Financeira) screen.
 *
 * These match the initial state values in `App.tsx` (search for
 * `setAfImpostosLeasing`, `setAfInadimplencia`, `setAfCustoOperacional`):
 *   afImpostosLeasing  = 4   → handled by deriveParams.impostos_leasing_percent
 *   afInadimplencia    = 2
 *   afCustoOperacional = 3
 *
 * `reajuste_anual_pct = 4` mirrors the default tarifa-reajuste used in
 * the proposal forms (`App.tsx`, e.g. `reajusteAnualPct: '3'..'4'`).
 *
 * They are applied by `deriveProjectFinanceCosts` whenever the corresponding
 * `ProjectFinanceDeriveParams` field is null/undefined — so calling
 * "Preencher campos vazios" on a fresh leasing project produces sane
 * non-zero starting values instead of writing 0% everywhere.
 */
export const LEASING_PREMISE_DEFAULTS = {
  reajuste_anual_pct: 4,
  inadimplencia_pct: 2,
  custo_operacional_pct: 3,
  custo_manutencao: 0,
} as const

/**
 * Auto-computes project cost-breakdown fields using the SAME formulas as the
 * Análise Financeira screen (App.tsx).  Intended for pre-filling the
 * Gestão Financeira form when a project has pvData but no saved profile.
 *
 * Auto-pricing formulas (same as App.tsx reactive effect):
 *   custo_equipamentos    = round(1500 + 9.5  × consumo)
 *   custo_frete_logistica = round(300  + 0.52 × consumo)
 *   custo_instalacao      = numero_modulos × 70
 *     (numero_modulos falls back to ceil(kwp × 1000 / modulo_wp) when not provided)
 *
 * Engine functions from analiseFinanceiraSpreadsheet:
 *   custo_engenharia  = resolveCustoProjetoPorFaixa(kwp, faixas)
 *   custo_homologacao = CREA by UF
 *
 * Leasing-specific (only populated when mensalidade_base is provided):
 *   custo_comissao = mensalidade_base  (CAC = first monthly payment)
 *   custo_seguro   = calcSeguroLeasing(capex_base)
 *   custo_impostos = impostos_leasing_percent × mensalidade × prazo
 *
 * Returns only fields that could be derived; any field whose inputs are
 * missing is simply absent from the returned object.
 */
export function deriveProjectFinanceCosts(
  params: ProjectFinanceDeriveParams,
  contractType: ProjectFinanceContractType,
): Partial<ProjectFinanceFormState> {
  const {
    consumo_kwh_mes,
    potencia_sistema_kwp,
    numero_modulos,
    potencia_modulo_wp,
    uf,
    mensalidade_base,
    prazo_meses,
    reajuste_anual_pct,
    inadimplencia_pct,
    custo_operacional_pct,
    custo_manutencao,
    receita_esperada,
    crea_go_rs = CREA_GO_RS,
    crea_df_rs = CREA_DF_RS,
    projeto_faixas = PROJETO_FAIXAS,
    seguro_limiar_rs = SEGURO_LIMIAR_RS,
    seguro_faixa_baixa_percent = SEGURO_FAIXA_BAIXA_PERCENT,
    seguro_faixa_alta_percent = SEGURO_FAIXA_ALTA_PERCENT,
    seguro_piso_rs = SEGURO_PISO_RS,
    impostos_leasing_percent = 4,
    impostos_venda_percent = 6,
    comissao_minima_percent = 5,
  } = params

  const result: Partial<ProjectFinanceFormState> = {}

  const consumo = consumo_kwh_mes != null && consumo_kwh_mes > 0 ? consumo_kwh_mes : null
  const kwp = potencia_sistema_kwp != null && potencia_sistema_kwp > 0 ? potencia_sistema_kwp : null
  const resolvedUf = uf === 'DF' ? 'DF' : 'GO'

  // ── Auto-pricing: kit and freight (same formulas as App.tsx) ──────────────
  if (consumo != null) {
    result.custo_equipamentos = Math.round(1500 + 9.5 * consumo)
    result.custo_frete_logistica = Math.round(300 + 0.52 * consumo)
  }

  // ── Installation cost: numero_modulos × R$70 (same as App.tsx) ───────────
  //    Falls back to ceil(kwp × 1000 / modulo_wp) when numero_modulos is not
  //    directly available from pvData.
  {
    let numModulos: number | null = numero_modulos != null && numero_modulos > 0 ? numero_modulos : null
    if (numModulos == null && kwp != null && potencia_modulo_wp != null && potencia_modulo_wp > 0) {
      numModulos = Math.ceil((kwp * 1000) / potencia_modulo_wp)
    }
    if (numModulos != null) {
      result.custo_instalacao = numModulos * 70
    }
  }

  // ── Engineering cost: by kWp faixa ────────────────────────────────────────
  if (kwp != null) {
    result.custo_engenharia = resolveCustoProjetoPorFaixa(kwp, projeto_faixas)
  }

  // ── CREA: by UF ───────────────────────────────────────────────────────────
  result.custo_homologacao = resolvedUf === 'DF' ? crea_df_rs : crea_go_rs

  // ── CAPEX base (for seguro calculation) ───────────────────────────────────
  const capexBase =
    (result.custo_equipamentos ?? 0) +
    (result.custo_instalacao ?? 0) +
    (result.custo_frete_logistica ?? 0) +
    (result.custo_engenharia ?? 0) +
    (result.custo_homologacao ?? 0)

  if (contractType === 'leasing') {
    if (mensalidade_base != null && mensalidade_base > 0) {
      result.mensalidade_base = mensalidade_base
    }

    // ── Apply LEASING_PREMISE_DEFAULTS when the caller did not supply a value.
    //    The AF screen (App.tsx) treats null / not-yet-typed inputs as their
    //    default (4 / 2 / 3 / 0), so the Financeiro tool matches that to keep
    //    "Preencher campos vazios" useful out of the box.
    const reajusteEffective =
      reajuste_anual_pct != null && reajuste_anual_pct >= 0
        ? reajuste_anual_pct
        : LEASING_PREMISE_DEFAULTS.reajuste_anual_pct
    result.reajuste_anual_pct = reajusteEffective

    const inadimplenciaEffective =
      inadimplencia_pct != null && inadimplencia_pct >= 0
        ? inadimplencia_pct
        : LEASING_PREMISE_DEFAULTS.inadimplencia_pct
    result.inadimplencia_pct = inadimplenciaEffective

    const opexEffective =
      custo_operacional_pct != null && custo_operacional_pct >= 0
        ? custo_operacional_pct
        : LEASING_PREMISE_DEFAULTS.custo_operacional_pct
    result.opex_pct = opexEffective

    const manutencaoEffective =
      custo_manutencao != null && custo_manutencao >= 0
        ? custo_manutencao
        : LEASING_PREMISE_DEFAULTS.custo_manutencao
    result.custo_manutencao = manutencaoEffective

    if (receita_esperada != null && receita_esperada >= 0) {
      result.receita_esperada = receita_esperada
    } else if (mensalidade_base != null && mensalidade_base > 0 && prazo_meses != null && prazo_meses > 0) {
      result.receita_esperada = mensalidade_base * prazo_meses
    }

    // Seguro: use calcSeguroLeasing when constants match defaults; otherwise
    // apply the two-tier formula inline with the provided custom constants.
    if (capexBase > 0) {
      const isDefaultConstants =
        seguro_limiar_rs === SEGURO_LIMIAR_RS &&
        seguro_faixa_baixa_percent === SEGURO_FAIXA_BAIXA_PERCENT &&
        seguro_faixa_alta_percent === SEGURO_FAIXA_ALTA_PERCENT &&
        seguro_piso_rs === SEGURO_PISO_RS
      result.custo_seguro = isDefaultConstants
        ? calcSeguroLeasing(capexBase)
        : capexBase < seguro_limiar_rs
          ? capexBase * (seguro_faixa_baixa_percent / 100)
          : Math.max(seguro_piso_rs, capexBase * (seguro_faixa_alta_percent / 100))
    }

    // CAC = first monthly payment (comissao for leasing)
    if (mensalidade_base != null && mensalidade_base > 0) {
      result.custo_comissao = mensalidade_base

      // Total impostos over contract term
      if (prazo_meses != null && prazo_meses > 0) {
        const taxResult = computeTaxes({
          modo: 'leasing',
          mensalidade: mensalidade_base,
          aliquota: impostos_leasing_percent / 100,
        })
        result.custo_impostos = taxResult.valorImposto * prazo_meses
      }
    }
  } else {
    // Venda: comissao as a % of the capex base (informational estimate)
    if (capexBase > 0) {
      result.custo_comissao = Math.round(capexBase * (comissao_minima_percent / 100))
    }
  }

  return result
}
