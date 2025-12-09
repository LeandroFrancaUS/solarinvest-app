import { describe, expect, it } from 'vitest'

import { computeROI, PMT, type VendaForm } from '../roi'

const createBaseForm = (overrides: Partial<VendaForm> = {}): VendaForm => ({
  consumo_kwh_mes: 600,
  tarifa_cheia_r_kwh: 0.85,
  inflacao_energia_aa_pct: 0,
  taxa_minima_mensal: 80,
  horizonte_meses: 360,
  aplica_taxa_minima: true,
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

  it('distribui o valor igualmente entre boletos na modalidade boleto', () => {
    const capex = 18000
    const boletos = 6

    const formBoleto = createBaseForm({
      condicao: 'BOLETO',
      modo_pagamento: undefined,
      capex_total: capex,
      n_boletos: boletos,
    })

    const resultado = computeROI(formBoleto)

    const valorBoleto = capex / boletos
    for (let indice = 0; indice < boletos; indice += 1) {
      expect(resultado.pagamentoMensal[indice]).toBeCloseTo(valorBoleto, 2)
    }
    expect(resultado.pagamentoMensal[boletos]).toBe(0)
    expect(resultado.totalPagamentos).toBeCloseTo(capex, 2)
  })

  it('divide o valor igualmente ao configurar débito automático', () => {
    const capex = 36000
    const debitos = 18

    const formDebitoAutomatico = createBaseForm({
      condicao: 'DEBITO_AUTOMATICO',
      modo_pagamento: undefined,
      capex_total: capex,
      n_debitos: debitos,
    })

    const resultado = computeROI(formDebitoAutomatico)

    const valorDebito = capex / debitos
    for (let indice = 0; indice < debitos; indice += 1) {
      expect(resultado.pagamentoMensal[indice]).toBeCloseTo(valorDebito, 2)
    }
    expect(resultado.pagamentoMensal[debitos]).toBe(0)
    expect(resultado.totalPagamentos).toBeCloseTo(capex, 2)
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

  it('aplica taxa mínima apenas quando habilitado', () => {
    const comum = {
      consumo_kwh_mes: 500,
      geracao_estimada_kwh_mes: 300,
      tarifa_r_kwh: 1,
      inflacao_energia_aa_pct: 0,
      taxa_minima_mensal: 50,
      taxa_minima_r_mes: 50,
      tusd_percentual: 0,
    }

    const comTaxa = computeROI(createBaseForm({ ...comum, aplica_taxa_minima: true }))
    const semTaxa = computeROI(createBaseForm({ ...comum, aplica_taxa_minima: false }))

    expect(comTaxa.economia[0]).toBeLessThan(semTaxa.economia[0])
    expect(semTaxa.economia[0]).toBeCloseTo(300, 6)
    expect(comTaxa.economia[0]).toBeCloseTo(250, 6)
  })

  it('ignora encargos de TUSD quando a taxa mínima é desativada', () => {
    const base = {
      consumo_kwh_mes: 500,
      geracao_estimada_kwh_mes: 300,
      tarifa_r_kwh: 1,
      inflacao_energia_aa_pct: 0,
      taxa_minima_mensal: 50,
      taxa_minima_r_mes: 50,
      tusd_percentual: 35,
      tusd_tipo_cliente: 'residencial',
      tusd_ano_referencia: 2025,
    }

    const comTaxa = computeROI(createBaseForm({ ...base, aplica_taxa_minima: true }))
    const semTaxa = computeROI(createBaseForm({ ...base, aplica_taxa_minima: false }))

    expect(comTaxa.economia[0]).toBeLessThan(semTaxa.economia[0])
    expect(semTaxa.economia[0]).toBeCloseTo(300, 6)
  })

  it('projeta inflação energética de forma composta anualmente (8%)', () => {
    const resultado = computeROI(
      createBaseForm({
        consumo_kwh_mes: 500,
        geracao_estimada_kwh_mes: 0,
        tarifa_r_kwh: 1,
        inflacao_energia_aa_pct: 8,
        taxa_minima_mensal: 0,
        taxa_minima_r_mes: 0,
        tusd_percentual: 0,
      }),
    )

    const economiaAno1 = resultado.economia[0]
    const economiaAno2 = resultado.economia[12]

    expect(economiaAno1).toBeCloseTo(500, 6)
    expect(economiaAno2).toBeCloseTo(500 * Math.pow(1.08, 1), 6)
  })

  it('ajusta projeção quando inflação configurada é 5%', () => {
    const resultado = computeROI(
      createBaseForm({
        consumo_kwh_mes: 400,
        geracao_estimada_kwh_mes: 0,
        tarifa_r_kwh: 1,
        inflacao_energia_aa_pct: 5,
        taxa_minima_mensal: 0,
        taxa_minima_r_mes: 0,
        tusd_percentual: 0,
      }),
    )

    const economiaAno1 = resultado.economia[0]
    const economiaAno3 = resultado.economia[24]

    expect(economiaAno1).toBeCloseTo(400, 6)
    expect(economiaAno3).toBeCloseTo(400 * Math.pow(1.05, 2), 6)
  })
})
