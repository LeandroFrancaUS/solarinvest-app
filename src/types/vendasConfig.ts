import type { ImpostosRegimeConfig, RegimeTributario } from '../lib/venda/calcComposicaoUFV'

export type MargemOrigem = 'automatica' | 'manual'
export type ArredondarVendaPara = '1' | '10' | '50' | '100'
export type ComissaoDefaultTipo = 'valor' | 'percentual'
export type ComissaoPercentBase = 'venda_total' | 'venda_liquida'

export interface VendasConfig {
  origem_margem_operacional: MargemOrigem
  margem_operacional_padrao_percent: number
  preco_minimo_percent_sobre_capex: number
  arredondar_venda_para: ArredondarVendaPara
  incluirImpostosNoCAPEX_default: boolean

  comissao_default_tipo: ComissaoDefaultTipo
  comissao_default_percent: number
  comissao_percent_base: ComissaoPercentBase
  bonus_indicacao_percent: number
  teto_comissao_percent: number

  desconto_max_percent_sem_aprovacao: number
  workflow_aprovacao_ativo: boolean
  aprovadores: string[]
  validade_proposta_dias: number

  regime_tributario_default: RegimeTributario
  imposto_retido_aliquota_default: number
  impostosRegime_overrides?: Partial<ImpostosRegimeConfig>
  mostrar_quebra_impostos_no_pdf_cliente: boolean

  exibir_precos_unitarios: boolean
  exibir_margem: boolean
  exibir_comissao: boolean
  exibir_impostos: boolean
  observacao_padrao_proposta: string
}

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.min(max, Math.max(min, value))
}

const sanitizeAprovadores = (lista: unknown): string[] => {
  if (!Array.isArray(lista)) {
    return ['financeiro@solarinvest.com.br']
  }
  const normalized = lista
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
  return normalized.length > 0 ? normalized : ['financeiro@solarinvest.com.br']
}

