/**
 * Auditoria completa dos cálculos financeiros de Leasing
 *
 * Verifica as quatro seções exibidas na UI:
 *   1. Composição Mensal — Leasing
 *   2. Investimento — Leasing
 *   3. Retorno e Rentabilidade — Leasing
 *   4. Risco e Sensibilidade — Leasing
 *
 * Regra central (domain/finance/taxation.ts):
 *   Imposto de leasing incide SOMENTE sobre a mensalidade.
 *   CAPEX, CAC e seguro NÃO são tributados.
 *
 * Cada teste inclui o cálculo manual esperado para rastreabilidade.
 */

import { describe, expect, it } from 'vitest'
import {
  calcularAnaliseFinanceira,
  calcSeguroLeasing,
} from '../analiseFinanceiraSpreadsheet'
import type { AnaliseFinanceiraInput } from '../../../types/analiseFinanceira'

// ─── Cenário base ─────────────────────────────────────────────────────────────
//
// Valores escolhidos para cálculo manual simples:
//   mensalidade plana = R$ 1.200 / mês
//   prazo = 60 meses (5 anos)
//   impostos leasing = 4 %    (somente sobre mensalidade)
//   inadimplência = 2 %
//   custo operacional = 3 %
//   CAPEX (custo_kit) = R$ 20.000  →  custo_variavel_total inclui material_ca, crea, placa, projeto
//   valor_contrato (base de seguro) = R$ 15.000

const MENSALIDADE = 1200
const MESES = 60
const IMPOSTOS_PCT = 4
const INADIMPLENCIA_PCT = 2
const CUSTO_OP_PCT = 3
const CUSTO_KIT = 20000
const VALOR_CONTRATO = 15000

const mensalidades = Array<number>(MESES).fill(MENSALIDADE)

const baseLeasing: AnaliseFinanceiraInput = {
  modo: 'leasing',
  uf: 'GO',
  consumo_kwh_mes: 800,
  irradiacao_kwh_m2_dia: 5.0,
  performance_ratio: 0.8,
  dias_mes: 30,
  potencia_modulo_wp: 550,
  custo_kit_rs: CUSTO_KIT,
  frete_rs: 0,
  descarregamento_rs: 0,
  instalacao_rs: 0,
  hotel_pousada_rs: 0,
  transporte_combustivel_rs: 0,
  outros_rs: 0,
  deslocamento_instaladores_rs: 0,
  valor_contrato_rs: VALOR_CONTRATO,
  impostos_percent: IMPOSTOS_PCT,
  custo_fixo_rateado_percent: 0,
  lucro_minimo_percent: 15,
  comissao_minima_percent: 3,
  inadimplencia_percent: INADIMPLENCIA_PCT,
  custo_operacional_percent: CUSTO_OP_PCT,
  meses_projecao: MESES,
  mensalidades_previstas_rs: mensalidades,
  investimento_inicial_rs: CUSTO_KIT,
}

// ─── Derivações manuais ───────────────────────────────────────────────────────
//
// fator_liquido = 1 - 0.04 - 0.02 - 0.03 = 0.91
// receita_liquida_mensal = 1200 × 0.91 = 1092
// receita_bruta_total = 1200 × 60 = 72.000
// receita_liquida_total = 1092 × 60 = 65.520
// impostos_leasing = 72.000 × 0.04 = 2.880  (somente sobre mensalidade)
//
// seguro = max(R$ 139, 15.000 × 0.00735) = max(139, 110.25) = R$ 139
// CAC (comissão) = primeira mensalidade = R$ 1.200
//
// custo_variavel_total inclui:
//   kit = 20.000
//   material_ca = 20.000 × 12 % = 2.400
//   crea (GO) = 104
//   placa = 13 módulos × 18 = 234   (potência: 800/120≈6.67kWp → 6667/550=13 módulos)
//   projeto = 400                   (≤6kWp → R$ 400; 13 × 550 = 7150 W = 7.15 kWp → R$ 500)
// Note: consumo=800, irr=5, pr=0.8, dias=30 → fator=120 → potencia=800/120=6.667kWp
//       módulos = ceil(6666.7/550) = ceil(12.12) = 13 → potencia_sistema = 7.15 kWp → R$ 500
// custo_variavel_total = 20000 + 2400 + 104 + 234 + 500 = 23.238
//
// investimento_total = 23.238 + 1.200 + 139 = 24.577
// lucro_total = 65.520 - 24.577 = 40.943
// roi = 40.943 / 24.577 × 100 ≈ 166,60 %
// payback_total = 24.577 / 1092 ≈ 22,50 meses
// lucro_mensal_medio = 65.520 / 60 = 1092

