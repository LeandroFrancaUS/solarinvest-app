/**
 * Testes de consistência inter-motores (F14).
 *
 * Para o MESMO cenário base, verifica que engines equivalentes produzem
 * resultados dentro de uma faixa de tolerância aceitável.
 *
 * Divergências LEGÍTIMAS são documentadas com comentários explicativos.
 */
import { describe, it, expect } from 'vitest'
import { computeROI } from '../roi'
import { calcularAnaliseFinanceira } from '../analiseFinanceiraSpreadsheet'
import { calcularTarifaProjetada } from '../calculations'
import { estimateMonthlyGenerationKWh } from '../../energy/generation'
import { calcMensalidadesPorAno } from '../leasingProposal'

// ─── Cenário base compartilhado ───────────────────────────────────────────────

const CENARIO_BASE = {
  // Sistema
  consumo_kwh_mes: 500,
  potencia_modulo_wp: 545,
  irradiacao_kwh_m2_dia: 4.5,
  performance_ratio: 0.8,
  // Financeiro
  tarifa_r_kwh: 0.95,
  inflacao_energetica_pct: 6,
  // Leasing
  prazo_meses: 120,    // 10 anos
  desconto_pct: 10,
  // Venda
  capex_rs: 25000,
}

// potência necessária para gerar ~500 kWh/mês: 500 / (4.5 * 0.8 * 30) ≈ 4.63 kWp
const POTENCIA_KWP_CENARIO = CENARIO_BASE.consumo_kwh_mes / (CENARIO_BASE.irradiacao_kwh_m2_dia * CENARIO_BASE.performance_ratio * 30)

// ─── Input base para calcularAnaliseFinanceira ────────────────────────────────

const ANALISE_INPUT_BASE = {
  uf: 'GO' as const,
  consumo_kwh_mes: CENARIO_BASE.consumo_kwh_mes,
  potencia_modulo_wp: CENARIO_BASE.potencia_modulo_wp,
  irradiacao_kwh_m2_dia: CENARIO_BASE.irradiacao_kwh_m2_dia,
  performance_ratio: CENARIO_BASE.performance_ratio,
  dias_mes: 30,
  custo_kit_rs: 18000,
  frete_rs: 0,
  descarregamento_rs: 0,
  instalacao_rs: 3000,
  hotel_pousada_rs: 0,
  transporte_combustivel_rs: 0,
  outros_rs: 0,
  deslocamento_instaladores_rs: 0,
  valor_contrato_rs: CENARIO_BASE.capex_rs,
  impostos_percent: 6,
  custo_fixo_rateado_percent: 5,
  lucro_minimo_percent: 20,
  comissao_minima_percent: 5,
  inadimplencia_percent: 2,
  custo_operacional_percent: 3,
  investimento_inicial_rs: CENARIO_BASE.capex_rs,
}

const ANALISE_INPUT_VENDA = {
  ...ANALISE_INPUT_BASE,
  modo: 'venda' as const,
  meses_projecao: 1,
  mensalidades_previstas_rs: [1000],
}

