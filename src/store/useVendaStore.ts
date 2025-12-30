import { useCallback } from 'react'
import type { TipoSistema } from '../lib/finance/roi'
import type { Rede } from '../lib/pricing/pricingPorKwp'
import type { Outputs as ComposicaoCalculo } from '../lib/venda/calcComposicaoUFV'
import { useSafeStore } from '../lib/react/safeStore'

export type ModoVenda = 'direta' | 'leasing'

export type VendaClienteInfo = {
  nome: string
  documento: string
  email: string
  telefone: string
  cidade: string
  uf: string
  endereco: string
  uc: string
  distribuidora: string
  temIndicacao: boolean
  indicacaoNome: string
  herdeiros: string[]
  nomeSindico: string
  cpfSindico: string
  contatoSindico: string
}

export type VendaParametrosPrincipais = {
  consumo_kwh_mes: number
  tarifa_r_kwh: number
  inflacao_energia_aa: number
  taxa_minima_rs_mes: number
  taxa_desconto_aa: number
  horizonte_meses: number
  uf: string
  distribuidora: string
  irradiacao_kwhm2_dia: number
  aplica_taxa_minima: boolean
}

export type VendaConfiguracaoUfv = {
  potencia_modulo_wp: number
  n_modulos: number
  potencia_sistema_kwp: number
  geracao_estimada_kwh_mes: number
  area_m2: number
  tipo_instalacao: string
  segmento: string
  modelo_modulo: string
  modelo_inversor: string
  estrutura_suporte: string
  tipo_sistema: TipoSistema
}

export type VendaKitItem = {
  produto: string
  codigo?: string
  modelo?: string
  fabricante?: string
  descricao?: string
  quantidade?: number | null
  unidade?: string | null
  precoUnit?: number | null
  precoTotal?: number | null
}

export type VendaOrcamentoKit = {
  itens: VendaKitItem[]
  valor_total_orcamento: number
}

export type VendaComposicaoUfv = ComposicaoCalculo & {
  descontos: number
}

export type VendaPagamentoInfo = {
  forma_pagamento: string
  moeda: string
  mdr_pix: number
  mdr_debito: number
  mdr_credito_avista: number
  validade_proposta_txt: string
  prazo_execucao_txt: string
  condicoes_adicionais_txt: string
}

export type VendaCodigosInfo = {
  codigo_orcamento_interno: string
  data_emissao: string
}

export type VendaResultadosFinanceiros = {
  payback_meses: number | null
  roi_acumulado_30a: number | null
  autonomia_frac: number | null
  energia_contratada_kwh_mes: number | null
}

export type VendaResumoProposta = {
  modo_venda: ModoVenda
  valor_total_proposta: number | null
  custo_implantacao_referencia: number | null
  economia_estimativa_valor: number | null
  economia_estimativa_horizonte_anos: number | null
}

export type VendaOrcamentoAutomatico = {
  modo: 'automatico' | 'manual'
  consumo_medio_kwh_mes: number | null
  potencia_kwp: number | null
  tipo_rede: Rede
  tipo_instalacao: string
  tipo_sistema: TipoSistema
  custo_final_projetado: number | null
  valor_kit_solar: number | null
  regra_pricing_versao: string | null
}

export type VendaState = {
  cliente: VendaClienteInfo
  parametros: VendaParametrosPrincipais
  configuracao: VendaConfiguracaoUfv
  orcamento: VendaOrcamentoKit
  composicao: VendaComposicaoUfv
  pagamento: VendaPagamentoInfo
  codigos: VendaCodigosInfo
  resultados: VendaResultadosFinanceiros
  resumoProposta: VendaResumoProposta
  orcamentoAutomatico: VendaOrcamentoAutomatico
}

type Listener = () => void

const listeners = new Set<Listener>()

const STORAGE_KEY = 'solarinvest:venda-form:v1'

const canUseSessionStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'

