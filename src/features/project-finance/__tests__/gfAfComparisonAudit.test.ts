/**
 * Auditoria GF × AF — 10 simulações venda + 10 simulações leasing
 *
 * Objetivo: verificar que os cálculos automáticos da Gestão Financeira (GF)
 * produzem KPIs consistentes com a Análise Financeira (AF).
 *
 * Metodologia:
 *   1. Para cada cenário, derivamos os custos via `deriveProjectFinanceCosts`
 *      (o mesmo engine que o formulário de GF usa).
 *   2. Calculamos os KPIs via `computeProjectKPIs`.
 *   3. Calculamos os valores de referência independentes usando as mesmas
 *      funções primitivas (`calcularKpis`, `computeTaxes`) para garantir
 *      que o pipeline completo produz resultados corretos.
 *   4. Para venda, comparamos também com `calcularAnaliseFinanceira` (AF)
 *      configurado com os mesmos custos → KPIs devem ser idênticos.
 *
 * Alinhamento com AF:
 *   - `computeCustoTotal` inclui `custo_seguro` para que a base de investimento
 *     do GF leasing coincida com AF: investimento = CAPEX + CAC + seguro.
 *   - `custo_impostos` é omitido do form de leasing nestas simulações para
 *     evitar dupla-contagem (os tributos já são deduzidos mensalmente via
 *     `fator_liquido`, alinhado com AF que não inclui impostos no investimento).
 */

import { describe, it, expect } from 'vitest'
import {
  deriveProjectFinanceCosts,
  computeProjectKPIs,
  computeCustoTotal,
} from '../calculations'
import {
  calcularAnaliseFinanceira,
  calcularKpis,
  calcSeguroLeasing,
  CREA_GO_RS,
  CREA_DF_RS,
  PROJETO_FAIXAS,
  resolveCustoProjetoPorFaixa,
} from '../../../lib/finance/analiseFinanceiraSpreadsheet'
import { computeTaxes } from '../../../domain/finance/taxation'
import type { ProjectFinanceFormState } from '../types'

// ─── Cenários de venda ────────────────────────────────────────────────────────

interface VendaScenario {
  label: string
  consumo: number
  kwp: number
  uf: 'GO' | 'DF'
  receita: number
  impostos_percent?: number
}

const VENDA_SCENARIOS: VendaScenario[] = [
  { label: 'VS-01 micro GO',    consumo: 200,  kwp: 3,  uf: 'GO', receita: 15_000 },
  { label: 'VS-02 pequeno GO',  consumo: 400,  kwp: 6,  uf: 'GO', receita: 25_000 },
  { label: 'VS-03 médio GO',    consumo: 600,  kwp: 9,  uf: 'GO', receita: 35_000 },
  { label: 'VS-04 grande GO',   consumo: 1000, kwp: 16, uf: 'GO', receita: 60_000 },
  { label: 'VS-05 XL GO',       consumo: 2000, kwp: 30, uf: 'GO', receita: 110_000 },
  { label: 'VS-06 micro DF',    consumo: 250,  kwp: 4,  uf: 'DF', receita: 18_000 },
  { label: 'VS-07 pequeno DF',  consumo: 500,  kwp: 8,  uf: 'DF', receita: 30_000 },
  { label: 'VS-08 médio DF',    consumo: 800,  kwp: 12, uf: 'DF', receita: 50_000 },
  { label: 'VS-09 grande DF',   consumo: 1200, kwp: 18, uf: 'DF', receita: 75_000 },
  { label: 'VS-10 XL DF',       consumo: 1800, kwp: 28, uf: 'DF', receita: 100_000 },
]

// ─── Cenários de leasing ──────────────────────────────────────────────────────

interface LeasingScenario {
  label: string
  consumo: number
  kwp: number
  uf: 'GO' | 'DF'
  mensalidade: number
  prazo: number
  inadimplencia_pct?: number
  opex_pct?: number
  impostos_percent?: number
}

