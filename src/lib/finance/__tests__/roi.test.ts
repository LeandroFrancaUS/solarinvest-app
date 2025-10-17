import { describe, expect, it } from 'vitest'

import { computeROI, type VendaForm } from '../roi'

const createBaseForm = (overrides: Partial<VendaForm> = {}): VendaForm => ({
  consumo_kwh_mes: 600,
  tarifa_cheia_r_kwh: 0.85,
  inflacao_energia_aa_pct: 0,
  taxa_minima_mensal: 80,
  horizonte_meses: 60,
  capex_total: 30000,
  condicao: 'AVISTA',
  modo_pagamento: 'PIX',
  taxa_mdr_pix_pct: 0,
  taxa_mdr_debito_pct: 0,
  taxa_mdr_credito_vista_pct: 0,
  taxa_mdr_credito_parcelado_pct: 0,
  entrada_financiamento: 0,
  ...overrides,
})

describe('computeROI', () => {
  it('tem payback mais rápido quando a venda à vista tem MDR menor no Pix', () => {
    const resultadoSemMdr = computeROI(createBaseForm())
    const resultadoComMdr = computeROI(createBaseForm({ taxa_mdr_pix_pct: 0.02 }))

    expect(resultadoSemMdr.payback).not.toBeNull()
    expect(resultadoComMdr.payback).not.toBeNull()
    expect((resultadoSemMdr.payback ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(
      resultadoComMdr.payback ?? Number.POSITIVE_INFINITY,
    )
  })

  it('calcula parcelas e ROI corretamente em cenário parcelado com juros mensais', () => {
    const capex = 24000
    const jurosMensal = 2
    const parcelas = 12
    const taxaMdrParcelado = 0.03

    const formParcelado = createBaseForm({
      condicao: 'PARCELADO',
      modo_pagamento: undefined,
      capex_total: capex,
      n_parcelas: parcelas,
      juros_cartao_am_pct: jurosMensal,
      horizonte_meses: parcelas,
      taxa_mdr_credito_parcelado_pct: taxaMdrParcelado,
      consumo_kwh_mes: 500,
      tarifa_cheia_r_kwh: 1,
      taxa_minima_mensal: 50,
    })

    const resultado = computeROI(formParcelado)

    const rate = jurosMensal / 100
    const factor = Math.pow(1 + rate, parcelas)
    const parcelaBase = (capex * rate * factor) / (factor - 1)
    const parcelaEsperada = parcelaBase * (1 + taxaMdrParcelado)

    expect(resultado.pagamentoMensal[1]).toBeCloseTo(parcelaEsperada, 2)

    const economiaMensal = (formParcelado.consumo_kwh_mes * formParcelado.tarifa_cheia_r_kwh)
      - formParcelado.taxa_minima_mensal
    const economiaTotal = economiaMensal * parcelas
    const pagamentoTotal = parcelaEsperada * parcelas
    const roiEsperado = (economiaTotal - pagamentoTotal) / pagamentoTotal

    expect(resultado.roi).toBeCloseTo(roiEsperado, 4)
  })

  it('converte juros anuais para mensais no financiamento e considera entrada inicial', () => {
    const capex = 40000
    const entrada = 5000
    const parcelasFin = 60
    const jurosAnual = 12

    const formFinanciamento = createBaseForm({
      condicao: 'FINANCIAMENTO',
      modo_pagamento: undefined,
      capex_total: capex,
      entrada_financiamento: entrada,
      n_parcelas_fin: parcelasFin,
      juros_fin_aa_pct: jurosAnual,
      horizonte_meses: parcelasFin,
    })

    const resultado = computeROI(formFinanciamento)

    const pv = capex - entrada
    const rate = Math.pow(1 + jurosAnual / 100, 1 / 12) - 1
    const factor = Math.pow(1 + rate, parcelasFin)
    const parcelaEsperada = (pv * rate * factor) / (factor - 1)

    expect(resultado.pagamentoMensal[0]).toBeCloseTo(entrada, 2)
    expect(resultado.pagamentoMensal[1]).toBeCloseTo(parcelaEsperada, 2)
  })

  it('apresenta economia crescente quando há inflação de energia', () => {
    const base = createBaseForm({ inflacao_energia_aa_pct: 0 })
    const inflacionado = createBaseForm({ inflacao_energia_aa_pct: 8 })

    const resultadoBase = computeROI(base)
    const resultadoInflacionado = computeROI(inflacionado)

    expect(resultadoBase.economia[1]).toBeCloseTo(resultadoBase.economia[12], 6)
    expect(resultadoInflacionado.economia[12]).toBeGreaterThan(resultadoInflacionado.economia[1])
  })

  it('aumentar a taxa mínima reduz a economia e piora o payback', () => {
    const resultadoPadrao = computeROI(createBaseForm({ taxa_minima_mensal: 80 }))
    const resultadoTaxaAlta = computeROI(createBaseForm({ taxa_minima_mensal: 200 }))

    expect(resultadoTaxaAlta.economia[1]).toBeLessThan(resultadoPadrao.economia[1])

    const paybackPadrao = resultadoPadrao.payback ?? Number.POSITIVE_INFINITY
    const paybackTaxaAlta = resultadoTaxaAlta.payback ?? Number.POSITIVE_INFINITY

    expect(paybackTaxaAlta).toBeGreaterThanOrEqual(paybackPadrao)
  })
})
