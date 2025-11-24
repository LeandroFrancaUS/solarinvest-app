import { calcTusdEncargoMensal } from './tusd'
import type { TipoClienteTUSD } from './tusd'
import type { TipoBasicoCliente } from '../../types/tipoBasico'

export type PagamentoCondicao =
  | 'AVISTA'
  | 'PARCELADO'
  | 'BOLETO'
  | 'DEBITO_AUTOMATICO'
  | 'FINANCIAMENTO'
export type ModoPagamento = 'PIX' | 'DEBITO' | 'CREDITO'

export type SegmentoCliente = TipoBasicoCliente
export type TipoSistema = 'ON_GRID' | 'HIBRIDO' | 'OFF_GRID'

export interface VendaForm {
  potencia_instalada_kwp?: number | undefined
  geracao_estimada_kwh_mes?: number | undefined
  quantidade_modulos?: number | undefined
  modelo_modulo?: string | undefined
  modelo_inversor?: string | undefined
  estrutura_suporte?: string | undefined
  numero_orcamento_vendor?: string | undefined

  segmento_cliente?: SegmentoCliente | undefined
  tipo_sistema?: TipoSistema | undefined

  consumo_kwh_mes: number
  tarifa_cheia_r_kwh: number
  inflacao_energia_aa_pct: number
  taxa_minima_mensal: number
  horizonte_meses: number

  capex_total: number
  condicao: PagamentoCondicao
  modo_pagamento?: ModoPagamento | undefined

  taxa_mdr_pix_pct?: number | undefined
  taxa_mdr_debito_pct?: number | undefined
  taxa_mdr_credito_vista_pct?: number | undefined
  taxa_mdr_credito_parcelado_pct?: number | undefined
  n_parcelas?: number | undefined
  n_boletos?: number | undefined
  n_debitos?: number | undefined
  juros_cartao_aa_pct?: number | undefined
  juros_cartao_am_pct?: number | undefined

  n_parcelas_fin?: number | undefined
  juros_fin_aa_pct?: number | undefined
  juros_fin_am_pct?: number | undefined
  entrada_financiamento?: number | undefined

  taxa_desconto_aa_pct?: number | undefined

  tarifa_r_kwh?: number | undefined
  taxa_minima_r_mes?: number | undefined

  validade_proposta?: string | undefined
  prazo_execucao?: string | undefined
  condicoes_adicionais?: string | undefined

  tusd_percentual?: number | undefined
  tusd_tipo_cliente?: TipoClienteTUSD | undefined
  tusd_subtipo?: string | undefined
  tusd_simultaneidade?: number | undefined
  tusd_tarifa_r_kwh?: number | undefined
  tusd_ano_referencia?: number | undefined
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
  const economia = (() => {
    const geracao = clampNonNegative(sanitizeNumber(form.geracao_estimada_kwh_mes, 0))
    const consumo = clampNonNegative(sanitizeNumber(form.consumo_kwh_mes, 0))
    const baseEnergia = geracao > 0 ? geracao : consumo
    const tarifa = clampNonNegative(
      sanitizeNumber(form.tarifa_r_kwh, sanitizeNumber(form.tarifa_cheia_r_kwh, 0)),
    )
    const taxaMinima = clampNonNegative(
      sanitizeNumber(form.taxa_minima_r_mes, sanitizeNumber(form.taxa_minima_mensal, 0)),
    )
    const economiaBruta = Math.max(0, baseEnergia * tarifa - taxaMinima)

    const economia = Array.from({ length: HORIZON_MONTHS }, (_, index) =>
      Math.max(
        0,
        economiaBruta -
          calcTusdEncargoMensal({
            consumoMensal_kWh: baseEnergia,
            tarifaCheia_R_kWh: tarifa,
            mes: index + 1,
            anoReferencia: form.tusd_ano_referencia ?? null,
            tipoCliente: form.tusd_tipo_cliente ?? null,
            subTipo: form.tusd_subtipo ?? null,
            pesoTUSD: form.tusd_percentual ?? null,
            tusd_R_kWh: form.tusd_tarifa_r_kwh ?? null,
            simultaneidadePadrao: form.tusd_simultaneidade ?? null,
          }),
      ),
    )

    return economia
  })()

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
  } else if (condicao === 'BOLETO') {
    const boletos = Math.max(0, Math.floor(sanitizeNumber(form.n_boletos, 12)))
    const valorBoleto = boletos > 0 ? capex / boletos : 0
    for (let mes = 1; mes <= boletos && mes <= HORIZON_MONTHS; mes += 1) {
      pagamentoMensal[mes - 1] = valorBoleto
      totalPagamentos += valorBoleto
    }
  } else if (condicao === 'DEBITO_AUTOMATICO') {
    const debitos = Math.max(0, Math.floor(sanitizeNumber(form.n_debitos, 12)))
    const valorDebito = debitos > 0 ? capex / debitos : 0
    for (let mes = 1; mes <= debitos && mes <= HORIZON_MONTHS; mes += 1) {
      pagamentoMensal[mes - 1] = valorDebito
      totalPagamentos += valorDebito
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