const LEASING_SCENARIOS: LeasingScenario[] = [
  { label: 'LS-01 micro GO 60m',      consumo: 200,  kwp: 3,  uf: 'GO', mensalidade: 300,  prazo: 60  },
  { label: 'LS-02 pequeno GO 60m',    consumo: 400,  kwp: 6,  uf: 'GO', mensalidade: 600,  prazo: 60  },
  { label: 'LS-03 médio GO 60m',      consumo: 600,  kwp: 9,  uf: 'GO', mensalidade: 900,  prazo: 60  },
  { label: 'LS-04 grande GO 60m',     consumo: 1000, kwp: 16, uf: 'GO', mensalidade: 1400, prazo: 60  },
  { label: 'LS-05 médio GO 120m',     consumo: 600,  kwp: 9,  uf: 'GO', mensalidade: 700,  prazo: 120 },
  { label: 'LS-06 micro DF 60m',      consumo: 250,  kwp: 4,  uf: 'DF', mensalidade: 380,  prazo: 60  },
  { label: 'LS-07 pequeno DF 60m',    consumo: 500,  kwp: 8,  uf: 'DF', mensalidade: 720,  prazo: 60  },
  { label: 'LS-08 médio DF 60m',      consumo: 800,  kwp: 12, uf: 'DF', mensalidade: 1100, prazo: 60  },
  { label: 'LS-09 grande DF 120m',    consumo: 1200, kwp: 18, uf: 'DF', mensalidade: 1200, prazo: 120 },
  { label: 'LS-10 XL GO 84m',         consumo: 1500, kwp: 24, uf: 'GO', mensalidade: 1800, prazo: 84  },
]

// ─── Helpers de configuração ──────────────────────────────────────────────────

/** Monta o form state de venda a partir dos custos derivados e receita. */
function buildVendaForm(
  derivedCosts: ReturnType<typeof deriveProjectFinanceCosts>,
  receita: number,
): ProjectFinanceFormState {
  return {
    custo_equipamentos:    derivedCosts.custo_equipamentos    ?? null,
    custo_instalacao:      null,
    custo_engenharia:      derivedCosts.custo_engenharia      ?? null,
    custo_homologacao:     derivedCosts.custo_homologacao     ?? null,
    custo_frete_logistica: derivedCosts.custo_frete_logistica ?? null,
    custo_comissao:        derivedCosts.custo_comissao        ?? null,
    custo_impostos:        null,
    custo_diversos:        null,
    receita_esperada:      receita,
  }
}

/** Monta o form state de leasing a partir dos custos derivados. */
function buildLeasingForm(
  derivedCosts: ReturnType<typeof deriveProjectFinanceCosts>,
  mensalidade: number,
  inadimplencia_pct = 0,
  opex_pct = 0,
): ProjectFinanceFormState {
  return {
    custo_equipamentos:    derivedCosts.custo_equipamentos    ?? null,
    custo_instalacao:      null,
    custo_engenharia:      derivedCosts.custo_engenharia      ?? null,
    custo_homologacao:     derivedCosts.custo_homologacao     ?? null,
    custo_frete_logistica: derivedCosts.custo_frete_logistica ?? null,
    // custo_seguro is included so that computeCustoTotal matches AF's investment base
    // (AF includes seguro in investimento_total_leasing_rs = CAPEX + CAC + seguro).
    custo_seguro:          derivedCosts.custo_seguro          ?? null,
    custo_comissao:        derivedCosts.custo_comissao        ?? null,
    // custo_impostos is intentionally omitted from the investment base
    // to avoid double-counting (taxes are already deducted per period via fatorLiquido).
    custo_impostos:        null,
    custo_diversos:        null,
    mensalidade_base:      mensalidade,
    inadimplencia_pct,
    opex_pct,
  }
}

// ─── Auditoria Venda ──────────────────────────────────────────────────────────