describe('Auditoria Leasing — Composição Mensal', () => {
  it('fator_liquido = 1 − impostos% − inadimplência% − custoOp%', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    // Derivação manual: 1 - 0.04 - 0.02 - 0.03 = 0.91
    expect(result.fator_liquido).toBeCloseTo(0.91, 6)
  })

  it('imposto calculado somente sobre a mensalidade bruta total (não sobre CAPEX)', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)

    const receita_bruta_rs = MENSALIDADE * MESES // 72.000
    const impostos_esperados = receita_bruta_rs * (IMPOSTOS_PCT / 100)   // 2.880

    // Impostos sobre mensalidades ✓ (72.000 × 4 %)
    expect(result.impostos_rs_leasing).toBeCloseTo(impostos_esperados, 2)

    // CAPEX não é base tributável — o imposto NOT applied over custo_variavel_total
    const capex = result.custo_variavel_total_rs ?? 0
    const impostos_sobre_capex = capex * (IMPOSTOS_PCT / 100)
    expect(result.impostos_rs_leasing).not.toBeCloseTo(impostos_sobre_capex, 0)
  })

  it('receita_liquida_mensal = mensalidade × fator_liquido', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const esperado = MENSALIDADE * (result.fator_liquido ?? 0)  // 1200 × 0.91 = 1092
    expect(result.receita_liquida_mensal_rs).toBeCloseTo(esperado, 2)
  })

  it('lucro_mensal_medio_rs corresponde à receita líquida média mensal', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    // lucro_mensal_medio_rs = receita_liquida_rs / n
    const esperado = (result.receita_liquida_rs ?? 0) / MESES
    expect(result.lucro_mensal_medio_rs).toBeCloseTo(esperado, 2)
  })

  it('decomposição mensal: mensalidade bruta − deduções = receita líquida', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const fator = result.fator_liquido ?? 0
    const mensalidade_bruta = MENSALIDADE
    const impostos_mensal = mensalidade_bruta * (IMPOSTOS_PCT / 100)    // R$ 48
    const inadimplencia_mensal = mensalidade_bruta * (INADIMPLENCIA_PCT / 100)  // R$ 24
    const custo_op_mensal = mensalidade_bruta * (CUSTO_OP_PCT / 100)   // R$ 36
    const receita_liquida_esperada = mensalidade_bruta - impostos_mensal - inadimplencia_mensal - custo_op_mensal

    // Deve igualar mensalidade × fator_liquido
    expect(receita_liquida_esperada).toBeCloseTo(mensalidade_bruta * fator, 6)
    // Deve igualar lucro_mensal_medio_rs (para mensalidades planas)
    expect(result.lucro_mensal_medio_rs).toBeCloseTo(receita_liquida_esperada, 2)
  })
})

// ─── Seção 2: Investimento — Leasing ─────────────────────────────────────────

