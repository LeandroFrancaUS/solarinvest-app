export type UF = 'GO' | 'DF'
export type ModoAnalise = 'venda' | 'leasing'
export type StatusVenda = 'BLOQUEAR_VENDA' | 'SEM_COMISSAO' | 'VENDA_SAUDAVEL'

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

  // Custos diretos informados
  custo_kit_rs: number
  frete_rs: number
  descarregamento_rs: number
  instalacao_rs: number
  hotel_pousada_rs: number

  // Comercial/tributário (Venda e/ou Leasing)
  valor_contrato_rs: number
  impostos_percent: number
  custo_fixo_rateado_percent: number
  lucro_minimo_percent: number
  comissao_minima_percent: number
  margem_liquida_alvo_percent?: number

  // Leasing
  inadimplencia_percent: number
  custo_operacional_percent: number
  meses_projecao: number
  mensalidades_previstas_rs: number[]

  // KPI
  investimento_inicial_rs: number
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
  preco_minimo_saudavel_rs?: number
  preco_ideal_rs?: number
  desconto_maximo_percent?: number

  // Leasing
  seguro_rs?: number
  custo_total_rs?: number
  projecao_mensalidades_rs?: number[]
  fator_liquido?: number
  receita_liquida_rs?: number
  lucro_rs?: number

  // KPIs
  roi_percent: number
  payback_meses: number | null
  tir_mensal_percent: number | null
  tir_anual_percent: number | null
}
