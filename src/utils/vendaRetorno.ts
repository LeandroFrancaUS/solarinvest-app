export type PagamentoCondicao = 'AVISTA' | 'PARCELADO' | 'FINANCIAMENTO'
export type ModoPagamento = 'PIX' | 'DEBITO' | 'CREDITO'

export interface VendaForm {
  potencia_instalada_kwp?: number
  geracao_estimada_kwh_mes?: number
  quantidade_modulos?: number
  modelo_modulo?: string
  modelo_inversor?: string

  consumo_kwh_mes: number
  tarifa_cheia_r_kwh: number
  inflacao_energia_aa_pct: number
  taxa_minima_mensal: number
  horizonte_meses: number

  capex_total: number
  condicao: PagamentoCondicao
  modo_pagamento?: ModoPagamento

  taxa_mdr_pix_pct?: number
  taxa_mdr_debito_pct?: number
  taxa_mdr_credito_vista_pct?: number
  taxa_mdr_credito_parcelado_pct?: number
  n_parcelas?: number
  juros_cartao_aa_pct?: number
  juros_cartao_am_pct?: number

  n_parcelas_fin?: number
  juros_fin_aa_pct?: number
  juros_fin_am_pct?: number
  entrada_financiamento?: number

  taxa_desconto_aa_pct?: number
}

export interface RetornoProjetado {
  economia: number[]
  pagamentoMensal: number[]
  fluxo: number[]
  saldo: number[]
  payback: number | null
  roi: number
  vpl?: number
}

const toMonthlyRate = (annualRatePct?: number): number => {
  if (!Number.isFinite(annualRatePct)) {
    return 0
  }
  const annualRate = (annualRatePct ?? 0) / 100
  if (annualRate <= -1) {
    return 0
  }
  return Math.pow(1 + annualRate, 1 / 12) - 1
}

const toFraction = (value?: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return value ?? 0
}

const clampNonNegative = (value: number): number => (value < 0 ? 0 : value)

const pmt = (rate: number, nper: number, pv: number): number => {
  if (nper <= 0) {
    return 0
  }
  if (Math.abs(rate) < 1e-10) {
    return nper === 0 ? 0 : pv / nper
  }
  const factor = Math.pow(1 + rate, nper)
  return (pv * rate * factor) / (factor - 1)
}

