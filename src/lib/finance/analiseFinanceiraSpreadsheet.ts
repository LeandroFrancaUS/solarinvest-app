import {
  AnaliseFinanceiraError,
  type AnaliseFinanceiraInput,
  type AnaliseFinanceiraOutput,
  type StatusVenda,
  type UF,
} from '../../types/analiseFinanceira'
import {
  computeIRR,
  computeNPV,
  computePayback,
  computeDiscountedPayback,
  toMonthlyRate,
} from './investmentMetrics'
import { computeTaxes } from '../../domain/finance/taxation'

// ─── Constants ───────────────────────────────────────────────────────────────

export const COMBUSTIVEL_DF_RS = 250
export const COMBUSTIVEL_GO_RS = 0

export const PRECO_PLACA_RS = 18
export const MATERIAL_CA_PERCENT_DO_KIT = 12

export const CREA_GO_RS = 104
export const CREA_DF_RS = 109

export interface ProjetoFaixa {
  max_kwp: number
  valor_rs: number
}

export const PROJETO_FAIXAS: ProjetoFaixa[] = [
  { max_kwp: 6, valor_rs: 400 },
  { max_kwp: 10, valor_rs: 500 },
  { max_kwp: 20, valor_rs: 700 },
  { max_kwp: 30, valor_rs: 1000 },
  { max_kwp: 50, valor_rs: 1200 },
  { max_kwp: Infinity, valor_rs: 2500 },
]

export const SEGURO_LIMIAR_RS = 18911.56
export const SEGURO_FAIXA_BAIXA_PERCENT = 3.05
export const SEGURO_FAIXA_ALTA_PERCENT = 0.735
export const SEGURO_PISO_RS = 139

// ─── Utilities ───────────────────────────────────────────────────────────────

export function toDecimalPercent(percent: number): number {
  return percent / 100
}

export function resolveCustoProjetoPorFaixa(
  kwp: number,
  faixas: ProjetoFaixa[] = PROJETO_FAIXAS,
): number {
  for (const faixa of faixas) {
    if (kwp <= faixa.max_kwp) {
      return faixa.valor_rs
    }
  }
  return faixas[faixas.length - 1]?.valor_rs ?? 2500
}

export function resolveCrea(uf: UF): number {
  return uf === 'DF' ? CREA_DF_RS : CREA_GO_RS
}

export function resolveCombustivel(uf: UF): number {
  return uf === 'DF' ? COMBUSTIVEL_DF_RS : COMBUSTIVEL_GO_RS
}

export function calcSeguroLeasing(valorContrato: number): number {
  if (valorContrato < SEGURO_LIMIAR_RS) {
    return valorContrato * (SEGURO_FAIXA_BAIXA_PERCENT / 100)
  }
  return Math.max(SEGURO_PISO_RS, valorContrato * (SEGURO_FAIXA_ALTA_PERCENT / 100))
}

export function calcComissaoDinamica(
  margemSemComissao: number,
  margemMinima: number,
  comissaoMinimaFrac: number,
): number {
  return margemSemComissao >= margemMinima ? comissaoMinimaFrac : 0
}

/**
 * Calcula o preço de venda que atinge exatamente a margem líquida alvo final
 * (após aplicar a comissão mínima), levando em conta que o imposto NÃO incide
 * sobre custo_kit_rs + frete_rs.
 *
 * Derivação (imposto apenas sobre a parcela tributável):
 *   Tax  = (P − kit − frete) × α
 *   P    = CV + Tax + P×β + P×γ + P×μ
 *   P × (1 − α − β − γ − μ) = CV − (kit + frete) × α
 *   P    = (CV − (kit + frete) × α) / (1 − α − β − γ − μ)
 *
 * Quando custo_kit_rs e frete_rs são omitidos (padrão 0), a fórmula reduz-se
 * ao caso anterior P = CV / den — compatibilidade retroativa garantida.
 */