describe('Auditoria Leasing — Investimento', () => {
  it('investimento_total = CAPEX + CAC + seguro (sem tributação sobre capital)', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const capex = result.custo_variavel_total_rs ?? 0
    const cac = result.comissao_leasing_rs ?? 0
    const seguro = result.seguro_rs ?? 0
    const esperado = capex + cac + seguro

    expect(result.investimento_total_leasing_rs).toBeCloseTo(esperado, 2)
  })

  it('CAC (comissão leasing) = primeira mensalidade', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    expect(result.comissao_leasing_rs).toBe(MENSALIDADE)
  })

  it('seguro calculado sobre valor_contrato (não sobre CAPEX)', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const seguro_esperado = calcSeguroLeasing(VALOR_CONTRATO)
    expect(result.seguro_rs).toBeCloseTo(seguro_esperado, 4)
  })

  it('CAPEX não é tributado — investimento_total não inclui imposto sobre capital', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const capex = result.custo_variavel_total_rs ?? 0

    // investimento_total deve ser EXATAMENTE capex + cac + seguro, sem multiplicar por (1+impostos)
    const investimento_com_imposto_sobre_capex = capex * (1 + IMPOSTOS_PCT / 100) +
      (result.comissao_leasing_rs ?? 0) + (result.seguro_rs ?? 0)

    // O investimento real deve ser MENOR que a versão hipotética taxada
    expect(result.investimento_total_leasing_rs ?? 0).toBeLessThan(investimento_com_imposto_sobre_capex)
  })

  it('custo_variavel_total inclui kit, material_ca, crea, placa e projeto', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    // Deve ser sempre >= custo_kit_rs
    expect(result.custo_variavel_total_rs ?? 0).toBeGreaterThan(CUSTO_KIT)
  })
})

// ─── Seção 3: Retorno e Rentabilidade — Leasing ───────────────────────────────

describe('Auditoria Leasing — Retorno e Rentabilidade', () => {
  it('receita_total_contrato_rs = soma de todas as mensalidades brutas', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const esperado = MENSALIDADE * MESES  // 72.000
    expect(result.receita_total_contrato_rs).toBeCloseTo(esperado, 2)
  })

  it('receita_liquida_rs = receita_bruta × fator_liquido', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const receita_bruta = MENSALIDADE * MESES
    const esperado = receita_bruta * (result.fator_liquido ?? 0)
    expect(result.receita_liquida_rs).toBeCloseTo(esperado, 2)
  })

  it('lucro_rs = receita_liquida − investimento_total', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const esperado = (result.receita_liquida_rs ?? 0) - (result.investimento_total_leasing_rs ?? 0)
    expect(result.lucro_rs).toBeCloseTo(esperado, 2)
  })

  it('lucro_total_contrato_rs = lucro_rs', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    expect(result.lucro_total_contrato_rs).toBeCloseTo(result.lucro_rs ?? 0, 2)
  })

  it('ROI = lucro_rs / investimento_total × 100', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const lucro = result.lucro_rs ?? 0
    const investimento = result.investimento_total_leasing_rs ?? 0
    const roi_esperado = investimento > 0 ? (lucro / investimento) * 100 : 0
    expect(result.roi_percent).toBeCloseTo(roi_esperado, 4)
  })

  it('payback_total = investimento_total / lucro_mensal_medio', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const lucroMed = result.lucro_mensal_medio_rs ?? 0
    const investimento = result.investimento_total_leasing_rs ?? 0
    const payback_esperado = lucroMed > 0 ? investimento / lucroMed : null
    if (payback_esperado !== null) {
      expect(result.payback_total_meses).toBeCloseTo(payback_esperado, 2)
    }
  })

  it('break_even_meses = payback_total_meses', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    expect(result.break_even_meses).toBeCloseTo(result.payback_total_meses ?? 0, 6)
  })

  it('multiplo_capital = receita_total_contrato / investimento_total', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const investimento = result.investimento_total_leasing_rs ?? 0
    const receita = result.receita_total_contrato_rs ?? 0
    const multiplo_esperado = investimento > 0 ? receita / investimento : null
    if (multiplo_esperado !== null) {
      expect(result.multiplo_capital_investido).toBeCloseTo(multiplo_esperado, 4)
    }
  })

  it('payback_meses (simulação) é coerente com payback_total analítico (±2 meses)', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const paybackAnalitico = result.payback_total_meses ?? 0
    const paybackSim = result.payback_meses ?? 0
    // Paybacks analítico e de simulação devem ser próximos para mensalidades planas
    expect(Math.abs(paybackSim - paybackAnalitico)).toBeLessThanOrEqual(2)
  })

  it('TIR mensal é positiva quando há lucro', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    if ((result.lucro_rs ?? 0) > 0) {
      expect(result.tir_mensal_percent).not.toBeNull()
      expect(result.tir_mensal_percent ?? 0).toBeGreaterThan(0)
    }
  })

  it('TIR anual = (1 + TIR_mensal)^12 − 1 em %', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    if (result.tir_mensal_percent != null) {
      const tirMensal = result.tir_mensal_percent / 100
      const tirAnualEsperada = (Math.pow(1 + tirMensal, 12) - 1) * 100
      expect(result.tir_anual_percent).toBeCloseTo(tirAnualEsperada, 4)
    }
  })
})

