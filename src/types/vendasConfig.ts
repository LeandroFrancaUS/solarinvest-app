import type { ImpostosRegimeConfig, RegimeTributario } from '../lib/venda/calcComposicaoUFV'
import type { ProjetoFaixa } from '../lib/finance/analiseFinanceiraSpreadsheet'
import type { ExemptRegion } from '../lib/finance/travelCost'

export type { ExemptRegion }

export type ArredondarVendaPara = '1' | '10' | '50' | '100'
export type ComissaoDefaultTipo = 'valor' | 'percentual'
export type ComissaoPercentBase = 'venda_total' | 'venda_liquida'

export interface VendasConfig {
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
  impostosRegime_overrides?: Partial<ImpostosRegimeConfig> | null
  mostrar_quebra_impostos_no_pdf_cliente: boolean

  exibir_precos_unitarios: boolean
  exibir_margem: boolean
  exibir_comissao: boolean
  exibir_impostos: boolean
  observacao_padrao_proposta: string

  // Spreadsheet v1 — financial analysis parameters
  af_custo_fixo_rateado_percent: number
  af_lucro_minimo_percent: number
  af_comissao_minima_percent: number
  af_combustivel_go_rs: number
  af_combustivel_df_rs: number
  af_preco_placa_rs: number
  af_material_ca_percent_kit: number
  af_crea_go_rs: number
  af_crea_df_rs: number
  af_projeto_faixas: ProjetoFaixa[]
  af_seguro_limiar_rs: number
  af_seguro_faixa_baixa_percent: number
  af_seguro_faixa_alta_percent: number
  af_seguro_piso_rs: number