const createInitialState = (): VendaState => ({
  cliente: {
    nome: '',
    documento: '',
    email: '',
    telefone: '',
    cidade: '',
    uf: '',
    endereco: '',
    uc: '',
    distribuidora: '',
    temIndicacao: false,
    indicacaoNome: '',
    herdeiros: [''],
    nomeSindico: '',
    cpfSindico: '',
    contatoSindico: '',
  },
  parametros: {
    consumo_kwh_mes: 0,
    tarifa_r_kwh: 0,
    inflacao_energia_aa: 0,
    taxa_minima_rs_mes: 0,
    taxa_desconto_aa: 0,
    horizonte_meses: 360,
    uf: '',
    distribuidora: '',
    irradiacao_kwhm2_dia: 0,
    aplica_taxa_minima: true,
  },
  configuracao: {
    potencia_modulo_wp: 0,
    n_modulos: 0,
    potencia_sistema_kwp: 0,
    geracao_estimada_kwh_mes: 0,
    area_m2: 0,
    tipo_instalacao: '',
    segmento: '',
    modelo_modulo: '',
    modelo_inversor: '',
    estrutura_suporte: '',
    tipo_sistema: 'ON_GRID',
  },
  orcamento: {
    itens: [],
    valor_total_orcamento: 0,
  },
  composicao: {
    capex_base: 0,
    margem_operacional_valor: 0,
    venda_total: 0,
    venda_liquida: 0,
    comissao_liquida_valor: 0,
    imposto_retido_valor: 0,
    impostos_regime_valor: 0,
    impostos_totais_valor: 0,
    capex_total: 0,
    total_contrato_R$: 0,
    regime_breakdown: [],
    preco_minimo: 0,
    venda_total_sem_guardrails: 0,
    preco_minimo_aplicado: false,
    arredondamento_aplicado: 0,
    desconto_percentual: 0,
    desconto_requer_aprovacao: false,
    descontos: 0,
  },
  pagamento: {
    forma_pagamento: '',
    moeda: 'BRL',
    mdr_pix: 0,
    mdr_debito: 0,
    mdr_credito_avista: 0,
    validade_proposta_txt: '',
    prazo_execucao_txt: '',
    condicoes_adicionais_txt: '',
  },
  codigos: {
    codigo_orcamento_interno: '',
    data_emissao: '',
  },
  resultados: {
    payback_meses: null,
    roi_acumulado_30a: null,
    autonomia_frac: null,
    energia_contratada_kwh_mes: null,
  },
  resumoProposta: {
    modo_venda: 'direta',
    valor_total_proposta: null,
    custo_implantacao_referencia: null,
    economia_estimativa_valor: null,
    economia_estimativa_horizonte_anos: null,
  },
  orcamentoAutomatico: {
    modo: 'automatico',
    consumo_medio_kwh_mes: null,
    potencia_kwp: null,
    tipo_rede: 'mono',
    tipo_instalacao: '',
    tipo_sistema: 'ON_GRID',
    custo_final_projetado: null,
    valor_kit_solar: null,
    regra_pricing_versao: null,
  },
})