const sanitizeOverrides = (
  overrides?: Partial<ImpostosRegimeConfig>,
): Partial<ImpostosRegimeConfig> | undefined => {
  if (!overrides) {
    return undefined
  }
  const result: Partial<ImpostosRegimeConfig> = {}
  for (const regime of ['simples', 'lucro_presumido', 'lucro_real'] as const) {
    const lista = overrides[regime]
    if (!Array.isArray(lista) || lista.length === 0) {
      continue
    }
    result[regime] = lista
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null
        }
        const nome = typeof item.nome === 'string' ? item.nome.trim() : ''
        const aliquota = clamp(Number(item.aliquota_percent) || 0, 0, 100)
        if (!nome) {
          return null
        }
        return { nome, aliquota_percent: aliquota }
      })
      .filter((item): item is { nome: string; aliquota_percent: number } => Boolean(item))
    if (!result[regime]?.length) {
      delete result[regime]
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

const isArredondarValue = (valor: string): valor is ArredondarVendaPara =>
  valor === '1' || valor === '10' || valor === '50' || valor === '100'

const isMargemOrigem = (valor: string): valor is MargemOrigem =>
  valor === 'automatica' || valor === 'manual'

const isComissaoTipo = (valor: string): valor is ComissaoDefaultTipo =>
  valor === 'valor' || valor === 'percentual'

const isComissaoBase = (valor: string): valor is ComissaoPercentBase =>
  valor === 'venda_total' || valor === 'venda_liquida'

const isRegime = (valor: string): valor is RegimeTributario =>
  valor === 'simples' || valor === 'lucro_presumido' || valor === 'lucro_real'

export const DEFAULT_VENDAS_CONFIG: VendasConfig = {
  origem_margem_operacional: 'automatica',
  margem_operacional_padrao_percent: 29,
  preco_minimo_percent_sobre_capex: 10,
  arredondar_venda_para: '100',
  incluirImpostosNoCAPEX_default: false,

  comissao_default_tipo: 'percentual',
  comissao_default_percent: 3,
  comissao_percent_base: 'venda_total',
  bonus_indicacao_percent: 0,
  teto_comissao_percent: 8,

  desconto_max_percent_sem_aprovacao: 5,
  workflow_aprovacao_ativo: true,
  aprovadores: ['financeiro@solarinvest.com.br'],
  validade_proposta_dias: 15,

  regime_tributario_default: 'lucro_presumido',
  imposto_retido_aliquota_default: 6,
  impostosRegime_overrides: undefined,
  mostrar_quebra_impostos_no_pdf_cliente: false,

  exibir_precos_unitarios: false,
  exibir_margem: false,
  exibir_comissao: false,
  exibir_impostos: false,
  observacao_padrao_proposta: '',
}

export const normalizeVendasConfig = (
  partial?: Partial<VendasConfig>,
): VendasConfig => {
  const base = partial ?? {}
  const origem =
    typeof base.origem_margem_operacional === 'string' &&
    isMargemOrigem(base.origem_margem_operacional)
      ? base.origem_margem_operacional
      : DEFAULT_VENDAS_CONFIG.origem_margem_operacional
  const arredondar =
    typeof base.arredondar_venda_para === 'string' &&
    isArredondarValue(base.arredondar_venda_para)
      ? base.arredondar_venda_para
      : DEFAULT_VENDAS_CONFIG.arredondar_venda_para
  const comissaoTipo =
    typeof base.comissao_default_tipo === 'string' &&
    isComissaoTipo(base.comissao_default_tipo)
      ? base.comissao_default_tipo
      : DEFAULT_VENDAS_CONFIG.comissao_default_tipo
  const comissaoBase =
    typeof base.comissao_percent_base === 'string' &&
    isComissaoBase(base.comissao_percent_base)
      ? base.comissao_percent_base
      : DEFAULT_VENDAS_CONFIG.comissao_percent_base
  const regime =
    typeof base.regime_tributario_default === 'string' &&
    isRegime(base.regime_tributario_default)
      ? base.regime_tributario_default
      : DEFAULT_VENDAS_CONFIG.regime_tributario_default

  return {
    origem_margem_operacional: origem,
    margem_operacional_padrao_percent: clamp(
      Number(base.margem_operacional_padrao_percent) || 0,
      0,
      80,
    ),
    preco_minimo_percent_sobre_capex: clamp(
      Number(base.preco_minimo_percent_sobre_capex) || 0,
      0,
      100,
    ),
    arredondar_venda_para: arredondar,
    incluirImpostosNoCAPEX_default: Boolean(base.incluirImpostosNoCAPEX_default),

    comissao_default_tipo: comissaoTipo,
    comissao_default_percent: clamp(Number(base.comissao_default_percent) || 0, 0, 100),
    comissao_percent_base: comissaoBase,
    bonus_indicacao_percent: clamp(Number(base.bonus_indicacao_percent) || 0, 0, 100),
    teto_comissao_percent: clamp(Number(base.teto_comissao_percent) || 0, 0, 100),

    desconto_max_percent_sem_aprovacao: clamp(
      Number(base.desconto_max_percent_sem_aprovacao) || 0,
      0,
      100,
    ),
    workflow_aprovacao_ativo: base.workflow_aprovacao_ativo ?? true,
    aprovadores: sanitizeAprovadores(base.aprovadores),
    validade_proposta_dias: Math.max(0, Math.trunc(Number(base.validade_proposta_dias) || 0)),

    regime_tributario_default: regime,
    imposto_retido_aliquota_default: clamp(
      Number(base.imposto_retido_aliquota_default) || 0,
      0,
      100,
    ),
    impostosRegime_overrides: sanitizeOverrides(base.impostosRegime_overrides),
    mostrar_quebra_impostos_no_pdf_cliente: Boolean(
      base.mostrar_quebra_impostos_no_pdf_cliente,
    ),

    exibir_precos_unitarios: Boolean(base.exibir_precos_unitarios),
    exibir_margem: Boolean(base.exibir_margem),
    exibir_comissao: Boolean(base.exibir_comissao),
    exibir_impostos: Boolean(base.exibir_impostos),
    observacao_padrao_proposta:
      typeof base.observacao_padrao_proposta === 'string' &&
      base.observacao_padrao_proposta.trim().length > 0
        ? base.observacao_padrao_proposta.trim()
        : DEFAULT_VENDAS_CONFIG.observacao_padrao_proposta,
  }
}