export function calcPrecoIdeal(
  custo_variavel_total: number,
  impostos_percent: number,
  custo_fixo_rateado_percent: number,
  margem_alvo_percent: number,
  comissao_minima_percent: number,
  custo_kit_rs = 0,
  frete_rs = 0,
): number {
  const alpha = impostos_percent / 100
  const den =
    1 -
    alpha -
    custo_fixo_rateado_percent / 100 -
    margem_alvo_percent / 100 -
    comissao_minima_percent / 100

  if (den <= 0) throw new AnaliseFinanceiraError('DENOMINADOR_PRECO_MINIMO_INVALIDO')
  const kitFreteTaxSavings = (custo_kit_rs + frete_rs) * alpha
  return (custo_variavel_total - kitFreteTaxSavings) / den
}

// ─── Core calculation phases ──────────────────────────────────────────────────

function validateInput(input: AnaliseFinanceiraInput): void {
  if (!Number.isFinite(input.consumo_kwh_mes) || input.consumo_kwh_mes <= 0) {
    throw new AnaliseFinanceiraError('INPUT_INVALID_CONSUMO')
  }
  if (!Number.isFinite(input.irradiacao_kwh_m2_dia) || input.irradiacao_kwh_m2_dia <= 0) {
    throw new AnaliseFinanceiraError('INPUT_INVALID_IRRADIACAO')
  }
  if (!Number.isFinite(input.performance_ratio) || input.performance_ratio <= 0) {
    throw new AnaliseFinanceiraError('INPUT_INVALID_PR')
  }
  if (!Number.isFinite(input.potencia_modulo_wp) || input.potencia_modulo_wp <= 0) {
    throw new AnaliseFinanceiraError('INPUT_INVALID_POTENCIA_MODULO')
  }
  const percentFields: (keyof AnaliseFinanceiraInput)[] = [
    'impostos_percent',
    'custo_fixo_rateado_percent',
    'lucro_minimo_percent',
    'comissao_minima_percent',
    'inadimplencia_percent',
    'custo_operacional_percent',
  ]
  for (const field of percentFields) {
    const val = Number(input[field])
    if (!Number.isFinite(val) || val < 0 || val > 100) {
      throw new AnaliseFinanceiraError('INPUT_INVALID_PERCENTUAL')
    }
  }
  if (input.modo === 'leasing') {
    if (!Number.isFinite(input.meses_projecao) || input.meses_projecao <= 0) {
      throw new AnaliseFinanceiraError('MENSALIDADES_TAMANHO_INVALIDO')
    }
    if (input.mensalidades_previstas_rs.length !== input.meses_projecao) {
      throw new AnaliseFinanceiraError('MENSALIDADES_TAMANHO_INVALIDO')
    }
  }
  if (!Number.isFinite(input.investimento_inicial_rs) || input.investimento_inicial_rs <= 0) {
    throw new AnaliseFinanceiraError('INVESTIMENTO_INICIAL_INVALIDO')
  }
}

export function calcularBaseSistema(input: Pick<AnaliseFinanceiraInput, 'consumo_kwh_mes' | 'irradiacao_kwh_m2_dia' | 'performance_ratio' | 'dias_mes' | 'potencia_modulo_wp'>): {
  potencia_sistema_kwp: number
  quantidade_modulos: number
} {
  const fatorGeracaoMensal =
    input.irradiacao_kwh_m2_dia * input.performance_ratio * input.dias_mes
  const potenciaNecessariaKwp = input.consumo_kwh_mes / fatorGeracaoMensal
  const quantidade_modulos = Math.ceil((potenciaNecessariaKwp * 1000) / input.potencia_modulo_wp)
  const potencia_sistema_kwp = (quantidade_modulos * input.potencia_modulo_wp) / 1000
  return { potencia_sistema_kwp, quantidade_modulos }
}