const mergeState = (incoming: Partial<VendaState> | null): VendaState => {
  const base = createInitialState()
  if (!incoming) {
    return base
  }
  return {
    ...base,
    ...incoming,
    cliente: { ...base.cliente, ...(incoming.cliente ?? {}) },
    parametros: { ...base.parametros, ...(incoming.parametros ?? {}) },
    configuracao: { ...base.configuracao, ...(incoming.configuracao ?? {}) },
    orcamento: {
      itens: Array.isArray(incoming.orcamento?.itens)
        ? incoming.orcamento?.itens.map((item) => ({ ...item }))
        : base.orcamento.itens,
      valor_total_orcamento:
        typeof incoming.orcamento?.valor_total_orcamento === 'number'
          ? incoming.orcamento.valor_total_orcamento
          : base.orcamento.valor_total_orcamento,
    },
    composicao: {
      ...base.composicao,
      ...(incoming.composicao ?? {}),
      regime_breakdown: Array.isArray(incoming.composicao?.regime_breakdown)
        ? incoming.composicao.regime_breakdown.map((item) => ({ ...item }))
        : base.composicao.regime_breakdown,
    },
    pagamento: { ...base.pagamento, ...(incoming.pagamento ?? {}) },
    codigos: { ...base.codigos, ...(incoming.codigos ?? {}) },
    resultados: { ...base.resultados, ...(incoming.resultados ?? {}) },
    resumoProposta: { ...base.resumoProposta, ...(incoming.resumoProposta ?? {}) },
    orcamentoAutomatico: { ...base.orcamentoAutomatico, ...(incoming.orcamentoAutomatico ?? {}) },
  }
}

const loadStoredState = (): VendaState => {
  if (!canUseSessionStorage()) {
    return createInitialState()
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createInitialState()
    }
    const parsed = JSON.parse(raw) as Partial<VendaState>
    return mergeState(parsed)
  } catch (error) {
    console.warn('[useVendaStore] failed to load stored state', error)
    return createInitialState()
  }
}

const persistState = (next: VendaState) => {
  if (!canUseSessionStorage()) {
    return
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    console.warn('[useVendaStore] failed to persist state', error)
  }
}

let state: VendaState = loadStoredState()
const INITIAL_STATE_SIGNATURE = JSON.stringify(createInitialState())

const cloneState = (input: VendaState): VendaState => ({
  cliente: { ...input.cliente },
  parametros: { ...input.parametros },
  configuracao: { ...input.configuracao },
  orcamento: { itens: input.orcamento.itens.map((item) => ({ ...item })), valor_total_orcamento: input.orcamento.valor_total_orcamento },
  composicao: {
    ...input.composicao,
    regime_breakdown: input.composicao.regime_breakdown.map((item) => ({ ...item })),
  },
  pagamento: { ...input.pagamento },
  codigos: { ...input.codigos },
  resultados: { ...input.resultados },
  resumoProposta: { ...input.resumoProposta },
  orcamentoAutomatico: { ...input.orcamentoAutomatico },
})

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch (error) {
      console.error('[useVendaStore] listener error', error)
    }
  })
}

const setState = (updater: (draft: VendaState) => void) => {
  const next = cloneState(state)
  updater(next)
  state = next
  persistState(state)
  notify()
}

