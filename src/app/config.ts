import type { EntradaModo } from '../utils/calcs'
import type { EssentialInfoSummary } from '../utils/moduleDetection'
import type {
  TipoInstalacao,
  UfvComposicaoSoloValores,
  UfvComposicaoTelhadoValores,
} from '../types/printableProposal'
import type { SegmentoCliente, TipoSistema, VendaForm } from '../lib/finance/roi'
import type { MultiUcClasse } from '../types/multiUc'
import type { UfvComposicaoConfiguracao } from '../types/printableProposal'
import { ESCALONAMENTO_PADRAO } from '../utils/multiUc'
import { DEFAULT_TUSD_ANO_REFERENCIA } from '../lib/finance/tusd'
import type { TipoClienteTUSD } from '../lib/finance/tusd'

export type TabKey = 'leasing' | 'vendas'

export type SettingsTabKey =
  | 'mercado'
  | 'simulacoes'
  | 'leasing'
  | 'financiamento'
  | 'buyout'
  | 'outros'

export type SeguroModo = 'A' | 'B'

export type EntradaModoLabel = 'Crédito mensal' | 'Reduz piso contratado'

export const UF_LABELS: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AM: 'Amazonas',
  AP: 'Amapá',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MG: 'Minas Gerais',
  MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso',
  PA: 'Pará',
  PB: 'Paraíba',
  PE: 'Pernambuco',
  PI: 'Piauí',
  PR: 'Paraná',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RO: 'Rondônia',
  RR: 'Roraima',
  RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina',
  SE: 'Sergipe',
  SP: 'São Paulo',
  TO: 'Tocantins',
}

export const SETTINGS_TABS: { id: SettingsTabKey; label: string }[] = [
  { id: 'mercado', label: 'Mercado & Energia' },
  { id: 'simulacoes', label: 'Simulações' },
  { id: 'leasing', label: 'Leasing Parâmetros' },
  { id: 'financiamento', label: 'Financiamento Parâmetros' },
  { id: 'buyout', label: 'Buyout Parâmetros' },
  { id: 'outros', label: 'Outros' },
]

export type MultiUcTarifaFonte = 'auto' | 'manual'

export type MultiUcRateioModo = 'percentual' | 'manual'

export type MultiUcRowState = {
  id: string
  classe: MultiUcClasse
  consumoKWh: number
  rateioPercentual: number
  manualRateioKWh: number | null
  te: number
  tusdTotal: number
  tusdFioB: number
  observacoes: string
  teFonte: MultiUcTarifaFonte
  tusdTotalFonte: MultiUcTarifaFonte
  tusdFioBFonte: MultiUcTarifaFonte
}

export const createDefaultMultiUcRow = (index = 1): MultiUcRowState => ({
  id: `UC-${index}`,
  classe: 'B1_Residencial',
  consumoKWh: 0,
  rateioPercentual: index === 1 ? 100 : 0,
  manualRateioKWh: null,
  te: 0,
  tusdTotal: 0,
  tusdFioB: 0,
  observacoes: '',
  teFonte: 'auto',
  tusdTotalFonte: 'auto',
  tusdFioBFonte: 'auto',
})

export const ANALISE_ANOS_PADRAO = 30
export const DIAS_MES_PADRAO = 30
export const PAINEL_OPCOES = [450, 500, 550, 600, 605, 610, 650, 700]

export const STORAGE_KEYS = {
  activePage: 'solarinvest-active-page',
  activeTab: 'solarinvest-active-tab',
}

const COMPOSICAO_TELHADO_BASE: UfvComposicaoTelhadoValores = {
  projeto: 0,
  instalacao: 0,
  materialCa: 0,
  crea: 0,
  art: 0,
  placa: 0,
  comissaoLiquida: 0,
  lucroBruto: 0,
  impostoRetido: 0,
}

const COMPOSICAO_SOLO_BASE: UfvComposicaoSoloValores = {
  ...COMPOSICAO_TELHADO_BASE,
  estruturaSolo: 0,
  tela: 0,
  portaoTela: 0,
  maoObraTela: 0,
  casaInversor: 0,
  brita: 0,
  terraplanagem: 0,
  trafo: 0,
  rede: 0,
}

export function createInitialComposicaoTelhado(): UfvComposicaoTelhadoValores {
  return { ...COMPOSICAO_TELHADO_BASE }
}

export function createInitialComposicaoSolo(): UfvComposicaoSoloValores {
  return { ...COMPOSICAO_SOLO_BASE }
}

const COMPOSICAO_CONFIG_BASE: UfvComposicaoConfiguracao = {
  comissaoTipo: 'valor',
  comissaoBase: 'venda_total',
  margemTipo: 'valor',
  descontos: 0,
  regime: 'simples',
  impostoRetidoAliquota: 0,
  incluirImpostosNoCapex: false,
}

export const createInitialComposicaoConfig = (): UfvComposicaoConfiguracao => ({
  ...COMPOSICAO_CONFIG_BASE,
})

export const LEASING_PRAZO_OPCOES = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const
export type LeasingPrazoAnos = (typeof LEASING_PRAZO_OPCOES)[number]

