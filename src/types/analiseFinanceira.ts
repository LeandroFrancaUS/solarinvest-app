export type UF = 'GO' | 'DF'
export type ModoAnalise = 'venda' | 'leasing'
export type StatusVenda = 'BLOQUEAR_VENDA' | 'SEM_COMISSAO' | 'COMISSAO_MINIMA' | 'VENDA_SAUDAVEL'

export type AnaliseFinanceiraErrorCode =
  | 'INPUT_INVALID_CONSUMO'
  | 'INPUT_INVALID_IRRADIACAO'
  | 'INPUT_INVALID_PR'
  | 'INPUT_INVALID_POTENCIA_MODULO'
  | 'INPUT_INVALID_PERCENTUAL'
  | 'DENOMINADOR_PRECO_MINIMO_INVALIDO'
  | 'MENSALIDADES_TAMANHO_INVALIDO'
  | 'INVESTIMENTO_INICIAL_INVALIDO'

export class AnaliseFinanceiraError extends Error {
  constructor(public readonly code: AnaliseFinanceiraErrorCode) {
    super(code)
    this.name = 'AnaliseFinanceiraError'
  }
}

export interface AnaliseFinanceiraInput {
  // Contexto
  modo: ModoAnalise
  uf: UF

  // Energia/sistema
  consumo_kwh_mes: number
  irradiacao_kwh_m2_dia: number
  performance_ratio: number
  dias_mes: number
  potencia_modulo_wp: number
  /** When provided, skips auto-calculation from consumption and uses this value directly. */
  quantidade_modulos_override?: number

  // Custos diretos informados
  custo_kit_rs: number
  frete_rs: number
  descarregamento_rs: number
  instalacao_rs: number
  hotel_pousada_rs: number
  transporte_combustivel_rs: number
  outros_rs: number
  /** Pre-computed installer displacement cost (0 = exempt region or not set). */
  deslocamento_instaladores_rs: number
  /** When provided, overrides the auto-calculated placa cost (default: quantidade_modulos × PRECO_PLACA_RS). */
  placa_rs_override?: number
  /** When provided, overrides the auto-calculated material CA cost (default: custo_kit_rs × MATERIAL_CA_PERCENT_DO_KIT / 100). */
  material_ca_rs_override?: number
  /** When provided, overrides the auto-calculated projeto cost (default: faixa by kWp). */
  projeto_rs_override?: number
  /** When provided, overrides the auto-calculated CREA cost (default: based on UF). */
  crea_rs_override?: number

  // Comercial/tributário (Venda e/ou Leasing)
  valor_contrato_rs: number
  impostos_percent: number
  custo_fixo_rateado_percent: number
  lucro_minimo_percent: number
  comissao_minima_percent: number
  margem_liquida_alvo_percent?: number
  /** Minimum net margin required (default 15%). Used to compute preco_minimo_saudavel and preco_minimo_aceitavel. */
  margem_liquida_minima_percent?: number

  // Leasing
  inadimplencia_percent: number
  custo_operacional_percent: number
  meses_projecao: number
  mensalidades_previstas_rs: number[]
  /**
   * Target payback period (months) used to compute comissao_maxima_rs.
   * When not provided, comissao_maxima_rs will be null.
   */
  payback_alvo_meses?: number

  // KPI
  investimento_inicial_rs: number
  /**
   * Annual discount rate (% a.a.) used for VPL (NPV) calculation.
   * When not provided or ≤ 0, VPL will be null in the output.
   */
  taxa_desconto_aa_pct?: number | null
}

export interface AnaliseFinanceiraOutput {
  // Sistema
  potencia_sistema_kwp: number
  quantidade_modulos: number

  // Custos técnicos
  custo_projeto_rs: number
  material_ca_rs: number
  crea_rs: number
  placa_rs: number
  combustivel_rs: number
  deslocamento_instaladores_rs: number

  // Venda
  custo_variavel_total_rs?: number
  margem_rs?: number
  lucro_minimo_rs?: number
  status_venda?: StatusVenda
  comissao_percent?: number
  comissao_rs?: number
  custo_total_real_rs?: number
  impostos_rs?: number
  custo_fixo_rateado_rs?: number
  lucro_liquido_sem_comissao_rs?: number
  margem_liquida_sem_comissao_percent?: number
  lucro_liquido_final_rs?: number
  margem_liquida_final_percent?: number
  preco_minimo_aceitavel_rs?: number
  preco_minimo_saudavel_rs?: number
  preco_ideal_rs?: number
  desconto_maximo_percent?: number

  // Leasing
  seguro_rs?: number
  /** Leasing commission (CAC) = value of the first monthly installment (paid at contract signing). */
  comissao_leasing_rs?: number
  /** Taxes applied on gross mensalidades revenue (impostos_percent × total bruto). */
  impostos_rs_leasing?: number
  custo_total_rs?: number
  projecao_mensalidades_rs?: number[]
  fator_liquido?: number
  receita_liquida_rs?: number
  lucro_rs?: number
  /** Average net monthly income (receita_liquida_rs / meses_projecao). Used for analytical paybacks. */
  lucro_mensal_medio_rs?: number
  /** Investimento total do leasing: CAPEX + CAC (comissão) + seguro obrigatório. */
  investimento_total_leasing_rs?: number
  /** Analytical payback for CAPEX alone: CAPEX / lucro_mensal_medio (floating months). */
  payback_capex_meses?: number | null
  /** Analytical payback for CAC alone: comissao / lucro_mensal_medio (floating months). */
  payback_cac_meses?: number | null
  /** ⭐ Main leasing payback: (CAPEX + CAC) / lucro_mensal_medio (floating months). */
  payback_total_meses?: number | null
  /** Receita líquida mensal (média): equivalente ao lucro_mensal_medio_rs para leitura gerencial. */
  receita_liquida_mensal_rs?: number
  /** Receita bruta total recebida no contrato (soma das mensalidades). */
  receita_total_contrato_rs?: number
  /** Lucro líquido acumulado no contrato (receita líquida total - investimento total). */
  lucro_total_contrato_rs?: number
  /** Múltiplo do capital investido (receita bruta total / investimento total). */
  multiplo_capital_investido?: number | null
  /** Mês de equilíbrio financeiro do investimento (sinônimo gerencial do payback total). */
  break_even_meses?: number | null
  /**
   * Maximum affordable commission for the given payback_alvo_meses target.
   * comissaoMaxima = payback_alvo × lucro_mensal_medio − CAPEX
   * null when payback_alvo_meses is not provided or lucro_mensal_medio ≤ 0.
   */
  comissao_maxima_rs?: number | null

  // KPIs
  roi_percent: number
  payback_meses: number | null
  tir_mensal_percent: number | null
  tir_anual_percent: number | null
  /** Net Present Value (VPL) in R$. null when no discount rate was provided. */
  vpl: number | null
  /** Discounted payback in months. null when no discount rate was provided or never recovered. */
  payback_descontado_meses: number | null
}