export const vendaStore = {
  getState: () => state,
  subscribe: (listener: Listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  setState,
  reset: () => {
    state = createInitialState()
    if (canUseSessionStorage()) {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
    notify()
  },
}

const isStatePristine = (input: VendaState): boolean => JSON.stringify(input) === INITIAL_STATE_SIGNATURE

export const isVendaStatePristine = (input: VendaState): boolean => isStatePristine(input)

export const hasVendaStateChanges = (): boolean => !isStatePristine(vendaStore.getState())

export function useVendaStore<T>(selector: (state: VendaState) => T): T {
  const subscribe = useCallback((listener: Listener) => vendaStore.subscribe(listener), [])
  const getSnapshot = useCallback(() => selector(vendaStore.getState()), [selector])
  return useSafeStore(subscribe, getSnapshot)
}

export const vendaActions = {
  updateCliente(partial: Partial<VendaClienteInfo>) {
    setState((draft) => {
      draft.cliente = {
        ...draft.cliente,
        ...partial,
        ...(partial.herdeiros ? { herdeiros: [...partial.herdeiros] } : {}),
      }
    })
  },
  updateParametros(partial: Partial<VendaParametrosPrincipais>) {
    setState((draft) => {
      draft.parametros = { ...draft.parametros, ...partial }
    })
  },
  updateConfiguracao(partial: Partial<VendaConfiguracaoUfv>) {
    setState((draft) => {
      draft.configuracao = { ...draft.configuracao, ...partial }
    })
  },
  updateOrcamento(partial: Partial<VendaOrcamentoKit>) {
    setState((draft) => {
      draft.orcamento = {
        itens: partial.itens ? partial.itens.map((item) => ({ ...item })) : draft.orcamento.itens.map((item) => ({ ...item })),
        valor_total_orcamento:
          typeof partial.valor_total_orcamento === 'number'
            ? partial.valor_total_orcamento
            : draft.orcamento.valor_total_orcamento,
      }
    })
  },
  setOrcamentoItens(itens: VendaKitItem[]) {
    setState((draft) => {
      draft.orcamento = {
        ...draft.orcamento,
        itens: itens.map((item) => ({ ...item })),
      }
    })
  },
  updateComposicao(partial: Partial<VendaComposicaoUfv>) {
    setState((draft) => {
      draft.composicao = { ...draft.composicao, ...partial }
    })
  },
  updatePagamento(partial: Partial<VendaPagamentoInfo>) {
    setState((draft) => {
      draft.pagamento = { ...draft.pagamento, ...partial }
    })
  },
  updateCodigos(partial: Partial<VendaCodigosInfo>) {
    setState((draft) => {
      draft.codigos = { ...draft.codigos, ...partial }
    })
  },
  updateOrcamentoAutomatico(partial: Partial<VendaOrcamentoAutomatico>) {
    setState((draft) => {
      draft.orcamentoAutomatico = { ...draft.orcamentoAutomatico, ...partial }
    })
  },
  updateResultados(partial: Partial<VendaResultadosFinanceiros>) {
    setState((draft) => {
      draft.resultados = { ...draft.resultados, ...partial }
    })
  },
  updateResumoProposta(partial: Partial<VendaResumoProposta>) {
    setState((draft) => {
      const next: VendaResumoProposta = { ...draft.resumoProposta }
      let changed = false
      if ('modo_venda' in partial && partial.modo_venda) {
        if (next.modo_venda !== partial.modo_venda) {
          next.modo_venda = partial.modo_venda
          changed = true
        }
      }
      if ('valor_total_proposta' in partial) {
        const value = partial.valor_total_proposta ?? null
        if (
          (value == null && next.valor_total_proposta != null) ||
          (value != null && !Number.isNaN(value) && value !== next.valor_total_proposta)
        ) {
          next.valor_total_proposta = value
          changed = true
        }
      }
      if ('custo_implantacao_referencia' in partial) {
        const value = partial.custo_implantacao_referencia ?? null
        if (
          (value == null && next.custo_implantacao_referencia != null) ||
          (value != null && !Number.isNaN(value) && value !== next.custo_implantacao_referencia)
        ) {
          next.custo_implantacao_referencia = value
          changed = true
        }
      }
      if ('economia_estimativa_valor' in partial) {
        const value = partial.economia_estimativa_valor ?? null
        if (
          (value == null && next.economia_estimativa_valor != null) ||
          (value != null && !Number.isNaN(value) && value !== next.economia_estimativa_valor)
        ) {
          next.economia_estimativa_valor = value
          changed = true
        }
      }
      if ('economia_estimativa_horizonte_anos' in partial) {
        const value = partial.economia_estimativa_horizonte_anos ?? null
        if (value !== next.economia_estimativa_horizonte_anos) {
          next.economia_estimativa_horizonte_anos = value
          changed = true
        }
      }
      if (changed) {
        draft.resumoProposta = next
      }
    })
  },
}

export type VendaSnapshot = VendaState

export const getVendaSnapshot = (): VendaSnapshot => cloneState(vendaStore.getState())

export const calculateCapexFromState = (input: VendaState): number => {
  const campos = input.composicao
  if (!campos) {
    return 0
  }
  return Number.isFinite(campos.capex_total) ? Number(campos.capex_total) : 0
}
