import { describe, expect, it } from 'vitest'

import { computeROI, PMT, type VendaForm } from '../roi'

const createBaseForm = (overrides: Partial<VendaForm> = {}): VendaForm => ({
  consumo_kwh_mes: 600,
  tarifa_cheia_r_kwh: 0.85,
  inflacao_energia_aa_pct: 0,
  taxa_minima_mensal: 80,
  horizonte_meses: 360,
  capex_total: 30000,
  condicao: 'AVISTA',
  modo_pagamento: 'PIX',
  taxa_mdr_pix_pct: 0,
  taxa_mdr_debito_pct: 0,
  taxa_mdr_credito_vista_pct: 0,
  taxa_mdr_credito_parcelado_pct: 0,
  entrada_financiamento: 0,
  geracao_estimada_kwh_mes: 600,
  tarifa_r_kwh: 0.85,
  taxa_minima_r_mes: 80,
  ...overrides,
})

describe('computeROI', () => {
  it('piora o payback à vista quando há aumento da taxa de MDR', () => {
    const resultadoSemMdr = computeROI(createBaseForm())
    const resultadoComMdr = computeROI(createBaseForm({ taxa_mdr_pix_pct: 2 }))

    expect(resultadoSemMdr.payback).not.toBeNull()
    expect(resultadoComMdr.payback).not.toBeNull()

    const paybackSemMdr = resultadoSemMdr.payback ?? Number.POSITIVE_INFINITY
    const paybackComMdr = resultadoComMdr.payback ?? Number.POSITIVE_INFINITY

    expect(paybackSemMdr).toBeLessThanOrEqual(paybackComMdr)
    expect(resultadoComMdr.investimentoInicial).toBeGreaterThan(resultadoSemMdr.investimentoInicial)
  })

  it('calcula parcelas e ROI corretamente em cenário parcelado com juros mensais', () => {
    const capex = 24000
    const jurosMensal = 2
    const parcelas = 12
    const taxaMdrParcelado = 3

    const formParcelado = createBaseForm({
      condicao: 'PARCELADO',
      modo_pagamento: undefined,
      capex_total: capex,
      n_parcelas: parcelas,
      juros_cartao_am_pct: jurosMensal,
      taxa_mdr_credito_parcelado_pct: taxaMdrParcelado,
      consumo_kwh_mes: 500,
      geracao_estimada_kwh_mes: 500,
      tarifa_cheia_r_kwh: 1,
      tarifa_r_kwh: 1,
      taxa_minima_mensal: 50,
      taxa_minima_r_mes: 50,
    })

    const resultado = computeROI(formParcelado)

    const rate = jurosMensal / 100
    const parcelaBase = PMT(rate, parcelas, capex)
    const parcelaEsperada = parcelaBase * (1 + taxaMdrParcelado / 100)

    expect(resultado.pagamentoMensal[0]).toBeCloseTo(parcelaEsperada, 2)

    const energiaBase =
      (formParcelado.geracao_estimada_kwh_mes ?? formParcelado.consumo_kwh_mes ?? 0) > 0
        ? formParcelado.geracao_estimada_kwh_mes ?? formParcelado.consumo_kwh_mes ?? 0
        : formParcelado.consumo_kwh_mes
    const tarifa = formParcelado.tarifa_r_kwh ?? formParcelado.tarifa_cheia_r_kwh ?? 0
    const taxaMinima = formParcelado.taxa_minima_r_mes ?? formParcelado.taxa_minima_mensal ?? 0
    const economiaMensal = Math.max(0, energiaBase * tarifa - taxaMinima)
    const economiaTotal = economiaMensal * 360
    const pagamentoTotal = parcelaEsperada * parcelas
    const roiEsperado = (economiaTotal - pagamentoTotal) / pagamentoTotal

    expect(resultado.roi).toBeCloseTo(roiEsperado, 4)
    expect(resultado.totalPagamentos).toBeCloseTo(pagamentoTotal, 2)
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
    })

    const resultado = computeROI(formFinanciamento)

    const pv = capex - entrada
    const rate = Math.pow(1 + jurosAnual / 100, 1 / 12) - 1
    const factor = Math.pow(1 + rate, parcelasFin)
    const parcelaEsperada = (pv * rate * factor) / (factor - 1)

    expect(resultado.investimentoInicial).toBeCloseTo(entrada, 2)
    expect(resultado.pagamentoMensal[0]).toBeCloseTo(parcelaEsperada, 2)
    expect(resultado.totalPagamentos).toBeCloseTo(entrada + parcelaEsperada * parcelasFin, 2)
  })

  it('calcula VPL apenas quando há taxa de desconto informada', () => {
    const semDesconto = computeROI(createBaseForm({ taxa_desconto_aa_pct: undefined }))
    const comDesconto = computeROI(createBaseForm({ taxa_desconto_aa_pct: 10 }))

    expect(semDesconto.vpl).toBeUndefined()
    expect(comDesconto.vpl).toBeTypeOf('number')
  })

  it('reduzir a economia mensal piora o payback projetado', () => {
    const resultadoPadrao = computeROI(createBaseForm({ taxa_minima_r_mes: 50, taxa_minima_mensal: 50 }))
    const resultadoTaxaAlta = computeROI(createBaseForm({ taxa_minima_r_mes: 200, taxa_minima_mensal: 200 }))

    expect(resultadoTaxaAlta.economia[0]).toBeLessThan(resultadoPadrao.economia[0])

    const paybackPadrao = resultadoPadrao.payback ?? Number.POSITIVE_INFINITY
    const paybackTaxaAlta = resultadoTaxaAlta.payback ?? Number.POSITIVE_INFINITY

    expect(paybackTaxaAlta).toBeGreaterThanOrEqual(paybackPadrao)
  })
})
