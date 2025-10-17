import type { EntradaModo } from '../utils/calcs'
import type { EssentialInfoSummary } from '../utils/moduleDetection'
import type {
  TipoInstalacao,
  UfvComposicaoSoloValores,
  UfvComposicaoTelhadoValores,
} from '../types/printableProposal'
import type { VendaForm } from '../lib/finance/roi'

export type TabKey = 'leasing' | 'vendas'

export type SettingsTabKey = 'mercado' | 'leasing' | 'financiamento' | 'buyout' | 'outros'

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
  { id: 'leasing', label: 'Leasing Parâmetros' },
  { id: 'financiamento', label: 'Financiamento Parâmetros' },
  { id: 'buyout', label: 'Buyout Parâmetros' },
  { id: 'outros', label: 'Outros' },
]

export const ANALISE_ANOS_PADRAO = 30
export const DIAS_MES_PADRAO = 30
export const PAINEL_OPCOES = [450, 500, 550, 600, 610, 650, 700]

export const STORAGE_KEYS = {
  activePage: 'solarinvest-active-page',
  activeTab: 'solarinvest-active-tab',
}

const COMPOSICAO_TELHADO_BASE: UfvComposicaoTelhadoValores = {
  projeto: 0,
  instalacao: 0,
  materialCa: 0,
  crea: 0,
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
  leasingPrazo: 5 as 5 | 7 | 10,
  potenciaModulo: 550,
  tipoInstalacao: 'TELHADO' as TipoInstalacao,
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
  taxa_mdr_pix_pct: 0,
  taxa_mdr_debito_pct: 0,
  taxa_mdr_credito_vista_pct: 0,
  taxa_mdr_credito_parcelado_pct: 0,
  entrada_financiamento: 0,
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
    fileName: undefined,
    fileSizeBytes: undefined,
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
}

// Re-exporting the KitBudgetState-related types to keep them colocated with the default factory.
export type { KitBudgetItemState, KitBudgetMissingInfo, KitBudgetState }