describe('Auditoria GF×AF — 10 simulações venda', () => {
  for (const s of VENDA_SCENARIOS) {
    const IMPOSTOS = s.impostos_percent ?? 6

    it(s.label, () => {
      // ── 1. GF path ──────────────────────────────────────────────────────────
      const derivedCosts = deriveProjectFinanceCosts(
        { consumo_kwh_mes: s.consumo, potencia_sistema_kwp: s.kwp, uf: s.uf },
        'venda',
      )

      const form = buildVendaForm(derivedCosts, s.receita)
      const capex = computeCustoTotal(form)

      expect(capex).not.toBeNull()
      expect(capex!).toBeGreaterThan(0)

      const gfKpis = computeProjectKPIs(
        form,
        'venda',
        60, // term not material for venda KPIs
        null,
        { impostos_percent: IMPOSTOS },
      )

      // ── 2. Referência direta (mesmas primitivas, sem GF wrapper) ────────────
      const custoKit  = derivedCosts.custo_equipamentos    ?? 0
      const frete     = derivedCosts.custo_frete_logistica ?? 0
      const taxResult = computeTaxes({
        modo: 'venda',
        totalAntesImposto: s.receita,
        custoKit,
        frete,
        aliquota: IMPOSTOS / 100,
      })
      const impostosRs    = taxResult.valorImposto
      const lucroBruto    = s.receita - capex!
      const lucroLiquido  = lucroBruto - impostosRs
      const refFluxos     = [capex! + lucroLiquido]
      const refKpis       = calcularKpis(refFluxos, capex!, lucroLiquido, null)

      // GF KPIs must match the reference computation exactly
      expect(gfKpis.payback_meses).toBe(refKpis.payback_meses)
      expect(gfKpis.roi_pct).toBeCloseTo(refKpis.roi_percent, 6)
      expect(gfKpis.tir_pct).toBeCloseTo(refKpis.tir_anual_percent!, 4)
      expect(gfKpis.vpl).toBe(null) // no taxa_desconto provided → VPL null

      // ── 3. Cross-check with calcularAnaliseFinanceira ────────────────────────
      //
      // AF is configured with the SAME cost items as GF so the two paths
      // produce an identical cost base.  Conditions for exact match:
      //   - custo_fixo_rateado_percent = 0
      //   - comissao_minima_percent = 0 (GF's comissao is already in capex as custo_comissao)
      //   - investimento_inicial_rs = capex (GF's computed total)
      //   - GF's custo_comissao is mapped to outros_rs in AF
      //
      // With these conditions: AF's lucro_final = receita - capex - impostos = GF's lucroLiquido
      // → KPIs identical.
      const afComissaoAsOutros = derivedCosts.custo_comissao ?? 0

      const afResult = calcularAnaliseFinanceira({
        modo: 'venda',
        uf: s.uf,
        consumo_kwh_mes: s.consumo,
        irradiacao_kwh_m2_dia: 5.0,
        performance_ratio: 0.8,
        dias_mes: 30,
        potencia_modulo_wp: 550,
        custo_kit_rs:          custoKit,
        frete_rs:              frete,
        descarregamento_rs:    0,
        instalacao_rs:         0,
        hotel_pousada_rs:      0,
        transporte_combustivel_rs: 0,
        outros_rs:             afComissaoAsOutros,
        deslocamento_instaladores_rs: 0,
        // Use override values so AF uses exactly the same costs as GF
        projeto_rs_override:   derivedCosts.custo_engenharia    ?? 0,
        crea_rs_override:      derivedCosts.custo_homologacao   ?? 0,
        material_ca_rs_override: 0,
        placa_rs_override:     0,
        valor_contrato_rs:     s.receita,
        impostos_percent:      IMPOSTOS,
        custo_fixo_rateado_percent: 0,
        lucro_minimo_percent:  10,
        comissao_minima_percent: 0, // GF's comissao already embedded in outros_rs
        inadimplencia_percent: 0,
        custo_operacional_percent: 0,
        meses_projecao:        1,
        mensalidades_previstas_rs: [1],
        investimento_inicial_rs: capex!,
      })

      // AF's custo_variavel_total must equal GF's capex (same cost items)
      expect(afResult.custo_variavel_total_rs).toBeCloseTo(capex!, 1)

      // AF's KPIs must match GF's
      expect(afResult.roi_percent).toBeCloseTo(gfKpis.roi_pct!, 4)
      if (gfKpis.payback_meses !== null) {
        expect(afResult.payback_meses).toBe(gfKpis.payback_meses)
      }
      if (gfKpis.tir_pct !== null) {
        expect(afResult.tir_anual_percent).toBeCloseTo(gfKpis.tir_pct, 3)
      }

      // ── 4. Sanity checks ─────────────────────────────────────────────────────
      expect(capex!).toBeLessThan(s.receita) // receita must exceed costs to be viable

      // Kit + frete are the largest cost items
      const kitFrete = (derivedCosts.custo_equipamentos ?? 0) + (derivedCosts.custo_frete_logistica ?? 0)
      expect(kitFrete).toBeGreaterThan(0)

      // Engineering cost resolved from kWp table
      const expectedEngenharia = resolveCustoProjetoPorFaixa(s.kwp, PROJETO_FAIXAS)
      expect(derivedCosts.custo_engenharia).toBe(expectedEngenharia)

      // CREA by UF
      const expectedCrea = s.uf === 'DF' ? CREA_DF_RS : CREA_GO_RS
      expect(derivedCosts.custo_homologacao).toBe(expectedCrea)
    })
  }
})

