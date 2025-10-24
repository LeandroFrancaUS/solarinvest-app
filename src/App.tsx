import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { InfoTooltip, labelWithTooltip } from './components/InfoTooltip'
import { createRoot } from 'react-dom/client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'

import {
  selectCreditoMensal,
  selectInflacaoMensal,
  selectBuyoutLinhas,
  selectKcAjustado,
  selectMensalidades,
  selectTarifaDescontada,
  selectMensalidadesPorAno,
  type SimulationState,
  type BuyoutLinha,
} from './selectors'
import {
  tarifaDescontada as tarifaDescontadaCalc,
  tarifaProjetadaCheia,
  type EntradaModo,
} from './utils/calcs'
import { getIrradiacaoPorEstado, hasEstadoMinimo, IRRADIACAO_FALLBACK } from './utils/irradiacao'
import { getMesReajusteFromANEEL } from './utils/reajusteAneel'
import { getTarifaCheia } from './utils/tarifaAneel'
import { getDistribuidorasFallback, loadDistribuidorasAneel } from './utils/distribuidorasAneel'
import { selectNumberInputOnFocus } from './utils/focusHandlers'
import { persistClienteRegistroToOneDrive, type ClienteRegistroSyncPayload } from './utils/onedrive'
import { persistProposalPdf } from './utils/proposalPdf'
import type { StructuredBudget, StructuredItem } from './utils/structuredBudgetParser'
import {
  analyzeEssentialInfo,
  classifyBudgetItem,
  sumModuleQuantities,
  type EssentialInfoSummary,
} from './utils/moduleDetection'
import { removeFogOverlays, watchFogReinjection } from './utils/antiOverlay'
import {
  computeROI,
  type ModoPagamento,
  type PagamentoCondicao,
  type RetornoProjetado,
  type SegmentoCliente,
  type TipoSistema,
  type VendaForm,
} from './lib/finance/roi'
import { calcTusdEncargoMensal, DEFAULT_TUSD_ANO_REFERENCIA } from './lib/finance/tusd'
import type { TipoClienteTUSD } from './lib/finance/tusd'
import { estimateMonthlyGenerationKWh, estimateMonthlyKWh, kwpFromWpQty } from './lib/energy/generation'
import {
  parseVendaPdfText,
  mergeParsedVendaPdfData,
  type EstruturaUtilizadaTipoWarning,
  type ParsedVendaPdfData,
} from './lib/pdf/extractVendas'
import {
  fmt,
  formatMoneyBR,
  formatNumberBR,
  formatNumberBRWithOptions,
  formatPercentBR,
  formatPercentBRWithDigits,
  toNumberFlexible,
} from './lib/locale/br-number'
import { useBRNumberField } from './lib/locale/useBRNumberField'
import { ensureProposalId, normalizeProposalId } from './lib/ids'
import {
  calculateCapexFromState,
  getVendaSnapshot,
  useVendaStore,
  vendaActions,
  type ModoVenda,
  type VendaKitItem,
} from './store/useVendaStore'
import { getPotenciaModuloW, type PropostaState } from './lib/selectors/proposta'
import { useLeasingValorDeMercadoEstimado } from './store/useLeasingStore'
import { DEFAULT_DENSITY, DENSITY_STORAGE_KEY, isDensityMode, type DensityMode } from './constants/ui'
import { printStyles, simplePrintStyles } from './styles/printTheme'
import './styles/config-page.css'
import '@/styles/fix-fog-safari.css'
import { AppRoutes } from './app/Routes'
import { Providers } from './app/Providers'
import { CHART_THEME } from './helpers/ChartTheme'
import { LeasingBeneficioChart } from './components/leasing/LeasingBeneficioChart'
import { SimulacoesTab } from './components/settings/SimulacoesTab'
import {
  ANALISE_ANOS_PADRAO,
  DIAS_MES_PADRAO,
  INITIAL_VALUES,
  LEASING_PRAZO_OPCOES,
  PAINEL_OPCOES,
  SETTINGS_TABS,
  STORAGE_KEYS,
  UF_LABELS,
  createEmptyKitBudget,
  createInitialComposicaoSolo,
  createInitialComposicaoTelhado,
  createInitialVendaForm,
  createDefaultMultiUcRow,
  type EntradaModoLabel,
  type KitBudgetItemState,
  type KitBudgetMissingInfo,
  type KitBudgetState,
  type LeasingPrazoAnos,
  type SeguroModo,
  type SettingsTabKey,
  type TabKey,
  type MultiUcRowState,
  type MultiUcRateioModo,
} from './app/config'
import { buscarTarifaPorClasse } from './utils/tarifasPorClasse'
import { calcularMultiUc, type MultiUcCalculoResultado, type MultiUcCalculoUcResultado } from './utils/multiUc'
import { MULTI_UC_CLASSES, type MultiUcClasse } from './types/multiUc'
import { useVendasConfigStore, vendasConfigSelectors } from './store/useVendasConfigStore'
import { useVendasSimulacoesStore } from './store/useVendasSimulacoesStore'
import {
  calcularComposicaoUFV,
  type ImpostosRegimeConfig,
  type RegimeTributario,
} from './lib/venda/calcComposicaoUFV'
import {
  uploadBudgetFile,
  BudgetUploadError,
  MAX_FILE_SIZE_BYTES,
  DEFAULT_OCR_DPI,
  type BudgetUploadProgress,
} from './app/services/budgetUpload'
import type {
  BuyoutResumo,
  BuyoutRow,
  ClienteDados,
  MensalidadeRow,
  PrintableMultiUcResumo,
  PrintableProposalProps,
  PrintableProposalTipo,
  TipoInstalacao,
  UfvComposicaoResumo,
  UfvComposicaoSoloValores,
  UfvComposicaoTelhadoValores,
  UfvComposicaoConfiguracao,
} from './types/printableProposal'
import type { PrintableBuyoutTableProps } from './components/print/PrintableBuyoutTable'
import {
  currency,
  formatAxis,
  formatCep,
  formatCpfCnpj,
  formatTelefone,
  normalizeNumbers,
  tarifaCurrency,
} from './utils/formatters'

const PrintableProposal = React.lazy(() => import('./components/print/PrintableProposal'))
const PrintableBuyoutTable = React.lazy(() => import('./components/print/PrintableBuyoutTable'))

const TIPO_SISTEMA_VALUES: readonly TipoSistema[] = ['ON_GRID', 'HIBRIDO', 'OFF_GRID'] as const

const MULTI_UC_CLASS_LABELS: Record<MultiUcClasse, string> = {
  B1_Residencial: 'B1 — Residencial',
  B2_Rural: 'B2 — Rural',
  B3_Comercial: 'B3 — Comercial',
  B4_Iluminacao: 'B4 — Iluminação pública',
}

const REGIME_TRIBUTARIO_LABELS: Record<RegimeTributario, string> = {
  simples: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
}

const formatKwhValue = (value: number | null | undefined, digits = 2): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatNumberBRWithOptions(value, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  }
  return null
}

const formatKwhWithUnit = (value: number | null | undefined, digits = 2): string | null => {
  const formatted = formatKwhValue(value, digits)
  return formatted ? `${formatted} kWh` : null
}

const normalizeTipoSistemaValue = (value: unknown): TipoSistema | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return undefined
    }
    const canonical = trimmed.toUpperCase().replace(/[\s-]+/g, '_')
    return TIPO_SISTEMA_VALUES.includes(canonical as TipoSistema)
      ? (canonical as TipoSistema)
      : undefined
  }

  if (value == null) {
    return undefined
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return normalizeTipoSistemaValue(String(value))
  }

  return undefined
}

const formatLeasingPrazoAnos = (valor: number) => {
  const fractionDigits = Number.isInteger(valor) ? 0 : 1
  return formatNumberBRWithOptions(valor, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

const TUSD_TIPO_OPTIONS: TipoClienteTUSD[] = ['residencial', 'comercial', 'industrial', 'hibrido']
const TUSD_TIPO_LABELS: Record<TipoClienteTUSD, string> = {
  residencial: 'Residencial',
  comercial: 'Comercial',
  industrial: 'Industrial',
  hibrido: 'Híbrido',
}

const emailValido = (valor: string) => {
  if (!valor) {
    return true
  }

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(valor)
}

const numbersAreClose = (
  a: number | null | undefined,
  b: number | null | undefined,
  tolerance = 0.01,
) => {
  if (a == null && b == null) {
    return true
  }

  if (a == null || b == null) {
    return false
  }

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return false
  }

  return Math.abs(a - b) <= tolerance
}

const toNumberSafe = (value: number | null | undefined): number =>
  Number.isFinite(value) ? Number(value) : 0

const sumComposicaoValores = <T extends Record<string, number>>(valores: T): number => {
  return (
    Math.round(
      Object.values(valores).reduce((acc, valor) => (Number.isFinite(valor) ? acc + Number(valor) : acc), 0) * 100,
    ) / 100
  )
}

const resolveStateUpdate = <T,>(input: T | ((prev: T) => T), prev: T): T => {
  return typeof input === 'function' ? (input as (previous: T) => T)(prev) : input
}

const sumComposicaoValoresExcluding = <T extends Record<string, number>>(
  valores: T,
  excludedKeys: (keyof T)[],
): number => {
  return (
    Math.round(
      Object.entries(valores).reduce((acc, [key, valor]) => {
        if (excludedKeys.includes(key as keyof T)) {
          return acc
        }
        return Number.isFinite(valor) ? acc + Number(valor) : acc
      }, 0) * 100,
    ) / 100
  )
}

const LUCRO_BRUTO_PADRAO = 0.29
const LUCRO_BRUTO_MULTIPLICADOR = LUCRO_BRUTO_PADRAO / (1 - LUCRO_BRUTO_PADRAO)

const ECONOMIA_ESTIMATIVA_PADRAO_ANOS = 5

const calcularLucroBrutoPadrao = (valorOrcamento: number, subtotalSemLucro: number) => {
  const base = Math.max(0, valorOrcamento + subtotalSemLucro)
  if (!Number.isFinite(base) || base <= 0) {
    return 0
  }
  return Math.round(base * LUCRO_BRUTO_MULTIPLICADOR * 100) / 100
}

type IbgeMunicipio = {
  nome?: string
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla?: string
      }
    }
  }
}

type ViaCepResponse = {
  logradouro?: string
  localidade?: string
  uf?: string
  erro?: boolean | string
}

type ClienteRegistro = {
  id: string
  criadoEm: string
  atualizadoEm: string
  dados: ClienteDados
}

type ClienteMensagens = {
  email?: string | undefined
  cidade?: string | undefined
  cep?: string | undefined
}

type NotificacaoTipo = 'success' | 'info' | 'error'

type Notificacao = {
  id: number
  mensagem: string
  tipo: NotificacaoTipo
}

const formatQuantityInputValue = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return ''
  }
  return formatNumberBR(value)
}

const formatCurrencyInputValue = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return ''
  }
  return formatMoneyBR(value)
}

const parseNumericInput = (value: string): number | null => {
  if (!value) {
    return null
  }
  return toNumberFlexible(value)
}

const normalizeCurrencyNumber = (value: number | null) =>
  value === null ? null : Math.round(value * 100) / 100

const cloneImpostosOverrides = (
  overrides?: Partial<ImpostosRegimeConfig> | null,
): Partial<ImpostosRegimeConfig> => {
  if (!overrides) {
    return {}
  }
  const cloned: Partial<ImpostosRegimeConfig> = {}
  for (const regime of ['simples', 'lucro_presumido', 'lucro_real'] as const) {
    if (Array.isArray(overrides[regime])) {
      cloned[regime] = overrides[regime]!.map((item) => ({ ...item }))
    }
  }
  return cloned
}

const describeBudgetProgress = (progress: BudgetUploadProgress | null) => {
  if (!progress) {
    return 'Processando orçamento...'
  }
  const percentage = Number.isFinite(progress.progress)
    ? Math.min(100, Math.max(0, Math.round(progress.progress * 100)))
    : 0
  if (progress.message) {
    if (progress.totalPages > 0 && progress.page > 0) {
      return `${progress.message} (${percentage}%)`
    }
    return `${progress.message}${percentage ? ` (${percentage}%)` : ''}`
  }
  switch (progress.stage) {
    case 'carregando':
      return percentage ? `Preparando arquivo (${percentage}%)` : 'Preparando arquivo'
    case 'texto':
      return `Extraindo texto da página ${progress.page} de ${progress.totalPages} (${percentage}%)`
    case 'ocr':
      return `OCR na página ${progress.page} de ${progress.totalPages} (${percentage}%)`
    case 'parse':
      return percentage
        ? `Interpretando dados do orçamento (${percentage}%)`
        : 'Interpretando dados do orçamento'
    default:
      return 'Processando orçamento...'
  }
}

const resolvePotenciaModuloFromBudget = (
  potenciaExtraida: number | null | undefined,
): number => {
  if (
    typeof potenciaExtraida === 'number' &&
    Number.isFinite(potenciaExtraida) &&
    potenciaExtraida > 0
  ) {
    const arredondada = Math.round(potenciaExtraida)
    if (PAINEL_OPCOES.includes(arredondada)) {
      return arredondada
    }
  }
  return INITIAL_VALUES.potenciaModulo
}

const formatFileSize = (bytes?: number) => {
  if (!bytes || !Number.isFinite(bytes)) {
    return ''
  }
  const units = ['B', 'KB', 'MB', 'GB'] as const
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const formatted = unitIndex === 0 ? size.toString() : size.toFixed(size >= 100 ? 0 : 1)
  return `${formatted.replace('.', ',')} ${units[unitIndex]}`
}

const computeBudgetItemsTotalValue = (items: KitBudgetItemState[]): number | null => {
  if (!items.length) {
    return null
  }
  let total = 0
  for (const item of items) {
    if (item.wasQuantityInferred || item.quantity === null || item.unitPrice === null) {
      return null
    }
    total += item.quantity * item.unitPrice
  }
  return Math.round(total * 100) / 100
}

const computeBudgetMissingInfo = (items: KitBudgetItemState[]): KitBudgetMissingInfo => {
  if (!items.length) {
    return null
  }
  return analyzeEssentialInfo(
    items.map((item) => ({
      id: item.id,
      product: item.productName,
      description: item.description,
      quantity: item.wasQuantityInferred ? null : item.quantity,
    })),
  )
}

const formatList = (values: string[]): string => {
  if (values.length === 0) {
    return ''
  }
  if (values.length === 1) {
    return values[0]
  }
  if (values.length === 2) {
    return `${values[0]} e ${values[1]}`
  }
  const [last, ...rest] = values.slice().reverse()
  return `${rest.reverse().join(', ')} e ${last}`
}

const iconeNotificacaoPorTipo: Record<NotificacaoTipo, string> = {
  success: '✔',
  info: 'ℹ',
  error: '⚠',
}

type CrmStageId =
  | 'novo-lead'
  | 'qualificacao'
  | 'proposta-enviada'
  | 'negociacao'
  | 'aguardando-contrato'
  | 'fechado'

type CrmPipelineStage = {
  id: CrmStageId
  label: string
}

type CrmTimelineEntryType = 'status' | 'anotacao'

type CrmTimelineEntry = {
  id: string
  leadId: string
  mensagem: string
  tipo: CrmTimelineEntryType
  criadoEmIso: string
}

type CrmLeadRecord = {
  id: string
  nome: string
  telefone: string
  email?: string | undefined
  cidade: string
  tipoImovel: string
  consumoKwhMes: number
  origemLead: string
  interesse: string
  tipoOperacao: 'LEASING' | 'VENDA_DIRETA'
  valorEstimado: number
  etapa: CrmStageId
  ultimoContatoIso: string
  criadoEmIso: string
  notas?: string | undefined
  instalacaoStatus: 'planejamento' | 'em-andamento' | 'concluida' | 'aguardando-homologacao'
}

type CrmFinanceiroStatus = 'em-aberto' | 'ativo' | 'inadimplente' | 'quitado'

type CrmContratoFinanceiro = {
  id: string
  leadId: string
  modelo: 'LEASING' | 'VENDA_DIRETA'
  valorTotal: number
  entrada: number
  parcelas: number
  valorParcela: number
  reajusteAnualPct: number
  vencimentoInicialIso: string
  status: CrmFinanceiroStatus
}

type CrmLancamentoCaixa = {
  id: string
  leadId?: string | undefined
  dataIso: string
  categoria: 'Receita' | 'Custo Fixo' | 'Custo Variável' | 'Investimento'
  origem: string
  formaPagamento: 'Pix' | 'Boleto' | 'Cartão' | 'Transferência'
  tipo: 'entrada' | 'saida'
  valor: number
  observacao?: string | undefined
}

type CrmCustoProjeto = {
  id: string
  leadId: string
  equipamentos: number
  maoDeObra: number
  deslocamento: number
  taxasSeguros: number
}

type CrmManutencaoRegistro = {
  id: string
  leadId: string
  dataIso: string
  tipo: string
  status: 'pendente' | 'concluida'
  observacao?: string | undefined
}

type CrmDataset = {
  leads: CrmLeadRecord[]
  timeline: CrmTimelineEntry[]
  contratos: CrmContratoFinanceiro[]
  lancamentos: CrmLancamentoCaixa[]
  custos: CrmCustoProjeto[]
  manutencoes: CrmManutencaoRegistro[]
}

type CrmLeadFormState = {
  nome: string
  telefone: string
  email: string
  cidade: string
  tipoImovel: string
  consumoKwhMes: string
  origemLead: string
  interesse: string
  tipoOperacao: 'LEASING' | 'VENDA_DIRETA'
  valorEstimado: string
  notas: string
}

type CrmIntegrationMode = 'local' | 'remote'
type CrmBackendStatus = 'idle' | 'success' | 'error'
type CrmFiltroOperacao = 'all' | 'LEASING' | 'VENDA_DIRETA'

type OrcamentoSalvo = {
  id: string
  criadoEm: string
  clienteId?: string | undefined
  clienteNome: string
  clienteCidade: string
  clienteUf: string
  clienteDocumento?: string | undefined
  clienteUc?: string | undefined
  dados: PrintableProposalProps
}

type ClienteCampoTexto = {
  [K in keyof ClienteDados]: ClienteDados[K] extends string ? K : never
}[keyof ClienteDados]

const CAMPOS_CLIENTE_OBRIGATORIOS: { key: ClienteCampoTexto; label: string }[] = [
  { key: 'nome', label: 'Nome do cliente' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'uf', label: 'Estado' },
]

const CLIENTES_STORAGE_KEY = 'solarinvest-clientes'
const BUDGETS_STORAGE_KEY = 'solarinvest-orcamentos'
const BUDGET_ID_PREFIXES: Record<PrintableProposalTipo, string> = {
  VENDA_DIRETA: 'SLRINVST-VND-',
  LEASING: 'SLRINVST-LSE-',
}
const DEFAULT_BUDGET_ID_PREFIX = BUDGET_ID_PREFIXES.LEASING
const BUDGET_ID_SUFFIX_LENGTH = 8
const BUDGET_ID_MAX_ATTEMPTS = 1000
const CLIENTE_ID_LENGTH = 5
const CLIENTE_ID_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CLIENTE_ID_PATTERN = /^[A-Z0-9]{5}$/
const CLIENTE_ID_MAX_ATTEMPTS = 10000

const CLIENTE_INICIAL: ClienteDados = {
  nome: '',
  documento: '',
  email: '',
  telefone: '',
  cep: '',
  distribuidora: '',
  uc: '',
  endereco: '',
  cidade: 'Anápolis',
  uf: 'GO',
  temIndicacao: false,
  indicacaoNome: '',
}

const generateBudgetId = (
  existingIds: Set<string> = new Set(),
  tipoProposta: PrintableProposalTipo = 'LEASING',
) => {
  let attempts = 0

  while (attempts < BUDGET_ID_MAX_ATTEMPTS) {
    attempts += 1
    const randomNumber = Math.floor(Math.random() * 10 ** BUDGET_ID_SUFFIX_LENGTH)
    const suffix = randomNumber.toString().padStart(BUDGET_ID_SUFFIX_LENGTH, '0')
    const prefix = BUDGET_ID_PREFIXES[tipoProposta] ?? DEFAULT_BUDGET_ID_PREFIX
    const candidate = `${prefix}${suffix}`

    if (!existingIds.has(candidate)) {
      return candidate
    }
  }

  throw new Error('Não foi possível gerar um código de orçamento único.')
}

const createDraftBudgetId = () => `DRAFT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`

const stableStringify = (value: unknown): string => {
  const seen = new WeakSet<object>()

  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') {
      return input
    }

    if (seen.has(input as object)) {
      return null
    }

    seen.add(input as object)

    if (Array.isArray(input)) {
      return input.map((item) => normalize(item))
    }

    const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    )

    const normalized: Record<string, unknown> = {}
    entries.forEach(([key, val]) => {
      const normalizedValue = normalize(val)
      if (normalizedValue !== undefined) {
        normalized[key] = normalizedValue
      }
    })

    return normalized
  }

  return JSON.stringify(normalize(value))
}

const clonePrintableData = (dados: PrintableProposalProps): PrintableProposalProps => {
  const clone: PrintableProposalProps = {
    ...dados,
    cliente: { ...dados.cliente },
    anos: [...dados.anos],
    leasingROI: [...dados.leasingROI],
    financiamentoFluxo: [...dados.financiamentoFluxo],
    financiamentoROI: [...dados.financiamentoROI],
    tabelaBuyout: dados.tabelaBuyout.map((row) => ({ ...row })),
    buyoutResumo: { ...dados.buyoutResumo },
    parcelasLeasing: dados.parcelasLeasing.map((row) => ({ ...row })),
  }

  if (dados.budgetId === undefined) {
    delete clone.budgetId
  }

  if (dados.vendaResumo) {
    clone.vendaResumo = {
      form: { ...dados.vendaResumo.form },
      retorno: dados.vendaResumo.retorno
        ? {
            ...dados.vendaResumo.retorno,
            economia: [...dados.vendaResumo.retorno.economia],
            pagamentoMensal: [...dados.vendaResumo.retorno.pagamentoMensal],
            fluxo: [...dados.vendaResumo.retorno.fluxo],
            saldo: [...dados.vendaResumo.retorno.saldo],
          }
        : null,
    }
  } else {
    delete clone.vendaResumo
  }

  if (dados.parsedPdfVenda !== undefined) {
    clone.parsedPdfVenda = dados.parsedPdfVenda ? { ...dados.parsedPdfVenda } : null
  } else {
    delete clone.parsedPdfVenda
  }

  if (dados.orcamentoItens) {
    clone.orcamentoItens = dados.orcamentoItens.map((item) => ({ ...item }))
  } else {
    delete clone.orcamentoItens
  }

  if (dados.composicaoUfv) {
    clone.composicaoUfv = {
      telhado: { ...dados.composicaoUfv.telhado },
      solo: { ...dados.composicaoUfv.solo },
      totalTelhado: dados.composicaoUfv.totalTelhado,
      totalSolo: dados.composicaoUfv.totalSolo,
      valorOrcamento: dados.composicaoUfv.valorOrcamento,
      valorVendaTelhado: dados.composicaoUfv.valorVendaTelhado,
      valorVendaSolo: dados.composicaoUfv.valorVendaSolo,
      tipoAtual: dados.composicaoUfv.tipoAtual,
    }
  } else {
    delete clone.composicaoUfv
  }

  if (dados.multiUcResumo) {
    clone.multiUcResumo = {
      ...dados.multiUcResumo,
      ucs: dados.multiUcResumo.ucs.map((uc) => ({ ...uc })),
    }
  } else {
    delete clone.multiUcResumo
  }

  return clone
}

const createBudgetFingerprint = (dados: PrintableProposalProps): string => {
  const clone = clonePrintableData(dados)
  delete clone.budgetId
  return stableStringify(clone)
}

const cloneClienteDados = (dados: ClienteDados): ClienteDados => ({ ...dados })

const normalizeClienteIdCandidate = (valor: string | undefined | null) =>
  (valor ?? '')
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const generateClienteId = (existingIds: Set<string> = new Set()) => {
  let attempts = 0

  while (attempts < CLIENTE_ID_MAX_ATTEMPTS) {
    attempts += 1
    let candidate = ''
    for (let index = 0; index < CLIENTE_ID_LENGTH; index += 1) {
      const randomIndex = Math.floor(Math.random() * CLIENTE_ID_CHARSET.length)
      candidate += CLIENTE_ID_CHARSET[randomIndex]
    }

    if (!existingIds.has(candidate)) {
      existingIds.add(candidate)
      return candidate
    }
  }

  throw new Error('Não foi possível gerar um identificador único para o cliente.')
}

const ensureClienteId = (candidate: string | undefined, existingIds: Set<string>) => {
  const normalized = normalizeClienteIdCandidate(candidate)
  if (normalized.length === CLIENTE_ID_LENGTH && CLIENTE_ID_PATTERN.test(normalized) && !existingIds.has(normalized)) {
    existingIds.add(normalized)
    return normalized
  }

  return generateClienteId(existingIds)
}

const CRM_LOCAL_STORAGE_KEY = 'solarinvest-crm-dataset'
const CRM_BACKEND_BASE_URL = 'https://crm.solarinvest.app'

const CRM_PIPELINE_STAGES: CrmPipelineStage[] = [
  { id: 'novo-lead', label: 'Novo lead' },
  { id: 'qualificacao', label: 'Qualificação' },
  { id: 'proposta-enviada', label: 'Proposta enviada' },
  { id: 'negociacao', label: 'Negociação' },
  { id: 'aguardando-contrato', label: 'Aguardando contrato' },
  { id: 'fechado', label: 'Fechado' },
]

const CRM_INSTALACAO_STATUS: { id: CrmLeadRecord['instalacaoStatus']; label: string }[] = [
  { id: 'planejamento', label: 'Planejamento' },
  { id: 'em-andamento', label: 'Em andamento' },
  { id: 'aguardando-homologacao', label: 'Aguardando homologação' },
  { id: 'concluida', label: 'Concluída' },
]

const CRM_FINANCEIRO_CATEGORIAS: CrmLancamentoCaixa['categoria'][] = [
  'Receita',
  'Custo Fixo',
  'Custo Variável',
  'Investimento',
]

const CRM_FORMAS_PAGAMENTO: CrmLancamentoCaixa['formaPagamento'][] = [
  'Pix',
  'Boleto',
  'Cartão',
  'Transferência',
]

const CRM_STAGE_INDEX: Record<CrmStageId, number> = CRM_PIPELINE_STAGES.reduce(
  (acc, stage, index) => {
    acc[stage.id] = index
    return acc
  },
  {} as Record<CrmStageId, number>,
)

const CRM_EMPTY_LEAD_FORM: CrmLeadFormState = {
  nome: '',
  telefone: '',
  email: '',
  cidade: '',
  tipoImovel: '',
  consumoKwhMes: '',
  origemLead: '',
  interesse: 'Leasing',
  tipoOperacao: 'LEASING',
  valorEstimado: '',
  notas: '',
}

const CRM_DATASET_VAZIO: CrmDataset = {
  leads: [],
  timeline: [],
  contratos: [],
  lancamentos: [],
  custos: [],
  manutencoes: [],
}

const gerarIdCrm = (
  prefixo: 'lead' | 'evento' | 'contrato' | 'lancamento' | 'custo' | 'manutencao',
) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefixo}-${crypto.randomUUID()}`
  }

  const aleatorio = Math.floor(Math.random() * 1_000_000)
  return `${prefixo}-${Date.now()}-${aleatorio.toString().padStart(6, '0')}`
}

const diasDesdeDataIso = (isoString: string) => {
  const data = new Date(isoString)
  if (Number.isNaN(data.getTime())) {
    return 0
  }
  const diffMs = Date.now() - data.getTime()
  return diffMs <= 0 ? 0 : Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

const formatarDataCurta = (isoString: string) => {
  const data = new Date(isoString)
  if (Number.isNaN(data.getTime())) {
    return ''
  }
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const sanitizarLeadCrm = (valor: Partial<CrmLeadRecord>): CrmLeadRecord => {
  const agoraIso = new Date().toISOString()
  const etapaValida = CRM_PIPELINE_STAGES.some((stage) => stage.id === valor.etapa)
    ? (valor.etapa as CrmStageId)
    : 'novo-lead'

  return {
    id: typeof valor.id === 'string' && valor.id ? valor.id : gerarIdCrm('lead'),
    nome: typeof valor.nome === 'string' ? valor.nome : '',
    telefone: typeof valor.telefone === 'string' ? valor.telefone : '',
    email: typeof valor.email === 'string' && valor.email ? valor.email : undefined,
    cidade: typeof valor.cidade === 'string' ? valor.cidade : '',
    tipoImovel: typeof valor.tipoImovel === 'string' ? valor.tipoImovel : 'Não informado',
    consumoKwhMes: Number.isFinite(valor.consumoKwhMes)
      ? Math.max(0, Math.round(valor.consumoKwhMes as number))
      : 0,
    origemLead: typeof valor.origemLead === 'string' && valor.origemLead
      ? valor.origemLead
      : 'Cadastro manual',
    interesse: typeof valor.interesse === 'string' && valor.interesse ? valor.interesse : 'Leasing',
    tipoOperacao: valor.tipoOperacao === 'VENDA_DIRETA' ? 'VENDA_DIRETA' : 'LEASING',
    valorEstimado: Number.isFinite(valor.valorEstimado)
      ? Math.max(0, Math.round(valor.valorEstimado as number))
      : 0,
    etapa: etapaValida,
    ultimoContatoIso:
      typeof valor.ultimoContatoIso === 'string' && valor.ultimoContatoIso
        ? valor.ultimoContatoIso
        : agoraIso,
    criadoEmIso:
      typeof valor.criadoEmIso === 'string' && valor.criadoEmIso ? valor.criadoEmIso : agoraIso,
    notas: typeof valor.notas === 'string' && valor.notas ? valor.notas : undefined,
    instalacaoStatus:
      valor.instalacaoStatus && CRM_INSTALACAO_STATUS.some((item) => item.id === valor.instalacaoStatus)
        ? valor.instalacaoStatus
        : 'planejamento',
  }
}

const sanitizarContratoCrm = (
  valor: Partial<CrmContratoFinanceiro>,
  leadIds: Set<string>,
): CrmContratoFinanceiro | null => {
  if (!valor.leadId || !leadIds.has(valor.leadId)) {
    return null
  }

  const parcelas = Number.isFinite(valor.parcelas) ? Math.max(0, Math.round(valor.parcelas as number)) : 0
  const valorParcela = Number.isFinite(valor.valorParcela)
    ? Math.max(0, Number(valor.valorParcela))
    : 0
  const valorTotal = Number.isFinite(valor.valorTotal) ? Math.max(0, Number(valor.valorTotal)) : 0
  const entrada = Number.isFinite(valor.entrada) ? Math.max(0, Number(valor.entrada)) : 0
  const reajuste = Number.isFinite(valor.reajusteAnualPct)
    ? Math.max(0, Number(valor.reajusteAnualPct))
    : 0

  const modelo = valor.modelo === 'VENDA_DIRETA' ? 'VENDA_DIRETA' : 'LEASING'
  const status: CrmFinanceiroStatus =
    valor.status === 'ativo' || valor.status === 'inadimplente' || valor.status === 'quitado'
      ? valor.status
      : 'em-aberto'

  const vencimentoIso =
    typeof valor.vencimentoInicialIso === 'string' && valor.vencimentoInicialIso
      ? valor.vencimentoInicialIso
      : new Date().toISOString()

  return {
    id: typeof valor.id === 'string' && valor.id ? valor.id : gerarIdCrm('contrato'),
    leadId: valor.leadId,
    modelo,
    valorTotal,
    entrada,
    parcelas,
    valorParcela,
    reajusteAnualPct: reajuste,
    vencimentoInicialIso: vencimentoIso,
    status,
  }
}

const sanitizarLancamentoCrm = (
  valor: Partial<CrmLancamentoCaixa>,
  leadIds: Set<string>,
): CrmLancamentoCaixa | null => {
  const dataIso = typeof valor.dataIso === 'string' && valor.dataIso ? valor.dataIso : new Date().toISOString()
  const categoria = CRM_FINANCEIRO_CATEGORIAS.includes((valor.categoria as CrmLancamentoCaixa['categoria']) ?? 'Receita')
    ? (valor.categoria as CrmLancamentoCaixa['categoria'])
    : 'Receita'
  const forma = CRM_FORMAS_PAGAMENTO.includes(
    (valor.formaPagamento as CrmLancamentoCaixa['formaPagamento']) ?? 'Pix',
  )
    ? (valor.formaPagamento as CrmLancamentoCaixa['formaPagamento'])
    : 'Pix'
  const tipo = valor.tipo === 'saida' ? 'saida' : 'entrada'
  const valorNumerico = Number.isFinite(valor.valor) ? Number(valor.valor) : 0

  if (valor.leadId && !leadIds.has(valor.leadId)) {
    return null
  }

  return {
    id: typeof valor.id === 'string' && valor.id ? valor.id : gerarIdCrm('lancamento'),
    leadId: valor.leadId && leadIds.has(valor.leadId) ? valor.leadId : undefined,
    dataIso,
    categoria,
    origem: typeof valor.origem === 'string' && valor.origem ? valor.origem : 'Operação',
    formaPagamento: forma,
    tipo,
    valor: valorNumerico,
    observacao:
      typeof valor.observacao === 'string' && valor.observacao ? valor.observacao.slice(0, 280) : undefined,
  }
}

const sanitizarCustoCrm = (
  valor: Partial<CrmCustoProjeto>,
  leadIds: Set<string>,
): CrmCustoProjeto | null => {
  if (!valor.leadId || !leadIds.has(valor.leadId)) {
    return null
  }

  const normalizar = (numero?: number) => (Number.isFinite(numero) ? Math.max(0, Number(numero)) : 0)

  return {
    id: typeof valor.id === 'string' && valor.id ? valor.id : gerarIdCrm('custo'),
    leadId: valor.leadId,
    equipamentos: normalizar(valor.equipamentos),
    maoDeObra: normalizar(valor.maoDeObra),
    deslocamento: normalizar(valor.deslocamento),
    taxasSeguros: normalizar(valor.taxasSeguros),
  }
}

const sanitizarManutencaoCrm = (
  valor: Partial<CrmManutencaoRegistro>,
  leadIds: Set<string>,
): CrmManutencaoRegistro | null => {
  if (!valor.leadId || !leadIds.has(valor.leadId)) {
    return null
  }

  const status = valor.status === 'concluida' ? 'concluida' : 'pendente'
  const dataIso = typeof valor.dataIso === 'string' && valor.dataIso ? valor.dataIso : new Date().toISOString()

  return {
    id: typeof valor.id === 'string' && valor.id ? valor.id : gerarIdCrm('manutencao'),
    leadId: valor.leadId,
    dataIso,
    tipo: typeof valor.tipo === 'string' && valor.tipo ? valor.tipo : 'Revisão preventiva',
    status,
    observacao:
      typeof valor.observacao === 'string' && valor.observacao ? valor.observacao.slice(0, 280) : undefined,
  }
}

const sanitizarEventoCrm = (
  valor: Partial<CrmTimelineEntry>,
  leadIds: Set<string>,
): CrmTimelineEntry | null => {
  const leadId = typeof valor.leadId === 'string' ? valor.leadId : ''
  const mensagem = typeof valor.mensagem === 'string' ? valor.mensagem : ''
  if (!leadId || !mensagem || !leadIds.has(leadId)) {
    return null
  }

  return {
    id: typeof valor.id === 'string' && valor.id ? valor.id : gerarIdCrm('evento'),
    leadId,
    mensagem,
    tipo: valor.tipo === 'anotacao' ? 'anotacao' : 'status',
    criadoEmIso:
      typeof valor.criadoEmIso === 'string' && valor.criadoEmIso
        ? valor.criadoEmIso
        : new Date().toISOString(),
  }
}

const sanitizarDatasetCrm = (valor: unknown): CrmDataset => {
  if (!valor || typeof valor !== 'object') {
    return { ...CRM_DATASET_VAZIO }
  }

  const bruto = valor as Partial<CrmDataset>
  const leads = Array.isArray(bruto.leads)
    ? bruto.leads.map((item) => sanitizarLeadCrm(item as Partial<CrmLeadRecord>))
    : []
  const leadIds = new Set(leads.map((lead) => lead.id))
  const timeline = Array.isArray(bruto.timeline)
    ? bruto.timeline
        .map((item) => sanitizarEventoCrm(item as Partial<CrmTimelineEntry>, leadIds))
        .filter((item): item is CrmTimelineEntry => Boolean(item))
    : []

  const contratos = Array.isArray(bruto.contratos)
    ? bruto.contratos
        .map((item) => sanitizarContratoCrm(item as Partial<CrmContratoFinanceiro>, leadIds))
        .filter((item): item is CrmContratoFinanceiro => Boolean(item))
    : []

  const lancamentos = Array.isArray(bruto.lancamentos)
    ? bruto.lancamentos
        .map((item) => sanitizarLancamentoCrm(item as Partial<CrmLancamentoCaixa>, leadIds))
        .filter((item): item is CrmLancamentoCaixa => Boolean(item))
    : []

  const custos = Array.isArray(bruto.custos)
    ? bruto.custos
        .map((item) => sanitizarCustoCrm(item as Partial<CrmCustoProjeto>, leadIds))
        .filter((item): item is CrmCustoProjeto => Boolean(item))
    : []

  const manutencoes = Array.isArray(bruto.manutencoes)
    ? bruto.manutencoes
        .map((item) => sanitizarManutencaoCrm(item as Partial<CrmManutencaoRegistro>, leadIds))
        .filter((item): item is CrmManutencaoRegistro => Boolean(item))
    : []

  leads.sort((a, b) => (a.ultimoContatoIso < b.ultimoContatoIso ? 1 : -1))
  timeline.sort((a, b) => (a.criadoEmIso < b.criadoEmIso ? 1 : -1))

  contratos.sort((a, b) => (a.vencimentoInicialIso < b.vencimentoInicialIso ? -1 : 1))
  lancamentos.sort((a, b) => (a.dataIso < b.dataIso ? 1 : -1))
  manutencoes.sort((a, b) => (a.dataIso > b.dataIso ? 1 : -1))

  return { leads, timeline, contratos, lancamentos, custos, manutencoes }
}

const carregarDatasetCrm = (): CrmDataset => {
  if (typeof window === 'undefined') {
    return { ...CRM_DATASET_VAZIO }
  }

  const existente = window.localStorage.getItem(CRM_LOCAL_STORAGE_KEY)
  if (!existente) {
    return { ...CRM_DATASET_VAZIO }
  }

  try {
    const parsed: unknown = JSON.parse(existente)
    return sanitizarDatasetCrm(parsed)
  } catch (error) {
    console.warn('Não foi possível interpretar o dataset do CRM salvo localmente.', error)
    return { ...CRM_DATASET_VAZIO }
  }
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const formatBudgetDate = (isoString: string) => {
  const parsed = new Date(isoString)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

type ClientesModalProps = {
  registros: ClienteRegistro[]
  onClose: () => void
  onEditar: (registro: ClienteRegistro) => void
  onExcluir: (registro: ClienteRegistro) => void
}

function ClientesModal({ registros, onClose, onEditar, onExcluir }: ClientesModalProps) {
  const modalTitleId = useId()

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content">
        <div className="modal-header">
          <h3 id={modalTitleId}>Clientes salvos</h3>
          <button className="icon" onClick={onClose} aria-label="Fechar listagem de clientes">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <section className="budget-search-panel clients-panel">
            <div className="budget-search-header">
              <h4>Gestão de clientes</h4>
              <p>Clientes armazenados localmente neste dispositivo.</p>
            </div>
            {registros.length === 0 ? (
              <p className="budget-search-empty">Nenhum cliente foi salvo até o momento.</p>
            ) : (
              <div className="budget-search-table clients-table">
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Cliente</th>
                        <th>Documento</th>
                        <th>Cidade/UF</th>
                        <th>Criado em</th>
                        <th>Atualizado em</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map((registro) => {
                        const { dados } = registro
                        const nomeCliente = dados.nome?.trim()
                        const emailCliente = dados.email?.trim()
                        const documentoCliente = dados.documento?.trim()
                        const cidade = dados.cidade?.trim()
                        const uf = dados.uf?.trim()
                        const cidadeUf = [cidade, uf].filter(Boolean).join(' / ')
                        const primaryLine = nomeCliente || emailCliente || registro.id
                        const secondaryLine =
                          emailCliente && emailCliente !== primaryLine ? emailCliente : null
                        return (
                          <tr key={registro.id}>
                            <td className="clients-table-id">
                              <code>{registro.id}</code>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="clients-table-client clients-table-load"
                                onClick={() => onEditar(registro)}
                                title="Carregar dados do cliente"
                                aria-label="Carregar dados do cliente"
                              >
                                <strong>{primaryLine}</strong>
                                {secondaryLine ? <span>{secondaryLine}</span> : null}
                              </button>
                            </td>
                            <td>{documentoCliente ? <span>{documentoCliente}</span> : null}</td>
                            <td>{cidadeUf ? <span>{cidadeUf}</span> : null}</td>
                            <td>{formatBudgetDate(registro.criadoEm)}</td>
                            <td>{formatBudgetDate(registro.atualizadoEm)}</td>
                            <td>
                              <div className="clients-table-actions">
                                <button
                                  type="button"
                                  className="clients-table-action"
                                  onClick={() => onEditar(registro)}
                                  aria-label="Carregar dados do cliente"
                                  title="Carregar dados do cliente"
                                >
                                  <span aria-hidden="true">📁</span>
                                </button>
                                <button
                                  type="button"
                                  className="clients-table-action danger"
                                  onClick={() => onExcluir(registro)}
                                  aria-label="Excluir cliente salvo"
                                  title="Excluir cliente salvo"
                                >
                                  <span aria-hidden="true">🗑</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  hint,
  htmlFor,
}: {
  label: React.ReactNode
  children: React.ReactNode
  hint?: React.ReactNode
  htmlFor?: string
}) {
  const enhancedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) {
      return child
    }

    if (typeof child.type === 'string') {
      if (child.type === 'input') {
        const inputType = (child.props as { type?: string }).type
        if (inputType === 'checkbox' || inputType === 'radio') {
          return child
        }
      }

      if (child.type === 'input' || child.type === 'select' || child.type === 'textarea') {
        const existingClassName = (child.props as { className?: string }).className ?? ''
        const classes = existingClassName.split(' ').filter(Boolean)
        if (!classes.includes('cfg-input')) {
          classes.push('cfg-input')
        }
        return React.cloneElement(child, {
          className: classes.join(' '),
        })
      }
    }

    return child
  })

  return (
    <div className="field cfg-field">
      <label className="field-label cfg-label" {...(htmlFor ? { htmlFor } : undefined)}>
        {label}
      </label>
      <div className="field-control cfg-control">
        {enhancedChildren}
        {hint ? <small className="cfg-help">{hint}</small> : null}
      </div>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error">{message}</span> : null
}

type PrintMode = 'preview' | 'print' | 'download'

type PrintVariant = 'standard' | 'simple' | 'buyout'

type PreviewActionRequest = { action: 'print' | 'download' }

type PreviewActionResponse = {
  proceed?: boolean | undefined
  budgetId?: string | undefined
  updatedHtml?: string | undefined
}

declare global {
  interface Window {
    __solarinvestOnPreviewAction?: (
      request: PreviewActionRequest,
    ) => PreviewActionResponse | void | Promise<PreviewActionResponse | void>
  }
}

type BudgetPreviewOptions = {
  nomeCliente: string
  budgetId?: string | undefined
  actionMessage?: string | undefined
  autoPrint?: boolean | undefined
  closeAfterPrint?: boolean | undefined
  initialMode?: PrintMode | undefined
  initialVariant?: PrintVariant | undefined
}

function renderPrintableProposalToHtml(dados: PrintableProposalProps): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    container.style.width = '672px'
    container.style.padding = '0'
    container.style.background = '#f8fafc'
    container.style.zIndex = '-1'
    document.body.appendChild(container)

    let resolved = false

    const cleanup = (root: ReturnType<typeof createRoot> | null) => {
      if (root) {
        root.unmount()
      }
      if (container.parentElement) {
        container.parentElement.removeChild(container)
      }
    }

    const PrintableHost: React.FC = () => {
      const wrapperRef = useRef<HTMLDivElement>(null)
      const localRef = useRef<HTMLDivElement>(null)

      useEffect(() => {
        const timeouts: number[] = []
        let attempts = 0
        const maxAttempts = 8

        const chartIsReady = (containerEl: HTMLDivElement | null) => {
          if (!containerEl) {
            return false
          }
          const chartWrapper = containerEl.querySelector('.recharts-wrapper')
          if (!chartWrapper) {
            return true
          }
          const chartSvg = chartWrapper.querySelector('svg')
          if (!chartSvg) {
            return false
          }
          return chartSvg.childNodes.length > 0
        }

        const attemptCapture = (root: ReturnType<typeof createRoot> | null) => {
          if (resolved) {
            return
          }

          const containerEl = wrapperRef.current

          if (containerEl && chartIsReady(containerEl)) {
            resolved = true
            resolve(containerEl.outerHTML)
            cleanup(root)
            return
          }

          attempts += 1
          if (attempts >= maxAttempts) {
            resolved = true
            resolve(containerEl ? containerEl.outerHTML : null)
            cleanup(root)
            return
          }

          const timeoutId = window.setTimeout(() => attemptCapture(root), 160)
          timeouts.push(timeoutId)
        }

        const triggerResize = () => {
          window.dispatchEvent(new Event('resize'))
        }

        const resizeTimeout = window.setTimeout(triggerResize, 120)
        timeouts.push(resizeTimeout)

        const initialTimeout = window.setTimeout(() => attemptCapture(rootInstance), 220)
        timeouts.push(initialTimeout)

        return () => {
          timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
        }
      }, [])

      return (
        <div ref={wrapperRef} data-print-mode="download" data-print-variant="standard">
          <React.Suspense fallback={null}>
            <PrintableProposal ref={localRef} {...dados} />
          </React.Suspense>
        </div>
      )
    }

    const rootInstance = createRoot(container)
    rootInstance.render(<PrintableHost />)
  })
}

function renderPrintableBuyoutTableToHtml(dados: PrintableBuyoutTableProps): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    container.style.width = '672px'
    container.style.padding = '0'
    container.style.background = '#f8fafc'
    container.style.zIndex = '-1'
    document.body.appendChild(container)

    let resolved = false
    let rootInstance: ReturnType<typeof createRoot> | null = null

    const cleanup = () => {
      if (rootInstance) {
        rootInstance.unmount()
      }
      if (container.parentElement) {
        container.parentElement.removeChild(container)
      }
    }

    const finalize = (html: string | null) => {
      if (resolved) {
        return
      }
      resolved = true
      resolve(html)
      cleanup()
    }

    const PrintableHost: React.FC = () => {
      const wrapperRef = useRef<HTMLDivElement>(null)

      useEffect(() => {
        const timeoutId = window.setTimeout(() => {
          const html = wrapperRef.current ? wrapperRef.current.outerHTML : null
          finalize(html)
        }, 220)

        return () => {
          window.clearTimeout(timeoutId)
          const html = wrapperRef.current ? wrapperRef.current.outerHTML : null
          finalize(html)
        }
      }, [])

      return (
        <div ref={wrapperRef} data-print-mode="download" data-print-variant="buyout">
          <React.Suspense fallback={null}>
            <PrintableBuyoutTable {...dados} />
          </React.Suspense>
        </div>
      )
    }

    rootInstance = createRoot(container)
    rootInstance.render(<PrintableHost />)
  })
}

export default function App() {
  const distribuidorasFallback = useMemo(() => getDistribuidorasFallback(), [])
  const custoImplantacaoReferencia = useVendaStore(
    (state) => state.resumoProposta.custo_implantacao_referencia,
  )
  const valorTotalPropostaState = useVendaStore(
    (state) => state.resumoProposta.valor_total_proposta,
  )
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'light'
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    removeFogOverlays()
    const disconnect = watchFogReinjection()
    return disconnect
  }, [])
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') {
      return
    }

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (!isSafari) {
      document.documentElement.classList.remove('is-safari')
      return
    }

    const htmlElement = document.documentElement as HTMLElement
    const bodyElement = document.body as HTMLElement | null
    const elements: HTMLElement[] = bodyElement ? [htmlElement, bodyElement] : [htmlElement]

    const previousStyles = elements.map((el) => {
      const style = el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }
      return {
        el,
        filter: style.filter,
        opacity: style.opacity,
        backdropFilter: style.backdropFilter,
        webkitBackdropFilter: style.webkitBackdropFilter,
        mixBlendMode: style.mixBlendMode,
      }
    })

    document.documentElement.classList.add('is-safari')
    elements.forEach((el) => {
      const style = el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }
      style.filter = 'none'
      style.opacity = '1'
      style.backdropFilter = 'none'
      style.webkitBackdropFilter = 'none'
      style.mixBlendMode = 'normal'
    })

    return () => {
      document.documentElement.classList.remove('is-safari')
      previousStyles.forEach((item) => {
        const style = item.el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }
        style.filter = item.filter
        style.opacity = item.opacity
        style.backdropFilter = item.backdropFilter
        style.webkitBackdropFilter = item.webkitBackdropFilter ?? ''
        style.mixBlendMode = item.mixBlendMode
      })
    }
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = (matches: boolean) => {
      const nextTheme: 'light' | 'dark' = matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', nextTheme)
      document.documentElement.style.colorScheme = nextTheme
      setTheme(nextTheme)
    }

    applyTheme(mediaQuery.matches)
    const handleChange = (event: MediaQueryListEvent) => applyTheme(event.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])
  const chartTheme = useMemo(() => CHART_THEME[theme], [theme])
  const [activePage, setActivePage] = useState<'app' | 'crm'>(() => {
    if (typeof window === 'undefined') {
      return 'app'
    }

    const storedPage = window.localStorage.getItem(STORAGE_KEYS.activePage)
    return storedPage === 'crm' ? 'crm' : 'app'
  })
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window === 'undefined') {
      return INITIAL_VALUES.activeTab
    }

    const storedTab = window.localStorage.getItem(STORAGE_KEYS.activeTab)
    return storedTab === 'leasing' || storedTab === 'vendas' ? storedTab : INITIAL_VALUES.activeTab
  })
  const isVendaDiretaTab = activeTab === 'vendas'
  useEffect(() => {
    const modo: ModoVenda = isVendaDiretaTab ? 'direta' : 'leasing'
    vendaActions.updateResumoProposta({ modo_venda: modo })
  }, [isVendaDiretaTab])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isBudgetSearchOpen, setIsBudgetSearchOpen] = useState(false)
  const [orcamentosSalvos, setOrcamentosSalvos] = useState<OrcamentoSalvo[]>([])
  const [orcamentoSearchTerm, setOrcamentoSearchTerm] = useState('')
  const [currentBudgetId, setCurrentBudgetId] = useState<string>(() => createDraftBudgetId())
  const [budgetStructuredItems, setBudgetStructuredItems] = useState<StructuredItem[]>([])
  const budgetUploadInputId = useId()
  const budgetTableContentId = useId()
  const tusdOptionsTitleId = useId()
  const tusdOptionsToggleId = useId()
  const tusdOptionsContentId = useId()
  const budgetUploadInputRef = useRef<HTMLInputElement | null>(null)
  const moduleQuantityInputRef = useRef<HTMLInputElement | null>(null)
  const inverterModelInputRef = useRef<HTMLInputElement | null>(null)
  const [kitBudget, setKitBudget] = useState<KitBudgetState>(() => createEmptyKitBudget())
  const [isBudgetProcessing, setIsBudgetProcessing] = useState(false)
  const [budgetProcessingError, setBudgetProcessingError] = useState<string | null>(null)
  const [budgetProcessingProgress, setBudgetProcessingProgress] =
    useState<BudgetUploadProgress | null>(null)
  const [ocrDpi, setOcrDpi] = useState(DEFAULT_OCR_DPI)
  const [isBudgetTableCollapsed, setIsBudgetTableCollapsed] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>(INITIAL_VALUES.settingsTab)
  const mesReferenciaRef = useRef(new Date().getMonth() + 1)
  const [ufTarifa, setUfTarifaState] = useState(INITIAL_VALUES.ufTarifa)
  const [distribuidoraTarifa, setDistribuidoraTarifaState] = useState(INITIAL_VALUES.distribuidoraTarifa)
  const [ufsDisponiveis, setUfsDisponiveis] = useState<string[]>(() => [...distribuidorasFallback.ufs])
  const [distribuidorasPorUf, setDistribuidorasPorUf] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      Object.entries(distribuidorasFallback.distribuidorasPorUf).map(([uf, lista]) => [
        uf,
        [...lista],
      ]),
    ),
  )
  const [mesReajuste, setMesReajuste] = useState(INITIAL_VALUES.mesReajuste)

  const [kcKwhMes, setKcKwhMesState] = useState(INITIAL_VALUES.kcKwhMes)
  const [consumoManual, setConsumoManualState] = useState(false)
  const [tarifaCheia, setTarifaCheiaState] = useState(INITIAL_VALUES.tarifaCheia)
  const [desconto, setDesconto] = useState(INITIAL_VALUES.desconto)
  const [taxaMinima, setTaxaMinimaState] = useState(INITIAL_VALUES.taxaMinima)
  const [taxaMinimaInputEmpty, setTaxaMinimaInputEmpty] = useState(
    () => INITIAL_VALUES.taxaMinima === 0,
  )
  const [encargosFixosExtras, setEncargosFixosExtras] = useState(
    INITIAL_VALUES.encargosFixosExtras,
  )
  const [tusdPercent, setTusdPercent] = useState(INITIAL_VALUES.tusdPercent)
  const [tusdTipoCliente, setTusdTipoCliente] = useState<TipoClienteTUSD>(
    INITIAL_VALUES.tusdTipoCliente,
  )
  const [tusdSubtipo, setTusdSubtipo] = useState(INITIAL_VALUES.tusdSubtipo)
  const [tusdSimultaneidade, setTusdSimultaneidade] = useState<number | null>(
    INITIAL_VALUES.tusdSimultaneidade,
  )
  const [tusdTarifaRkwh, setTusdTarifaRkwh] = useState<number | null>(
    INITIAL_VALUES.tusdTarifaRkwh,
  )
  const [tusdAnoReferencia, setTusdAnoReferencia] = useState(
    INITIAL_VALUES.tusdAnoReferencia ?? DEFAULT_TUSD_ANO_REFERENCIA,
  )
  const [tusdOpcoesExpandidas, setTusdOpcoesExpandidas] = useState(false)
  const [leasingPrazo, setLeasingPrazo] = useState<LeasingPrazoAnos>(INITIAL_VALUES.leasingPrazo)
  const [potenciaModulo, setPotenciaModuloState] = useState(INITIAL_VALUES.potenciaModulo)
  const [potenciaModuloDirty, setPotenciaModuloDirtyState] = useState(false)
  const [tipoInstalacao, setTipoInstalacaoState] = useState<TipoInstalacao>(
    INITIAL_VALUES.tipoInstalacao,
  )
  const [tipoSistema, setTipoSistemaState] = useState<TipoSistema>(INITIAL_VALUES.tipoSistema)
  const [segmentoCliente, setSegmentoClienteState] = useState<SegmentoCliente>(
    INITIAL_VALUES.segmentoCliente,
  )
  const [tipoInstalacaoDirty, setTipoInstalacaoDirtyState] = useState(false)
  const [numeroModulosManual, setNumeroModulosManualState] = useState<number | ''>(
    INITIAL_VALUES.numeroModulosManual,
  )
  const [composicaoTelhado, setComposicaoTelhado] = useState<UfvComposicaoTelhadoValores>(
    () => createInitialComposicaoTelhado(),
  )
  const [composicaoSolo, setComposicaoSolo] = useState<UfvComposicaoSoloValores>(() =>
    createInitialComposicaoSolo(),
  )
  const vendasConfig = useVendasConfigStore(vendasConfigSelectors.config)
  const updateVendasConfig = useVendasConfigStore((state) => state.update)
  const [aprovadoresText, setAprovadoresText] = useState(() => vendasConfig.aprovadores.join('\n'))
  const [impostosOverridesDraft, setImpostosOverridesDraft] = useState<
    Partial<ImpostosRegimeConfig>
  >(() => cloneImpostosOverrides(vendasConfig.impostosRegime_overrides))
  const vendasSimulacao = useVendasSimulacoesStore((state) => state.simulations[currentBudgetId])
  const initializeVendasSimulacao = useVendasSimulacoesStore((state) => state.initialize)
  const updateVendasSimulacao = useVendasSimulacoesStore((state) => state.update)
  const renameVendasSimulacao = useVendasSimulacoesStore((state) => state.rename)

  const capexBaseManualValorRaw = vendasSimulacao?.capexBaseManual
  const capexBaseManualValor =
    typeof capexBaseManualValorRaw === 'number' && Number.isFinite(capexBaseManualValorRaw)
      ? Math.max(0, capexBaseManualValorRaw)
      : undefined

  useEffect(() => {
    setAprovadoresText(vendasConfig.aprovadores.join('\n'))
  }, [vendasConfig.aprovadores])

  useEffect(() => {
    setImpostosOverridesDraft(cloneImpostosOverrides(vendasConfig.impostosRegime_overrides))
  }, [vendasConfig.impostosRegime_overrides])

  useEffect(() => {
    initializeVendasSimulacao(currentBudgetId)
  }, [currentBudgetId, initializeVendasSimulacao])

  const margemManualValorRaw = vendasSimulacao?.margemManualValor
  const margemManualAtiva =
    typeof margemManualValorRaw === 'number' && Number.isFinite(margemManualValorRaw)
  const margemManualValor = margemManualAtiva ? Number(margemManualValorRaw) : undefined
  const descontosValor = Math.max(0, vendasSimulacao?.descontos ?? 0)
  const arredondarPasso = useMemo(() => {
    const raw = Number(vendasConfig.arredondar_venda_para)
    return raw === 1 || raw === 10 || raw === 50 || raw === 100 ? (raw as 1 | 10 | 50 | 100) : 100
  }, [vendasConfig.arredondar_venda_para])
  const aprovadoresResumo = useMemo(() => {
    if (!Array.isArray(vendasConfig.aprovadores) || vendasConfig.aprovadores.length === 0) {
      return ''
    }
    return vendasConfig.aprovadores.join(', ')
  }, [vendasConfig.aprovadores])
  const valorOrcamentoConsiderado = useMemo(() => {
    const total = kitBudget.total
    return typeof total === 'number' && Number.isFinite(total) ? total : 0
  }, [kitBudget.total])
  const [multiUcAtivo, setMultiUcAtivo] = useState(INITIAL_VALUES.multiUcAtivo)
  const [multiUcRows, setMultiUcRows] = useState<MultiUcRowState[]>(() =>
    INITIAL_VALUES.multiUcUcs.map((uc, index) => ({
      ...uc,
      id: uc.id || `UC-${index + 1}`,
    })),
  )
  const [multiUcRateioModo, setMultiUcRateioModo] = useState<MultiUcRateioModo>(
    INITIAL_VALUES.multiUcRateioModo,
  )
  const [multiUcEnergiaGeradaKWh, setMultiUcEnergiaGeradaKWhState] = useState(
    INITIAL_VALUES.multiUcEnergiaGeradaKWh,
  )
  const [multiUcEnergiaGeradaTouched, setMultiUcEnergiaGeradaTouched] = useState(false)
  const [multiUcAnoVigencia, setMultiUcAnoVigencia] = useState(INITIAL_VALUES.multiUcAnoVigencia)
  const [multiUcOverrideEscalonamento, setMultiUcOverrideEscalonamento] = useState(
    INITIAL_VALUES.multiUcOverrideEscalonamento,
  )
  const [multiUcEscalonamentoCustomPercent, setMultiUcEscalonamentoCustomPercent] = useState<
    number | null
  >(INITIAL_VALUES.multiUcEscalonamentoCustomPercent)
  const multiUcEscalonamentoPadrao = INITIAL_VALUES.multiUcEscalonamentoPadrao
  const multiUcReferenciaData = useMemo(
    () => new Date(Math.max(0, multiUcAnoVigencia), 0, 1),
    [multiUcAnoVigencia],
  )
  const multiUcConsumoTotal = useMemo(
    () => multiUcRows.reduce((acc, row) => acc + Math.max(0, row.consumoKWh), 0),
    [multiUcRows],
  )
  const multiUcRateioPercentualTotal = useMemo(
    () => multiUcRows.reduce((acc, row) => acc + Math.max(0, row.rateioPercentual || 0), 0),
    [multiUcRows],
  )
  const multiUcRateioManualTotal = useMemo(
    () => multiUcRows.reduce((acc, row) => acc + Math.max(0, row.manualRateioKWh ?? 0), 0),
    [multiUcRows],
  )
  const multiUcEscalonamentoPercentual = useMemo(() => {
    if (multiUcOverrideEscalonamento && multiUcEscalonamentoCustomPercent != null) {
      return Math.max(0, multiUcEscalonamentoCustomPercent) / 100
    }
    const padrao = multiUcEscalonamentoPadrao[multiUcAnoVigencia] ?? 0
    return Math.max(0, padrao) / 100
  }, [
    multiUcAnoVigencia,
    multiUcEscalonamentoPadrao,
    multiUcOverrideEscalonamento,
    multiUcEscalonamentoCustomPercent,
  ])
  const multiUcEscalonamentoTabela = useMemo(
    () =>
      Object.entries(multiUcEscalonamentoPadrao)
        .map(([ano, valor]) => ({ ano: Number(ano), valor }))
        .sort((a, b) => a.ano - b.ano),
    [multiUcEscalonamentoPadrao],
  )
  const multiUcResultado = useMemo<MultiUcCalculoResultado | null>(() => {
    if (!multiUcAtivo) {
      return null
    }
    return calcularMultiUc({
      energiaGeradaTotalKWh: multiUcEnergiaGeradaKWh,
      distribuicaoPorPercentual: multiUcRateioModo === 'percentual',
      ucs: multiUcRows.map((row) => ({
        id: row.id,
        classe: row.classe,
        consumoKWh: row.consumoKWh,
        rateioPercentual: row.rateioPercentual,
        manualRateioKWh: row.manualRateioKWh,
        tarifas: {
          TE: row.te,
          TUSD_total: row.tusdTotal,
          TUSD_FioB: row.tusdFioB,
        },
        observacoes: row.observacoes,
      })),
      parametrosMLGD: {
        anoVigencia: multiUcAnoVigencia,
        escalonamentoPadrao: multiUcEscalonamentoPadrao,
        overrideEscalonamento: multiUcOverrideEscalonamento,
        escalonamentoCustomPercent: multiUcEscalonamentoCustomPercent,
      },
    })
  }, [
    multiUcAtivo,
    multiUcRows,
    multiUcEnergiaGeradaKWh,
    multiUcRateioModo,
    multiUcAnoVigencia,
    multiUcEscalonamentoPadrao,
    multiUcOverrideEscalonamento,
    multiUcEscalonamentoCustomPercent,
  ])
  const multiUcResultadoPorId = useMemo(() => {
    const map = new Map<string, MultiUcCalculoUcResultado>()
    if (multiUcResultado) {
      multiUcResultado.ucs.forEach((uc) => {
        map.set(uc.id, uc)
      })
    }
    return map
  }, [multiUcResultado])
  const multiUcWarnings = multiUcResultado?.warnings ?? []
  const multiUcErrors = multiUcResultado?.errors ?? []
  const multiUcPrintableResumo = useMemo<PrintableMultiUcResumo | null>(() => {
    if (!multiUcAtivo || !multiUcResultado || multiUcErrors.length > 0) {
      return null
    }
    return {
      energiaGeradaTotalKWh: multiUcResultado.energiaGeradaTotalKWh,
      energiaGeradaUtilizadaKWh: multiUcResultado.energiaGeradaUtilizadaKWh,
      sobraCreditosKWh: multiUcResultado.sobraCreditosKWh,
      escalonamentoPercentual: multiUcResultado.escalonamentoPercentual,
      totalTusd: multiUcResultado.totalTusd,
      totalTe: multiUcResultado.totalTe,
      totalContrato: multiUcResultado.totalContrato,
      distribuicaoPorPercentual: multiUcRateioModo === 'percentual',
      anoVigencia: multiUcAnoVigencia,
      ucs: multiUcResultado.ucs.map((uc) => ({
        id: uc.id,
        classe: uc.classe,
        consumoKWh: uc.consumoKWh,
        rateioPercentual: uc.rateioPercentual,
        manualRateioKWh: uc.manualRateioKWh ?? null,
        creditosKWh: uc.creditosKWh,
        kWhFaturados: uc.kWhFaturados,
        kWhCompensados: uc.kWhCompensados,
        te: uc.tarifas.TE,
        tusdTotal: uc.tarifas.TUSD_total,
        tusdFioB: uc.tarifas.TUSD_FioB,
        tusdOutros: uc.tusdOutros,
        tusdMensal: uc.tusdMensal,
        teMensal: uc.teMensal,
        totalMensal: uc.totalMensal,
        observacoes: uc.observacoes ?? null,
      })),
    }
  }, [
    multiUcAtivo,
    multiUcResultado,
    multiUcErrors,
    multiUcRateioModo,
    multiUcAnoVigencia,
  ])
  const multiUcConsumoAnteriorRef = useRef<number | null>(null)
  const multiUcIdCounterRef = useRef<number>(multiUcRows.length + 1)
  const consumoAnteriorRef = useRef(kcKwhMes)

  type PageSharedSettings = {
    kcKwhMes: number
    tarifaCheia: number
    taxaMinima: number
    ufTarifa: string
    distribuidoraTarifa: string
    potenciaModulo: number
    numeroModulosManual: number | ''
    segmentoCliente: SegmentoCliente
    tipoInstalacao: TipoInstalacao
    tipoSistema: TipoSistema
    consumoManual: boolean
    potenciaModuloDirty: boolean
    tipoInstalacaoDirty: boolean
  }

  const createPageSharedSettings = useCallback((): PageSharedSettings => ({
    kcKwhMes: INITIAL_VALUES.kcKwhMes,
    tarifaCheia: INITIAL_VALUES.tarifaCheia,
    taxaMinima: INITIAL_VALUES.taxaMinima,
    ufTarifa: INITIAL_VALUES.ufTarifa,
    distribuidoraTarifa: INITIAL_VALUES.distribuidoraTarifa,
    potenciaModulo: INITIAL_VALUES.potenciaModulo,
    numeroModulosManual: INITIAL_VALUES.numeroModulosManual,
    segmentoCliente: INITIAL_VALUES.segmentoCliente,
    tipoInstalacao: INITIAL_VALUES.tipoInstalacao,
    tipoSistema: INITIAL_VALUES.tipoSistema,
    consumoManual: false,
    potenciaModuloDirty: false,
    tipoInstalacaoDirty: false,
  }), [])

  const [pageSharedState, setPageSharedState] = useState<PageSharedSettings>(() =>
    createPageSharedSettings(),
  )

  const updatePageSharedState = useCallback(
    (updater: (current: PageSharedSettings) => PageSharedSettings) => {
      setPageSharedState((prev) => {
        const next = updater(prev)
        if (next === prev) {
          return prev
        }
        return next
      })
    },
    [],
  )

  const setConsumoManual = useCallback(
    (value: boolean) => {
      setConsumoManualState(value)
      updatePageSharedState((current) => {
        if (current.consumoManual === value) {
          return current
        }
        return { ...current, consumoManual: value }
      })
    },
    [updatePageSharedState],
  )

  const setKcKwhMes = useCallback(
    (value: number, origin: 'auto' | 'user' = 'auto') => {
      const normalized = Number.isFinite(value) ? Math.max(0, value) : 0
      setConsumoManual(origin === 'user')
      setKcKwhMesState(normalized)
      updatePageSharedState((current) => {
        if (current.kcKwhMes === normalized) {
          return current
        }
        return { ...current, kcKwhMes: normalized }
      })
      return normalized
    },
    [setConsumoManual, setKcKwhMesState, updatePageSharedState],
  )

  const setMultiUcEnergiaGeradaKWh = useCallback(
    (value: number, origin: 'auto' | 'user' = 'auto') => {
      const normalized = Number.isFinite(value) ? Math.max(0, value) : 0
      if (origin === 'user') {
        setMultiUcEnergiaGeradaTouched(true)
      }
      setMultiUcEnergiaGeradaKWhState((prev) => (prev === normalized ? prev : normalized))
      return normalized
    },
    [],
  )

  const setTarifaCheia = useCallback(
    (valueOrUpdater: number | ((prev: number) => number)) => {
      const nextRaw = resolveStateUpdate(valueOrUpdater, tarifaCheia)
      const normalized = Number.isFinite(nextRaw) ? Math.max(0, nextRaw) : 0
      setTarifaCheiaState(normalized)
      updatePageSharedState((current) => {
        if (current.tarifaCheia === normalized) {
          return current
        }
        return { ...current, tarifaCheia: normalized }
      })
    },
    [tarifaCheia, updatePageSharedState],
  )

  const setTaxaMinima = useCallback(
    (valueOrUpdater: number | ((prev: number) => number)) => {
      const nextRaw = resolveStateUpdate(valueOrUpdater, taxaMinima)
      const normalized = Number.isFinite(nextRaw) ? Math.max(0, nextRaw) : 0
      setTaxaMinimaState(normalized)
      setTaxaMinimaInputEmpty((prev) => (normalized === 0 ? prev : false))
      updatePageSharedState((current) => {
        if (current.taxaMinima === normalized) {
          return current
        }
        return { ...current, taxaMinima: normalized }
      })
    },
    [setTaxaMinimaInputEmpty, taxaMinima, updatePageSharedState],
  )

  const normalizeTaxaMinimaInputValue = useCallback(
    (rawValue: string) => {
      if (rawValue === '') {
        setTaxaMinimaInputEmpty(true)
        setTaxaMinima(0)
        return 0
      }

      const parsed = Number(rawValue)
      const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
      setTaxaMinimaInputEmpty(false)
      setTaxaMinima(normalized)
      return normalized
    },
    [setTaxaMinima, setTaxaMinimaInputEmpty],
  )

  const setUfTarifa = useCallback(
    (valueOrUpdater: string | ((prev: string) => string)) => {
      const nextValue = resolveStateUpdate(valueOrUpdater, ufTarifa)
      setUfTarifaState(nextValue)
      updatePageSharedState((current) => {
        if (current.ufTarifa === nextValue) {
          return current
        }
        return { ...current, ufTarifa: nextValue }
      })
    },
    [ufTarifa, updatePageSharedState],
  )

  const setDistribuidoraTarifa = useCallback(
    (valueOrUpdater: string | ((prev: string) => string)) => {
      const nextValue = resolveStateUpdate(valueOrUpdater, distribuidoraTarifa)
      setDistribuidoraTarifaState(nextValue)
      updatePageSharedState((current) => {
        if (current.distribuidoraTarifa === nextValue) {
          return current
        }
        return { ...current, distribuidoraTarifa: nextValue }
      })
    },
    [distribuidoraTarifa, updatePageSharedState],
  )

  const applyTarifasAutomaticas = useCallback(
    (row: MultiUcRowState, classe?: MultiUcClasse, force = false): MultiUcRowState => {
      const classeFinal = classe ?? row.classe
      const distribuidoraReferencia =
        distribuidoraTarifa && distribuidoraTarifa.trim() ? distribuidoraTarifa : 'DEFAULT'
      const sugestao = buscarTarifaPorClasse(distribuidoraReferencia, classeFinal, multiUcReferenciaData)

      let next = row
      if (classeFinal !== row.classe) {
        next = { ...next, classe: classeFinal }
      }

      if (sugestao) {
        if (force || row.teFonte === 'auto') {
          next = { ...next, te: sugestao.TE, teFonte: 'auto' }
        }
        if (force || row.tusdTotalFonte === 'auto') {
          next = { ...next, tusdTotal: sugestao.TUSD_total, tusdTotalFonte: 'auto' }
        }
        if (force || row.tusdFioBFonte === 'auto') {
          next = { ...next, tusdFioB: sugestao.TUSD_FioB, tusdFioBFonte: 'auto' }
        }
      }

      return next
    },
    [distribuidoraTarifa, multiUcReferenciaData],
  )

  const updateMultiUcRow = useCallback(
    (id: string, updater: (prev: MultiUcRowState) => MultiUcRowState) => {
      setMultiUcRows((prev) => {
        let changed = false
        const next = prev.map((row) => {
          if (row.id !== id) {
            return row
          }
          const updated = updater(row)
          if (updated !== row) {
            changed = true
          }
          return updated
        })
        return changed ? next : prev
      })
    },
    [],
  )

  const handleMultiUcClasseChange = useCallback(
    (id: string, classe: MultiUcClasse) => {
      updateMultiUcRow(id, (row) =>
        applyTarifasAutomaticas(
          {
            ...row,
            teFonte: 'auto',
            tusdTotalFonte: 'auto',
            tusdFioBFonte: 'auto',
          },
          classe,
          true,
        ),
      )
    },
    [applyTarifasAutomaticas, updateMultiUcRow],
  )

  const handleMultiUcConsumoChange = useCallback(
    (id: string, valor: number) => {
      const normalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateMultiUcRow(id, (row) => ({ ...row, consumoKWh: normalizado }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcRateioPercentualChange = useCallback(
    (id: string, valor: number) => {
      const normalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateMultiUcRow(id, (row) => ({ ...row, rateioPercentual: normalizado }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcManualRateioChange = useCallback(
    (id: string, valor: number) => {
      const normalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateMultiUcRow(id, (row) => ({ ...row, manualRateioKWh: normalizado }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcTeChange = useCallback(
    (id: string, valor: number) => {
      const normalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateMultiUcRow(id, (row) => ({ ...row, te: normalizado, teFonte: 'manual' }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcTusdTotalChange = useCallback(
    (id: string, valor: number) => {
      const normalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateMultiUcRow(id, (row) => ({ ...row, tusdTotal: normalizado, tusdTotalFonte: 'manual' }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcTusdFioBChange = useCallback(
    (id: string, valor: number) => {
      const normalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateMultiUcRow(id, (row) => ({ ...row, tusdFioB: normalizado, tusdFioBFonte: 'manual' }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcObservacoesChange = useCallback(
    (id: string, valor: string) => {
      updateMultiUcRow(id, (row) => ({ ...row, observacoes: valor }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcAdicionar = useCallback(() => {
    const novoId = multiUcIdCounterRef.current
    multiUcIdCounterRef.current += 1
    setMultiUcRows((prev) => {
      const novo = applyTarifasAutomaticas(createDefaultMultiUcRow(novoId), undefined, true)
      return [...prev, novo]
    })
  }, [applyTarifasAutomaticas])

  const handleMultiUcRemover = useCallback((id: string) => {
    setMultiUcRows((prev) => {
      if (prev.length <= 1) {
        return prev
      }
      const filtrado = prev.filter((row) => row.id !== id)
      return filtrado.length > 0 ? filtrado : prev
    })
  }, [])

  const handleMultiUcQuantidadeChange = useCallback(
    (valor: number) => {
      const alvo = Number.isFinite(valor) ? Math.max(1, Math.round(valor)) : 1
      setMultiUcRows((prev) => {
        if (alvo === prev.length) {
          return prev
        }
        if (alvo < prev.length) {
          return prev.slice(0, alvo)
        }
        const adicionais: MultiUcRowState[] = []
        const faltantes = alvo - prev.length
        for (let index = 0; index < faltantes; index += 1) {
          const novoId = multiUcIdCounterRef.current
          multiUcIdCounterRef.current += 1
          adicionais.push(applyTarifasAutomaticas(createDefaultMultiUcRow(novoId), undefined, true))
        }
        return [...prev, ...adicionais]
      })
    },
    [applyTarifasAutomaticas],
  )

  const handleMultiUcRecarregarTarifas = useCallback(() => {
    setMultiUcRows((prev) =>
      prev.map((row) =>
        applyTarifasAutomaticas(
          {
            ...row,
            teFonte: 'auto',
            tusdTotalFonte: 'auto',
            tusdFioBFonte: 'auto',
          },
          row.classe,
          true,
        ),
      ),
    )
  }, [applyTarifasAutomaticas])

  const handleMultiUcRateioModoChange = useCallback(
    (modo: MultiUcRateioModo) => {
      setMultiUcRateioModo(modo)
      if (modo === 'manual') {
        setMultiUcRows((prev) =>
          prev.map((row) => {
            if (row.manualRateioKWh != null) {
              return row
            }
            const calculado = multiUcEnergiaGeradaKWh > 0
              ? multiUcEnergiaGeradaKWh * (row.rateioPercentual / 100)
              : 0
            return { ...row, manualRateioKWh: Math.max(0, calculado) }
          }),
        )
      }
    },
    [multiUcEnergiaGeradaKWh],
  )

  const setPotenciaModulo = useCallback(
    (valueOrUpdater: number | ((prev: number) => number)) => {
      const nextRaw = resolveStateUpdate(valueOrUpdater, potenciaModulo)
      const normalized = Number.isFinite(nextRaw) ? nextRaw : INITIAL_VALUES.potenciaModulo
      setPotenciaModuloState(normalized)
      updatePageSharedState((current) => {
        if (current.potenciaModulo === normalized) {
          return current
        }
        return { ...current, potenciaModulo: normalized }
      })
    },
    [potenciaModulo, updatePageSharedState],
  )

  const setPotenciaModuloDirty = useCallback(
    (value: boolean) => {
      setPotenciaModuloDirtyState(value)
      updatePageSharedState((current) => {
        if (current.potenciaModuloDirty === value) {
          return current
        }
        return { ...current, potenciaModuloDirty: value }
      })
    },
    [updatePageSharedState],
  )

  const setTipoInstalacao = useCallback(
    (value: TipoInstalacao) => {
      setTipoInstalacaoState(value)
      updatePageSharedState((current) => {
        if (current.tipoInstalacao === value) {
          return current
        }
        return { ...current, tipoInstalacao: value }
      })
    },
    [updatePageSharedState],
  )

  const setTipoSistema = useCallback(
    (valueOrUpdater: TipoSistema | ((prev: TipoSistema) => TipoSistema)) => {
      const nextValue = resolveStateUpdate(valueOrUpdater, tipoSistema)
      const normalized = normalizeTipoSistemaValue(nextValue) ?? tipoSistema
      setTipoSistemaState(normalized)
      updatePageSharedState((current) => {
        if (current.tipoSistema === normalized) {
          return current
        }
        return { ...current, tipoSistema: normalized }
      })
    },
    [tipoSistema, updatePageSharedState],
  )

  const setTipoInstalacaoDirty = useCallback(
    (value: boolean) => {
      setTipoInstalacaoDirtyState(value)
      updatePageSharedState((current) => {
        if (current.tipoInstalacaoDirty === value) {
          return current
        }
        return { ...current, tipoInstalacaoDirty: value }
      })
    },
    [updatePageSharedState],
  )

  const setSegmentoCliente = useCallback(
    (valueOrUpdater: SegmentoCliente | ((prev: SegmentoCliente) => SegmentoCliente)) => {
      const nextValue = resolveStateUpdate(valueOrUpdater, segmentoCliente)
      setSegmentoClienteState(nextValue)
      updatePageSharedState((current) => {
        if (current.segmentoCliente === nextValue) {
          return current
        }
        return { ...current, segmentoCliente: nextValue }
      })
    },
    [segmentoCliente, updatePageSharedState],
  )

  const setNumeroModulosManual = useCallback(
    (valueOrUpdater: number | '' | ((prev: number | '') => number | '')) => {
      const nextValue = resolveStateUpdate(valueOrUpdater, numeroModulosManual)
      setNumeroModulosManualState(nextValue)
      updatePageSharedState((current) => {
        if (current.numeroModulosManual === nextValue) {
          return current
        }
        return { ...current, numeroModulosManual: nextValue }
      })
    },
    [numeroModulosManual, updatePageSharedState],
  )

  useEffect(() => {
    const snapshot = pageSharedState

    setKcKwhMesState((prev) => (prev === snapshot.kcKwhMes ? prev : snapshot.kcKwhMes))
    setTarifaCheiaState((prev) => (prev === snapshot.tarifaCheia ? prev : snapshot.tarifaCheia))
    setTaxaMinimaState((prev) => (prev === snapshot.taxaMinima ? prev : snapshot.taxaMinima))
    setTaxaMinimaInputEmpty((prev) => (snapshot.taxaMinima > 0 ? false : prev))
    setUfTarifaState((prev) => (prev === snapshot.ufTarifa ? prev : snapshot.ufTarifa))
    setDistribuidoraTarifaState((prev) =>
      prev === snapshot.distribuidoraTarifa ? prev : snapshot.distribuidoraTarifa,
    )
    setPotenciaModuloState((prev) => (prev === snapshot.potenciaModulo ? prev : snapshot.potenciaModulo))
    setNumeroModulosManualState((prev) =>
      prev === snapshot.numeroModulosManual ? prev : snapshot.numeroModulosManual,
    )
    setSegmentoClienteState((prev) => (prev === snapshot.segmentoCliente ? prev : snapshot.segmentoCliente))
    setTipoInstalacaoState((prev) => (prev === snapshot.tipoInstalacao ? prev : snapshot.tipoInstalacao))
    setTipoSistemaState((prev) => {
      const normalized = normalizeTipoSistemaValue(snapshot.tipoSistema) ?? prev
      return prev === normalized ? prev : normalized
    })
    setConsumoManualState((prev) => (prev === snapshot.consumoManual ? prev : snapshot.consumoManual))
    setPotenciaModuloDirtyState((prev) =>
      prev === snapshot.potenciaModuloDirty ? prev : snapshot.potenciaModuloDirty,
    )
    setTipoInstalacaoDirtyState((prev) =>
      prev === snapshot.tipoInstalacaoDirty ? prev : snapshot.tipoInstalacaoDirty,
    )
  }, [activeTab, pageSharedState])

  const [cliente, setCliente] = useState<ClienteDados>({ ...CLIENTE_INICIAL })
  const [clientesSalvos, setClientesSalvos] = useState<ClienteRegistro[]>([])
  const [clienteEmEdicaoId, setClienteEmEdicaoId] = useState<string | null>(null)
  const [isClientesModalOpen, setIsClientesModalOpen] = useState(false)
  const [clienteMensagens, setClienteMensagens] = useState<ClienteMensagens>({})
  const clienteIndicacaoCheckboxId = useId()
  const clienteIndicacaoNomeId = useId()

  useEffect(() => {
    vendaActions.updateCliente({
      nome: cliente.nome ?? '',
      documento: cliente.documento ?? '',
      email: cliente.email ?? '',
      telefone: cliente.telefone ?? '',
      cidade: cliente.cidade ?? '',
      uf: cliente.uf ?? '',
      endereco: cliente.endereco ?? '',
      uc: cliente.uc ?? '',
      distribuidora: cliente.distribuidora ?? '',
      temIndicacao: cliente.temIndicacao ?? false,
      indicacaoNome: cliente.indicacaoNome ?? '',
    })
  }, [cliente])
  const [verificandoCidade, setVerificandoCidade] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const notificacaoSequencialRef = useRef(0)
  const notificacaoTimeoutsRef = useRef<Record<number, number>>({})

  const [crmIntegrationMode, setCrmIntegrationMode] = useState<CrmIntegrationMode>('local')
  const crmIntegrationModeRef = useRef<CrmIntegrationMode>(crmIntegrationMode)
  const [crmIsSaving, setCrmIsSaving] = useState(false)
  const [crmBackendStatus, setCrmBackendStatus] = useState<CrmBackendStatus>('idle')
  const [crmBackendError, setCrmBackendError] = useState<string | null>(null)
  const [crmLastSync, setCrmLastSync] = useState<Date | null>(null)
  const [crmBusca, setCrmBusca] = useState('')
  const [crmFiltroOperacao, setCrmFiltroOperacao] = useState<CrmFiltroOperacao>('all')
  const [crmLeadSelecionadoId, setCrmLeadSelecionadoId] = useState<string | null>(null)
  const [crmLeadForm, setCrmLeadForm] = useState<CrmLeadFormState>({ ...CRM_EMPTY_LEAD_FORM })
  const [crmNotaTexto, setCrmNotaTexto] = useState('')
  const [crmDataset, setCrmDataset] = useState<CrmDataset>(() => carregarDatasetCrm())
  const [crmLancamentoForm, setCrmLancamentoForm] = useState({
    dataIso: new Date().toISOString().slice(0, 10),
    categoria: 'Receita' as CrmLancamentoCaixa['categoria'],
    origem: 'Leasing',
    formaPagamento: 'Pix' as CrmLancamentoCaixa['formaPagamento'],
    tipo: 'entrada' as CrmLancamentoCaixa['tipo'],
    valor: '',
    leadId: '' as string,
    observacao: '',
  })
  const [crmCustosForm, setCrmCustosForm] = useState({
    equipamentos: '',
    maoDeObra: '',
    deslocamento: '',
    taxasSeguros: '',
  })
  const [crmContratoForm, setCrmContratoForm] = useState({
    leadId: '' as string,
    modelo: 'LEASING' as 'LEASING' | 'VENDA_DIRETA',
    valorTotal: '',
    entrada: '',
    parcelas: '36',
    valorParcela: '',
    reajusteAnualPct: '3',
    vencimentoInicialIso: new Date().toISOString().slice(0, 10),
    status: 'em-aberto' as CrmFinanceiroStatus,
  })
  const [crmManutencaoForm, setCrmManutencaoForm] = useState({
    leadId: '' as string,
    dataIso: new Date().toISOString().slice(0, 10),
    tipo: 'Revisão preventiva',
    observacao: '',
  })
  const [capexManualOverride, setCapexManualOverride] = useState(
    INITIAL_VALUES.capexManualOverride,
  )
  const [parsedVendaPdf, setParsedVendaPdf] = useState<ParsedVendaPdfData | null>(null)
  const [estruturaTipoWarning, setEstruturaTipoWarning] =
    useState<EstruturaUtilizadaTipoWarning | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.activePage, activePage)
  }, [activePage])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.activeTab, activeTab)
  }, [activeTab])

  const budgetItemsTotal = useMemo(
    () => computeBudgetItemsTotalValue(kitBudget.items),
    [kitBudget.items],
  )

  const budgetMissingSummary = useMemo(() => {
    const info = kitBudget.missingInfo
    if (!info || kitBudget.items.length === 0) {
      return null
    }
    const fieldSet = new Set<string>()
    info.modules.missingFields.forEach((field) => fieldSet.add(field))
    info.inverter.missingFields.forEach((field) => fieldSet.add(field))
    if (fieldSet.size === 0) {
      return null
    }
    const fieldsText = formatList(Array.from(fieldSet))
    return { info, fieldsText }
  }, [kitBudget.items.length, kitBudget.missingInfo])

  useEffect(() => {
    if (kitBudget.totalSource !== 'calculated') {
      return
    }
    const nextTotal = budgetItemsTotal
    const formatted = formatCurrencyInputValue(nextTotal)
    if (numbersAreClose(nextTotal, kitBudget.total) && formatted === kitBudget.totalInput) {
      return
    }
    setKitBudget((prev) => ({
      ...prev,
      total: nextTotal,
      totalInput: formatted,
    }))
  }, [budgetItemsTotal, kitBudget.totalSource, kitBudget.total, kitBudget.totalInput])

  const updateKitBudgetItem = useCallback(
    (itemId: string, updater: (item: KitBudgetItemState) => KitBudgetItemState) => {
      setKitBudget((prev) => {
        const nextItems = prev.items.map((item) => (item.id === itemId ? updater(item) : item))
        return {
          ...prev,
          items: nextItems,
          missingInfo: computeBudgetMissingInfo(nextItems),
        }
      })
    },
    [],
  )

  const handleBudgetItemTextChange = useCallback(
    (itemId: string, field: 'productName' | 'description', value: string) => {
      updateKitBudgetItem(itemId, (item) => ({ ...item, [field]: value }))
    },
    [updateKitBudgetItem],
  )

  const handleBudgetItemQuantityChange = useCallback(
    (itemId: string, value: string) => {
      const parsed = parseNumericInput(value)
      const isValidQuantity = typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
      updateKitBudgetItem(itemId, (item) => ({
        ...item,
        quantity: isValidQuantity ? Math.round(parsed as number) : null,
        quantityInput: value,
        wasQuantityInferred: !isValidQuantity,
      }))
    },
    [updateKitBudgetItem],
  )

  const handleRemoveBudgetItem = useCallback((itemId: string) => {
    setKitBudget((prev) => {
      const nextItems = prev.items.filter((item) => item.id !== itemId)
      return {
        ...prev,
        items: nextItems,
        missingInfo: computeBudgetMissingInfo(nextItems),
      }
    })
  }, [])

  const handleAddBudgetItem = useCallback(() => {
    const baseId = Date.now().toString(36)
    setKitBudget((prev) => {
      const nextItems = [
        ...prev.items,
        {
          id: `manual-${baseId}-${prev.items.length + 1}`,
          productName: '',
          description: '',
          quantity: null,
          quantityInput: '',
          unitPrice: null,
          unitPriceInput: '',
          wasQuantityInferred: true,
        },
      ]
      return {
        ...prev,
        items: nextItems,
        missingInfo: computeBudgetMissingInfo(nextItems),
      }
    })
  }, [])

  const handleBudgetTotalChange = useCallback(
    (value: string) => {
      setKitBudget((prev) => {
        const trimmed = value.trim()
        if (!trimmed) {
          if (budgetItemsTotal !== null) {
            const formattedCalculated = formatCurrencyInputValue(budgetItemsTotal)
            if (
              prev.totalSource === 'calculated' &&
              numbersAreClose(prev.total, budgetItemsTotal) &&
              prev.totalInput === formattedCalculated
            ) {
              return prev
            }
            return {
              ...prev,
              totalInput: formattedCalculated,
              total: budgetItemsTotal,
              totalSource: 'calculated',
            }
          }
          const formattedZero = formatCurrencyInputValue(0)
          if (prev.totalSource === null && numbersAreClose(prev.total, 0) && prev.totalInput === formattedZero) {
            return prev
          }
          return {
            ...prev,
            totalInput: formattedZero,
            total: 0,
            totalSource: null,
          }
        }
        const parsed = normalizeCurrencyNumber(parseNumericInput(trimmed))
        if (parsed === null) {
          const formattedZero = formatCurrencyInputValue(0)
          if (prev.totalSource === null && numbersAreClose(prev.total, 0) && prev.totalInput === formattedZero) {
            return prev
          }
          return {
            ...prev,
            totalInput: formattedZero,
            total: 0,
            totalSource: null,
          }
        }
        const formatted = formatCurrencyInputValue(parsed)
        if (
          prev.totalSource === 'explicit' &&
          numbersAreClose(prev.total, parsed) &&
          prev.totalInput === formatted
        ) {
          return prev
        }
        return {
          ...prev,
          totalInput: formatted,
          total: parsed,
          totalSource: 'explicit',
        }
      })
    },
    [budgetItemsTotal],
  )

  const handleComposicaoTelhadoChange = useCallback(
    (campo: keyof UfvComposicaoTelhadoValores, valor: string) => {
      const parsed = parseNumericInput(valor)
      const normalizado = normalizeCurrencyNumber(parsed)
      const finalValue = normalizado === null ? 0 : normalizado
      setComposicaoTelhado((prev) => {
        if (prev[campo] === finalValue) {
          return prev
        }
        return { ...prev, [campo]: finalValue }
      })
      if (campo === 'lucroBruto') {
        updateVendasSimulacao(currentBudgetId, { margemManualValor: finalValue })
      }
    },
    [currentBudgetId, updateVendasSimulacao],
  )

  const handleComposicaoSoloChange = useCallback(
    (campo: keyof UfvComposicaoSoloValores, valor: string) => {
      const parsed = parseNumericInput(valor)
      const normalizado = normalizeCurrencyNumber(parsed)
      const finalValue = normalizado === null ? 0 : normalizado
      setComposicaoSolo((prev) => {
        if (prev[campo] === finalValue) {
          return prev
        }
        return { ...prev, [campo]: finalValue }
      })
      if (campo === 'lucroBruto') {
        updateVendasSimulacao(currentBudgetId, { margemManualValor: finalValue })
      }
    },
    [currentBudgetId, updateVendasSimulacao],
  )

  const handleMargemManualInput = useCallback(
    (valor: number | null) => {
      if (valor === null || !Number.isFinite(valor)) {
        updateVendasSimulacao(currentBudgetId, { margemManualValor: null })
        return
      }
      const finalValue = normalizeCurrencyNumber(valor)
      if (finalValue === null) {
        updateVendasSimulacao(currentBudgetId, { margemManualValor: null })
        return
      }
      updateVendasSimulacao(currentBudgetId, { margemManualValor: finalValue })
      setComposicaoTelhado((prev) =>
        numbersAreClose(prev.lucroBruto, finalValue) ? prev : { ...prev, lucroBruto: finalValue },
      )
      setComposicaoSolo((prev) =>
        numbersAreClose(prev.lucroBruto, finalValue) ? prev : { ...prev, lucroBruto: finalValue },
      )
    },
    [currentBudgetId, updateVendasSimulacao],
  )


  const handleDescontosConfigChange = useCallback(
    (valor: number | null) => {
      const sanitized =
        typeof valor === 'number' && Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateVendasSimulacao(currentBudgetId, { descontos: sanitized })
    },
    [currentBudgetId, updateVendasSimulacao],
  )

  const descontosMoneyField = useBRNumberField({
    mode: 'money',
    value: Number.isFinite(descontosValor) ? Number(descontosValor) : null,
    onChange: handleDescontosConfigChange,
  })

  const handleCapexBaseResumoChange = useCallback(
    (valor: number | null) => {
      if (valor === null) {
        updateVendasSimulacao(currentBudgetId, { capexBaseManual: null })
        return
      }
      const sanitized = Number.isFinite(valor) ? Math.max(0, Number(valor)) : 0
      updateVendasSimulacao(currentBudgetId, { capexBaseManual: sanitized })
    },
    [currentBudgetId, updateVendasSimulacao],
  )

  const validateVendaForm = useCallback((form: VendaForm) => {
    const errors: Record<string, string> = {}

    if (!Number.isFinite(form.consumo_kwh_mes) || form.consumo_kwh_mes <= 0) {
      errors.consumo_kwh_mes = 'Informe o consumo mensal em kWh.'
    }
    if (!Number.isFinite(form.tarifa_cheia_r_kwh) || form.tarifa_cheia_r_kwh <= 0) {
      errors.tarifa_cheia_r_kwh = 'Informe a tarifa cheia válida.'
    }
    if (!Number.isFinite(form.taxa_minima_mensal) || form.taxa_minima_mensal < 0) {
      errors.taxa_minima_mensal = 'A taxa mínima deve ser zero ou positiva.'
    }
    if (!Number.isFinite(form.horizonte_meses) || form.horizonte_meses <= 0) {
      errors.horizonte_meses = 'Informe o horizonte em meses.'
    }
    if (!Number.isFinite(form.capex_total) || form.capex_total <= 0) {
      errors.capex_total = 'Informe o valor total da proposta.'
    }

    const condicao = form.condicao
    if (!condicao) {
      errors.condicao = 'Selecione a condição de pagamento.'
    }

    const ensurePercent = (value: number | undefined, field: keyof VendaForm) => {
      if (value === undefined || value === null) {
        return
      }
      if (!Number.isFinite(value) || value < 0) {
        errors[field as string] = 'Use valores maiores ou iguais a zero.'
        return
      }
      if (value > 100) {
        errors[field as string] = 'Use valores entre 0 e 100.'
      }
    }

    ensurePercent(form.taxa_mdr_pix_pct, 'taxa_mdr_pix_pct')
    ensurePercent(form.taxa_mdr_debito_pct, 'taxa_mdr_debito_pct')
    ensurePercent(form.taxa_mdr_credito_vista_pct, 'taxa_mdr_credito_vista_pct')
    ensurePercent(form.taxa_mdr_credito_parcelado_pct, 'taxa_mdr_credito_parcelado_pct')

    if (condicao === 'AVISTA') {
      if (!form.modo_pagamento) {
        errors.modo_pagamento = 'Selecione o modo de pagamento.'
      }
    } else if (condicao === 'PARCELADO') {
      const parcelas = Number.isFinite(form.n_parcelas) ? Number(form.n_parcelas) : 0
      if (!parcelas || parcelas <= 0) {
        errors.n_parcelas = 'Informe o número de parcelas.'
      }
      const jurosAm = Number.isFinite(form.juros_cartao_am_pct) ? Number(form.juros_cartao_am_pct) : null
      const jurosAa = Number.isFinite(form.juros_cartao_aa_pct) ? Number(form.juros_cartao_aa_pct) : null
      if ((jurosAm === null || jurosAm < 0) && (jurosAa === null || jurosAa < 0)) {
        errors.juros_cartao_am_pct = 'Informe os juros a.m. ou a.a.'
        errors.juros_cartao_aa_pct = 'Informe os juros a.m. ou a.a.'
      }
      if (jurosAm !== null && jurosAm < 0) {
        errors.juros_cartao_am_pct = 'Os juros devem ser zero ou positivos.'
      }
      if (jurosAa !== null && jurosAa < 0) {
        errors.juros_cartao_aa_pct = 'Os juros devem ser zero ou positivos.'
      }
    } else if (condicao === 'FINANCIAMENTO') {
      const parcelasFin = Number.isFinite(form.n_parcelas_fin) ? Number(form.n_parcelas_fin) : 0
      if (!parcelasFin || parcelasFin <= 0) {
        errors.n_parcelas_fin = 'Informe as parcelas do financiamento.'
      }
      const jurosAm = Number.isFinite(form.juros_fin_am_pct) ? Number(form.juros_fin_am_pct) : null
      const jurosAa = Number.isFinite(form.juros_fin_aa_pct) ? Number(form.juros_fin_aa_pct) : null
      if ((jurosAm === null || jurosAm < 0) && (jurosAa === null || jurosAa < 0)) {
        errors.juros_fin_am_pct = 'Informe os juros a.m. ou a.a.'
        errors.juros_fin_aa_pct = 'Informe os juros a.m. ou a.a.'
      }
      if (jurosAm !== null && jurosAm < 0) {
        errors.juros_fin_am_pct = 'Os juros devem ser zero ou positivos.'
      }
      if (jurosAa !== null && jurosAa < 0) {
        errors.juros_fin_aa_pct = 'Os juros devem ser zero ou positivos.'
      }
      if (
        Number.isFinite(form.entrada_financiamento) &&
        (form.entrada_financiamento ?? 0) < 0
      ) {
        errors.entrada_financiamento = 'A entrada deve ser zero ou positiva.'
      }
    }

    if (
      Number.isFinite(form.taxa_desconto_aa_pct) &&
      (form.taxa_desconto_aa_pct ?? 0) < 0
    ) {
      errors.taxa_desconto_aa_pct = 'A taxa de desconto deve ser zero ou positiva.'
    }

    return errors
  }, [])

  const distribuidorasDisponiveis = useMemo(() => {
    if (!ufTarifa) return [] as string[]
    return distribuidorasPorUf[ufTarifa] ?? []
  }, [distribuidorasPorUf, ufTarifa])

  const clienteUf = cliente.uf
  const clienteDistribuidora = cliente.distribuidora
  const clienteDistribuidorasDisponiveis = useMemo(() => {
    if (!clienteUf) return [] as string[]
    return distribuidorasPorUf[clienteUf] ?? []
  }, [clienteUf, distribuidorasPorUf])

  const [precoPorKwp, setPrecoPorKwp] = useState(INITIAL_VALUES.precoPorKwp)
  const [irradiacao, setIrradiacao] = useState(IRRADIACAO_FALLBACK)
  const [eficiencia, setEficiencia] = useState(INITIAL_VALUES.eficiencia)
  const [diasMes, setDiasMes] = useState(INITIAL_VALUES.diasMes)
  const [inflacaoAa, setInflacaoAa] = useState(INITIAL_VALUES.inflacaoAa)

  const [vendaForm, setVendaForm] = useState<VendaForm>(() => createInitialVendaForm())
  const [vendaFormErrors, setVendaFormErrors] = useState<Record<string, string>>({})
  const [retornoProjetado, setRetornoProjetado] = useState<RetornoProjetado | null>(null)
  const [retornoStatus, setRetornoStatus] = useState<'idle' | 'calculating'>('idle')
  const [retornoError, setRetornoError] = useState<string | null>(null)
  const [recalcularTick, setRecalcularTick] = useState(0)
  const valorTotalPropostaNormalizado = Number.isFinite(vendaForm.capex_total)
    ? Math.max(0, Number(vendaForm.capex_total))
    : 0

  useEffect(() => {
    if (!isVendaDiretaTab) {
      vendaActions.updateResumoProposta({ valor_total_proposta: null })
      return
    }
    vendaActions.updateResumoProposta({ valor_total_proposta: valorTotalPropostaNormalizado })
  }, [isVendaDiretaTab, valorTotalPropostaNormalizado, recalcularTick])

  const resetRetorno = useCallback(() => {
    setRetornoProjetado(null)
    setRetornoError(null)
    setRetornoStatus('idle')
  }, [])

  const handleRecalcularVendas = useCallback(() => {
    setRecalcularTick((prev) => prev + 1)
  }, [])

  const handleCalcularRetorno = useCallback(() => {
    const errors = validateVendaForm(vendaForm)
    setVendaFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      setRetornoError('Revise os campos destacados antes de calcular o retorno.')
      setRetornoProjetado(null)
      setRetornoStatus('idle')
      return
    }
    try {
      setRetornoStatus('calculating')
      const resultado = computeROI(vendaForm)
      setRetornoProjetado(resultado)
      setRetornoError(null)
    } catch (error) {
      console.error('Erro ao calcular retorno projetado.', error)
      setRetornoProjetado(null)
      setRetornoError('Não foi possível calcular o retorno. Tente novamente.')
    } finally {
      setRetornoStatus('idle')
    }
  }, [validateVendaForm, vendaForm])

  useEffect(() => {
    vendaActions.updateResultados({
      payback_meses: retornoProjetado?.payback ?? null,
      roi_acumulado_30a: retornoProjetado ? retornoProjetado.roi : null,
    })
  }, [retornoProjetado, recalcularTick])

  type VendaFormUpdates = { [K in keyof VendaForm]?: VendaForm[K] | undefined }

  const applyVendaUpdates = useCallback(
    (updates: VendaFormUpdates) => {
      if (!updates || Object.keys(updates).length === 0) {
        return
      }
      setVendaForm((prev) => {
        let changed = false
        const next: VendaForm = { ...prev }
        Object.entries(updates).forEach(([rawKey, value]) => {
          const key = rawKey as keyof VendaForm
          if (value === undefined) {
            if (next[key] !== undefined) {
              ;(next as any)[key] = value
              changed = true
            }
            return
          }
          if (next[key] !== value) {
            ;(next as any)[key] = value
            changed = true
          }
        })
        return changed ? next : prev
      })
      setVendaFormErrors((prev) => {
        if (!prev || Object.keys(prev).length === 0) {
          return prev
        }
        let changed = false
        const next = { ...prev }
        Object.keys(updates).forEach((key) => {
          if (key in next) {
            delete next[key]
            changed = true
          }
        })
        return changed ? next : prev
      })
      resetRetorno()
    },
    [resetRetorno],
  )

  const capexMoneyField = useBRNumberField({
    mode: 'money',
    value: Number.isFinite(vendaForm.capex_total) ? Number(vendaForm.capex_total) : null,
    onChange: (valor) => {
      const normalized = Number.isFinite(valor ?? NaN) ? Math.max(0, Number(valor)) : 0
      setCapexManualOverride(true)
      applyVendaUpdates({ capex_total: normalized })
    },
  })

  const handleSegmentoClienteChange = useCallback(
    (value: SegmentoCliente) => {
      setSegmentoCliente((prev) => (prev === value ? prev : value))
      applyVendaUpdates({ segmento_cliente: value })
    },
    [applyVendaUpdates],
  )

  const handleTipoSistemaChange = useCallback(
    (value: TipoSistema) => {
      setTipoSistema((prev) => (prev === value ? prev : value))
      applyVendaUpdates({ tipo_sistema: value })
    },
    [applyVendaUpdates, setTipoSistema],
  )

  const autoFillVendaFromBudget = useCallback(
    (structured: StructuredBudget, totalValue?: number | null, plainText?: string | null) => {
      if (!structured) {
        return
      }

      const estruturaKeywords = ['estrutura', 'fixacao', 'fixação', 'suporte', 'trilho', 'perfil']

      const parsedFromText = parseVendaPdfText(plainText ?? '')

      const moduleQuantityFromStructured = sumModuleQuantities(structured.itens)
      let quantidadeModulos: number | undefined =
        moduleQuantityFromStructured > 0 ? moduleQuantityFromStructured : undefined
      let modeloModulo: string | undefined
      let modeloInversor: string | undefined
      let potenciaModuloWp: number | undefined
      let potenciaInstalada: number | undefined
      let geracaoEstimada: number | undefined
      let estruturaSuporte: string | undefined

      const sanitizeTexto = (valor?: string | null) => {
        const trimmed = valor?.trim() ?? ''
        return trimmed && trimmed !== '—' ? trimmed : undefined
      }

      const formatEquipment = (item: StructuredItem) => {
        const nome = sanitizeTexto(item.produto) || sanitizeTexto(item.descricao)
        const codigo = sanitizeTexto(item.codigo)
        const modeloEquip = sanitizeTexto(item.modelo)
        const fabricante = sanitizeTexto(item.fabricante)
        const metaParts: string[] = []
        if (codigo) {
          metaParts.push(`Código: ${codigo}`)
        }
        if (modeloEquip) {
          metaParts.push(`Modelo: ${modeloEquip}`)
        }
        if (fabricante) {
          metaParts.push(`Fabricante: ${fabricante}`)
        }
        const partes: string[] = []
        if (nome) {
          partes.push(nome)
        }
        if (metaParts.length > 0) {
          partes.push(metaParts.join('  ·  '))
        }
        return partes.length > 0 ? partes.join(' — ') : undefined
      }

      structured.itens.forEach((item) => {
        const descricaoCompleta = `${item.produto ?? ''} ${item.modelo ?? ''} ${item.descricao ?? ''}`
        const textoNormalizado = normalizeText(descricaoCompleta)
        const quantidadeItem = Number.isFinite(item.quantidade)
          ? Math.round(Number(item.quantidade))
          : null
        const classification = classifyBudgetItem({
          product: item.produto,
          description: item.descricao,
          quantity: item.quantidade ?? null,
          extra: `${item.modelo ?? ''} ${item.fabricante ?? ''}`,
        })
        const isModulo = classification === 'module'
        const isInversor = classification === 'inverter'
        const isEstrutura = estruturaKeywords.some((palavra) => textoNormalizado.includes(palavra))

        if (
          moduleQuantityFromStructured <= 0 &&
          isModulo &&
          quantidadeItem &&
          quantidadeItem > 0
        ) {
          quantidadeModulos = (quantidadeModulos ?? 0) + quantidadeItem
        }

        if (isModulo && !modeloModulo) {
          const resumoModulo = formatEquipment(item) || sanitizeTexto(item.modelo) || sanitizeTexto(item.produto)
          if (resumoModulo) {
            modeloModulo = resumoModulo
          }
        }

        if (isModulo && !potenciaModuloWp) {
          const potenciaMatch = descricaoCompleta.match(/(\d{3,4})\s*(?:wp|w)\b/i)
          if (potenciaMatch) {
            const numeric = potenciaMatch[1].replace(/\D+/g, '')
            const parsed = Number.parseInt(numeric, 10)
            if (Number.isFinite(parsed) && parsed > 0) {
              potenciaModuloWp = parsed
            }
          }
        }

        if (isInversor && !modeloInversor) {
          const resumoInversor = formatEquipment(item) || sanitizeTexto(item.modelo) || sanitizeTexto(item.produto)
          if (resumoInversor) {
            modeloInversor = resumoInversor
          }
        }

        if (isEstrutura && !estruturaSuporte) {
          const candidato =
            sanitizeTexto(item.modelo) || sanitizeTexto(item.produto) || sanitizeTexto(item.descricao) || ''
          if (candidato) {
            estruturaSuporte = candidato.replace(/^[-–—\s]+/, '')
          }
        }

        if (!potenciaInstalada) {
          const potenciaMatch = descricaoCompleta.match(/(\d+(?:[.,]\d+)?)\s*k(?:wp|w)\b/i)
          const valorPotencia = potenciaMatch ? toNumberFlexible(potenciaMatch[1]) : null
          if (Number.isFinite(valorPotencia) && (valorPotencia ?? 0) > 0) {
            potenciaInstalada = Number(valorPotencia)
          }
        }

        if (!geracaoEstimada) {
          const geracaoMatch = descricaoCompleta.match(/(\d+(?:[.,]\d+)?)\s*kwh/i)
          const valorGeracao = geracaoMatch ? toNumberFlexible(geracaoMatch[1]) : null
          if (Number.isFinite(valorGeracao) && (valorGeracao ?? 0) > 0) {
            geracaoEstimada = Number(valorGeracao)
          }
        }
      })

      if (!potenciaInstalada && quantidadeModulos) {
        const potenciaReferencia = potenciaModuloWp ?? (potenciaModulo > 0 ? potenciaModulo : undefined)
        if (potenciaReferencia) {
          potenciaInstalada = (quantidadeModulos * potenciaReferencia) / 1000
        }
      }

      const structuredPartial: Partial<ParsedVendaPdfData> & {
        geracao_estimada_source?: 'extracted' | 'calculated' | null
      } = {}

      const parsedQuantidadeValor =
        parsedFromText.quantidade_modulos != null
          ? Number(parsedFromText.quantidade_modulos)
          : null
      const parsedQuantidadeValida =
        parsedQuantidadeValor != null &&
        Number.isFinite(parsedQuantidadeValor) &&
        parsedQuantidadeValor > 0
          ? Math.round(parsedQuantidadeValor)
          : null

      if (
        typeof quantidadeModulos === 'number' &&
        quantidadeModulos > 0 &&
        (!parsedQuantidadeValida || parsedQuantidadeValida <= 0)
      ) {
        structuredPartial.quantidade_modulos = Math.max(1, Math.round(quantidadeModulos))
      }
      if (modeloModulo) {
        structuredPartial.modelo_modulo = modeloModulo
      }
      if (modeloInversor) {
        structuredPartial.modelo_inversor = modeloInversor
      }
      if (estruturaSuporte) {
        structuredPartial.estrutura_fixacao = estruturaSuporte
      }
      if (typeof potenciaInstalada === 'number' && potenciaInstalada > 0) {
        structuredPartial.potencia_instalada_kwp = potenciaInstalada
      }
      if (typeof potenciaModuloWp === 'number' && potenciaModuloWp > 0) {
        structuredPartial.potencia_da_placa_wp = potenciaModuloWp
      }
      if (typeof geracaoEstimada === 'number' && geracaoEstimada > 0) {
        structuredPartial.geracao_estimada_kwh_mes = geracaoEstimada
        structuredPartial.geracao_estimada_source = 'extracted'
      }

      const capexPartial: Partial<ParsedVendaPdfData> = {}
      if (typeof totalValue === 'number' && Number.isFinite(totalValue) && totalValue > 0) {
        capexPartial.capex_total = totalValue
      }

      const mergedParsed = mergeParsedVendaPdfData(parsedFromText, structuredPartial, capexPartial)
      setParsedVendaPdf(mergedParsed)
      setEstruturaTipoWarning(mergedParsed.estrutura_utilizada_tipo_warning ?? null)

      const updates: Partial<VendaForm> = {}
      let consumoAtualizado = false
      let tarifaAtualizada = false

      const shouldSetNumber = (current: number | undefined, value: number | null) => {
        if (value == null || !Number.isFinite(value) || value <= 0) {
          return false
        }
        if (!Number.isFinite(current) || (current ?? 0) <= 0) {
          return true
        }
        return false
      }

      const shouldSetString = (current: string | undefined, value: string | null) => {
        if (!value) {
          return false
        }
        return !current || current.trim().length === 0
      }

      if (shouldSetNumber(vendaForm.potencia_instalada_kwp, mergedParsed.potencia_instalada_kwp)) {
        if (mergedParsed.potencia_instalada_kwp != null) {
          updates.potencia_instalada_kwp = mergedParsed.potencia_instalada_kwp
        }
      }
      if (shouldSetNumber(vendaForm.quantidade_modulos, mergedParsed.quantidade_modulos)) {
        if (mergedParsed.quantidade_modulos != null) {
          updates.quantidade_modulos = mergedParsed.quantidade_modulos
        }
      }
      if (shouldSetNumber(vendaForm.geracao_estimada_kwh_mes, mergedParsed.geracao_estimada_kwh_mes)) {
        if (mergedParsed.geracao_estimada_kwh_mes != null) {
          updates.geracao_estimada_kwh_mes = mergedParsed.geracao_estimada_kwh_mes
        }
      }
      if (shouldSetNumber(vendaForm.consumo_kwh_mes, mergedParsed.consumo_kwh_mes)) {
        if (mergedParsed.consumo_kwh_mes != null) {
          updates.consumo_kwh_mes = mergedParsed.consumo_kwh_mes
        }
        consumoAtualizado = true
      }
      if (shouldSetNumber(vendaForm.tarifa_cheia_r_kwh, mergedParsed.tarifa_cheia_r_kwh)) {
        if (mergedParsed.tarifa_cheia_r_kwh != null) {
          updates.tarifa_cheia_r_kwh = mergedParsed.tarifa_cheia_r_kwh
        }
        tarifaAtualizada = true
      }
      if (shouldSetString(vendaForm.modelo_modulo, mergedParsed.modelo_modulo)) {
        if (mergedParsed.modelo_modulo) {
          updates.modelo_modulo = mergedParsed.modelo_modulo
        }
      }
      if (shouldSetString(vendaForm.modelo_inversor, mergedParsed.modelo_inversor)) {
        if (mergedParsed.modelo_inversor) {
          updates.modelo_inversor = mergedParsed.modelo_inversor
        }
      }
      if (shouldSetString(vendaForm.estrutura_suporte, mergedParsed.estrutura_fixacao)) {
        if (mergedParsed.estrutura_fixacao) {
          updates.estrutura_suporte = mergedParsed.estrutura_fixacao
        }
      }

      const numeroOrcamento = structured.header.numeroOrcamento?.trim()
      if (numeroOrcamento && (!vendaForm.numero_orcamento_vendor || !vendaForm.numero_orcamento_vendor.trim())) {
        updates.numero_orcamento_vendor = numeroOrcamento
      }

      if (Object.keys(updates).length > 0) {
        applyVendaUpdates(updates)
      }

      setCapexManualOverride(false)
      if (consumoAtualizado && mergedParsed.consumo_kwh_mes != null) {
        setKcKwhMes(mergedParsed.consumo_kwh_mes)
      }
      if (tarifaAtualizada && mergedParsed.tarifa_cheia_r_kwh != null) {
        setTarifaCheia(mergedParsed.tarifa_cheia_r_kwh)
      }

      const potenciaModuloSelecionada = resolvePotenciaModuloFromBudget(
        mergedParsed.potencia_da_placa_wp,
      )
      if (potenciaModuloSelecionada !== potenciaModulo) {
        setPotenciaModulo(potenciaModuloSelecionada)
      }

      if (!tipoInstalacaoDirty && mergedParsed.tipo_instalacao) {
        const normalizado = normalizeText(mergedParsed.tipo_instalacao)
        const resolved: TipoInstalacao | null = normalizado.includes('solo')
          ? 'SOLO'
          : normalizado.includes('telhad')
          ? 'TELHADO'
          : null
        if (resolved && resolved !== tipoInstalacao) {
          setTipoInstalacao(resolved)
        }
      }
    },
    [
      applyVendaUpdates,
      potenciaModulo,
      setPotenciaModulo,
      tipoInstalacao,
      tipoInstalacaoDirty,
      setTipoInstalacao,
      setCapexManualOverride,
      setKcKwhMes,
      setTarifaCheia,
      vendaForm,
      setParsedVendaPdf,
      setEstruturaTipoWarning,
    ],
  )

  const handleCondicaoPagamentoChange = useCallback(
    (nextCondicao: PagamentoCondicao) => {
      const updates: Partial<VendaForm> = { condicao: nextCondicao }
      if (nextCondicao === 'AVISTA') {
        updates.modo_pagamento = vendaForm.modo_pagamento ?? 'PIX'
        updates.n_parcelas = undefined
        updates.juros_cartao_am_pct = undefined
        updates.juros_cartao_aa_pct = undefined
        updates.taxa_mdr_credito_parcelado_pct = undefined
        updates.n_parcelas_fin = undefined
        updates.juros_fin_am_pct = undefined
        updates.juros_fin_aa_pct = undefined
        updates.entrada_financiamento = undefined
      } else if (nextCondicao === 'PARCELADO') {
        updates.modo_pagamento = undefined
        updates.n_parcelas_fin = undefined
        updates.juros_fin_am_pct = undefined
        updates.juros_fin_aa_pct = undefined
        updates.entrada_financiamento = undefined
      } else if (nextCondicao === 'FINANCIAMENTO') {
        updates.modo_pagamento = undefined
        updates.n_parcelas = undefined
        updates.juros_cartao_am_pct = undefined
        updates.juros_cartao_aa_pct = undefined
        updates.taxa_mdr_credito_parcelado_pct = undefined
      }
      applyVendaUpdates(updates)
    },
    [applyVendaUpdates, vendaForm.modo_pagamento],
  )

  const handleBudgetFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setBudgetProcessingError('O arquivo excede o limite de 40MB.')
        if (budgetUploadInputRef.current) {
          budgetUploadInputRef.current.value = ''
        }
        return
      }
      setBudgetProcessingError(null)
      setBudgetProcessingProgress({
        stage: 'carregando',
        page: 0,
        totalPages: 0,
        progress: 0,
        message: 'Preparando arquivo para processamento',
      })
      setIsBudgetProcessing(true)
      try {
        const result = await uploadBudgetFile(file, {
          dpi: ocrDpi,
          onProgress: (progress) => {
            setBudgetProcessingProgress(progress)
          },
        })
        const timestamp = Date.now().toString(36)
        const quantityWarnings: string[] = []
        const extractedItems: KitBudgetItemState[] = result.json.itens.map((item, index) => {
          const rawQuantity =
            typeof item.quantidade === 'number' && Number.isFinite(item.quantidade)
              ? Math.round(item.quantidade)
              : null
          const hasValidQuantity = rawQuantity !== null && rawQuantity > 0
          const resolvedQuantity = hasValidQuantity ? rawQuantity : 1
          const wasQuantityInferred = !hasValidQuantity
          if (wasQuantityInferred) {
            const label = (item.produto ?? '').trim() || `Item ${index + 1}`
            quantityWarnings.push(label)
          }
          const unitPrice = normalizeCurrencyNumber(item.precoUnitario)
          const description = item.descricao?.trim() ?? ''
          return {
            id: `budget-${timestamp}-${index}`,
            productName: (item.produto ?? '').trim(),
            description,
            quantity: resolvedQuantity,
            quantityInput: formatQuantityInputValue(resolvedQuantity),
            unitPrice,
            unitPriceInput: formatCurrencyInputValue(unitPrice),
            wasQuantityInferred,
          }
        })
        const missingInfo = computeBudgetMissingInfo(extractedItems)
        const devMode =
          typeof import.meta !== 'undefined' &&
          Boolean((import.meta as unknown as { env?: Record<string, unknown> }).env?.DEV)
        if (
          devMode &&
          missingInfo &&
          (missingInfo.modules.missingFields.length > 0 ||
            missingInfo.inverter.missingFields.length > 0)
        ) {
          console.warn('Orçamento sem informações essenciais identificadas:', missingInfo)
        }
        const explicitTotal = normalizeCurrencyNumber(result.json.resumo.valorTotal)
        const calculatedTotal = computeBudgetItemsTotalValue(extractedItems)
        const warnings: string[] = [...(result.structured.warnings ?? [])]
        if (quantityWarnings.length) {
          const formatted = formatList(quantityWarnings.slice(0, 3))
          const suffix = quantityWarnings.length > 3 ? ' e outros' : ''
          warnings.push(
            `Alguns itens tiveram a quantidade assumida como 1 por não constar no documento: ${formatted}${suffix}.`,
          )
        }
        let totalSource: 'explicit' | 'calculated' | null = null
        let totalValue: number | null = null
        if (explicitTotal !== null) {
          totalSource = 'explicit'
          totalValue = explicitTotal
        } else if (calculatedTotal !== null) {
          totalSource = 'calculated'
          totalValue = calculatedTotal
          warnings.push(
            'O valor total do orçamento foi calculado a partir da soma dos itens porque não foi identificado no documento.',
          )
        }
        if (!result.structured.itens.length) {
          warnings.push(
            'Nenhum item de orçamento foi identificado automaticamente. Revise o arquivo ou preencha manualmente.',
          )
        }
        if (result.usedOcr) {
          warnings.push(
            'Foi necessário utilizar OCR em parte do documento. Revise os dados extraídos antes de continuar.',
          )
        }
        setKitBudget({
          items: extractedItems,
          total: totalValue,
          totalSource,
          totalInput: formatCurrencyInputValue(totalValue),
          warnings,
          fileName: file.name,
          fileSizeBytes: file.size,
          missingInfo,
          ignoredByNoise: result.structured.meta?.ignoredByNoise ?? 0,
        })
        setBudgetStructuredItems(result.structured.itens)
        setCurrentBudgetId(createDraftBudgetId())
        autoFillVendaFromBudget(result.structured, totalValue, result.plainText)
      } catch (error) {
        console.error('Erro ao processar orçamento', error)
        if (error instanceof BudgetUploadError) {
          if (error.code === 'unsupported-format') {
            setBudgetProcessingError('Formato não suportado. Envie um arquivo PDF ou imagem (PNG/JPG).')
          } else if (error.code === 'file-too-large') {
            setBudgetProcessingError('O arquivo excede o limite de 40MB.')
          } else {
            setBudgetProcessingError('Não foi possível concluir o processamento do orçamento. Tente novamente.')
          }
        } else {
          setBudgetProcessingError(
            'Não foi possível processar o orçamento. Verifique o arquivo e tente novamente.',
          )
        }
      } finally {
        setIsBudgetProcessing(false)
        setBudgetProcessingProgress(null)
        if (budgetUploadInputRef.current) {
          budgetUploadInputRef.current.value = ''
        }
      }
    },
    [autoFillVendaFromBudget, ocrDpi],
  )

  const handleMissingInfoManualEdit = useCallback(() => {
    if (typeof document === 'undefined') {
      return
    }
    const info = kitBudget.missingInfo
    const focusBudgetField = (
      itemId: string,
      fields: ('product' | 'description' | 'quantity')[],
    ): boolean => {
      for (const field of fields) {
        const element = document.querySelector<HTMLElement>(
          `[data-budget-item-id="${itemId}"][data-field="${field}"]`,
        )
        if (!element) {
          continue
        }
        if ('focus' in element && typeof element.focus === 'function') {
          element.focus()
          if (
            ('select' in element && typeof (element as HTMLInputElement | HTMLTextAreaElement).select === 'function')
          ) {
            ;(element as HTMLInputElement | HTMLTextAreaElement).select()
          }
          return true
        }
      }
      return false
    }

    const tryFocusCategory = (categoryInfo: EssentialInfoSummary['modules']): boolean => {
      if (!categoryInfo.firstMissingId) {
        return false
      }
      const target = kitBudget.items.find((item) => item.id === categoryInfo.firstMissingId)
      if (!target) {
        return false
      }
      const missingFields: ('product' | 'description' | 'quantity')[] = []
      if (!target.productName.trim()) {
        missingFields.push('product')
      }
      if (!target.description.trim()) {
        missingFields.push('description')
      }
      const quantityOk = Number.isFinite(target.quantity) && (target.quantity ?? 0) > 0
      if (!quantityOk) {
        missingFields.push('quantity')
      }
      if (missingFields.length === 0) {
        missingFields.push('product', 'description', 'quantity')
      }
      return focusBudgetField(categoryInfo.firstMissingId, missingFields)
    }

    if (info) {
      if (info.modules.missingFields.length > 0 && tryFocusCategory(info.modules)) {
        return
      }
      if (info.inverter.missingFields.length > 0 && tryFocusCategory(info.inverter)) {
        return
      }
    }

    const modulesMissing = info ? info.modules.missingFields.length > 0 : true
    if (modulesMissing && moduleQuantityInputRef.current) {
      moduleQuantityInputRef.current.focus()
      moduleQuantityInputRef.current.select?.()
      return
    }
    if (info && info.inverter.missingFields.length > 0 && inverterModelInputRef.current) {
      inverterModelInputRef.current.focus()
      inverterModelInputRef.current.select?.()
      return
    }
    if (!modulesMissing && moduleQuantityInputRef.current) {
      moduleQuantityInputRef.current.focus()
      moduleQuantityInputRef.current.select?.()
    }
    if (!info && inverterModelInputRef.current) {
      inverterModelInputRef.current.focus()
      inverterModelInputRef.current.select?.()
    }
  }, [kitBudget.items, kitBudget.missingInfo])

  const handleMissingInfoUploadClick = useCallback(() => {
    budgetUploadInputRef.current?.click()
  }, [])

  const [jurosFinAa, setJurosFinAa] = useState(INITIAL_VALUES.jurosFinanciamentoAa)
  const [prazoFinMeses, setPrazoFinMeses] = useState(
    INITIAL_VALUES.prazoFinanciamentoMeses,
  )
  const [entradaFinPct, setEntradaFinPct] = useState(INITIAL_VALUES.entradaFinanciamentoPct)
  const [mostrarFinanciamento, setMostrarFinanciamento] = useState(
    INITIAL_VALUES.mostrarFinanciamento,
  )
  const [mostrarGrafico, setMostrarGrafico] = useState(INITIAL_VALUES.mostrarGrafico)
  const [density, setDensity] = useState<DensityMode>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_DENSITY
    }

    const stored = window.localStorage.getItem(DENSITY_STORAGE_KEY)
    return stored && isDensityMode(stored) ? stored : DEFAULT_DENSITY
  })

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.density = density
    }

    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, density)
    } catch (error) {
      console.warn('Não foi possível persistir a densidade da interface.', error)
    }
  }, [density])

  const [prazoMeses, setPrazoMeses] = useState(INITIAL_VALUES.prazoMeses)
  const [bandeiraEncargo, setBandeiraEncargo] = useState(INITIAL_VALUES.bandeiraEncargo)
  const [cipEncargo, setCipEncargo] = useState(INITIAL_VALUES.cipEncargo)
  const [entradaRs, setEntradaRs] = useState(INITIAL_VALUES.entradaRs)
  const [entradaModo, setEntradaModo] = useState<EntradaModoLabel>(INITIAL_VALUES.entradaModo)
  const [mostrarTabelaParcelas, setMostrarTabelaParcelas] = useState(
    INITIAL_VALUES.tabelaVisivel,
  )
  const [mostrarTabelaBuyout, setMostrarTabelaBuyout] = useState(INITIAL_VALUES.tabelaVisivel)
  const [gerandoTabelaTransferencia, setGerandoTabelaTransferencia] = useState(false)
  const [mostrarTabelaParcelasConfig, setMostrarTabelaParcelasConfig] = useState(
    INITIAL_VALUES.tabelaVisivel,
  )
  const [mostrarTabelaBuyoutConfig, setMostrarTabelaBuyoutConfig] = useState(
    INITIAL_VALUES.tabelaVisivel,
  )
  const [salvandoPropostaPdf, setSalvandoPropostaPdf] = useState(false)

  const [oemBase, setOemBase] = useState(INITIAL_VALUES.oemBase)
  const [oemInflacao, setOemInflacao] = useState(INITIAL_VALUES.oemInflacao)
  const [seguroModo, setSeguroModo] = useState<SeguroModo>(INITIAL_VALUES.seguroModo)
  const [seguroReajuste, setSeguroReajuste] = useState(INITIAL_VALUES.seguroReajuste)
  const [seguroValorA, setSeguroValorA] = useState(INITIAL_VALUES.seguroValorA)
  const [seguroPercentualB, setSeguroPercentualB] = useState(
    INITIAL_VALUES.seguroPercentualB,
  )

  const [exibirLeasingLinha, setExibirLeasingLinha] = useState(
    INITIAL_VALUES.exibirLeasingLinha,
  )
  const [exibirFinLinha, setExibirFinLinha] = useState(INITIAL_VALUES.exibirFinanciamentoLinha)

  const [cashbackPct, setCashbackPct] = useState(INITIAL_VALUES.cashbackPct)
  const [depreciacaoAa, setDepreciacaoAa] = useState(INITIAL_VALUES.depreciacaoAa)
  const [inadimplenciaAa, setInadimplenciaAa] = useState(INITIAL_VALUES.inadimplenciaAa)
  const [tributosAa, setTributosAa] = useState(INITIAL_VALUES.tributosAa)
  const [ipcaAa, setIpcaAa] = useState(INITIAL_VALUES.ipcaAa)
  const [custosFixosM, setCustosFixosM] = useState(INITIAL_VALUES.custosFixosM)
  const [opexM, setOpexM] = useState(INITIAL_VALUES.opexM)
  const [seguroM, setSeguroM] = useState(INITIAL_VALUES.seguroM)
  const [duracaoMeses, setDuracaoMeses] = useState(INITIAL_VALUES.duracaoMeses)
  // Valor informado (ou calculado) de parcelas efetivamente pagas até o mês analisado, usado no crédito de cashback
  const [pagosAcumAteM, setPagosAcumAteM] = useState(INITIAL_VALUES.pagosAcumManual)

  const mesReferencia = mesReferenciaRef.current

  useEffect(() => {
    crmIntegrationModeRef.current = crmIntegrationMode
  }, [crmIntegrationMode])

  useEffect(() => {
    if (!multiUcAtivo) {
      return
    }
    setMultiUcRows((prev) => {
      if (prev.length > 0) {
        return prev
      }
      const novoId = multiUcIdCounterRef.current
      multiUcIdCounterRef.current += 1
      return [applyTarifasAutomaticas(createDefaultMultiUcRow(novoId), undefined, true)]
    })
  }, [applyTarifasAutomaticas, multiUcAtivo])

  useEffect(() => {
    if (!multiUcAtivo) {
      return
    }
    setMultiUcRows((prev) => {
      let changed = false
      const atualizadas = prev.map((row) => {
        const proxima = applyTarifasAutomaticas(row, row.classe, false)
        if (proxima !== row) {
          changed = true
        }
        return proxima
      })
      return changed ? atualizadas : prev
    })
  }, [applyTarifasAutomaticas, multiUcAtivo])

  useEffect(() => {
    if (!multiUcAtivo) {
      return
    }
    if (multiUcConsumoAnteriorRef.current == null) {
      multiUcConsumoAnteriorRef.current = kcKwhMes
    }
    if (Math.abs(kcKwhMes - multiUcConsumoTotal) > 0.001) {
      setKcKwhMes(multiUcConsumoTotal, 'auto')
    }
  }, [kcKwhMes, multiUcAtivo, multiUcConsumoTotal, setKcKwhMes])

  useEffect(() => {
    if (multiUcAtivo) {
      return
    }
    if (multiUcConsumoAnteriorRef.current != null) {
      setKcKwhMes(multiUcConsumoAnteriorRef.current, 'auto')
      multiUcConsumoAnteriorRef.current = null
    }
  }, [multiUcAtivo, setKcKwhMes])

  useEffect(() => {
    let cancelado = false
    const uf = ufTarifa.trim()
    const dist = distribuidoraTarifa.trim()

    if (!uf || !dist) {
      setMesReajuste(6)
      return () => {
        cancelado = true
      }
    }

    void getMesReajusteFromANEEL(uf, dist)
      .then((mes) => {
        if (cancelado) return
        const normalizado = Number.isFinite(mes) ? Math.round(mes) : 6
        const ajustado = Math.min(Math.max(normalizado || 6, 1), 12)
        setMesReajuste(ajustado)
      })
      .catch((error) => {
        console.warn('[ANEEL] não foi possível atualizar mês de reajuste:', error)
        if (!cancelado) setMesReajuste(6)
      })

    return () => {
      cancelado = true
    }
  }, [distribuidoraTarifa, ufTarifa])

  useEffect(() => {
    const ufAtual = (ufTarifa || clienteUf || '').trim()
    if (!ufAtual) {
      return undefined
    }

    const distribuidoraAtual = (distribuidoraTarifa || clienteDistribuidora || '').trim()
    let cancelado = false

    void getTarifaCheia({ uf: ufAtual, distribuidora: distribuidoraAtual || undefined })
      .then((valor) => {
        if (cancelado) return
        if (!Number.isFinite(valor)) return

        setTarifaCheia((atual) => {
          if (!Number.isFinite(atual)) {
            return valor
          }
          return Math.abs(atual - valor) < 0.0005 ? atual : valor
        })
      })
      .catch((error) => {
        if (cancelado) return
        console.warn('[Tarifa] Não foi possível atualizar tarifa cheia automaticamente:', error)
      })

    return () => {
      cancelado = true
    }
  }, [clienteDistribuidora, clienteUf, distribuidoraTarifa, ufTarifa])

  useEffect(() => {
    let cancelado = false

    void loadDistribuidorasAneel()
      .then((dados) => {
        if (cancelado) return
        setUfsDisponiveis(dados.ufs)
        setDistribuidorasPorUf(dados.distribuidorasPorUf)
      })
      .catch((error) => {
        console.warn('[ANEEL] não foi possível atualizar lista de distribuidoras:', error)
      })

    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    if (!ufTarifa) {
      setDistribuidoraTarifa('')
      return
    }

    const lista = distribuidorasPorUf?.[ufTarifa]
    if (!lista || lista.length === 0) {
      setDistribuidoraTarifa('')
      return
    }

    setDistribuidoraTarifa((atual) => {
      if (lista.length === 1) {
        return lista[0]
      }
      return lista.includes(atual) ? atual : ''
    })
  }, [distribuidorasPorUf, ufTarifa])

  useEffect(() => {
    const updateHeaderHeight = () => {
      const header = document.querySelector<HTMLElement>('.app-header')
      if (header) {
        const { height } = header.getBoundingClientRect()
        document.documentElement.style.setProperty('--header-h', `${Math.round(height)}px`)
      }

      const tabs = document.querySelector<HTMLElement>('.tabs-bar')
      if (tabs) {
        const { height } = tabs.getBoundingClientRect()
        document.documentElement.style.setProperty('--tabs-h', `${Math.round(height)}px`)
      }
    }

    updateHeaderHeight()
    window.addEventListener('resize', updateHeaderHeight)
    return () => window.removeEventListener('resize', updateHeaderHeight)
  }, [])

  useEffect(() => {
    const estadoAtual = (ufTarifa || clienteUf || '').trim()
    if (!estadoAtual) {
      setIrradiacao(IRRADIACAO_FALLBACK)
      return
    }

    if (!hasEstadoMinimo(estadoAtual)) {
      setIrradiacao(IRRADIACAO_FALLBACK)
      return
    }

    let cancelado = false

    void getIrradiacaoPorEstado(estadoAtual)
      .then(({ value, matched, via }) => {
        if (cancelado) return
        setIrradiacao((prev) => (prev === value ? prev : value))
        if (!matched) {
          console.warn(
            `[Irradiação] Estado "${estadoAtual}" não encontrado (${via}), usando fallback de ${formatNumberBRWithOptions(value, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} kWh/m²/dia.`,
          )
        }
      })
      .catch((error) => {
        if (cancelado) return
        console.warn(
          `[Irradiação] Erro ao carregar dados para "${estadoAtual}":`,
          error,
          `— usando fallback de ${formatNumberBRWithOptions(IRRADIACAO_FALLBACK, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} kWh/m²/dia.`,
        )
        setIrradiacao(IRRADIACAO_FALLBACK)
      })

    return () => {
      cancelado = true
    }
  }, [clienteUf, ufTarifa])

  useEffect(() => {
    const { body } = document
    if (!body) return

    if (isSettingsOpen) {
      body.style.setProperty('overflow', 'hidden')
    } else {
      body.style.removeProperty('overflow')
    }

    return () => {
      body.style.removeProperty('overflow')
    }
  }, [isSettingsOpen])

  useEffect(() => {
    if (isSettingsOpen) {
      setSettingsTab('mercado')
    }
  }, [isSettingsOpen])

  const eficienciaNormalizada = useMemo(() => {
    if (eficiencia <= 0) return 0
    if (eficiencia >= 1.5) return eficiencia / 100
    return eficiencia
  }, [eficiencia])

  const baseIrradiacao = useMemo(
    () => (irradiacao > 0 ? irradiacao : 0),
    [irradiacao],
  )

  const diasMesNormalizado = useMemo(
    () => (diasMes > 0 ? diasMes : 0),
    [diasMes],
  )

  const fatorGeracaoMensal = useMemo(() => {
    if (baseIrradiacao <= 0 || eficienciaNormalizada <= 0) {
      return 0
    }
    return baseIrradiacao * eficienciaNormalizada * DIAS_MES_PADRAO
  }, [baseIrradiacao, eficienciaNormalizada])

  const numeroModulosInformado = useMemo(() => {
    if (typeof numeroModulosManual !== 'number') return null
    if (!Number.isFinite(numeroModulosManual) || numeroModulosManual <= 0) return null
    return Math.max(1, Math.round(numeroModulosManual))
  }, [numeroModulosManual])

  const numeroModulosCalculado = useMemo(() => {
    if (kcKwhMes <= 0) return 0
    if (potenciaModulo <= 0 || fatorGeracaoMensal <= 0) return 0
    const potenciaNecessaria = kcKwhMes / fatorGeracaoMensal
    const calculado = Math.ceil((potenciaNecessaria * 1000) / potenciaModulo)
    if (!Number.isFinite(calculado)) return 0
    return Math.max(1, calculado)
  }, [kcKwhMes, fatorGeracaoMensal, potenciaModulo])

  const potenciaInstaladaKwp = useMemo(() => {
    const modulos = numeroModulosInformado ?? numeroModulosCalculado
    if (!modulos || potenciaModulo <= 0) return 0
    return (modulos * potenciaModulo) / 1000
  }, [numeroModulosInformado, numeroModulosCalculado, potenciaModulo])

  const numeroModulosEstimado = useMemo(() => {
    if (numeroModulosInformado) return numeroModulosInformado
    return numeroModulosCalculado
  }, [numeroModulosInformado, numeroModulosCalculado])

  const vendaQuantidadeModulos = useMemo(() => {
    const quantidade = vendaForm.quantidade_modulos
    if (!Number.isFinite(quantidade)) {
      return null
    }
    const resolved = Number(quantidade)
    return resolved > 0 ? resolved : null
  }, [vendaForm.quantidade_modulos, recalcularTick])

  const vendaAutoPotenciaKwp = useMemo(
    () => kwpFromWpQty(potenciaModulo, vendaQuantidadeModulos),
    [potenciaModulo, vendaQuantidadeModulos],
  )

  const vendaGeracaoParametros = useMemo(
    () => ({
      hsp: baseIrradiacao > 0 ? baseIrradiacao : 0,
      pr: eficienciaNormalizada > 0 ? eficienciaNormalizada : 0,
    }),
    [baseIrradiacao, eficienciaNormalizada],
  )

  useEffect(() => {
    const segmentoAtual = vendaForm.segmento_cliente
    if (segmentoAtual && segmentoAtual !== segmentoCliente) {
      setSegmentoCliente(segmentoAtual)
      return
    }
    if (!segmentoAtual && segmentoCliente !== INITIAL_VALUES.segmentoCliente) {
      setSegmentoCliente(INITIAL_VALUES.segmentoCliente)
    }
  }, [segmentoCliente, vendaForm.segmento_cliente])

  useEffect(() => {
    const tipoAtual = normalizeTipoSistemaValue(vendaForm.tipo_sistema)
    if (tipoAtual && tipoAtual !== tipoSistema) {
      setTipoSistema(tipoAtual)
    }
  }, [setTipoSistema, tipoSistema, vendaForm.tipo_sistema])

  const areaInstalacao = useMemo(() => {
    if (numeroModulosEstimado <= 0) return 0
    const fator = tipoInstalacao === 'SOLO' ? 7 : 3.3
    return Math.round(numeroModulosEstimado * fator)
  }, [numeroModulosEstimado, tipoInstalacao])

  const geracaoMensalKwh = useMemo(() => {
    if (potenciaInstaladaKwp <= 0) {
      return 0
    }
    const estimada = estimateMonthlyGenerationKWh({
      potencia_instalada_kwp: potenciaInstaladaKwp,
      irradiacao_kwh_m2_dia: baseIrradiacao,
      performance_ratio: eficienciaNormalizada,
      dias_mes: diasMesNormalizado > 0 ? diasMesNormalizado : DIAS_MES_PADRAO,
    })
    return estimada > 0 ? estimada : 0
  }, [baseIrradiacao, diasMesNormalizado, eficienciaNormalizada, potenciaInstaladaKwp])

  const handleMultiUcToggle = useCallback(
    (checked: boolean) => {
      setMultiUcAtivo(checked)
      if (checked) {
        multiUcConsumoAnteriorRef.current = kcKwhMes
        setMultiUcEnergiaGeradaTouched(false)
        setMultiUcRows((prev) => {
          if (prev.length > 0) {
            return prev
          }
          const novoId = multiUcIdCounterRef.current
          multiUcIdCounterRef.current += 1
          return [applyTarifasAutomaticas(createDefaultMultiUcRow(novoId), undefined, true)]
        })
        const sugeridoBase = geracaoMensalKwh > 0 ? geracaoMensalKwh : kcKwhMes
        if (sugeridoBase > 0) {
          setMultiUcEnergiaGeradaKWhState((prev) => (prev > 0 ? prev : Math.max(0, sugeridoBase)))
        }
      } else {
        setMultiUcEnergiaGeradaTouched(false)
        if (multiUcConsumoAnteriorRef.current != null) {
          setKcKwhMes(multiUcConsumoAnteriorRef.current, 'auto')
        }
        multiUcConsumoAnteriorRef.current = null
      }
    },
    [
      applyTarifasAutomaticas,
      geracaoMensalKwh,
      kcKwhMes,
      setKcKwhMes,
    ],
  )

  useEffect(() => {
    if (!multiUcAtivo) {
      return
    }
    const sugerido = Math.max(0, geracaoMensalKwh)
    setMultiUcEnergiaGeradaKWhState((prev) => {
      if (multiUcEnergiaGeradaTouched && prev > 0) {
        return prev
      }
      if (sugerido > 0 && Math.abs(prev - sugerido) > 0.1) {
        return sugerido
      }
      return prev
    })
  }, [geracaoMensalKwh, multiUcAtivo, multiUcEnergiaGeradaTouched])

  const diasMesConsiderado = diasMesNormalizado > 0 ? diasMesNormalizado : DIAS_MES_PADRAO

  const normalizarPotenciaKwp = useCallback((valor: number) => {
    if (!Number.isFinite(valor) || valor <= 0) {
      return 0
    }
    return Math.round(valor * 100) / 100
  }, [])

  const normalizarGeracaoMensal = useCallback((valor: number) => {
    if (!Number.isFinite(valor) || valor <= 0) {
      return 0
    }
    return Math.round(valor * 10) / 10
  }, [])

  const calcularPotenciaSistemaKwp = useCallback(
    (modulos: number, potenciaModuloOverride?: number) => {
      const potenciaWp =
        Number.isFinite(potenciaModuloOverride) && (potenciaModuloOverride ?? 0) > 0
          ? Number(potenciaModuloOverride)
          : potenciaModulo
      if (!Number.isFinite(modulos) || modulos <= 0) {
        return 0
      }
      if (!Number.isFinite(potenciaWp) || potenciaWp <= 0) {
        return 0
      }
      return (modulos * potenciaWp) / 1000
    },
    [potenciaModulo],
  )

  const estimarGeracaoPorPotencia = useCallback(
    (potenciaKwp: number) => {
      if (!Number.isFinite(potenciaKwp) || potenciaKwp <= 0) {
        return 0
      }
      return estimateMonthlyGenerationKWh({
        potencia_instalada_kwp: potenciaKwp,
        irradiacao_kwh_m2_dia: baseIrradiacao,
        performance_ratio: eficienciaNormalizada,
        dias_mes: diasMesConsiderado,
      })
    },
    [baseIrradiacao, eficienciaNormalizada, diasMesConsiderado],
  )

  const fatorGeracaoMensalCompleto = useMemo(() => {
    if (baseIrradiacao <= 0 || eficienciaNormalizada <= 0 || diasMesConsiderado <= 0) {
      return 0
    }
    return baseIrradiacao * eficienciaNormalizada * diasMesConsiderado
  }, [baseIrradiacao, diasMesConsiderado, eficienciaNormalizada])

  const calcularModulosPorGeracao = useCallback(
    (geracaoAlvo: number, potenciaModuloOverride?: number) => {
      if (!Number.isFinite(geracaoAlvo) || geracaoAlvo <= 0) {
        return null
      }
      if (!Number.isFinite(fatorGeracaoMensalCompleto) || fatorGeracaoMensalCompleto <= 0) {
        return null
      }
      const potenciaWp =
        Number.isFinite(potenciaModuloOverride) && (potenciaModuloOverride ?? 0) > 0
          ? Number(potenciaModuloOverride)
          : potenciaModulo
      if (!Number.isFinite(potenciaWp) || potenciaWp <= 0) {
        return null
      }
      const potenciaNecessaria = geracaoAlvo / fatorGeracaoMensalCompleto
      if (!Number.isFinite(potenciaNecessaria) || potenciaNecessaria <= 0) {
        return null
      }
      const modulosCalculados = Math.ceil((potenciaNecessaria * 1000) / potenciaWp)
      if (!Number.isFinite(modulosCalculados) || modulosCalculados <= 0) {
        return null
      }
      return modulosCalculados
    },
    [fatorGeracaoMensalCompleto, potenciaModulo],
  )

  useEffect(() => {
    const consumo = Number.isFinite(vendaForm.consumo_kwh_mes)
      ? Number(vendaForm.consumo_kwh_mes)
      : kcKwhMes
    const tarifaAtual = Number.isFinite(vendaForm.tarifa_r_kwh)
      ? Number(vendaForm.tarifa_r_kwh)
      : tarifaCheia
    const inflacaoEnergia = Number.isFinite(vendaForm.inflacao_energia_aa_pct)
      ? Number(vendaForm.inflacao_energia_aa_pct)
      : inflacaoAa
    const taxaMinimaEnergia = Number.isFinite(vendaForm.taxa_minima_r_mes)
      ? Number(vendaForm.taxa_minima_r_mes)
      : taxaMinima
    const taxaDesconto = Number.isFinite(vendaForm.taxa_desconto_aa_pct)
      ? Number(vendaForm.taxa_desconto_aa_pct)
      : 0

    vendaActions.updateParametros({
      consumo_kwh_mes: consumo > 0 ? consumo : 0,
      tarifa_r_kwh: tarifaAtual > 0 ? tarifaAtual : 0,
      inflacao_energia_aa: inflacaoEnergia > 0 ? inflacaoEnergia : 0,
      taxa_minima_rs_mes: taxaMinimaEnergia > 0 ? taxaMinimaEnergia : 0,
      taxa_desconto_aa: taxaDesconto > 0 ? taxaDesconto : 0,
      horizonte_meses: 360,
      uf: cliente.uf ?? '',
      distribuidora: distribuidoraTarifa || cliente.distribuidora || '',
      irradiacao_kwhm2_dia: baseIrradiacao > 0 ? baseIrradiacao : 0,
    })
  }, [
    baseIrradiacao,
    cliente.distribuidora,
    cliente.uf,
    distribuidoraTarifa,
    inflacaoAa,
    kcKwhMes,
    tarifaCheia,
    taxaMinima,
    vendaForm.consumo_kwh_mes,
    vendaForm.inflacao_energia_aa_pct,
    vendaForm.tarifa_r_kwh,
    vendaForm.taxa_desconto_aa_pct,
    vendaForm.taxa_minima_r_mes,
    recalcularTick,
  ])

  useEffect(() => {
    const quantidadeInformada = Number.isFinite(vendaForm.quantidade_modulos)
      ? Number(vendaForm.quantidade_modulos)
      : null
    const quantidadeFinal = quantidadeInformada ?? numeroModulosEstimado ?? 0
    const potenciaSistema = Number.isFinite(vendaForm.potencia_instalada_kwp)
      ? Number(vendaForm.potencia_instalada_kwp)
      : potenciaInstaladaKwp
    const geracaoEstimativa = Number.isFinite(vendaForm.geracao_estimada_kwh_mes)
      ? Number(vendaForm.geracao_estimada_kwh_mes)
      : geracaoMensalKwh

    const potenciaState: PropostaState = {
      orcamento: {
        modulo: { potenciaW: potenciaModulo },
      },
    }
    const potenciaModuloSeguro = getPotenciaModuloW(potenciaState)

    vendaActions.updateConfiguracao({
      potencia_modulo_wp: potenciaModuloSeguro,
      n_modulos: Number.isFinite(quantidadeFinal) ? Math.max(0, Number(quantidadeFinal)) : 0,
      potencia_sistema_kwp: potenciaSistema > 0 ? potenciaSistema : 0,
      geracao_estimada_kwh_mes: geracaoEstimativa > 0 ? geracaoEstimativa : 0,
      area_m2: areaInstalacao > 0 ? areaInstalacao : 0,
      tipo_instalacao: tipoInstalacao,
      segmento: segmentoCliente,
      modelo_modulo: vendaForm.modelo_modulo ?? '',
      modelo_inversor: vendaForm.modelo_inversor ?? '',
      estrutura_suporte: vendaForm.estrutura_suporte ?? '',
      tipo_sistema: tipoSistema,
    })
  }, [
    areaInstalacao,
    geracaoMensalKwh,
    numeroModulosEstimado,
    potenciaInstaladaKwp,
    potenciaModulo,
    segmentoCliente,
    tipoSistema,
    tipoInstalacao,
    vendaForm.geracao_estimada_kwh_mes,
    vendaForm.modelo_inversor,
    vendaForm.modelo_modulo,
    vendaForm.estrutura_suporte,
    vendaForm.potencia_instalada_kwp,
    vendaForm.quantidade_modulos,
    recalcularTick,
  ])

  useEffect(() => {
    const autonomia = kcKwhMes > 0 && geracaoMensalKwh > 0 ? geracaoMensalKwh / kcKwhMes : null
    vendaActions.updateResultados({
      autonomia_frac: autonomia,
      energia_contratada_kwh_mes: kcKwhMes > 0 ? kcKwhMes : null,
    })
  }, [geracaoMensalKwh, kcKwhMes, recalcularTick])

  useEffect(() => {
    const itensNormalizados = budgetStructuredItems.map((item) => {
      const normalizado: VendaKitItem = {
        produto: item.produto ?? '',
        descricao: item.descricao ?? '',
        quantidade: Number.isFinite(item.quantidade) ? Number(item.quantidade) : null,
        unidade: item.unidade?.trim() ? item.unidade.trim() : null,
        precoUnit: Number.isFinite(item.precoUnitario) ? Number(item.precoUnitario) : null,
        precoTotal: Number.isFinite(item.precoTotal) ? Number(item.precoTotal) : null,
      }
      if (item.codigo?.trim()) {
        normalizado.codigo = item.codigo.trim()
      }
      if (item.modelo?.trim()) {
        normalizado.modelo = item.modelo.trim()
      }
      if (item.fabricante?.trim()) {
        normalizado.fabricante = item.fabricante.trim()
      }
      return normalizado
    })
    const valorTotal =
      kitBudget.total != null && Number.isFinite(kitBudget.total)
        ? Number(kitBudget.total)
        : 0
    vendaActions.updateOrcamento({ itens: itensNormalizados, valor_total_orcamento: valorTotal })
  }, [budgetStructuredItems, kitBudget.total, recalcularTick])

  useEffect(() => {
    vendaActions.updatePagamento({
      forma_pagamento: vendaForm.condicao,
      moeda: 'BRL',
      mdr_pix: Number.isFinite(vendaForm.taxa_mdr_pix_pct) ? Number(vendaForm.taxa_mdr_pix_pct) : 0,
      mdr_debito: Number.isFinite(vendaForm.taxa_mdr_debito_pct) ? Number(vendaForm.taxa_mdr_debito_pct) : 0,
      mdr_credito_avista: Number.isFinite(vendaForm.taxa_mdr_credito_vista_pct)
        ? Number(vendaForm.taxa_mdr_credito_vista_pct)
        : 0,
      validade_proposta_txt: vendaForm.validade_proposta ?? '',
      prazo_execucao_txt: vendaForm.prazo_execucao ?? '',
      condicoes_adicionais_txt: vendaForm.condicoes_adicionais ?? '',
    })
  }, [
    vendaForm.condicao,
    vendaForm.condicoes_adicionais,
    vendaForm.prazo_execucao,
    vendaForm.taxa_mdr_credito_vista_pct,
    vendaForm.taxa_mdr_debito_pct,
    vendaForm.taxa_mdr_pix_pct,
    vendaForm.validade_proposta,
    recalcularTick,
  ])

  useEffect(() => {
    const deveEstimarQuantidade =
      !Number.isFinite(vendaForm.quantidade_modulos) || (vendaForm.quantidade_modulos ?? 0) <= 0

    let updated = false
    setVendaForm((prev) => {
      const next = { ...prev }
      const potenciaNormalizada = Math.round(potenciaInstaladaKwp * 100) / 100
      if (
        potenciaNormalizada > 0 &&
        !numbersAreClose(prev.potencia_instalada_kwp, potenciaNormalizada, 0.005)
      ) {
        next.potencia_instalada_kwp = potenciaNormalizada
        updated = true
      }

      const geracaoNormalizada = Math.round(geracaoMensalKwh * 10) / 10
      if (geracaoNormalizada > 0 && !numbersAreClose(prev.geracao_estimada_kwh_mes, geracaoNormalizada, 0.05)) {
        next.geracao_estimada_kwh_mes = geracaoNormalizada
        updated = true
      }

      if (
        deveEstimarQuantidade &&
        numeroModulosEstimado > 0 &&
        prev.quantidade_modulos !== numeroModulosEstimado
      ) {
        next.quantidade_modulos = numeroModulosEstimado
        updated = true
      }

      return updated ? next : prev
    })
    if (updated) {
      resetRetorno()
    }
  }, [
    geracaoMensalKwh,
    numeroModulosEstimado,
    potenciaInstaladaKwp,
    resetRetorno,
    vendaForm.quantidade_modulos,
    recalcularTick,
  ])

  useEffect(() => {
    const { hsp, pr } = vendaGeracaoParametros
    if (hsp <= 0 || pr <= 0) {
      return
    }

    const potenciaManualValida =
      Number.isFinite(vendaForm.potencia_instalada_kwp) && (vendaForm.potencia_instalada_kwp ?? 0) > 0
    const potenciaBase = potenciaManualValida
      ? Number(vendaForm.potencia_instalada_kwp)
      : vendaAutoPotenciaKwp ?? null

    if (!potenciaBase || potenciaBase <= 0) {
      return
    }

    const estimada = estimateMonthlyKWh(potenciaBase, vendaGeracaoParametros)
    if (estimada <= 0) {
      return
    }

    const potenciaNormalizadaAuto = vendaAutoPotenciaKwp
      ? Math.round(vendaAutoPotenciaKwp * 100) / 100
      : 0
    const geracaoNormalizadaAuto = Math.round(estimada * 10) / 10

    let consumoAtualizado = false
    let geracaoAtualizada = false

    setVendaForm((prev) => {
      const updates: Partial<VendaForm> = {}
      let changed = false

      if (
        potenciaNormalizadaAuto > 0 &&
        !numbersAreClose(prev.potencia_instalada_kwp, potenciaNormalizadaAuto, 0.005)
      ) {
        updates.potencia_instalada_kwp = potenciaNormalizadaAuto
        changed = true
      }

      if (
        geracaoNormalizadaAuto > 0 &&
        !numbersAreClose(prev.geracao_estimada_kwh_mes, geracaoNormalizadaAuto, 0.05)
      ) {
        updates.geracao_estimada_kwh_mes = geracaoNormalizadaAuto
        geracaoAtualizada = true
        changed = true
      }

      if (
        !consumoManual &&
        !numbersAreClose(prev.consumo_kwh_mes, geracaoNormalizadaAuto, 0.05)
      ) {
        updates.consumo_kwh_mes = geracaoNormalizadaAuto
        consumoAtualizado = true
        changed = true
      }

      if (!changed) {
        return prev
      }

      return { ...prev, ...updates }
    })

    if (consumoAtualizado) {
      setKcKwhMes(geracaoNormalizadaAuto)
      setVendaFormErrors((prev) => {
        if (!prev.consumo_kwh_mes) {
          return prev
        }
        const { consumo_kwh_mes: _omit, ...rest } = prev
        return rest
      })
    }

    if (geracaoAtualizada) {
      setVendaFormErrors((prev) => {
        if (!prev.geracao_estimada_kwh_mes) {
          return prev
        }
        const { geracao_estimada_kwh_mes: _omit, ...rest } = prev
        return rest
      })
    }
  }, [
    consumoManual,
    vendaAutoPotenciaKwp,
    vendaForm.potencia_instalada_kwp,
    vendaGeracaoParametros,
    setKcKwhMes,
    setVendaFormErrors,
    setVendaForm,
    recalcularTick,
  ])

  useEffect(() => {
    const consumoAnterior = consumoAnteriorRef.current
    if (consumoAnterior === kcKwhMes) {
      return
    }

    consumoAnteriorRef.current = kcKwhMes

    setNumeroModulosManual((valorAtual) => {
      if (valorAtual === '') {
        return valorAtual
      }

      if (kcKwhMes <= 0) {
        return ''
      }

      const valorArredondado = Math.round(Number(valorAtual))
      if (!Number.isFinite(valorArredondado)) {
        return ''
      }

      if (valorArredondado === numeroModulosCalculado) {
        return ''
      }

      return valorAtual
    })
  }, [kcKwhMes, numeroModulosCalculado, recalcularTick])

  const geracaoDiariaKwh = useMemo(
    () => (geracaoMensalKwh > 0 && diasMesNormalizado > 0 ? geracaoMensalKwh / diasMesNormalizado : 0),
    [geracaoMensalKwh, diasMesNormalizado],
  )

  const encargosFixos = useMemo(
    () => Math.max(0, bandeiraEncargo + cipEncargo + encargosFixosExtras),
    [bandeiraEncargo, cipEncargo, encargosFixosExtras],
  )

  const entradaConsiderada = isVendaDiretaTab ? 0 : entradaRs
  const descontoConsiderado = isVendaDiretaTab ? 0 : desconto
  const prazoMesesConsiderado = isVendaDiretaTab ? 0 : prazoMeses
  const leasingPrazoConsiderado = isVendaDiretaTab ? 0 : leasingPrazo

  const modoEntradaNormalizado = useMemo<EntradaModo>(() => {
    if (!entradaConsiderada || entradaConsiderada <= 0) return 'NONE'
    const label = (entradaModo ?? '').toLowerCase().trim()
    if (label.includes('crédito')) return 'CREDITO'
    if (label.includes('reduz')) return 'REDUZ'
    return 'NONE'
  }, [entradaConsiderada, entradaModo])

  const composicaoTelhadoCalculo = useMemo(() => {
    const input = {
      projeto: toNumberSafe(composicaoTelhado.projeto),
      instalacao: toNumberSafe(composicaoTelhado.instalacao),
      material_ca: toNumberSafe(composicaoTelhado.materialCa),
      crea: toNumberSafe(composicaoTelhado.crea),
      art: toNumberSafe(composicaoTelhado.art),
      placa: toNumberSafe(composicaoTelhado.placa),
      capex_base_manual: capexBaseManualValor ?? null,
      comissao_liquida_input: toNumberSafe(composicaoTelhado.comissaoLiquida),
      comissao_tipo: vendasConfig.comissao_default_tipo,
      comissao_percent_base: vendasConfig.comissao_percent_base,
      teto_comissao_percent: vendasConfig.teto_comissao_percent,
      margem_operacional_padrao_percent: vendasConfig.margem_operacional_padrao_percent,
      margem_manual_valor:
        margemManualAtiva && margemManualValor !== undefined ? margemManualValor : null,
      usar_margem_manual: margemManualAtiva,
      valor_total_orcamento: valorOrcamentoConsiderado,
      descontos: toNumberSafe(descontosValor),
      preco_minimo_percent_sobre_capex: vendasConfig.preco_minimo_percent_sobre_capex,
      arredondar_venda_para: arredondarPasso,
      desconto_max_percent_sem_aprovacao: vendasConfig.desconto_max_percent_sem_aprovacao,
      workflow_aprovacao_ativo: vendasConfig.workflow_aprovacao_ativo,
      regime: vendasConfig.regime_tributario_default,
      imposto_retido_aliquota: toNumberSafe(vendasConfig.imposto_retido_aliquota_default),
      incluirImpostosNoCAPEX: vendasConfig.incluirImpostosNoCAPEX_default,
      ...(vendasConfig.impostosRegime_overrides
        ? { impostosRegime: vendasConfig.impostosRegime_overrides }
        : {}),
    }

    return calcularComposicaoUFV(input)
  }, [
    capexBaseManualValor,
    arredondarPasso,
    composicaoTelhado.art,
    composicaoTelhado.crea,
    composicaoTelhado.instalacao,
    composicaoTelhado.materialCa,
    composicaoTelhado.placa,
    composicaoTelhado.projeto,
    composicaoTelhado.comissaoLiquida,
    descontosValor,
    margemManualAtiva,
    margemManualValor,
    valorOrcamentoConsiderado,
    vendasConfig.comissao_default_tipo,
    vendasConfig.comissao_percent_base,
    vendasConfig.teto_comissao_percent,
    vendasConfig.margem_operacional_padrao_percent,
    vendasConfig.preco_minimo_percent_sobre_capex,
    vendasConfig.desconto_max_percent_sem_aprovacao,
    vendasConfig.workflow_aprovacao_ativo,
    vendasConfig.regime_tributario_default,
    vendasConfig.imposto_retido_aliquota_default,
    vendasConfig.impostosRegime_overrides,
    vendasConfig.incluirImpostosNoCAPEX_default,
    recalcularTick,
  ])

  const composicaoSoloCalculo = useMemo(() => {
    const extrasSolo =
      toNumberSafe(composicaoSolo.estruturaSolo) +
      toNumberSafe(composicaoSolo.tela) +
      toNumberSafe(composicaoSolo.portaoTela) +
      toNumberSafe(composicaoSolo.maoObraTela) +
      toNumberSafe(composicaoSolo.casaInversor) +
      toNumberSafe(composicaoSolo.brita) +
      toNumberSafe(composicaoSolo.terraplanagem) +
      toNumberSafe(composicaoSolo.trafo) +
      toNumberSafe(composicaoSolo.rede)

    const input = {
      projeto: toNumberSafe(composicaoSolo.projeto),
      instalacao: toNumberSafe(composicaoSolo.instalacao),
      material_ca: toNumberSafe(composicaoSolo.materialCa) + extrasSolo,
      crea: toNumberSafe(composicaoSolo.crea),
      art: toNumberSafe(composicaoSolo.art),
      placa: toNumberSafe(composicaoSolo.placa),
      capex_base_manual: capexBaseManualValor ?? null,
      comissao_liquida_input: toNumberSafe(composicaoSolo.comissaoLiquida),
      comissao_tipo: vendasConfig.comissao_default_tipo,
      comissao_percent_base: vendasConfig.comissao_percent_base,
      teto_comissao_percent: vendasConfig.teto_comissao_percent,
      margem_operacional_padrao_percent: vendasConfig.margem_operacional_padrao_percent,
      margem_manual_valor:
        margemManualAtiva && margemManualValor !== undefined ? margemManualValor : null,
      usar_margem_manual: margemManualAtiva,
      valor_total_orcamento: valorOrcamentoConsiderado,
      descontos: toNumberSafe(descontosValor),
      preco_minimo_percent_sobre_capex: vendasConfig.preco_minimo_percent_sobre_capex,
      arredondar_venda_para: arredondarPasso,
      desconto_max_percent_sem_aprovacao: vendasConfig.desconto_max_percent_sem_aprovacao,
      workflow_aprovacao_ativo: vendasConfig.workflow_aprovacao_ativo,
      regime: vendasConfig.regime_tributario_default,
      imposto_retido_aliquota: toNumberSafe(vendasConfig.imposto_retido_aliquota_default),
      incluirImpostosNoCAPEX: vendasConfig.incluirImpostosNoCAPEX_default,
      ...(vendasConfig.impostosRegime_overrides
        ? { impostosRegime: vendasConfig.impostosRegime_overrides }
        : {}),
    }

    return calcularComposicaoUFV(input)
  }, [
    capexBaseManualValor,
    arredondarPasso,
    composicaoSolo.art,
    composicaoSolo.crea,
    composicaoSolo.instalacao,
    composicaoSolo.materialCa,
    composicaoSolo.placa,
    composicaoSolo.projeto,
    composicaoSolo.comissaoLiquida,
    composicaoSolo.estruturaSolo,
    composicaoSolo.tela,
    composicaoSolo.portaoTela,
    composicaoSolo.maoObraTela,
    composicaoSolo.casaInversor,
    composicaoSolo.brita,
    composicaoSolo.terraplanagem,
    composicaoSolo.trafo,
    composicaoSolo.rede,
    descontosValor,
    margemManualAtiva,
    margemManualValor,
    valorOrcamentoConsiderado,
    vendasConfig.comissao_default_tipo,
    vendasConfig.comissao_percent_base,
    vendasConfig.teto_comissao_percent,
    vendasConfig.margem_operacional_padrao_percent,
    vendasConfig.preco_minimo_percent_sobre_capex,
    vendasConfig.desconto_max_percent_sem_aprovacao,
    vendasConfig.workflow_aprovacao_ativo,
    vendasConfig.regime_tributario_default,
    vendasConfig.imposto_retido_aliquota_default,
    vendasConfig.impostosRegime_overrides,
    vendasConfig.incluirImpostosNoCAPEX_default,
    recalcularTick,
  ])

  const capexBaseResumoValor = useMemo(() => {
    if (typeof capexBaseManualValor === 'number') {
      return capexBaseManualValor
    }
    const calculoAtual = tipoInstalacao === 'SOLO' ? composicaoSoloCalculo : composicaoTelhadoCalculo
    const valor = calculoAtual?.capex_base
    return Number.isFinite(valor ?? Number.NaN) ? Math.max(0, Number(valor)) : 0
  }, [capexBaseManualValor, tipoInstalacao, composicaoSoloCalculo, composicaoTelhadoCalculo])

  const margemOperacionalResumoValor = useMemo(() => {
    if (margemManualAtiva && margemManualValor !== undefined) {
      return margemManualValor
    }
    const calculoAtual = tipoInstalacao === 'SOLO' ? composicaoSoloCalculo : composicaoTelhadoCalculo
    const valor = calculoAtual?.margem_operacional_valor
    if (!Number.isFinite(valor ?? Number.NaN)) {
      return null
    }
    return Math.round(Number(valor) * 100) / 100
  }, [
    margemManualAtiva,
    margemManualValor,
    tipoInstalacao,
    composicaoSoloCalculo?.margem_operacional_valor,
    composicaoTelhadoCalculo?.margem_operacional_valor,
  ])

  const handleMargemOperacionalResumoChange = useCallback(
    (valor: number | null) => {
      if (valor === null || !Number.isFinite(valor)) {
        handleMargemManualInput(null)
        return
      }
      const finalValue = normalizeCurrencyNumber(valor)
      if (finalValue === null) {
        handleMargemManualInput(null)
        return
      }
      handleMargemManualInput(finalValue)

      const capexBaseAtual =
        tipoInstalacao === 'SOLO'
          ? composicaoSoloCalculo?.capex_base
          : composicaoTelhadoCalculo?.capex_base

      const baseComOrcamento = (capexBaseAtual ?? 0) + Math.max(0, valorOrcamentoConsiderado)

      if (Number.isFinite(baseComOrcamento) && baseComOrcamento > 0) {
        const percent = (finalValue / baseComOrcamento) * 100
        const percentClamped = Math.min(Math.max(percent, 0), 80)
        const percentNormalizado = Math.round(percentClamped * 10000) / 10000
        if (
          !numbersAreClose(
            percentNormalizado,
            vendasConfig.margem_operacional_padrao_percent,
            0.0001,
          )
        ) {
          updateVendasConfig({ margem_operacional_padrao_percent: percentNormalizado })
        }
      }
    },
    [
      composicaoSoloCalculo?.capex_base,
      composicaoTelhadoCalculo?.capex_base,
      handleMargemManualInput,
      tipoInstalacao,
      updateVendasConfig,
      valorOrcamentoConsiderado,
      vendasConfig.margem_operacional_padrao_percent,
    ],
  )

  const capexBaseResumoField = useBRNumberField({
    mode: 'money',
    value: capexBaseResumoValor,
    onChange: handleCapexBaseResumoChange,
  })

  const capexBaseResumoSettingsField = useBRNumberField({
    mode: 'money',
    value: capexBaseResumoValor,
    onChange: handleCapexBaseResumoChange,
  })

  const margemOperacionalResumoField = useBRNumberField({
    mode: 'money',
    value: margemOperacionalResumoValor ?? null,
    onChange: handleMargemOperacionalResumoChange,
  })

  const margemOperacionalResumoSettingsField = useBRNumberField({
    mode: 'money',
    value: margemOperacionalResumoValor ?? null,
    onChange: handleMargemOperacionalResumoChange,
  })

  useEffect(() => {
    const calculoAtual = tipoInstalacao === 'SOLO' ? composicaoSoloCalculo : composicaoTelhadoCalculo
    const valores = calculoAtual ?? {
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
    }

    vendaActions.updateComposicao({
      ...valores,
      regime_breakdown: valores.regime_breakdown.map((item) => ({ ...item })),
      descontos: toNumberSafe(descontosValor),
    })
    const custoReferencia = Number.isFinite(valores.capex_total)
      ? Number(valores.capex_total)
      : null
    if (custoImplantacaoReferencia == null) {
      vendaActions.updateResumoProposta({ custo_implantacao_referencia: custoReferencia })
    }
  }, [
    descontosValor,
    composicaoSoloCalculo,
    composicaoTelhadoCalculo,
    custoImplantacaoReferencia,
    tipoInstalacao,
    recalcularTick,
  ])

  const composicaoTelhadoTotal = useMemo(() => {
    if (composicaoTelhadoCalculo) {
      return Math.round(composicaoTelhadoCalculo.venda_total * 100) / 100
    }
    return sumComposicaoValores(composicaoTelhado)
  }, [composicaoTelhadoCalculo, composicaoTelhado])

  const composicaoSoloTotal = useMemo(() => {
    if (composicaoSoloCalculo) {
      return Math.round(composicaoSoloCalculo.venda_total * 100) / 100
    }
    return sumComposicaoValores(composicaoSolo)
  }, [composicaoSoloCalculo, composicaoSolo])

  const composicaoTelhadoSubtotalSemLucro = useMemo(
    () =>
      sumComposicaoValoresExcluding(composicaoTelhado, [
        'lucroBruto',
        'comissaoLiquida',
        'impostoRetido',
      ]),
    [composicaoTelhado],
  )

  const composicaoSoloSubtotalSemLucro = useMemo(
    () =>
      sumComposicaoValoresExcluding(composicaoSolo, [
        'lucroBruto',
        'comissaoLiquida',
        'impostoRetido',
      ]),
    [composicaoSolo],
  )

  const valorVendaTelhado = useMemo(() => {
    const capexBaseCalculadoValor = Number(composicaoTelhadoCalculo?.capex_base)
    const capexBaseFallback =
      toNumberSafe(composicaoTelhado.projeto) +
      toNumberSafe(composicaoTelhado.instalacao) +
      toNumberSafe(composicaoTelhado.materialCa) +
      toNumberSafe(composicaoTelhado.crea) +
      toNumberSafe(composicaoTelhado.art) +
      toNumberSafe(composicaoTelhado.placa)
    const capexBase = Number.isFinite(capexBaseCalculadoValor)
      ? Math.max(0, capexBaseCalculadoValor)
      : Math.max(0, capexBaseFallback)

    const margemManualValorNormalizado = Number(margemManualValor)
    const margemManualNormalizada =
      margemManualAtiva && Number.isFinite(margemManualValorNormalizado)
        ? Math.max(0, margemManualValorNormalizado)
        : null
    const margemCalculadaValor = Number(
      composicaoTelhadoCalculo?.margem_operacional_valor,
    )
    const margemOperacional =
      margemManualNormalizada ??
      (Number.isFinite(margemCalculadaValor)
        ? Math.max(0, margemCalculadaValor)
        : Math.max(0, toNumberSafe(composicaoTelhado.lucroBruto)))

    const total =
      Math.max(0, valorOrcamentoConsiderado) + capexBase + margemOperacional

    return Math.round(total * 100) / 100
  }, [
    composicaoTelhado.art,
    composicaoTelhado.crea,
    composicaoTelhado.instalacao,
    composicaoTelhado.lucroBruto,
    composicaoTelhado.materialCa,
    composicaoTelhado.placa,
    composicaoTelhado.projeto,
    composicaoTelhadoCalculo?.capex_base,
    composicaoTelhadoCalculo?.margem_operacional_valor,
    margemManualAtiva,
    margemManualValor,
    valorOrcamentoConsiderado,
  ])

  const valorVendaSolo = useMemo(() => {
    const capexBaseCalculadoValor = Number(composicaoSoloCalculo?.capex_base)
    const extrasSolo =
      toNumberSafe(composicaoSolo.estruturaSolo) +
      toNumberSafe(composicaoSolo.tela) +
      toNumberSafe(composicaoSolo.portaoTela) +
      toNumberSafe(composicaoSolo.maoObraTela) +
      toNumberSafe(composicaoSolo.casaInversor) +
      toNumberSafe(composicaoSolo.brita) +
      toNumberSafe(composicaoSolo.terraplanagem) +
      toNumberSafe(composicaoSolo.trafo) +
      toNumberSafe(composicaoSolo.rede)
    const capexBaseFallback =
      toNumberSafe(composicaoSolo.projeto) +
      toNumberSafe(composicaoSolo.instalacao) +
      (toNumberSafe(composicaoSolo.materialCa) + extrasSolo) +
      toNumberSafe(composicaoSolo.crea) +
      toNumberSafe(composicaoSolo.art) +
      toNumberSafe(composicaoSolo.placa)
    const capexBase = Number.isFinite(capexBaseCalculadoValor)
      ? Math.max(0, capexBaseCalculadoValor)
      : Math.max(0, capexBaseFallback)

    const margemManualValorNormalizado = Number(margemManualValor)
    const margemManualNormalizada =
      margemManualAtiva && Number.isFinite(margemManualValorNormalizado)
        ? Math.max(0, margemManualValorNormalizado)
        : null
    const margemCalculadaValor = Number(
      composicaoSoloCalculo?.margem_operacional_valor,
    )
    const margemOperacional =
      margemManualNormalizada ??
      (Number.isFinite(margemCalculadaValor)
        ? Math.max(0, margemCalculadaValor)
        : Math.max(0, toNumberSafe(composicaoSolo.lucroBruto)))

    const total =
      Math.max(0, valorOrcamentoConsiderado) + capexBase + margemOperacional

    return Math.round(total * 100) / 100
  }, [
    composicaoSolo.art,
    composicaoSolo.brita,
    composicaoSolo.casaInversor,
    composicaoSolo.crea,
    composicaoSolo.instalacao,
    composicaoSolo.lucroBruto,
    composicaoSolo.maoObraTela,
    composicaoSolo.materialCa,
    composicaoSolo.placa,
    composicaoSolo.portaoTela,
    composicaoSolo.projeto,
    composicaoSolo.rede,
    composicaoSolo.estruturaSolo,
    composicaoSolo.tela,
    composicaoSolo.terraplanagem,
    composicaoSolo.trafo,
    composicaoSoloCalculo?.capex_base,
    composicaoSoloCalculo?.margem_operacional_valor,
    margemManualAtiva,
    margemManualValor,
    valorOrcamentoConsiderado,
  ])

  useEffect(() => {
    const margemCalculada =
      margemManualAtiva && margemManualValor !== undefined
        ? margemManualValor
        : (tipoInstalacao === 'SOLO'
            ? composicaoSoloCalculo?.margem_operacional_valor
            : composicaoTelhadoCalculo?.margem_operacional_valor) ?? 0
    setComposicaoTelhado((prev) =>
      numbersAreClose(prev.lucroBruto, margemCalculada) ? prev : { ...prev, lucroBruto: margemCalculada },
    )
    setComposicaoSolo((prev) =>
      numbersAreClose(prev.lucroBruto, margemCalculada) ? prev : { ...prev, lucroBruto: margemCalculada },
    )
  }, [
    margemManualAtiva,
    margemManualValor,
    composicaoTelhadoCalculo?.margem_operacional_valor,
    composicaoSoloCalculo?.margem_operacional_valor,
    tipoInstalacao,
    recalcularTick,
  ])

  const valorVendaAtual = tipoInstalacao === 'SOLO' ? valorVendaSolo : valorVendaTelhado

  const capex = useMemo(() => potenciaInstaladaKwp * precoPorKwp, [potenciaInstaladaKwp, precoPorKwp])

  const leasingValorDeMercadoEstimado = useLeasingValorDeMercadoEstimado()

  useEffect(() => {
    if (capexManualOverride) {
      return
    }
    const valorVendaBruto =
      Number.isFinite(valorVendaAtual) && valorVendaAtual > 0 ? valorVendaAtual : 0
    const normalizedCapex = Math.max(valorVendaBruto - descontosValor, 0)
    let changed = false
    setVendaForm((prev) => {
      if (Math.abs((prev.capex_total ?? 0) - normalizedCapex) < 0.005) {
        return prev
      }
      changed = true
      return { ...prev, capex_total: normalizedCapex }
    })
    if (changed) {
      setVendaFormErrors((prev) => {
        if (!prev.capex_total) {
          return prev
        }
        const { capex_total: _removed, ...rest } = prev
        return rest
      })
      resetRetorno()
    }
  }, [
    capexManualOverride,
    descontosValor,
    resetRetorno,
    valorVendaAtual,
    recalcularTick,
  ])

  const simulationState = useMemo<SimulationState>(() => {
    // Mantemos o valor de mercado (vm0) amarrado ao CAPEX calculado neste mesmo memo para
    // evitar dependências de ordem que poderiam reaparecer em merges futuros. Assim garantimos
    // uma única fonte de verdade entre a projeção principal e o fluxo de buyout.
    const valorMercadoBase = Math.max(0, capex)
    const descontoDecimal = Math.max(0, Math.min(descontoConsiderado / 100, 1))
    const inflacaoAnual = Math.max(-0.99, inflacaoAa / 100)
    const prazoContratualMeses = Math.max(0, Math.floor(prazoMesesConsiderado))
    const prazoLeasingMeses = Math.max(0, Math.floor(leasingPrazoConsiderado * 12))
    const prazoMensalidades = Math.max(prazoContratualMeses, prazoLeasingMeses)
    const tusdPercentual = Math.max(0, tusdPercent)
    const tusdSubtipoNormalizado = tusdSubtipo.trim()
    const tusdSimValue = tusdSimultaneidade != null ? Math.max(0, tusdSimultaneidade) : null
    const tusdTarifaValue = tusdTarifaRkwh != null ? Math.max(0, tusdTarifaRkwh) : null
    const tusdAno = Number.isFinite(tusdAnoReferencia)
      ? Math.max(1, Math.trunc(tusdAnoReferencia))
      : DEFAULT_TUSD_ANO_REFERENCIA
    return {
      kcKwhMes: Math.max(0, kcKwhMes),
      tarifaCheia: Math.max(0, tarifaCheia),
      desconto: descontoDecimal,
      inflacaoAa: inflacaoAnual,
      prazoMeses: prazoMensalidades,
      taxaMinima: Math.max(0, taxaMinima),
      encargosFixos,
      entradaRs: Math.max(0, entradaConsiderada),
      modoEntrada: modoEntradaNormalizado,
      vm0: valorMercadoBase,
      depreciacaoAa: Math.max(0, depreciacaoAa / 100),
      ipcaAa: Math.max(0, ipcaAa / 100),
      inadimplenciaAa: Math.max(0, inadimplenciaAa / 100),
      tributosAa: Math.max(0, tributosAa / 100),
      custosFixosM: Math.max(0, custosFixosM),
      opexM: Math.max(0, opexM),
      seguroM: Math.max(0, seguroM),
      cashbackPct: Math.max(0, cashbackPct / 100),
      pagosAcumManual: Math.max(0, pagosAcumAteM),
      duracaoMeses: Math.max(0, Math.floor(duracaoMeses)),
      geracaoMensalKwh: Math.max(0, geracaoMensalKwh),
      mesReajuste: Math.min(Math.max(Math.round(mesReajuste) || 6, 1), 12),
      mesReferencia: Math.min(Math.max(Math.round(mesReferencia) || 1, 1), 12),
      tusdPercent: tusdPercentual,
      tusdTipoCliente,
      tusdSubtipo: tusdSubtipoNormalizado.length > 0 ? tusdSubtipoNormalizado : null,
      tusdSimultaneidade: tusdSimValue,
      tusdTarifaRkwh: tusdTarifaValue,
      tusdAnoReferencia: tusdAno,
    }
  }, [
    bandeiraEncargo,
    capex,
    cashbackPct,
    cipEncargo,
    custosFixosM,
    descontoConsiderado,
    entradaConsiderada,
    geracaoMensalKwh,
    inflacaoAa,
    inadimplenciaAa,
    ipcaAa,
    kcKwhMes,
    mesReajuste,
    modoEntradaNormalizado,
    opexM,
    pagosAcumAteM,
    prazoMesesConsiderado,
    leasingPrazoConsiderado,
    seguroM,
    tarifaCheia,
    taxaMinima,
    tributosAa,
    encargosFixosExtras,
    depreciacaoAa,
    duracaoMeses,
    tusdPercent,
    tusdTipoCliente,
    tusdSubtipo,
    tusdSimultaneidade,
    tusdTarifaRkwh,
    tusdAnoReferencia,
  ])

  const vm0 = simulationState.vm0

  const inflacaoMensal = useMemo(() => selectInflacaoMensal(simulationState), [simulationState])
  const mensalidades = useMemo(() => selectMensalidades(simulationState), [simulationState])
  const mensalidadesPorAno = useMemo(() => selectMensalidadesPorAno(simulationState), [simulationState])
  const creditoEntradaMensal = useMemo(() => selectCreditoMensal(simulationState), [simulationState])
  const kcAjustado = useMemo(() => selectKcAjustado(simulationState), [simulationState])
  const buyoutLinhas = useMemo(() => selectBuyoutLinhas(simulationState), [simulationState])

  const tarifaAno = (ano: number) =>
    tarifaProjetadaCheia(
      simulationState.tarifaCheia,
      simulationState.inflacaoAa,
      (ano - 1) * 12 + 1,
      simulationState.mesReajuste,
      simulationState.mesReferencia,
    )
  const leasingBeneficios = useMemo(() => {
    const valorInvestimento = Math.max(0, vm0)
    const prazoLeasingValido = leasingPrazoConsiderado > 0 ? leasingPrazoConsiderado : null
    const economiaOpexAnual = prazoLeasingValido ? valorInvestimento * 0.015 : 0
    const investimentoDiluirAnual = prazoLeasingValido ? valorInvestimento / prazoLeasingValido : 0

    const contratoMeses = Math.max(0, Math.floor(leasingPrazoConsiderado * 12))
    const tusdTipoAtual = simulationState.tusdTipoCliente
    const tusdSubtipoAtual = simulationState.tusdSubtipo
    const tusdPercentAtual = simulationState.tusdPercent
    const tusdSimAtual = simulationState.tusdSimultaneidade
    const tusdTarifaAtual = simulationState.tusdTarifaRkwh
    const tusdAnoAtual = simulationState.tusdAnoReferencia

    return Array.from({ length: ANALISE_ANOS_PADRAO }, (_, i) => {
      const ano = i + 1
      const inicioMes = (ano - 1) * 12 + 1
      const fimMes = inicioMes + 11
      let economiaEnergia = 0

      for (let mes = inicioMes; mes <= fimMes; mes += 1) {
        const tarifaCheiaMes = tarifaProjetadaCheia(
          simulationState.tarifaCheia,
          simulationState.inflacaoAa,
          mes,
          simulationState.mesReajuste,
          simulationState.mesReferencia,
        )
        const tarifaDescontadaMes = tarifaDescontadaCalc(
          simulationState.tarifaCheia,
          simulationState.desconto,
          simulationState.inflacaoAa,
          mes,
          simulationState.mesReajuste,
          simulationState.mesReferencia,
        )
        const custoSemSistemaMes = kcKwhMes * tarifaCheiaMes + encargosFixos + taxaMinima
        const dentroPrazoMes = contratoMeses > 0 ? mes <= contratoMeses : false
        const custoComSistemaEnergiaMes = dentroPrazoMes ? kcKwhMes * tarifaDescontadaMes : 0
        const custoComSistemaBaseMes = custoComSistemaEnergiaMes + encargosFixos + taxaMinima
        const tusdMes = calcTusdEncargoMensal({
          consumoMensal_kWh: kcKwhMes,
          tarifaCheia_R_kWh: tarifaCheiaMes,
          mes,
          anoReferencia: tusdAnoAtual,
          tipoCliente: tusdTipoAtual,
          subTipo: tusdSubtipoAtual,
          pesoTUSD: tusdPercentAtual,
          tusd_R_kWh: tusdTarifaAtual,
          simultaneidadePadrao: tusdSimAtual,
        })
        economiaEnergia += custoSemSistemaMes - (custoComSistemaBaseMes + tusdMes)
      }

      const dentroPrazoLeasing = prazoLeasingValido ? ano <= leasingPrazoConsiderado : false
      const beneficioOpex = dentroPrazoLeasing ? economiaOpexAnual : 0
      const beneficioInvestimento = dentroPrazoLeasing ? investimentoDiluirAnual : 0
      return economiaEnergia + beneficioOpex + beneficioInvestimento
    })
  }, [
    ANALISE_ANOS_PADRAO,
    encargosFixos,
    kcKwhMes,
    leasingPrazoConsiderado,
    simulationState.desconto,
    simulationState.inflacaoAa,
    simulationState.mesReajuste,
    simulationState.mesReferencia,
    simulationState.tarifaCheia,
    taxaMinima,
    vm0,
  ])

  const leasingROI = useMemo(() => {
    const acc: number[] = []
    let acumulado = 0
    leasingBeneficios.forEach((beneficio) => {
      acumulado += beneficio
      acc.push(acumulado)
    })
    return acc
  }, [leasingBeneficios])

  const taxaMensalFin = useMemo(() => Math.pow(1 + jurosFinAa / 100, 1 / 12) - 1, [jurosFinAa])
  const entradaFin = useMemo(() => (capex * entradaFinPct) / 100, [capex, entradaFinPct])
  const valorFinanciado = useMemo(() => Math.max(0, capex - entradaFin), [capex, entradaFin])
  const pmt = useMemo(() => {
    if (valorFinanciado === 0) return 0
    if (prazoFinMeses <= 0) return 0
    if (taxaMensalFin === 0) return -(valorFinanciado / prazoFinMeses)
    const fator = Math.pow(1 + taxaMensalFin, prazoFinMeses)
    return -valorFinanciado * (taxaMensalFin * fator) / (fator - 1)
  }, [valorFinanciado, taxaMensalFin, prazoFinMeses])

  const custoOeM = (ano: number) => potenciaInstaladaKwp * oemBase * Math.pow(1 + oemInflacao / 100, ano - 1)
  const custoSeguro = (ano: number) => {
    if (seguroModo === 'A') {
      return potenciaInstaladaKwp * seguroValorA * Math.pow(1 + seguroReajuste / 100, ano - 1)
    }
    return vm0 * (seguroPercentualB / 100) * Math.pow(1 + seguroReajuste / 100, ano - 1)
  }

  const financiamentoFluxo = useMemo(() => {
    return Array.from({ length: ANALISE_ANOS_PADRAO }, (_, i) => {
      const ano = i + 1
      const economia = 12 * kcKwhMes * tarifaAno(ano)
      const custoSemSistemaMensal = Math.max(kcKwhMes * tarifaAno(ano), taxaMinima)
      const economiaAnual = 12 * Math.max(custoSemSistemaMensal - taxaMinima, 0)
      const inicioAno = (ano - 1) * 12
      const mesesRestantes = Math.max(0, prazoFinMeses - inicioAno)
      const mesesPagos = Math.min(12, mesesRestantes)
      const custoParcela = mesesPagos * Math.abs(pmt)
      const despesasSistema = custoParcela + custoOeM(ano) + custoSeguro(ano)
      return economiaAnual - despesasSistema
    })
  }, [kcKwhMes, inflacaoAa, jurosFinAa, oemBase, oemInflacao, pmt, prazoFinMeses, seguroModo, seguroPercentualB, seguroReajuste, seguroValorA, tarifaCheia, taxaMinima, vm0, potenciaInstaladaKwp])

  const financiamentoROI = useMemo(() => {
    const valores: number[] = []
    let acumulado = -entradaFin
    financiamentoFluxo.forEach((fluxo) => {
      acumulado += fluxo
      valores.push(acumulado)
    })
    return valores
  }, [entradaFin, financiamentoFluxo])

  const financiamentoMensalidades = useMemo(() => {
    const mesesValidos = Math.max(0, prazoFinMeses)
    const anos = Math.ceil(mesesValidos / 12)
    return Array.from({ length: anos }, () => Math.abs(pmt))
  }, [pmt, prazoFinMeses])

  const parcelaMensalFin = useMemo(() => Math.abs(pmt), [pmt])
  const taxaMensalFinPct = useMemo(() => taxaMensalFin * 100, [taxaMensalFin])
  const totalPagoFinanciamento = useMemo(
    () => entradaFin + parcelaMensalFin * Math.max(prazoFinMeses, 0),
    [entradaFin, parcelaMensalFin, prazoFinMeses],
  )

  const parcelasSolarInvest = useMemo(() => {
    const lista: MensalidadeRow[] = []
    let totalAcumulado = 0
    const kcContratado =
      simulationState.modoEntrada === 'REDUZ'
        ? kcAjustado
        : Math.max(0, simulationState.kcKwhMes)
    const leasingAtivo = kcContratado > 0
    const margemMinima = Math.max(0, simulationState.taxaMinima) + Math.max(0, simulationState.encargosFixos)
    const manutencaoPrevencaoSeguroMensal =
      leasingAtivo ? Math.max(0, (simulationState.vm0 * 0.015) / 12) : 0
    const limiteMeses = Math.max(0, Math.floor(leasingPrazoConsiderado * 12))
    const mesesConsiderados = limiteMeses > 0 ? Math.min(mensalidades.length, limiteMeses) : mensalidades.length

    for (let index = 0; index < mesesConsiderados; index += 1) {
      const mensalidade = mensalidades[index]
      const mes = index + 1
      const tarifaCheiaMes = tarifaProjetadaCheia(
        simulationState.tarifaCheia,
        simulationState.inflacaoAa,
        mes,
        simulationState.mesReajuste,
        simulationState.mesReferencia,
      )
      const tarifaDescontadaMes = selectTarifaDescontada(simulationState, mes)
      const energiaCheia = leasingAtivo ? Math.max(0, kcContratado * tarifaCheiaMes) : 0
      const mensalidadeCheia = Number(
        Math.max(0, energiaCheia + margemMinima + manutencaoPrevencaoSeguroMensal).toFixed(2),
      )
      const tusdMensal = calcTusdEncargoMensal({
        consumoMensal_kWh: kcContratado,
        tarifaCheia_R_kWh: tarifaCheiaMes,
        mes,
        anoReferencia: simulationState.tusdAnoReferencia ?? null,
        tipoCliente: simulationState.tusdTipoCliente ?? null,
        subTipo: simulationState.tusdSubtipo ?? null,
        pesoTUSD: simulationState.tusdPercent ?? null,
        tusd_R_kWh: simulationState.tusdTarifaRkwh ?? null,
        simultaneidadePadrao: simulationState.tusdSimultaneidade ?? null,
      })
      const tusdValor = Number(Math.max(0, tusdMensal).toFixed(2))
      totalAcumulado += mensalidade
      lista.push({
        mes,
        tarifaCheia: tarifaCheiaMes,
        tarifaDescontada: tarifaDescontadaMes,
        mensalidadeCheia,
        tusd: tusdValor,
        mensalidade: Number(mensalidade.toFixed(2)),
        totalAcumulado: Number(totalAcumulado.toFixed(2)),
      })
    }

    return {
      lista,
      tarifaDescontadaBase: selectTarifaDescontada(simulationState, 1),
      kcAjustado,
      creditoMensal: creditoEntradaMensal,
      margemMinima: simulationState.taxaMinima + simulationState.encargosFixos,
      prazoEfetivo: mesesConsiderados,
      totalPago: lista.length > 0 ? lista[lista.length - 1].totalAcumulado : 0,
      inflacaoMensal,
    }
  }, [
    creditoEntradaMensal,
    inflacaoMensal,
    kcAjustado,
    mensalidades,
    leasingPrazoConsiderado,
    simulationState,
  ])

  const leasingMensalidades = useMemo(() => {
    if (leasingPrazoConsiderado <= 0) {
      return []
    }
    if (mensalidadesPorAno.length === 0) {
      return []
    }

    return Array.from({ length: leasingPrazoConsiderado }, (_, index) => {
      const valor = mensalidadesPorAno[index]
      if (typeof valor === 'number') {
        return valor
      }
      const ultimo = mensalidadesPorAno[mensalidadesPorAno.length - 1]
      return typeof ultimo === 'number' ? ultimo : 0
    })
  }, [leasingPrazoConsiderado, mensalidadesPorAno])

  const tabelaBuyout = useMemo<BuyoutRow[]>(() => {
    const horizonte = Math.max(60, Math.floor(simulationState.duracaoMeses))
    const linhasPorMes = new Map<number, BuyoutLinha>()
    buyoutLinhas.forEach((linha) => {
      linhasPorMes.set(linha.mes, linha)
    })

    const rows: BuyoutRow[] = []
    let ultimoCashback = 0
    let ultimoPrestacao = 0
    for (let mes = 1; mes <= horizonte; mes += 1) {
      const linha = linhasPorMes.get(mes)
      if (linha) {
        ultimoCashback = linha.cashback
        ultimoPrestacao = linha.prestacaoAcum
        rows.push({
          mes,
          tarifa: linha.tarifaCheia,
          prestacaoEfetiva: linha.prestacaoEfetiva,
          prestacaoAcum: linha.prestacaoAcum,
          cashback: linha.cashback,
          valorResidual: mes >= 7 && mes <= Math.floor(simulationState.duracaoMeses) ? linha.valorResidual : null,
        })
      } else {
        const fator = Math.pow(1 + inflacaoMensal, Math.max(0, mes - 1))
        const tarifaProjetada = simulationState.tarifaCheia * fator
        rows.push({
          mes,
          tarifa: tarifaProjetada,
          prestacaoEfetiva: 0,
          prestacaoAcum: ultimoPrestacao,
          cashback: ultimoCashback,
          valorResidual: null,
        })
      }
    }

    const mesAceiteFinal = Math.floor(simulationState.duracaoMeses) + 1
    const tarifaAceite = simulationState.tarifaCheia * Math.pow(1 + inflacaoMensal, Math.max(0, mesAceiteFinal - 1))
    rows.push({
      mes: mesAceiteFinal,
      tarifa: tarifaAceite,
      prestacaoEfetiva: 0,
      prestacaoAcum: ultimoPrestacao,
      cashback: ultimoCashback,
      valorResidual: 0,
    })

    return rows
  }, [buyoutLinhas, inflacaoMensal, simulationState])
  const duracaoMesesNormalizada = Math.max(0, Math.floor(duracaoMeses))
  const buyoutMesAceiteFinal = duracaoMesesNormalizada + 1
  const duracaoMesesExibicao = Math.max(7, buyoutMesAceiteFinal)
  const buyoutAceiteFinal = tabelaBuyout.find((row) => row.mes === buyoutMesAceiteFinal) ?? null
  const buyoutReceitaRows = useMemo(
    () => tabelaBuyout.filter((row) => row.mes >= 7 && row.mes <= duracaoMesesNormalizada),
    [tabelaBuyout, duracaoMesesNormalizada],
  )

  const buyoutResumo: BuyoutResumo = {
    vm0,
    cashbackPct: cashbackPct,
    depreciacaoPct: depreciacaoAa,
    inadimplenciaPct: inadimplenciaAa,
    tributosPct: tributosAa,
    infEnergia: inflacaoAa,
    ipca: ipcaAa,
    custosFixos: custosFixosM,
    opex: opexM,
    seguro: seguroM,
    duracao: duracaoMeses,
  }

  const printableRef = useRef<HTMLDivElement>(null)
  const pendingPreviewDataRef = useRef<{ html: string; dados: PrintableProposalProps } | null>(null)

  const anosArray = useMemo(
    () => Array.from({ length: ANALISE_ANOS_PADRAO }, (_, i) => i + 1),
    [],
  )

  const vendaRetornoAuto = useMemo(() => {
    if (!isVendaDiretaTab) {
      return null
    }
    if (retornoProjetado) {
      return retornoProjetado
    }
    const errors = validateVendaForm(vendaForm)
    if (Object.keys(errors).length > 0) {
      return null
    }
    try {
      return computeROI(vendaForm)
    } catch (error) {
      console.warn('Não foi possível calcular o retorno para impressão.', error)
      return null
    }
  }, [isVendaDiretaTab, retornoProjetado, validateVendaForm, vendaForm])

  const economiaEstimativaValorCalculado = useMemo(() => {
    if (!isVendaDiretaTab) {
      return null
    }
    if (!vendaRetornoAuto || !Array.isArray(vendaRetornoAuto.economia)) {
      return null
    }
    const horizonteMeses = Math.max(1, ECONOMIA_ESTIMATIVA_PADRAO_ANOS * 12)
    const valores = vendaRetornoAuto.economia.slice(0, horizonteMeses)
    const total = valores.reduce((acc, valor) => acc + Math.max(0, Number(valor ?? 0)), 0)
    if (!Number.isFinite(total) || total <= 0) {
      return null
    }
    return total
  }, [isVendaDiretaTab, vendaRetornoAuto])

  useEffect(() => {
    if (!isVendaDiretaTab) {
      vendaActions.updateResumoProposta({
        economia_estimativa_valor: null,
        economia_estimativa_horizonte_anos: null,
      })
      return
    }
    vendaActions.updateResumoProposta({
      economia_estimativa_valor: economiaEstimativaValorCalculado,
      economia_estimativa_horizonte_anos:
        economiaEstimativaValorCalculado != null ? ECONOMIA_ESTIMATIVA_PADRAO_ANOS : null,
    })
  }, [economiaEstimativaValorCalculado, isVendaDiretaTab, recalcularTick])

  const printableData = useMemo<PrintableProposalProps>(
    () => {
      const vendaSnapshot = getVendaSnapshot()
      const capexFromStore = calculateCapexFromState(vendaSnapshot)
      const capexPrintable = capexFromStore > 0 ? capexFromStore : capex
      const potenciaInstaladaSnapshot = vendaSnapshot.configuracao.potencia_sistema_kwp
      const potenciaInstaladaPrintable = isVendaDiretaTab
        ? potenciaInstaladaSnapshot > 0
          ? potenciaInstaladaSnapshot
          : Number.isFinite(vendaForm.potencia_instalada_kwp)
          ? Number(vendaForm.potencia_instalada_kwp)
          : potenciaInstaladaKwp
        : potenciaInstaladaKwp
      const geracaoMensalSnapshot = vendaSnapshot.configuracao.geracao_estimada_kwh_mes
      const geracaoMensalPrintable = isVendaDiretaTab
        ? geracaoMensalSnapshot > 0
          ? geracaoMensalSnapshot
          : Number.isFinite(vendaForm.geracao_estimada_kwh_mes)
          ? Number(vendaForm.geracao_estimada_kwh_mes)
          : geracaoMensalKwh
        : geracaoMensalKwh
      const numeroModulosSnapshot = vendaSnapshot.configuracao.n_modulos
      const numeroModulosPrintable = isVendaDiretaTab
        ? numeroModulosSnapshot > 0
          ? numeroModulosSnapshot
          : Number.isFinite(vendaForm.quantidade_modulos)
          ? Math.max(0, Number(vendaForm.quantidade_modulos))
          : numeroModulosEstimado
        : numeroModulosEstimado
      const potenciaSnapshotState: PropostaState = {
        orcamento: {
          modulo: { potenciaW: vendaSnapshot.configuracao.potencia_modulo_wp },
        },
      }
      const potenciaAtualState: PropostaState = {
        orcamento: { modulo: { potenciaW: potenciaModulo } },
      }
      const potenciaModuloSnapshot = getPotenciaModuloW(potenciaSnapshotState)
      const potenciaModuloAtual = getPotenciaModuloW(potenciaAtualState)
      const potenciaModuloPrintable = isVendaDiretaTab
        ? potenciaModuloSnapshot > 0
          ? potenciaModuloSnapshot
          : potenciaModuloAtual
        : potenciaModuloAtual
      const tipoSistemaSnapshot = normalizeTipoSistemaValue(
        vendaSnapshot.configuracao.tipo_sistema,
      )
      const tipoSistemaFromForm = isVendaDiretaTab
        ? normalizeTipoSistemaValue(vendaForm.tipo_sistema)
        : undefined
      const tipoSistemaPrintable = tipoSistemaSnapshot ?? tipoSistemaFromForm ?? tipoSistema

      const vendaResumo = isVendaDiretaTab
        ? {
            form: { ...vendaForm },
            retorno: vendaRetornoAuto,
          }
        : undefined
      const sanitizedBudgetId = normalizeProposalId(currentBudgetId)
      const sanitizeItemText = (valor?: string | null) => {
        const trimmed = valor?.toString().trim() ?? ''
        return trimmed && trimmed !== '—' ? trimmed : undefined
      }
      const printableBudgetItems = budgetStructuredItems.map((item) => ({
        produto: sanitizeItemText(item.produto) ?? '',
        descricao: sanitizeItemText(item.descricao) ?? '',
        codigo: sanitizeItemText(item.codigo),
        modelo: sanitizeItemText(item.modelo),
        fabricante: sanitizeItemText(item.fabricante),
        quantidade: Number.isFinite(item.quantidade) ? Number(item.quantidade) : null,
        valorUnitario: Number.isFinite(item.precoUnitario) ? Number(item.precoUnitario) : null,
        valorTotal: Number.isFinite(item.precoTotal) ? Number(item.precoTotal) : null,
      }))

      const composicaoConfiguracaoResumo: UfvComposicaoConfiguracao = {
        comissaoTipo: vendasConfig.comissao_default_tipo,
        comissaoBase: vendasConfig.comissao_percent_base,
        margemPadraoPercent: vendasConfig.margem_operacional_padrao_percent,
        margemManualValor: margemManualAtiva && margemManualValor !== undefined ? margemManualValor : null,
        margemManualAtiva,
        descontos: toNumberSafe(descontosValor),
        regime: vendasConfig.regime_tributario_default,
        impostoRetidoAliquota: toNumberSafe(vendasConfig.imposto_retido_aliquota_default),
        incluirImpostosNoCapex: vendasConfig.incluirImpostosNoCAPEX_default,
        precoMinimoPercent: vendasConfig.preco_minimo_percent_sobre_capex,
        arredondarPasso: arredondarPasso,
      }

      const composicaoResumo: UfvComposicaoResumo = {
        telhado: { ...composicaoTelhado },
        solo: { ...composicaoSolo },
        totalTelhado: composicaoTelhadoTotal,
        totalSolo: composicaoSoloTotal,
        valorOrcamento: valorOrcamentoConsiderado,
        valorVendaTelhado,
        valorVendaSolo,
        tipoAtual: tipoInstalacao,
        calculoTelhado: composicaoTelhadoCalculo
          ? {
              ...composicaoTelhadoCalculo,
              regime_breakdown: composicaoTelhadoCalculo.regime_breakdown.map((item) => ({ ...item })),
            }
          : undefined,
        calculoSolo: composicaoSoloCalculo
          ? {
              ...composicaoSoloCalculo,
              regime_breakdown: composicaoSoloCalculo.regime_breakdown.map((item) => ({ ...item })),
            }
          : undefined,
        configuracao: composicaoConfiguracaoResumo,
      }

      const printableVendasConfig = {
        exibir_precos_unitarios: vendasConfig.exibir_precos_unitarios,
        exibir_margem: vendasConfig.exibir_margem,
        exibir_comissao: vendasConfig.exibir_comissao,
        exibir_impostos: vendasConfig.exibir_impostos,
        mostrar_quebra_impostos_no_pdf_cliente:
          vendasConfig.mostrar_quebra_impostos_no_pdf_cliente,
        observacao_padrao_proposta: vendasConfig.observacao_padrao_proposta,
      }

      return {
        cliente,
        budgetId: sanitizedBudgetId,
        anos: anosArray,
        leasingROI,
        financiamentoFluxo,
        financiamentoROI,
        mostrarFinanciamento,
        tabelaBuyout,
        buyoutResumo,
        mostrarTabelaBuyout: true,
        capex: capexPrintable,
        tipoProposta: isVendaDiretaTab ? 'VENDA_DIRETA' : 'LEASING',
        geracaoMensalKwh: geracaoMensalPrintable,
        potenciaModulo: potenciaModuloPrintable,
        numeroModulos: numeroModulosPrintable,
        potenciaInstaladaKwp: potenciaInstaladaPrintable,
        tipoInstalacao,
        tipoSistema: tipoSistemaPrintable,
        areaInstalacao,
        descontoContratualPct: descontoConsiderado,
        parcelasLeasing: isVendaDiretaTab ? [] : parcelasSolarInvest.lista,
        leasingValorDeMercadoEstimado: isVendaDiretaTab
          ? null
          : leasingValorDeMercadoEstimado || 0,
        leasingPrazoContratualMeses: isVendaDiretaTab
          ? null
          : Math.max(0, Math.round(leasingPrazoConsiderado * 12)),
        leasingValorInstalacaoCliente: isVendaDiretaTab ? null : 0,
        leasingDataInicioOperacao: isVendaDiretaTab ? null : null,
        leasingValorMercadoProjetado: isVendaDiretaTab ? null : buyoutResumo.vm0,
        leasingInflacaoEnergiaAa: isVendaDiretaTab ? null : inflacaoAa,
        leasingModeloInversor: isVendaDiretaTab
          ? null
          : sanitizeItemText(vendaForm.modelo_inversor) ?? null,
        leasingModeloModulo: isVendaDiretaTab
          ? null
          : sanitizeItemText(vendaForm.modelo_modulo) ?? null,
        distribuidoraTarifa:
          vendaSnapshot.parametros.distribuidora || distribuidoraTarifa || cliente.distribuidora || '',
        energiaContratadaKwh:
          vendaSnapshot.resultados.energia_contratada_kwh_mes ?? vendaSnapshot.parametros.consumo_kwh_mes ?? kcKwhMes,
        tarifaCheia:
          vendaSnapshot.parametros.tarifa_r_kwh > 0
            ? vendaSnapshot.parametros.tarifa_r_kwh
            : tarifaCheia,
        vendaResumo,
        parsedPdfVenda: parsedVendaPdf ? { ...parsedVendaPdf } : null,
        orcamentoItens: printableBudgetItems,
        composicaoUfv: composicaoResumo,
        vendaSnapshot,
        multiUcResumo: multiUcPrintableResumo,
        vendasConfigSnapshot: printableVendasConfig,
        informacoesImportantesObservacao: vendasConfig.observacao_padrao_proposta,
        valorTotalProposta: valorTotalPropostaNormalizado ?? valorTotalPropostaState ?? null,
        custoImplantacaoReferencia: (() => {
          const snapshotValor = Number(vendaSnapshot.resumoProposta.custo_implantacao_referencia ?? 0)
          if (Number.isFinite(snapshotValor) && snapshotValor > 0) {
            return snapshotValor
          }
          const referenciaValor = Number(custoImplantacaoReferencia ?? 0)
          if (Number.isFinite(referenciaValor) && referenciaValor > 0) {
            return referenciaValor
          }
          return null
        })(),
      }
    },
    [
      composicaoSolo,
      composicaoSoloTotal,
      composicaoTelhado,
      composicaoTelhadoTotal,
      composicaoSoloCalculo,
      composicaoTelhadoCalculo,
      vendasConfig.comissao_default_tipo,
      vendasConfig.comissao_percent_base,
      vendasConfig.teto_comissao_percent,
      vendasConfig.margem_operacional_padrao_percent,
      vendasConfig.preco_minimo_percent_sobre_capex,
      vendasConfig.desconto_max_percent_sem_aprovacao,
      vendasConfig.workflow_aprovacao_ativo,
      vendasConfig.regime_tributario_default,
      vendasConfig.imposto_retido_aliquota_default,
      vendasConfig.impostosRegime_overrides,
      vendasConfig.incluirImpostosNoCAPEX_default,
      vendasConfig.exibir_precos_unitarios,
      vendasConfig.exibir_margem,
      vendasConfig.exibir_comissao,
      vendasConfig.exibir_impostos,
      vendasConfig.mostrar_quebra_impostos_no_pdf_cliente,
      vendasConfig.observacao_padrao_proposta,
      margemManualAtiva,
      margemManualValor,
      descontosValor,
      arredondarPasso,
      areaInstalacao,
      currentBudgetId,
      anosArray,
      buyoutResumo,
      capex,
      cliente,
      descontoConsiderado,
      financiamentoFluxo,
      financiamentoROI,
      geracaoMensalKwh,
      kcKwhMes,
      leasingROI,
      mostrarFinanciamento,
      numeroModulosEstimado,
      parcelasSolarInvest,
      duracaoMeses,
      distribuidoraTarifa,
      tipoInstalacao,
      tipoSistema,
      valorOrcamentoConsiderado,
      valorVendaSolo,
      valorVendaTelhado,
      potenciaInstaladaKwp,
      potenciaModulo,
      tabelaBuyout,
      tarifaCheia,
      inflacaoAa,
      isVendaDiretaTab,
      vendaForm,
      vendaRetornoAuto,
      parsedVendaPdf,
      budgetStructuredItems,
      leasingValorDeMercadoEstimado,
      multiUcPrintableResumo,
      valorTotalPropostaNormalizado,
      valorTotalPropostaState,
      custoImplantacaoReferencia,
    ],
  )

  const openBudgetPreviewWindow = useCallback(
    (
      layoutHtml: string,
      {
        nomeCliente,
        budgetId,
        actionMessage,
        autoPrint,
        closeAfterPrint,
        initialMode,
        initialVariant = 'standard',
      }: BudgetPreviewOptions,
    ) => {
      if (!layoutHtml) {
        window.alert('Não foi possível preparar a visualização do orçamento selecionado.')
        return
      }

      const printWindow = window.open('', '_blank', 'width=1024,height=768')
      if (!printWindow) {
        window.alert('Não foi possível abrir a visualização. Verifique se o bloqueador de pop-ups está ativo.')
        return
      }

      const mensagemToolbar =
        actionMessage || 'Revise o conteúdo e utilize as ações para imprimir ou salvar como PDF.'
      const codigoHtml = `<p class="preview-toolbar-code${budgetId ? '' : ' is-hidden'}">Código do orçamento: <strong>${budgetId ?? ''}</strong></p>`

      const resolvedInitialMode: PrintMode =
        initialMode || (autoPrint ? (closeAfterPrint ? 'download' : 'print') : 'preview')

      const previewHtml = `<!DOCTYPE html>
        <html data-print-mode="${resolvedInitialMode}" data-print-variant="${initialVariant}">
          <head>
            <meta charset="utf-8" />
            <title>Proposta-${nomeCliente}</title>
            <style>
              ${printStyles}
              ${simplePrintStyles}
              body{padding-top:88px;}
              .preview-toolbar{position:fixed;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-start;gap:24px;background:#f8fafc;padding:16px 44px;border-bottom:1px solid #cbd5f5;box-shadow:0 2px 6px rgba(15,23,42,0.08);}
              .preview-toolbar-info{display:flex;flex-direction:column;gap:4px;max-width:65%;}
              .preview-toolbar-info h1{margin:0;font-size:18px;color:#0f172a;}
              .preview-toolbar-info p{margin:0;font-size:13px;color:#475569;}
              .preview-toolbar-code strong{color:#0f172a;}
              .preview-toolbar-code.is-hidden{display:none;}
              .preview-toolbar-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;}
              .preview-toolbar-actions button{background:#0f172a;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;}
              .preview-toolbar-actions button:hover{background:#1e293b;}
              .preview-toolbar-actions button.secondary{background:#e2e8f0;color:#0f172a;}
              .preview-toolbar-actions button.secondary:hover{background:#cbd5f5;color:#0f172a;}
              .preview-container{max-width:calc(210mm - 32mm);width:100%;margin:0 auto;padding:24px 0 40px;}
              @media print{
                body{padding-top:0;}
                .preview-toolbar{display:none;}
              }
            </style>
          </head>
          <body data-print-mode="${resolvedInitialMode}" data-print-variant="${initialVariant}">
            <div class="preview-toolbar">
              <div class="preview-toolbar-info">
                <h1>Pré-visualização da proposta</h1>
                <p>${mensagemToolbar}</p>
                ${codigoHtml}
              </div>
              <div class="preview-toolbar-actions">
                <button type="button" data-action="print">Imprimir</button>
                <button type="button" data-action="download">Baixar PDF</button>
                <button
                  type="button"
                  data-action="toggle-buyout"
                  class="secondary"
                  data-label-default="Tabela de buyout"
                  data-label-active="Voltar à proposta"
                  aria-pressed="false"
                >Tabela de buyout</button>
                <button type="button" data-action="toggle-variant" class="secondary" data-label-simple="Versão Simples" data-label-standard="Versão Completa" aria-pressed="${initialVariant === 'simple' ? 'true' : 'false'}">Versão Simples</button>
                <button type="button" data-action="close" class="secondary">Fechar</button>
              </div>
            </div>
            <div class="preview-container">${layoutHtml}</div>
            <script>
              (function(){
                var shouldAutoPrint = ${autoPrint ? 'true' : 'false'};
                var shouldCloseAfterPrint = ${closeAfterPrint ? 'true' : 'false'};
                var defaultMode = "${resolvedInitialMode}";
                var defaultVariant = "${initialVariant}";
                var currentVariant = defaultVariant;
                var setPrintMode = function(mode){
                  if(!mode){ return; }
                  document.body.setAttribute('data-print-mode', mode);
                  document.documentElement.setAttribute('data-print-mode', mode);
                };
                var resetPrintMode = function(){
                  document.body.setAttribute('data-print-mode', 'preview');
                  document.documentElement.setAttribute('data-print-mode', 'preview');
                };
                setPrintMode(defaultMode);
                var printBtn = document.querySelector('[data-action=\"print\"]');
                var downloadBtn = document.querySelector('[data-action=\"download\"]');
                var closeBtn = document.querySelector('[data-action=\"close\"]');
                var variantToggleBtn = document.querySelector('[data-action=\"toggle-variant\"]');
                var buyoutToggleBtn = document.querySelector('[data-action=\"toggle-buyout\"]');
                var previewContainer = document.querySelector('.preview-container');
                var codigoNode = document.querySelector('.preview-toolbar-code');
                var hasBuyoutSection = Boolean(document.querySelector('[data-print-section=\"buyout\"]'));
                var buyoutDefaultLabel = buyoutToggleBtn ? (buyoutToggleBtn.getAttribute('data-label-default') || 'Tabela de buyout') : 'Tabela de buyout';
                var buyoutActiveLabel = buyoutToggleBtn ? (buyoutToggleBtn.getAttribute('data-label-active') || 'Voltar à proposta') : 'Voltar à proposta';
                var previousNonBuyoutVariant = defaultVariant === 'buyout' ? 'standard' : defaultVariant;
                var updateToolbarCode = function(code){
                  if(!codigoNode){ return; }
                  var strong = codigoNode.querySelector('strong');
                  var texto = (code || '').toString().trim();
                  if(strong){ strong.textContent = texto; }
                  if(texto){
                    codigoNode.classList.remove('is-hidden');
                  } else {
                    codigoNode.classList.add('is-hidden');
                  }
                };
                var replacePreviewContent = function(html){
                  if(!previewContainer || typeof html !== 'string'){ return; }
                  previewContainer.innerHTML = html;
                };
                var requestAction = function(mode){
                  try {
                    if(!window.opener){
                      return Promise.resolve({ proceed: true });
                    }
                    var handler = window.opener.__solarinvestOnPreviewAction;
                    if(typeof handler !== 'function'){
                      return Promise.resolve({ proceed: true });
                    }
                    var result = handler({ action: mode });
                    return Promise.resolve(result);
                  } catch (error) {
                    console.warn('Não foi possível comunicar com a janela principal.', error);
                    return Promise.resolve({ proceed: true });
                  }
                };
                var performAction = function(mode){
                  requestAction(mode).then(function(response){
                    if(response && typeof response === 'object'){
                      if(typeof response.updatedHtml === 'string' && response.updatedHtml){
                        replacePreviewContent(response.updatedHtml);
                      }
                      if(typeof response.budgetId === 'string'){
                        updateToolbarCode(response.budgetId);
                      }
                      if(response.proceed === false){
                        resetPrintMode();
                        return;
                      }
                    }
                    setPrintMode(mode === 'download' ? 'download' : 'print');
                    window.print();
                  });
                };
                var updateBuyoutToggleState = function(){
                  if(!buyoutToggleBtn){ return; }
                  if(!hasBuyoutSection){
                    buyoutToggleBtn.style.display = 'none';
                    buyoutToggleBtn.setAttribute('aria-hidden', 'true');
                    buyoutToggleBtn.setAttribute('tabindex', '-1');
                    return;
                  }
                  buyoutToggleBtn.style.display = '';
                  buyoutToggleBtn.removeAttribute('aria-hidden');
                  buyoutToggleBtn.removeAttribute('tabindex');
                  var isBuyout = currentVariant === 'buyout';
                  buyoutToggleBtn.setAttribute('aria-pressed', isBuyout ? 'true' : 'false');
                  buyoutToggleBtn.textContent = isBuyout ? buyoutActiveLabel : buyoutDefaultLabel;
                };
                var setVariant = function(nextVariant){
                  var normalized;
                  if(nextVariant === 'simple'){
                    normalized = 'simple';
                  } else if(nextVariant === 'buyout' && hasBuyoutSection){
                    normalized = 'buyout';
                  } else {
                    normalized = 'standard';
                  }
                  if(normalized !== 'buyout'){
                    previousNonBuyoutVariant = normalized;
                  }
                  currentVariant = normalized;
                  document.body.setAttribute('data-print-variant', currentVariant);
                  document.documentElement.setAttribute('data-print-variant', currentVariant);
                  if(variantToggleBtn){
                    var isSimple = currentVariant === 'simple';
                    var simpleLabel = variantToggleBtn.getAttribute('data-label-simple') || 'Versão Simples';
                    var standardLabel = variantToggleBtn.getAttribute('data-label-standard') || 'Versão Completa';
                    variantToggleBtn.textContent = isSimple ? standardLabel : simpleLabel;
                    variantToggleBtn.setAttribute('aria-pressed', isSimple ? 'true' : 'false');
                    variantToggleBtn.title = isSimple ? 'Retornar ao layout completo' : 'Visual simplificado para impressão em preto e branco';
                  }
                  updateBuyoutToggleState();
                };
                setVariant(defaultVariant);
                updateBuyoutToggleState();
                if(printBtn){
                  printBtn.addEventListener('click', function(){ performAction('print'); });
                }
                if(downloadBtn){
                  downloadBtn.addEventListener('click', function(){ performAction('download'); });
                }
                if(closeBtn){
                  closeBtn.addEventListener('click', function(){ window.close(); });
                }
                if(variantToggleBtn){
                  variantToggleBtn.addEventListener('click', function(){
                    setVariant(currentVariant === 'simple' ? 'standard' : 'simple');
                  });
                }
                if(buyoutToggleBtn && hasBuyoutSection){
                  buyoutToggleBtn.addEventListener('click', function(){
                    if(currentVariant === 'buyout'){
                      var fallbackVariant = previousNonBuyoutVariant && previousNonBuyoutVariant !== 'buyout' ? previousNonBuyoutVariant : (defaultVariant === 'simple' ? 'simple' : 'standard');
                      setVariant(fallbackVariant);
                    } else {
                      setVariant('buyout');
                    }
                  });
                }
                window.addEventListener('beforeprint', function(){
                  if(document.body.getAttribute('data-print-mode') === 'preview'){
                    setPrintMode('print');
                  }
                });
                window.addEventListener('afterprint', function(){
                  if(shouldCloseAfterPrint){
                    window.setTimeout(function(){ window.close(); }, 180);
                  } else {
                    resetPrintMode();
                  }
                });
                if(shouldAutoPrint){
                  window.addEventListener('load', function(){
                    window.setTimeout(function(){
                      var autoMode = defaultMode && defaultMode !== 'preview' ? defaultMode : (shouldCloseAfterPrint ? 'download' : 'print');
                      performAction(autoMode === 'download' ? 'download' : 'print');
                    }, 320);
                  });
                }
              })();
            </script>
          </body>
        </html>`

      const { document } = printWindow
      document.open()
      document.write(previewHtml)
      document.close()
      printWindow.focus()
    },
    [],
  )

  const prepararPropostaParaExportacao = useCallback(async (options?: { incluirTabelaBuyout?: boolean }) => {
    const dadosParaImpressao = clonePrintableData(printableData)
    if (options?.incluirTabelaBuyout === false) {
      dadosParaImpressao.mostrarTabelaBuyout = false
    }
    let layoutHtml: string | null = null

    try {
      layoutHtml = await renderPrintableProposalToHtml(dadosParaImpressao)
    } catch (error) {
      console.error('Erro ao preparar a proposta para exportação.', error)
    }

    if (!layoutHtml) {
      const node = printableRef.current
      if (node) {
        const clone = node.cloneNode(true) as HTMLElement
        if (options?.incluirTabelaBuyout === false) {
          clone.querySelectorAll('[data-print-section="buyout"]').forEach((element) => {
            element.parentElement?.removeChild(element)
          })
        }
        const codigoDd = clone.querySelector('.print-client-grid .print-client-field:first-child dd')
        if (codigoDd && dadosParaImpressao.budgetId) {
          codigoDd.textContent = dadosParaImpressao.budgetId
        }
        layoutHtml = clone.outerHTML
      }
    }

    if (!layoutHtml) {
      return null
    }

    return { html: layoutHtml, dados: dadosParaImpressao }
  }, [printableData])

  const validarCamposObrigatorios = useCallback(
    (acao: string = 'exportar') => {
      const faltantes = CAMPOS_CLIENTE_OBRIGATORIOS.filter(({ key }) => !cliente[key].trim())
      if (faltantes.length > 0) {
        const mensagem = `Preencha os campos obrigatórios antes de ${acao}: ${faltantes
          .map((campo) => campo.label)
          .join(', ')}`
        window.alert(mensagem)
        return false
      }
      if (isVendaDiretaTab) {
        if (valorTotalPropostaNormalizado == null) {
          window.alert('Informe o Valor total da proposta para concluir a emissão.')
          return false
        }
      }
      return true
    },
    [cliente, isVendaDiretaTab, valorTotalPropostaNormalizado],
  )

  const mapClienteRegistroToSyncPayload = (registro: ClienteRegistro): ClienteRegistroSyncPayload => ({
    id: registro.id,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
    dados: { ...registro.dados },
  })

  const carregarClientesSalvos = useCallback((): ClienteRegistro[] => {
    if (typeof window === 'undefined') {
      return []
    }

    const existenteRaw = window.localStorage.getItem(CLIENTES_STORAGE_KEY)
    if (!existenteRaw) {
      return []
    }

    try {
      const parsed = JSON.parse(existenteRaw)
      if (!Array.isArray(parsed)) {
        return []
      }

      const agora = new Date().toISOString()
      const existingIds = new Set<string>()
      let houveAtualizacaoIds = false

      const normalizados = parsed.map((item) => {
        const registro = item as Partial<ClienteRegistro> & { dados?: Partial<ClienteDados> }
        const dados = registro.dados ?? (registro as unknown as { cliente?: Partial<ClienteDados> }).cliente ?? {}
        const rawId = (registro.id ?? '').toString()
        const sanitizedCandidate = normalizeClienteIdCandidate(rawId)
        const idNormalizado = ensureClienteId(rawId, existingIds)
        if (idNormalizado !== sanitizedCandidate || rawId.trim() !== idNormalizado) {
          houveAtualizacaoIds = true
        }

        const temIndicacaoRaw = (dados as { temIndicacao?: unknown }).temIndicacao
        const indicacaoNomeRaw = (dados as { indicacaoNome?: unknown }).indicacaoNome
        const temIndicacaoNormalizado =
          typeof temIndicacaoRaw === 'boolean'
            ? temIndicacaoRaw
            : typeof temIndicacaoRaw === 'string'
            ? ['1', 'true', 'sim'].includes(temIndicacaoRaw.trim().toLowerCase())
            : false
        const indicacaoNomeNormalizado =
          typeof indicacaoNomeRaw === 'string' ? indicacaoNomeRaw.trim() : ''

        const normalizado: ClienteRegistro = {
          id: idNormalizado,
          criadoEm: registro.criadoEm ?? agora,
          atualizadoEm: registro.atualizadoEm ?? registro.criadoEm ?? agora,
          dados: {
            nome: dados?.nome ?? '',
            documento: dados?.documento ?? '',
            email: dados?.email ?? '',
            telefone: dados?.telefone ?? '',
            cep: dados?.cep ?? '',
            distribuidora: dados?.distribuidora ?? '',
            uc: dados?.uc ?? '',
            endereco: dados?.endereco ?? '',
            cidade: dados?.cidade ?? '',
            uf: dados?.uf ?? '',
            temIndicacao: temIndicacaoNormalizado,
            indicacaoNome: temIndicacaoNormalizado ? indicacaoNomeNormalizado : '',
          },
        }
        return normalizado
      })

      const ordenados = normalizados.sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1))

      if (houveAtualizacaoIds) {
        try {
          window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(ordenados))
        } catch (error) {
          console.warn('Não foi possível atualizar os identificadores dos clientes salvos.', error)
        }
      }

      return ordenados
    } catch (error) {
      console.warn('Não foi possível interpretar os clientes salvos existentes.', error)
      return []
    }
  }, [])

  useEffect(() => {
    const registros = carregarClientesSalvos()
    setClientesSalvos(registros)
  }, [carregarClientesSalvos])

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') {
        return
      }

      Object.values(notificacaoTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
    }
  }, [])

  const removerNotificacao = useCallback((id: number) => {
    setNotificacoes((prev) => prev.filter((item) => item.id !== id))

    const timeoutId = notificacaoTimeoutsRef.current[id]
    if (timeoutId && typeof window !== 'undefined') {
      window.clearTimeout(timeoutId)
    }
    delete notificacaoTimeoutsRef.current[id]
  }, [])

  const adicionarNotificacao = useCallback(
    (mensagem: string, tipo: NotificacaoTipo = 'info') => {
      notificacaoSequencialRef.current += 1
      const id = notificacaoSequencialRef.current

      setNotificacoes((prev) => [...prev, { id, mensagem, tipo }])

      if (typeof window !== 'undefined') {
        const timeoutId = window.setTimeout(() => removerNotificacao(id), 5000)
        notificacaoTimeoutsRef.current[id] = timeoutId
      }
    },
    [removerNotificacao],
  )

  /**
   * Centralizamos a persistência do dataset do CRM. Sempre que algo mudar salvamos
   * uma cópia no navegador e, se estivermos conectados ao backend oficial, enviamos
   * o snapshot atualizado.
   */
  const persistCrmDataset = useCallback(
    async (dataset: CrmDataset, origem: 'auto' | 'manual' = 'auto') => {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(CRM_LOCAL_STORAGE_KEY, JSON.stringify(dataset))
        } catch (error) {
          console.warn('Não foi possível persistir o dataset do CRM no localStorage.', error)
        }
      }

      if (crmIntegrationModeRef.current !== 'remote') {
        return
      }

      try {
        setCrmIsSaving(true)
        const response = await fetch(`${CRM_BACKEND_BASE_URL}/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dataset, origem }),
        })

        if (!response.ok) {
          throw new Error(`Falha ao sincronizar dataset do CRM (status ${response.status})`)
        }

        setCrmBackendStatus('success')
        setCrmBackendError(null)
        setCrmLastSync(new Date())
      } catch (error) {
        console.warn('Erro ao sincronizar CRM remoto, mantendo operação local.', error)
        setCrmBackendStatus('error')
        setCrmBackendError(error instanceof Error ? error.message : 'Erro inesperado ao sincronizar CRM')
        setCrmIntegrationMode('local')
        adicionarNotificacao('Backend do CRM indisponível, utilizando persistência local.', 'error')
      } finally {
        setCrmIsSaving(false)
      }
    },
    [adicionarNotificacao],
  )

  useEffect(() => {
    void persistCrmDataset(crmDataset)
  }, [crmDataset, persistCrmDataset])

  const crmLeadSelecionado = useMemo(
    () => crmDataset.leads.find((lead) => lead.id === crmLeadSelecionadoId) ?? null,
    [crmDataset.leads, crmLeadSelecionadoId],
  )

  useEffect(() => {
    if (!crmLeadSelecionado) {
      setCrmContratoForm((prev) => ({
        ...prev,
        leadId: '',
        modelo: 'LEASING',
        valorTotal: '',
        entrada: '',
        parcelas: '36',
        valorParcela: '',
        reajusteAnualPct: '3',
      }))
      setCrmCustosForm({ equipamentos: '', maoDeObra: '', deslocamento: '', taxasSeguros: '' })
      setCrmManutencaoForm((prev) => ({ ...prev, leadId: '' }))
      setCrmLancamentoForm((prev) => ({ ...prev, leadId: '' }))
      return
    }

    const contrato = crmDataset.contratos.find((item) => item.leadId === crmLeadSelecionado.id)
    setCrmContratoForm({
      leadId: crmLeadSelecionado.id,
      modelo: contrato?.modelo ?? crmLeadSelecionado.tipoOperacao,
      valorTotal: contrato ? String(contrato.valorTotal) : crmLeadSelecionado.valorEstimado.toString(),
      entrada: contrato ? String(contrato.entrada) : '0',
      parcelas: contrato ? String(contrato.parcelas) : crmLeadSelecionado.tipoOperacao === 'LEASING' ? '60' : '1',
      valorParcela: contrato ? String(contrato.valorParcela) : '0',
      reajusteAnualPct: contrato ? String(contrato.reajusteAnualPct) : '3',
      vencimentoInicialIso: contrato
        ? contrato.vencimentoInicialIso.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      status: contrato?.status ?? 'em-aberto',
    })

    const custos = crmDataset.custos.find((item) => item.leadId === crmLeadSelecionado.id)
    setCrmCustosForm({
      equipamentos: custos ? String(custos.equipamentos) : '',
      maoDeObra: custos ? String(custos.maoDeObra) : '',
      deslocamento: custos ? String(custos.deslocamento) : '',
      taxasSeguros: custos ? String(custos.taxasSeguros) : '',
    })

    setCrmManutencaoForm((prev) => ({
      ...prev,
      leadId: crmLeadSelecionado.id,
      dataIso: prev.dataIso || new Date().toISOString().slice(0, 10),
    }))

    setCrmLancamentoForm((prev) => ({
      ...prev,
      leadId: crmLeadSelecionado.id,
    }))
  }, [crmDataset.contratos, crmDataset.custos, crmLeadSelecionado])

  const crmLeadsFiltrados = useMemo(() => {
    const termoNormalizado = crmBusca ? normalizeText(crmBusca) : ''
    const numerosBusca = crmBusca ? normalizeNumbers(crmBusca) : ''

    return crmDataset.leads.filter((lead) => {
      const correspondeOperacao = crmFiltroOperacao === 'all' || lead.tipoOperacao === crmFiltroOperacao

      if (!correspondeOperacao) {
        return false
      }

      if (!termoNormalizado && !numerosBusca) {
        return true
      }

      const camposTexto = [lead.nome, lead.cidade, lead.tipoImovel, lead.origemLead]
      const encontrouTexto = termoNormalizado
        ? camposTexto.some((campo) => normalizeText(campo).includes(termoNormalizado))
        : false

      const encontrouTelefone = numerosBusca
        ? normalizeNumbers(lead.telefone).includes(numerosBusca)
        : false

      return encontrouTexto || encontrouTelefone
    })
  }, [crmDataset.leads, crmBusca, crmFiltroOperacao])

  const crmLeadsPorEtapa = useMemo(() => {
    const agrupado: Record<CrmStageId, CrmLeadRecord[]> = CRM_PIPELINE_STAGES.reduce(
      (acc, stage) => {
        acc[stage.id] = []
        return acc
      },
      {} as Record<CrmStageId, CrmLeadRecord[]>,
    )

    crmLeadsFiltrados.forEach((lead) => {
      agrupado[lead.etapa]?.push(lead)
    })

    CRM_PIPELINE_STAGES.forEach((stage) => {
      agrupado[stage.id].sort((a, b) => (a.ultimoContatoIso < b.ultimoContatoIso ? 1 : -1))
    })

    return agrupado
  }, [crmLeadsFiltrados])

  const crmKpis = useMemo(() => {
    const totalLeads = crmDataset.leads.length
    const leadsFechados = crmDataset.leads.filter((lead) => lead.etapa === 'fechado')
    const stageAguardandoIndex = CRM_STAGE_INDEX['aguardando-contrato']
    const leadsComContrato = crmDataset.leads.filter(
      (lead) => CRM_STAGE_INDEX[lead.etapa] >= stageAguardandoIndex,
    )

    const receitaRecorrente = leadsComContrato
      .filter((lead) => lead.tipoOperacao === 'LEASING')
      .reduce((total, lead) => total + lead.valorEstimado, 0)

    const receitaPontual = leadsFechados
      .filter((lead) => lead.tipoOperacao === 'VENDA_DIRETA')
      .reduce((total, lead) => total + lead.valorEstimado, 0)

    const leadsEmRisco = crmDataset.leads.filter((lead) => {
      const diasSemContato = diasDesdeDataIso(lead.ultimoContatoIso)
      const indiceEtapa = CRM_STAGE_INDEX[lead.etapa]
      return indiceEtapa >= CRM_STAGE_INDEX['proposta-enviada'] && indiceEtapa <= CRM_STAGE_INDEX['negociacao'] && diasSemContato >= 3
    })

    return {
      totalLeads,
      leadsFechados: leadsFechados.length,
      receitaRecorrente,
      receitaPontual,
      leadsEmRisco: leadsEmRisco.length,
    }
  }, [crmDataset.leads])

  const crmFinanceiroResumo = useMemo(() => {
    const entradas = crmDataset.lancamentos
      .filter((item) => item.tipo === 'entrada')
      .reduce((total, item) => total + item.valor, 0)
    const saidas = crmDataset.lancamentos
      .filter((item) => item.tipo === 'saida')
      .reduce((total, item) => total + item.valor, 0)
    const saldo = entradas - saidas

    const agrupadoPorDia = crmDataset.lancamentos.reduce(
      (acc, item) => {
        const dia = item.dataIso.slice(0, 10)
        if (!acc[dia]) {
          acc[dia] = { entradas: 0, saidas: 0 }
        }
        if (item.tipo === 'entrada') {
          acc[dia].entradas += item.valor
        } else {
          acc[dia].saidas += item.valor
        }
        return acc
      },
      {} as Record<string, { entradas: number; saidas: number }>,
    )

    let saldoAcumulado = 0
    const fluxoOrdenado = Object.entries(agrupadoPorDia)
      .sort(([dataA], [dataB]) => (dataA < dataB ? -1 : 1))
      .map(([data, valores]) => {
        const saldoDia = valores.entradas - valores.saidas
        saldoAcumulado += saldoDia
        return {
          data,
          entradas: valores.entradas,
          saidas: valores.saidas,
          saldoAcumulado,
        }
      })

    const contratosLeasing = crmDataset.contratos.filter((contrato) => contrato.modelo === 'LEASING')
    const contratosVenda = crmDataset.contratos.filter((contrato) => contrato.modelo === 'VENDA_DIRETA')

    const previsaoLeasing = contratosLeasing.reduce(
      (total, contrato) => total + contrato.valorParcela * Math.max(0, contrato.parcelas),
      0,
    )
    const previsaoVendas = contratosVenda.reduce((total, contrato) => total + contrato.valorTotal, 0)
    const inadimplentes = crmDataset.contratos.filter((contrato) => contrato.status === 'inadimplente').length
    const contratosAtivos = crmDataset.contratos.filter((contrato) => contrato.status === 'ativo').length

    const margens = crmDataset.leads.map((lead) => {
      const custos = crmDataset.custos.find((item) => item.leadId === lead.id)
      const custoTotal = custos
        ? custos.equipamentos + custos.maoDeObra + custos.deslocamento + custos.taxasSeguros
        : 0
      const margemBruta = lead.valorEstimado - custoTotal
      const margemPct = custoTotal > 0 ? (margemBruta / custoTotal) * 100 : null
      const roi = custoTotal > 0 ? (lead.valorEstimado - custoTotal) / custoTotal : null
      return {
        leadId: lead.id,
        leadNome: lead.nome,
        margemBruta,
        margemPct,
        custoTotal,
        receitaProjetada: lead.valorEstimado,
        roi,
        modelo: lead.tipoOperacao,
      }
    })

    margens.sort((a, b) => b.margemBruta - a.margemBruta)

    return {
      entradas,
      saidas,
      saldo,
      fluxoOrdenado,
      previsaoLeasing,
      previsaoVendas,
      inadimplentes,
      contratosAtivos,
      margens: margens.slice(0, 8),
    }
  }, [crmDataset.contratos, crmDataset.custos, crmDataset.lancamentos, crmDataset.leads])

  const crmPosVendaResumo = useMemo(() => {
    // Quantifica todas as manutenções cadastradas para criar os alertas de pós-venda.
    const totalManutencoes = crmDataset.manutencoes.length
    const pendentes = crmDataset.manutencoes.filter((item) => item.status === 'pendente')
    const concluidas = crmDataset.manutencoes.filter((item) => item.status === 'concluida')

    // Ordenamos as próximas visitas técnicas para que o gestor visualize rapidamente o que está por vir.
    const proximas = [...pendentes]
      .sort((a, b) => (a.dataIso < b.dataIso ? -1 : 1))
      .slice(0, 6)

    // Simulamos os dados de geração utilizando o consumo informado pelo lead.
    const geracao = crmDataset.leads
      .filter((lead) => lead.etapa === 'fechado')
      .slice(0, 8)
      .map((lead) => {
        const geracaoPrevista = Math.max(0, lead.consumoKwhMes)
        const fatorStatus =
          lead.instalacaoStatus === 'concluida' ? 1.05 : lead.instalacaoStatus === 'em-andamento' ? 0.65 : 0.4
        const geracaoAtual = Math.round(geracaoPrevista * fatorStatus)
        const alertaBaixa = geracaoPrevista > 0 && geracaoAtual < geracaoPrevista * 0.8
        return {
          id: lead.id,
          nome: lead.nome,
          geracaoPrevista,
          geracaoAtual,
          alertaBaixa,
          cidade: lead.cidade,
        }
      })

    const alertasCriticos = proximas
      .filter((item) => diasDesdeDataIso(item.dataIso) <= 2)
      .map((item) =>
        `Manutenção ${item.tipo} para ${formatarDataCurta(item.dataIso)} está há poucos dias do vencimento.`,
      )

    const chamadosRecentes = crmDataset.timeline
      .filter((item) => item.tipo === 'anotacao')
      .slice(0, 8)
      .map((item) => ({
        ...item,
        dataFormatada: formatarDataCurta(item.criadoEmIso),
      }))

    return {
      totalManutencoes,
      pendentes: pendentes.length,
      concluidas: concluidas.length,
      proximas,
      geracao,
      alertasCriticos,
      chamadosRecentes,
    }
  }, [crmDataset.manutencoes, crmDataset.leads, crmDataset.timeline])

  const crmIndicadoresGerenciais = useMemo(() => {
    // Calculamos a taxa de conversão geral a partir dos leads existentes.
    const totalLeads = crmDataset.leads.length
    const leadsFechados = crmDataset.leads.filter((lead) => lead.etapa === 'fechado')
    const taxaConversao = totalLeads > 0 ? Math.round((leadsFechados.length / totalLeads) * 100) : 0

    // O tempo médio de fechamento considera o intervalo entre criação e último contato dos projetos fechados.
    const tempoMedioFechamento = leadsFechados.length
      ? Math.round(
          leadsFechados.reduce((total, lead) => {
            const criado = new Date(lead.criadoEmIso).getTime()
            const atualizado = new Date(lead.ultimoContatoIso).getTime()
            const diffDias = Math.max(0, Math.round((atualizado - criado) / (1000 * 60 * 60 * 24)))
            return total + diffDias
          }, 0) / leadsFechados.length,
        )
      : 0

    // Agrupamos os leads por origem para alimentar o dashboard de marketing.
    const leadsPorOrigem = crmDataset.leads.reduce<Record<string, number>>((acc, lead) => {
      const origem = lead.origemLead || 'Indefinido'
      acc[origem] = (acc[origem] ?? 0) + 1
      return acc
    }, {})

    // Identificamos gargalos quando há acúmulo acima de 5 leads em uma etapa intermediária.
    const gargalos = CRM_PIPELINE_STAGES.filter((stage) => stage.id !== 'fechado' && stage.id !== 'novo-lead')
      .map((stage) => {
        const quantidade = crmDataset.leads.filter((lead) => lead.etapa === stage.id).length
        return quantidade >= 5 ? `${stage.label} possui ${quantidade} leads aguardando ação.` : null
      })
      .filter((item): item is string => Boolean(item))

    // ROI médio utilizando os dados de margem calculados na etapa financeira.
    const roiMedio = crmFinanceiroResumo.margens.length
      ? Math.round(
          (crmFinanceiroResumo.margens.reduce((total, item) => total + (item.roi ?? 0), 0) /
            crmFinanceiroResumo.margens.length) *
            100,
        ) / 100
      : 0

    const mapaGeracao = crmDataset.leads.reduce<Record<string, number>>((acc, lead) => {
      if (!lead.cidade) {
        return acc
      }
      acc[lead.cidade] = (acc[lead.cidade] ?? 0) + lead.consumoKwhMes
      return acc
    }, {})

    return {
      taxaConversao,
      tempoMedioFechamento,
      leadsPorOrigem,
      gargalos,
      roiMedio,
      receitaRecorrenteProjetada: crmFinanceiroResumo.previsaoLeasing,
      receitaPontualProjetada: crmFinanceiroResumo.previsaoVendas,
      mapaGeracao,
    }
  }, [crmDataset.leads, crmFinanceiroResumo])

  const crmManutencoesPendentes = useMemo(
    () =>
      crmDataset.manutencoes
        .filter((item) => item.status === 'pendente')
        .sort((a, b) => (a.dataIso < b.dataIso ? -1 : 1))
        .slice(0, 12),
    [crmDataset.manutencoes],
  )

  const crmContratosPorLead = useMemo(() => {
    const mapa = new Map<string, CrmContratoFinanceiro>()
    crmDataset.contratos.forEach((contrato) => {
      if (!mapa.has(contrato.leadId)) {
        mapa.set(contrato.leadId, contrato)
      }
    })
    return mapa
  }, [crmDataset.contratos])

  const crmTimelineFiltrada = useMemo(() => {
    const base = crmLeadSelecionadoId
      ? crmDataset.timeline.filter((item) => item.leadId === crmLeadSelecionadoId)
      : crmDataset.timeline

    return base.slice(0, 40)
  }, [crmDataset.timeline, crmLeadSelecionadoId])

  const handleCrmLeadFormChange = useCallback(<K extends keyof CrmLeadFormState>(campo: K, valor: CrmLeadFormState[K]) => {
    setCrmLeadForm((prev) => ({ ...prev, [campo]: valor }))
  }, [])

  const handleCrmLeadFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const consumoNumerico = Number(crmLeadForm.consumoKwhMes.replace(',', '.'))
      const valorEstimadoNumerico = Number(crmLeadForm.valorEstimado.replace(',', '.'))

      if (!crmLeadForm.nome.trim() || !crmLeadForm.telefone.trim() || !crmLeadForm.cidade.trim()) {
        adicionarNotificacao('Informe nome, telefone e cidade para cadastrar o lead.', 'error')
        return
      }

      if (!Number.isFinite(consumoNumerico) || consumoNumerico <= 0) {
        adicionarNotificacao('Consumo mensal inválido. Utilize apenas números.', 'error')
        return
      }

      if (!Number.isFinite(valorEstimadoNumerico) || valorEstimadoNumerico <= 0) {
        adicionarNotificacao('Defina o valor estimado do projeto para projeções financeiras.', 'error')
        return
      }

      const agoraIso = new Date().toISOString()
      const novoLead: CrmLeadRecord = {
        id: gerarIdCrm('lead'),
        nome: crmLeadForm.nome.trim(),
        telefone: crmLeadForm.telefone.trim(),
        email: crmLeadForm.email.trim() || undefined,
        cidade: crmLeadForm.cidade.trim(),
        tipoImovel: crmLeadForm.tipoImovel.trim() || 'Não informado',
        consumoKwhMes: Math.round(consumoNumerico),
        origemLead: crmLeadForm.origemLead.trim() || 'Cadastro manual',
        interesse: crmLeadForm.interesse,
        tipoOperacao: crmLeadForm.tipoOperacao,
        valorEstimado: Math.round(valorEstimadoNumerico),
        etapa: 'novo-lead',
        ultimoContatoIso: agoraIso,
        criadoEmIso: agoraIso,
        notas: crmLeadForm.notas.trim() || undefined,
        instalacaoStatus: 'planejamento',
      }

      const evento: CrmTimelineEntry = {
        id: gerarIdCrm('evento'),
        leadId: novoLead.id,
        mensagem: `Lead "${novoLead.nome}" cadastrado manualmente e posicionado em Novo lead.`,
        tipo: 'status',
        criadoEmIso: agoraIso,
      }

      setCrmDataset((prev) => {
        const jaPossuiContrato = prev.contratos.some((item) => item.leadId === novoLead.id)
        const parcelasPadrao = novoLead.tipoOperacao === 'LEASING' ? 60 : 1
        const entradaPadrao = novoLead.tipoOperacao === 'VENDA_DIRETA' ? Math.round(novoLead.valorEstimado * 0.2) : 0
        const valorParcelaPadrao = parcelasPadrao
          ? Math.max(0, Math.round(((novoLead.valorEstimado - entradaPadrao) / parcelasPadrao) * 100) / 100)
          : 0

        const contratoDefault: CrmContratoFinanceiro = {
          id: gerarIdCrm('contrato'),
          leadId: novoLead.id,
          modelo: novoLead.tipoOperacao,
          valorTotal: novoLead.valorEstimado,
          entrada: entradaPadrao,
          parcelas: parcelasPadrao,
          valorParcela: valorParcelaPadrao,
          reajusteAnualPct: 3,
          vencimentoInicialIso: agoraIso,
          status: 'em-aberto',
        }

        const custosDefault: CrmCustoProjeto = {
          id: gerarIdCrm('custo'),
          leadId: novoLead.id,
          equipamentos: 0,
          maoDeObra: 0,
          deslocamento: 0,
          taxasSeguros: 0,
        }

        const manutencaoFutura = new Date()
        manutencaoFutura.setMonth(manutencaoFutura.getMonth() + 6)
        const manutencaoDefault: CrmManutencaoRegistro = {
          id: gerarIdCrm('manutencao'),
          leadId: novoLead.id,
          dataIso: manutencaoFutura.toISOString(),
          tipo: 'Manutenção preventiva programada',
          status: 'pendente',
          observacao: 'Agendamento automático ao captar o lead.',
        }

        return {
          ...prev,
          leads: [novoLead, ...prev.leads],
          timeline: [evento, ...prev.timeline].slice(0, 120),
          contratos: jaPossuiContrato ? prev.contratos : [contratoDefault, ...prev.contratos],
          custos: prev.custos.some((item) => item.leadId === novoLead.id)
            ? prev.custos
            : [custosDefault, ...prev.custos],
          manutencoes: prev.manutencoes.some((item) => item.leadId === novoLead.id)
            ? prev.manutencoes
            : [manutencaoDefault, ...prev.manutencoes],
        }
      })

      setCrmLeadForm((prev) => ({
        ...CRM_EMPTY_LEAD_FORM,
        interesse: prev.interesse,
        tipoOperacao: prev.tipoOperacao,
      }))
      setCrmLeadSelecionadoId(novoLead.id)
      setCrmNotaTexto('')
      adicionarNotificacao('Lead adicionado ao funil do CRM.', 'success')
    },
    [adicionarNotificacao, crmLeadForm],
  )

  const handleMoverLead = useCallback(
    (leadId: string, direcao: 1 | -1) => {
      let mensagemSucesso: string | null = null

      setCrmDataset((prev) => {
        const leadAtual = prev.leads.find((lead) => lead.id === leadId)
        if (!leadAtual) {
          return prev
        }

        const indiceAtual = CRM_STAGE_INDEX[leadAtual.etapa]
        const novoIndice = Math.min(
          CRM_PIPELINE_STAGES.length - 1,
          Math.max(0, indiceAtual + direcao),
        )

        if (novoIndice === indiceAtual) {
          return prev
        }

        const novaEtapa = CRM_PIPELINE_STAGES[novoIndice].id
        const agoraIso = new Date().toISOString()
        mensagemSucesso = `Lead "${leadAtual.nome}" movido para ${CRM_PIPELINE_STAGES[novoIndice].label}.`

        const leadsAtualizados = prev.leads.map((lead) => {
          if (lead.id !== leadId) {
            return lead
          }

          let novoStatusInstalacao = lead.instalacaoStatus
          if (novaEtapa === 'aguardando-contrato' || novaEtapa === 'proposta-enviada') {
            novoStatusInstalacao = 'planejamento'
          } else if (novaEtapa === 'fechado') {
            novoStatusInstalacao = lead.instalacaoStatus === 'concluida' ? 'concluida' : 'em-andamento'
          } else if (novaEtapa === 'negociacao' && lead.instalacaoStatus === 'em-andamento') {
            novoStatusInstalacao = 'aguardando-homologacao'
          }

          return {
            ...lead,
            etapa: novaEtapa,
            ultimoContatoIso: agoraIso,
            instalacaoStatus: novoStatusInstalacao,
          }
        })

        const evento: CrmTimelineEntry = {
          id: gerarIdCrm('evento'),
          leadId,
          mensagem: `Etapa atualizada de ${CRM_PIPELINE_STAGES[indiceAtual].label} para ${CRM_PIPELINE_STAGES[novoIndice].label}.`,
          tipo: 'status',
          criadoEmIso: agoraIso,
        }

        return {
          ...prev,
          leads: leadsAtualizados,
          timeline: [evento, ...prev.timeline].slice(0, 120),
        }
      })

      if (mensagemSucesso) {
        adicionarNotificacao(mensagemSucesso, 'success')
      }
    },
    [adicionarNotificacao],
  )

  const handleSelecionarLead = useCallback((leadId: string) => {
    setCrmLeadSelecionadoId((prev) => (prev === leadId ? null : leadId))
  }, [])

  const handleAdicionarNotaCrm = useCallback(() => {
    if (!crmLeadSelecionadoId) {
      adicionarNotificacao('Selecione um lead para registrar uma nota.', 'info')
      return
    }

    const notaLimpa = crmNotaTexto.trim()
    if (!notaLimpa) {
      adicionarNotificacao('Escreva uma nota antes de salvar.', 'error')
      return
    }

    const agoraIso = new Date().toISOString()
    const evento: CrmTimelineEntry = {
      id: gerarIdCrm('evento'),
      leadId: crmLeadSelecionadoId,
      mensagem: notaLimpa,
      tipo: 'anotacao',
      criadoEmIso: agoraIso,
    }

    setCrmDataset((prev) => ({
      ...prev,
      leads: prev.leads.map((lead) =>
        lead.id === crmLeadSelecionadoId
          ? {
              ...lead,
              notas: notaLimpa,
              ultimoContatoIso: agoraIso,
            }
          : lead,
      ),
      timeline: [evento, ...prev.timeline].slice(0, 120),
    }))

    setCrmNotaTexto('')
    adicionarNotificacao('Nota registrada no histórico do lead.', 'success')
  }, [adicionarNotificacao, crmLeadSelecionadoId, crmNotaTexto])

  const handleAtualizarStatusInstalacao = useCallback(
    (leadId: string, status: CrmLeadRecord['instalacaoStatus']) => {
      setCrmDataset((prev) => ({
        ...prev,
        leads: prev.leads.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                instalacaoStatus: status,
                ultimoContatoIso: new Date().toISOString(),
              }
            : lead,
        ),
      }))
      adicionarNotificacao('Status da instalação atualizado.', 'success')
    },
    [adicionarNotificacao],
  )

  const handleRemoverLead = useCallback(
    (leadId: string) => {
      let nomeLead: string | null = null

      setCrmDataset((prev) => {
        const leadAtual = prev.leads.find((lead) => lead.id === leadId)
        if (!leadAtual) {
          return prev
        }
        nomeLead = leadAtual.nome
        const agoraIso = new Date().toISOString()

        const leadsRestantes = prev.leads.filter((lead) => lead.id !== leadId)
        const evento: CrmTimelineEntry = {
          id: gerarIdCrm('evento'),
          leadId,
          mensagem: `Lead removido do funil pelo usuário em ${formatarDataCurta(agoraIso)}.`,
          tipo: 'status',
          criadoEmIso: agoraIso,
        }

        return {
          ...prev,
          leads: leadsRestantes,
          timeline: [evento, ...prev.timeline].slice(0, 120),
          contratos: prev.contratos.filter((contrato) => contrato.leadId !== leadId),
          custos: prev.custos.filter((custo) => custo.leadId !== leadId),
          manutencoes: prev.manutencoes.filter((manutencao) => manutencao.leadId !== leadId),
          lancamentos: prev.lancamentos.filter((lancamento) => lancamento.leadId !== leadId),
        }
      })

      if (nomeLead && crmLeadSelecionadoId === leadId) {
        setCrmLeadSelecionadoId(null)
      }

      if (nomeLead) {
        adicionarNotificacao(`Lead "${nomeLead}" removido do CRM.`, 'info')
      }
    },
    [adicionarNotificacao, crmLeadSelecionadoId],
  )

  const handleRegistrarLancamentoCrm = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const valorNumerico = Number(String(crmLancamentoForm.valor).replace(',', '.'))
      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        adicionarNotificacao('Informe um valor numérico positivo para o lançamento financeiro.', 'error')
        return
      }

      const dataIso = crmLancamentoForm.dataIso
        ? new Date(`${crmLancamentoForm.dataIso}T00:00:00`).toISOString()
        : new Date().toISOString()

      const leadIdReferencia = crmLancamentoForm.leadId || crmLeadSelecionado?.id
      const leadValido = leadIdReferencia
        ? crmDataset.leads.some((lead) => lead.id === leadIdReferencia)
        : false

      const novoLancamento: CrmLancamentoCaixa = {
        id: gerarIdCrm('lancamento'),
        leadId: leadValido ? leadIdReferencia : undefined,
        dataIso,
        categoria: crmLancamentoForm.categoria,
        origem: crmLancamentoForm.origem.trim() || 'Operação',
        formaPagamento: crmLancamentoForm.formaPagamento,
        tipo: crmLancamentoForm.tipo,
        valor: Math.round(valorNumerico * 100) / 100,
        observacao: crmLancamentoForm.observacao.trim() || undefined,
      }

      const evento: CrmTimelineEntry | null = novoLancamento.leadId
        ? {
            id: gerarIdCrm('evento'),
            leadId: novoLancamento.leadId,
            mensagem: `Lançamento financeiro (${novoLancamento.tipo === 'entrada' ? 'entrada' : 'saída'}) de ${currency(
              novoLancamento.valor,
            )} registrado em ${formatarDataCurta(dataIso)}.`,
            tipo: 'status',
            criadoEmIso: new Date().toISOString(),
          }
        : null

      setCrmDataset((prev) => ({
        ...prev,
        lancamentos: [novoLancamento, ...prev.lancamentos].slice(0, 200),
        timeline: evento ? [evento, ...prev.timeline].slice(0, 120) : prev.timeline,
      }))

      setCrmLancamentoForm((prev) => ({
        ...prev,
        valor: '',
        observacao: '',
      }))

      adicionarNotificacao('Lançamento financeiro salvo com sucesso.', 'success')
    },
    [adicionarNotificacao, crmDataset.leads, crmLancamentoForm, crmLeadSelecionado],
  )

  const handleSalvarCustosCrm = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!crmLeadSelecionado) {
        adicionarNotificacao('Selecione um lead para detalhar os custos do projeto.', 'error')
        return
      }

      const parse = (valor: string) => {
        const numero = Number(valor.replace(',', '.'))
        return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) / 100 : 0
      }

      const custosAtualizados: CrmCustoProjeto = {
        id: gerarIdCrm('custo'),
        leadId: crmLeadSelecionado.id,
        equipamentos: parse(crmCustosForm.equipamentos),
        maoDeObra: parse(crmCustosForm.maoDeObra),
        deslocamento: parse(crmCustosForm.deslocamento),
        taxasSeguros: parse(crmCustosForm.taxasSeguros),
      }

      setCrmDataset((prev) => {
        const jaExistente = prev.custos.some((item) => item.leadId === crmLeadSelecionado.id)
        const listaAtualizada = jaExistente
          ? prev.custos.map((item) => (item.leadId === crmLeadSelecionado.id ? { ...custosAtualizados, id: item.id } : item))
          : [custosAtualizados, ...prev.custos]

        const evento: CrmTimelineEntry = {
          id: gerarIdCrm('evento'),
          leadId: crmLeadSelecionado.id,
          mensagem: 'Custos do projeto atualizados para cálculo de margem e ROI.',
          tipo: 'status',
          criadoEmIso: new Date().toISOString(),
        }

        return {
          ...prev,
          custos: listaAtualizada,
          timeline: [evento, ...prev.timeline].slice(0, 120),
        }
      })

      adicionarNotificacao('Custos do projeto registrados.', 'success')
    },
    [adicionarNotificacao, crmCustosForm, crmLeadSelecionado],
  )

  const handleSalvarContratoCrm = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const leadAlvoId = crmContratoForm.leadId || crmLeadSelecionado?.id
      if (!leadAlvoId) {
        adicionarNotificacao('Associe o contrato a um lead para controle financeiro.', 'error')
        return
      }

      const leadExiste = crmDataset.leads.some((lead) => lead.id === leadAlvoId)
      if (!leadExiste) {
        adicionarNotificacao('Lead selecionado não encontrado. Recarregue a página ou selecione outro registro.', 'error')
        return
      }

      const parse = (valor: string, fallback = 0) => {
        const numero = Number(valor.replace(',', '.'))
        if (!Number.isFinite(numero) || numero < 0) {
          return fallback
        }
        return Math.round(numero * 100) / 100
      }

      const contratoNormalizado: CrmContratoFinanceiro = {
        id: gerarIdCrm('contrato'),
        leadId: leadAlvoId,
        modelo: crmContratoForm.modelo,
        valorTotal: parse(crmContratoForm.valorTotal, 0),
        entrada: parse(crmContratoForm.entrada, 0),
        parcelas: Math.max(0, Math.round(parse(crmContratoForm.parcelas, 0))),
        valorParcela: parse(crmContratoForm.valorParcela, 0),
        reajusteAnualPct: parse(crmContratoForm.reajusteAnualPct, 0),
        vencimentoInicialIso: crmContratoForm.vencimentoInicialIso
          ? new Date(`${crmContratoForm.vencimentoInicialIso}T00:00:00`).toISOString()
          : new Date().toISOString(),
        status: crmContratoForm.status,
      }

      setCrmDataset((prev) => {
        const contratosAtualizados = prev.contratos.some((item) => item.leadId === leadAlvoId)
          ? prev.contratos.map((item) => (item.leadId === leadAlvoId ? { ...contratoNormalizado, id: item.id } : item))
          : [contratoNormalizado, ...prev.contratos]

        const evento: CrmTimelineEntry = {
          id: gerarIdCrm('evento'),
          leadId: leadAlvoId,
          mensagem: `Contrato ${
            contratoNormalizado.modelo === 'LEASING' ? 'de leasing' : 'de venda direta'
          } atualizado (${contratoNormalizado.parcelas} parcelas).`,
          tipo: 'status',
          criadoEmIso: new Date().toISOString(),
        }

        return {
          ...prev,
          contratos: contratosAtualizados,
          timeline: [evento, ...prev.timeline].slice(0, 120),
        }
      })

      adicionarNotificacao('Contrato financeiro sincronizado com o CRM.', 'success')
    },
    [adicionarNotificacao, crmContratoForm, crmDataset.leads, crmLeadSelecionado],
  )

  const handleAdicionarManutencaoCrm = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const leadAlvoId = crmManutencaoForm.leadId || crmLeadSelecionado?.id
      if (!leadAlvoId) {
        adicionarNotificacao('Selecione um lead para agendar a manutenção.', 'error')
        return
      }

      const leadExiste = crmDataset.leads.some((lead) => lead.id === leadAlvoId)
      if (!leadExiste) {
        adicionarNotificacao('Não foi possível localizar o lead selecionado.', 'error')
        return
      }

      const dataIso = crmManutencaoForm.dataIso
        ? new Date(`${crmManutencaoForm.dataIso}T00:00:00`).toISOString()
        : new Date().toISOString()

      const manutencao: CrmManutencaoRegistro = {
        id: gerarIdCrm('manutencao'),
        leadId: leadAlvoId,
        dataIso,
        tipo: crmManutencaoForm.tipo.trim() || 'Revisão preventiva',
        status: 'pendente',
        observacao: crmManutencaoForm.observacao.trim() || undefined,
      }

      const timelineEvento: CrmTimelineEntry = {
        id: gerarIdCrm('evento'),
        leadId: leadAlvoId,
        mensagem: `Manutenção agendada para ${formatarDataCurta(dataIso)} (${manutencao.tipo}).`,
        tipo: 'status',
        criadoEmIso: new Date().toISOString(),
      }

      setCrmDataset((prev) => ({
        ...prev,
        manutencoes: [manutencao, ...prev.manutencoes].slice(0, 200),
        timeline: [timelineEvento, ...prev.timeline].slice(0, 120),
      }))

      setCrmManutencaoForm((prev) => ({
        ...prev,
        observacao: '',
      }))

      adicionarNotificacao('Manutenção registrada e vinculada ao cliente.', 'success')
    },
    [adicionarNotificacao, crmDataset.leads, crmLeadSelecionado, crmManutencaoForm],
  )

  const handleConcluirManutencaoCrm = useCallback(
    (manutencaoId: string) => {
      setCrmDataset((prev) => ({
        ...prev,
        manutencoes: prev.manutencoes.map((item) =>
          item.id === manutencaoId
            ? {
                ...item,
                status: 'concluida',
              }
            : item,
        ),
      }))
      adicionarNotificacao('Manutenção marcada como concluída.', 'success')
    },
    [adicionarNotificacao],
  )

  const handleSyncCrmManualmente = useCallback(() => {
    void persistCrmDataset(crmDataset, 'manual')
    adicionarNotificacao('Sincronização manual solicitada.', 'info')
  }, [adicionarNotificacao, crmDataset, persistCrmDataset])

  const renderCrmPage = () => (
    <div className="page crm-page">
      <header className="topbar crm-header">
        <div className="container">
          <div className="brand">
            <img src="/logo.svg" alt="SolarInvest" />
            <div className="brand-text">
              <h1>SolarInvest App</h1>
              <p>CRM Gestão de Relacionamento e Operações</p>
            </div>
          </div>
          <div className="crm-header-actions">
            <div className="crm-sync-controls">
              <label htmlFor="crm-sync-mode">Modo de sincronização</label>
              <select
                id="crm-sync-mode"
                value={crmIntegrationMode}
                onChange={(event) => setCrmIntegrationMode(event.target.value as CrmIntegrationMode)}
              >
                <option value="local">Somente local</option>
                <option value="remote">Sincronizar com backend</option>
              </select>
              <button type="button" className="ghost" onClick={handleSyncCrmManualmente}>
                Sincronizar agora
              </button>
              <small className={`crm-sync-status ${crmBackendStatus}`}>
                {crmIntegrationMode === 'remote'
                  ? crmBackendStatus === 'success'
                    ? `Sincronizado${crmLastSync ? ` em ${crmLastSync.toLocaleString('pt-BR')}` : ''}`
                    : crmBackendStatus === 'error'
                      ? crmBackendError ?? 'Erro de sincronização'
                      : crmIsSaving
                        ? 'Enviando dados para o backend...'
                        : 'Aguardando alterações para sincronizar'
                  : 'Operando somente com dados locais'}
              </small>
            </div>
            <button className="ghost" onClick={() => setActivePage('app')}>
              Voltar para proposta financeira
            </button>
          </div>
        </div>
      </header>
      <main className="crm-main">
        {/* Seção 1 - Captação e qualificação */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>1. Captação e qualificação</h2>
              <p>
                Cadastre leads vindos do site, redes sociais e indicações. Os dados coletados alimentam automaticamente
                os cálculos financeiros da proposta.
              </p>
            </div>
            <div className="crm-metrics">
              <div>
                <span>Total de leads</span>
                <strong>{crmKpis.totalLeads}</strong>
              </div>
              <div>
                <span>Fechados</span>
                <strong>{crmKpis.leadsFechados}</strong>
              </div>
              <div>
                <span>Receita recorrente</span>
                <strong>{currency(crmKpis.receitaRecorrente)}</strong>
              </div>
              <div>
                <span>Receita pontual</span>
                <strong>{currency(crmKpis.receitaPontual)}</strong>
              </div>
              <div className="warning">
                <span>Leads em risco</span>
                <strong>{crmKpis.leadsEmRisco}</strong>
              </div>
            </div>
          </div>
          <div className="crm-capture-grid">
            <div className="crm-capture-filters">
              <label htmlFor="crm-busca">Buscar lead</label>
              <input
                id="crm-busca"
                type="search"
                value={crmBusca}
                onChange={(event) => setCrmBusca(event.target.value)}
                placeholder="Pesquisar por nome, telefone, origem ou cidade"
              />
              <label htmlFor="crm-operacao-filter">Tipo de operação</label>
              <select
                id="crm-operacao-filter"
                value={crmFiltroOperacao}
                onChange={(event) => setCrmFiltroOperacao(event.target.value as CrmFiltroOperacao)}
              >
                <option value="all">Todos</option>
                <option value="LEASING">Leasing</option>
                <option value="VENDA_DIRETA">Venda</option>
              </select>
              <p className="crm-hint">
                Leads que abrem uma proposta ou respondem mensagem mudam automaticamente de status. O filtro acima ajuda
                a focar nos modelos de operação desejados.
              </p>
            </div>
            <form className="crm-capture-form" onSubmit={handleCrmLeadFormSubmit}>
              <fieldset>
                <legend>Novo lead</legend>
                <div className="crm-form-row">
                  <label>
                    Nome
                    <input
                      value={crmLeadForm.nome}
                      onChange={(event) => handleCrmLeadFormChange('nome', event.target.value)}
                      placeholder="Nome do contato"
                      required
                    />
                  </label>
                  <label>
                    Telefone / WhatsApp
                    <input
                      value={crmLeadForm.telefone}
                      onChange={(event) => handleCrmLeadFormChange('telefone', event.target.value)}
                      placeholder="(62) 99999-0000"
                      required
                    />
                  </label>
                </div>
                <div className="crm-form-row">
                  <label>
                    Cidade
                    <input
                      value={crmLeadForm.cidade}
                      onChange={(event) => handleCrmLeadFormChange('cidade', event.target.value)}
                      placeholder="Cidade do projeto"
                      required
                    />
                  </label>
                  <label>
                    Origem do lead
                    <input
                      value={crmLeadForm.origemLead}
                      onChange={(event) => handleCrmLeadFormChange('origemLead', event.target.value)}
                      placeholder="Instagram, WhatsApp, Feira..."
                    />
                  </label>
                </div>
                <div className="crm-form-row">
                  <label>
                    Consumo mensal (kWh)
                    <input
                      value={crmLeadForm.consumoKwhMes}
                      onChange={(event) => handleCrmLeadFormChange('consumoKwhMes', event.target.value)}
                      placeholder="Ex: 1200"
                      required
                    />
                  </label>
                  <label>
                    Valor estimado (R$)
                    <input
                      value={crmLeadForm.valorEstimado}
                      onChange={(event) => handleCrmLeadFormChange('valorEstimado', event.target.value)}
                      placeholder="Ex: 250000"
                      required
                    />
                  </label>
                </div>
                <div className="crm-form-row">
                  <label>
                    Tipo de imóvel
                    <input
                      value={crmLeadForm.tipoImovel}
                      onChange={(event) => handleCrmLeadFormChange('tipoImovel', event.target.value)}
                      placeholder="Residencial, Comercial, Condomínio..."
                    />
                  </label>
                  <label>
                    Modelo de operação
                    <select
                      value={crmLeadForm.tipoOperacao}
                      onChange={(event) =>
                        handleCrmLeadFormChange('tipoOperacao', event.target.value as CrmLeadFormState['tipoOperacao'])
                      }
                    >
                      <option value="LEASING">Leasing (receita recorrente)</option>
                      <option value="VENDA_DIRETA">Venda (receita pontual)</option>
                    </select>
                  </label>
                </div>
                <label className="crm-form-notes">
                  Observações
                  <textarea
                    rows={2}
                    value={crmLeadForm.notas}
                    onChange={(event) => handleCrmLeadFormChange('notas', event.target.value)}
                    placeholder="Preferências do cliente, dores principais ou combinações iniciais"
                  />
                </label>
              </fieldset>
              <div className="crm-form-actions">
                <button type="submit" className="primary">
                  Adicionar lead ao funil
                </button>
                <p>
                  Ao salvar, o lead recebe uma tag com o tipo de sistema (on-grid, off-grid, condomínio) e gera um
                  registro de projeto vinculado automaticamente.
                </p>
              </div>
            </form>
          </div>
        </section>

        {/* Seção 2 - Prospecção e proposta */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>2. Prospecção e proposta</h2>
              <p>
                Acompanhe o funil visual de vendas com etapas automáticas. Movimentações geram registros na linha do
                tempo do lead e notificações internas de follow-up.
              </p>
            </div>
          </div>
          <div className="crm-kanban">
            {CRM_PIPELINE_STAGES.map((stage) => {
              const leadsDaEtapa = crmLeadsPorEtapa[stage.id] ?? []
              return (
                <div key={stage.id} className="crm-kanban-column">
                  <header>
                    <h3>{stage.label}</h3>
                    <span>{leadsDaEtapa.length} lead(s)</span>
                  </header>
                  <ul>
                    {leadsDaEtapa.length === 0 ? (
                      <li className="crm-empty">Sem leads aqui no momento</li>
                    ) : (
                      leadsDaEtapa.map((lead) => (
                        <li
                          key={lead.id}
                          className={`crm-lead-chip${crmLeadSelecionadoId === lead.id ? ' selected' : ''}`}
                        >
                          <button type="button" onClick={() => handleSelecionarLead(lead.id)}>
                            <strong>{lead.nome}</strong>
                            <small>{lead.cidade}</small>
                            <small>{currency(lead.valorEstimado)}</small>
                          </button>
                          <div className="crm-lead-actions">
                            <button
                              type="button"
                              aria-label="Mover para etapa anterior"
                              onClick={() => handleMoverLead(lead.id, -1)}
                              disabled={stage.id === CRM_PIPELINE_STAGES[0].id}
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              aria-label="Mover para próxima etapa"
                              onClick={() => handleMoverLead(lead.id, 1)}
                              disabled={stage.id === CRM_PIPELINE_STAGES[CRM_PIPELINE_STAGES.length - 1].id}
                            >
                              ▶
                            </button>
                            <button type="button" className="danger" onClick={() => handleRemoverLead(lead.id)}>
                              Remover
                            </button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>

        {/* Seção 3 - Contrato e implantação */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>3. Contrato e implantação</h2>
              <p>
                Integração com assinatura digital, checklist técnico e histórico completo de interações e anexos do
                cliente.
              </p>
            </div>
          </div>
          {crmLeadSelecionado ? (
            <div className="crm-selected">
              <div className="crm-selected-summary">
                <h3>{crmLeadSelecionado.nome}</h3>
                <p>
                  {crmLeadSelecionado.telefone} • {crmLeadSelecionado.email || 'E-mail não informado'}
                </p>
                <p>
                  {crmLeadSelecionado.cidade} • Consumo {fmt.kwhMes(crmLeadSelecionado.consumoKwhMes)}
                </p>
                <label>
                  Status da instalação
                  <select
                    value={crmLeadSelecionado.instalacaoStatus}
                    onChange={(event) =>
                      handleAtualizarStatusInstalacao(
                        crmLeadSelecionado.id,
                        event.target.value as CrmLeadRecord['instalacaoStatus'],
                      )
                    }
                  >
                    {CRM_INSTALACAO_STATUS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Registrar nota
                  <textarea
                    rows={2}
                    value={crmNotaTexto}
                    onChange={(event) => setCrmNotaTexto(event.target.value)}
                    placeholder="Ex: Visita técnica agendada, cliente solicitou revisão de valores"
                  />
                </label>
                <button type="button" className="ghost" onClick={handleAdicionarNotaCrm}>
                  Salvar no histórico
                </button>
              </div>
              <div className="crm-selected-details">
                <div>
                  <h4>Contrato financeiro</h4>
                  {(() => {
                    const contrato = crmContratosPorLead.get(crmLeadSelecionado.id)
                    if (!contrato) {
                      return <p className="crm-empty">Preencha os dados financeiros na seção 6.</p>
                    }
                    return (
                      <ul className="crm-data-list">
                        <li>
                          <span>Modelo</span>
                          <strong>{contrato.modelo === 'LEASING' ? 'Leasing' : 'Venda'}</strong>
                        </li>
                        <li>
                          <span>Parcelas</span>
                          <strong>{contrato.parcelas}x de {currency(contrato.valorParcela)}</strong>
                        </li>
                        <li>
                          <span>Status</span>
                          <strong>{contrato.status.replace('-', ' ')}</strong>
                        </li>
                        <li>
                          <span>Vencimento inicial</span>
                          <strong>{formatarDataCurta(contrato.vencimentoInicialIso)}</strong>
                        </li>
                      </ul>
                    )
                  })()}
                </div>
                <div>
                  <h4>Checklist técnico</h4>
                  <ul className="crm-checklist">
                    <li className={crmLeadSelecionado.etapa !== 'novo-lead' ? 'done' : ''}>Captação concluída</li>
                    <li className={crmLeadSelecionado.etapa !== 'novo-lead' && crmLeadSelecionado.etapa !== 'qualificacao' ? 'done' : ''}>
                      Proposta enviada
                    </li>
                    <li className={crmLeadSelecionado.etapa === 'negociacao' || crmLeadSelecionado.etapa === 'aguardando-contrato' || crmLeadSelecionado.etapa === 'fechado' ? 'done' : ''}>
                      Negociação em andamento
                    </li>
                    <li className={crmLeadSelecionado.etapa === 'aguardando-contrato' || crmLeadSelecionado.etapa === 'fechado' ? 'done' : ''}>
                      Contrato preparado para assinatura
                    </li>
                    <li className={crmLeadSelecionado.instalacaoStatus === 'concluida' ? 'done' : ''}>Usina instalada</li>
                  </ul>
                </div>
                <div>
                  <h4>Histórico recente</h4>
                  <ul className="crm-timeline">
                    {crmTimelineFiltrada.slice(0, 6).map((item) => (
                      <li key={item.id}>
                        <span>{formatarDataCurta(item.criadoEmIso)}</span>
                        <p>{item.mensagem}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="crm-empty">Selecione um lead no funil acima para visualizar detalhes de contrato e implantação.</p>
          )}
        </section>

        {/* Seção 4 - Instalação */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>4. Instalação</h2>
              <p>
                O módulo técnico assume tarefas, materiais e cronogramas vinculados ao mesmo registro do cliente.
                Atualize a agenda de manutenção preventiva e acompanhe o status de execução em tempo real.
              </p>
            </div>
          </div>
          <div className="crm-install-grid">
            <div>
              <h4>Manutenções pendentes</h4>
              {crmManutencoesPendentes.length === 0 ? (
                <p className="crm-empty">Nenhuma manutenção pendente. Cadastre uma nova abaixo.</p>
              ) : (
                <ul className="crm-maintenance-list">
                  {crmManutencoesPendentes.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{formatarDataCurta(item.dataIso)}</strong>
                        <span>{item.tipo}</span>
                        {item.observacao ? <small>{item.observacao}</small> : null}
                      </div>
                      <button type="button" onClick={() => handleConcluirManutencaoCrm(item.id)}>
                        Concluir
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <form className="crm-maintenance-form" onSubmit={handleAdicionarManutencaoCrm}>
              <fieldset>
                <legend>Agendar manutenção</legend>
                <label>
                  Cliente (opcional)
                  <select
                    value={crmManutencaoForm.leadId}
                    onChange={(event) => setCrmManutencaoForm((prev) => ({ ...prev, leadId: event.target.value }))}
                  >
                    <option value="">Usar lead selecionado</option>
                    {crmDataset.leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Data prevista
                  <input
                    type="date"
                    value={crmManutencaoForm.dataIso}
                    onChange={(event) => setCrmManutencaoForm((prev) => ({ ...prev, dataIso: event.target.value }))}
                  />
                </label>
                <label>
                  Tipo de serviço
                  <input
                    value={crmManutencaoForm.tipo}
                    onChange={(event) => setCrmManutencaoForm((prev) => ({ ...prev, tipo: event.target.value }))}
                    placeholder="Vistoria, limpeza, troca de inversor..."
                  />
                </label>
                <label>
                  Observações
                  <textarea
                    rows={2}
                    value={crmManutencaoForm.observacao}
                    onChange={(event) => setCrmManutencaoForm((prev) => ({ ...prev, observacao: event.target.value }))}
                  />
                </label>
              </fieldset>
              <button type="submit" className="ghost">
                Agendar manutenção
              </button>
            </form>
            {crmLeadSelecionado ? (
              <div>
                <h4>Histórico do cliente selecionado</h4>
                <ul className="crm-maintenance-list">
                  {crmDataset.manutencoes
                    .filter((item) => item.leadId === crmLeadSelecionado.id)
                    .slice(0, 5)
                    .map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{formatarDataCurta(item.dataIso)}</strong>
                          <span>{item.tipo}</span>
                          <small>Status: {item.status}</small>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {/* Seção 5 - Pós-venda e manutenção */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>5. Pós-venda e manutenção</h2>
              <p>
                Monitoramento contínuo da usina, integrações com o inversor e registro de chamados técnicos para manter o
                cliente engajado.
              </p>
            </div>
            <div className="crm-metrics">
              <div>
                <span>Manutenções totais</span>
                <strong>{crmPosVendaResumo.totalManutencoes}</strong>
              </div>
              <div>
                <span>Pendentes</span>
                <strong>{crmPosVendaResumo.pendentes}</strong>
              </div>
              <div>
                <span>Concluídas</span>
                <strong>{crmPosVendaResumo.concluidas}</strong>
              </div>
              <div>
                <span>Alertas críticos</span>
                <strong>{crmPosVendaResumo.alertasCriticos.length}</strong>
              </div>
            </div>
          </div>
          <div className="crm-post-grid">
            <div className="crm-post-column">
              <h3>Próximas visitas preventivas</h3>
              <ul className="crm-alert-list">
                {crmPosVendaResumo.proximas.length === 0 ? (
                  <li className="crm-empty">Nenhuma visita agendada para os próximos dias.</li>
                ) : (
                  crmPosVendaResumo.proximas.map((item) => {
                    const lead = crmDataset.leads.find((leadItem) => leadItem.id === item.leadId)
                    return (
                      <li key={item.id}>
                        <div>
                          <strong>{formatarDataCurta(item.dataIso)}</strong>
                          <span>{item.tipo}</span>
                          {lead ? <small>{lead.nome}</small> : null}
                        </div>
                        <button type="button" className="link" onClick={() => setCrmLeadSelecionadoId(item.leadId)}>
                          Ver lead
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
              {crmPosVendaResumo.alertasCriticos.length > 0 ? (
                <div className="crm-alert-banner">
                  <h4>Alertas automáticos</h4>
                  <ul>
                    {crmPosVendaResumo.alertasCriticos.map((texto, index) => (
                      <li key={texto + index}>{texto}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="crm-post-column">
              <h3>Relatório de geração (via API do inversor)</h3>
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Cidade</th>
                    <th>Previsto (kWh)</th>
                    <th>Gerado (kWh)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {crmPosVendaResumo.geracao.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="crm-empty">
                        Aguarde a integração com o inversor para sincronizar dados de geração.
                      </td>
                    </tr>
                  ) : (
                    crmPosVendaResumo.geracao.map((registro) => (
                      <tr key={registro.id} className={registro.alertaBaixa ? 'alert' : ''}>
                        <td>{registro.nome}</td>
                        <td>{registro.cidade}</td>
                        <td>{registro.geracaoPrevista}</td>
                        <td>{registro.geracaoAtual}</td>
                        <td>{registro.alertaBaixa ? 'Baixa geração' : 'Normal'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="crm-post-column">
              <h3>Chamados recentes</h3>
              <ul className="crm-alert-list">
                {crmPosVendaResumo.chamadosRecentes.length === 0 ? (
                  <li className="crm-empty">Nenhum chamado registrado. Use as notas do lead para registrar atendimentos.</li>
                ) : (
                  crmPosVendaResumo.chamadosRecentes.map((registro) => (
                    <li key={registro.id}>
                      <div>
                        <strong>{registro.dataFormatada}</strong>
                        <span>{registro.mensagem}</span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* Seção 6 - Financeiro integrado */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>6. Financeiro integrado</h2>
              <p>
                Controle de contratos de leasing e vendas diretas, lançamentos de caixa e análise de margens para cada
                usina.
              </p>
            </div>
            <div className="crm-metrics">
              <div>
                <span>Entradas</span>
                <strong>{currency(crmFinanceiroResumo.entradas)}</strong>
              </div>
              <div>
                <span>Saídas</span>
                <strong>{currency(crmFinanceiroResumo.saidas)}</strong>
              </div>
              <div>
                <span>Saldo acumulado</span>
                <strong>{currency(crmFinanceiroResumo.saldo)}</strong>
              </div>
              <div>
                <span>Contratos ativos</span>
                <strong>{crmFinanceiroResumo.contratosAtivos}</strong>
              </div>
              <div className="warning">
                <span>Inadimplentes</span>
                <strong>{crmFinanceiroResumo.inadimplentes}</strong>
              </div>
            </div>
          </div>
          <div className="crm-finance-grid">
            {/* Coluna 1: formulários de contratos, lançamentos e custos para alimentar o financeiro do CRM. */}
            <div className="crm-finance-forms">
              <form onSubmit={handleSalvarContratoCrm} className="crm-form">
                <fieldset>
                  <legend>Contrato financeiro</legend>
                  <label>
                    Lead
                    <select
                      value={crmContratoForm.leadId}
                      onChange={(event) => setCrmContratoForm((prev) => ({ ...prev, leadId: event.target.value }))}
                    >
                      <option value="">{crmLeadSelecionado ? 'Usar lead selecionado' : 'Selecione um lead'}</option>
                      {crmDataset.leads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Modelo
                    <select
                      value={crmContratoForm.modelo}
                      onChange={(event) =>
                        setCrmContratoForm((prev) => ({
                          ...prev,
                          modelo: event.target.value as 'LEASING' | 'VENDA_DIRETA',
                        }))
                      }
                    >
                      <option value="LEASING">Leasing</option>
                      <option value="VENDA_DIRETA">Venda</option>
                    </select>
                  </label>
                  <div className="crm-form-row">
                    <label>
                      Valor total (R$)
                      <input
                        value={crmContratoForm.valorTotal}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, valorTotal: event.target.value }))
                        }
                        placeholder="Ex: 250000"
                      />
                    </label>
                    <label>
                      Entrada (R$)
                      <input
                        value={crmContratoForm.entrada}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, entrada: event.target.value }))
                        }
                        placeholder="Ex: 50000"
                      />
                    </label>
                  </div>
                  <div className="crm-form-row">
                    <label>
                      Parcelas
                      <input
                        value={crmContratoForm.parcelas}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, parcelas: event.target.value }))
                        }
                        placeholder="Ex: 36"
                      />
                    </label>
                    <label>
                      Valor parcela (R$)
                      <input
                        value={crmContratoForm.valorParcela}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, valorParcela: event.target.value }))
                        }
                        placeholder="Ex: 4200"
                      />
                    </label>
                  </div>
                  <div className="crm-form-row">
                    <label>
                      Reajuste anual (%)
                      <input
                        value={crmContratoForm.reajusteAnualPct}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, reajusteAnualPct: event.target.value }))
                        }
                        placeholder="Ex: 3"
                      />
                    </label>
                    <label>
                      Primeiro vencimento
                      <input
                        type="date"
                        value={crmContratoForm.vencimentoInicialIso}
                        onChange={(event) =>
                          setCrmContratoForm((prev) => ({ ...prev, vencimentoInicialIso: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Status
                    <select
                      value={crmContratoForm.status}
                      onChange={(event) =>
                        setCrmContratoForm((prev) => ({
                          ...prev,
                          status: event.target.value as CrmFinanceiroStatus,
                        }))
                      }
                    >
                      <option value="em-aberto">Em aberto</option>
                      <option value="ativo">Ativo</option>
                      <option value="inadimplente">Inadimplente</option>
                      <option value="quitado">Quitado</option>
                    </select>
                  </label>
                </fieldset>
                <button type="submit" className="primary">
                  Salvar contrato
                </button>
              </form>

              <form onSubmit={handleRegistrarLancamentoCrm} className="crm-form">
                <fieldset>
                  <legend>Lançamento de caixa</legend>
                  <div className="crm-form-row">
                    <label>
                      Data
                      <input
                        type="date"
                        value={crmLancamentoForm.dataIso}
                        onChange={(event) =>
                          setCrmLancamentoForm((prev) => ({ ...prev, dataIso: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Tipo
                      <select
                        value={crmLancamentoForm.tipo}
                        onChange={(event) =>
                          setCrmLancamentoForm((prev) => ({
                            ...prev,
                            tipo: event.target.value as CrmLancamentoCaixa['tipo'],
                          }))
                        }
                      >
                        <option value="entrada">Entrada</option>
                        <option value="saida">Saída</option>
                      </select>
                    </label>
                  </div>
                  <div className="crm-form-row">
                    <label>
                      Categoria
                      <select
                        value={crmLancamentoForm.categoria}
                        onChange={(event) =>
                          setCrmLancamentoForm((prev) => ({
                            ...prev,
                            categoria: event.target.value as CrmLancamentoCaixa['categoria'],
                          }))
                        }
                      >
                        {CRM_FINANCEIRO_CATEGORIAS.map((categoria) => (
                          <option key={categoria} value={categoria}>
                            {categoria}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Forma de pagamento
                      <select
                        value={crmLancamentoForm.formaPagamento}
                        onChange={(event) =>
                          setCrmLancamentoForm((prev) => ({
                            ...prev,
                            formaPagamento: event.target.value as CrmLancamentoCaixa['formaPagamento'],
                          }))
                        }
                      >
                        {CRM_FORMAS_PAGAMENTO.map((forma) => (
                          <option key={forma} value={forma}>
                            {forma}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Origem do lançamento
                    <input
                      value={crmLancamentoForm.origem}
                      onChange={(event) => setCrmLancamentoForm((prev) => ({ ...prev, origem: event.target.value }))}
                      placeholder="Leasing, venda direta, manutenção..."
                    />
                  </label>
                  <label>
                    Valor (R$)
                    <input
                      value={crmLancamentoForm.valor}
                      onChange={(event) => setCrmLancamentoForm((prev) => ({ ...prev, valor: event.target.value }))}
                      placeholder="Ex: 1800"
                    />
                  </label>
                  <label>
                    Associar a lead (opcional)
                    <select
                      value={crmLancamentoForm.leadId}
                      onChange={(event) => setCrmLancamentoForm((prev) => ({ ...prev, leadId: event.target.value }))}
                    >
                      <option value="">Usar lead selecionado</option>
                      {crmDataset.leads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Observação
                    <textarea
                      rows={2}
                      value={crmLancamentoForm.observacao}
                      onChange={(event) => setCrmLancamentoForm((prev) => ({ ...prev, observacao: event.target.value }))}
                    />
                  </label>
                </fieldset>
                <button type="submit" className="ghost">
                  Registrar lançamento
                </button>
              </form>

              <form onSubmit={handleSalvarCustosCrm} className="crm-form">
                <fieldset>
                  <legend>Custos do projeto selecionado</legend>
                  <div className="crm-form-row">
                    <label>
                      Equipamentos (R$)
                      <input
                        value={crmCustosForm.equipamentos}
                        onChange={(event) => setCrmCustosForm((prev) => ({ ...prev, equipamentos: event.target.value }))}
                      />
                    </label>
                    <label>
                      Mão de obra (R$)
                      <input
                        value={crmCustosForm.maoDeObra}
                        onChange={(event) => setCrmCustosForm((prev) => ({ ...prev, maoDeObra: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="crm-form-row">
                    <label>
                      Deslocamento (R$)
                      <input
                        value={crmCustosForm.deslocamento}
                        onChange={(event) => setCrmCustosForm((prev) => ({ ...prev, deslocamento: event.target.value }))}
                      />
                    </label>
                    <label>
                      Taxas e seguros (R$)
                      <input
                        value={crmCustosForm.taxasSeguros}
                        onChange={(event) => setCrmCustosForm((prev) => ({ ...prev, taxasSeguros: event.target.value }))}
                      />
                    </label>
                  </div>
                </fieldset>
                <button type="submit" className="ghost">
                  Salvar custos
                </button>
              </form>
            </div>
            {/* Coluna 2: painéis analíticos que resumem fluxo de caixa e margens. */}
            <div className="crm-finance-analytics">
              <div className="crm-flow-chart">
                <h3>Fluxo de caixa consolidado</h3>
                {crmFinanceiroResumo.fluxoOrdenado.length === 0 ? (
                  <p className="crm-empty">Cadastre lançamentos para visualizar o fluxo de caixa.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={crmFinanceiroResumo.fluxoOrdenado}>
                      <CartesianGrid stroke={chartTheme.grid} strokeDasharray="6 6" />
                      <XAxis
                        dataKey="data"
                        tickFormatter={(valor) => valor.slice(5)}
                        tick={{ fill: chartTheme.tick, fontSize: 12 }}
                        stroke={chartTheme.grid}
                      />
                      <YAxis
                        stroke={chartTheme.grid}
                        tick={{ fill: chartTheme.tick, fontSize: 12 }}
                        tickFormatter={formatAxis}
                        width={90}
                      />
                      <Tooltip
                        formatter={(value: number) => currency(value)}
                        labelFormatter={(label) => `Dia ${label}`}
                        contentStyle={{
                          background: chartTheme.tooltipBg,
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                          color: chartTheme.tooltipText,
                        }}
                        itemStyle={{ color: chartTheme.tooltipText }}
                        labelStyle={{ color: chartTheme.tooltipText }}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ color: chartTheme.legend }} />
                      <Line type="monotone" dataKey="entradas" name="Entradas" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" strokeWidth={2} dot={false} />
                      <Line
                        type="monotone"
                        dataKey="saldoAcumulado"
                        name="Saldo acumulado"
                        stroke="#38bdf8"
                        strokeWidth={3}
                        dot={false}
                      />
                      <ReferenceLine y={0} stroke="rgba(239,68,68,0.45)" strokeDasharray="4 4" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="crm-margins">
                <h3>ROI e margens por lead</h3>
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Modelo</th>
                      <th>Receita (R$)</th>
                      <th>Custos (R$)</th>
                      <th>Margem bruta (R$)</th>
                      <th>Margem (%)</th>
                      <th>ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crmFinanceiroResumo.margens.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="crm-empty">
                          Informe contratos e custos para acompanhar margens e ROI de cada projeto.
                        </td>
                      </tr>
                    ) : (
                      crmFinanceiroResumo.margens.map((item) => (
                        <tr key={item.leadId}>
                          <td>{item.leadNome}</td>
                          <td>{item.modelo === 'LEASING' ? 'Leasing' : 'Venda'}</td>
                          <td>{currency(item.receitaProjetada)}</td>
                          <td>{currency(item.custoTotal)}</td>
                          <td>{currency(item.margemBruta)}</td>
                          <td>
                            {item.margemPct === null
                              ? null
                              : formatPercentBR((item.margemPct ?? 0) / 100)}
                          </td>
                          <td>{item.roi === null ? null : formatPercentBR(item.roi)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Seção 7 - Inteligência e relatórios */}
        <section className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>7. Inteligência e relatórios</h2>
              <p>
                Indicadores consolidados da operação comercial, técnica e financeira da SolarInvest, com alertas de
                gargalos.
              </p>
            </div>
          </div>
          <div className="crm-insights-grid">
            {/* Painéis estratégicos conectando marketing, operação técnica e finanças. */}
            <div className="crm-insight-panel">
              <h3>Métricas principais</h3>
              <ul className="crm-kpi-list">
                <li>
                  <span>Taxa de conversão</span>
                  <strong>{crmIndicadoresGerenciais.taxaConversao}%</strong>
                </li>
                <li>
                  <span>Tempo médio de fechamento</span>
                  <strong>{crmIndicadoresGerenciais.tempoMedioFechamento} dias</strong>
                </li>
                <li>
                  <span>ROI médio</span>
                  <strong>
                    {Number.isFinite(crmIndicadoresGerenciais.roiMedio)
                      ? formatPercentBR(crmIndicadoresGerenciais.roiMedio)
                      : null}
                  </strong>
                </li>
                <li>
                  <span>Receita recorrente projetada</span>
                  <strong>{currency(crmIndicadoresGerenciais.receitaRecorrenteProjetada)}</strong>
                </li>
                <li>
                  <span>Receita pontual projetada</span>
                  <strong>{currency(crmIndicadoresGerenciais.receitaPontualProjetada)}</strong>
                </li>
              </ul>
            </div>
            <div className="crm-insight-panel">
              <h3>Origem dos leads</h3>
              <ul className="crm-kpi-list">
                {Object.entries(crmIndicadoresGerenciais.leadsPorOrigem).map(([origem, quantidade]) => (
                  <li key={origem}>
                    <span>{origem}</span>
                    <strong>{quantidade}</strong>
                  </li>
                ))}
                {Object.keys(crmIndicadoresGerenciais.leadsPorOrigem).length === 0 ? (
                  <li className="crm-empty">Cadastre leads para visualizar a distribuição de origens.</li>
                ) : null}
              </ul>
            </div>
            <div className="crm-insight-panel">
              <h3>Mapa de geração por cidade</h3>
              <ul className="crm-kpi-list">
                {Object.entries(crmIndicadoresGerenciais.mapaGeracao).map(([cidade, consumo]) => (
                  <li key={cidade}>
                    <span>{cidade}</span>
                    <strong>{consumo} kWh</strong>
                  </li>
                ))}
                {Object.keys(crmIndicadoresGerenciais.mapaGeracao).length === 0 ? (
                  <li className="crm-empty">Nenhum dado de geração disponível. Feche contratos para popular o mapa.</li>
                ) : null}
              </ul>
            </div>
            <div className="crm-insight-panel">
              <h3>Alertas de gargalos</h3>
              {crmIndicadoresGerenciais.gargalos.length === 0 ? (
                <p className="crm-empty">O funil está saudável, sem gargalos detectados.</p>
              ) : (
                <ul className="crm-alert-list">
                  {crmIndicadoresGerenciais.gargalos.map((texto, index) => (
                    <li key={texto + index}>{texto}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )

  const handleSalvarCliente = useCallback(async () => {
    if (typeof window === 'undefined') {
      return
    }

    if (!validarCamposObrigatorios('salvar o cliente')) {
      return
    }

    const dadosClonados = cloneClienteDados(cliente)
    const agoraIso = new Date().toISOString()
    const estaEditando = Boolean(clienteEmEdicaoId)
    let registroSalvo: ClienteRegistro | null = null
    let houveErro = false

    setClientesSalvos((prevRegistros) => {
      const existingIds = new Set(prevRegistros.map((registro) => registro.id))
      let registrosAtualizados: ClienteRegistro[] = prevRegistros
      let registroAtualizado: ClienteRegistro | null = null

      if (clienteEmEdicaoId) {
        let encontrado = false
        registrosAtualizados = prevRegistros.map((registro) => {
          if (registro.id === clienteEmEdicaoId) {
            encontrado = true
            const atualizado: ClienteRegistro = {
              ...registro,
              dados: dadosClonados,
              atualizadoEm: agoraIso,
            }
            registroAtualizado = atualizado
            return atualizado
          }
          return registro
        })

        if (!encontrado) {
          const novoRegistro: ClienteRegistro = {
            id: generateClienteId(existingIds),
            criadoEm: agoraIso,
            atualizadoEm: agoraIso,
            dados: dadosClonados,
          }
          registroAtualizado = novoRegistro
          registrosAtualizados = [novoRegistro, ...prevRegistros]
        }
      } else {
        const novoRegistro: ClienteRegistro = {
          id: generateClienteId(existingIds),
          criadoEm: agoraIso,
          atualizadoEm: agoraIso,
          dados: dadosClonados,
        }
        registroAtualizado = novoRegistro
        registrosAtualizados = [novoRegistro, ...prevRegistros]
      }

      const ordenados = [...registrosAtualizados].sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1))

      try {
        window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(ordenados))
      } catch (error) {
        console.error('Erro ao salvar cliente localmente.', error)
        window.alert('Não foi possível salvar o cliente. Tente novamente.')
        houveErro = true
        return prevRegistros
      }

      registroSalvo = registroAtualizado
      return ordenados
    })

    const salvo = registroSalvo as ClienteRegistro | null
    if (houveErro || !salvo) {
      return
    }

    const registroConfirmado: ClienteRegistro = salvo
    let sincronizadoComSucesso = false
    let erroSincronizacao: unknown = null

    try {
      await persistClienteRegistroToOneDrive(mapClienteRegistroToSyncPayload(registroConfirmado))
      sincronizadoComSucesso = true
    } catch (error) {
      erroSincronizacao = error
      console.error('Erro ao sincronizar cliente com o OneDrive.', error)
    }

    setClienteEmEdicaoId(registroConfirmado.id)

    if (sincronizadoComSucesso) {
      adicionarNotificacao(
        estaEditando
          ? 'Dados do cliente atualizados e sincronizados com o OneDrive com sucesso.'
          : 'Cliente salvo e sincronizado com o OneDrive com sucesso.',
        'success',
      )
    } else {
      const mensagemErro =
        erroSincronizacao instanceof Error && erroSincronizacao.message
          ? erroSincronizacao.message
          : 'Erro desconhecido ao sincronizar com o OneDrive.'
      adicionarNotificacao(
        `Cliente salvo localmente, mas houve erro ao sincronizar com o OneDrive. ${mensagemErro}`,
        'error',
      )
    }
  }, [
    adicionarNotificacao,
    cliente,
    clienteEmEdicaoId,
    persistClienteRegistroToOneDrive,
    setClienteEmEdicaoId,
    validarCamposObrigatorios,
  ])

  const handleEditarCliente = useCallback(
    (registro: ClienteRegistro) => {
      setCliente(cloneClienteDados(registro.dados))
      setClienteMensagens({})
      setClienteEmEdicaoId(registro.id)
      setIsClientesModalOpen(false)
    },
    [setCliente, setClienteEmEdicaoId, setClienteMensagens, setIsClientesModalOpen],
  )

  const handleExcluirCliente = useCallback(
    (registro: ClienteRegistro) => {
      if (typeof window === 'undefined') {
        return
      }

      const nomeCliente = registro.dados.nome?.trim() || 'este cliente'
      const confirmado = window.confirm(
        `Deseja realmente excluir ${nomeCliente}? Essa ação não poderá ser desfeita.`,
      )
      if (!confirmado) {
        return
      }

      let removeuEdicaoAtual = false
      let houveErro = false

      setClientesSalvos((prevRegistros) => {
        const registrosAtualizados = prevRegistros.filter((item) => item.id !== registro.id)
        if (registrosAtualizados.length === prevRegistros.length) {
          return prevRegistros
        }

        try {
          if (registrosAtualizados.length > 0) {
            window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(registrosAtualizados))
          } else {
            window.localStorage.removeItem(CLIENTES_STORAGE_KEY)
          }
        } catch (error) {
          console.error('Erro ao excluir cliente salvo.', error)
          window.alert('Não foi possível atualizar os clientes salvos. Tente novamente.')
          houveErro = true
          return prevRegistros
        }

        if (clienteEmEdicaoId === registro.id) {
          removeuEdicaoAtual = true
        }

        return registrosAtualizados
      })

      if (houveErro) {
        return
      }

      if (removeuEdicaoAtual) {
        setCliente({ ...CLIENTE_INICIAL })
        setClienteMensagens({})
        setClienteEmEdicaoId(null)
      }
    },
    [clienteEmEdicaoId, setCliente, setClienteEmEdicaoId, setClienteMensagens],
  )

  const abrirClientesModal = () => {
    const registros = carregarClientesSalvos()
    setClientesSalvos(registros)
    setIsClientesModalOpen(true)
    setIsSettingsOpen(false)
  }

  const fecharClientesModal = () => {
    setIsClientesModalOpen(false)
  }

  const carregarOrcamentosSalvos = useCallback((): OrcamentoSalvo[] => {
    if (typeof window === 'undefined') {
      return []
    }

    const existenteRaw = window.localStorage.getItem(BUDGETS_STORAGE_KEY)
    if (!existenteRaw) {
      return []
    }

    try {
      const parsed = JSON.parse(existenteRaw)
      if (!Array.isArray(parsed)) {
        return []
      }

      const clientesRegistrados = carregarClientesSalvos()
      const clienteIdPorDocumento = new Map<string, string>()
      const clienteIdPorUc = new Map<string, string>()

      clientesRegistrados.forEach((clienteRegistro) => {
        const documento = normalizeNumbers(clienteRegistro.dados.documento ?? '')
        if (documento && !clienteIdPorDocumento.has(documento)) {
          clienteIdPorDocumento.set(documento, clienteRegistro.id)
        }

        const uc = normalizeText(clienteRegistro.dados.uc ?? '')
        if (uc && !clienteIdPorUc.has(uc)) {
          clienteIdPorUc.set(uc, clienteRegistro.id)
        }
      })

      const sanitizeClienteId = (valor: unknown) => {
        if (typeof valor !== 'string') {
          return ''
        }

        const normalizado = normalizeClienteIdCandidate(valor)
        if (normalizado.length === CLIENTE_ID_LENGTH && CLIENTE_ID_PATTERN.test(normalizado)) {
          return normalizado
        }

        return ''
      }

      return parsed.map((item) => {
        const registro = item as Partial<OrcamentoSalvo> & { clienteID?: string }
        const dados = registro.dados as PrintableProposalProps
        const clienteDados = (dados?.cliente ?? {}) as Partial<ClienteDados>
        const temIndicacaoRaw = (clienteDados as { temIndicacao?: unknown }).temIndicacao
        const indicacaoNomeRaw = (clienteDados as { indicacaoNome?: unknown }).indicacaoNome
        const temIndicacaoNormalizado =
          typeof temIndicacaoRaw === 'boolean'
            ? temIndicacaoRaw
            : typeof temIndicacaoRaw === 'string'
            ? ['1', 'true', 'sim'].includes(temIndicacaoRaw.trim().toLowerCase())
            : false
        const indicacaoNomeNormalizado =
          typeof indicacaoNomeRaw === 'string' ? indicacaoNomeRaw.trim() : ''

        const clienteNormalizado: ClienteDados = {
          nome: clienteDados.nome ?? '',
          documento: clienteDados.documento ?? '',
          email: clienteDados.email ?? '',
          telefone: clienteDados.telefone ?? '',
          cep: clienteDados.cep ?? '',
          distribuidora: clienteDados.distribuidora ?? '',
          uc: clienteDados.uc ?? '',
          endereco: clienteDados.endereco ?? '',
          cidade: clienteDados.cidade ?? '',
          uf: clienteDados.uf ?? '',
          temIndicacao: temIndicacaoNormalizado,
          indicacaoNome: temIndicacaoNormalizado ? indicacaoNomeNormalizado : '',
        }

        const dadosNormalizados: PrintableProposalProps = {
          ...dados,
          budgetId: dados?.budgetId ?? registro.id,
          cliente: clienteNormalizado,
          distribuidoraTarifa: dados.distribuidoraTarifa ?? clienteNormalizado.distribuidora ?? '',
          tipoProposta: dados?.tipoProposta === 'VENDA_DIRETA' ? 'VENDA_DIRETA' : 'LEASING',
        }

        const clienteIdArmazenado =
          sanitizeClienteId(
            registro.clienteId ??
              registro.clienteID ??
              (dadosNormalizados as unknown as { clienteId?: string }).clienteId ??
              ((dadosNormalizados.cliente as unknown as { id?: string })?.id ?? ''),
          )

        const documentoRaw = registro.clienteDocumento ?? dadosNormalizados.cliente.documento ?? ''
        const ucRaw = registro.clienteUc ?? dadosNormalizados.cliente.uc ?? ''

        let clienteId = clienteIdArmazenado

        if (!clienteId) {
          const documentoDigits = normalizeNumbers(documentoRaw)
          if (documentoDigits) {
            clienteId = clienteIdPorDocumento.get(documentoDigits) ?? ''
          }
        }

        if (!clienteId) {
          const ucTexto = normalizeText(ucRaw)
          if (ucTexto) {
            clienteId = clienteIdPorUc.get(ucTexto) ?? ''
          }
        }

        const id = typeof registro.id === 'string' && registro.id ? registro.id : ensureProposalId(dadosNormalizados.budgetId)
        const criadoEm =
          typeof registro.criadoEm === 'string' && registro.criadoEm
            ? registro.criadoEm
            : new Date().toISOString()

        return {
          id,
          criadoEm,
          clienteId: clienteId || undefined,
          clienteNome: dadosNormalizados.cliente.nome,
          clienteCidade: dadosNormalizados.cliente.cidade,
          clienteUf: dadosNormalizados.cliente.uf,
          clienteDocumento: registro.clienteDocumento ?? dadosNormalizados.cliente.documento ?? '',
          clienteUc: registro.clienteUc ?? dadosNormalizados.cliente.uc ?? '',
          dados: dadosNormalizados,
        }
      })
    } catch (error) {
      console.warn('Não foi possível interpretar os orçamentos salvos existentes.', error)
      return []
    }
  }, [carregarClientesSalvos])

  const salvarOrcamentoLocalmente = useCallback(
    (dados: PrintableProposalProps): OrcamentoSalvo | null => {
      if (typeof window === 'undefined') {
        return null
      }

      try {
        const registrosExistentes = carregarOrcamentosSalvos()
        const dadosClonados = clonePrintableData(dados)
        const fingerprint = createBudgetFingerprint(dadosClonados)
        const registroExistente = registrosExistentes.find(
          (registro) => createBudgetFingerprint(registro.dados) === fingerprint,
        )

        if (registroExistente) {
          setOrcamentosSalvos(registrosExistentes)
          return registroExistente
        }

        const existingIds = new Set(registrosExistentes.map((registro) => registro.id))
        const candidatoInformado = normalizeProposalId(dadosClonados.budgetId)
        const novoId =
          candidatoInformado && !existingIds.has(candidatoInformado)
            ? candidatoInformado
            : generateBudgetId(existingIds, dadosClonados.tipoProposta)
        const registro: OrcamentoSalvo = {
          id: novoId,
          criadoEm: new Date().toISOString(),
          clienteId: clienteEmEdicaoId ?? undefined,
          clienteNome: dados.cliente.nome,
          clienteCidade: dados.cliente.cidade,
          clienteUf: dados.cliente.uf,
          clienteDocumento: dados.cliente.documento,
          clienteUc: dados.cliente.uc,
          dados: { ...dadosClonados, budgetId: novoId },
        }

        existingIds.add(registro.id)
        const registrosAtualizados = [registro, ...registrosExistentes]
        window.localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(registrosAtualizados))
        setOrcamentosSalvos(registrosAtualizados)
        return registro
      } catch (error) {
        console.error('Erro ao salvar orçamento localmente.', error)
        window.alert('Não foi possível salvar o orçamento. Tente novamente.')
        return null
      }
    },
    [carregarOrcamentosSalvos, clienteEmEdicaoId],
  )

  const removerOrcamentoSalvo = useCallback(
    (id: string) => {
      if (typeof window === 'undefined') {
        return
      }

      setOrcamentosSalvos((prevRegistros) => {
        const registrosAtualizados = prevRegistros.filter((registro) => registro.id !== id)

        try {
          if (registrosAtualizados.length > 0) {
            window.localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(registrosAtualizados))
          } else {
            window.localStorage.removeItem(BUDGETS_STORAGE_KEY)
          }
        } catch (error) {
          console.error('Erro ao atualizar os orçamentos salvos.', error)
          window.alert('Não foi possível atualizar os orçamentos salvos. Tente novamente.')
          return prevRegistros
        }

        return registrosAtualizados
      })
    },
    [setOrcamentosSalvos],
  )

  const handleEficienciaInput = (valor: number) => {
    if (!Number.isFinite(valor)) {
      setEficiencia(0)
      return
    }
    if (valor <= 0) {
      setEficiencia(0)
      return
    }
    if (valor >= 1.5) {
      setEficiencia(valor / 100)
      return
    }
    setEficiencia(valor)
  }
  const handlePrint = async () => {
    if (!validarCamposObrigatorios()) {
      return
    }

    const resultado = await prepararPropostaParaExportacao({
      incluirTabelaBuyout: isVendaDiretaTab,
    })

    if (!resultado) {
      window.alert('Não foi possível gerar a visualização para impressão. Tente novamente.')
      return
    }

    const { html: layoutHtml, dados } = resultado
    pendingPreviewDataRef.current = {
      html: layoutHtml,
      dados,
    }
    const nomeCliente = dados.cliente.nome?.trim() || 'SolarInvest'
    const budgetId = normalizeProposalId(dados.budgetId)
    openBudgetPreviewWindow(layoutHtml, {
      nomeCliente,
      budgetId,
      actionMessage: 'Revise o conteúdo e utilize as ações para gerar o PDF.',
      initialMode: 'preview',
    })
  }

  const handleImprimirTabelaTransferencia = useCallback(async () => {
    if (gerandoTabelaTransferencia) {
      return
    }

    const codigoOrcamento = printableData.budgetId?.trim()
    if (!codigoOrcamento) {
      window.alert(
        'Associe um número de orçamento ao cliente antes de imprimir a tabela de valor de transferência.',
      )
      return
    }

    const possuiValoresTransferencia = tabelaBuyout.some(
      (row) => row.valorResidual != null && Number.isFinite(row.valorResidual) && row.mes >= 7,
    )
    if (!possuiValoresTransferencia) {
      window.alert(
        'Não há valores calculados para a compra antecipada desta proposta. Atualize a simulação antes de imprimir a tabela.',
      )
      return
    }

    setGerandoTabelaTransferencia(true)

    try {
      const html = await renderPrintableBuyoutTableToHtml({
        cliente: cloneClienteDados(cliente),
        budgetId: codigoOrcamento,
        tabelaBuyout,
        buyoutResumo,
        prazoContratualMeses: duracaoMeses,
        emissaoIso: new Date().toISOString(),
        observacaoImportante: printableData.informacoesImportantesObservacao,
      })

      if (!html) {
        throw new Error('Não foi possível preparar o conteúdo da tabela para impressão.')
      }

      await persistProposalPdf({
        html,
        budgetId: codigoOrcamento,
        clientName: cliente.nome,
        proposalType: 'LEASING',
        fileName: `Tabela-Valor-de-Transferencia-${codigoOrcamento}.pdf`,
        metadata: {
          source: 'buyout-table',
          variant: 'transferencia',
        },
      })

      adicionarNotificacao('Tabela de valor de transferência salva em PDF.', 'success')
    } catch (error) {
      console.error('Erro ao salvar a tabela de valor de transferência em PDF.', error)
      const mensagem =
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível salvar a tabela de valor de transferência. Tente novamente.'
      adicionarNotificacao(mensagem, 'error')
    } finally {
      setGerandoTabelaTransferencia(false)
    }
  }, [
    adicionarNotificacao,
    cliente,
    duracaoMeses,
    gerandoTabelaTransferencia,
    printableData.budgetId,
    printableData.informacoesImportantesObservacao,
    tabelaBuyout,
    buyoutResumo,
    renderPrintableBuyoutTableToHtml,
  ])

  const handlePreviewActionRequest = useCallback(
    async ({ action: _action }: PreviewActionRequest): Promise<PreviewActionResponse> => {
      const previewData = pendingPreviewDataRef.current
      const budgetIdAtual = normalizeProposalId(currentBudgetId)

      if (!previewData) {
        return { proceed: true }
      }

      const { dados } = previewData
      const idExistente = normalizeProposalId(dados.budgetId ?? budgetIdAtual)
      if (idExistente) {
        const emissaoIso = new Date().toISOString().slice(0, 10)
        if (currentBudgetId !== idExistente) {
          renameVendasSimulacao(currentBudgetId, idExistente)
          setCurrentBudgetId(idExistente)
        }
        vendaActions.updateCodigos({
          codigo_orcamento_interno: idExistente,
          data_emissao: emissaoIso,
        })
        return { proceed: true, budgetId: idExistente }
      }

      if (!clienteEmEdicaoId) {
        return { proceed: true, budgetId: '' }
      }

      const confirmarSalvar = window.confirm(
        'Deseja salvar este documento antes de imprimir ou baixar? Ele será armazenado no histórico do cliente.',
      )
      if (!confirmarSalvar) {
        return { proceed: true, budgetId: '' }
      }

      try {
        const registro = salvarOrcamentoLocalmente(dados)
        if (!registro) {
          return { proceed: false }
        }

        dados.budgetId = registro.id
        const emissaoIso = new Date().toISOString().slice(0, 10)
        if (currentBudgetId !== registro.id) {
          renameVendasSimulacao(currentBudgetId, registro.id)
          setCurrentBudgetId(registro.id)
        }

        vendaActions.updateCodigos({
          codigo_orcamento_interno: registro.id,
          data_emissao: emissaoIso,
        })

        let htmlAtualizado = previewData.html
        try {
          const reprocessado = await renderPrintableProposalToHtml(dados)
          if (reprocessado) {
            htmlAtualizado = reprocessado
            previewData.html = reprocessado
          }
        } catch (error) {
          console.warn('Não foi possível atualizar o HTML antes da impressão.', error)
        }

        try {
          const proposalType = activeTab === 'vendas' ? 'VENDA_DIRETA' : 'LEASING'
          await persistProposalPdf({
            html: htmlAtualizado,
            budgetId: registro.id,
            clientName: dados.cliente.nome,
            proposalType,
          })
          adicionarNotificacao(
            'Proposta salva em PDF com sucesso. Uma cópia foi armazenada localmente.',
            'success',
          )
        } catch (error) {
          console.error('Erro ao salvar a proposta em PDF durante a impressão.', error)
          window.alert('Não foi possível salvar a proposta em PDF. Tente novamente.')
          return { proceed: false }
        }

        previewData.dados = dados

        return {
          proceed: true,
          budgetId: registro.id,
          updatedHtml: htmlAtualizado,
        }
      } catch (error) {
        console.error('Erro ao preparar o salvamento antes da impressão.', error)
        window.alert('Não foi possível salvar o documento. Tente novamente.')
        return { proceed: false }
      }
    },
    [
      activeTab,
      adicionarNotificacao,
      clienteEmEdicaoId,
      currentBudgetId,
      renameVendasSimulacao,
      salvarOrcamentoLocalmente,
      setCurrentBudgetId,
    ],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.__solarinvestOnPreviewAction = handlePreviewActionRequest
    return () => {
      if (window.__solarinvestOnPreviewAction === handlePreviewActionRequest) {
        delete window.__solarinvestOnPreviewAction
      }
    }
  }, [handlePreviewActionRequest])

  const handleSalvarPropostaPdf = useCallback(async () => {
    if (salvandoPropostaPdf) {
      return
    }

    if (!validarCamposObrigatorios('salvar a proposta')) {
      return
    }

    if (!clienteEmEdicaoId) {
      window.alert('Salve os dados do cliente antes de salvar o orçamento.')
      return
    }

    setSalvandoPropostaPdf(true)

    let salvouLocalmente = false

    try {
      const resultado = await prepararPropostaParaExportacao({
        incluirTabelaBuyout: isVendaDiretaTab,
      })

      if (!resultado) {
        window.alert('Não foi possível preparar a proposta para salvar em PDF. Tente novamente.')
        return
      }

      const { html, dados } = resultado
      const registroSalvo = salvarOrcamentoLocalmente(dados)
      if (!registroSalvo) {
        return
      }

      salvouLocalmente = true
      dados.budgetId = registroSalvo.id

      const emissaoIso = new Date().toISOString().slice(0, 10)
      if (currentBudgetId !== registroSalvo.id) {
        renameVendasSimulacao(currentBudgetId, registroSalvo.id)
        setCurrentBudgetId(registroSalvo.id)
      }

      vendaActions.updateCodigos({
        codigo_orcamento_interno: registroSalvo.id,
        data_emissao: emissaoIso,
      })

      let htmlComCodigo = html
      try {
        const atualizado = await renderPrintableProposalToHtml(dados)
        if (atualizado) {
          htmlComCodigo = atualizado
        }
      } catch (error) {
        console.warn('Não foi possível atualizar o HTML com o código do orçamento.', error)
      }

      const proposalType = activeTab === 'vendas' ? 'VENDA_DIRETA' : 'LEASING'

      await persistProposalPdf({
        html: htmlComCodigo,
        budgetId: registroSalvo.id,
        clientName: dados.cliente.nome,
        proposalType,
      })

      const mensagemSucesso = salvouLocalmente
        ? 'Proposta salva em PDF com sucesso. Uma cópia foi armazenada localmente.'
        : 'Proposta salva em PDF com sucesso.'
      adicionarNotificacao(mensagemSucesso, 'success')
    } catch (error) {
      console.error('Erro ao salvar a proposta em PDF.', error)
      const mensagem =
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível salvar a proposta em PDF. Tente novamente.'
      const mensagemComFallback = salvouLocalmente
        ? `${mensagem} Uma cópia foi armazenada localmente no histórico de orçamentos.`
        : mensagem
      adicionarNotificacao(mensagemComFallback, 'error')
    } finally {
      setSalvandoPropostaPdf(false)
    }
  }, [
    activeTab,
    adicionarNotificacao,
    clienteEmEdicaoId,
    currentBudgetId,
    isVendaDiretaTab,
    prepararPropostaParaExportacao,
    renameVendasSimulacao,
    salvarOrcamentoLocalmente,
    salvandoPropostaPdf,
    validarCamposObrigatorios,
  ])

  const handleNovaProposta = useCallback(() => {
    setSettingsTab(INITIAL_VALUES.settingsTab)
    setIsSettingsOpen(false)
    setIsBudgetSearchOpen(false)
    setOrcamentoSearchTerm('')
    setCurrentBudgetId(createDraftBudgetId())
    setBudgetStructuredItems([])
    setKitBudget(createEmptyKitBudget())
    setIsBudgetProcessing(false)
    setBudgetProcessingError(null)
    setPageSharedState(createPageSharedSettings())
    if (budgetUploadInputRef.current) {
      budgetUploadInputRef.current.value = ''
    }

    setUfTarifa(INITIAL_VALUES.ufTarifa)
    setDistribuidoraTarifa(INITIAL_VALUES.distribuidoraTarifa)
    setMesReajuste(INITIAL_VALUES.mesReajuste)
    mesReferenciaRef.current = new Date().getMonth() + 1
    setKcKwhMes(INITIAL_VALUES.kcKwhMes)
    setTarifaCheia(INITIAL_VALUES.tarifaCheia)
    setDesconto(INITIAL_VALUES.desconto)
    setTaxaMinima(INITIAL_VALUES.taxaMinima)
    setTaxaMinimaInputEmpty(INITIAL_VALUES.taxaMinima === 0)
    setEncargosFixosExtras(INITIAL_VALUES.encargosFixosExtras)
    setTusdPercent(INITIAL_VALUES.tusdPercent)
    setTusdTipoCliente(INITIAL_VALUES.tusdTipoCliente)
    setTusdSubtipo(INITIAL_VALUES.tusdSubtipo)
    setTusdSimultaneidade(INITIAL_VALUES.tusdSimultaneidade)
    setTusdTarifaRkwh(INITIAL_VALUES.tusdTarifaRkwh)
    setTusdAnoReferencia(INITIAL_VALUES.tusdAnoReferencia ?? DEFAULT_TUSD_ANO_REFERENCIA)
    setTusdOpcoesExpandidas(false)
    setLeasingPrazo(INITIAL_VALUES.leasingPrazo)
    setPotenciaModulo(INITIAL_VALUES.potenciaModulo)
    setPotenciaModuloDirty(false)
    setTipoInstalacao(INITIAL_VALUES.tipoInstalacao)
    setTipoInstalacaoDirty(false)
    setTipoSistema(INITIAL_VALUES.tipoSistema)
    setSegmentoCliente(INITIAL_VALUES.segmentoCliente)
    setNumeroModulosManual(INITIAL_VALUES.numeroModulosManual)
    setComposicaoTelhado(createInitialComposicaoTelhado())
    setComposicaoSolo(createInitialComposicaoSolo())
    setCapexManualOverride(INITIAL_VALUES.capexManualOverride)
    setParsedVendaPdf(null)
    setEstruturaTipoWarning(null)

    setPrecoPorKwp(INITIAL_VALUES.precoPorKwp)
    setIrradiacao(IRRADIACAO_FALLBACK)
    setEficiencia(INITIAL_VALUES.eficiencia)
    setDiasMes(INITIAL_VALUES.diasMes)
    setInflacaoAa(INITIAL_VALUES.inflacaoAa)

    setMultiUcAtivo(INITIAL_VALUES.multiUcAtivo)
    setMultiUcRateioModo(INITIAL_VALUES.multiUcRateioModo)
    setMultiUcEnergiaGeradaKWhState(INITIAL_VALUES.multiUcEnergiaGeradaKWh)
    setMultiUcEnergiaGeradaTouched(false)
    setMultiUcAnoVigencia(INITIAL_VALUES.multiUcAnoVigencia)
    setMultiUcOverrideEscalonamento(INITIAL_VALUES.multiUcOverrideEscalonamento)
    setMultiUcEscalonamentoCustomPercent(INITIAL_VALUES.multiUcEscalonamentoCustomPercent)
    multiUcConsumoAnteriorRef.current = null
    const multiUcInicialQuantidade = Math.max(1, INITIAL_VALUES.multiUcUcs.length)
    multiUcIdCounterRef.current = multiUcInicialQuantidade + 1
    setMultiUcRows(() =>
      Array.from({ length: multiUcInicialQuantidade }, (_, index) =>
        applyTarifasAutomaticas(createDefaultMultiUcRow(index + 1), undefined, true),
      ),
    )

    setVendaForm(createInitialVendaForm())
    setVendaFormErrors({})
    resetRetorno()

    setJurosFinAa(INITIAL_VALUES.jurosFinanciamentoAa)
    setPrazoFinMeses(INITIAL_VALUES.prazoFinanciamentoMeses)
    setEntradaFinPct(INITIAL_VALUES.entradaFinanciamentoPct)
    setMostrarFinanciamento(INITIAL_VALUES.mostrarFinanciamento)
    setMostrarGrafico(INITIAL_VALUES.mostrarGrafico)

    setPrazoMeses(INITIAL_VALUES.prazoMeses)
    setBandeiraEncargo(INITIAL_VALUES.bandeiraEncargo)
    setCipEncargo(INITIAL_VALUES.cipEncargo)
    setEntradaRs(INITIAL_VALUES.entradaRs)
    setEntradaModo(INITIAL_VALUES.entradaModo)
    setMostrarTabelaParcelas(INITIAL_VALUES.tabelaVisivel)
    setMostrarTabelaBuyout(INITIAL_VALUES.tabelaVisivel)
    setMostrarTabelaParcelasConfig(INITIAL_VALUES.tabelaVisivel)
    setMostrarTabelaBuyoutConfig(INITIAL_VALUES.tabelaVisivel)
    setSalvandoPropostaPdf(false)

    setOemBase(INITIAL_VALUES.oemBase)
    setOemInflacao(INITIAL_VALUES.oemInflacao)
    setSeguroModo(INITIAL_VALUES.seguroModo)
    setSeguroReajuste(INITIAL_VALUES.seguroReajuste)
    setSeguroValorA(INITIAL_VALUES.seguroValorA)
    setSeguroPercentualB(INITIAL_VALUES.seguroPercentualB)
    setExibirLeasingLinha(INITIAL_VALUES.exibirLeasingLinha)
    setExibirFinLinha(INITIAL_VALUES.exibirFinanciamentoLinha)

    setCashbackPct(INITIAL_VALUES.cashbackPct)
    setDepreciacaoAa(INITIAL_VALUES.depreciacaoAa)
    setInadimplenciaAa(INITIAL_VALUES.inadimplenciaAa)
    setTributosAa(INITIAL_VALUES.tributosAa)
    setIpcaAa(INITIAL_VALUES.ipcaAa)
    setCustosFixosM(INITIAL_VALUES.custosFixosM)
    setOpexM(INITIAL_VALUES.opexM)
    setSeguroM(INITIAL_VALUES.seguroM)
    setDuracaoMeses(INITIAL_VALUES.duracaoMeses)
    setPagosAcumAteM(INITIAL_VALUES.pagosAcumManual)

    setCliente({ ...CLIENTE_INICIAL })
    setClienteMensagens({})
    setClienteEmEdicaoId(null)
    setIsClientesModalOpen(false)
    setNotificacoes([])
  }, [
    createPageSharedSettings,
    applyTarifasAutomaticas,
    resetRetorno,
    setDistribuidoraTarifa,
    setKcKwhMes,
    setNumeroModulosManual,
    setPageSharedState,
    setPotenciaModulo,
    setPotenciaModuloDirty,
    setSegmentoCliente,
    setTarifaCheia,
    setTaxaMinima,
    setTipoInstalacao,
    setTipoInstalacaoDirty,
    setUfTarifa,
    setMultiUcAnoVigencia,
    setMultiUcRateioModo,
    setMultiUcOverrideEscalonamento,
    setMultiUcEscalonamentoCustomPercent,
    setMultiUcEnergiaGeradaKWhState,
    setMultiUcEnergiaGeradaTouched,
    setMultiUcAtivo,
    setMultiUcRows,
  ])

  const podeSalvarProposta = activeTab === 'leasing' || activeTab === 'vendas'

  const handleClienteChange = <K extends keyof ClienteDados>(key: K, rawValue: ClienteDados[K]) => {
    if (key === 'temIndicacao') {
      const checked = Boolean(rawValue)
      setCliente((prev) => {
        if (prev.temIndicacao === checked) {
          if (!checked && prev.indicacaoNome) {
            return { ...prev, temIndicacao: false, indicacaoNome: '' }
          }
          return prev
        }
        return checked
          ? { ...prev, temIndicacao: true }
          : { ...prev, temIndicacao: false, indicacaoNome: '' }
      })
      return
    }

    if (key === 'uf' && typeof rawValue === 'string') {
      const value = rawValue.toUpperCase()
      setCliente((prev) => {
        const ufNormalizada = value
        const listaDistribuidoras = distribuidorasPorUf[ufNormalizada] ?? []
        let proximaDistribuidora = prev.distribuidora

        if (listaDistribuidoras.length === 1) {
          proximaDistribuidora = listaDistribuidoras[0]
        } else if (proximaDistribuidora && !listaDistribuidoras.includes(proximaDistribuidora)) {
          proximaDistribuidora = ''
        }

        if (prev.uf === ufNormalizada && prev.distribuidora === proximaDistribuidora) {
          return prev
        }

        return { ...prev, uf: ufNormalizada, distribuidora: proximaDistribuidora }
      })
      return
    }

    let nextValue = rawValue

    if (typeof rawValue === 'string') {
      if (key === 'documento') {
        nextValue = formatCpfCnpj(rawValue) as ClienteDados[K]
      } else if (key === 'email') {
        nextValue = rawValue.trim() as ClienteDados[K]
      } else if (key === 'telefone') {
        nextValue = formatTelefone(rawValue) as ClienteDados[K]
      } else if (key === 'cep') {
        nextValue = formatCep(rawValue) as ClienteDados[K]
      }
    }

    setCliente((prev) => {
      if (prev[key] === nextValue) {
        return prev
      }
      return { ...prev, [key]: nextValue }
    })

    if (key === 'email' && typeof nextValue === 'string') {
      const trimmed = nextValue.trim()
      setClienteMensagens((prev) => ({
        ...prev,
        email: trimmed && !emailValido(trimmed) ? 'Informe um e-mail válido.' : undefined,
      }))
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const cepNumeros = normalizeNumbers(cliente.cep)
    if (cepNumeros.length < 8) {
      setBuscandoCep(false)
      setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cep: undefined }))
      return
    }

    let ativo = true
    const controller = new AbortController()

    const consultarCep = async () => {
      setBuscandoCep(true)
      setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cep: undefined }))

      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepNumeros}/json/`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Falha ao consultar CEP.')
        }

        const data: ViaCepResponse = await response.json()
        if (!ativo) {
          return
        }

        if (data?.erro) {
          setClienteMensagens((prev) => ({ ...prev, cep: 'CEP não encontrado.' }))
          return
        }

        const logradouro = data?.logradouro?.trim() ?? ''
        const localidade = data?.localidade?.trim() ?? ''
        const uf = data?.uf?.trim().toUpperCase() ?? ''

        setCliente((prev) => {
          let alterado = false
          const proximo: ClienteDados = { ...prev }

          if (logradouro && logradouro !== prev.endereco) {
            proximo.endereco = logradouro
            alterado = true
          }

          if (localidade && localidade !== prev.cidade) {
            proximo.cidade = localidade
            alterado = true
          }

          if (uf && uf !== prev.uf) {
            proximo.uf = uf
            alterado = true
          }

          if (!alterado) {
            return prev
          }

          return proximo
        })

        setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cep: undefined, cidade: undefined }))
      } catch (error) {
        if (!ativo || controller.signal.aborted) {
          return
        }

        setClienteMensagens((prev) => ({
          ...prev,
          cep: 'Não foi possível consultar o CEP agora.',
        }))
      } finally {
        if (ativo) {
          setBuscandoCep(false)
        }
      }
    }

    consultarCep()

    return () => {
      ativo = false
      controller.abort()
    }
  }, [cliente.cep])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nomeCidade = cliente.cidade.trim()
    const ufSelecionada = cliente.uf.trim().toUpperCase()

    if (nomeCidade.length < 3) {
      setVerificandoCidade(false)
      setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cidade: undefined }))
      return
    }

    let ativo = true
    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      if (!ativo) {
        return
      }

      setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cidade: undefined }))
      setVerificandoCidade(true)

      try {
        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${encodeURIComponent(nomeCidade)}`,
          { signal: controller.signal },
        )

        if (!response.ok) {
          throw new Error('Falha ao buscar municípios no IBGE.')
        }

        const data: IbgeMunicipio[] = await response.json()
        if (!ativo) {
          return
        }

        let aviso: string | undefined
        if (!Array.isArray(data) || data.length === 0) {
          aviso = 'Cidade não encontrada na base do IBGE.'
        } else {
          const cidadeNormalizada = normalizeText(nomeCidade)
          const possuiNome = data.some((municipio) => normalizeText(municipio?.nome ?? '') === cidadeNormalizada)

          if (!possuiNome) {
            aviso = 'Cidade não encontrada na base do IBGE.'
          } else if (ufSelecionada) {
            const existeNoEstado = data.some((municipio) => {
              if (normalizeText(municipio?.nome ?? '') !== cidadeNormalizada) {
                return false
              }

              const sigla = municipio?.microrregiao?.mesorregiao?.UF?.sigla ?? ''
              return sigla.toUpperCase() === ufSelecionada
            })

            if (!existeNoEstado) {
              aviso = `Cidade não encontrada no estado ${ufSelecionada}.`
            }
          }
        }

        setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cidade: aviso }))
      } catch (error) {
        if (!ativo || controller.signal.aborted) {
          return
        }

        setClienteMensagens((prev) => ({
          ...prev,
          cidade: 'Não foi possível verificar a cidade agora.',
        }))
      } finally {
        if (ativo) {
          setVerificandoCidade(false)
        }
      }
    }, 400)

    return () => {
      ativo = false
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [cliente.cidade, cliente.uf])

  const abrirOrcamentoSalvo = useCallback(
    async (registro: OrcamentoSalvo, modo: 'preview' | 'print' | 'download') => {
      try {
        const dadosParaImpressao: PrintableProposalProps = {
          ...registro.dados,
          budgetId: ensureProposalId(registro.dados.budgetId ?? registro.id),
          tipoProposta:
            registro.dados.tipoProposta === 'VENDA_DIRETA' ? 'VENDA_DIRETA' : 'LEASING',
        }
        const layoutHtml = await renderPrintableProposalToHtml(dadosParaImpressao)
        if (!layoutHtml) {
          window.alert('Não foi possível preparar o orçamento selecionado. Tente novamente.')
          return
        }

        const nomeCliente = registro.dados.cliente.nome?.trim() || 'SolarInvest'
        let actionMessage = 'Revise o conteúdo e utilize as ações para gerar o PDF.'
        if (modo === 'print') {
          actionMessage = 'A janela de impressão será aberta automaticamente. Verifique as preferências antes de confirmar.'
        } else if (modo === 'download') {
          actionMessage =
            'Escolha a opção "Salvar como PDF" na janela de impressão para baixar o orçamento.'
        }

        openBudgetPreviewWindow(layoutHtml, {
          nomeCliente,
          budgetId: registro.id,
          actionMessage,
          autoPrint: modo !== 'preview',
          closeAfterPrint: modo === 'download',
          initialMode: modo === 'download' ? 'download' : modo === 'print' ? 'print' : 'preview',
        })
      } catch (error) {
        console.error('Erro ao abrir orçamento salvo.', error)
        window.alert('Não foi possível abrir o orçamento selecionado. Tente novamente.')
      }
    },
    [openBudgetPreviewWindow],
  )

  const confirmarRemocaoOrcamento = useCallback(
    (registro: OrcamentoSalvo) => {
      if (typeof window === 'undefined') {
        return
      }

      const nomeCliente = registro.clienteNome || registro.dados.cliente.nome || 'este cliente'
      const confirmado = window.confirm(
        `Deseja realmente excluir o orçamento ${registro.id} de ${nomeCliente}? Essa ação não poderá ser desfeita.`,
      )

      if (!confirmado) {
        return
      }

      removerOrcamentoSalvo(registro.id)
    },
    [removerOrcamentoSalvo],
  )

  const orcamentosFiltrados = useMemo(() => {
    if (!orcamentoSearchTerm.trim()) {
      return orcamentosSalvos
    }

    const queryText = normalizeText(orcamentoSearchTerm.trim())
    const queryDigits = normalizeNumbers(orcamentoSearchTerm)

    return orcamentosSalvos.filter((registro) => {
      const codigo = normalizeText(registro.id)
      const codigoDigits = normalizeNumbers(registro.id)
      const nome = normalizeText(registro.clienteNome || registro.dados.cliente.nome || '')
      const clienteIdTexto = normalizeText(registro.clienteId ?? '')
      const clienteIdDigits = normalizeNumbers(registro.clienteId ?? '')
      const documentoRaw = registro.clienteDocumento || registro.dados.cliente.documento || ''
      const documentoTexto = normalizeText(documentoRaw)
      const documentoDigits = normalizeNumbers(documentoRaw)
      const ucRaw = registro.clienteUc || registro.dados.cliente.uc || ''
      const ucTexto = normalizeText(ucRaw)
      const ucDigits = normalizeNumbers(ucRaw)

      if (
        codigo.includes(queryText) ||
        nome.includes(queryText) ||
        clienteIdTexto.includes(queryText) ||
        documentoTexto.includes(queryText) ||
        ucTexto.includes(queryText)
      ) {
        return true
      }

      if (!queryDigits) {
        return false
      }

      return (
        codigoDigits.includes(queryDigits) ||
        clienteIdDigits.includes(queryDigits) ||
        documentoDigits.includes(queryDigits) ||
        ucDigits.includes(queryDigits)
      )
    })
  }, [orcamentoSearchTerm, orcamentosSalvos])

  const totalOrcamentos = orcamentosSalvos.length
  const totalResultados = orcamentosFiltrados.length

  const abrirPesquisaOrcamentos = () => {
    const registros = carregarOrcamentosSalvos()
    setOrcamentosSalvos(registros)
    setOrcamentoSearchTerm('')
    setIsSettingsOpen(false)
    setIsBudgetSearchOpen(true)
  }

  const fecharPesquisaOrcamentos = () => {
    setIsBudgetSearchOpen(false)
  }

  const renderClienteDadosSection = () => (
    <section className="card">
      <div className="card-header">
        <h2>Dados do cliente</h2>
      </div>
      <div className="grid g2">
        <Field
          label={labelWithTooltip(
            'Nome ou Razão social',
            'Identificação oficial do cliente utilizada em contratos, relatórios e integração com o CRM.',
          )}
        >
          <input value={cliente.nome} onChange={(e) => handleClienteChange('nome', e.target.value)} />
        </Field>
        <Field
          label={labelWithTooltip(
            'CPF/CNPJ',
            'Documento fiscal do titular da unidade consumidora; necessário para emissão da proposta e cadastros.',
          )}
        >
          <input
            value={cliente.documento}
            onChange={(e) => handleClienteChange('documento', e.target.value)}
            inputMode="numeric"
            placeholder="000.000.000-00"
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'E-mail',
            'Endereço eletrônico usado para envio da proposta, acompanhamento e notificações automáticas.',
          )}
          hint={clienteMensagens.email}
        >
          <input
            value={cliente.email}
            onChange={(e) => handleClienteChange('email', e.target.value)}
            type="email"
            placeholder="nome@empresa.com"
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Telefone',
            'Contato telefônico principal do cliente para follow-up comercial e registros no CRM.',
          )}
        >
          <input
            value={cliente.telefone}
            onChange={(e) => handleClienteChange('telefone', e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'CEP',
            'Código postal da instalação; utilizado para preencher endereço automaticamente e consultar tarifas locais.',
          )}
          hint={buscandoCep ? 'Buscando CEP...' : clienteMensagens.cep}
        >
          <input
            value={cliente.cep}
            onChange={(e) => handleClienteChange('cep', e.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Distribuidora (ANEEL)',
            'Concessionária responsável pela unidade consumidora; define tarifas homologadas e regras de compensação.',
          )}
        >
          <select
            value={cliente.distribuidora}
            onChange={(e) => handleClienteChange('distribuidora', e.target.value)}
            disabled={!cliente.uf || clienteDistribuidorasDisponiveis.length === 0}
          >
            <option value="">
              {cliente.uf ? 'Selecione a distribuidora' : 'Selecione a UF'}
            </option>
            {clienteDistribuidorasDisponiveis.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
            {cliente.distribuidora && !clienteDistribuidorasDisponiveis.includes(cliente.distribuidora) ? (
              <option value={cliente.distribuidora}>{cliente.distribuidora}</option>
            ) : null}
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Unidade consumidora (UC)',
            'Código numérico da UC junto à distribuidora, usado para vincular contratos e projeções de consumo.',
          )}
        >
          <input value={cliente.uc} onChange={(e) => handleClienteChange('uc', e.target.value)} />
        </Field>
        <Field
          label={labelWithTooltip(
            'Endereço de instalação',
            'Local onde o sistema será instalado; aparece em propostas, laudos e integrações logísticas.',
          )}
        >
          <input
            value={cliente.endereco}
            onChange={(e) => handleClienteChange('endereco', e.target.value)}
            autoComplete="street-address"
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Cidade',
            'Município da instalação utilizado em relatórios, cálculo de impostos locais e validação de CEP.',
          )}
          hint={
            verificandoCidade
              ? 'Verificando cidade...'
              : clienteMensagens.cidade
          }
        >
          <input value={cliente.cidade} onChange={(e) => handleClienteChange('cidade', e.target.value)} />
        </Field>
        <Field
          label={labelWithTooltip(
            'UF ou Estado',
            'Estado da instalação; utilizado para listar distribuidoras disponíveis, definir tarifas e parâmetros regionais.',
          )}
        >
          <select value={cliente.uf} onChange={(e) => handleClienteChange('uf', e.target.value)}>
            <option value="">Selecione um estado</option>
            {ufsDisponiveis.map((uf) => (
              <option key={uf} value={uf}>
                {uf} — {UF_LABELS[uf] ?? uf}
              </option>
            ))}
            {cliente.uf && !ufsDisponiveis.includes(cliente.uf) ? (
              <option value={cliente.uf}>
                {cliente.uf} — {UF_LABELS[cliente.uf] ?? cliente.uf}
              </option>
            ) : null}
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Indicação',
            'Marque quando o cliente tiver sido indicado e registre quem realizou a indicação para controle comercial.',
          )}
          hint={cliente.temIndicacao ? 'Informe o nome do responsável pela indicação.' : undefined}
        >
          <div className="cliente-indicacao-group">
            <label className="cliente-indicacao-toggle" htmlFor={clienteIndicacaoCheckboxId}>
              <input
                id={clienteIndicacaoCheckboxId}
                type="checkbox"
                checked={cliente.temIndicacao}
                onChange={(event) => handleClienteChange('temIndicacao', event.target.checked)}
              />
              <span>Indicação</span>
            </label>
            {cliente.temIndicacao ? (
              <input
                id={clienteIndicacaoNomeId}
                className="cfg-input"
                value={cliente.indicacaoNome}
                onChange={(event) => handleClienteChange('indicacaoNome', event.target.value)}
                placeholder="Nome de quem indicou"
                aria-label="Nome de quem indicou"
              />
            ) : null}
          </div>
        </Field>
      </div>
      <div className="card-actions">
        <button type="button" className="primary" onClick={handleSalvarCliente}>
          {clienteEmEdicaoId ? 'Atualizar cliente' : 'Salvar cliente'}
        </button>
        <button type="button" className="ghost" onClick={abrirClientesModal}>
          Ver clientes
        </button>
      </div>
    </section>
  )

  const renderTusdParametersSection = () => {
    const tusdPercentLabel = formatNumberBRWithOptions(tusdPercent, {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(tusdPercent) ? 0 : 2,
    })
    const resumoPartes: string[] = [
      `${tusdPercentLabel}% • ${TUSD_TIPO_LABELS[tusdTipoCliente]}`,
    ]
    const subtipoAtual = tusdSubtipo.trim()
    if (subtipoAtual !== '') {
      resumoPartes.push(subtipoAtual)
    }
    if (tusdSimultaneidade != null) {
      const simultaneidadeLabel = formatNumberBRWithOptions(tusdSimultaneidade, {
        maximumFractionDigits: 2,
        minimumFractionDigits: Number.isInteger(tusdSimultaneidade) ? 0 : 2,
      })
      resumoPartes.push(`Simultaneidade ${simultaneidadeLabel}`)
    }
    if (tusdTarifaRkwh != null) {
      resumoPartes.push(`Tarifa ${currency(tusdTarifaRkwh)}/kWh`)
    }
    if (tusdAnoReferencia !== DEFAULT_TUSD_ANO_REFERENCIA) {
      resumoPartes.push(`Ano ${tusdAnoReferencia}`)
    }

    return (
      <section className="tusd-options" aria-labelledby={tusdOptionsTitleId}>
        <div className="tusd-options-header">
          <div className="tusd-options-title-row">
            <h3 id={tusdOptionsTitleId}>Opções de TUSD</h3>
            <label className="tusd-options-toggle" htmlFor={tusdOptionsToggleId}>
              <input
                id={tusdOptionsToggleId}
                type="checkbox"
                checked={tusdOpcoesExpandidas}
                onChange={(event) => setTusdOpcoesExpandidas(event.target.checked)}
                aria-expanded={tusdOpcoesExpandidas}
                aria-controls={tusdOpcoesExpandidas ? tusdOptionsContentId : undefined}
              />
              <span className="tusd-options-toggle-indicator" aria-hidden="true" />
              <span className="tusd-options-toggle-text">
                {tusdOpcoesExpandidas ? 'Ocultar opções' : 'Exibir opções'}
              </span>
            </label>
          </div>
          <p className="tusd-options-description">
            Configuração atual: {resumoPartes.join(' • ')}
          </p>
        </div>
        {tusdOpcoesExpandidas ? (
          <div className="grid g3 tusd-options-grid" id={tusdOptionsContentId} aria-hidden={false}>
            <Field
              label={labelWithTooltip(
                'TUSD (%)',
                'Percentual do fio B aplicado sobre a energia compensada. Valores superiores a 1 são interpretados como percentuais (ex.: 27 = 27%).',
              )}
            >
              <input
                type="number"
                min={0}
                step="0.1"
                value={tusdPercent}
                onChange={(event) => {
                  const parsed = Number(event.target.value)
                  const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
                  setTusdPercent(normalized)
                  applyVendaUpdates({ tusd_percentual: normalized })
                  resetRetorno()
                }}
                onFocus={selectNumberInputOnFocus}
              />
            </Field>
            <Field
              label={labelWithTooltip(
                'Tipo de cliente TUSD',
                'Categoria utilizada para determinar simultaneidade padrão e fator ano da TUSD.',
              )}
            >
              <select
                value={tusdTipoCliente}
                onChange={(event) => {
                  const value = event.target.value as TipoClienteTUSD
                  setTusdTipoCliente(value)
                  applyVendaUpdates({ tusd_tipo_cliente: value })
                  resetRetorno()
                }}
              >
                {TUSD_TIPO_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {TUSD_TIPO_LABELS[option]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={labelWithTooltip(
                'Subtipo TUSD (opcional)',
                'Permite refinar a simultaneidade padrão conforme o perfil da unidade consumidora.',
              )}
            >
              <input
                type="text"
                value={tusdSubtipo}
                onChange={(event) => {
                  const value = event.target.value
                  setTusdSubtipo(value)
                  applyVendaUpdates({ tusd_subtipo: value || undefined })
                  resetRetorno()
                }}
              />
            </Field>
            <Field
              label={labelWithTooltip(
                'Simultaneidade (%)',
                'Percentual de consumo instantâneo considerado na TUSD. Informe em fração (0-1) ou percentual (0-100).',
              )}
            >
              <input
                type="number"
                min={0}
                step="0.1"
                value={tusdSimultaneidade ?? ''}
                onChange={(event) => {
                  const { value } = event.target
                  if (value === '') {
                    setTusdSimultaneidade(null)
                    applyVendaUpdates({ tusd_simultaneidade: undefined })
                  } else {
                    const parsed = Number(value)
                    const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
                    setTusdSimultaneidade(normalized)
                    applyVendaUpdates({ tusd_simultaneidade: normalized })
                  }
                  resetRetorno()
                }}
                onFocus={selectNumberInputOnFocus}
              />
            </Field>
            <Field
              label={labelWithTooltip(
                'TUSD informado (R$/kWh)',
                'Informe o valor em R$/kWh quando desejar substituir o percentual por uma tarifa fixa de TUSD.',
              )}
            >
              <input
                type="number"
                min={0}
                step="0.001"
                value={tusdTarifaRkwh ?? ''}
                onChange={(event) => {
                  const { value } = event.target
                  if (value === '') {
                    setTusdTarifaRkwh(null)
                    applyVendaUpdates({ tusd_tarifa_r_kwh: undefined })
                  } else {
                    const parsed = Number(value)
                    const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
                    setTusdTarifaRkwh(normalized)
                    applyVendaUpdates({ tusd_tarifa_r_kwh: normalized })
                  }
                  resetRetorno()
                }}
                onFocus={selectNumberInputOnFocus}
              />
            </Field>
            <Field
              label={labelWithTooltip(
                'Ano de referência TUSD',
                'Define o ano-base para aplicar o fator de escalonamento da TUSD conforme a Lei 14.300.',
              )}
            >
              <input
                type="number"
                min={2000}
                step="1"
                value={tusdAnoReferencia}
                onChange={(event) => {
                  const parsed = Number(event.target.value)
                  const normalized = Number.isFinite(parsed)
                    ? Math.max(1, Math.trunc(parsed))
                    : DEFAULT_TUSD_ANO_REFERENCIA
                  setTusdAnoReferencia(normalized)
                  applyVendaUpdates({ tusd_ano_referencia: normalized })
                  resetRetorno()
                }}
                onFocus={selectNumberInputOnFocus}
              />
            </Field>
          </div>
        ) : null}
      </section>
    )
  }

  const renderParametrosPrincipaisSection = () => {
    const rateioPercentualDiff = Math.abs(multiUcRateioPercentualTotal - 100)
    const rateioPercentualValido =
      !multiUcAtivo || multiUcRateioModo !== 'percentual' || multiUcEnergiaGeradaKWh <= 0
        ? true
        : rateioPercentualDiff <= 0.001
    const rateioManualDiff = Math.abs(multiUcRateioManualTotal - multiUcEnergiaGeradaKWh)
    const rateioManualValido =
      !multiUcAtivo || multiUcRateioModo !== 'manual' || multiUcEnergiaGeradaKWh <= 0
        ? true
        : rateioManualDiff <= 0.001
    const escalonamentoAplicadoTexto = formatPercentBRWithDigits(
      multiUcResultado?.escalonamentoPercentual ?? multiUcEscalonamentoPercentual,
      0,
    )
    const rateioHeader = multiUcRateioModo === 'percentual' ? 'Rateio (%)' : 'Rateio (kWh)'
    const rateioPercentualResumoTexto =
      multiUcRateioModo === 'percentual'
        ? formatPercentBRWithDigits(multiUcRateioPercentualTotal / 100, 2)
        : null
    const rateioManualResumoTexto =
      multiUcRateioModo === 'manual' ? formatKwhWithUnit(multiUcRateioManualTotal) : null
    const energiaGeradaTexto = formatKwhWithUnit(multiUcEnergiaGeradaKWh)
    const energiaCompensadaTexto = formatKwhWithUnit(
      multiUcResultado?.energiaGeradaUtilizadaKWh ?? null,
    )
    const sobraCreditosTexto = formatKwhWithUnit(multiUcResultado?.sobraCreditosKWh ?? null)
    const totalTusdTexto =
      multiUcResultado && Number.isFinite(multiUcResultado.totalTusd)
        ? currency(multiUcResultado.totalTusd)
        : null
    const totalTeTexto =
      multiUcResultado && Number.isFinite(multiUcResultado.totalTe)
        ? currency(multiUcResultado.totalTe)
        : null
    const totalContratoTexto =
      multiUcResultado && Number.isFinite(multiUcResultado.totalContrato)
        ? currency(multiUcResultado.totalContrato)
        : null

    return (
      <section className="card">
        <h2>Parâmetros principais</h2>
        <div className="grid g3">
          <Field
            label={labelWithTooltip(
              'Consumo (kWh/mês)',
              'Consumo médio mensal histórico da UC principal; serve como base para dimensionar geração e economia.',
            )}
          >
            <input
              type="number"
              value={kcKwhMes}
              onChange={(e) => setKcKwhMes(Number(e.target.value) || 0, 'user')}
              onFocus={selectNumberInputOnFocus}
            />
          </Field>
          <Field
            label={labelWithTooltip(
              'Tarifa cheia (R$/kWh)',
              'Valor cobrado por kWh sem descontos; multiplicado pelo consumo projetado para estimar a conta cheia.',
            )}
          >
            <input
              type="number"
              step="0.001"
              value={tarifaCheia}
              onChange={(e) => setTarifaCheia(Number(e.target.value) || 0)}
              onFocus={selectNumberInputOnFocus}
            />
          </Field>
          <Field
            label={labelWithTooltip(
              'Custos Fixos da Conta de Energia (R$/MÊS)',
              'Total de custos fixos cobrados pela distribuidora independentemente da compensação de créditos.',
            )}
          >
            <input
              type="number"
              min={0}
              value={taxaMinimaInputEmpty ? '' : taxaMinima}
              onChange={(event) => {
                normalizeTaxaMinimaInputValue(event.target.value)
              }}
              onFocus={selectNumberInputOnFocus}
            />
          </Field>
          <Field
            label={labelWithTooltip(
              'Encargos adicionais (R$/mês)',
              'Outras cobranças fixas recorrentes (CIP, iluminação, taxas municipais) adicionadas à conta mensal.',
            )}
          >
            <input
              type="number"
              value={encargosFixosExtras}
              onChange={(e) => setEncargosFixosExtras(Number(e.target.value) || 0)}
              onFocus={selectNumberInputOnFocus}
            />
          </Field>
          <Field
            label={labelWithTooltip(
              'UF (ANEEL)',
              'Estado utilizado para buscar tarifas homologadas pela ANEEL e sugerir parâmetros regionais.',
            )}
          >
            <select
              value={ufTarifa}
              onChange={(e) => setUfTarifa(e.target.value)}
            >
              <option value="">Selecione a UF</option>
              {ufsDisponiveis.map((uf) => (
                <option key={uf} value={uf}>
                  {uf} — {UF_LABELS[uf] ?? uf}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={labelWithTooltip(
              'Distribuidora (ANEEL)',
              'Concessionária selecionada para carregar automaticamente tarifas de TE e TUSD.',
            )}
          >
            <select
              value={distribuidoraTarifa}
              onChange={(e) => setDistribuidoraTarifa(e.target.value)}
              disabled={!ufTarifa || distribuidorasDisponiveis.length === 0}
            >
              <option value="">
                {ufTarifa ? 'Selecione a distribuidora' : 'Selecione a UF'}
              </option>
              {distribuidorasDisponiveis.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={
              <>
                Irradiação média (kWh/m²/dia)
                <InfoTooltip text="Irradiação média é preenchida automaticamente a partir da UF/distribuidora ou do valor configurado manualmente." />
              </>
            }
            hint="Atualizado automaticamente conforme a UF ou distribuidora selecionada."
          >
            <input
              readOnly
              value={
                baseIrradiacao > 0
                  ? formatNumberBRWithOptions(baseIrradiacao, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : ''
              }
            />
          </Field>
        </div>
        {renderTusdParametersSection()}
        <div className="multi-uc-section" id="multi-uc">
          <div className="multi-uc-header">
            <div className="multi-uc-title-row">
              <h3>Cenário de múltiplas unidades consumidoras (Multi-UC)</h3>
              <label className="multi-uc-toggle">
                <input
                  type="checkbox"
                  checked={multiUcAtivo}
                  onChange={(event) => handleMultiUcToggle(event.target.checked)}
                />
                <span className="multi-uc-toggle-indicator" aria-hidden="true" />
                <span className="multi-uc-toggle-text">Ativar modo multi-UC</span>
              </label>
            </div>
            <p>
              Cadastre várias UCs de classes distintas, defina o rateio dos créditos de energia e acompanhe a TUSD não
              compensável escalonada pela Lei 14.300.
            </p>
          </div>
          {multiUcAtivo ? (
            <div className="multi-uc-body">
              <div className="grid g3">
                <Field
                  label={labelWithTooltip(
                    'Número de UCs',
                    'Quantidade de unidades consumidoras consideradas no rateio de créditos deste cenário.',
                  )}
                >
                  <input
                    type="number"
                    min={1}
                    value={multiUcRows.length}
                    onChange={(event) => handleMultiUcQuantidadeChange(Number(event.target.value))}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field
                  label={
                    <>
                      Energia gerada total (kWh/mês)
                      <InfoTooltip text="Valor utilizado para distribuir os créditos entre as UCs." />
                    </>
                  }
                  hint={
                    multiUcEnergiaGeradaTouched
                      ? undefined
                      : 'Sugestão automática com base na geração estimada.'
                  }
                >
                  <input
                    type="number"
                    min={0}
                    value={multiUcEnergiaGeradaKWh}
                    onChange={(event) =>
                      setMultiUcEnergiaGeradaKWh(Number(event.target.value) || 0, 'user')
                    }
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field
                  label={
                    <>
                      Modo de rateio dos créditos
                      <InfoTooltip text="Escolha entre ratear por percentuais ou informar valores manuais em kWh por unidade consumidora." />
                    </>
                  }
                  hint={
                    multiUcRateioModo === 'percentual'
                      ? 'Percentuais devem totalizar 100%.'
                      : 'O somatório em kWh deve ser igual à geração disponível.'
                  }
                >
                  <div className="toggle-group multi-uc-rateio-toggle">
                    <button
                      type="button"
                      className={`toggle-option${multiUcRateioModo === 'percentual' ? ' active' : ''}`}
                      onClick={() => handleMultiUcRateioModoChange('percentual')}
                    >
                      Percentual (%)
                    </button>
                    <button
                      type="button"
                      className={`toggle-option${multiUcRateioModo === 'manual' ? ' active' : ''}`}
                      onClick={() => handleMultiUcRateioModoChange('manual')}
                    >
                      Manual (kWh)
                    </button>
                  </div>
                </Field>
              </div>
              <div className="grid g3">
                <Field
                  label={labelWithTooltip(
                    'Ano de vigência',
                    'Ano-base do contrato utilizado para determinar o percentual de TUSD Fio B escalonado.',
                  )}
                >
                  <input
                    type="number"
                    min={2023}
                    value={multiUcAnoVigencia}
                    onChange={(event) => {
                      const { value } = event.target
                      if (value === '') {
                        setMultiUcAnoVigencia(INITIAL_VALUES.multiUcAnoVigencia)
                        return
                      }
                      const parsed = Number(value)
                      setMultiUcAnoVigencia(
                        Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : INITIAL_VALUES.multiUcAnoVigencia,
                      )
                    }}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field
                  label={
                    <>
                      Escalonamento aplicado
                      <InfoTooltip text="Percentual do Fio B aplicado sobre a energia compensada, conforme Lei 14.300." />
                    </>
                  }
                >
                  <input readOnly value={escalonamentoAplicadoTexto} />
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Personalizar escalonamento',
                    'Habilite para informar manualmente o percentual de TUSD Fio B aplicado no ano selecionado.',
                  )}
                >
                  <div className="multi-uc-override-control">
                    <label className="multi-uc-checkbox">
                      <input
                        type="checkbox"
                        checked={multiUcOverrideEscalonamento}
                        onChange={(event) => setMultiUcOverrideEscalonamento(event.target.checked)}
                      />
                      <span>Habilitar edição manual</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder={`${multiUcEscalonamentoPadrao[multiUcAnoVigencia] ?? 0}`}
                      value={multiUcEscalonamentoCustomPercent ?? ''}
                      onChange={(event) => {
                        const next = event.target.value === '' ? null : Number(event.target.value)
                        if (next === null) {
                          setMultiUcEscalonamentoCustomPercent(null)
                          return
                        }
                        if (Number.isFinite(next)) {
                          setMultiUcEscalonamentoCustomPercent(Math.max(0, next))
                          return
                        }
                        setMultiUcEscalonamentoCustomPercent(null)
                      }}
                      onFocus={selectNumberInputOnFocus}
                      disabled={!multiUcOverrideEscalonamento}
                    />
                  </div>
                </Field>
              </div>
              <div className="multi-uc-summary-grid">
                {rateioPercentualResumoTexto ? (
                  <div
                    className={`multi-uc-summary-item${multiUcRateioModo === 'percentual' && !rateioPercentualValido ? ' multi-uc-summary-item--error' : ''}`}
                  >
                    <span>Soma do rateio (%)</span>
                    <strong>{rateioPercentualResumoTexto}</strong>
                  </div>
                ) : null}
                {rateioManualResumoTexto ? (
                  <div
                    className={`multi-uc-summary-item${multiUcRateioModo === 'manual' && !rateioManualValido ? ' multi-uc-summary-item--error' : ''}`}
                  >
                    <span>Rateio manual (kWh)</span>
                    <strong>{rateioManualResumoTexto}</strong>
                  </div>
                ) : null}
                {energiaGeradaTexto ? (
                  <div className="multi-uc-summary-item">
                    <span>Energia gerada</span>
                    <strong>{energiaGeradaTexto}</strong>
                  </div>
                ) : null}
                {energiaCompensadaTexto ? (
                  <div className="multi-uc-summary-item">
                    <span>Energia compensada</span>
                    <strong>{energiaCompensadaTexto}</strong>
                  </div>
                ) : null}
                {sobraCreditosTexto ? (
                  <div className="multi-uc-summary-item">
                    <span>Sobra de créditos</span>
                    <strong>{sobraCreditosTexto}</strong>
                  </div>
                ) : null}
                {totalTusdTexto ? (
                  <div className="multi-uc-summary-item">
                    <span>TUSD mensal total</span>
                    <strong>{totalTusdTexto}</strong>
                  </div>
                ) : null}
                {totalTeTexto ? (
                  <div className="multi-uc-summary-item">
                    <span>TE mensal total</span>
                    <strong>{totalTeTexto}</strong>
                  </div>
                ) : null}
                {totalContratoTexto ? (
                  <div className="multi-uc-summary-item">
                    <span>Total contrato</span>
                    <strong>{totalContratoTexto}</strong>
                  </div>
                ) : null}
              </div>
              <div className="multi-uc-escalonamento">
                <h4>Tabela de escalonamento Fio B (padrão)</h4>
                <ul className="multi-uc-escalonamento-list">
                  {multiUcEscalonamentoTabela.map((item) => (
                    <li key={item.ano}>
                      <span>{item.ano}</span>
                      <span>{formatPercentBRWithDigits((item.valor ?? 0) / 100, 0)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {multiUcErrors.length > 0 || multiUcWarnings.length > 0 ? (
                <div className="multi-uc-alerts">
                  {multiUcErrors.map((mensagem, index) => (
                    <div key={`multi-uc-error-${index}`} className="multi-uc-alert error" role="alert">
                      <strong>Erro</strong>
                      <span>{mensagem}</span>
                    </div>
                  ))}
                  {multiUcWarnings.map((mensagem, index) => (
                    <div key={`multi-uc-warning-${index}`} className="multi-uc-alert warning">
                      <strong>Aviso</strong>
                      <span>{mensagem}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="multi-uc-table-actions">
                <div className="action-group">
                  <button type="button" className="ghost with-icon" onClick={handleMultiUcAdicionar}>
                    <span aria-hidden="true">＋</span>
                    Adicionar UC
                  </button>
                  <button type="button" className="ghost with-icon" onClick={handleMultiUcRecarregarTarifas}>
                    <span aria-hidden="true">↻</span>
                    Reaplicar tarifas automáticas
                  </button>
                </div>
                <span className="muted">
                  Distribuidora de referência: {distribuidoraTarifa ?? ''}
                </span>
              </div>
              <div className="table-wrapper multi-uc-table">
                <table>
                  <thead>
                    <tr>
                      <th>UC</th>
                      <th>Classe tarifária</th>
                      <th>Consumo (kWh/mês)</th>
                      <th>{rateioHeader}</th>
                      <th>Créditos (kWh)</th>
                      <th>kWh faturados</th>
                      <th>kWh compensados</th>
                      <th>TE (R$/kWh)</th>
                      <th>TUSD total (R$/kWh)</th>
                      <th>TUSD Fio B (R$/kWh)</th>
                      <th>TUSD outros (R$/kWh)</th>
                      <th>TUSD mensal (R$)</th>
                      <th>TE mensal (R$)</th>
                      <th>Total mensal (R$)</th>
                      <th>Observações</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiUcRows.map((row, index) => {
                      const calculado = multiUcResultadoPorId.get(row.id)
                      const rateioManualKWh = row.manualRateioKWh ?? 0
                      const creditosDistribuidos = calculado?.creditosKWh ??
                        (multiUcRateioModo === 'percentual'
                          ? multiUcEnergiaGeradaKWh * (Math.max(0, row.rateioPercentual) / 100)
                          : Math.max(0, rateioManualKWh))
                      const consumoNormalizado = Math.max(0, row.consumoKWh)
                      const kWhCompensados = calculado?.kWhCompensados ?? Math.min(consumoNormalizado, creditosDistribuidos)
                      const kWhFaturados = calculado?.kWhFaturados ?? Math.max(consumoNormalizado - creditosDistribuidos, 0)
                      const tusdOutros = calculado?.tusdOutros ?? Math.max(0, row.tusdTotal - row.tusdFioB)
                      const escalonamentoBase = multiUcResultado?.escalonamentoPercentual ?? multiUcEscalonamentoPercentual
                      const tusdNaoCompensavel = calculado?.tusdNaoCompensavel ??
                        kWhCompensados * row.tusdFioB * escalonamentoBase
                      const tusdNaoCompensada = calculado?.tusdNaoCompensada ?? kWhFaturados * row.tusdTotal
                      const tusdMensal = calculado?.tusdMensal ?? tusdNaoCompensavel + tusdNaoCompensada
                      const teMensal = calculado?.teMensal ?? kWhFaturados * row.te
                      const totalMensal = calculado?.totalMensal ?? tusdMensal + teMensal
                      const creditosDistribuidosTexto = formatKwhWithUnit(creditosDistribuidos)
                      const kWhFaturadosTexto = formatKwhWithUnit(kWhFaturados)
                      const kWhCompensadosTexto = formatKwhWithUnit(kWhCompensados)

                      return (
                        <tr key={row.id}>
                          <td>
                            <div className="multi-uc-id">
                              <strong>{row.id}</strong>
                              <span className="muted">UC {index + 1}</span>
                            </div>
                          </td>
                          <td>
                            <select
                              value={row.classe}
                              onChange={(event) =>
                                handleMultiUcClasseChange(row.id, event.target.value as MultiUcClasse)
                              }
                            >
                              {MULTI_UC_CLASSES.map((classe) => (
                                <option key={classe} value={classe}>
                                  {MULTI_UC_CLASS_LABELS[classe]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              value={row.consumoKWh}
                              onChange={(event) =>
                                handleMultiUcConsumoChange(row.id, Number(event.target.value) || 0)
                              }
                              onFocus={selectNumberInputOnFocus}
                            />
                          </td>
                          <td>
                            {multiUcRateioModo === 'percentual' ? (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={row.rateioPercentual}
                                onChange={(event) =>
                                  handleMultiUcRateioPercentualChange(row.id, Number(event.target.value) || 0)
                                }
                                onFocus={selectNumberInputOnFocus}
                              />
                            ) : (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={row.manualRateioKWh ?? 0}
                                onChange={(event) =>
                                  handleMultiUcManualRateioChange(row.id, Number(event.target.value) || 0)
                                }
                                onFocus={selectNumberInputOnFocus}
                              />
                            )}
                          </td>
                          <td>{creditosDistribuidosTexto}</td>
                          <td>{kWhFaturadosTexto}</td>
                          <td>{kWhCompensadosTexto}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step="0.001"
                              value={row.te}
                              onChange={(event) => handleMultiUcTeChange(row.id, Number(event.target.value) || 0)}
                              onFocus={selectNumberInputOnFocus}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step="0.001"
                              value={row.tusdTotal}
                              onChange={(event) => handleMultiUcTusdTotalChange(row.id, Number(event.target.value) || 0)}
                              onFocus={selectNumberInputOnFocus}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step="0.001"
                              value={row.tusdFioB}
                              onChange={(event) => handleMultiUcTusdFioBChange(row.id, Number(event.target.value) || 0)}
                              onFocus={selectNumberInputOnFocus}
                            />
                          </td>
                          <td>{tarifaCurrency(tusdOutros)}</td>
                          <td>{currency(tusdMensal)}</td>
                          <td>{currency(teMensal)}</td>
                          <td>{currency(totalMensal)}</td>
                          <td>
                            <input
                              type="text"
                              value={row.observacoes}
                              onChange={(event) => handleMultiUcObservacoesChange(row.id, event.target.value)}
                              placeholder="Anotações"
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="multi-uc-remove"
                              onClick={() => handleMultiUcRemover(row.id)}
                              disabled={multiUcRows.length <= 1}
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="multi-uc-disabled-hint">
              Ative o modo multi-UC para cadastrar unidades consumidoras adicionais, tarifários por classe e aplicar
              o escalonamento da TUSD não compensável.
            </p>
          )}
        </div>
      </section>
    )
  }

  const handleTipoInstalacaoChange = (value: TipoInstalacao) => {
    setTipoInstalacaoDirty(true)
    setTipoInstalacao(value)
  }

  const renderConfiguracaoUsinaSection = () => (
    <section className="card">
      <h2>Configuração da Usina Fotovoltaica</h2>
      <div className="grid g4">
        <Field
          label={labelWithTooltip(
            'Potência do módulo (Wp)',
            'Potência nominal de cada módulo fotovoltaico; usada na conversão kWp = (módulos × Wp) ÷ 1000.',
          )}
        >
          <select
            value={potenciaModulo}
            onChange={(event) => {
              setPotenciaModuloDirty(true)
              const parsed = Number(event.target.value)
              const potenciaSelecionada = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              setPotenciaModulo(potenciaSelecionada)
            }}
          >
            {PAINEL_OPCOES.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Nº de módulos (estimado)',
            'Quantidade de módulos utilizada no dimensionamento. Estimativa = ceil(Consumo alvo ÷ (Irradiação × Eficiência × dias) × 1000 ÷ Potência do módulo).',
          )}
        >
          <input
            type="number"
            min={0}
            step={1}
            ref={moduleQuantityInputRef}
            value={
              numeroModulosManual === ''
                ? numeroModulosEstimado > 0
                  ? numeroModulosEstimado
                  : 0
                : numeroModulosManual
            }
            onChange={(event) => {
              const { value } = event.target
              if (value === '') {
                setNumeroModulosManual('')
                return
              }
              const parsed = Number(value)
              if (!Number.isFinite(parsed) || parsed <= 0) {
                setNumeroModulosManual('')
                return
              }
              const inteiro = Math.max(1, Math.round(parsed))
              setNumeroModulosManual(inteiro)
            }}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Segmento',
            'Classificação do cliente (residencial ou comercial), utilizada para relatórios e cálculos de tarifas.',
          )}
        >
          <select
            value={segmentoCliente}
            onChange={(event) =>
              handleSegmentoClienteChange(event.target.value as SegmentoCliente)
            }
          >
            <option value="RESIDENCIAL">Residencial</option>
            <option value="COMERCIAL">Comercial</option>
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Tipo de instalação',
            'Define se o sistema será instalado em telhado ou solo; altera a área estimada e custos de estrutura.',
          )}
        >
          <select
            value={tipoInstalacao}
            onChange={(event) =>
              handleTipoInstalacaoChange(event.target.value as TipoInstalacao)
            }
          >
            <option value="TELHADO">Telhado</option>
            <option value="SOLO">Solo</option>
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Tipo de sistema',
            'Escolha entre on-grid, híbrido ou off-grid para registrar a topologia elétrica da proposta.',
          )}
        >
          <select
            value={tipoSistema}
            onChange={(event) => handleTipoSistemaChange(event.target.value as TipoSistema)}
          >
            <option value="ON_GRID">On-grid</option>
            <option value="HIBRIDO">Híbrido</option>
            <option value="OFF_GRID">Off-grid</option>
          </select>
        </Field>
        <Field
          label={
            <>
              Potência do sistema (kWp)
              <InfoTooltip text="Potência do sistema = (Nº de módulos × Potência do módulo) ÷ 1000. Sem entrada manual de módulos, estimamos por Consumo ÷ (Irradiação × Eficiência × 30 dias)." />
            </>
          }
        >
          <input
            readOnly
            value={formatNumberBRWithOptions(potenciaInstaladaKwp, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          />
        </Field>
        <Field
          label={
            <>
              Geração estimada (kWh/mês)
              <InfoTooltip text="Geração estimada = Potência do sistema × Irradiação média × Eficiência × 30 dias." />
            </>
          }
        >
          <input
            readOnly
            value={formatNumberBRWithOptions(geracaoMensalKwh, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Área utilizada (m²)',
            'Estimativa de área ocupada: Nº de módulos × fator (3,3 m² para telhado ou 7 m² para solo).',
          )}
        >
          <input
            readOnly
            value={
              areaInstalacao > 0
                ? formatNumberBRWithOptions(areaInstalacao, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })
                : ''
            }
          />
        </Field>
      </div>
      {estruturaTipoWarning ? (
        <div className="estrutura-warning-alert" role="alert">
          <div>
            <h3>Estrutura utilizada não identificada</h3>
            <p>
              Não foi possível extrair o campo <strong>Tipo</strong> da tabela{' '}
              <strong>Estrutura utilizada</strong> no documento enviado. Tente enviar um arquivo em outro formato.
            </p>
          </div>
          <div className="estrutura-warning-alert-actions">
            <button type="button" className="ghost" onClick={handleMissingInfoUploadClick}>
              Enviar outro arquivo
            </button>
          </div>
        </div>
      ) : null}
      <div className="grid g3">
        <Field
          label={labelWithTooltip(
            'Modelo do módulo',
            'Descrição comercial do módulo fotovoltaico utilizado na proposta.',
          )}
        >
          <input
            type="text"
            value={vendaForm.modelo_modulo ?? ''}
            onChange={(event) => applyVendaUpdates({ modelo_modulo: event.target.value || undefined })}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Modelo do inversor',
            'Modelo comercial do inversor responsável pela conversão CC/CA.',
          )}
        >
          <input
            type="text"
            ref={inverterModelInputRef}
            value={vendaForm.modelo_inversor ?? ''}
            onChange={(event) => applyVendaUpdates({ modelo_inversor: event.target.value || undefined })}
          />
        </Field>
      </div>
      <div className="info-inline">
        <span className="pill">
          <InfoTooltip text="Consumo diário estimado = Geração mensal ÷ 30 dias." />
          Consumo diário
          <strong>
            {`${formatNumberBRWithOptions(geracaoDiariaKwh, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} kWh`}
          </strong>
        </span>
      </div>
    </section>
  )

  const renderVendaParametrosSection = () => (
    <section className="card">
      <h2>Parâmetros principais</h2>
      <div className="grid g3">
        <Field
          label={
            <>
              Consumo (kWh/mês)
              <InfoTooltip text="Consumo médio mensal utilizado para projetar a geração e a economia." />
            </>
          }
        >
          <input
            type="number"
            min={0}
            value={
              Number.isFinite(vendaForm.consumo_kwh_mes) ? vendaForm.consumo_kwh_mes : ''
            }
            onChange={(event) => {
              const { value } = event.target
              if (value === '') {
                setNumeroModulosManual('')
                setKcKwhMes(0, 'auto')
                applyVendaUpdates({
                  consumo_kwh_mes: undefined,
                  geracao_estimada_kwh_mes: undefined,
                  potencia_instalada_kwp: undefined,
                  quantidade_modulos: undefined,
                })
                return
              }

              const parsed = Number(value)
              const consumoDesejado = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              const modulosCalculados = calcularModulosPorGeracao(consumoDesejado)

              let potenciaCalculada = 0
              let geracaoCalculada = consumoDesejado

              if (modulosCalculados != null) {
                potenciaCalculada = calcularPotenciaSistemaKwp(modulosCalculados)
                if (potenciaCalculada > 0) {
                  const estimada = estimarGeracaoPorPotencia(potenciaCalculada)
                  if (estimada > 0) {
                    geracaoCalculada = normalizarGeracaoMensal(estimada)
                  }
                }
              }

              if (geracaoCalculada <= 0 && consumoDesejado > 0) {
                geracaoCalculada = consumoDesejado
              }

              const consumoFinal = consumoDesejado
              setKcKwhMes(consumoFinal, 'user')

              applyVendaUpdates({
                consumo_kwh_mes: consumoFinal,
                geracao_estimada_kwh_mes:
                  geracaoCalculada > 0
                    ? geracaoCalculada
                    : consumoFinal === 0
                    ? 0
                    : undefined,
                potencia_instalada_kwp:
                  potenciaCalculada > 0
                    ? normalizarPotenciaKwp(potenciaCalculada)
                    : consumoFinal === 0
                    ? 0
                    : undefined,
                quantidade_modulos: modulosCalculados ?? undefined,
              })

              if (modulosCalculados != null) {
                setNumeroModulosManual('')
              }
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.consumo_kwh_mes} />
        </Field>
        <Field
          label={labelWithTooltip(
            'Tarifa cheia (R$/kWh)',
            'Valor cobrado por kWh sem descontos contratuais; base para calcular a conta de energia projetada.',
          )}
        >
          <input
            type="number"
            step="0.001"
            min={0}
            value={
              Number.isFinite(vendaForm.tarifa_cheia_r_kwh)
                ? vendaForm.tarifa_cheia_r_kwh
                : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              setTarifaCheia(normalized)
              applyVendaUpdates({ tarifa_cheia_r_kwh: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.tarifa_cheia_r_kwh} />
        </Field>
        <Field
          label={labelWithTooltip(
            'Custos Fixos da Conta de Energia (R$/MÊS)',
            'Total de custos fixos mensais cobrados pela distribuidora, mesmo com créditos suficientes para zerar o consumo.',
          )}
        >
          <input
            type="number"
            min={0}
            value={
              taxaMinimaInputEmpty
                ? ''
                : Number.isFinite(vendaForm.taxa_minima_mensal)
                ? vendaForm.taxa_minima_mensal
                : taxaMinima
            }
            onChange={(event) => {
              const normalized = normalizeTaxaMinimaInputValue(event.target.value)
              applyVendaUpdates({ taxa_minima_mensal: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.taxa_minima_mensal} />
        </Field>
      </div>
      {renderTusdParametersSection()}
      <div className="grid g3">
        <Field
          label={
            <>
              Inflação de energia (% a.a.)
              <InfoTooltip text="Reajuste anual estimado para a tarifa de energia." />
            </>
          }
        >
          <input
            type="number"
            step="0.1"
            value={
              Number.isFinite(vendaForm.inflacao_energia_aa_pct)
                ? vendaForm.inflacao_energia_aa_pct
                : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              setInflacaoAa(normalized)
              applyVendaUpdates({ inflacao_energia_aa_pct: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Horizonte de análise (meses)',
            'Quantidade de meses simulados para payback, ROI e fluxo de caixa projetado.',
          )}
        >
          <input
            type="number"
            min={1}
            step={1}
            value={
              Number.isFinite(vendaForm.horizonte_meses) ? vendaForm.horizonte_meses : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              const normalized = Number.isFinite(parsed)
                ? Math.max(1, Math.round(parsed))
                : 1
              applyVendaUpdates({ horizonte_meses: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.horizonte_meses} />
        </Field>
        <Field
          label={
            <>
              Taxa de desconto (% a.a.)
              <InfoTooltip text="Opcional: utilizada para calcular o Valor Presente Líquido (VPL)." />
            </>
          }
        >
          <input
            type="number"
            step="0.1"
            min={0}
            value={
              Number.isFinite(vendaForm.taxa_desconto_aa_pct)
                ? vendaForm.taxa_desconto_aa_pct
                : ''
            }
            onChange={(event) => {
              const parsed = Number(event.target.value)
              if (event.target.value === '') {
                applyVendaUpdates({ taxa_desconto_aa_pct: undefined })
                return
              }
              const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              applyVendaUpdates({ taxa_desconto_aa_pct: normalized })
            }}
            onFocus={selectNumberInputOnFocus}
          />
          <FieldError message={vendaFormErrors.taxa_desconto_aa_pct} />
        </Field>
      </div>
      <div className="grid g3">
        <Field
          label={labelWithTooltip(
            'UF (ANEEL)',
            'Estado utilizado para consultar automaticamente tarifas homologadas e irradiação base.',
          )}
        >
          <select value={ufTarifa} onChange={(event) => setUfTarifa(event.target.value)}>
            <option value="">Selecione a UF</option>
            {ufsDisponiveis.map((uf) => (
              <option key={uf} value={uf}>
                {uf} — {UF_LABELS[uf] ?? uf}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Distribuidora (ANEEL)',
            'Concessionária da UC; determina TE, TUSD e reajustes aplicados nas simulações.',
          )}
        >
          <select
            value={distribuidoraTarifa}
            onChange={(event) => setDistribuidoraTarifa(event.target.value)}
            disabled={!ufTarifa || distribuidorasDisponiveis.length === 0}
          >
            <option value="">
              {ufTarifa ? 'Selecione a distribuidora' : 'Selecione a UF'}
            </option>
            {distribuidorasDisponiveis.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={
            <>
              Irradiação média (kWh/m²/dia)
              <InfoTooltip text="Valor sugerido automaticamente conforme a UF ou distribuidora." />
            </>
          }
          hint="Atualizado automaticamente conforme a região selecionada."
        >
          <input
            readOnly
            value={
              baseIrradiacao > 0
                ? formatNumberBRWithOptions(baseIrradiacao, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : ''
            }
          />
        </Field>
      </div>
    </section>
  )

  const renderVendaConfiguracaoSection = () => (
    <section className="card">
      <h2>Configuração da Usina Fotovoltaica</h2>
      <div className="grid g4">
        <Field
          label={labelWithTooltip(
            'Potência do módulo (Wp)',
            'Potência nominal de cada módulo fotovoltaico; usada na conversão kWp = (módulos × Wp) ÷ 1000.',
          )}
        >
          <select
            value={potenciaModulo}
            onChange={(event) => {
              setPotenciaModuloDirty(true)
              const parsed = Number(event.target.value)
              const potenciaSelecionada = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
              setPotenciaModulo(potenciaSelecionada)
            }}
          >
            {PAINEL_OPCOES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Nº de módulos (estimado)',
            'Quantidade de módulos utilizada no dimensionamento. Estimativa = ceil(Consumo alvo ÷ (Irradiação × Eficiência × dias) × 1000 ÷ Potência do módulo).',
          )}
        >
          <input
            type="number"
            min={0}
            step={1}
            ref={moduleQuantityInputRef}
            value={
              numeroModulosManual === ''
                ? numeroModulosEstimado > 0
                  ? numeroModulosEstimado
                  : 0
                : numeroModulosManual
            }
            onChange={(event) => {
              const { value } = event.target
              if (value === '') {
                setNumeroModulosManual('')
                applyVendaUpdates({ quantidade_modulos: undefined })
                return
              }
              const parsed = Number(value)
              if (!Number.isFinite(parsed) || parsed <= 0) {
                setNumeroModulosManual('')
                applyVendaUpdates({ quantidade_modulos: undefined })
                return
              }
              const inteiro = Math.max(1, Math.round(parsed))
              setNumeroModulosManual(inteiro)
              applyVendaUpdates({ quantidade_modulos: inteiro })
            }}
            onFocus={selectNumberInputOnFocus}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Segmento',
            'Classificação do cliente (residencial ou comercial), utilizada para relatórios e cálculos de tarifas.',
          )}
        >
          <select
            value={segmentoCliente}
            onChange={(event) =>
              handleSegmentoClienteChange(event.target.value as SegmentoCliente)
            }
          >
            <option value="RESIDENCIAL">Residencial</option>
            <option value="COMERCIAL">Comercial</option>
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Tipo de instalação',
            'Define se o sistema será instalado em telhado ou solo; altera a área estimada e custos de estrutura.',
          )}
        >
          <select
            value={tipoInstalacao}
            onChange={(event) =>
              handleTipoInstalacaoChange(event.target.value as TipoInstalacao)
            }
          >
            <option value="TELHADO">Telhado</option>
            <option value="SOLO">Solo</option>
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Tipo de sistema',
            'Escolha entre on-grid, híbrido ou off-grid para registrar a topologia elétrica da proposta.',
          )}
        >
          <select
            value={tipoSistema}
            onChange={(event) => handleTipoSistemaChange(event.target.value as TipoSistema)}
          >
            <option value="ON_GRID">On-grid</option>
            <option value="HIBRIDO">Híbrido</option>
            <option value="OFF_GRID">Off-grid</option>
          </select>
        </Field>
        <Field
          label={
            <>
              Potência do sistema (kWp)
              <InfoTooltip text="Potência do sistema = (Nº de módulos × Potência do módulo) ÷ 1000. Sem entrada manual de módulos, estimamos por Consumo ÷ (Irradiação × Eficiência × 30 dias)." />
            </>
          }
        >
          <input
            readOnly
            value={formatNumberBRWithOptions(potenciaInstaladaKwp, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          />
        </Field>
        <Field
          label={
            <>
              Geração estimada (kWh/mês)
              <InfoTooltip text="Geração estimada = Potência do sistema × Irradiação média × Eficiência × 30 dias." />
            </>
          }
        >
          <input
            readOnly
            value={formatNumberBRWithOptions(geracaoMensalKwh, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Área utilizada (m²)',
            'Estimativa de área ocupada: Nº de módulos × fator (3,3 m² para telhado ou 7 m² para solo).',
          )}
        >
          <input
            readOnly
            value={
              areaInstalacao > 0
                ? formatNumberBRWithOptions(areaInstalacao, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })
                : ''
            }
          />
        </Field>
      </div>
      {estruturaTipoWarning ? (
        <div className="estrutura-warning-alert" role="alert">
          <div>
            <h3>Estrutura utilizada não identificada</h3>
            <p>
              Não foi possível extrair o campo <strong>Tipo</strong> da tabela{' '}
              <strong>Estrutura utilizada</strong> no documento enviado. Tente enviar um arquivo em outro formato.
            </p>
          </div>
          <div className="estrutura-warning-alert-actions">
            <button type="button" className="ghost" onClick={handleMissingInfoUploadClick}>
              Enviar outro arquivo
            </button>
          </div>
        </div>
      ) : null}
      <div className="grid g3">
        <Field
          label={labelWithTooltip(
            'Modelo do módulo',
            'Descrição comercial do módulo fotovoltaico utilizado na proposta.',
          )}
        >
          <input
            type="text"
            value={vendaForm.modelo_modulo ?? ''}
            onChange={(event) => applyVendaUpdates({ modelo_modulo: event.target.value || undefined })}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Modelo do inversor',
            'Modelo comercial do inversor responsável pela conversão CC/CA.',
          )}
        >
          <input
            type="text"
            ref={inverterModelInputRef}
            value={vendaForm.modelo_inversor ?? ''}
            onChange={(event) => applyVendaUpdates({ modelo_inversor: event.target.value || undefined })}
          />
        </Field>
      </div>
      <div className="info-inline">
        <span className="pill">
          <InfoTooltip text="Consumo diário estimado = Geração mensal ÷ 30 dias." />
          Consumo diário
          <strong>
            {`${formatNumberBRWithOptions(geracaoDiariaKwh, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} kWh`}
          </strong>
        </span>
      </div>
    </section>
  )

  const renderVendaResumoPublicoSection = () => (
    <section className="card">
      <div className="card-header">
        <h2>Resumo de valores (Página pública)</h2>
      </div>
      <div className="kpi-grid">
        <div className="kpi kpi-highlight">
          <span>Valor total da proposta</span>
          <strong>{currency(valorTotalPropostaNormalizado)}</strong>
        </div>
        {economiaEstimativaValorCalculado != null ? (
          <div className="kpi">
            <span>{`Economia estimada (${ECONOMIA_ESTIMATIVA_PADRAO_ANOS} anos)`}</span>
            <strong>{currency(economiaEstimativaValorCalculado)}</strong>
          </div>
        ) : null}
      </div>
      <p className="muted">
        Preço final para aquisição da usina completa. Valores técnicos internos não são cobrados do cliente.
      </p>
    </section>
  )

  const renderComposicaoUfvSection = () => {
    const abrirParametrosVendas = () => {
      setSettingsTab('vendas')
      setIsSettingsOpen(true)
    }
    return (
      <section className="card">
        <div className="card-header">
          <h2>Composição da UFV</h2>
          <button type="button" className="ghost with-icon" onClick={abrirParametrosVendas}>
            <span aria-hidden="true">⚙︎</span>
            Ajustar parâmetros internos
          </button>
        </div>
        <p className="muted">
          Consulte abaixo os valores consolidados da proposta. Custos e ajustes comerciais podem ser
          atualizados em Configurações → Parâmetros de Vendas.
        </p>
        <div className="composicao-ufv-controls">
          <h3>Ajustes desta proposta</h3>
          <div className="grid g3">
            <Field
              label={labelWithTooltip(
                'Descontos comerciais (R$)',
                'Valor de descontos concedidos ao cliente. Utilizado para calcular a venda líquida.',
              )}
            >
              <input
                ref={descontosMoneyField.ref}
                type="text"
                inputMode="decimal"
                value={descontosMoneyField.text}
                onChange={descontosMoneyField.handleChange}
                onBlur={descontosMoneyField.handleBlur}
                onFocus={selectNumberInputOnFocus}
              />
            </Field>
          </div>
        </div>
        <div className="composicao-ufv-summary">
          <h3>Referências internas</h3>
          <p className="muted">Valores herdados de Configurações → Parâmetros de Vendas.</p>
          <div className="grid g3">
            <Field
              label={labelWithTooltip(
                'CAPEX base (R$)',
                'CAPEX base considerado após os custos internos e impostos configurados.',
              )}
            >
              <input
                ref={capexBaseResumoField.ref}
                type="text"
                inputMode="decimal"
                value={capexBaseResumoField.text}
                onChange={capexBaseResumoField.handleChange}
                onBlur={() => {
                  capexBaseResumoField.handleBlur()
                  capexBaseResumoField.setText(formatMoneyBR(capexBaseResumoValor))
                }}
                onFocus={selectNumberInputOnFocus}
                placeholder={
                  typeof capexBaseManualValor === 'number' ? undefined : 'Automático (calculado)'
                }
              />
            </Field>
            <Field
              label={labelWithTooltip(
                'Margem operacional (R$)',
                'Margem operacional calculada a partir do CAPEX base e dos ajustes comerciais desta proposta.',
              )}
            >
              <input
                ref={margemOperacionalResumoField.ref}
                type="text"
                inputMode="decimal"
                value={margemOperacionalResumoField.text}
                onChange={margemOperacionalResumoField.handleChange}
                onBlur={() => margemOperacionalResumoField.handleBlur()}
                onFocus={selectNumberInputOnFocus}
                placeholder={margemManualAtiva ? undefined : 'Automático (padrão)'}
              />
            </Field>
          </div>
        </div>
      </section>
    )
  }

  const renderVendasParametrosInternosSettings = () => {
    const comissaoLabel =
      vendasConfig.comissao_default_tipo === 'percentual'
        ? 'Comissão líquida (%)'
        : 'Comissão líquida (R$)'
    const telhadoCampos: { key: keyof UfvComposicaoTelhadoValores; label: string; tooltip: string }[] = [
      { key: 'projeto', label: 'Projeto', tooltip: 'Custos de elaboração do projeto elétrico e estrutural da usina.' },
      { key: 'instalacao', label: 'Instalação', tooltip: 'Mão de obra, deslocamento e insumos da equipe de instalação.' },
      { key: 'materialCa', label: 'Material CA', tooltip: 'Materiais elétricos do lado CA (cabos, disjuntores, quadros).' },
      { key: 'crea', label: 'CREA', tooltip: 'Taxas do conselho de engenharia necessárias para o projeto.' },
      { key: 'art', label: 'ART', tooltip: 'Valor da Anotação de Responsabilidade Técnica do responsável.' },
      { key: 'placa', label: 'Placa', tooltip: 'Investimento nos módulos fotovoltaicos utilizados no sistema.' },
    ]
    const resumoCamposTelhado: { key: keyof UfvComposicaoTelhadoValores; label: string; tooltip: string }[] = [
      {
        key: 'comissaoLiquida',
        label: comissaoLabel,
        tooltip:
          'Comissão líquida destinada ao time comercial. Ajuste o formato (valor ou percentual) nos parâmetros abaixo.',
      },
    ]
    const soloCamposPrincipais: { key: keyof UfvComposicaoSoloValores; label: string; tooltip: string }[] = [
      { key: 'projeto', label: 'Projeto', tooltip: 'Custos de elaboração do projeto elétrico e estrutural da usina.' },
      { key: 'instalacao', label: 'Instalação', tooltip: 'Mão de obra, deslocamento e insumos da equipe de instalação.' },
      { key: 'materialCa', label: 'Material CA', tooltip: 'Materiais elétricos do lado CA (cabos, disjuntores, quadros).' },
      { key: 'crea', label: 'CREA', tooltip: 'Taxas do conselho de engenharia necessárias para o projeto.' },
      { key: 'art', label: 'ART', tooltip: 'Valor da Anotação de Responsabilidade Técnica do responsável.' },
      { key: 'placa', label: 'Placa', tooltip: 'Investimento nos módulos fotovoltaicos utilizados no sistema.' },
      { key: 'estruturaSolo', label: 'Estrutura solo', tooltip: 'Estruturas e fundações específicas para montagem em solo.' },
      { key: 'tela', label: 'Tela', tooltip: 'Material de cercamento (telas de proteção) para o parque solar.' },
      { key: 'portaoTela', label: 'Portão tela', tooltip: 'Portões e acessos associados ao cercamento em tela.' },
      { key: 'maoObraTela', label: 'Mão de obra tela', tooltip: 'Equipe dedicada à instalação da tela e portões.' },
      { key: 'casaInversor', label: 'Casa inversor', tooltip: 'Construção ou abrigo para inversores e painéis elétricos.' },
      { key: 'brita', label: 'Brita', tooltip: 'Lastro de brita utilizado para nivelamento e drenagem do solo.' },
      { key: 'terraplanagem', label: 'Terraplanagem', tooltip: 'Serviços de preparo e nivelamento do terreno.' },
      { key: 'trafo', label: 'Trafo', tooltip: 'Custo de transformadores ou adequações de tensão.' },
      { key: 'rede', label: 'Rede', tooltip: 'Adequações de rede, cabeamento e conexões externas.' },
    ]
    const resumoCamposSolo: { key: keyof UfvComposicaoSoloValores; label: string; tooltip: string }[] = [
      {
        key: 'comissaoLiquida',
        label: comissaoLabel,
        tooltip:
          'Comissão líquida destinada ao time comercial. Ajuste o formato (valor ou percentual) nos parâmetros abaixo.',
      },
    ]

    const isTelhado = tipoInstalacao === 'TELHADO'
    const regimes: RegimeTributario[] = ['simples', 'lucro_presumido', 'lucro_real']
    const comissaoDefaultLabel =
      vendasConfig.comissao_default_tipo === 'percentual'
        ? 'Comissão padrão (%)'
        : 'Comissão padrão (R$)'
    const aprovadoresHint = 'Separe múltiplos e-mails por linha ou vírgula.'
    const calculoAtual = isTelhado ? composicaoTelhadoCalculo : composicaoSoloCalculo
    const regimeBreakdown = calculoAtual?.regime_breakdown ?? []
    const currencyValue = (valor?: number) => (Number.isFinite(valor) ? currency(Number(valor)) : '')
    const percentValue = (valor?: number) =>
      Number.isFinite(valor) ? formatPercentBRWithDigits(Number(valor) / 100, 2) : ''
    const precoMinimoAplicadoLabel = calculoAtual
      ? calculoAtual.preco_minimo_aplicado
        ? 'Sim'
        : 'Não'
      : ''
    const workflowAtivo = Boolean(vendasConfig.workflow_aprovacao_ativo)
    const aprovacaoLabel = (() => {
      if (!workflowAtivo) {
        return 'Workflow desativado'
      }
      if (!calculoAtual) {
        return ''
      }
      if (!calculoAtual.desconto_requer_aprovacao) {
        return 'Não'
      }
      return aprovadoresResumo ? `Sim — ${aprovadoresResumo}` : 'Sim'
    })()
    const workflowStatusLabel = workflowAtivo ? 'Ativo' : 'Desativado'
    const descontoValor = toNumberSafe(descontosValor)

    const sanitizeOverridesDraft = (
      draft: Partial<ImpostosRegimeConfig>,
    ): Partial<ImpostosRegimeConfig> | undefined => {
      const sanitized: Partial<ImpostosRegimeConfig> = {}
      for (const regime of regimes) {
        const lista = draft[regime]
        if (!lista || lista.length === 0) {
          continue
        }
        const cleaned = lista
          .map((item) => ({
            nome: (item.nome ?? '').trim(),
            aliquota_percent: Number.isFinite(item.aliquota_percent)
              ? Number(item.aliquota_percent)
              : 0,
          }))
          .filter((item) => item.nome.length > 0)
        if (cleaned.length > 0) {
          sanitized[regime] = cleaned
        }
      }
      return Object.keys(sanitized).length > 0 ? sanitized : undefined
    }

    const handleCustoImplantacaoReferenciaInput = (value: string) => {
      if (value === '') {
        vendaActions.updateResumoProposta({ custo_implantacao_referencia: null })
        return
      }
      const parsed = parseNumericInput(value)
      const normalizado = Number.isFinite(parsed ?? NaN) ? Math.max(0, Number(parsed)) : 0
      vendaActions.updateResumoProposta({
        custo_implantacao_referencia: normalizado > 0 ? normalizado : null,
      })
    }

    const handleOverrideFieldChange = (
      regime: RegimeTributario,
      index: number,
      field: 'nome' | 'aliquota_percent',
      value: string,
    ) => {
      setImpostosOverridesDraft((prev) => {
        const next = cloneImpostosOverrides(prev)
        const lista = next[regime] ? [...next[regime]!] : []
        const atual = lista[index] ?? { nome: '', aliquota_percent: 0 }
        if (field === 'nome') {
          lista[index] = { ...atual, nome: value }
        } else {
          const parsed = parseNumericInput(value)
          const aliquota = parsed == null ? 0 : Number(parsed)
          lista[index] = {
            ...atual,
            aliquota_percent: Number.isFinite(aliquota) ? aliquota : 0,
          }
        }
        next[regime] = lista
        return next
      })
    }

    const handleOverrideAdd = (regime: RegimeTributario) => {
      setImpostosOverridesDraft((prev) => {
        const next = cloneImpostosOverrides(prev)
        const lista = next[regime] ? [...next[regime]!] : []
        lista.push({ nome: '', aliquota_percent: 0 })
        next[regime] = lista
        return next
      })
    }

    const handleOverrideRemove = (regime: RegimeTributario, index: number) => {
      setImpostosOverridesDraft((prev) => {
        const next = cloneImpostosOverrides(prev)
        const lista = next[regime] ? [...next[regime]!] : []
        lista.splice(index, 1)
        if (lista.length > 0) {
          next[regime] = lista
        } else {
          delete next[regime]
        }
        return next
      })
    }

    const handleApplyOverrides = () => {
      const sanitized = sanitizeOverridesDraft(impostosOverridesDraft)
      updateVendasConfig({ impostosRegime_overrides: sanitized ?? null })
    }

    const handleResetOverrides = (regime: RegimeTributario) => {
      setImpostosOverridesDraft((prev) => {
        const next = cloneImpostosOverrides(prev)
        delete next[regime]
        const sanitized = sanitizeOverridesDraft(next)
        updateVendasConfig({ impostosRegime_overrides: sanitized ?? null })
        return next
      })
    }

    const handleAprovadoresBlur = () => {
      const emails = aprovadoresText
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
      updateVendasConfig({ aprovadores: emails })
    }

    return (
      <div className="settings-vendas-parametros">
        <p className="muted">
          Ajuste os custos internos da usina e os parâmetros comerciais utilizados no cálculo da proposta.
        </p>

        <section className="settings-vendas-card config-card settings-vendas-card--full">
          <div className="settings-vendas-card-header">
            <div>
              <h3>Composição da UFV</h3>
              <p className="settings-vendas-card-description">
                Distribua os custos internos conforme o tipo de implantação padrão ({isTelhado ? 'telhado' : 'solo'}).
              </p>
            </div>
          </div>
          <div className="settings-vendas-card-body">
            <div className="composicao-ufv-groups">
              {isTelhado ? (
                <div className="composicao-ufv-group">
                  <h3>Projeto em Telhado</h3>
                  <div className="grid g3">
                    {telhadoCampos.map(({ key, label, tooltip }) => (
                      <Field key={`settings-telhado-${key}`} label={labelWithTooltip(label, tooltip)}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatCurrencyInputValue(
                            Number.isFinite(composicaoTelhado[key]) ? composicaoTelhado[key] : 0,
                          )}
                          onChange={(event) => handleComposicaoTelhadoChange(key, event.target.value)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                    ))}
                  </div>
                  <div className="grid g3">
                    {resumoCamposTelhado.map(({ key, label, tooltip }) => (
                      <Field key={`settings-telhado-resumo-${key}`} label={labelWithTooltip(label, tooltip)}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatCurrencyInputValue(
                            Number.isFinite(composicaoTelhado[key]) ? composicaoTelhado[key] : 0,
                          )}
                          onChange={(event) => handleComposicaoTelhadoChange(key, event.target.value)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="composicao-ufv-group">
                  <h3>Projeto em Solo</h3>
                  <div className="grid g3">
                    {soloCamposPrincipais.map(({ key, label, tooltip }) => (
                      <Field key={`settings-solo-${key}`} label={labelWithTooltip(label, tooltip)}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatCurrencyInputValue(
                            Number.isFinite(composicaoSolo[key]) ? composicaoSolo[key] : 0,
                          )}
                          onChange={(event) => handleComposicaoSoloChange(key, event.target.value)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                    ))}
                  </div>
                  <div className="grid g3">
                    {resumoCamposSolo.map(({ key, label, tooltip }) => (
                      <Field key={`settings-solo-resumo-${key}`} label={labelWithTooltip(label, tooltip)}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatCurrencyInputValue(
                            Number.isFinite(composicaoSolo[key]) ? composicaoSolo[key] : 0,
                          )}
                          onChange={(event) => handleComposicaoSoloChange(key, event.target.value)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="settings-vendas-columns">
          <section className="settings-vendas-card config-card">
            <div className="settings-vendas-card-header">
              <div>
                <h3>Custos &amp; precificação</h3>
                <p className="settings-vendas-card-description">
                  Configure valores de referência e guardrails automáticos aplicados nas propostas.
                </p>
              </div>
            </div>
            <div className="settings-vendas-card-body">
              <div className="settings-subsection">
                <h4 className="settings-subheading">Custos de referência</h4>
                <div className="grid g3">
                  <Field
                    label={labelWithTooltip(
                      'Custo técnico de implantação (R$)',
                      'Valor interno estimado da implantação da usina (ex-CAPEX). Utilizado apenas para controle de margem.',
                    )}
                  >
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={custoImplantacaoReferencia ?? ''}
                      onChange={(event) => handleCustoImplantacaoReferenciaInput(event.target.value)}
                      onFocus={selectNumberInputOnFocus}
                    />
                  </Field>
                </div>
              </div>

              <div className="settings-subsection">
                <h4 className="settings-subheading">Parâmetros padrão de preço e margem</h4>
                <div className="grid g3">
                  <Field
                    label={labelWithTooltip(
                      'Margem operacional padrão (%)',
                      'Percentual aplicado sobre o CAPEX base somado ao valor do orçamento quando a margem está automática.',
                    )}
                  >
                    <input
                      type="number"
                      min={0}
                      max={80}
                      step="0.1"
                      value={vendasConfig.margem_operacional_padrao_percent}
                      onChange={(event) => {
                        const parsed = parseNumericInput(event.target.value)
                        updateVendasConfig({
                          margem_operacional_padrao_percent: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                        })
                      }}
                      onFocus={selectNumberInputOnFocus}
                    />
                  </Field>
                  <Field
                    label={labelWithTooltip(
                      'Preço mínimo (% sobre CAPEX)',
                      'Percentual mínimo aplicado ao CAPEX base para validar a proposta.',
                    )}
                  >
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={vendasConfig.preco_minimo_percent_sobre_capex}
                      onChange={(event) => {
                        const parsed = parseNumericInput(event.target.value)
                        updateVendasConfig({
                          preco_minimo_percent_sobre_capex: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                        })
                      }}
                      onFocus={selectNumberInputOnFocus}
                    />
                  </Field>
                </div>
                <div className="grid g3">
                  <Field
                    label={labelWithTooltip(
                      'Arredondamento da venda',
                      'Passo utilizado para arredondar o valor final da proposta.',
                    )}
                  >
                    <select
                      value={vendasConfig.arredondar_venda_para}
                      onChange={(event) =>
                        updateVendasConfig({
                          arredondar_venda_para: event.target.value as '1' | '10' | '50' | '100',
                        })
                      }
                    >
                      <option value="1">R$ 1</option>
                      <option value="10">R$ 10</option>
                      <option value="50">R$ 50</option>
                      <option value="100">R$ 100</option>
                    </select>
                  </Field>
                  <Field
                    label={labelWithTooltip(
                      'Incluir impostos no CAPEX',
                      'Quando ativo, soma impostos retidos e do regime ao CAPEX considerado nas análises.',
                    )}
                  >
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={vendasConfig.incluirImpostosNoCAPEX_default}
                        onChange={(event) =>
                          updateVendasConfig({ incluirImpostosNoCAPEX_default: event.target.checked })
                        }
                      />
                      <span>Somar impostos ao CAPEX base.</span>
                    </label>
                  </Field>
                </div>
              </div>
              <div className="settings-subsection">
                <h4 className="settings-subheading">Resumo do cálculo</h4>
                <p className="muted">
                  Valores consolidados da proposta atual. Ajuste o CAPEX base ou a margem manual para recalcular
                  automaticamente as demais métricas.
                </p>
                <div className="grid g3">
                  <Field label="CAPEX base">
                    <input
                      ref={capexBaseResumoSettingsField.ref}
                      type="text"
                      inputMode="decimal"
                      value={capexBaseResumoSettingsField.text}
                      onChange={capexBaseResumoSettingsField.handleChange}
                      onBlur={() => {
                        capexBaseResumoSettingsField.handleBlur()
                        capexBaseResumoSettingsField.setText(formatMoneyBR(capexBaseResumoValor))
                      }}
                      onFocus={selectNumberInputOnFocus}
                      placeholder={
                        typeof capexBaseManualValor === 'number' ? undefined : 'Automático (calculado)'
                      }
                    />
                  </Field>
                  <Field label="Margem operacional (R$)">
                    <input
                      ref={margemOperacionalResumoSettingsField.ref}
                      type="text"
                      inputMode="decimal"
                      value={margemOperacionalResumoSettingsField.text}
                      onChange={margemOperacionalResumoSettingsField.handleChange}
                      onBlur={() => margemOperacionalResumoSettingsField.handleBlur()}
                      onFocus={selectNumberInputOnFocus}
                      placeholder={margemManualAtiva ? undefined : 'Automático (padrão)'}
                    />
                  </Field>
                  <Field label="Comissão líquida (R$)">
                    <input type="text" readOnly value={currencyValue(calculoAtual?.comissao_liquida_valor)} />
                  </Field>
                </div>
                <div className="grid g3">
                  <Field label="Imposto retido (R$)">
                    <input type="text" readOnly value={currencyValue(calculoAtual?.imposto_retido_valor)} />
                  </Field>
                  <Field label="Impostos do regime (R$)">
                    <input type="text" readOnly value={currencyValue(calculoAtual?.impostos_regime_valor)} />
                  </Field>
                  <Field label="Impostos totais (R$)">
                    <input type="text" readOnly value={currencyValue(calculoAtual?.impostos_totais_valor)} />
                  </Field>
                </div>
                <div className="grid g3">
                  <Field label="CAPEX considerado">
                    <input type="text" readOnly value={currencyValue(calculoAtual?.capex_total)} />
                  </Field>
                  <Field label="Venda total (bruta)">
                    <input type="text" readOnly value={currencyValue(calculoAtual?.venda_total)} />
                  </Field>
                  <Field label="Venda líquida">
                    <input type="text" readOnly value={currencyValue(calculoAtual?.venda_liquida)} />
                  </Field>
                </div>
                <div className="grid g3">
                  <Field label="Descontos comerciais (R$)">
                    <input type="text" readOnly value={currencyValue(descontoValor)} />
                  </Field>
                  <Field label="Preço mínimo (R$)">
                    <input type="text" readOnly value={currencyValue(calculoAtual?.preco_minimo)} />
                  </Field>
                  <Field label="Venda sem guardrails (R$)">
                    <input
                      type="text"
                      readOnly
                      value={currencyValue(calculoAtual?.venda_total_sem_guardrails)}
                    />
                  </Field>
                </div>
                <div className="grid g3">
                  <Field label="Ajuste por arredondamento (R$)">
                    <input type="text" readOnly value={currencyValue(calculoAtual?.arredondamento_aplicado)} />
                  </Field>
                  <Field label="Desconto aplicado (%)">
                    <input type="text" readOnly value={percentValue(calculoAtual?.desconto_percentual)} />
                  </Field>
                  <Field label="Aprovação necessária?">
                    <input type="text" readOnly value={aprovacaoLabel} />
                  </Field>
                </div>
                <div className="grid g3">
                  <Field label="Preço mínimo aplicado?">
                    <input type="text" readOnly value={precoMinimoAplicadoLabel} />
                  </Field>
                  <Field label="Workflow de aprovação">
                    <input type="text" readOnly value={workflowStatusLabel} />
                  </Field>
                </div>
              </div>
              <div className="settings-subsection">
                <h4 className="settings-subheading">
                  Detalhamento do regime tributário (
                  {REGIME_TRIBUTARIO_LABELS[vendasConfig.regime_tributario_default] ?? ''}
                  )
                </h4>
                {regimeBreakdown.length ? (
                  <div className="grid g3">
                    {regimeBreakdown.map((item) => (
                      <Field
                        key={item.nome}
                        label={`${item.nome} (${formatNumberBRWithOptions(item.aliquota, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}%)`}
                      >
                        <input type="text" readOnly value={currencyValue(item.valor)} />
                      </Field>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Sem impostos adicionais para o regime selecionado.</p>
                )}
              </div>
            </div>
          </section>

          <section className="settings-vendas-card config-card">
            <div className="settings-vendas-card-header">
              <div>
                <h3>Comercial &amp; aprovação</h3>
                <p className="settings-vendas-card-description">
                  Defina incentivos do time comercial e limites para o fluxo de aprovação.
                </p>
              </div>
            </div>
            <div className="settings-vendas-card-body">
              <div className="settings-subsection">
                <h4 className="settings-subheading">Comissão &amp; incentivos</h4>
                <div className="grid g3">
                  <Field
                    label={labelWithTooltip(
                      'Tipo de comissão padrão',
                      'Defina se a comissão é aplicada como valor em reais ou percentual sobre a base selecionada.',
                    )}
                  >
                    <select
                      value={vendasConfig.comissao_default_tipo}
                      onChange={(event) =>
                        updateVendasConfig({
                          comissao_default_tipo: event.target.value as 'valor' | 'percentual',
                        })
                      }
                    >
                      <option value="percentual">Percentual</option>
                      <option value="valor">Valor absoluto</option>
                    </select>
                  </Field>
                  <Field label={comissaoDefaultLabel}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={vendasConfig.comissao_default_percent}
                      onChange={(event) => {
                        const parsed = parseNumericInput(event.target.value)
                        updateVendasConfig({
                          comissao_default_percent: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                        })
                      }}
                      onFocus={selectNumberInputOnFocus}
                    />
                  </Field>
                  <Field
                    label={labelWithTooltip(
                      'Base do percentual de comissão',
                      'Escolha se a comissão percentual incide sobre a venda total ou sobre a venda líquida.',
                    )}
                  >
                    <select
                      value={vendasConfig.comissao_percent_base}
                      onChange={(event) =>
                        updateVendasConfig({
                          comissao_percent_base: event.target.value as 'venda_total' | 'venda_liquida',
                        })
                      }
                    >
                      <option value="venda_total">Venda total</option>
                      <option value="venda_liquida">Venda líquida</option>
                    </select>
                  </Field>
                </div>
                <div className="grid g3">
                  <Field
                    label={labelWithTooltip(
                      'Bônus de indicação (%)',
                      'Percentual adicional reservado para indicações comerciais.',
                    )}
                  >
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={vendasConfig.bonus_indicacao_percent}
                      onChange={(event) => {
                        const parsed = parseNumericInput(event.target.value)
                        updateVendasConfig({
                          bonus_indicacao_percent: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                        })
                      }}
                      onFocus={selectNumberInputOnFocus}
                    />
                  </Field>
                  <Field
                    label={labelWithTooltip(
                      'Teto de comissão (%)',
                      'Limite máximo aplicado quando a comissão for percentual.',
                    )}
                  >
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={vendasConfig.teto_comissao_percent}
                      onChange={(event) => {
                        const parsed = parseNumericInput(event.target.value)
                        updateVendasConfig({
                          teto_comissao_percent: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                        })
                      }}
                      onFocus={selectNumberInputOnFocus}
                    />
                  </Field>
                </div>
              </div>

              <div className="settings-subsection">
                <h4 className="settings-subheading">Descontos &amp; aprovação</h4>
                <div className="grid g3">
                  <Field
                    label={labelWithTooltip(
                      'Desconto máximo sem aprovação (%)',
                      'Percentual de desconto permitido antes de acionar o workflow de aprovação.',
                    )}
                  >
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={vendasConfig.desconto_max_percent_sem_aprovacao}
                      onChange={(event) => {
                        const parsed = parseNumericInput(event.target.value)
                        updateVendasConfig({
                          desconto_max_percent_sem_aprovacao: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                        })
                      }}
                      onFocus={selectNumberInputOnFocus}
                    />
                  </Field>
                  <Field label="Workflow de aprovação ativo">
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={vendasConfig.workflow_aprovacao_ativo}
                        onChange={(event) =>
                          updateVendasConfig({ workflow_aprovacao_ativo: event.target.checked })
                        }
                      />
                      <span>Exigir aprovação para descontos acima do limite.</span>
                    </label>
                  </Field>
                  <Field
                    label={labelWithTooltip(
                      'Validade padrão da proposta (dias)',
                      'Quantidade de dias utilizada como validade padrão nas propostas geradas.',
                    )}
                  >
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={vendasConfig.validade_proposta_dias}
                      onChange={(event) => {
                        const parsed = parseNumericInput(event.target.value)
                        const normalizado = Number.isFinite(parsed ?? NaN)
                          ? Math.max(0, Math.floor(Number(parsed)))
                          : 0
                        updateVendasConfig({ validade_proposta_dias: normalizado })
                      }}
                      onFocus={selectNumberInputOnFocus}
                    />
                  </Field>
                </div>
                <Field label="Aprovadores" hint={aprovadoresHint}>
                  <textarea
                    rows={3}
                    value={aprovadoresText}
                    onChange={(event) => setAprovadoresText(event.target.value)}
                    onBlur={handleAprovadoresBlur}
                  />
                </Field>
              </div>
            </div>
          </section>
        </div>

        <section className="settings-vendas-card config-card settings-vendas-card--full">
          <div className="settings-vendas-card-header">
            <div>
              <h3>Tributação</h3>
              <p className="settings-vendas-card-description">
                Ajuste presets fiscais e personalize alíquotas conforme o regime tributário utilizado nas propostas.
              </p>
            </div>
          </div>
          <div className="settings-vendas-card-body">
            <div className="settings-subsection">
              <h4 className="settings-subheading">Configurações padrão</h4>
              <div className="grid g3">
                <Field
                  label={labelWithTooltip(
                    'Regime tributário padrão',
                    'Preset fiscal aplicado por padrão nos cálculos comerciais.',
                  )}
                >
                  <select
                    value={vendasConfig.regime_tributario_default}
                    onChange={(event) =>
                      updateVendasConfig({
                        regime_tributario_default: event.target.value as RegimeTributario,
                      })
                    }
                  >
                    <option value="simples">Simples nacional</option>
                    <option value="lucro_presumido">Lucro presumido</option>
                    <option value="lucro_real">Lucro real</option>
                  </select>
                </Field>
                <Field
                  label={labelWithTooltip(
                    'Imposto retido padrão (%)',
                    'Percentual de impostos retidos na fonte aplicado sobre a venda total.',
                  )}
                >
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={vendasConfig.imposto_retido_aliquota_default}
                    onChange={(event) => {
                      const parsed = parseNumericInput(event.target.value)
                      updateVendasConfig({
                        imposto_retido_aliquota_default: Number.isFinite(parsed ?? NaN) ? Number(parsed) : 0,
                      })
                    }}
                    onFocus={selectNumberInputOnFocus}
                  />
                </Field>
                <Field label="Mostrar quebra de impostos no PDF">
                  <label className="inline-checkbox">
                    <input
                      type="checkbox"
                      checked={vendasConfig.mostrar_quebra_impostos_no_pdf_cliente}
                      onChange={(event) =>
                        updateVendasConfig({
                          mostrar_quebra_impostos_no_pdf_cliente: event.target.checked,
                        })
                      }
                    />
                    <span>Exibir detalhamento dos impostos para o cliente.</span>
                  </label>
                </Field>
              </div>
            </div>

            {regimes.map((regime) => {
              const lista = impostosOverridesDraft[regime] ?? []
              const label = REGIME_TRIBUTARIO_LABELS[regime] ?? regime
              return (
                <div key={regime} className="settings-subsection settings-vendas-overrides">
                  <div className="table-controls settings-vendas-overrides-header">
                    <span className="muted">Overrides — {label}</span>
                    <div>
                      <button type="button" className="ghost" onClick={() => handleOverrideAdd(regime)}>
                        Adicionar imposto
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleResetOverrides(regime)}
                        disabled={lista.length === 0}
                      >
                        Restaurar preset
                      </button>
                    </div>
                  </div>
                  {lista.length ? (
                    lista.map((item, index) => (
                      <div key={`${regime}-${index}`} className="grid g3">
                        <Field label="Nome do imposto">
                          <input
                            type="text"
                            value={item.nome ?? ''}
                            onChange={(event) =>
                              handleOverrideFieldChange(regime, index, 'nome', event.target.value)
                            }
                          />
                        </Field>
                        <Field label="Alíquota (%)">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={Number.isFinite(item.aliquota_percent) ? Number(item.aliquota_percent) : 0}
                            onChange={(event) =>
                              handleOverrideFieldChange(regime, index, 'aliquota_percent', event.target.value)
                            }
                            onFocus={selectNumberInputOnFocus}
                          />
                        </Field>
                        <div className="field">
                          <label>&nbsp;</label>
                          <button
                            type="button"
                            className="ghost danger"
                            onClick={() => handleOverrideRemove(regime, index)}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Sem overrides — usando preset padrão.</p>
                  )}
                </div>
              )
            })}
            <div className="table-controls settings-vendas-overrides-actions">
              <button type="button" className="primary" onClick={handleApplyOverrides}>
                Aplicar overrides
              </button>
            </div>
          </div>
        </section>

        <section className="settings-vendas-card config-card settings-vendas-card--full">
          <div className="settings-vendas-card-header">
            <div>
              <h3>Exibição no PDF (cliente)</h3>
              <p className="settings-vendas-card-description">
                Personalize as informações exibidas para o cliente nas propostas geradas.
              </p>
            </div>
          </div>
          <div className="settings-vendas-card-body">
            <div className="grid g3">
              <Field label="Exibir preços unitários">
                <label className="inline-checkbox">
                  <input
                    type="checkbox"
                    checked={vendasConfig.exibir_precos_unitarios}
                    onChange={(event) =>
                      updateVendasConfig({ exibir_precos_unitarios: event.target.checked })
                    }
                  />
                  <span>Mostrar valores unitários dos itens na proposta.</span>
                </label>
              </Field>
              <Field label="Exibir margem">
                <label className="inline-checkbox">
                  <input
                    type="checkbox"
                    checked={vendasConfig.exibir_margem}
                    onChange={(event) => updateVendasConfig({ exibir_margem: event.target.checked })}
                  />
                  <span>Mostrar margem operacional no PDF.</span>
                </label>
              </Field>
              <Field label="Exibir comissão">
                <label className="inline-checkbox">
                  <input
                    type="checkbox"
                    checked={vendasConfig.exibir_comissao}
                    onChange={(event) => updateVendasConfig({ exibir_comissao: event.target.checked })}
                  />
                  <span>Exibir comissão líquida para o cliente.</span>
                </label>
              </Field>
              <Field label="Exibir impostos">
                <label className="inline-checkbox">
                  <input
                    type="checkbox"
                    checked={vendasConfig.exibir_impostos}
                    onChange={(event) => updateVendasConfig({ exibir_impostos: event.target.checked })}
                  />
                  <span>Mostrar valores de impostos no PDF.</span>
                </label>
              </Field>
            </div>
            <Field label="Observação padrão da proposta">
              <textarea
                rows={4}
                value={vendasConfig.observacao_padrao_proposta}
                onChange={(event) =>
                  updateVendasConfig({ observacao_padrao_proposta: event.target.value })
                }
              />
            </Field>
          </div>
        </section>
      </div>
    )
  }

  const renderCondicoesPagamentoSection = () => {
    const condicao = vendaForm.condicao
    return (
      <section className="card">
        <h2>Condições de Pagamento</h2>
        <div className="grid g3">
          <Field
            label={labelWithTooltip(
              'Condição',
              'Seleciona o formato de pagamento (à vista, parcelado ou financiamento), alterando os campos exibidos.',
            )}
          >
            <select
              value={condicao}
              onChange={(event) => handleCondicaoPagamentoChange(event.target.value as PagamentoCondicao)}
            >
              <option value="AVISTA">À vista</option>
              <option value="PARCELADO">Parcelado</option>
              <option value="FINANCIAMENTO">Financiamento</option>
            </select>
            <FieldError message={vendaFormErrors.condicao} />
          </Field>
          <Field
            label={labelWithTooltip(
              isVendaDiretaTab ? 'VALOR TOTAL DA PROPOSTA (R$)' : 'Investimento (CAPEX total)',
              isVendaDiretaTab
                ? 'Preço final para aquisição da usina completa (equipamentos, instalação, homologação e suporte).'
                : 'Valor total do projeto fotovoltaico. Serve de base para entradas, parcelas e margens.',
            )}
          >
            <input
              ref={capexMoneyField.ref}
              type="text"
              inputMode="decimal"
              value={capexMoneyField.text}
              onChange={capexMoneyField.handleChange}
              onBlur={() => {
                capexMoneyField.handleBlur()
                capexMoneyField.setText(formatMoneyBR(valorTotalPropostaNormalizado))
              }}
              onFocus={selectNumberInputOnFocus}
            />
            <FieldError message={vendaFormErrors.capex_total} />
          </Field>
          <Field
            label={labelWithTooltip(
              'Moeda',
              'Moeda utilizada na proposta. Atualmente fixa em reais (BRL).',
            )}
          >
            <input readOnly value="BRL" />
          </Field>
        </div>
        {condicao === 'AVISTA' ? (
          <div className="grid g3">
            <Field
              label={labelWithTooltip(
                'Modo de pagamento',
                'Define o meio de pagamento à vista (Pix, débito ou crédito) e habilita as taxas correspondentes.',
              )}
            >
              <select
                value={vendaForm.modo_pagamento ?? 'PIX'}
                onChange={(event) => applyVendaUpdates({ modo_pagamento: event.target.value as ModoPagamento })}
              >
                <option value="PIX">Pix</option>
                <option value="DEBITO">Cartão de débito</option>
                <option value="CREDITO">Cartão de crédito</option>
              </select>
              <FieldError message={vendaFormErrors.modo_pagamento} />
            </Field>
            <Field
              label={labelWithTooltip(
                'MDR Pix',
                'Taxa de desconto do adquirente para Pix. Custo MDR = Valor transacionado × MDR.',
              )}
            >
              <input
                type="number"
                min={0}
                max={1}
                step="0.001"
                value={
                  Number.isFinite(vendaForm.taxa_mdr_pix_pct)
                    ? vendaForm.taxa_mdr_pix_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (value === '') {
                    applyVendaUpdates({ taxa_mdr_pix_pct: 0 })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({ taxa_mdr_pix_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.taxa_mdr_pix_pct} />
            </Field>
            <Field
              label={labelWithTooltip(
                'MDR Débito',
                'Percentual retido pela adquirente em pagamentos no débito. Custo = Valor × MDR.',
              )}
            >
              <input
                type="number"
                min={0}
                max={1}
                step="0.001"
                value={
                  Number.isFinite(vendaForm.taxa_mdr_debito_pct)
                    ? vendaForm.taxa_mdr_debito_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (value === '') {
                    applyVendaUpdates({ taxa_mdr_debito_pct: 0 })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({ taxa_mdr_debito_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.taxa_mdr_debito_pct} />
            </Field>
            <Field
              label={labelWithTooltip(
                'MDR Crédito à vista',
                'Taxa aplicada sobre vendas no crédito em parcela única. Custo = Valor × MDR.',
              )}
            >
              <input
                type="number"
                min={0}
                max={1}
                step="0.001"
                value={
                  Number.isFinite(vendaForm.taxa_mdr_credito_vista_pct)
                    ? vendaForm.taxa_mdr_credito_vista_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (value === '') {
                    applyVendaUpdates({ taxa_mdr_credito_vista_pct: 0 })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({
                    taxa_mdr_credito_vista_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                  })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.taxa_mdr_credito_vista_pct} />
            </Field>
          </div>
        ) : null}
        {condicao === 'PARCELADO' ? (
          <div className="grid g3">
            <Field
              label={labelWithTooltip(
                'Nº de parcelas',
                'Quantidade de parcelas do cartão. Parcela estimada via fórmula PMT = Valor × [i × (1 + i)^n] / [(1 + i)^n - 1].',
              )}
            >
              <input
                type="number"
                min={1}
                step={1}
                value={Number.isFinite(vendaForm.n_parcelas) ? vendaForm.n_parcelas : ''}
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ n_parcelas: undefined })
                    return
                  }
                  const parsed = Number(value)
                  const normalized = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1
                  applyVendaUpdates({ n_parcelas: normalized })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.n_parcelas} />
            </Field>
            <Field
              label={labelWithTooltip(
                'Juros cartão (% a.m.)',
                'Taxa de juros mensal aplicada pela operadora. Equivalência anual: (1 + i)^12 - 1.',
              )}
            >
              <input
                type="number"
                step="0.01"
                value={
                  Number.isFinite(vendaForm.juros_cartao_am_pct)
                    ? vendaForm.juros_cartao_am_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ juros_cartao_am_pct: undefined })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({ juros_cartao_am_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.juros_cartao_am_pct} />
            </Field>
            <Field
              label={labelWithTooltip(
                'Juros cartão (% a.a.)',
                'Taxa de juros anual utilizada para relatórios. Pode ser derivada de i_mensal: (1 + i_mensal)^12 - 1.',
              )}
            >
              <input
                type="number"
                step="0.1"
                value={
                  Number.isFinite(vendaForm.juros_cartao_aa_pct)
                    ? vendaForm.juros_cartao_aa_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ juros_cartao_aa_pct: undefined })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({ juros_cartao_aa_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.juros_cartao_aa_pct} />
            </Field>
            <Field
              label={labelWithTooltip(
                'MDR crédito parcelado',
                'Taxa retida pela adquirente em vendas parceladas no cartão. Custo = Valor × MDR.',
              )}
            >
              <input
                type="number"
                min={0}
                max={1}
                step="0.001"
                value={
                  Number.isFinite(vendaForm.taxa_mdr_credito_parcelado_pct)
                    ? vendaForm.taxa_mdr_credito_parcelado_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ taxa_mdr_credito_parcelado_pct: 0 })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({
                    taxa_mdr_credito_parcelado_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                  })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.taxa_mdr_credito_parcelado_pct} />
            </Field>
          </div>
        ) : null}
        {condicao === 'FINANCIAMENTO' ? (
          <div className="grid g3">
            <Field
              label={labelWithTooltip(
                'Entrada (R$)',
                'Valor de entrada pago pelo cliente. Saldo financiado = CAPEX - Entrada.',
              )}
            >
              <input
                type="number"
                min={0}
                value={
                  Number.isFinite(vendaForm.entrada_financiamento)
                    ? vendaForm.entrada_financiamento
                    : ''
                }
                onChange={(event) => {
                  const parsed = parseNumericInput(event.target.value)
                  const normalized = parsed && parsed > 0 ? parsed : 0
                  applyVendaUpdates({ entrada_financiamento: normalized })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.entrada_financiamento} />
            </Field>
            <Field
              label={labelWithTooltip(
                'Nº de parcelas',
                'Quantidade de parcelas do financiamento. Parcela calculada pela fórmula PMT com i_mensal e n.',
              )}
            >
              <input
                type="number"
                min={1}
                step={1}
                value={
                  Number.isFinite(vendaForm.n_parcelas_fin)
                    ? vendaForm.n_parcelas_fin
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ n_parcelas_fin: undefined })
                    return
                  }
                  const parsed = Number(value)
                  const normalized = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1
                  applyVendaUpdates({ n_parcelas_fin: normalized })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.n_parcelas_fin} />
            </Field>
            <Field
              label={labelWithTooltip(
                'Juros financiamento (% a.m.)',
                'Taxa de juros mensal contratada com a instituição financeira.',
              )}
            >
              <input
                type="number"
                step="0.01"
                value={
                  Number.isFinite(vendaForm.juros_fin_am_pct)
                    ? vendaForm.juros_fin_am_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ juros_fin_am_pct: undefined })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({ juros_fin_am_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.juros_fin_am_pct} />
            </Field>
            <Field
              label={labelWithTooltip(
                'Juros financiamento (% a.a.)',
                'Taxa de juros anual equivalente. Pode ser obtida por (1 + i_mensal)^12 - 1.',
              )}
            >
              <input
                type="number"
                step="0.1"
                value={
                  Number.isFinite(vendaForm.juros_fin_aa_pct)
                    ? vendaForm.juros_fin_aa_pct
                    : ''
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ juros_fin_aa_pct: undefined })
                    return
                  }
                  const parsed = Number(value)
                  applyVendaUpdates({ juros_fin_aa_pct: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.juros_fin_aa_pct} />
            </Field>
          </div>
        ) : null}
      </section>
    )
  }

  const renderRetornoProjetadoSection = () => {
    const resultado = retornoProjetado
    const paybackLabel = resultado?.payback
      ? `${resultado.payback} meses`
      : 'Não atingido em 30 anos'
    const roiLabel = resultado
      ? new Intl.NumberFormat('pt-BR', {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(resultado.roi)
      : ''
    const showVpl = Boolean(resultado && typeof resultado.vpl === 'number')
    const vplLabel = showVpl && resultado ? currency(resultado.vpl as number) : ''

    const kpis: { label: string; value: string }[] = [
      { label: 'Payback (meses)', value: paybackLabel },
      { label: 'ROI acumulado (30 anos)', value: roiLabel },
    ]

    if (showVpl) {
      kpis.push({ label: 'VPL', value: vplLabel })
    }

    let financialReturnChart: React.ReactNode = null

    if (resultado) {
      const formatPaybackDuration = (meses: number): string => {
        if (!Number.isFinite(meses) || meses <= 0) {
          return '0 meses'
        }
        const anosInteiros = Math.floor(meses / 12)
        const mesesRestantes = meses % 12
        const partes: string[] = []
        if (anosInteiros > 0) {
          partes.push(`${anosInteiros} ${anosInteiros === 1 ? 'ano' : 'anos'}`)
        }
        if (mesesRestantes > 0 || partes.length === 0) {
          partes.push(`${mesesRestantes} ${mesesRestantes === 1 ? 'mês' : 'meses'}`)
        }
        return partes.join(' e ')
      }

      const years = [5, 10, 15, 20, 30] as const
      const capexTotal = Number.isFinite(vendaForm.capex_total)
        ? Math.max(0, Number(vendaForm.capex_total))
        : 0
      const investimentoInicialResultado = Number.isFinite(resultado.investimentoInicial)
        ? Math.max(0, Number(resultado.investimentoInicial))
        : 0
      const investimentoConsiderado = Math.max(capexTotal, investimentoInicialResultado)
      const cumulativeSavings: number[] = []
      let saldoAcumuladoVista = investimentoConsiderado > 0 ? -investimentoConsiderado : 0

      for (let mes = 0; mes < resultado.economia.length; mes += 1) {
        saldoAcumuladoVista += resultado.economia[mes] ?? 0
        cumulativeSavings.push(saldoAcumuladoVista)
      }

      const paybackIndexVista = cumulativeSavings.findIndex((value) => value >= 0)
      const paybackMesesVista = paybackIndexVista >= 0 ? paybackIndexVista + 1 : null
      const paybackLabelVista =
        paybackMesesVista != null ? formatPaybackDuration(paybackMesesVista) : 'Não alcançado em 30 anos'

      const yearsData = years.map((year) => {
        const monthIndex = Math.min(year * 12 - 1, cumulativeSavings.length - 1)
        const value =
          monthIndex >= 0
            ? cumulativeSavings[monthIndex]
            : cumulativeSavings.length > 0
            ? cumulativeSavings[cumulativeSavings.length - 1]
            : saldoAcumuladoVista
        return { year, value }
      })

      const paybackYearIndex =
        paybackMesesVista != null ? years.findIndex((year) => paybackMesesVista <= year * 12) : -1

      const chartValues = yearsData.map((item) => item.value)
      const maxPositive = Math.max(0, ...chartValues)
      const minNegative = Math.min(0, ...chartValues)
      const hasPositive = maxPositive > 0
      const hasNegative = minNegative < 0
      let zeroPositionPercent = 0
      if (hasPositive && hasNegative) {
        const totalSpan = maxPositive + Math.abs(minNegative)
        zeroPositionPercent = totalSpan > 0 ? (Math.abs(minNegative) / totalSpan) * 100 : 0
      } else if (!hasPositive && hasNegative) {
        zeroPositionPercent = 100
      } else {
        zeroPositionPercent = 0
      }
      const positiveSpan = 100 - zeroPositionPercent
      const negativeSpan = zeroPositionPercent
      const zeroPositionStyle = {
        '--zero-position': `${zeroPositionPercent}%`,
      } as React.CSSProperties

      financialReturnChart = (
        <div className="financial-return-chart">
          <div className="financial-return-chart-header">
            <div>
              <h3>Benefício acumulado em 30 anos</h3>
              <p>
                Evolução das economias projetadas frente ao investimento à vista
                {investimentoConsiderado > 0 ? (
                  <>
                    {' '}
                    de <strong>{currency(investimentoConsiderado)}</strong>
                  </>
                ) : null}
                .
              </p>
            </div>
            <div className="financial-return-chart-payback-summary">
              <span>Payback estimado</span>
              <strong>{paybackMesesVista != null ? paybackLabelVista : 'Não alcançado em 30 anos'}</strong>
            </div>
          </div>
          <ul className="financial-return-chart-list">
            {yearsData.map((item, index) => {
              const value = item.value
              const valueLabel = currency(value)
              const isPositive = value >= 0
              const spanLimit = isPositive ? positiveSpan : negativeSpan
              let proportionalWidth = 0
              if (isPositive) {
                proportionalWidth = hasPositive && spanLimit > 0 ? (value / maxPositive) * spanLimit : 0
              } else {
                proportionalWidth = hasNegative && spanLimit > 0 ? (Math.abs(value) / Math.abs(minNegative)) * spanLimit : 0
              }
              const width = Number.isFinite(proportionalWidth)
                ? Math.min(spanLimit, Math.max(0, proportionalWidth))
                : 0
              const left = isPositive ? zeroPositionPercent : zeroPositionPercent - width
              const barStyle = {
                width: `${width.toFixed(2)}%`,
                left: `${left.toFixed(2)}%`,
              } as React.CSSProperties
              const valueClassName = [
                'financial-return-chart-value',
                isPositive ? 'positive' : 'negative',
              ].join(' ')
              const barClassName = [
                'financial-return-chart-bar',
                isPositive ? 'positive' : 'negative',
                paybackYearIndex === index && paybackMesesVista != null ? 'is-payback' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <li key={item.year} className="financial-return-chart-row">
                  <div className="financial-return-chart-year">{item.year} anos</div>
                  <div className="financial-return-chart-bar-area" style={zeroPositionStyle}>
                    <div className="financial-return-chart-bar-track" aria-hidden="true" />
                    <div className="financial-return-chart-axis" aria-hidden="true" />
                    <div
                      className={barClassName}
                      style={barStyle}
                      aria-hidden="true"
                      title={`${valueLabel} em ${item.year} anos`}
                    />
                  </div>
                  <div className={valueClassName}>
                    <span>{valueLabel}</span>
                    {paybackYearIndex === index && paybackMesesVista != null ? (
                      <span className="financial-return-chart-chip">Payback em {paybackLabelVista}</span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )
    }

    return (
      <section className="card">
        <div className="card-header">
          <h2>Retorno Financeiro (Venda)</h2>
          <button
            type="button"
            className="primary"
            onClick={handleCalcularRetorno}
            disabled={retornoStatus === 'calculating'}
          >
            {retornoStatus === 'calculating'
              ? 'Calculando…'
              : resultado
              ? 'Recalcular retorno'
              : 'Calcular retorno'}
          </button>
        </div>
        {retornoError ? <p className="field-error">{retornoError}</p> : null}
        {resultado ? (
          <>
            <div className="kpi-grid">
              {kpis.map((item) => (
                <div key={item.label} className="kpi">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            {financialReturnChart}
          </>
        ) : retornoStatus === 'calculating' ? (
          <p className="muted">Calculando projeções…</p>
        ) : (
          <p className="muted">Preencha os dados e clique em “Calcular retorno”.</p>
        )}
      </section>
    )
  }

  return (
    <Providers>
      <AppRoutes>
        {activePage === 'crm' ? (
          renderCrmPage()
        ) : (
          <div className="page">
          <React.Suspense fallback={null}>
            <PrintableProposal ref={printableRef} {...printableData} />
          </React.Suspense>
          <header className="topbar app-header">
            <div className="container">
              <div className="brand">
                <img src="/logo.svg" alt="SolarInvest" />
                <div className="brand-text">
                  <h1>SolarInvest App</h1>
                  <p>Proposta financeira interativa</p>
                </div>
              </div>
              <div className="top-actions">
                {/* Botão dedicado ao CRM para acesso rápido, mantendo posição à esquerda do buscador de orçamentos. */}
                <button className="crm-button" onClick={() => setActivePage('crm')}>
                  Central CRM
                </button>
                <button className="ghost" onClick={abrirPesquisaOrcamentos}>Pesquisar</button>
                <button className="ghost" onClick={handlePrint}>Exportar PDF</button>
                <button className="icon" onClick={() => setIsSettingsOpen(true)} aria-label="Abrir configurações">⚙︎</button>
              </div>
            </div>
          </header>
          <div className="app-main">
            <nav className="tabs tabs-bar">
              <div className="container">
                <button className={activeTab === 'leasing' ? 'active' : ''} onClick={() => setActiveTab('leasing')}>
                  Leasing
                </button>
                <button className={activeTab === 'vendas' ? 'active' : ''} onClick={() => setActiveTab('vendas')}>
                  Vendas
                </button>
              </div>
            </nav>

            <main className={`content page-content${activeTab === 'vendas' ? ' vendas' : ''}`}>
              <div className="page-actions">
                <button
                  type="button"
                  className={`ghost${activeTab === 'leasing' ? ' solid' : ''}`}
                  onClick={handleNovaProposta}
                >
                  Novo
                </button>
                {isVendaDiretaTab ? (
                  <button type="button" className="ghost" onClick={handleRecalcularVendas}>
                    Recalcular
                  </button>
                ) : null}
                {podeSalvarProposta ? (
                  <button
                    type="button"
                    className={`primary${activeTab === 'leasing' ? ' solid' : ''}`}
                    onClick={handleSalvarPropostaPdf}
                    disabled={salvandoPropostaPdf}
                  >
                    {salvandoPropostaPdf ? 'Salvando…' : 'Salvar'}
                  </button>
                ) : null}
              </div>
              {renderClienteDadosSection()}
              {activeTab === 'leasing' ? (
                <>
                  {renderParametrosPrincipaisSection()}
                  {renderConfiguracaoUsinaSection()}
                  <section className="card">
                    <div className="card-header">
                      <h2>SolarInvest Leasing</h2>
                    </div>

                    <div className="grid g3">
                      <Field
                        label={labelWithTooltip(
                          'Entrada (R$)',
                          'Entrada inicial do leasing. Pode gerar crédito mensal: Entrada ÷ Prazo contratual (meses).',
                        )}
                      >
                        <input
                          type="number"
                          value={entradaRs}
                          onChange={(e) => {
                            const parsed = Number(e.target.value)
                            setEntradaRs(Number.isFinite(parsed) ? Math.max(0, parsed) : 0)
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Desconto contratual (%)',
                          'Percentual aplicado sobre a tarifa cheia. Tarifa com desconto = Tarifa cheia × (1 - desconto).',
                        )}
                      >
                        <input
                          type="number"
                          step="0.1"
                          value={desconto}
                          onChange={(e) => setDesconto(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Prazo do leasing',
                          'Duração do contrato de leasing em anos. Prazo em meses = anos × 12.',
                        )}
                      >
                        <select
                          value={leasingPrazo}
                          onChange={(e) => setLeasingPrazo(Number(e.target.value) as LeasingPrazoAnos)}
                        >
                          {LEASING_PRAZO_OPCOES.map((valor) => (
                            <option key={valor} value={valor}>
                              {`${formatLeasingPrazoAnos(valor)} anos`}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="info-inline">
                      <span className="pill">
                        <InfoTooltip text="Calculado como Potência do sistema (kWp) × Preço por kWp (R$)." />
                        Valor do Investimento
                        <strong>{currency(capex)}</strong>
                      </span>
                      <span className="pill">
                        <InfoTooltip text="Tarifa com desconto = Tarifa cheia ajustada pelos reajustes anuais × (1 - desconto contratual)." />
                        Tarifa c/ desconto
                        <strong>{tarifaCurrency(parcelasSolarInvest.tarifaDescontadaBase)} / kWh</strong>
                      </span>
                      {modoEntradaNormalizado === 'REDUZ' ? (
                        <span className="pill">
                          Piso contratado ajustado
                          <InfoTooltip text="Piso ajustado = Consumo contratado × (1 - min(1, Entrada ÷ (Consumo × Tarifa cheia × (1 - desconto) × Prazo)))." />
                          :{' '}
                          <strong>
                            {`${formatNumberBRWithOptions(parcelasSolarInvest.kcAjustado, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })} kWh`}
                          </strong>
                        </span>
                      ) : null}
                      {modoEntradaNormalizado === 'CREDITO' ? (
                        <span className="pill">
                          Crédito mensal da entrada:
                          <InfoTooltip text="Crédito mensal = Valor de entrada ÷ Prazo contratual (em meses)." />
                          <strong>{currency(parcelasSolarInvest.creditoMensal)}</strong>
                        </span>
                      ) : null}
                    </div>

                    <div className="table-controls">
                      <button
                        type="button"
                        className="collapse-toggle"
                        onClick={() => setMostrarTabelaParcelas((prev) => !prev)}
                        aria-expanded={mostrarTabelaParcelas}
                        aria-controls="parcelas-solarinvest-tabela"
                      >
                        {mostrarTabelaParcelas ? 'Ocultar tabela de parcelas' : 'Exibir tabela de parcelas'}
                      </button>
                    </div>
                    {mostrarTabelaParcelas ? (
                      <div className="table-wrapper">
                        <table id="parcelas-solarinvest-tabela">
                          <thead>
                            <tr>
                              <th>Mês</th>
                              <th>Tarifa por kWh</th>
                              <th>Tarifa c/ desconto (R$/kWh)</th>
                              <th>MENSALIDADE CHEIA</th>
                              <th>TUSD (R$)</th>
                              <th>MENSALIDADE COM LEASING</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parcelasSolarInvest.lista.length > 0 ? (
                              parcelasSolarInvest.lista.map((row) => (
                                <tr key={row.mes}>
                                  <td>{row.mes}</td>
                                  <td>{tarifaCurrency(row.tarifaCheia)}</td>
                                  <td>{tarifaCurrency(row.tarifaDescontada)}</td>
                                  <td>{currency(row.mensalidadeCheia)}</td>
                                  <td>{currency(row.tusd)}</td>
                                  <td>{currency(row.mensalidade)}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={6} className="muted">Defina um prazo contratual para gerar a projeção das parcelas.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </section>

            <div className="grid g2">
              <section className="card">
                <h2>Leasing — Mensalidades</h2>
                <div className="list-col">
                  {leasingMensalidades.map((valor, index) => (
                    <div className="list-row" key={`leasing-m${index}`}>
                      <span>Ano {index + 1}</span>
                      <strong>{currency(valor)}</strong>
                    </div>
                  ))}
                </div>
                <div className="notice">
                  <div className="dot" />
                  <div>
                    <p className="notice-title">Fim do prazo</p>
                    <p className="notice-sub">
                      Após {formatLeasingPrazoAnos(leasingPrazo)} anos a curva acelera: 100% do retorno fica com o cliente.
                    </p>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <h2>Financiamento — Mensalidades</h2>
                  <span className="toggle-label">Coluna ativa: {mostrarFinanciamento ? 'Sim' : 'Não'}</span>
                </div>
                {mostrarFinanciamento ? (
                  <div className="list-col">
                    {financiamentoMensalidades.map((valor, index) => (
                      <div className="list-row" key={`fin-m${index}`}>
                        <span>Ano {index + 1}</span>
                        <strong>{currency(valor)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Habilite nas configurações para comparar a coluna de financiamento.</p>
                )}
              </section>
            </div>

            <section className="card">
              <div className="card-header">
                <h2>Compra antecipada (Buyout)</h2>
                <span className="muted">Valores entre o mês 7 e o mês {duracaoMesesExibicao}.</span>
              </div>
              <div className="table-controls">
                <button
                  type="button"
                  className="ghost"
                  onClick={handleImprimirTabelaTransferencia}
                  disabled={gerandoTabelaTransferencia}
                >
                  {gerandoTabelaTransferencia ? 'Gerando PDF…' : 'Imprimir tabela'}
                </button>
                <button
                  type="button"
                  className="collapse-toggle"
                  onClick={() => setMostrarTabelaBuyout((prev) => !prev)}
                  aria-expanded={mostrarTabelaBuyout}
                  aria-controls="compra-antecipada-tabela"
                >
                  {mostrarTabelaBuyout ? 'Ocultar tabela de buyout' : 'Exibir tabela de buyout'}
                </button>
              </div>
              {mostrarTabelaBuyout ? (
                <div className="table-wrapper">
                  <table id="compra-antecipada-tabela">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Tarifa projetada</th>
                        <th>Prestação efetiva</th>
                        <th>Cashback</th>
                        <th>Valor de compra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabelaBuyout
                        .filter((row) => row.mes >= 7 && row.mes <= buyoutMesAceiteFinal)
                        .map((row) => (
                          <tr key={row.mes}>
                            <td>{row.mes}</td>
                            <td>{tarifaCurrency(row.tarifa)}</td>
                            <td>{currency(row.prestacaoEfetiva)}</td>
                            <td>{currency(row.cashback)}</td>
                            <td>{row.valorResidual == null ? '' : currency(row.valorResidual)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
            {mostrarGrafico ? (
              <LeasingBeneficioChart
                leasingROI={leasingROI}
                financiamentoROI={financiamentoROI}
                mostrarFinanciamento={mostrarFinanciamento}
                exibirLeasingLinha={exibirLeasingLinha}
                onToggleLeasing={setExibirLeasingLinha}
                exibirFinLinha={exibirFinLinha}
                onToggleFinanciamento={setExibirFinLinha}
                chartTheme={chartTheme}
                theme={theme}
                currency={currency}
                formatAxis={formatAxis}
              />
            ) : null}
          </>
        ) : (
          <>
            {renderVendaParametrosSection()}
            {renderVendaConfiguracaoSection()}
            {renderVendaResumoPublicoSection()}
            {renderComposicaoUfvSection()}
            <section className="card">
              <h2>Upload de Orçamento</h2>
              <div className="budget-upload-section">
                <p className="muted">
                  Envie um orçamento em PDF ou imagem (PNG/JPG) para extrair automaticamente os itens e valores do kit solar.
                </p>
                <div className="budget-upload-control">
                  <input
                    ref={budgetUploadInputRef}
                    id={budgetUploadInputId}
                    className="budget-upload-input"
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    onChange={handleBudgetFileChange}
                    disabled={isBudgetProcessing}
                  />
                  <label
                    htmlFor={budgetUploadInputId}
                    className={`budget-upload-trigger${isBudgetProcessing ? ' disabled' : ''}`}
                  >
                    <span aria-hidden="true">📎</span>
                    <span>Selecionar arquivo</span>
                  </label>
                  <div className="budget-upload-dpi">
                    <label htmlFor="budget-ocr-dpi">Resolução do OCR</label>
                    <select
                      id="budget-ocr-dpi"
                      value={ocrDpi}
                      onChange={(event) => setOcrDpi(Number(event.target.value) as 200 | 300 | 400)}
                      disabled={isBudgetProcessing}
                    >
                      <option value={200}>200 DPI</option>
                      <option value={300}>300 DPI (padrão)</option>
                      <option value={400}>400 DPI</option>
                    </select>
                  </div>
                  <span className="budget-upload-hint">Envie um orçamento em PDF ou imagem (PNG/JPG).</span>
                  {isBudgetProcessing ? (
                    <span className="budget-upload-status">
                      {describeBudgetProgress(budgetProcessingProgress)}
                    </span>
                  ) : null}
                  {budgetProcessingError ? (
                    <span className="budget-upload-error">{budgetProcessingError}</span>
                  ) : null}
                  {!isBudgetProcessing && kitBudget.fileName ? (
                    <span className="budget-upload-file">
                      <strong>{kitBudget.fileName}</strong>
                      {kitBudget.fileSizeBytes ? ` — ${formatFileSize(kitBudget.fileSizeBytes)}` : ''}
                    </span>
                  ) : null}
                </div>
              </div>
            </section>
            <section className="card">
              <h2>Orçamento do Kit Solar</h2>
              {kitBudget.fileName ? (
                <p className="budget-upload-file">
                  Arquivo analisado: <strong>{kitBudget.fileName}</strong>
                  {kitBudget.fileSizeBytes ? ` (${formatFileSize(kitBudget.fileSizeBytes)})` : ''}
                </p>
              ) : null}
              {kitBudget.warnings.length > 0 ? (
                <ul className="budget-warning-list">
                  {kitBudget.warnings.map((warning, index) => (
                    <li key={`budget-warning-${index}`}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              {kitBudget.ignoredByNoise > 0 ? (
                <span className="budget-noise-badge">
                  {kitBudget.ignoredByNoise}{' '}
                  {kitBudget.ignoredByNoise === 1
                    ? 'item ignorado por filtro de ruído'
                    : 'itens ignorados por filtro de ruído'}
                </span>
              ) : null}
              {budgetMissingSummary ? (
                <div className="budget-missing-alert">
                  <div>
                    <h3>Informações ausentes do documento</h3>
                    <p>
                      Não foi possível identificar {budgetMissingSummary.fieldsText} de{' '}
                      <strong>módulos e/ou inversor</strong> neste orçamento. Você pode editar manualmente ou
                      reenviar um arquivo em outro formato.
                    </p>
                  </div>
                  <div className="budget-missing-alert-actions">
                    <button type="button" className="primary" onClick={handleMissingInfoManualEdit}>
                      Editar manualmente
                    </button>
                    <button type="button" className="ghost" onClick={handleMissingInfoUploadClick}>
                      Enviar outro arquivo
                    </button>
                  </div>
                </div>
              ) : null}
              {kitBudget.items.length === 0 ? (
                <div className="budget-empty">
                  <p>
                    Nenhum item de orçamento foi carregado ainda. Faça o upload de um arquivo ou adicione
                    itens manualmente.
                  </p>
                  <button type="button" className="ghost" onClick={handleAddBudgetItem}>
                    Adicionar item manualmente
                  </button>
                </div>
              ) : (
                <>
                  <div className="budget-table-toggle">
                    <button
                      type="button"
                      className="ghost with-icon"
                      aria-expanded={!isBudgetTableCollapsed}
                      aria-controls={budgetTableContentId}
                      onClick={() => setIsBudgetTableCollapsed((previous) => !previous)}
                    >
                      <span aria-hidden="true">{isBudgetTableCollapsed ? '▸' : '▾'}</span>
                      <span>
                        {isBudgetTableCollapsed
                          ? 'Expandir itens do orçamento'
                          : 'Recolher itens do orçamento'}
                      </span>
                    </button>
                  </div>
                  <div
                    id={budgetTableContentId}
                    className={`budget-table-content${isBudgetTableCollapsed ? ' collapsed' : ''}`}
                  >
                    <div className="table-wrapper budget-table-wrapper">
                      <table className="budget-table">
                        <thead>
                          <tr>
                            <th>Produto</th>
                            <th>Descrição</th>
                            <th>Quantidade</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kitBudget.items.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <input
                                  type="text"
                                  data-budget-item-id={item.id}
                                  data-field="product"
                                  value={item.productName}
                                  onChange={(event) =>
                                    handleBudgetItemTextChange(item.id, 'productName', event.target.value)
                                  }
                                  placeholder="Nome do produto"
                                />
                              </td>
                              <td>
                                <textarea
                                  data-budget-item-id={item.id}
                                  data-field="description"
                                  value={item.description}
                                  onChange={(event) =>
                                    handleBudgetItemTextChange(item.id, 'description', event.target.value)
                                  }
                                  placeholder="Descrição ou observações"
                                  rows={3}
                                />
                              </td>
                              <td className="budget-table-numeric">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  data-budget-item-id={item.id}
                                  data-field="quantity"
                                  value={item.quantityInput}
                                  onChange={(event) =>
                                    handleBudgetItemQuantityChange(item.id, event.target.value)
                                  }
                                  placeholder="0"
                                />
                              </td>
                              <td className="budget-table-actions">
                                <button
                                  type="button"
                                  className="link danger"
                                  onClick={() => handleRemoveBudgetItem(item.id)}
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="budget-actions">
                      <button type="button" className="ghost" onClick={handleAddBudgetItem}>
                        Adicionar item
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div className="budget-summary">
                <div className="budget-total-field">
                  <label htmlFor="budget-total-input">Valor Total do Orçamento</label>
                  <input
                    id="budget-total-input"
                    type="text"
                    inputMode="decimal"
                    value={kitBudget.totalInput}
                    onChange={(event) => handleBudgetTotalChange(event.target.value)}
                    onFocus={selectNumberInputOnFocus}
                    placeholder="Ex.: 45.000,00"
                  />
                  {kitBudget.totalSource === 'calculated' ? (
                    <small className="muted">
                      Valor calculado automaticamente com base nos itens listados.
                    </small>
                  ) : kitBudget.totalSource === 'explicit' ? (
                    <small className="muted">Valor identificado no PDF. Ajuste se necessário.</small>
                  ) : (
                    <small className="muted">
                      Informe o valor total do orçamento para registrar no sistema.
                    </small>
                  )}
                </div>
              </div>
            </section>
            {renderCondicoesPagamentoSection()}
            {renderRetornoProjetadoSection()}
          </>
        )}
        </main>
      </div>

      {isClientesModalOpen ? (
        <ClientesModal
          registros={clientesSalvos}
          onClose={fecharClientesModal}
          onEditar={handleEditarCliente}
          onExcluir={handleExcluirCliente}
        />
      ) : null}

      {isBudgetSearchOpen ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="budget-search-title">
          <div className="modal-backdrop" onClick={fecharPesquisaOrcamentos} />
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="budget-search-title">Pesquisar orçamentos</h3>
              <button
                className="icon"
                onClick={fecharPesquisaOrcamentos}
                aria-label="Fechar pesquisa de orçamentos"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <section className="budget-search-panel">
                <div className="budget-search-header">
                  <h4>Consulta rápida</h4>
                  <p>Localize propostas salvas pelo cliente, ID do cliente, CPF, unidade consumidora ou código do orçamento.</p>
                </div>
                <Field
                  label={labelWithTooltip(
                    'Buscar orçamentos',
                    'Filtra propostas salvas por nome do cliente, documento, UC ou código interno.',
                  )}
                  hint="Procure pelo cliente, ID do cliente, CPF, unidade consumidora ou código do orçamento."
                >
                  <input
                    id="budget-search-input"
                    type="search"
                    value={orcamentoSearchTerm}
                    onChange={(e) => setOrcamentoSearchTerm(e.target.value)}
                    placeholder="Ex.: ABC12, 123.456.789-00 ou SLRINVST-00001234"
                    autoFocus
                  />
                </Field>
                <div className="budget-search-summary">
                  <span>
                    {totalOrcamentos === 0
                      ? 'Nenhum orçamento salvo até o momento.'
                      : `${totalResultados} de ${totalOrcamentos} orçamento(s) exibidos.`}
                  </span>
                  {orcamentoSearchTerm ? (
                    <button type="button" className="link" onClick={() => setOrcamentoSearchTerm('')}>
                      Limpar busca
                    </button>
                  ) : null}
                </div>
              </section>
              <section className="budget-search-panel">
                <div className="budget-search-header">
                  <h4>Registros salvos</h4>
                </div>
                {totalOrcamentos === 0 ? (
                  <p className="budget-search-empty">
                    Nenhum orçamento foi salvo ainda. Gere uma proposta para começar.
                  </p>
                ) : totalResultados === 0 ? (
                  <p className="budget-search-empty">
                    Nenhum orçamento encontrado para "<strong>{orcamentoSearchTerm}</strong>".
                  </p>
                ) : (
                  <div className="budget-search-table">
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Cliente</th>
                            <th>Documento</th>
                            <th>Unidade consumidora</th>
                            <th>Criado em</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orcamentosFiltrados.map((registro) => {
                            const documento =
                              registro.clienteDocumento?.trim() ||
                              registro.dados.cliente.documento?.trim() ||
                              ''
                            const unidadeConsumidora =
                              registro.clienteUc?.trim() || registro.dados.cliente.uc?.trim() || ''
                            const cidade =
                              registro.clienteCidade?.trim() || registro.dados.cliente.cidade?.trim() || ''
                            const uf = registro.clienteUf?.trim() || registro.dados.cliente.uf?.trim() || ''
                            const nomeCliente =
                              registro.clienteNome?.trim() ||
                              registro.dados.cliente.nome?.trim() ||
                              registro.id
                            const cidadeUf = [cidade, uf].filter(Boolean).join(' / ')
                            return (
                              <tr key={registro.id}>
                                <td>{registro.id}</td>
                                <td>
                                  <div className="budget-search-client">
                                    <strong>{nomeCliente}</strong>
                                    {cidadeUf ? <span>{cidadeUf}</span> : null}
                                  </div>
                                </td>
                                <td>{documento || null}</td>
                                <td>{unidadeConsumidora || null}</td>
                                <td>{formatBudgetDate(registro.criadoEm)}</td>
                                <td>
                                  <div className="budget-search-actions">
                                    <button
                                      type="button"
                                      className="budget-search-action"
                                      onClick={() => abrirOrcamentoSalvo(registro, 'preview')}
                                      aria-label="Visualizar orçamento salvo"
                                      title="Visualizar orçamento"
                                    >
                                      👁
                                    </button>
                                    <button
                                      type="button"
                                      className="budget-search-action"
                                      onClick={() => abrirOrcamentoSalvo(registro, 'download')}
                                      aria-label="Baixar orçamento em PDF"
                                      title="Baixar PDF"
                                    >
                                      ⤓
                                    </button>
                                    <button
                                      type="button"
                                      className="budget-search-action danger"
                                      onClick={() => confirmarRemocaoOrcamento(registro)}
                                      aria-label="Excluir orçamento salvo"
                                      title="Excluir orçamento salvo"
                                    >
                                      🗑
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)} />
          <div className="modal-content">
            <div className="modal-header">
              <h3>Configurações</h3>
              <button className="icon" onClick={() => setIsSettingsOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="config-page">
                <div className="cfg-tabs" role="tablist" aria-label="Seções de Configuração">
                  {SETTINGS_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`cfg-tab-${tab.id}`}
                      aria-selected={settingsTab === tab.id}
                      aria-controls={`settings-panel-${tab.id}`}
                      className={`cfg-tab${settingsTab === tab.id ? ' is-active' : ''}`}
                      onClick={() => setSettingsTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="config-panels">
                  <section
                    id="settings-panel-mercado"
                    role="tabpanel"
                    aria-labelledby="cfg-tab-mercado"
                    className={`settings-panel config-card${settingsTab === 'mercado' ? ' active' : ''}`}
                    hidden={settingsTab !== 'mercado'}
                    aria-hidden={settingsTab !== 'mercado'}
                  >
                    <div className="cfg-panel-header">
                      <h2 className="cfg-section-title">Mercado & energia</h2>
                      <p className="settings-panel-description cfg-section-subtitle">
                        Ajuste as premissas macroeconômicas da projeção.
                      </p>
                    </div>
                    <div className="grid g2">
                      <Field
                        label={labelWithTooltip(
                          'Inflação energética (%)',
                          'Percentual anual de reajuste tarifário. Tarifa projetada = Tarifa base × (1 + inflação)^ano.',
                        )}
                      >
                        <input
                          type="number"
                          step="0.1"
                          value={inflacaoAa}
                          onChange={(e) => setInflacaoAa(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Preço por kWp (R$)',
                          'Preço médio de investimento por kWp. CAPEX estimado = Potência (kWp) × Preço por kWp.',
                        )}
                      >
                        <input
                          type="number"
                          value={precoPorKwp}
                          onChange={(e) => setPrecoPorKwp(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Irradiação média (kWh/m²/dia)',
                          'Valor médio diário usado na estimativa: Geração = kWp × Irradiação × Eficiência × dias.',
                        )}
                      >
                        <input
                          type="number"
                          step="0.1"
                          min={0.01}
                          value={irradiacao}
                          onChange={(e) => {
                            const parsed = Number(e.target.value)
                            setIrradiacao(Number.isFinite(parsed) && parsed > 0 ? parsed : 0)
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Eficiência do sistema',
                          'Performance ratio global (PR). Impacta diretamente a geração estimada na fórmula acima.',
                        )}
                      >
                        <input
                          type="number"
                          step="0.01"
                          min={0.01}
                          value={eficiencia}
                          onChange={(e) => {
                            if (e.target.value === '') {
                              setEficiencia(0)
                              return
                            }
                            handleEficienciaInput(Number(e.target.value))
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Dias no mês (cálculo)',
                          'Quantidade de dias considerada por mês na estimativa de geração (padrão: 30).',
                        )}
                      >
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={diasMes > 0 ? diasMes : ''}
                          onChange={(e) => {
                            const { value } = e.target
                            if (value === '') {
                              setDiasMes(0)
                              return
                            }
                            const parsed = Number(value)
                            setDiasMes(Number.isFinite(parsed) ? parsed : 0)
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                    </div>
                  </section>
                  <section
                    id="settings-panel-simulacoes"
                    role="tabpanel"
                    aria-labelledby="cfg-tab-simulacoes"
                    className={`settings-panel config-card${settingsTab === 'simulacoes' ? ' active' : ''}`}
                    hidden={settingsTab !== 'simulacoes'}
                    aria-hidden={settingsTab !== 'simulacoes'}
                  >
                    <div className="cfg-panel-header">
                      <h2 className="cfg-section-title">Simulações financeiras</h2>
                      <p className="settings-panel-description cfg-section-subtitle">
                        Monte cenários de leasing com diferentes descontos, prazos e custos para comparar KPIs lado a lado.
                      </p>
                    </div>
                    <SimulacoesTab
                      consumoKwhMes={kcKwhMes}
                      valorInvestimento={capex}
                      tipoSistema={tipoSistema}
                      prazoLeasingAnos={leasingPrazo}
                    />
                  </section>
                  <section
                    id="settings-panel-vendas"
                    role="tabpanel"
                    aria-labelledby="cfg-tab-vendas"
                    className={`settings-panel config-card${settingsTab === 'vendas' ? ' active' : ''}`}
                    hidden={settingsTab !== 'vendas'}
                    aria-hidden={settingsTab !== 'vendas'}
                  >
                    <div className="cfg-panel-header">
                      <h2 className="cfg-section-title">Parâmetros de vendas</h2>
                      <p className="settings-panel-description cfg-section-subtitle">
                        Configure custos, margens e impostos utilizados nos cálculos comerciais.
                      </p>
                    </div>
                    {renderVendasParametrosInternosSettings()}
                  </section>
                  <section
                    id="settings-panel-leasing"
                    role="tabpanel"
                    aria-labelledby="cfg-tab-leasing"
                    className={`settings-panel config-card${settingsTab === 'leasing' ? ' active' : ''}`}
                    hidden={settingsTab !== 'leasing'}
                    aria-hidden={settingsTab !== 'leasing'}
                  >
                    <div className="cfg-panel-header">
                      <h2 className="cfg-section-title">Leasing parâmetros</h2>
                      <p className="settings-panel-description cfg-section-subtitle">
                        Personalize as condições do contrato de leasing.
                      </p>
                    </div>
                    <div className="grid g3">
                      <Field
                        label={labelWithTooltip(
                          'Prazo contratual (meses)',
                          'Quantidade de meses do contrato de leasing. Utilizada no cálculo das parcelas.',
                        )}
                      >
                        <input
                          type="number"
                          min={1}
                          value={prazoMeses}
                          onChange={(e) => {
                            const parsed = Number(e.target.value)
                            setPrazoMeses(Number.isFinite(parsed) ? Math.max(0, parsed) : 0)
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Bandeira tarifária (R$)',
                          'Valor adicional por kWh conforme bandeira vigente. Aplicado às tarifas projetadas.',
                        )}
                      >
                        <input
                          type="number"
                          value={bandeiraEncargo}
                          onChange={(e) => {
                            const parsed = Number(e.target.value)
                            setBandeiraEncargo(Number.isFinite(parsed) ? parsed : 0)
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Contribuição CIP (R$)',
                          'Valor mensal da Contribuição de Iluminação Pública considerado no cenário.',
                        )}
                      >
                        <input
                          type="number"
                          value={cipEncargo}
                          onChange={(e) => {
                            const parsed = Number(e.target.value)
                            setCipEncargo(Number.isFinite(parsed) ? parsed : 0)
                          }}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Uso da entrada',
                          'Define se a entrada gera crédito mensal ou reduz o piso contratado do cliente.',
                        )}
                      >
                        <select value={entradaModo} onChange={(e) => setEntradaModo(e.target.value as EntradaModoLabel)}>
                          <option value="Crédito mensal">Crédito mensal</option>
                          <option value="Reduz piso contratado">Reduz piso contratado</option>
                        </select>
                      </Field>
                    </div>
                    <div className="info-inline">
                      <span className="pill">
                        Margem mínima: <strong>{currency(parcelasSolarInvest.margemMinima)}</strong>
                      </span>
                      <span className="pill">
                        Total pago no prazo: <strong>{currency(parcelasSolarInvest.totalPago)}</strong>
                      </span>
                    </div>
                    <div className="settings-subsection">
                      <p className="settings-subheading">Parcelas — Total pago acumulado</p>
                      <div className="table-controls">
                        <button
                          type="button"
                          className="collapse-toggle"
                          onClick={() => setMostrarTabelaParcelasConfig((prev) => !prev)}
                          aria-expanded={mostrarTabelaParcelasConfig}
                          aria-controls="config-parcelas-total"
                        >
                          {mostrarTabelaParcelasConfig ? 'Ocultar tabela de parcelas' : 'Exibir tabela de parcelas'}
                        </button>
                      </div>
                      {mostrarTabelaParcelasConfig ? (
                        <div className="table-wrapper">
                          <table id="config-parcelas-total">
                            <thead>
                              <tr>
                                <th>Mês</th>
                                <th>Total pago acumulado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {parcelasSolarInvest.lista.length > 0 ? (
                                parcelasSolarInvest.lista.map((row) => (
                                  <tr key={`config-parcela-${row.mes}`}>
                                    <td>{row.mes}</td>
                                    <td>{currency(row.totalAcumulado)}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={2} className="muted">Defina um prazo contratual para gerar a projeção das parcelas.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  </section>
                  <section
                    id="settings-panel-financiamento"
                    role="tabpanel"
                    aria-labelledby="cfg-tab-financiamento"
                    className={`settings-panel config-card${settingsTab === 'financiamento' ? ' active' : ''}`}
                    hidden={settingsTab !== 'financiamento'}
                    aria-hidden={settingsTab !== 'financiamento'}
                  >
                    <div className="cfg-panel-header">
                      <h2 className="cfg-section-title">Financiamento parâmetros</h2>
                      <p className="settings-panel-description cfg-section-subtitle">
                        Defina as variáveis financeiras do cenário financiado.
                      </p>
                    </div>
                    <div className="grid g3">
                      <Field
                        label={labelWithTooltip(
                          'Juros a.a. (%)',
                          'Taxa de juros anual utilizada no cenário financiado para comparação.',
                        )}
                      >
                        <input
                          type="number"
                          step="0.1"
                          value={jurosFinAa}
                          onChange={(e) => setJurosFinAa(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Prazo (meses)',
                          'Prazo total do financiamento comparado, em meses.',
                        )}
                      >
                        <input
                          type="number"
                          value={prazoFinMeses}
                          onChange={(e) => setPrazoFinMeses(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Entrada (%)',
                          'Percentual de entrada considerado no cenário financiado (Entrada = CAPEX × %).',
                        )}
                      >
                        <input
                          type="number"
                          step="0.1"
                          value={entradaFinPct}
                          onChange={(e) => setEntradaFinPct(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                    </div>
                  </section>
                  <section
                    id="settings-panel-buyout"
                    role="tabpanel"
                    aria-labelledby="cfg-tab-buyout"
                    className={`settings-panel config-card${settingsTab === 'buyout' ? ' active' : ''}`}
                    hidden={settingsTab !== 'buyout'}
                    aria-hidden={settingsTab !== 'buyout'}
                  >
                    <div className="cfg-panel-header">
                      <h2 className="cfg-section-title">Buyout parâmetros</h2>
                      <p className="settings-panel-description cfg-section-subtitle">
                        Configure premissas de recompra e fluxo residual.
                      </p>
                    </div>
                    <div className="grid g3">
                      <Field
                        label={labelWithTooltip(
                          'Cashback (%)',
                          'Percentual devolvido ao cliente em caso de compra antecipada.',
                        )}
                      >
                        <input
                          type="number"
                          step="0.1"
                          value={cashbackPct}
                          onChange={(e) => setCashbackPct(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Depreciação (%)',
                          'Taxa anual de depreciação dos ativos considerados no buyout.',
                        )}
                      >
                        <input
                          type="number"
                          step="0.1"
                          value={depreciacaoAa}
                          onChange={(e) => setDepreciacaoAa(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Inadimplência (%)',
                          'Percentual anual de inadimplência considerado na projeção.',
                        )}
                      >
                        <input
                          type="number"
                          step="0.1"
                          value={inadimplenciaAa}
                          onChange={(e) => setInadimplenciaAa(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Tributos (%)',
                          'Percentual de tributos incidentes sobre o fluxo financeiro do buyout.',
                        )}
                      >
                        <input
                          type="number"
                          step="0.1"
                          value={tributosAa}
                          onChange={(e) => setTributosAa(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'IPCA (%)',
                          'Inflação geral (IPCA) para atualizar valores reais ao longo do tempo.',
                        )}
                      >
                        <input
                          type="number"
                          step="0.1"
                          value={ipcaAa}
                          onChange={(e) => setIpcaAa(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Custos fixos (R$)',
                          'Custos fixos mensais associados à operação no cenário buyout.',
                        )}
                      >
                        <input
                          type="number"
                          value={custosFixosM}
                          onChange={(e) => setCustosFixosM(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'OPEX (R$)',
                          'Despesas operacionais mensais (manutenção, monitoramento etc.).',
                        )}
                      >
                        <input
                          type="number"
                          value={opexM}
                          onChange={(e) => setOpexM(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Seguro (R$)',
                          'Prêmio mensal de seguro considerado na simulação.',
                        )}
                      >
                        <input
                          type="number"
                          value={seguroM}
                          onChange={(e) => setSeguroM(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Duração (meses)',
                          'Janela de tempo analisada para o fluxo residual e compra antecipada.',
                        )}
                      >
                        <input
                          type="number"
                          value={duracaoMeses}
                          onChange={(e) => setDuracaoMeses(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                      <Field
                        label={labelWithTooltip(
                          'Pagos acumulados até o mês (R$)',
                          'Total pago acumulado considerado até o mês de avaliação.',
                        )}
                      >
                        <input
                          type="number"
                          value={pagosAcumAteM}
                          onChange={(e) => setPagosAcumAteM(Number(e.target.value) || 0)}
                          onFocus={selectNumberInputOnFocus}
                        />
                      </Field>
                    </div>
                    <div className="settings-subsection">
                      <p className="settings-subheading">Buyout — Receita acumulada</p>
                      <div className="table-controls">
                        <button
                          type="button"
                          className="collapse-toggle"
                          onClick={() => setMostrarTabelaBuyoutConfig((prev) => !prev)}
                          aria-expanded={mostrarTabelaBuyoutConfig}
                          aria-controls="config-buyout-receita"
                        >
                          {mostrarTabelaBuyoutConfig ? 'Ocultar tabela de buyout' : 'Exibir tabela de buyout'}
                        </button>
                      </div>
                      {mostrarTabelaBuyoutConfig ? (
                        <div className="table-wrapper">
                          <table id="config-buyout-receita">
                            <thead>
                              <tr>
                                <th>Mês</th>
                                <th>Receita acumulada</th>
                              </tr>
                            </thead>
                            <tbody>
                              {buyoutReceitaRows.length > 0 ? (
                                buyoutReceitaRows.map((row) => (
                                  <tr key={`config-buyout-${row.mes}`}>
                                    <td>{row.mes}</td>
                                    <td>{currency(row.prestacaoAcum)}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={2} className="muted">Defina os parâmetros para visualizar a receita acumulada.</td>
                                </tr>
                              )}
                              {buyoutAceiteFinal ? (
                                <tr>
                                  <td>{buyoutMesAceiteFinal}</td>
                                  <td>{currency(buyoutAceiteFinal.prestacaoAcum)}</td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  </section>
                  <section
                    id="settings-panel-outros"
                    role="tabpanel"
                    aria-labelledby="cfg-tab-outros"
                    className={`settings-panel config-card${settingsTab === 'outros' ? ' active' : ''}`}
                    hidden={settingsTab !== 'outros'}
                    aria-hidden={settingsTab !== 'outros'}
                  >
                    <div className="cfg-panel-header">
                      <h2 className="cfg-section-title">Outros</h2>
                      <p className="settings-panel-description cfg-section-subtitle">
                        Controles complementares de operação e apresentação.
                      </p>
                    </div>
                    <div className="settings-subsection">
                      <p className="settings-subheading">O&M e seguro</p>
                      <div className="grid g3">
                        <Field
                          label={labelWithTooltip(
                            'O&M base (R$/kWp)',
                            'Valor base de contrato de operação e manutenção por kWp instalado.',
                          )}
                        >
                          <input
                            type="number"
                            value={oemBase}
                            onChange={(e) => setOemBase(Number(e.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </Field>
                        <Field
                          label={labelWithTooltip(
                            'Reajuste O&M (%)',
                            'Percentual anual de reajuste aplicado ao contrato de O&M.',
                          )}
                        >
                          <input
                            type="number"
                            step="0.1"
                            value={oemInflacao}
                            onChange={(e) => setOemInflacao(Number(e.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </Field>
                        <Field
                          label={labelWithTooltip(
                            'Reajuste seguro (%)',
                            'Percentual anual de reajuste do prêmio de seguro.',
                          )}
                        >
                          <input
                            type="number"
                            step="0.1"
                            value={seguroReajuste}
                            onChange={(e) => setSeguroReajuste(Number(e.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </Field>
                        <Field
                          label={labelWithTooltip(
                            'Modo de seguro',
                            'Escolha entre valor fixo por kWp (Modo A) ou percentual do valor de mercado (Modo B).',
                          )}
                        >
                          <select value={seguroModo} onChange={(e) => setSeguroModo(e.target.value as SeguroModo)}>
                            <option value="A">Modo A — Potência (R$)</option>
                            <option value="B">Modo B — % Valor de mercado</option>
                          </select>
                        </Field>
                        <Field
                          label={labelWithTooltip(
                            'Base seguro modo A (R$/kWp)',
                            'Valor aplicado por kWp quando o seguro está configurado no modo A.',
                          )}
                        >
                          <input
                            type="number"
                            value={seguroValorA}
                            onChange={(e) => setSeguroValorA(Number(e.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </Field>
                        <Field
                          label={labelWithTooltip(
                            'Seguro modo B (%)',
                            'Percentual aplicado sobre o valor de mercado quando o modo B está ativo.',
                          )}
                        >
                          <input
                            type="number"
                            step="0.01"
                            value={seguroPercentualB}
                            onChange={(e) => setSeguroPercentualB(Number(e.target.value) || 0)}
                            onFocus={selectNumberInputOnFocus}
                          />
                        </Field>
                      </div>
                    </div>
                    <div className="settings-subsection">
                      <p className="settings-subheading">Exibição</p>
                      <div className="grid g2">
                        <Field
                          label={labelWithTooltip(
                            'Densidade da interface',
                            'Ajuste visual dos espaçamentos da interface (compacto, acolhedor ou confortável).',
                          )}
                        >
                          <select
                            value={density}
                            onChange={(event) => setDensity(event.target.value as DensityMode)}
                          >
                            <option value="compact">Compacto</option>
                            <option value="cozy">Acolhedor</option>
                            <option value="comfortable">Confortável</option>
                          </select>
                        </Field>
                        <Field
                          label={labelWithTooltip(
                            'Mostrar gráfico ROI',
                            'Liga ou desliga a visualização do gráfico de retorno sobre investimento.',
                          )}
                        >
                          <select value={mostrarGrafico ? '1' : '0'} onChange={(e) => setMostrarGrafico(e.target.value === '1')}>
                            <option value="1">Sim</option>
                            <option value="0">Não</option>
                          </select>
                        </Field>
                        <Field
                          label={labelWithTooltip(
                            'Mostrar coluna financiamento',
                            'Exibe ou oculta a coluna de comparação com financiamento na tela principal.',
                          )}
                        >
                          <select value={mostrarFinanciamento ? '1' : '0'} onChange={(e) => setMostrarFinanciamento(e.target.value === '1')}>
                            <option value="1">Sim</option>
                            <option value="0">Não</option>
                          </select>
                        </Field>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

        </div>
        )}
        {notificacoes.length > 0 ? (
          <div className="toast-stack" role="region" aria-live="polite" aria-label="Notificações">
            {notificacoes.map((item) => (
              <div key={item.id} className={`toast-item ${item.tipo}`} role="status">
                <span className="toast-icon" aria-hidden="true">
                  {iconeNotificacaoPorTipo[item.tipo]}
                </span>
                <span className="toast-message">{item.mensagem}</span>
                <button
                  type="button"
                  className="toast-dismiss"
                  onClick={() => removerNotificacao(item.id)}
                  aria-label="Dispensar notificação"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </AppRoutes>
    </Providers>
  )
}