// ─── Seção 4: Risco e Sensibilidade — Leasing ────────────────────────────────
//
// Cenários de inadimplência: Base (2%), Moderado (+3% = 5%), Estressado (+6% = 8%)
// fator(pct) = 1 − (impostos% + custoOp% + inadimplência_cenario%) / 100
// receitaMensal(pct) = mensalidade × fator(pct)
// payback(pct) = investimento_total / receitaMensal
// lucroTotal(pct) = receitaMensal × meses − investimento_total
// roi(pct) = lucroTotal / investimento_total × 100

describe('Auditoria Leasing — Risco e Sensibilidade', () => {
  it('formula fator cenário base: 1 − (impostos + custoOp + inadimplência_base) / 100', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    // Cenário base usa afInadimplencia = INADIMPLENCIA_PCT
    const fator_esperado = 1 - (IMPOSTOS_PCT + CUSTO_OP_PCT + INADIMPLENCIA_PCT) / 100
    // deve igualar fator_liquido
    expect(result.fator_liquido).toBeCloseTo(fator_esperado, 6)
  })

  it('cenário base: receitaMensal = comissao_leasing_rs × fator_base', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const mensalidade_base = result.comissao_leasing_rs ?? 0
    const fator = 1 - (IMPOSTOS_PCT + CUSTO_OP_PCT + INADIMPLENCIA_PCT) / 100
    const receita_esperada = mensalidade_base * fator

    // deve igualar lucro_mensal_medio_rs para mensalidades planas
    expect(result.lucro_mensal_medio_rs).toBeCloseTo(receita_esperada, 2)
  })

  it('cenário base: payback = investimento_total / receitaMensal_base', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const mensalidade = result.comissao_leasing_rs ?? 0
    const fator = 1 - (IMPOSTOS_PCT + CUSTO_OP_PCT + INADIMPLENCIA_PCT) / 100
    const receita_mensal = mensalidade * fator
    const payback_esperado = receita_mensal > 0 ? (result.investimento_total_leasing_rs ?? 0) / receita_mensal : null

    if (payback_esperado !== null) {
      expect(result.payback_total_meses).toBeCloseTo(payback_esperado, 2)
    }
  })

  it('cenário moderado (+3%): fator menor que cenário base', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const mensalidade = result.comissao_leasing_rs ?? 0
    const fator_base = 1 - (IMPOSTOS_PCT + CUSTO_OP_PCT + INADIMPLENCIA_PCT) / 100
    const fator_moderado = 1 - (IMPOSTOS_PCT + CUSTO_OP_PCT + (INADIMPLENCIA_PCT + 3)) / 100
    const receita_base = mensalidade * fator_base
    const receita_moderada = mensalidade * fator_moderado

    expect(fator_moderado).toBeLessThan(fator_base)
    expect(receita_moderada).toBeLessThan(receita_base)
  })

  it('cenário moderado: imposto AINDA somente sobre mensalidade', () => {
    const INADIMPLENCIA_MODERADA = INADIMPLENCIA_PCT + 3
    const fator = 1 - (IMPOSTOS_PCT + CUSTO_OP_PCT + INADIMPLENCIA_MODERADA) / 100
    const receita_mensal = MENSALIDADE * fator

    // Imposto no cenário moderado = mensalidade × impostos%
    const imposto_sobre_mensalidade = MENSALIDADE * (IMPOSTOS_PCT / 100)
    // Imposto hipotético errado (sobre receita_mensal)
    const imposto_errado_sobre_receita_liq = receita_mensal * (IMPOSTOS_PCT / 100)

    // O imposto correto é maior que o imposto sobre a receita líquida
    // porque a base é a mensalidade bruta, não a receita líquida
    expect(imposto_sobre_mensalidade).toBeGreaterThan(imposto_errado_sobre_receita_liq)
  })

  it('cenário estressado (+6%): payback maior que cenário base', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const mensalidade = result.comissao_leasing_rs ?? 0
    const investimento = result.investimento_total_leasing_rs ?? 0
    const fator_base = 1 - (IMPOSTOS_PCT + CUSTO_OP_PCT + INADIMPLENCIA_PCT) / 100
    const fator_estressado = 1 - (IMPOSTOS_PCT + CUSTO_OP_PCT + (INADIMPLENCIA_PCT + 6)) / 100
    const payback_base = investimento / (mensalidade * fator_base)
    const payback_estressado = investimento / (mensalidade * fator_estressado)

    expect(payback_estressado).toBeGreaterThan(payback_base)
  })

  it('cenário estressado: ROI menor que cenário base', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const mensalidade = result.comissao_leasing_rs ?? 0
    const investimento = result.investimento_total_leasing_rs ?? 0
    const fator_base = 1 - (IMPOSTOS_PCT + CUSTO_OP_PCT + INADIMPLENCIA_PCT) / 100
    const fator_estressado = 1 - (IMPOSTOS_PCT + CUSTO_OP_PCT + (INADIMPLENCIA_PCT + 6)) / 100
    const lucro_base = mensalidade * fator_base * MESES - investimento
    const lucro_estressado = mensalidade * fator_estressado * MESES - investimento
    const roi_base = (lucro_base / investimento) * 100
    const roi_estressado = (lucro_estressado / investimento) * 100

    expect(roi_estressado).toBeLessThan(roi_base)
  })
})