// ─── Auditoria Leasing ────────────────────────────────────────────────────────

describe('Auditoria GF×AF — 10 simulações leasing', () => {
  for (const s of LEASING_SCENARIOS) {
    const IMPOSTOS = s.impostos_percent ?? 4

    it(s.label, () => {
      // ── 1. GF path ──────────────────────────────────────────────────────────
      const derivedCosts = deriveProjectFinanceCosts(
        {
          consumo_kwh_mes:     s.consumo,
          potencia_sistema_kwp: s.kwp,
          uf:                  s.uf,
          mensalidade_base:    s.mensalidade,
          prazo_meses:         s.prazo,
          impostos_leasing_percent: IMPOSTOS,
        },
        'leasing',
      )

      const form = buildLeasingForm(
        derivedCosts,
        s.mensalidade,
        s.inadimplencia_pct ?? 0,
        s.opex_pct ?? 0,
      )
      const capex = computeCustoTotal(form)

      expect(capex).not.toBeNull()
      expect(capex!).toBeGreaterThan(0)

      const gfKpis = computeProjectKPIs(
        form,
        'leasing',
        s.prazo,
        null,
        { impostos_percent: IMPOSTOS },
      )

      // ── 2. Referência direta ─────────────────────────────────────────────────
      const aliquota        = IMPOSTOS / 100
      const inadimplencia   = (s.inadimplencia_pct ?? 0) / 100
      const opex            = (s.opex_pct ?? 0) / 100
      const fatorLiquido    = Math.max(0, 1 - aliquota - inadimplencia - opex)
      const mensalidadeLiq  = s.mensalidade * fatorLiquido
      const refFluxos       = Array<number>(s.prazo).fill(mensalidadeLiq)
      const receitaLiq      = mensalidadeLiq * s.prazo
      const lucro           = receitaLiq - capex!
      const refKpis         = calcularKpis(refFluxos, capex!, lucro, null)

      // GF KPIs must match the reference computation exactly
      if (refKpis.payback_meses !== null) {
        expect(gfKpis.payback_meses).toBe(refKpis.payback_meses)
      }
      expect(gfKpis.roi_pct).toBeCloseTo(refKpis.roi_percent, 4)
      if (refKpis.tir_anual_percent !== null) {
        expect(gfKpis.tir_pct).toBeCloseTo(refKpis.tir_anual_percent, 3)
      }
      expect(gfKpis.vpl).toBe(null) // no taxa_desconto → VPL null

      // ── 3. Derived cost assertions ────────────────────────────────────────────
      const expectedEquip  = Math.round(1500 + 9.5 * s.consumo)
      const expectedFrete  = Math.round(300 + 0.52 * s.consumo)
      const expectedEng    = resolveCustoProjetoPorFaixa(s.kwp, PROJETO_FAIXAS)
      const expectedCrea   = s.uf === 'DF' ? CREA_DF_RS : CREA_GO_RS
      const capexBase      = expectedEquip + expectedFrete + expectedEng + expectedCrea
      const expectedSeguro = calcSeguroLeasing(capexBase)

      expect(derivedCosts.custo_equipamentos).toBe(expectedEquip)
      expect(derivedCosts.custo_frete_logistica).toBe(expectedFrete)
      expect(derivedCosts.custo_engenharia).toBe(expectedEng)
      expect(derivedCosts.custo_homologacao).toBe(expectedCrea)
      expect(derivedCosts.custo_comissao).toBe(s.mensalidade)          // CAC = first mensalidade
      expect(derivedCosts.custo_seguro).toBeCloseTo(expectedSeguro, 6) // insurance on capexBase

      // Seguro is derived and included in computeCustoTotal (matches AF's investment base).
      // Verify seguro is a positive number so the field is correctly populated.
      expect(derivedCosts.custo_seguro!).toBeGreaterThan(0)

      // ── 4. fatorLiquido consistency with AF ───────────────────────────────────
      //
      // AF uses: fator_liquido = 1 - impostos - inadimplencia - operacional
      // GF uses: fatorLiquido  = 1 - impostosFrac - inadimplencia - opex
      // where impostosFrac = computeTaxes(mensalidade, aliquota).valorImposto / mensalidade = aliquota
      // → Both formulas are identical for a flat mensalidade.
      const afFatorLiquido = 1 - aliquota - inadimplencia - opex
      expect(fatorLiquido).toBeCloseTo(afFatorLiquido, 10)

      // ── 5. Investment base verification ──────────────────────────────────────
      //
      // GF investment (computeCustoTotal) = equipamentos + frete + engenharia +
      //   homologacao + custo_seguro + custo_comissao (CAC)
      //   [custo_impostos excluded to avoid double-counting]
      //
      // AF investment = custo_variavel_total_rs + CAC + seguro
      //   = (equipamentos + frete + engenharia + homologacao) + CAC + seguro
      //   = capexBase + CAC + seguro
      //
      // With the fix (custo_seguro in computeCustoTotal), both must be equal.
      const afCapex      = capexBase                      // equipment costs only
      const afCac        = s.mensalidade                  // first payment
      const afSeguro     = calcSeguroLeasing(afCapex)
      const afInvestment = afCapex + afCac + afSeguro
      //
      const gfInvestment = capex!
      const delta        = Math.abs(gfInvestment - afInvestment)
      //
      // GF and AF investment bases must match after the custo_seguro fix.
      expect(delta).toBeCloseTo(0, 1)

      // ── 6. AF cross-reference with same investment base ─────────────────────
      //
      // When AF is fed GF's investment base (not including seguro), KPIs must match.
      const afMensalidades = Array<number>(s.prazo).fill(s.mensalidade)
      const afResult = calcularAnaliseFinanceira({
        modo: 'leasing',
        uf: s.uf,
        consumo_kwh_mes: s.consumo,
        irradiacao_kwh_m2_dia: 5.0,
        performance_ratio: 0.8,
        dias_mes: 30,
        potencia_modulo_wp: 550,
        custo_kit_rs:           expectedEquip,
        frete_rs:               expectedFrete,
        descarregamento_rs:     0,
        instalacao_rs:          0,
        hotel_pousada_rs:       0,
        transporte_combustivel_rs: 0,
        outros_rs:              0,
        deslocamento_instaladores_rs: 0,
        projeto_rs_override:    expectedEng,
        crea_rs_override:       expectedCrea,
        material_ca_rs_override: 0,
        placa_rs_override:      0,
        valor_contrato_rs:      afCapex,  // CAPEX = equipment base (for seguro calc)
        impostos_percent:       IMPOSTOS,
        custo_fixo_rateado_percent: 0,
        lucro_minimo_percent:   10,
        comissao_minima_percent: 0,
        inadimplencia_percent:  s.inadimplencia_pct ?? 0,
        custo_operacional_percent: s.opex_pct ?? 0,
        meses_projecao:         s.prazo,
        mensalidades_previstas_rs: afMensalidades,
        investimento_inicial_rs: capex!, // match GF's investment base
      })

      // fator_liquido must be identical
      expect(afResult.fator_liquido).toBeCloseTo(fatorLiquido, 10)

      // When investment base is the same, ROI must match
      expect(afResult.roi_percent).toBeCloseTo(gfKpis.roi_pct!, 4)

      // Payback should be consistent (within ±1 month due to rounding)
      if (gfKpis.payback_meses !== null && afResult.payback_meses !== null) {
        expect(Math.abs(gfKpis.payback_meses - afResult.payback_meses)).toBeLessThanOrEqual(1)
      }
    })
  }
})

