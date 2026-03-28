import { describe, expect, it } from 'vitest'

import { calcularAnaliseFinanceira } from '../analiseFinanceiraSpreadsheet'
import type { AnaliseFinanceiraInput } from '../../../types/analiseFinanceira'
import { computeROI, type VendaForm } from '../roi'

const createBaseAnaliseInput = (overrides: Partial<AnaliseFinanceiraInput> = {}): AnaliseFinanceiraInput => ({
  modo: 'venda',
  uf: 'GO',
  consumo_kwh_mes: 800,
  irradiacao_kwh_m2_dia: 5.2,
  performance_ratio: 0.8,
  dias_mes: 30,
  potencia_modulo_wp: 550,
  custo_kit_rs: 15000,
  frete_rs: 700,
  descarregamento_rs: 180,
  instalacao_rs: 3200,
  hotel_pousada_rs: 0,
  transporte_combustivel_rs: 0,
  outros_rs: 0,
  deslocamento_instaladores_rs: 400,
  valor_contrato_rs: 30000,
  impostos_percent: 8,
  custo_fixo_rateado_percent: 5,
  lucro_minimo_percent: 10,
  comissao_minima_percent: 3,
  inadimplencia_percent: 2,
  custo_operacional_percent: 3,
  meses_projecao: 60,
  mensalidades_previstas_rs: Array(60).fill(1000),
  investimento_inicial_rs: 20000,
  ...overrides,
})

const createBaseVendaForm = (overrides: Partial<VendaForm> = {}): VendaForm => ({
  consumo_kwh_mes: 800,
  tarifa_cheia_r_kwh: 1.15,
  inflacao_energia_aa_pct: 8,
  taxa_minima_mensal: 120,
  horizonte_meses: 360,
  aplica_taxa_minima: true,
  capex_total: 25000,
  condicao: 'AVISTA',
  modo_pagamento: 'PIX',
  taxa_mdr_pix_pct: 0,
  taxa_mdr_debito_pct: 0,
  taxa_mdr_credito_vista_pct: 0,
  taxa_mdr_credito_parcelado_pct: 0,
  geracao_estimada_kwh_mes: 700,
  tarifa_r_kwh: 1.15,
  taxa_minima_r_mes: 120,
  taxa_desconto_aa_pct: 10,
  ...overrides,
})

describe('auditoria financeira - grade de cenários', () => {
  it('mantém coerência de margem para a matriz kit × contrato', () => {
    const kits = [5000, 10000, 15000, 25000, 40000, 60000, 100000]
    const contratos = [8000, 12000, 18000, 30000, 50000, 80000, 150000]

    for (const kit of kits) {
      for (const contrato of contratos) {
        const result = calcularAnaliseFinanceira(
          createBaseAnaliseInput({
            custo_kit_rs: kit,
            valor_contrato_rs: contrato,
            investimento_inicial_rs: Math.max(1, kit),
          }),
        )

        expect(result.custo_variavel_total_rs).toBeGreaterThanOrEqual(kit)

        if ((result.lucro_liquido_final_rs ?? 0) < 0) {
          expect((result.margem_liquida_final_percent ?? 0)).toBeLessThan(0)
        }

        if ((result.preco_minimo_saudavel_rs ?? 0) > contrato) {
          expect((result.desconto_maximo_percent ?? 0)).toBeLessThan(0)
        }
      }
    }
  })

  it('responde monotonicamente a consumo e tarifa na economia mensal (ROI)', () => {
    const consumos = [300, 500, 800, 1200, 2000, 3000]
    const tarifas = [0.75, 0.95, 1.15, 1.35]

    for (const consumo of consumos) {
      let economiaAnterior = -Infinity
      for (const tarifa of tarifas) {
        const retorno = computeROI(
          createBaseVendaForm({
            consumo_kwh_mes: consumo,
            geracao_estimada_kwh_mes: 0,
            tarifa_cheia_r_kwh: tarifa,
            tarifa_r_kwh: tarifa,
            taxa_minima_mensal: 0,
            taxa_minima_r_mes: 0,
            inflacao_energia_aa_pct: 0,
          }),
        )
        expect(retorno.economia[0]).toBeGreaterThanOrEqual(0)
        expect(retorno.economia[0]).toBeGreaterThanOrEqual(economiaAnterior)
        economiaAnterior = retorno.economia[0]
      }
    }
  })

  it('respeita periodicidade: projeção mensal compõe para anual em 12 meses', () => {
    const retorno = computeROI(
      createBaseVendaForm({
        consumo_kwh_mes: 1000,
        geracao_estimada_kwh_mes: 1000,
        tarifa_cheia_r_kwh: 1,
        tarifa_r_kwh: 1,
        taxa_minima_mensal: 0,
        taxa_minima_r_mes: 0,
        inflacao_energia_aa_pct: 8,
        aplica_taxa_minima: false,
      }),
    )

    expect(retorno.economia[0]).toBeCloseTo(1000, 6)
    expect(retorno.economia[12]).toBeCloseTo(1000 * 1.08, 6)
    expect(retorno.economia[24]).toBeCloseTo(1000 * Math.pow(1.08, 2), 6)
  })

  it('simula prazos longos com VPL e payback válidos', () => {
    const prazos = [60, 84, 120, 360]

    for (const prazo of prazos) {
      const retorno = computeROI(
        createBaseVendaForm({
          condicao: 'FINANCIAMENTO',
          n_parcelas_fin: prazo,
          juros_fin_aa_pct: 12,
          entrada_financiamento: 2000,
          capex_total: 40000,
        }),
      )

      expect(retorno.pagamentoMensal.slice(0, prazo).every((v) => v > 0)).toBe(true)
      expect(retorno.vpl).toBeTypeOf('number')
      expect(retorno.payback === null || retorno.payback > 0).toBe(true)
    }
  })
})