  // Installer travel/displacement cost auto-calculation
  af_deslocamento_regioes_isentas: ExemptRegion[]
  af_deslocamento_faixa1_km: number
  af_deslocamento_faixa1_rs: number
  af_deslocamento_faixa2_km: number
  af_deslocamento_faixa2_rs: number
  af_deslocamento_km_excedente_rs: number
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
  overrides?: Partial<ImpostosRegimeConfig> | null,
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

const isComissaoTipo = (valor: string): valor is ComissaoDefaultTipo =>
  valor === 'valor' || valor === 'percentual'

const isComissaoBase = (valor: string): valor is ComissaoPercentBase =>
  valor === 'venda_total' || valor === 'venda_liquida'

const isRegime = (valor: string): valor is RegimeTributario =>
  valor === 'simples' || valor === 'lucro_presumido' || valor === 'lucro_real'

export const DEFAULT_VENDAS_CONFIG: VendasConfig = {
  margem_operacional_padrao_percent: 29,
  preco_minimo_percent_sobre_capex: 10,
  arredondar_venda_para: '100',
  incluirImpostosNoCAPEX_default: false,

  comissao_default_tipo: 'percentual',
  comissao_default_percent: 5,
  comissao_percent_base: 'venda_total',
  bonus_indicacao_percent: 0,
  teto_comissao_percent: 8,

  desconto_max_percent_sem_aprovacao: 5,
  workflow_aprovacao_ativo: true,
  aprovadores: ['financeiro@solarinvest.com.br'],
  validade_proposta_dias: 15,

  regime_tributario_default: 'lucro_presumido',
  imposto_retido_aliquota_default: 6,
  mostrar_quebra_impostos_no_pdf_cliente: false,

  exibir_precos_unitarios: false,
  exibir_margem: false,
  exibir_comissao: false,
  exibir_impostos: false,
  observacao_padrao_proposta: '',

  af_custo_fixo_rateado_percent: 5,
  af_lucro_minimo_percent: 10,
  af_comissao_minima_percent: 3,
  af_combustivel_go_rs: 0,
  af_combustivel_df_rs: 250,
  af_preco_placa_rs: 18,
  af_material_ca_percent_kit: 12,
  af_crea_go_rs: 104,
  af_crea_df_rs: 109,
  af_projeto_faixas: [
    { max_kwp: 6, valor_rs: 400 },
    { max_kwp: 10, valor_rs: 500 },
    { max_kwp: 20, valor_rs: 700 },
    { max_kwp: 30, valor_rs: 1000 },
    { max_kwp: 50, valor_rs: 1200 },
    { max_kwp: Infinity, valor_rs: 2500 },
  ],
  af_seguro_limiar_rs: 18911.56,
  af_seguro_faixa_baixa_percent: 3.05,
  af_seguro_faixa_alta_percent: 0.735,
  af_seguro_piso_rs: 139,

  af_deslocamento_regioes_isentas: [
    { cidade: 'Anápolis', uf: 'GO' },
    { cidade: 'Abadiânia', uf: 'GO' },
    { cidade: 'Terezópolis de Goiás', uf: 'GO' },
    { cidade: 'Goiânia', uf: 'GO' },
  ],
  af_deslocamento_faixa1_km: 200,
  af_deslocamento_faixa1_rs: 150,
  af_deslocamento_faixa2_km: 320,
  af_deslocamento_faixa2_rs: 250,
  af_deslocamento_km_excedente_rs: 0.8,
}

export const normalizeVendasConfig = (
  partial?: Partial<VendasConfig>,
): VendasConfig => {
  const sanitizeProjetoFaixas = (faixas: unknown): ProjetoFaixa[] => {
    if (!Array.isArray(faixas) || faixas.length === 0) {
      return DEFAULT_VENDAS_CONFIG.af_projeto_faixas
    }
    const result = faixas
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const max_kwp = Number((item as Record<string, unknown>).max_kwp)
        const valor_rs = Number((item as Record<string, unknown>).valor_rs)
        if (
          !Number.isFinite(max_kwp) ||
          max_kwp <= 0 ||
          !Number.isFinite(valor_rs) ||
          valor_rs < 0
        ) {
          return null
        }
        return { max_kwp, valor_rs }
      })
      .filter((item): item is ProjetoFaixa => Boolean(item))
    return result.length > 0 ? result : DEFAULT_VENDAS_CONFIG.af_projeto_faixas
  }

  const sanitizeRegioesIsentas = (regioes: unknown): ExemptRegion[] => {
    if (!Array.isArray(regioes)) {
      return DEFAULT_VENDAS_CONFIG.af_deslocamento_regioes_isentas
    }
    const result = regioes
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const cidade = (item as Record<string, unknown>).cidade
        const uf = (item as Record<string, unknown>).uf
        if (typeof cidade !== 'string' || typeof uf !== 'string') return null
        const cidadeTrim = cidade.trim()
        const ufTrim = uf.trim().toUpperCase()
        if (!cidadeTrim || ufTrim.length !== 2) return null
        return { cidade: cidadeTrim, uf: ufTrim }
      })
      .filter((item): item is ExemptRegion => Boolean(item))
    return result
  }

  const base = partial ?? {}
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
    impostosRegime_overrides: sanitizeOverrides(base.impostosRegime_overrides) ?? null,
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

    af_custo_fixo_rateado_percent: clamp(
      Number(base.af_custo_fixo_rateado_percent ?? DEFAULT_VENDAS_CONFIG.af_custo_fixo_rateado_percent),
      0,
      100,
    ),
    af_lucro_minimo_percent: clamp(
      Number(base.af_lucro_minimo_percent ?? DEFAULT_VENDAS_CONFIG.af_lucro_minimo_percent),
      0,
      100,
    ),
    af_comissao_minima_percent: clamp(
      Number(base.af_comissao_minima_percent ?? DEFAULT_VENDAS_CONFIG.af_comissao_minima_percent),
      0,
      100,
    ),
    af_combustivel_go_rs: Math.max(0, Number(base.af_combustivel_go_rs ?? DEFAULT_VENDAS_CONFIG.af_combustivel_go_rs) || 0),
    af_combustivel_df_rs: Math.max(0, Number(base.af_combustivel_df_rs ?? DEFAULT_VENDAS_CONFIG.af_combustivel_df_rs) || 0),
    af_preco_placa_rs: Math.max(0, Number(base.af_preco_placa_rs ?? DEFAULT_VENDAS_CONFIG.af_preco_placa_rs) || 0),
    af_material_ca_percent_kit: clamp(
      Number(base.af_material_ca_percent_kit ?? DEFAULT_VENDAS_CONFIG.af_material_ca_percent_kit),
      0,
      100,
    ),
    af_crea_go_rs: Math.max(0, Number(base.af_crea_go_rs ?? DEFAULT_VENDAS_CONFIG.af_crea_go_rs) || 0),
    af_crea_df_rs: Math.max(0, Number(base.af_crea_df_rs ?? DEFAULT_VENDAS_CONFIG.af_crea_df_rs) || 0),
    af_projeto_faixas: sanitizeProjetoFaixas(base.af_projeto_faixas),
    af_seguro_limiar_rs: Math.max(0, Number(base.af_seguro_limiar_rs ?? DEFAULT_VENDAS_CONFIG.af_seguro_limiar_rs) || 0),
    af_seguro_faixa_baixa_percent: clamp(
      Number(base.af_seguro_faixa_baixa_percent ?? DEFAULT_VENDAS_CONFIG.af_seguro_faixa_baixa_percent),
      0,
      100,
    ),
    af_seguro_faixa_alta_percent: clamp(
      Number(base.af_seguro_faixa_alta_percent ?? DEFAULT_VENDAS_CONFIG.af_seguro_faixa_alta_percent),
      0,
      100,
    ),
    af_seguro_piso_rs: Math.max(0, Number(base.af_seguro_piso_rs ?? DEFAULT_VENDAS_CONFIG.af_seguro_piso_rs) || 0),

    af_deslocamento_regioes_isentas: sanitizeRegioesIsentas(base.af_deslocamento_regioes_isentas),
    af_deslocamento_faixa1_km: Math.max(0, Number(base.af_deslocamento_faixa1_km ?? DEFAULT_VENDAS_CONFIG.af_deslocamento_faixa1_km) || 0),
    af_deslocamento_faixa1_rs: Math.max(0, Number(base.af_deslocamento_faixa1_rs ?? DEFAULT_VENDAS_CONFIG.af_deslocamento_faixa1_rs) || 0),
    af_deslocamento_faixa2_km: Math.max(0, Number(base.af_deslocamento_faixa2_km ?? DEFAULT_VENDAS_CONFIG.af_deslocamento_faixa2_km) || 0),
    af_deslocamento_faixa2_rs: Math.max(0, Number(base.af_deslocamento_faixa2_rs ?? DEFAULT_VENDAS_CONFIG.af_deslocamento_faixa2_rs) || 0),
    af_deslocamento_km_excedente_rs: Math.max(0, Number(base.af_deslocamento_km_excedente_rs ?? DEFAULT_VENDAS_CONFIG.af_deslocamento_km_excedente_rs) || 0),
  }
}