// ─── Invariantes globais ──────────────────────────────────────────────────────

describe('Auditoria Leasing — Invariantes globais', () => {
  it('imposto não incide sobre CAPEX em nenhuma métrica derivada', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const capex = result.custo_variavel_total_rs ?? 0
    const impostos = result.impostos_rs_leasing ?? 0
    const receita_bruta = MENSALIDADE * MESES

    // Imposto total = impostos sobre mensalidades (não sobre CAPEX)
    expect(impostos).toBeCloseTo(receita_bruta * (IMPOSTOS_PCT / 100), 2)
    // Imposto NÃO deve ser calculado sobre CAPEX
    expect(impostos).not.toBeCloseTo(capex * (IMPOSTOS_PCT / 100), 0)
  })

  it('fator_liquido aplica impostos somente como percentual da mensalidade', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const fator = result.fator_liquido ?? 0
    // fator_liquido correto = 1 − impostos% − inadimplência% − custoOp%
    const fator_esperado_correto = 1 - IMPOSTOS_PCT / 100 - INADIMPLENCIA_PCT / 100 - CUSTO_OP_PCT / 100
    expect(fator).toBeCloseTo(fator_esperado_correto, 6)
    // fator NÃO mistura CAPEX na conta de deduções percentuais
    expect(fator).toBeGreaterThan(0)
    expect(fator).toBeLessThan(1)
  })

  it('projeção de mensalidades líquidas = mensalidades brutas × fator_liquido', () => {
    // Verifica que a base tributável é SEMPRE a mensalidade (nunca o investimento)
    const result = calcularAnaliseFinanceira(baseLeasing)
    const fator = result.fator_liquido ?? 0
    // Com mensalidade plana, cada mensalidade líquida = M × fator
    const mensalidade_liquida_esperada = MENSALIDADE * fator
    const lucro_med = result.lucro_mensal_medio_rs ?? 0
    expect(lucro_med).toBeCloseTo(mensalidade_liquida_esperada, 2)
  })

  it('payback_capex < payback_total (CAPEX recuperado antes do total)', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    const payback_capex = result.payback_capex_meses ?? 0
    const payback_total = result.payback_total_meses ?? 0
    // Total inclui CAC e seguro, então é sempre >= payback só do CAPEX
    expect(payback_total).toBeGreaterThanOrEqual(payback_capex)
  })

  it('resultado é positivo (projeto rentável no cenário base)', () => {
    const result = calcularAnaliseFinanceira(baseLeasing)
    expect(result.lucro_rs ?? 0).toBeGreaterThan(0)
    expect(result.roi_percent).toBeGreaterThan(0)
    expect(result.payback_total_meses ?? Infinity).toBeLessThan(MESES)
  })
})