export function computeROI(form: VendaForm): RetornoProjetado {
  const horizonte = Math.max(0, Math.floor(form.horizonte_meses))
  const totalMeses = horizonte + 1
  const economia: number[] = Array(totalMeses).fill(0)
  const pagamentoMensal: number[] = Array(totalMeses).fill(0)
  const fluxo: number[] = Array(totalMeses).fill(0)
  const saldo: number[] = Array(totalMeses).fill(0)

  const inflacaoMensal = toMonthlyRate(form.inflacao_energia_aa_pct)
  const consumo = clampNonNegative(form.consumo_kwh_mes)
  const tarifaCheia = clampNonNegative(form.tarifa_cheia_r_kwh)
  const taxaMinima = clampNonNegative(form.taxa_minima_mensal)

  for (let mes = 1; mes <= horizonte; mes += 1) {
    const fator = Math.pow(1 + inflacaoMensal, mes - 1)
    const tarifaMes = tarifaCheia * fator
    const economiaMes = Math.max(0, consumo * tarifaMes - taxaMinima)
    economia[mes] = economiaMes
  }

  const capex = clampNonNegative(form.capex_total)
  let pagamentoTotal = 0

  if (form.condicao === 'AVISTA') {
    const modo = form.modo_pagamento ?? 'PIX'
    const taxaMdr =
      modo === 'PIX'
        ? toFraction(form.taxa_mdr_pix_pct)
        : modo === 'DEBITO'
        ? toFraction(form.taxa_mdr_debito_pct)
        : toFraction(form.taxa_mdr_credito_vista_pct)
    const p0 = capex * (1 + taxaMdr)
    pagamentoMensal[0] = p0
    pagamentoTotal += p0
  } else if (form.condicao === 'PARCELADO') {
    const parcelas = Math.max(0, Math.floor(form.n_parcelas ?? 0))
    const jurosMensal = Number.isFinite(form.juros_cartao_am_pct)
      ? toFraction(form.juros_cartao_am_pct) / 100
      : toMonthlyRate(form.juros_cartao_aa_pct)
    const parcelaBase = parcelas > 0 ? pmt(jurosMensal, parcelas, capex) : 0
    const taxaMdr = toFraction(form.taxa_mdr_credito_parcelado_pct)
    const parcelaComMdr = parcelaBase * (1 + taxaMdr)
    for (let mes = 1; mes <= horizonte; mes += 1) {
      if (mes <= parcelas) {
        pagamentoMensal[mes] = parcelaComMdr
        pagamentoTotal += parcelaComMdr
      }
    }
  } else if (form.condicao === 'FINANCIAMENTO') {
    const parcelas = Math.max(0, Math.floor(form.n_parcelas_fin ?? 0))
    const entrada = clampNonNegative(form.entrada_financiamento ?? 0)
    if (entrada > 0) {
      pagamentoMensal[0] = entrada
      pagamentoTotal += entrada
    }
    const pv = Math.max(0, capex - entrada)
    const jurosMensal = Number.isFinite(form.juros_fin_am_pct)
      ? toFraction(form.juros_fin_am_pct) / 100
      : toMonthlyRate(form.juros_fin_aa_pct)
    const parcela = parcelas > 0 ? pmt(jurosMensal, parcelas, pv) : 0
    for (let mes = 1; mes <= horizonte; mes += 1) {
      if (mes <= parcelas) {
        pagamentoMensal[mes] = parcela
        pagamentoTotal += parcela
      }
    }
  }

  for (let mes = 0; mes <= horizonte; mes += 1) {
    const pagamento = pagamentoMensal[mes] ?? 0
    const econ = economia[mes] ?? 0
    const fluxoMes = econ - pagamento
    fluxo[mes] = fluxoMes
    saldo[mes] = mes === 0 ? fluxoMes : saldo[mes - 1] + fluxoMes
  }

  let payback: number | null = null
  for (let mes = 1; mes <= horizonte; mes += 1) {
    if (saldo[mes] >= 0) {
      payback = mes
      break
    }
  }

  let roi = 0
  if (form.condicao === 'AVISTA') {
    const modo = form.modo_pagamento ?? 'PIX'
    const taxaMdr =
      modo === 'PIX'
        ? toFraction(form.taxa_mdr_pix_pct)
        : modo === 'DEBITO'
        ? toFraction(form.taxa_mdr_debito_pct)
        : toFraction(form.taxa_mdr_credito_vista_pct)
    const investimentoInicial = capex * (1 + taxaMdr)
    if (investimentoInicial > 0) {
      const economiaTotal = economia.reduce((acc, val) => acc + val, 0)
      roi = (economiaTotal - investimentoInicial) / investimentoInicial
    }
  } else {
    if (pagamentoTotal > 0) {
      const economiaTotal = economia.reduce((acc, val) => acc + val, 0)
      roi = (economiaTotal - pagamentoTotal) / pagamentoTotal
    }
  }

  let vpl: number | undefined
  if (Number.isFinite(form.taxa_desconto_aa_pct) && form.taxa_desconto_aa_pct !== undefined) {
    const descontoMensal = toMonthlyRate(form.taxa_desconto_aa_pct)
    let acumulado = 0
    for (let mes = 0; mes <= horizonte; mes += 1) {
      const fator = Math.pow(1 + descontoMensal, mes)
      acumulado += fluxo[mes] / fator
    }
    vpl = acumulado
  }

  return { economia, pagamentoMensal, fluxo, saldo, payback, roi, vpl }
}
