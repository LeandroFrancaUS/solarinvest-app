export type PagamentoCondicao = 'AVISTA' | 'PARCELADO' | 'FINANCIAMENTO'
export type ModoPagamento = 'PIX' | 'DEBITO' | 'CREDITO'

export interface VendaForm {
  potencia_instalada_kwp?: number
  geracao_estimada_kwh_mes?: number
  quantidade_modulos?: number
  modelo_modulo?: string
  modelo_inversor?: string
  estrutura_suporte?: string
  numero_orcamento_vendor?: string

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

  tarifa_r_kwh?: number
  taxa_minima_r_mes?: number
}

export interface RetornoProjetado {
  economia: number[]
  pagamentoMensal: number[]
  fluxo: number[]
  saldo: number[]
  payback: number | null
  roi: number
  vpl?: number
  investimentoInicial: number
  totalPagamentos: number
}

const HORIZON_MONTHS = 360

export function toMonthly(i_aa_pct?: number): number {
  if (!Number.isFinite(i_aa_pct)) return 0
  const anual = (i_aa_pct ?? 0) / 100
  if (anual <= -1) return 0
  return Math.pow(1 + anual, 1 / 12) - 1
}

export function PMT(i_m: number, n: number, pv: number): number {
  if (!Number.isFinite(i_m) || !Number.isFinite(n) || !Number.isFinite(pv)) {
    return 0
  }
  if (n <= 0) {
    return 0
  }
  if (Math.abs(i_m) < 1e-9) {
    return pv / n
  }
  const fator = Math.pow(1 + i_m, n)
  return (pv * (i_m * fator)) / (fator - 1)
}

const clampNonNegative = (value: number): number => (value < 0 ? 0 : value)

const percentToFraction = (value?: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return (value ?? 0) / 100
}

const sanitizeNumber = (value?: number | null, fallback = 0): number => {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Number(value)
}

export function computeROI(form: VendaForm): RetornoProjetado {
  const economiaMensalBase = (() => {
    const geracao = clampNonNegative(sanitizeNumber(form.geracao_estimada_kwh_mes, 0))
    const consumo = clampNonNegative(sanitizeNumber(form.consumo_kwh_mes, 0))
    const baseEnergia = geracao > 0 ? geracao : consumo
    const tarifa = clampNonNegative(
      sanitizeNumber(form.tarifa_r_kwh, sanitizeNumber(form.tarifa_cheia_r_kwh, 0)),
    )
    const taxaMinima = clampNonNegative(
      sanitizeNumber(form.taxa_minima_r_mes, sanitizeNumber(form.taxa_minima_mensal, 0)),
    )
    return Math.max(0, baseEnergia * tarifa - taxaMinima)
  })()

  const economia: number[] = Array(HORIZON_MONTHS).fill(economiaMensalBase)
  const pagamentoMensal: number[] = Array(HORIZON_MONTHS).fill(0)
  const fluxo: number[] = Array(HORIZON_MONTHS).fill(0)
  const saldo: number[] = Array(HORIZON_MONTHS).fill(0)

  const capex = clampNonNegative(sanitizeNumber(form.capex_total, 0))
  const condicao = form.condicao
  const modo = form.modo_pagamento ?? 'PIX'

  let investimentoInicial = 0
  let totalPagamentos = 0

  if (condicao === 'AVISTA') {
    const taxaMdr =
      modo === 'PIX'
        ? percentToFraction(form.taxa_mdr_pix_pct)
        : modo === 'DEBITO'
        ? percentToFraction(form.taxa_mdr_debito_pct)
        : percentToFraction(form.taxa_mdr_credito_vista_pct)
    investimentoInicial = capex * (1 + taxaMdr)
    totalPagamentos = capex
  } else if (condicao === 'PARCELADO') {
    const parcelas = Math.max(0, Math.floor(sanitizeNumber(form.n_parcelas, 12)))
    const jurosMensal = Number.isFinite(form.juros_cartao_am_pct)
      ? percentToFraction(form.juros_cartao_am_pct)
      : toMonthly(form.juros_cartao_aa_pct)
    const parcelaBase = parcelas > 0 ? PMT(jurosMensal, parcelas, capex) : 0
    const taxaMdr = percentToFraction(form.taxa_mdr_credito_parcelado_pct)
    const parcelaComMdr = parcelaBase * (1 + taxaMdr)
    for (let mes = 1; mes <= parcelas && mes <= HORIZON_MONTHS; mes += 1) {
      pagamentoMensal[mes - 1] = parcelaComMdr
      totalPagamentos += parcelaComMdr
    }
  } else if (condicao === 'FINANCIAMENTO') {
    const parcelas = Math.max(0, Math.floor(sanitizeNumber(form.n_parcelas_fin, 60)))
    const entrada = clampNonNegative(sanitizeNumber(form.entrada_financiamento, 0))
    if (entrada > 0) {
      investimentoInicial = entrada
      totalPagamentos += entrada
    }
    const pv = Math.max(0, capex - entrada)
    const jurosMensal = Number.isFinite(form.juros_fin_am_pct)
      ? percentToFraction(form.juros_fin_am_pct)
      : toMonthly(form.juros_fin_aa_pct)
    const parcela = parcelas > 0 ? PMT(jurosMensal, parcelas, pv) : 0
    for (let mes = 1; mes <= parcelas && mes <= HORIZON_MONTHS; mes += 1) {
      pagamentoMensal[mes - 1] = parcela
      totalPagamentos += parcela
    }
    if (investimentoInicial === 0 && entrada > 0) {
      investimentoInicial = entrada
    }
  }

  let saldoAcumulado = -investimentoInicial
  let payback: number | null = null
  const taxaDescontoMensal = toMonthly(form.taxa_desconto_aa_pct)
  let vplAcumulado = taxaDescontoMensal > 0 ? -investimentoInicial : 0

  for (let mes = 1; mes <= HORIZON_MONTHS; mes += 1) {
    const eco = economia[mes - 1] ?? 0
    const pagamento = pagamentoMensal[mes - 1] ?? 0
    const fluxoMes = eco - pagamento
    fluxo[mes - 1] = fluxoMes
    saldoAcumulado += fluxoMes
    saldo[mes - 1] = saldoAcumulado

    if (payback === null && saldoAcumulado >= 0) {
      payback = mes
    }

    if (taxaDescontoMensal > 0) {
      vplAcumulado += fluxoMes / Math.pow(1 + taxaDescontoMensal, mes)
    }
  }

  const economiaTotal = economia.reduce((acc, val) => acc + val, 0)

  let roi = 0
  if (condicao === 'AVISTA') {
    roi = capex > 0 ? (economiaTotal - capex) / capex : 0
  } else if (totalPagamentos > 0) {
    roi = (economiaTotal - totalPagamentos) / totalPagamentos
  }

  const retorno: RetornoProjetado = {
    economia,
    pagamentoMensal,
    fluxo,
    saldo,
    payback,
    roi,
    investimentoInicial,
    totalPagamentos,
  }

  if (taxaDescontoMensal > 0) {
    retorno.vpl = vplAcumulado
  }

  return retorno
}