// ─── Auditoria de custo base ──────────────────────────────────────────────────

describe('Auditoria de fórmulas de custo base', () => {
  it('formula custo_equipamentos = round(1500 + 9.5 × consumo) para todos os cenários venda', () => {
    for (const s of VENDA_SCENARIOS) {
      const result = deriveProjectFinanceCosts({ consumo_kwh_mes: s.consumo }, 'venda')
      expect(result.custo_equipamentos).toBe(Math.round(1500 + 9.5 * s.consumo))
    }
  })

  it('formula custo_frete_logistica = round(300 + 0.52 × consumo) para todos os cenários venda', () => {
    for (const s of VENDA_SCENARIOS) {
      const result = deriveProjectFinanceCosts({ consumo_kwh_mes: s.consumo }, 'venda')
      expect(result.custo_frete_logistica).toBe(Math.round(300 + 0.52 * s.consumo))
    }
  })

  it('formula custo_equipamentos = round(1500 + 9.5 × consumo) para todos os cenários leasing', () => {
    for (const s of LEASING_SCENARIOS) {
      const result = deriveProjectFinanceCosts({ consumo_kwh_mes: s.consumo }, 'leasing')
      expect(result.custo_equipamentos).toBe(Math.round(1500 + 9.5 * s.consumo))
    }
  })

  it('custo_engenharia usa a tabela de faixas de kWp para todos os cenários', () => {
    const allScenarios = [...VENDA_SCENARIOS, ...LEASING_SCENARIOS]
    for (const s of allScenarios) {
      const result = deriveProjectFinanceCosts({ potencia_sistema_kwp: s.kwp }, 'venda')
      expect(result.custo_engenharia).toBe(resolveCustoProjetoPorFaixa(s.kwp, PROJETO_FAIXAS))
    }
  })

  it('custo_homologacao usa CREA correto por UF para todos os cenários', () => {
    const allScenarios = [...VENDA_SCENARIOS, ...LEASING_SCENARIOS]
    for (const s of allScenarios) {
      const result = deriveProjectFinanceCosts({ uf: s.uf }, 'venda')
      expect(result.custo_homologacao).toBe(s.uf === 'DF' ? CREA_DF_RS : CREA_GO_RS)
    }
  })

  it('custo_seguro leasing usa calcSeguroLeasing no capexBase correto', () => {
    for (const s of LEASING_SCENARIOS) {
      const result = deriveProjectFinanceCosts(
        { consumo_kwh_mes: s.consumo, potencia_sistema_kwp: s.kwp, uf: s.uf },
        'leasing',
      )
      const equip  = Math.round(1500 + 9.5 * s.consumo)
      const frete  = Math.round(300 + 0.52 * s.consumo)
      const eng    = resolveCustoProjetoPorFaixa(s.kwp, PROJETO_FAIXAS)
      const crea   = s.uf === 'DF' ? CREA_DF_RS : CREA_GO_RS
      const capex  = equip + frete + eng + crea
      expect(result.custo_seguro).toBeCloseTo(calcSeguroLeasing(capex), 6)
    }
  })

  it('custo_comissao leasing = mensalidade_base (CAC) para todos os cenários', () => {
    for (const s of LEASING_SCENARIOS) {
      const result = deriveProjectFinanceCosts(
        { mensalidade_base: s.mensalidade },
        'leasing',
      )
      expect(result.custo_comissao).toBe(s.mensalidade)
    }
  })
})