function calcularCustosTecnicos(
  input: AnaliseFinanceiraInput,
  potencia_sistema_kwp: number,
  quantidade_modulos: number,
): {
  custo_projeto_rs: number
  material_ca_rs: number
  crea_rs: number
  placa_rs: number
  combustivel_rs: number
} {
  const custo_projeto_rs = input.projeto_rs_override != null ? input.projeto_rs_override : resolveCustoProjetoPorFaixa(potencia_sistema_kwp)
  const material_ca_rs = input.material_ca_rs_override != null ? input.material_ca_rs_override : input.custo_kit_rs * (MATERIAL_CA_PERCENT_DO_KIT / 100)
  const crea_rs = input.crea_rs_override != null ? input.crea_rs_override : resolveCrea(input.uf)
  const placa_rs = input.placa_rs_override != null ? input.placa_rs_override : quantidade_modulos * PRECO_PLACA_RS
  // combustivel_rs is kept in the output for backward compatibility but no longer added to costs
  const combustivel_rs = 0
  return { custo_projeto_rs, material_ca_rs, crea_rs, placa_rs, combustivel_rs }
}

function calcularCustoVariavelTotal(
  input: AnaliseFinanceiraInput,
  custosTecnicos: ReturnType<typeof calcularCustosTecnicos>,
): number {
  return (
    input.custo_kit_rs +
    input.frete_rs +
    input.descarregamento_rs +
    custosTecnicos.custo_projeto_rs +
    input.instalacao_rs +
    custosTecnicos.material_ca_rs +
    custosTecnicos.crea_rs +
    custosTecnicos.placa_rs +
    input.hotel_pousada_rs +
    input.transporte_combustivel_rs +
    input.outros_rs +
    input.deslocamento_instaladores_rs
  )
}