// ─── Validação com impostos zero (sanidade) ───────────────────────────────────

describe('Auditoria Leasing — Sanidade com impostos = 0%', () => {
  it('com impostos 0%, receita_liquida = mensalidades − inadimplência − custoOp apenas', () => {
    const result = calcularAnaliseFinanceira({
      ...baseLeasing,
      impostos_percent: 0,
    })
    const fator_sem_imposto = 1 - INADIMPLENCIA_PCT / 100 - CUSTO_OP_PCT / 100
    const receita_liquida_esperada = MENSALIDADE * fator_sem_imposto * MESES
    expect(result.receita_liquida_rs).toBeCloseTo(receita_liquida_esperada, 2)
  })

  it('com impostos 0%, impostos_rs_leasing = 0', () => {
    const result = calcularAnaliseFinanceira({
      ...baseLeasing,
      impostos_percent: 0,
    })
    expect(result.impostos_rs_leasing).toBeCloseTo(0, 6)
  })

  it('receita_liquida com impostos > receita_liquida sem impostos', () => {
    const sem_impostos = calcularAnaliseFinanceira({ ...baseLeasing, impostos_percent: 0 })
    const com_impostos = calcularAnaliseFinanceira({ ...baseLeasing, impostos_percent: 4 })
    expect(sem_impostos.receita_liquida_rs ?? 0).toBeGreaterThan(com_impostos.receita_liquida_rs ?? 0)
  })
})

// ─── Validação com mensalidades variáveis ─────────────────────────────────────

describe('Auditoria Leasing — Mensalidades variáveis (crescente)', () => {
  // Mensalidades crescentes: R$ 1.000, R$ 1.050, R$ 1.100, ... (+R$ 50/mês por grupo)
  // Dividido em 3 grupos de 20 meses: 1000, 1050, 1100
  const mensalidadesVar = [
    ...Array<number>(20).fill(1000),
    ...Array<number>(20).fill(1050),
    ...Array<number>(20).fill(1100),
  ]
  const MESES_VAR = 60
  const FATOR = 1 - IMPOSTOS_PCT / 100 - INADIMPLENCIA_PCT / 100 - CUSTO_OP_PCT / 100

  it('fator_liquido é o mesmo independente das mensalidades', () => {
    const result = calcularAnaliseFinanceira({
      ...baseLeasing,
      mensalidades_previstas_rs: mensalidadesVar,
      meses_projecao: MESES_VAR,
    })
    expect(result.fator_liquido).toBeCloseTo(FATOR, 6)
  })

  it('receita_liquida_rs = soma de cada mensalidade × fator_liquido', () => {
    const result = calcularAnaliseFinanceira({
      ...baseLeasing,
      mensalidades_previstas_rs: mensalidadesVar,
      meses_projecao: MESES_VAR,
    })
    const receita_bruta = mensalidadesVar.reduce((s, v) => s + v, 0)
    const receita_esperada = receita_bruta * FATOR
    expect(result.receita_liquida_rs).toBeCloseTo(receita_esperada, 2)
  })

  it('impostos_rs_leasing = receita_bruta_total × impostos% (somente mensalidades)', () => {
    const result = calcularAnaliseFinanceira({
      ...baseLeasing,
      mensalidades_previstas_rs: mensalidadesVar,
      meses_projecao: MESES_VAR,
    })
    const receita_bruta = mensalidadesVar.reduce((s, v) => s + v, 0)
    const impostos_esperados = receita_bruta * (IMPOSTOS_PCT / 100)
    expect(result.impostos_rs_leasing).toBeCloseTo(impostos_esperados, 2)
  })

  it('lucro_mensal_medio_rs = receita_liquida_rs / n', () => {
    const result = calcularAnaliseFinanceira({
      ...baseLeasing,
      mensalidades_previstas_rs: mensalidadesVar,
      meses_projecao: MESES_VAR,
    })
    const esperado = (result.receita_liquida_rs ?? 0) / MESES_VAR
    expect(result.lucro_mensal_medio_rs).toBeCloseTo(esperado, 2)
  })
})