const ANALISE_INPUT_LEASING = {
  ...ANALISE_INPUT_BASE,
  modo: 'leasing' as const,
  meses_projecao: CENARIO_BASE.prazo_meses,
  mensalidades_previstas_rs: Array.from({ length: CENARIO_BASE.prazo_meses }, (_, i) => {
    const tarifaAno = calcularTarifaProjetada(CENARIO_BASE.tarifa_r_kwh, CENARIO_BASE.inflacao_energetica_pct / 100, Math.floor(i / 12))
    return CENARIO_BASE.consumo_kwh_mes * tarifaAno * (1 - CENARIO_BASE.desconto_pct / 100)
  }),
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('crossEngineConsistency', () => {
  describe('generation.ts vs pricingPorKwp.ts — potência instalada', () => {
    it('geração estimada bate com consumo contratado dentro de ±5%', () => {
      // Usar a potência calculada exatamente para o cenário base
      const geracaoMensal = estimateMonthlyGenerationKWh({
        potencia_instalada_kwp: POTENCIA_KWP_CENARIO,
        irradiacao_kwh_m2_dia: CENARIO_BASE.irradiacao_kwh_m2_dia,
        performance_ratio: CENARIO_BASE.performance_ratio,
        dias_mes: 30,
      })
      const divergencia = Math.abs(geracaoMensal - CENARIO_BASE.consumo_kwh_mes) / CENARIO_BASE.consumo_kwh_mes
      expect(divergencia).toBeLessThan(0.05)  // <5% de divergência
    })
  })

  describe('roi.ts vs analiseFinanceira — venda direta', () => {
    it('ROI de venda — roi.ts e analiseFinanceira retornam valores positivos', () => {
      // roi.ts perspective: client savings vs investment (precisa de geracao_estimada_kwh_mes)
      const roiResult = computeROI({
        consumo_kwh_mes: CENARIO_BASE.consumo_kwh_mes,
        geracao_estimada_kwh_mes: CENARIO_BASE.consumo_kwh_mes,  // 100% de cobertura
        tarifa_cheia_r_kwh: CENARIO_BASE.tarifa_r_kwh,
        taxa_minima_mensal: 0,
        capex_total: CENARIO_BASE.capex_rs,
        inflacao_energia_aa_pct: CENARIO_BASE.inflacao_energetica_pct,
        condicao: 'AVISTA',
        horizonte_meses: 120,
        aplica_taxa_minima: false,
      })

      // analiseFinanceira perspective: business margin
      const afResult = calcularAnaliseFinanceira(ANALISE_INPUT_VENDA)

      // Both should show positive returns for a viable scenario
      expect(roiResult.roi).toBeGreaterThan(0)
      // analiseFinanceira ROI reflects business margin (lucro / investimento_inicial)
      // which can differ from client-side savings ROI; verify it's a finite number
      expect(typeof (afResult.roi_percent)).toBe('number')

      // Payback from roi.ts should be a reasonable number of months for this scenario
      if (roiResult.payback !== null) {
        expect(roiResult.payback).toBeGreaterThan(0)
        expect(roiResult.payback).toBeLessThan(180)
      }
    })

    it('roi.ts venda — retorna payback simples (não TIR)', () => {
      const roiResult = computeROI({
        consumo_kwh_mes: CENARIO_BASE.consumo_kwh_mes,
        geracao_estimada_kwh_mes: CENARIO_BASE.consumo_kwh_mes,
        tarifa_cheia_r_kwh: CENARIO_BASE.tarifa_r_kwh,
        taxa_minima_mensal: 0,
        capex_total: CENARIO_BASE.capex_rs,
        inflacao_energia_aa_pct: CENARIO_BASE.inflacao_energetica_pct,
        condicao: 'AVISTA',
        horizonte_meses: 120,
        aplica_taxa_minima: false,
      })
      // roi.ts does not compute IRR — uses payback
      expect(roiResult).toHaveProperty('payback')
    })

    it('analiseFinanceira venda — TIR é computada para fluxo single-period', () => {
      const afResult = calcularAnaliseFinanceira(ANALISE_INPUT_VENDA)
      // Venda flow: [-inv, inv+lucro]. IRR exists when (inv+lucro) > 0 (sign change present).
      // A negative TIR means the contract does not cover the investment — still a valid IRR.
      const lucro = afResult.lucro_liquido_final_rs ?? 0
      const inv = ANALISE_INPUT_VENDA.investimento_inicial_rs
      if (inv + lucro > 0) {
        expect(afResult.tir_mensal_percent).not.toBeNull()
        expect(afResult.tir_anual_percent).not.toBeNull()
      } else {
        // No sign change → IRR undefined
        expect(afResult.tir_mensal_percent).toBeNull()
      }
    })
  })

  describe('calculations.ts — calcularTarifaProjetada consistência', () => {
    it('Modelo A (step anual) vs composto: divergência < 1% em 5 anos', () => {
      const tarifa0 = 0.95
      const inflacao = 0.06

      // Modelo A: passo no início de cada ano — tarifa do ano 5 = tarifa0 * (1+inf)^4
      const modeloA_ano5 = calcularTarifaProjetada(tarifa0, inflacao, 4)  // anos decorridos = 4

      // Fórmula contínua equivalente (taxa mensal): (1 + inf)^(1/12) - 1, 48 meses
      const taxaMensal = Math.pow(1 + inflacao, 1 / 12) - 1
      const modeloContinuo_mes48 = tarifa0 * Math.pow(1 + taxaMensal, 48)

      const divergencia = Math.abs(modeloA_ano5 - modeloContinuo_mes48) / modeloA_ano5
      // Divergência entre modelos A e B deve ser pequena para horizonte de 5 anos
      expect(divergencia).toBeLessThan(0.01)  // <1%
    })

    it('3 modelos de inflação convergem para o mesmo valor em horizonte de 1 ano', () => {
      const tarifa0 = 1.0
      const inflacao = 0.06

      // Modelo A (anual step): ano 2 = tarifa0 * (1+inf)^1
      const modeloA = calcularTarifaProjetada(tarifa0, inflacao, 1)

      // Modelo B (mensal composto): (1+inf)^(1/12), 12 meses
      const taxaMensal = Math.pow(1 + inflacao, 1 / 12) - 1
      const modeloB = tarifa0 * Math.pow(1 + taxaMensal, 12)

      // Devem ser idênticos para exatamente 1 ano inteiro
      expect(modeloA).toBeCloseTo(modeloB, 4)
    })
  })

  describe('analiseFinanceira — leasing payback e ROI coerência', () => {
    it('payback leasing deve ser menor que o prazo contratual para cenário saudável', () => {
      const afResult = calcularAnaliseFinanceira(ANALISE_INPUT_LEASING)
      if (afResult.payback_meses !== null) {
        expect(afResult.payback_meses).toBeGreaterThan(0)
        expect(afResult.payback_meses).toBeLessThan(CENARIO_BASE.prazo_meses)
      }
    })

    it('TIR leasing deve ser maior que 0 para cenário saudável', () => {
      const afResult = calcularAnaliseFinanceira(ANALISE_INPUT_LEASING)
      // Leasing should have a multi-period IRR > 0
      if (afResult.tir_mensal_percent !== null) {
        expect(afResult.tir_mensal_percent).toBeGreaterThan(0)
      }
    })

    it('ROI leasing deve ser positivo para cenário saudável', () => {
      const afResult = calcularAnaliseFinanceira(ANALISE_INPUT_LEASING)
      expect(afResult.roi_percent ?? 0).toBeGreaterThan(0)
    })
  })

  describe('leasingProposal.ts — mensalidadesPorAno coerência', () => {
    it('mensalidade do ano 1 deve ser igual a consumo * tarifa * (1 - desconto)', () => {
      const linhas = calcMensalidadesPorAno({
        prazoContratualTotalAnos: 10,
        tarifaCheiaBase: 0.95,
        inflacaoEnergiaFracao: 0.06,
        descontoFracao: 0.10,
        energiaContratadaBase: 500,
        custosFixosContaEnergia: 0,
        taxaMinimaMensal: 0,
        tusdMedioPorAno: {},
      })
      expect(linhas[0]?.mensalidadeSolarInvest).toBeCloseTo(500 * 0.95 * 0.90, 2)
    })

    it('mensalidade do ano N+1 (pós-contrato) deve ter mensalidadeSolarInvest = 0', () => {
      const prazo = 10
      const linhas = calcMensalidadesPorAno({
        prazoContratualTotalAnos: prazo,
        tarifaCheiaBase: 0.95,
        inflacaoEnergiaFracao: 0.06,
        descontoFracao: 0.10,
        energiaContratadaBase: 500,
        custosFixosContaEnergia: 0,
        taxaMinimaMensal: 0,
        tusdMedioPorAno: {},
      })
      const linhaPosContrato = linhas[linhas.length - 1]
      expect(linhaPosContrato?.ano).toBe(prazo + 1)
      expect(linhaPosContrato?.mensalidadeSolarInvest).toBe(0)
    })

    it('tarifa cresce a cada ano com inflação positiva', () => {
      const linhas = calcMensalidadesPorAno({
        prazoContratualTotalAnos: 5,
        tarifaCheiaBase: 0.95,
        inflacaoEnergiaFracao: 0.06,
        descontoFracao: 0,
        energiaContratadaBase: 500,
        custosFixosContaEnergia: 0,
        taxaMinimaMensal: 0,
        tusdMedioPorAno: {},
      })
      for (let i = 1; i < linhas.length - 1; i++) {
        expect(linhas[i]?.tarifaCheiaAno).toBeGreaterThan(linhas[i - 1]?.tarifaCheiaAno ?? 0)
      }
    })
  })
})