function calcularAnaliseVenda(
  input: AnaliseFinanceiraInput,
  custo_variavel_total_rs: number,
): Partial<AnaliseFinanceiraOutput> {
  const { valor_contrato_rs } = input

  // Use margem_liquida_minima_percent (UI-configurable) when provided; fall back to lucro_minimo_percent
  const margemMinima = input.margem_liquida_minima_percent != null && Number.isFinite(input.margem_liquida_minima_percent)
    ? input.margem_liquida_minima_percent
    : input.lucro_minimo_percent
  const margemMinFrac = toDecimalPercent(margemMinima)
  const margemAlvo = input.margem_liquida_alvo_percent != null && Number.isFinite(input.margem_liquida_alvo_percent) && input.margem_liquida_alvo_percent > 0
    ? input.margem_liquida_alvo_percent
    : margemMinima
  const margemAlvoFrac = toDecimalPercent(margemAlvo)


  // Imposto incide sobre o valor do contrato excluindo custo do kit e frete.
  const taxResultVenda = computeTaxes({
    modo: 'venda',
    totalAntesImposto: valor_contrato_rs,
    custoKit: input.custo_kit_rs,
    frete: input.frete_rs,
    aliquota: toDecimalPercent(input.impostos_percent),
  })
  const impostos_rs = taxResultVenda.valorImposto
  const custo_fixo_rateado_rs =
    valor_contrato_rs * toDecimalPercent(input.custo_fixo_rateado_percent)

  const lucro_liquido_sem_comissao_rs =
    valor_contrato_rs - custo_variavel_total_rs - impostos_rs - custo_fixo_rateado_rs

  const margem_liquida_sem_comissao =
    valor_contrato_rs > 0 ? lucro_liquido_sem_comissao_rs / valor_contrato_rs : 0

  const comissao_fracao = calcComissaoDinamica(
    margem_liquida_sem_comissao,
    margemMinFrac,
    toDecimalPercent(input.comissao_minima_percent),
  )
  const comissao_percent = comissao_fracao * 100
  const comissao_rs = valor_contrato_rs * comissao_fracao

  const custo_total_real_rs =
    custo_variavel_total_rs + impostos_rs + custo_fixo_rateado_rs + comissao_rs

  const lucro_liquido_final_rs = lucro_liquido_sem_comissao_rs - comissao_rs
  const margem_liquida_final =
    valor_contrato_rs > 0 ? lucro_liquido_final_rs / valor_contrato_rs : 0

  let status_venda: StatusVenda
  if (margem_liquida_sem_comissao < margemMinFrac) {
    status_venda = 'BLOQUEAR_VENDA'
  } else if (margem_liquida_final >= margemAlvoFrac) {
    status_venda = 'VENDA_SAUDAVEL'
  } else if (margem_liquida_final >= margemMinFrac && comissao_fracao > 0) {
    status_venda = 'COMISSAO_MINIMA'
  } else {
    status_venda = 'SEM_COMISSAO'
  }

  // Tax savings from kit+frete exclusion — used to adjust all price recommendation numerators.
  // Derivation: P × (1 − α − …) = CV − (kit + frete) × α
  const kitFreteTaxSavings =
    (input.custo_kit_rs + input.frete_rs) * toDecimalPercent(input.impostos_percent)

  // Preço Mín. Aceitável: covers margin but leaves NO room for commission
  const denAceitavel =
    1 -
    toDecimalPercent(input.impostos_percent) -
    toDecimalPercent(input.custo_fixo_rateado_percent) -
    toDecimalPercent(margemMinima)

  let preco_minimo_aceitavel_rs: number | undefined
  if (denAceitavel > 0) {
    preco_minimo_aceitavel_rs = (custo_variavel_total_rs - kitFreteTaxSavings) / denAceitavel
  }

  // Preço Mín. Saudável: margin + minimum commission (3%)
  const den =
    1 -
    toDecimalPercent(input.impostos_percent) -
    toDecimalPercent(input.custo_fixo_rateado_percent) -
    toDecimalPercent(margemMinima) -
    toDecimalPercent(input.comissao_minima_percent)

  if (den <= 0) {
    throw new AnaliseFinanceiraError('DENOMINADOR_PRECO_MINIMO_INVALIDO')
  }

  const preco_minimo_saudavel_rs = (custo_variavel_total_rs - kitFreteTaxSavings) / den
  const desconto_maximo_percent =
    valor_contrato_rs > 0
      ? (1 - preco_minimo_saudavel_rs / valor_contrato_rs) * 100
      : 0

  const lucro_minimo_rs = valor_contrato_rs * toDecimalPercent(input.lucro_minimo_percent)
  const margem_rs = valor_contrato_rs - custo_variavel_total_rs

  let preco_ideal_rs: number | undefined
  if (
    input.margem_liquida_alvo_percent != null &&
    Number.isFinite(input.margem_liquida_alvo_percent) &&
    input.margem_liquida_alvo_percent > 0
  ) {
    try {
      preco_ideal_rs = calcPrecoIdeal(
        custo_variavel_total_rs,
        input.impostos_percent,
        input.custo_fixo_rateado_percent,
        input.margem_liquida_alvo_percent,
        input.comissao_minima_percent,
        input.custo_kit_rs,
        input.frete_rs,
      )
    } catch {
      preco_ideal_rs = undefined
    }
  }

  return {
    custo_variavel_total_rs,
    margem_rs,
    lucro_minimo_rs,
    status_venda,
    comissao_percent,
    comissao_rs,
    custo_total_real_rs,
    impostos_rs,
    custo_fixo_rateado_rs,
    lucro_liquido_sem_comissao_rs,
    margem_liquida_sem_comissao_percent: margem_liquida_sem_comissao * 100,
    lucro_liquido_final_rs,
    margem_liquida_final_percent: margem_liquida_final * 100,
    ...(preco_minimo_aceitavel_rs !== undefined ? { preco_minimo_aceitavel_rs } : undefined),
    preco_minimo_saudavel_rs,
    ...(preco_ideal_rs !== undefined ? { preco_ideal_rs } : undefined),
    desconto_maximo_percent,
  } as Partial<AnaliseFinanceiraOutput>
}