export const INITIAL_VALUES = {
  activeTab: 'leasing' as TabKey,
  settingsTab: 'mercado' as SettingsTabKey,
  ufTarifa: 'GO',
  distribuidoraTarifa: 'Equatorial Goiás',
  mesReajuste: 6,
  kcKwhMes: 0,
  tarifaCheia: 0.964,
  desconto: 20,
  taxaMinima: 95,
  encargosFixosExtras: 0,
  tusdPercent: 27,
  tusdTipoCliente: 'residencial' as TipoClienteTUSD,
  tusdSubtipo: '',
  tusdSimultaneidade: null as number | null,
  tusdTarifaRkwh: null as number | null,
  tusdAnoReferencia: DEFAULT_TUSD_ANO_REFERENCIA,
  leasingPrazo: LEASING_PRAZO_OPCOES[0] as LeasingPrazoAnos,
  potenciaModulo: 600,
  tipoInstalacao: 'TELHADO' as TipoInstalacao,
  segmentoCliente: 'RESIDENCIAL' as SegmentoCliente,
  tipoSistema: 'ON_GRID' as TipoSistema,
  numeroModulosManual: '' as number | '',
  precoPorKwp: 2470,
  eficiencia: 0.8,
  diasMes: DIAS_MES_PADRAO,
  inflacaoAa: 8,
  jurosFinanciamentoAa: 15,
  prazoFinanciamentoMeses: 120,
  entradaFinanciamentoPct: 20,
  mostrarFinanciamento: false,
  mostrarGrafico: true,
  prazoMeses: 60,
  bandeiraEncargo: 0,
  cipEncargo: 0,
  entradaRs: 0,
  entradaModo: 'Crédito mensal' as EntradaModoLabel,
  tabelaVisivel: false,
  capexManualOverride: false,
  oemBase: 35,
  oemInflacao: 4,
  seguroModo: 'A' as SeguroModo,
  seguroReajuste: 5,
  seguroValorA: 20,
  seguroPercentualB: 0.3,
  exibirLeasingLinha: true,
  exibirFinanciamentoLinha: false,
  cashbackPct: 10,
  depreciacaoAa: 12,
  inadimplenciaAa: 2,
  tributosAa: 6,
  ipcaAa: 4,
  custosFixosM: 0,
  opexM: 0,
  seguroM: 0,
  duracaoMeses: 60,
  pagosAcumManual: 0,
  composicaoTelhado: createInitialComposicaoTelhado(),
  composicaoSolo: createInitialComposicaoSolo(),
  composicaoConfig: createInitialComposicaoConfig(),
  multiUcAtivo: false,
  multiUcUcs: [createDefaultMultiUcRow()],
  multiUcRateioModo: 'percentual' as MultiUcRateioModo,
  multiUcEnergiaGeradaKWh: 0,
  multiUcAnoVigencia: new Date().getFullYear(),
  multiUcOverrideEscalonamento: false,
  multiUcEscalonamentoCustomPercent: null as number | null,
  multiUcEscalonamentoPadrao: ESCALONAMENTO_PADRAO,
}

export const VENDA_FORM_DEFAULT: VendaForm = {
  consumo_kwh_mes: INITIAL_VALUES.kcKwhMes,
  tarifa_cheia_r_kwh: INITIAL_VALUES.tarifaCheia,
  inflacao_energia_aa_pct: INITIAL_VALUES.inflacaoAa,
  taxa_minima_mensal: INITIAL_VALUES.taxaMinima,
  horizonte_meses: 360,
  capex_total: 0,
  condicao: 'AVISTA',
  modo_pagamento: 'PIX',
  segmento_cliente: INITIAL_VALUES.segmentoCliente,
  tipo_sistema: INITIAL_VALUES.tipoSistema,
  taxa_mdr_pix_pct: 0,
  taxa_mdr_debito_pct: 0,
  taxa_mdr_credito_vista_pct: 0,
  taxa_mdr_credito_parcelado_pct: 0,
  entrada_financiamento: 0,
  tusd_percentual: INITIAL_VALUES.tusdPercent,
  tusd_tipo_cliente: INITIAL_VALUES.tusdTipoCliente,
  tusd_subtipo: INITIAL_VALUES.tusdSubtipo || undefined,
  tusd_simultaneidade: INITIAL_VALUES.tusdSimultaneidade ?? undefined,
  tusd_tarifa_r_kwh: INITIAL_VALUES.tusdTarifaRkwh ?? undefined,
  tusd_ano_referencia: INITIAL_VALUES.tusdAnoReferencia,
}

export function createInitialVendaForm(): VendaForm {
  return { ...VENDA_FORM_DEFAULT }
}


export function createEmptyKitBudget(): KitBudgetState {
  return {
    items: [],
    total: null,
    totalSource: null,
    totalInput: '',
    warnings: [],
    missingInfo: null,
    ignoredByNoise: 0,
  }
}

type KitBudgetItemState = {
  id: string
  productName: string
  description: string
  quantity: number | null
  quantityInput: string
  unitPrice: number | null
  unitPriceInput: string
  wasQuantityInferred: boolean
}

type KitBudgetMissingInfo = EssentialInfoSummary | null

type KitBudgetWarning = string

type KitBudgetState = {
  items: KitBudgetItemState[]
  total: number | null
  totalSource: 'explicit' | 'calculated' | null
  totalInput: string
  warnings: KitBudgetWarning[]
  fileName?: string
  fileSizeBytes?: number
  missingInfo: KitBudgetMissingInfo
  ignoredByNoise: number
}

// Re-exporting the KitBudgetState-related types to keep them colocated with the default factory.
export type { KitBudgetItemState, KitBudgetMissingInfo, KitBudgetState }