function calcularAnaliseLeasing(
  input: AnaliseFinanceiraInput,
  custo_variavel_total_rs: number,
): Partial<AnaliseFinanceiraOutput> {
  const seguro_rs = calcSeguroLeasing(input.valor_contrato_rs)

  // Commission for leasing (CAC) = full value of the first monthly installment
  const comissao_leasing_rs = input.mensalidades_previstas_rs[0] ?? 0

  // Investimento total do leasing: CAPEX + CAC + seguro obrigatório
  const investimento_total_leasing_rs = custo_variavel_total_rs + comissao_leasing_rs + seguro_rs

  const custo_total_rs = investimento_total_leasing_rs

  const impostosDecimal = toDecimalPercent(input.impostos_percent)

  // fator_liquido combines all per-period deductions:
  // taxes on revenue + default-risk losses + operational costs
  const fator_liquido =
    1 -
    impostosDecimal -
    toDecimalPercent(input.inadimplencia_percent) -
    toDecimalPercent(input.custo_operacional_percent)

  const projecao_mensalidades_rs = input.mensalidades_previstas_rs.map(
    (v) => v * fator_liquido,
  )

  const receita_bruta_rs = input.mensalidades_previstas_rs.reduce((sum, v) => sum + v, 0)
  // Imposto incide somente sobre as mensalidades (leasing): usa computeTaxes por período.
  const impostos_rs_leasing = computeTaxes({
    modo: 'leasing',
    mensalidade: receita_bruta_rs,
    aliquota: impostosDecimal,
  }).valorImposto

  const receita_liquida_rs = projecao_mensalidades_rs.reduce((sum, v) => sum + v, 0)
  const lucro_rs = receita_liquida_rs - custo_total_rs

  // Leitura gerencial explícita
  const receita_total_contrato_rs = receita_bruta_rs
  const lucro_total_contrato_rs = lucro_rs

  // Average net monthly income — basis for analytical paybacks
  const n = projecao_mensalidades_rs.length
  const lucro_mensal_medio_rs = n > 0 ? receita_liquida_rs / n : 0
  const receita_liquida_mensal_rs = lucro_mensal_medio_rs

  // Analytical paybacks (floating months, not simulation-based)
  const payback_capex_meses: number | null =
    lucro_mensal_medio_rs > 0 ? custo_variavel_total_rs / lucro_mensal_medio_rs : null

  const payback_cac_meses: number | null =
    lucro_mensal_medio_rs > 0 && comissao_leasing_rs > 0
      ? comissao_leasing_rs / lucro_mensal_medio_rs
      : null

  const payback_total_meses: number | null =
    lucro_mensal_medio_rs > 0 ? investimento_total_leasing_rs / lucro_mensal_medio_rs : null

  const multiplo_capital_investido: number | null =
    investimento_total_leasing_rs > 0 ? receita_total_contrato_rs / investimento_total_leasing_rs : null

  const break_even_meses = payback_total_meses

  // Maximum affordable commission for a given payback target (legacy / venda-like)
  const comissao_maxima_rs: number | null =
    input.payback_alvo_meses != null &&
    Number.isFinite(input.payback_alvo_meses) &&
    input.payback_alvo_meses > 0 &&
    lucro_mensal_medio_rs > 0
      ? input.payback_alvo_meses * lucro_mensal_medio_rs - custo_variavel_total_rs
      : null

  return {
    seguro_rs,
    comissao_leasing_rs,
    impostos_rs_leasing,
    investimento_total_leasing_rs,
    custo_total_rs,
    projecao_mensalidades_rs,
    fator_liquido,
    receita_liquida_rs,
    receita_liquida_mensal_rs,
    receita_total_contrato_rs,
    lucro_total_contrato_rs,
    lucro_rs,
    lucro_mensal_medio_rs,
    payback_capex_meses,
    payback_cac_meses,
    payback_total_meses,
    multiplo_capital_investido,
    break_even_meses,
    comissao_maxima_rs,
  }
}

export function calcularKpis(
  fluxos: number[],
  investimento_inicial_rs: number,
  lucro_base: number,
  taxa_desconto_aa_pct?: number | null,
): Pick<AnaliseFinanceiraOutput, 'roi_percent' | 'payback_meses' | 'tir_mensal_percent' | 'tir_anual_percent' | 'vpl' | 'payback_descontado_meses'> {
  const roi_percent = (lucro_base / investimento_inicial_rs) * 100

  // Build full cash-flow series with the investment at t0
  const fluxosComInvestimento = [-investimento_inicial_rs, ...fluxos]

  const payback_meses = computePayback(fluxosComInvestimento)

  const tirMensal = computeIRR(fluxosComInvestimento)
  const tir_mensal_percent = tirMensal !== null ? tirMensal * 100 : null
  const tir_anual_percent =
    tirMensal !== null ? (Math.pow(1 + tirMensal, 12) - 1) * 100 : null

  // VPL and discounted payback (only when a discount rate is provided)
  const hasDiscount =
    taxa_desconto_aa_pct != null &&
    Number.isFinite(taxa_desconto_aa_pct) &&
    taxa_desconto_aa_pct > 0
  const taxaMensal = hasDiscount ? toMonthlyRate(taxa_desconto_aa_pct) : 0

  const vpl = hasDiscount
    ? computeNPV(fluxosComInvestimento, taxaMensal)
    : null

  const payback_descontado_meses = hasDiscount
    ? computeDiscountedPayback(fluxosComInvestimento, taxaMensal)
    : null

  return {
    roi_percent,
    payback_meses,
    tir_mensal_percent,
    tir_anual_percent,
    vpl,
    payback_descontado_meses,
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export function calcularAnaliseFinanceira(
  input: AnaliseFinanceiraInput,
): AnaliseFinanceiraOutput {
  validateInput(input)

  const { potencia_sistema_kwp, quantidade_modulos } =
    input.quantidade_modulos_override != null && input.quantidade_modulos_override > 0
      ? {
          quantidade_modulos: input.quantidade_modulos_override,
          potencia_sistema_kwp: (input.quantidade_modulos_override * input.potencia_modulo_wp) / 1000,
        }
      : calcularBaseSistema(input)

  const custosTecnicos = calcularCustosTecnicos(input, potencia_sistema_kwp, quantidade_modulos)

  const custo_variavel_total_rs = calcularCustoVariavelTotal(input, custosTecnicos)

  if (input.modo === 'venda') {
    const vendaResult = calcularAnaliseVenda(input, custo_variavel_total_rs)

    // Venda is modelled as a single-period transaction:
    //   t0: −investimento_inicial_rs  (cost to execute the project)
    //   t1: +(investimento_inicial_rs + lucro_liquido_final_rs)
    //       (capital returned + net profit after all fees)
    //
    // Consequence: TIR = lucro/investimento per period = simple ROI per period.
    // This is mathematically correct and explicitly documented (see FINANCIAL_AUDIT_REPORT).
    const lucro = vendaResult.lucro_liquido_final_rs ?? 0
    // fluxosVenda contains only the t1 inflow: the t0 outflow (−investimento)
    // is prepended inside calcularKpis to form the complete [-inv, inv+lucro] series.
    const fluxosVenda: number[] = [input.investimento_inicial_rs + lucro]

    const kpis = calcularKpis(
      fluxosVenda,
      input.investimento_inicial_rs,
      lucro,
      input.taxa_desconto_aa_pct,
    )

    return {
      potencia_sistema_kwp,
      quantidade_modulos,
      ...custosTecnicos,
      deslocamento_instaladores_rs: input.deslocamento_instaladores_rs,
      ...vendaResult,
      ...kpis,
    }
  }

  // Leasing: need comissao from venda calc first (for preco_minimo display)
  const vendaResult = calcularAnaliseVenda(input, custo_variavel_total_rs)
  const leasingResult = calcularAnaliseLeasing(
    input,
    custo_variavel_total_rs,
  )

  // Use CAPEX + CAC as the investment base so TIR, VPL and payback_meses
  // correctly account for the commission paid at contract signing.
  const investimentoKpi = leasingResult.investimento_total_leasing_rs ?? custo_variavel_total_rs

  const kpis = calcularKpis(
    leasingResult.projecao_mensalidades_rs ?? [],
    investimentoKpi,
    leasingResult.lucro_rs ?? 0,
    input.taxa_desconto_aa_pct,
  )

  return {
    potencia_sistema_kwp,
    quantidade_modulos,
    ...custosTecnicos,
    deslocamento_instaladores_rs: input.deslocamento_instaladores_rs,
    // Include venda fields too (useful for display)
    custo_variavel_total_rs,
    comissao_percent: vendaResult.comissao_percent,
    comissao_rs: vendaResult.comissao_rs,
    preco_minimo_aceitavel_rs: vendaResult.preco_minimo_aceitavel_rs,
    preco_minimo_saudavel_rs: vendaResult.preco_minimo_saudavel_rs,
    ...leasingResult,
    ...kpis,
  } as AnaliseFinanceiraOutput
}
