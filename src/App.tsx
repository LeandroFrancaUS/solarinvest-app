import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckboxSmall } from './components/CheckboxSmall'
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
  calcularTaxaMinima,
  tarifaDescontada as tarifaDescontadaCalc,
  tarifaProjetadaCheia,
  type EntradaModo,
} from './utils/calcs'
import { getIrradiacaoPorEstado, hasEstadoMinimo, IRRADIACAO_FALLBACK } from './utils/irradiacao'
import { getMesReajusteFromANEEL } from './utils/reajusteAneel'
import { getTarifaCheia } from './utils/tarifaAneel'
import { getDistribuidorasFallback, loadDistribuidorasAneel } from './utils/distribuidorasAneel'
import { selectNumberInputOnFocus } from './utils/focusHandlers'
import { resolveApiUrl } from './utils/apiUrl'
import {
  persistClienteRegistroToOneDrive,
  persistContratoToOneDrive,
  type ClienteRegistroSyncPayload,
  loadClientesFromOneDrive,
  loadPropostasFromOneDrive,
  isOneDriveIntegrationAvailable,
  OneDriveIntegrationMissingError,
  persistPropostasToOneDrive,
} from './utils/onedrive'
import {
  persistProposalPdf,
  isProposalPdfIntegrationAvailable,
  ProposalPdfIntegrationMissingError,
} from './utils/proposalPdf'
import type { StructuredBudget, StructuredItem } from './utils/structuredBudgetParser'
import {
  analyzeEssentialInfo,
  classifyBudgetItem,
  sumModuleQuantities,
  type EssentialInfoSummary,
} from './utils/moduleDetection'
import { removeFogOverlays, watchFogReinjection } from './utils/antiOverlay'
import {
  ensureServerStorageSync,
  fetchRemoteStorageEntry,
  persistRemoteStorageEntry,
} from './app/services/serverStorage'
import { saveFormDraft, loadFormDraft, clearFormDraft } from './lib/persist/formDraft'
import {
  saveProposalSnapshotById,
  loadProposalSnapshotById,
} from './lib/persist/proposalStore'
import {
  upsertClienteRegistro,
  getClienteRegistroById,
  getAllClienteRegistros,
  type ClienteRegistro as ClienteRegistroType,
} from './app/services/clientStore'
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
import { estimateMonthlyGenerationKWh, estimateMonthlyKWh } from './lib/energy/generation'
import { clearClientHighlights, highlightMissingFields } from './lib/ui/fieldHighlight'
import { buildRequiredFieldsLeasing } from './lib/validation/buildRequiredFieldsLeasing'
import { buildRequiredFieldsVenda } from './lib/validation/buildRequiredFieldsVenda'
import { validateRequiredFields } from './lib/validation/validateRequiredFields'
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
import { MONEY_INPUT_PLACEHOLDER, useBRNumberField } from './lib/locale/useBRNumberField'
import {
  calcPotenciaSistemaKwp,
  calcPricingPorKwp,
  formatBRL,
  getRedeByPotencia,
  type Rede,
} from './lib/pricing/pricingPorKwp'
import {
  evaluateNormCompliance,
  formatTipoLigacaoLabel,
  normalizeTipoLigacaoNorma,
  type NormComplianceResult,
  type TipoLigacaoNorma,
} from './domain/normas/padraoEntradaRules'
import {
  getAutoEligibility,
  normalizeInstallType,
  normalizeSystemType,
  type InstallType,
  type SystemType,
} from './lib/pricing/autoEligibility'
import { ensureProposalId, normalizeProposalId } from './lib/ids'
import {
  calculateCapexFromState,
  getVendaSnapshot,
  hasVendaStateChanges,
  useVendaStore,
  vendaActions,
  vendaStore,
  type ModoVenda,
  type VendaKitItem,
  type VendaSnapshot,
} from './store/useVendaStore'
import { getPotenciaModuloW, type PropostaState } from './lib/selectors/proposta'
import {
  getLeasingSnapshot,
  getInitialLeasingSnapshot,
  hasLeasingStateChanges,
  leasingActions,
  useLeasingStore,
  useLeasingValorDeMercadoEstimado,
  type LeasingContratoDados,
  type LeasingContratoProprietario,
  type LeasingEndereco,
  type LeasingState,
  type LeasingUcGeradoraTitular,
} from './store/useLeasingStore'
import { applyFieldSyncChange, fieldSyncActions, type FieldSyncKey } from './store/useFieldSyncStore'
import { DEFAULT_DENSITY, DENSITY_STORAGE_KEY, isDensityMode, type DensityMode } from './constants/ui'
import { printStyles, simplePrintStyles } from './styles/printTheme'
import {
  getPagamentoCondicaoInfo,
  getPagamentoModoInfo,
  PAGAMENTO_CONDICAO_INFO,
  PAGAMENTO_MODO_INFO,
} from './constants/pagamento'
import './styles/config-page.css'
import './styles/toast.css'
import '@/styles/fix-fog-safari.css'
import { AppRoutes } from './app/Routes'
import { AppShell } from './layout/AppShell'
import type { SidebarGroup } from './layout/Sidebar'
import { CHART_THEME } from './helpers/ChartTheme'
import { LeasingBeneficioChart } from './components/leasing/LeasingBeneficioChart'
import { SimulacoesTab } from './components/simulacoes/SimulacoesTab'
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
  CONSUMO_MINIMO_FICTICIO,
  type EntradaModoLabel,
  type KitBudgetItemState,
  type KitBudgetMissingInfo,
  type KitBudgetState,
  type LeasingPrazoAnos,
  type SeguroModo,
  type SettingsTabKey,
  type TabKey,
  type TipoRede,
  type MultiUcRowState,
  type MultiUcRateioModo,
} from './app/config'
import { buscarTarifaPorClasse } from './utils/tarifasPorClasse'
import { calcularMultiUc, type MultiUcCalculoResultado, type MultiUcCalculoUcResultado } from './utils/multiUc'
import { MULTI_UC_CLASSES, type MultiUcClasse } from './types/multiUc'
import { useVendasConfigStore, vendasConfigSelectors } from './store/useVendasConfigStore'
import { useVendasSimulacoesStore } from './store/useVendasSimulacoesStore'
import type { VendasSimulacao } from './store/useVendasSimulacoesStore'
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
  PrintableProposalImage,
  MensalidadeRow,
  PrintableMultiUcResumo,
  PrintableProposalProps,
  PrintableProposalTipo,
  PrintableUcBeneficiaria,
  PrintableUcGeradora,
  PrintableUcGeradoraTitular,
  TipoInstalacao,
  UfvComposicaoResumo,
  UfvComposicaoSoloValores,
  UfvComposicaoTelhadoValores,
  UfvComposicaoConfiguracao,
} from './types/printableProposal'
import {
  mapTipoBasicoToLabel,
  normalizeTipoBasico,
  TIPO_BASICO_OPTIONS,
} from './types/tipoBasico'
import type { VendasConfig } from './types/vendasConfig'
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
import { Switch } from './components/ui/switch'

// NOVAS OPÇÕES — A SEREM USADAS COMO FONTES DOS SELECTS
const NOVOS_TIPOS_CLIENTE = TIPO_BASICO_OPTIONS
const NOVOS_TIPOS_EDIFICACAO = NOVOS_TIPOS_CLIENTE
const NOVOS_TIPOS_TUSD = NOVOS_TIPOS_CLIENTE

const TIPOS_INSTALACAO = [
  { value: 'fibrocimento', label: 'Telhado de fibrocimento' },
  { value: 'metalico', label: 'Telhas metálicas' },
  { value: 'ceramico', label: 'Telhas cerâmicas' },
  { value: 'laje', label: 'Laje' },
  { value: 'solo', label: 'Solo' },
  { value: 'outros', label: 'Outros (texto)' },
]

const TIPOS_REDE: { value: TipoRede; label: string }[] = [
  { value: 'monofasico', label: 'Monofásico' },
  { value: 'bifasico', label: 'Bifásico' },
  { value: 'trifasico', label: 'Trifásico' },
]

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

type ActivePage = 'dashboard' | 'app' | 'crm' | 'consultar' | 'clientes' | 'settings' | 'simulacoes'
type SimulacoesSection =
  | 'nova'
  | 'salvas'
  | 'ia'
  | 'risco'
  | 'packs'
  | 'packs-inteligentes'
  | 'analise'
type AprovacaoStatus = 'pendente' | 'aprovado' | 'reprovado'
type AprovacaoChecklistKey = 'roi' | 'tir' | 'spread' | 'vpl'

const SIMULACOES_MENU: { id: SimulacoesSection; label: string; description: string }[] = [
  {
    id: 'nova',
    label: 'Nova Simulação',
    description: 'Monte um cenário do zero com premissas de consumo, tarifas e capex.',
  },
  {
    id: 'salvas',
    label: 'Simulações Salvas',
    description: 'Acesse e compare simulações gravadas sem voltar para Preferências.',
  },
  {
    id: 'ia',
    label: 'Análises IA (AI Analytics)',
    description: 'Insights automáticos sobre KPIs, alavancagem e oportunidades.',
  },
  {
    id: 'risco',
    label: 'Risco & Monte Carlo',
    description: 'Cenários de risco e volatilidade com distribuição full-width.',
  },
  {
    id: 'packs',
    label: 'Packs',
    description: 'Agrupe propostas e combos comerciais para reutilizar.',
  },
  {
    id: 'packs-inteligentes',
    label: 'Packs Inteligentes',
    description: 'Automatize packs com IA e premissas dinâmicas.',
  },
  {
    id: 'analise',
    label: 'Análise Financeira & Aprovação',
    description: 'Checklist interno para aprovar, reprovar ou salvar decisões.',
  },
]

const SIMULACOES_SECTION_COPY: Record<SimulacoesSection, string> = {
  nova: 'Abra novas simulações em layout de tela cheia e compare resultados lado a lado.',
  salvas: 'Revise simulações existentes sem sair do módulo dedicado.',
  ia: 'Centralize análises assistidas por IA e recomendações automáticas.',
  risco: 'Use Monte Carlo e cenários de risco com gráficos em largura total.',
  packs: 'Organize pacotes comerciais para acelerar a operação.',
  'packs-inteligentes': 'Combine inteligência artificial e packs dinâmicos.',
  analise: 'Aplique regras SolarInvest, checklist interno e selo de aprovação.',
}

const APROVACAO_SELLOS: Record<AprovacaoStatus, string> = {
  pendente: 'Decisão pendente',
  aprovado: 'Aprovado SolarInvest',
  reprovado: 'Reprovado SolarInvest',
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

const normalizeSegmentoClienteValue = (value: unknown): SegmentoCliente | undefined => {
  if (typeof value === 'string' || value == null) {
    return normalizeTipoBasico(value as string | null)
  }

  return undefined
}

function normalizeTipoInstalacao(value?: string | null): TipoInstalacao {
  if (!value) return 'fibrocimento'
  const v = value.toLowerCase()

  if (v === 'fibrocimento') return 'fibrocimento'
  if (v === 'metalico' || v === 'metálico') return 'metalico'
  if (v === 'ceramico' || v === 'cerâmico') return 'ceramico'
  if (v === 'laje') return 'laje'
  if (v === 'solo') return 'solo'

  return 'outros'
}

function mapTipoToLabel(value: string, lista: { value: string; label: string }[]): string {
  const item = lista.find((el) => el.value === value)
  return item ? item.label : 'Outros (texto)'
}

const formatLeasingPrazoAnos = (valor: number) => {
  const fractionDigits = Number.isInteger(valor) ? 0 : 1
  return formatNumberBRWithOptions(valor, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

// --- DESATIVADO NA FASE 3 ---
// const TUSD_TIPO_OPTIONS: TipoClienteTUSD[] = [
//   'residencial',
//   'comercial',
//   'cond_vertical',
//   'cond_horizontal',
//   'industrial',
//   'outros',
// ] as unknown as TipoClienteTUSD[]
// const TUSD_TIPO_LABELS: Record<TipoClienteTUSD, string> = {
//   residencial: 'Residencial',
//   comercial: 'Comercial',
//   cond_vertical: 'Cond. Vertical',
//   cond_horizontal: 'Cond. Horizontal',
//   industrial: 'Industrial',
//   outros: 'Outros',
// } as Record<TipoClienteTUSD, string>
// --- FIM BLOCO DESATIVADO ---

const TUSD_TIPO_OPTIONS = NOVOS_TIPOS_TUSD.map(({ value }) => value as TipoClienteTUSD)
const TUSD_TIPO_LABELS = NOVOS_TIPOS_TUSD.reduce(
  (acc, { value, label }) => ({ ...acc, [value as TipoClienteTUSD]: label }),
  {} as Record<TipoClienteTUSD, string>,
)

const TUSD_TO_SEGMENTO: Record<TipoClienteTUSD, SegmentoCliente> = {
  residencial: 'residencial' as SegmentoCliente,
  comercial: 'comercial' as SegmentoCliente,
  cond_vertical: 'cond_vertical' as SegmentoCliente,
  cond_horizontal: 'cond_horizontal' as SegmentoCliente,
  industrial: 'industrial' as SegmentoCliente,
  outros: 'outros' as SegmentoCliente,
} as Record<TipoClienteTUSD, SegmentoCliente>

const SEGMENTO_TO_TUSD: Record<SegmentoCliente, TipoClienteTUSD> = {
  residencial: 'residencial' as TipoClienteTUSD,
  comercial: 'comercial' as TipoClienteTUSD,
  cond_vertical: 'cond_vertical' as TipoClienteTUSD,
  cond_horizontal: 'cond_horizontal' as TipoClienteTUSD,
  industrial: 'industrial' as TipoClienteTUSD,
  outros: 'outros' as TipoClienteTUSD,
} as Record<SegmentoCliente, TipoClienteTUSD>

// --- DESATIVADO NA FASE 3 ---
// const SEGMENTO_OPTIONS: SegmentoCliente[] = [
//   'residencial',
//   'comercial',
//   'cond_vertical',
//   'cond_horizontal',
//   'industrial',
//   'outros',
// ] as unknown as SegmentoCliente[]

// const SEGMENTO_LABELS: Record<SegmentoCliente, string> = {
//   residencial: 'Residencial',
//   comercial: 'Comercial',
//   cond_vertical: 'Cond. Vertical',
//   cond_horizontal: 'Cond. Horizontal',
//   industrial: 'Industrial',
//   outros: 'Outros',
// } as Record<SegmentoCliente, string>
// --- FIM BLOCO DESATIVADO ---

const SEGMENTO_OPTIONS = NOVOS_TIPOS_EDIFICACAO.map(({ value }) => value as SegmentoCliente)
const SEGMENTO_LABELS = NOVOS_TIPOS_EDIFICACAO.reduce(
  (acc, { value, label }) => ({ ...acc, [value as SegmentoCliente]: label }),
  {} as Record<SegmentoCliente, string>,
)
const isSegmentoCondominio = (segmento: SegmentoCliente) =>
  segmento === 'cond_vertical' || segmento === 'cond_horizontal'

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
  propostaSnapshot?: OrcamentoSnapshotData
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

type OrcamentoSnapshotBudgetState = {
  isProcessing: boolean
  error: string | null
  progress: BudgetUploadProgress | null
  isTableCollapsed: boolean
  ocrDpi: number
}

type OrcamentoSnapshotMultiUcState = {
  ativo: boolean
  rows: MultiUcRowState[]
  rateioModo: MultiUcRateioModo
  energiaGeradaKWh: number
  energiaGeradaTouched: boolean
  anoVigencia: number
  overrideEscalonamento: boolean
  escalonamentoCustomPercent: number | null
}

type OrcamentoSnapshotData = {
  activeTab: TabKey
  settingsTab: SettingsTabKey
  cliente: ClienteDados
  clienteEmEdicaoId: string | null
  clienteMensagens?: ClienteMensagens | undefined
  ucBeneficiarias: UcBeneficiariaFormState[]
  pageShared: PageSharedSettings
  currentBudgetId: string
  budgetStructuredItems: StructuredItem[]
  kitBudget: KitBudgetState
  budgetProcessing: OrcamentoSnapshotBudgetState
  propostaImagens: PrintableProposalImage[]
  ufTarifa: string
  distribuidoraTarifa: string
  ufsDisponiveis: string[]
  distribuidorasPorUf: Record<string, string[]>
  mesReajuste: number
  kcKwhMes: number
  consumoManual: boolean
  tarifaCheia: number
  desconto: number
  taxaMinima: number
  taxaMinimaInputEmpty: boolean
  encargosFixosExtras: number
  tusdPercent: number
  tusdTipoCliente: TipoClienteTUSD
  tusdSubtipo: string
  tusdSimultaneidade: number | null
  tusdTarifaRkwh: number | null
  tusdAnoReferencia: number
  tusdOpcoesExpandidas: boolean
  leasingPrazo: LeasingPrazoAnos
  potenciaModulo: number
  potenciaModuloDirty: boolean
  tipoInstalacao: TipoInstalacao
  tipoInstalacaoOutro: string
  tipoInstalacaoDirty: boolean
  tipoSistema: TipoSistema
  segmentoCliente: SegmentoCliente
  tipoEdificacaoOutro: string
  numeroModulosManual: number | ''
  configuracaoUsinaObservacoes: string
  composicaoTelhado: UfvComposicaoTelhadoValores
  composicaoSolo: UfvComposicaoSoloValores
  aprovadoresText: string
  impostosOverridesDraft: Partial<ImpostosRegimeConfig>
  vendasConfig: VendasConfig
  vendasSimulacoes: Record<string, VendasSimulacao>
  multiUc: OrcamentoSnapshotMultiUcState
  precoPorKwp: number
  irradiacao: number
  eficiencia: number
  diasMes: number
  inflacaoAa: number
  vendaForm: VendaForm
  capexManualOverride: boolean
  parsedVendaPdf: ParsedVendaPdfData | null
  estruturaTipoWarning: EstruturaUtilizadaTipoWarning | null
  jurosFinAa: number
  prazoFinMeses: number
  entradaFinPct: number
  mostrarFinanciamento: boolean
  mostrarGrafico: boolean
  prazoMeses: number
  bandeiraEncargo: number
  cipEncargo: number
  entradaRs: number
  entradaModo: EntradaModoLabel
  mostrarValorMercadoLeasing: boolean
  mostrarTabelaParcelas: boolean
  mostrarTabelaBuyout: boolean
  mostrarTabelaParcelasConfig: boolean
  mostrarTabelaBuyoutConfig: boolean
  oemBase: number
  oemInflacao: number
  seguroModo: SeguroModo
  seguroReajuste: number
  seguroValorA: number
  seguroPercentualB: number
  exibirLeasingLinha: boolean
  exibirFinLinha: boolean
  cashbackPct: number
  depreciacaoAa: number
  inadimplenciaAa: number
  tributosAa: number
  ipcaAa: number
  custosFixosM: number
  opexM: number
  seguroM: number
  duracaoMeses: number
  pagosAcumAteM: number
  modoOrcamento: 'auto' | 'manual'
  autoKitValor: number | null
  autoCustoFinal: number | null
  autoPricingRede: Rede | null
  autoPricingVersion: string | null
  autoBudgetReason: string | null
  autoBudgetReasonCode: string | null
  tipoRede: TipoRede
  tipoRedeControle: 'auto' | 'manual'
  leasingAnexosSelecionados: LeasingAnexoId[]
  vendaSnapshot: VendaSnapshot
  leasingSnapshot: LeasingState
}

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
  snapshot?: OrcamentoSnapshotData | undefined
}

type UcBeneficiariaFormState = {
  id: string
  numero: string
  endereco: string
  consumoKWh: string
  rateioPercentual: string
}

type UcGeradoraTitularErrors = {
  nomeCompleto?: string
  cpf?: string
  rg?: string
  logradouro?: string
  cidade?: string
  uf?: string
  cep?: string
}

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
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// SolarInvest company information for contracts
const CLIENTE_INICIAL: ClienteDados = {
  nome: '',
  documento: '',
  rg: '',
  estadoCivil: '',
  nacionalidade: '',
  profissao: '',
  representanteLegal: '',
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
  herdeiros: [''],
  nomeSindico: '',
  cpfSindico: '',
  contatoSindico: '',
  diaVencimento: '10',
}

const isSyncedClienteField = (key: keyof ClienteDados): key is FieldSyncKey =>
  key === 'uf' || key === 'cidade' || key === 'distribuidora' || key === 'cep' || key === 'endereco'

const getDistribuidoraDefaultForUf = (uf?: string | null): string => {
  const normalized = uf?.trim().toUpperCase() ?? ''
  if (normalized === 'GO') {
    return 'Equatorial Goiás'
  }
  if (normalized === 'DF') {
    return 'Neoenergia Brasília'
  }
  return ''
}

const getDistribuidoraValidationMessage = (
  ufRaw?: string | null,
  distribuidoraRaw?: string | null,
): string | null => {
  const uf = ufRaw?.trim().toUpperCase() ?? ''
  const distribuidora = distribuidoraRaw?.trim() ?? ''
  const expected = getDistribuidoraDefaultForUf(uf)

  if (!uf && distribuidora) {
    return 'Informe a UF antes de definir a distribuidora.'
  }

  if (expected) {
    if (!distribuidora) {
      return `Informe a distribuidora para a UF ${uf}. Sugestão: ${expected}.`
    }
    if (distribuidora !== expected) {
      return `Distribuidora incompatível com a UF ${uf}. Use ${expected}.`
    }
    return null
  }

  if (uf && !distribuidora) {
    return 'Informe a distribuidora para a UF selecionada.'
  }

  return null
}

const resolveUfForDistribuidora = (
  distribuidorasPorUf: Record<string, string[]>,
  distribuidora?: string | null,
): string => {
  const alvo = distribuidora?.trim()
  if (!alvo) {
    return ''
  }
  const alvoNormalizado = alvo.toLowerCase()
  for (const [uf, distribuidoras] of Object.entries(distribuidorasPorUf)) {
    if (distribuidoras.some((item) => item.toLowerCase() === alvoNormalizado)) {
      return uf
    }
  }
  return ''
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

const createUcBeneficiariaId = () => `UCB-${Math.random().toString(36).slice(2, 10).toUpperCase()}`

const createEmptyUcBeneficiaria = (): UcBeneficiariaFormState => ({
  id: createUcBeneficiariaId(),
  numero: '',
  endereco: '',
  consumoKWh: '',
  rateioPercentual: '',
})

const createEmptyUcGeradoraTitularEndereco = (): LeasingEndereco => ({
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  cep: '',
})

const createEmptyUcGeradoraTitular = (): LeasingUcGeradoraTitular => ({
  nomeCompleto: '',
  cpf: '',
  rg: '',
  endereco: createEmptyUcGeradoraTitularEndereco(),
})

const cloneUcGeradoraTitular = (
  input: LeasingUcGeradoraTitular,
): LeasingUcGeradoraTitular => ({
  ...input,
  endereco: { ...input.endereco },
})

const formatUcGeradoraTitularEndereco = (
  endereco?: LeasingEndereco | null,
): string => {
  if (!endereco) {
    return ''
  }
  const logradouro = endereco.logradouro?.trim() ?? ''
  const numero = endereco.numero?.trim() ?? ''
  const complemento = endereco.complemento?.trim() ?? ''
  const bairro = endereco.bairro?.trim() ?? ''
  const cidade = endereco.cidade?.trim() ?? ''
  const uf = endereco.uf?.trim() ?? ''
  const cep = endereco.cep?.trim() ?? ''
  const primeiraLinha = [logradouro, numero].filter(Boolean).join(', ')
  const primeiraLinhaCompleta =
    complemento && primeiraLinha ? `${primeiraLinha}, ${complemento}` : primeiraLinha || complemento
  const partes = [
    primeiraLinhaCompleta,
    bairro || '',
    [cidade, uf].filter(Boolean).join('/'),
    cep ? `CEP ${cep}` : '',
  ].filter(Boolean)
  return partes.join(' — ')
}

type DistribuidoraAneelState = {
  clienteDistribuidoraAneel?: string | null
  clienteUf?: string | null
  titularUcGeradoraDistribuidoraAneel?: string | null
  titularUcGeradoraDiferente?: boolean
}

const getDistribuidoraAneelEfetiva = (state: DistribuidoraAneelState): string => {
  const isTitularDiferente = Boolean(state.titularUcGeradoraDiferente)
  if (isTitularDiferente) {
    return state.titularUcGeradoraDistribuidoraAneel?.trim() ?? ''
  }
  const clienteDistribuidora = state.clienteDistribuidoraAneel?.trim() ?? ''
  if (clienteDistribuidora) {
    return clienteDistribuidora
  }
  const uf = state.clienteUf?.trim().toUpperCase() ?? ''
  if (uf === 'GO') {
    return 'Equatorial Goiás'
  }
  if (uf === 'DF') {
    return 'Neoenergia Brasília'
  }
  return ''
}

type ProcuracaoTags = {
  procuracaoNome: string
  procuracaoCPF: string
  procuracaoRG: string
  procuracaoEndereco: string
}

const normalizeCepForProcuracao = (cep?: string | null): string => {
  const digits = (cep ?? '').replace(/\D/g, '')
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`
  }
  return digits
}

const formatEndereco = (endereco?: Partial<LeasingEndereco> | null): string => {
  if (!endereco) {
    return ''
  }
  const logradouro = endereco.logradouro?.trim() ?? ''
  const numero = endereco.numero?.trim() ?? ''
  const complemento = endereco.complemento?.trim() ?? ''
  const bairro = endereco.bairro?.trim() ?? ''
  const cidade = endereco.cidade?.trim() ?? ''
  const uf = endereco.uf?.trim().toUpperCase() ?? ''
  const cep = normalizeCepForProcuracao(endereco.cep)

  const primeiraParteBase = [logradouro, numero].filter(Boolean).join(', ')
  const primeiraParte = complemento && primeiraParteBase
    ? `${primeiraParteBase}, ${complemento}`
    : primeiraParteBase || complemento

  const cidadeUf = [cidade, uf].filter(Boolean).join('/')

  const partes = [
    primeiraParte,
    bairro,
    cidadeUf,
    cep ? `CEP ${cep}` : '',
  ].filter(Boolean)

  return partes.join(' - ')
}

const buildProcuracaoTags = ({
  cliente,
  leasingContrato,
}: {
  cliente: ClienteDados
  leasingContrato: LeasingContratoDados
}): ProcuracaoTags => {
  const titularDiferente = Boolean(leasingContrato.ucGeradoraTitularDiferente)

  if (titularDiferente) {
    const titular = leasingContrato.ucGeradoraTitular
    const endereco = titular?.endereco
    const camposObrigatorios = [
      titular?.nomeCompleto?.trim(),
      titular?.cpf?.trim(),
      titular?.rg?.trim(),
      endereco?.logradouro?.trim(),
      endereco?.cidade?.trim(),
      endereco?.uf?.trim(),
      endereco?.cep?.trim(),
    ]
    if (camposObrigatorios.some((campo) => !campo)) {
      throw new Error(
        'Preencha os dados do titular diferente da UC geradora para gerar a procuração.',
      )
    }

    return {
      procuracaoNome: titular?.nomeCompleto?.trim() ?? '',
      procuracaoCPF: formatCpfCnpj(titular?.cpf ?? ''),
      procuracaoRG: titular?.rg?.trim() ?? '',
      procuracaoEndereco: formatEndereco(endereco),
    }
  }

  return {
    procuracaoNome: cliente.nome?.trim() ?? '',
    procuracaoCPF: formatCpfCnpj(cliente.documento ?? ''),
    procuracaoRG: cliente.rg?.trim() ?? '',
    procuracaoEndereco: formatEndereco({
      logradouro: cliente.endereco ?? '',
      cidade: cliente.cidade ?? '',
      uf: cliente.uf ?? '',
      cep: cliente.cep ?? '',
    }),
  }
}

const normalizeUfForProcuracao = (value?: string | null): string => {
  const raw = value?.trim() ?? ''
  if (!raw) {
    return ''
  }
  const upper = raw.toUpperCase()
  const withoutDiacritics = upper.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (withoutDiacritics === 'BRASILIA') {
    return 'DF'
  }
  return upper
}

const isProcuracaoUfSupported = (value?: string | null): boolean => {
  const normalized = normalizeUfForProcuracao(value)
  return normalized === 'DF' || normalized === 'GO'
}

const isQuotaExceededError = (error: unknown) => {
  if (!error) {
    return false
  }

  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014
    )
  }

  if (error instanceof Error) {
    return /quota|storage/i.test(error.message)
  }

  return false
}

const persistBudgetsToLocalStorage = (
  registros: OrcamentoSalvo[],
): { persisted: OrcamentoSalvo[]; pruned: OrcamentoSalvo[] } => {
  if (typeof window === 'undefined') {
    return { persisted: registros, pruned: [] }
  }

  if (registros.length === 0) {
    window.localStorage.removeItem(BUDGETS_STORAGE_KEY)
    return { persisted: [], pruned: [] }
  }

  const working = [...registros]
  const pruned: OrcamentoSalvo[] = []
  let lastError: unknown = null

  while (working.length > 0) {
    try {
      window.localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(working))
      return { persisted: working, pruned }
    } catch (error) {
      lastError = error
      if (!isQuotaExceededError(error)) {
        throw error
      }

      const removed = working.pop()
      if (!removed) {
        break
      }
      pruned.push(removed)
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('Falha ao salvar orçamentos no armazenamento local.')
}

const alertPrunedBudgets = (pruned: OrcamentoSalvo[]) => {
  if (typeof window === 'undefined' || pruned.length === 0) {
    return
  }

  const mensagem =
    pruned.length === 1
      ? 'O armazenamento local estava cheio. O orçamento mais antigo foi removido para salvar a versão atual.'
      : `O armazenamento local estava cheio. ${pruned.length} orçamentos antigos foram removidos para salvar a versão atual.`

  window.alert(mensagem)
}

const createPrintableImageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `imagem-${crypto.randomUUID()}`
  }

  const aleatorio = Math.floor(Math.random() * 1_000_000)
  return `imagem-${Date.now()}-${aleatorio.toString().padStart(6, '0')}`
}

const loadImageDimensions = (src: string): Promise<{ width: number | null; height: number | null }> =>
  new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({ width: null, height: null })
      return
    }

    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      resolve({ width: null, height: null })
    }
    img.src = src
  })

const readPrintableImageFromFile = (file: File): Promise<PrintableProposalImage | null> => {
  if (typeof FileReader === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const result = reader.result
      if (typeof result !== 'string') {
        resolve(null)
        return
      }

      const dimensions = await loadImageDimensions(result)
      resolve({
        id: createPrintableImageId(),
        url: result,
        fileName: file.name || null,
        width: dimensions.width,
        height: dimensions.height,
      })
    }
    reader.onerror = () => resolve(null)
    reader.onabort = () => resolve(null)
    try {
      reader.readAsDataURL(file)
    } catch (error) {
      resolve(null)
    }
  })
}

const readBlobAsBase64 = (blob: Blob): Promise<string> => {
  if (typeof FileReader === 'undefined') {
    return Promise.reject(new Error('FileReader indisponível para converter o arquivo.'))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Falha ao converter o arquivo para base64.'))
        return
      }
      const [, base64] = result.split(',')
      if (!base64) {
        reject(new Error('Falha ao extrair conteúdo base64 do arquivo.'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
    reader.onabort = () => reject(new Error('Leitura do arquivo interrompida.'))
    reader.readAsDataURL(blob)
  })
}

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

const TARIFA_INPUT_DECIMALS = 5
const TARIFA_DISPLAY_DECIMALS = 2
const TARIFA_INPUT_SCALE = 10 ** TARIFA_INPUT_DECIMALS
const TARIFA_MAX_VALUE = 9 + (TARIFA_INPUT_SCALE - 1) / TARIFA_INPUT_SCALE

const roundTarifaUp = (value: number): number => {
  const scale = 10 ** TARIFA_DISPLAY_DECIMALS
  return Math.ceil(value * scale) / scale
}

const normalizeTarifaDigits = (digits: string): string =>
  digits.replace(/\D/g, '').slice(0, TARIFA_INPUT_DECIMALS + 1)

const formatTarifaDigitsFromValue = (value: number | null | undefined): string => {
  if (!Number.isFinite(value ?? NaN)) {
    return ''
  }

  const capped = Math.min(TARIFA_MAX_VALUE, Math.max(0, Number(value)))
  const fixed = capped.toFixed(TARIFA_INPUT_DECIMALS)
  const trimmed = fixed.replace(/\.?0+$/, '')
  const [integerPart, decimalPart = ''] = trimmed.split('.')
  const digits = `${integerPart}${decimalPart}`
  return normalizeTarifaDigits(digits)
}

const formatTarifaMaskedFromDigits = (digits: string): string => {
  const safeDigits = normalizeTarifaDigits(digits)
  if (!safeDigits) {
    return ''
  }

  const integerPart = safeDigits.slice(0, 1)
  const decimalPart = safeDigits.slice(1)
  return `${integerPart},${decimalPart}`
}

const parseTarifaInputValue = (raw: string): { value: number; text: string } => {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { value: 0, text: '' }
  }

  const digits = normalizeTarifaDigits(trimmed)
  if (!digits) {
    return { value: 0, text: '' }
  }

  const integerPart = Number(digits.slice(0, 1))
  const decimalDigits = digits.slice(1)
  const decimalScale = decimalDigits.length > 0 ? 10 ** decimalDigits.length : 1
  const decimalValue = decimalDigits.length > 0 ? Number(decimalDigits) / decimalScale : 0
  const numericValue = integerPart + decimalValue
  return {
    value: roundTarifaUp(Math.min(TARIFA_MAX_VALUE, Math.max(0, numericValue))),
    text: formatTarifaMaskedFromDigits(digits),
  }
}

const formatTarifaDisplayValue = (value: number | null | undefined): string => {
  if (!Number.isFinite(value ?? NaN)) {
    return ''
  }

  const capped = Math.min(TARIFA_MAX_VALUE, Math.max(0, Number(value)))
  const rounded = roundTarifaUp(capped)
  const displayValue = Math.min(9.99, rounded)
  return formatNumberBRWithOptions(displayValue, {
    minimumFractionDigits: TARIFA_DISPLAY_DECIMALS,
    maximumFractionDigits: TARIFA_DISPLAY_DECIMALS,
  })
}

const useTarifaInputField = (
  value: number | null | undefined,
  onValueChange: (next: number) => void,
) => {
  const [text, setText] = useState<string>(() => formatTarifaDisplayValue(value))
  const [isEditing, setIsEditing] = useState(false)
  const latestValueRef = useRef<number>(Number.isFinite(value ?? NaN) ? Number(value) : 0)

  useEffect(() => {
    latestValueRef.current = Number.isFinite(value ?? NaN) ? Number(value) : 0
  }, [value])

  useEffect(() => {
    if (!isEditing) {
      setText(formatTarifaDisplayValue(value))
    }
  }, [isEditing, value])

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseTarifaInputValue(event.target.value)
      latestValueRef.current = parsed.value
      setText(parsed.text)
      onValueChange(parsed.value)
    },
    [onValueChange],
  )

  const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(true)
    setText('')
    window.requestAnimationFrame(() => {
      try {
        event.currentTarget.setSelectionRange(0, 0)
      } catch {
        // Ignore selection errors on unsupported input types.
      }
    })
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Backspace') {
        return
      }

      const selectionStart = event.currentTarget.selectionStart
      const selectionEnd = event.currentTarget.selectionEnd
      if (selectionStart == null || selectionEnd == null || selectionStart !== selectionEnd) {
        return
      }

      if (selectionStart !== 2 || text[1] !== ',') {
        return
      }

      event.preventDefault()
      const digits = normalizeTarifaDigits(text)
      const nextDigits = digits.slice(1)
      const nextText = formatTarifaMaskedFromDigits(nextDigits)
      const parsed = parseTarifaInputValue(nextText)
      latestValueRef.current = parsed.value
      setText(parsed.text)
      onValueChange(parsed.value)
      window.requestAnimationFrame(() => {
        try {
          event.currentTarget.setSelectionRange(1, 1)
        } catch {
          // Ignore selection errors on unsupported input types.
        }
      })
    },
    [onValueChange, text],
  )

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    setText(formatTarifaDisplayValue(latestValueRef.current))
  }, [])

  return {
    value: text,
    onChange: handleChange,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
  }
}

const clonePrintableData = (dados: PrintableProposalProps): PrintableProposalProps => {
  const clone: PrintableProposalProps = {
    ...dados,
    cliente: {
      ...dados.cliente,
      herdeiros: Array.isArray(dados.cliente.herdeiros)
        ? [...dados.cliente.herdeiros]
        : [''],
    },
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

  if (Array.isArray(dados.imagensInstalacao)) {
    clone.imagensInstalacao = dados.imagensInstalacao.map((imagem) => ({ ...imagem }))
  } else {
    delete clone.imagensInstalacao
  }

  if (dados.ucGeradora) {
    clone.ucGeradora = { ...dados.ucGeradora }
  } else {
    delete clone.ucGeradora
  }

  if (dados.ucGeradoraTitular) {
    clone.ucGeradoraTitular = { ...dados.ucGeradoraTitular }
  } else {
    delete clone.ucGeradoraTitular
  }

  if (Array.isArray(dados.ucsBeneficiarias)) {
    clone.ucsBeneficiarias = dados.ucsBeneficiarias.map((uc) => ({ ...uc }))
  } else {
    delete clone.ucsBeneficiarias
  }

  return clone
}

const cloneBudgetUploadProgress = (
  progress: BudgetUploadProgress | null,
): BudgetUploadProgress | null => (progress ? { ...progress } : null)

const cloneEssentialCategoryInfo = (info: EssentialInfoSummary['modules']) => ({
  ...info,
  missingFields: [...info.missingFields],
})

const cloneKitBudgetMissingInfo = (
  info: KitBudgetMissingInfo,
): KitBudgetMissingInfo => {
  if (!info) {
    return null
  }
  return {
    modules: cloneEssentialCategoryInfo(info.modules),
    inverter: cloneEssentialCategoryInfo(info.inverter),
  }
}

const cloneKitBudgetState = (state: KitBudgetState): KitBudgetState => ({
  ...state,
  items: state.items.map((item) => ({ ...item })),
  warnings: [...state.warnings],
  missingInfo: cloneKitBudgetMissingInfo(state.missingInfo),
})

const cloneStructuredItems = (items: StructuredItem[]): StructuredItem[] =>
  items.map((item) => ({ ...item }))

const cloneDistribuidorasMapa = (mapa: Record<string, string[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(mapa).map(([uf, lista]) => [uf, [...lista]]))

const cloneUcBeneficiariasForm = (
  lista: UcBeneficiariaFormState[],
): UcBeneficiariaFormState[] =>
  lista.map((item) => ({
    ...item,
    consumoKWh: item.consumoKWh ?? '',
  }))

const cloneVendasSimulacoes = (
  simulations: Record<string, VendasSimulacao>,
): Record<string, VendasSimulacao> =>
  Object.fromEntries(
    Object.entries(simulations).map(([id, sim]) => [id, { ...sim }]),
  )

const cloneSnapshotData = (snapshot: OrcamentoSnapshotData): OrcamentoSnapshotData => ({
  ...snapshot,
  cliente: cloneClienteDados(snapshot.cliente),
  clienteMensagens: snapshot.clienteMensagens ? { ...snapshot.clienteMensagens } : undefined,
  ucBeneficiarias: cloneUcBeneficiariasForm(snapshot.ucBeneficiarias || []),
  pageShared: { ...snapshot.pageShared },
  configuracaoUsinaObservacoes: snapshot.configuracaoUsinaObservacoes ?? '',
  propostaImagens: Array.isArray(snapshot.propostaImagens)
    ? snapshot.propostaImagens.map((imagem) => ({ ...imagem }))
    : [],
  budgetStructuredItems: cloneStructuredItems(snapshot.budgetStructuredItems),
  kitBudget: cloneKitBudgetState(snapshot.kitBudget),
  budgetProcessing: {
    ...snapshot.budgetProcessing,
    progress: cloneBudgetUploadProgress(snapshot.budgetProcessing.progress),
  },
  ufsDisponiveis: [...snapshot.ufsDisponiveis],
  distribuidorasPorUf: cloneDistribuidorasMapa(snapshot.distribuidorasPorUf),
  multiUc: {
    ...snapshot.multiUc,
    rows: snapshot.multiUc.rows.map((row) => ({ ...row })),
  },
  composicaoTelhado: { ...snapshot.composicaoTelhado },
  composicaoSolo: { ...snapshot.composicaoSolo },
  impostosOverridesDraft: cloneImpostosOverrides(snapshot.impostosOverridesDraft),
  vendasConfig: JSON.parse(JSON.stringify(snapshot.vendasConfig)) as VendasConfig,
  vendasSimulacoes: cloneVendasSimulacoes(snapshot.vendasSimulacoes),
  vendaForm: { ...snapshot.vendaForm },
  leasingAnexosSelecionados: Array.isArray(snapshot.leasingAnexosSelecionados)
    ? [...snapshot.leasingAnexosSelecionados]
    : [],
  parsedVendaPdf: snapshot.parsedVendaPdf
    ? (JSON.parse(JSON.stringify(snapshot.parsedVendaPdf)) as ParsedVendaPdfData)
    : null,
  estruturaTipoWarning: snapshot.estruturaTipoWarning ?? null,
  vendaSnapshot: JSON.parse(JSON.stringify(snapshot.vendaSnapshot)) as VendaSnapshot,
  leasingSnapshot: JSON.parse(JSON.stringify(snapshot.leasingSnapshot)) as LeasingState,
})

const computeSnapshotSignature = (
  snapshot: OrcamentoSnapshotData,
  dados: PrintableProposalProps,
): string =>
  stableStringify({
    snapshot: cloneSnapshotData(snapshot),
    dados: clonePrintableData(dados),
  })

const cloneOrcamentoSalvo = (registro: OrcamentoSalvo): OrcamentoSalvo => ({
  ...registro,
  dados: clonePrintableData(registro.dados),
  snapshot: registro.snapshot ? cloneSnapshotData(registro.snapshot) : undefined,
})

const createBudgetFingerprint = (dados: PrintableProposalProps): string => {
  const clone = clonePrintableData(dados)
  delete clone.budgetId
  return stableStringify(clone)
}

const ensureClienteHerdeiros = (valor: unknown): string[] => {
  if (Array.isArray(valor)) {
    if (valor.length === 0) {
      return ['']
    }

    return valor.map((item) => (typeof item === 'string' ? item : ''))
  }

  return ['']
}

const normalizeClienteHerdeiros = (valor: unknown): string[] => {
  if (Array.isArray(valor)) {
    const normalizados = valor.map((item) =>
      typeof item === 'string' ? item.trim() : '',
    )

    return normalizados.length > 0 ? normalizados : ['']
  }

  if (typeof valor === 'string') {
    const trimmed = valor.trim()
    return trimmed ? [trimmed] : ['']
  }

  return ['']
}

const cloneClienteDados = (dados: ClienteDados): ClienteDados => ({
  ...CLIENTE_INICIAL,
  ...dados,
  herdeiros: ensureClienteHerdeiros(dados.herdeiros),
})

const CLIENTES_CSV_DELIMITER = ';'
const CLIENTES_CSV_HEADERS: { key: string; label: string }[] = [
  { key: 'id', label: 'id' },
  { key: 'criadoEm', label: 'criado_em' },
  { key: 'atualizadoEm', label: 'atualizado_em' },
  { key: 'nome', label: 'nome' },
  { key: 'documento', label: 'documento' },
  { key: 'rg', label: 'rg' },
  { key: 'estadoCivil', label: 'estado_civil' },
  { key: 'nacionalidade', label: 'nacionalidade' },
  { key: 'profissao', label: 'profissao' },
  { key: 'representanteLegal', label: 'representante_legal' },
  { key: 'email', label: 'email' },
  { key: 'telefone', label: 'telefone' },
  { key: 'cep', label: 'cep' },
  { key: 'distribuidora', label: 'distribuidora' },
  { key: 'uc', label: 'uc' },
  { key: 'endereco', label: 'endereco' },
  { key: 'cidade', label: 'cidade' },
  { key: 'uf', label: 'uf' },
  { key: 'temIndicacao', label: 'tem_indicacao' },
  { key: 'indicacaoNome', label: 'indicacao_nome' },
  { key: 'nomeSindico', label: 'nome_sindico' },
  { key: 'cpfSindico', label: 'cpf_sindico' },
  { key: 'contatoSindico', label: 'contato_sindico' },
  { key: 'diaVencimento', label: 'dia_vencimento' },
  { key: 'herdeiros', label: 'herdeiros' },
  { key: 'propostaSnapshot', label: 'proposta_snapshot' },
]

const CSV_HEADER_KEY_MAP: Record<string, string> = {
  id: 'id',
  clienteid: 'id',
  criadoem: 'criadoEm',
  criadoemiso: 'criadoEm',
  createdat: 'criadoEm',
  atualizadoem: 'atualizadoEm',
  atualizadoemiso: 'atualizadoEm',
  updatedat: 'atualizadoEm',
  nome: 'nome',
  cliente: 'nome',
  razaosocial: 'nome',
  document: 'documento',
  documento: 'documento',
  cpfcnpj: 'documento',
  cpf_cnpj: 'documento',
  rg: 'rg',
  estadocivil: 'estadoCivil',
  nacionalidade: 'nacionalidade',
  profissao: 'profissao',
  representantelegal: 'representanteLegal',
  email: 'email',
  telefone: 'telefone',
  celular: 'telefone',
  cep: 'cep',
  distribuidora: 'distribuidora',
  uc: 'uc',
  unidadeconsumidora: 'uc',
  endereco: 'endereco',
  logradouro: 'endereco',
  cidade: 'cidade',
  uf: 'uf',
  temindicacao: 'temIndicacao',
  indicacaonome: 'indicacaoNome',
  nomesindico: 'nomeSindico',
  cpfsindico: 'cpfSindico',
  contatosindico: 'contatoSindico',
  diavencimento: 'diaVencimento',
  herdeiros: 'herdeiros',
  propostasnapshot: 'propostaSnapshot',
  proposta: 'propostaSnapshot',
  snapshot: 'propostaSnapshot',
}

const normalizeCsvHeader = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const parseCsvLine = (line: string, delimiter: string): string[] => {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

const countDelimiterOccurrences = (line: string, delimiter: string): number => {
  let count = 0
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && char === delimiter) {
      count += 1
    }
  }

  return count
}

const detectCsvDelimiter = (line: string): string => {
  const candidates = [CLIENTES_CSV_DELIMITER, ',', '\t']
  let best = candidates[0]
  let bestCount = -1

  for (const candidate of candidates) {
    const count = countDelimiterOccurrences(line, candidate)
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }

  return best
}

const parseBooleanCsvValue = (value: string): boolean =>
  ['1', 'true', 'sim', 'yes', 'y'].includes(value.trim().toLowerCase())

const parseHerdeirosCsvValue = (value: string): string[] => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ['']
  }

  const items = trimmed
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : ['']
}

const parseClientesCsv = (content: string): unknown[] => {
  const lines = content
    .split(/\r\n|\n|\r/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return []
  }

  const delimiter = detectCsvDelimiter(lines[0])
  const headerCells = parseCsvLine(lines[0], delimiter).map(normalizeCsvHeader)
  const headerKeys = headerCells.map((header) => CSV_HEADER_KEY_MAP[header] ?? null)
  if (headerKeys.every((key) => !key)) {
    return []
  }

  return lines
    .slice(1)
    .map((line) => {
      const values = parseCsvLine(line, delimiter)
      if (values.every((value) => !value.trim())) {
        return null
      }
      const registro: Partial<ClienteRegistro> & { dados?: Partial<ClienteDados> } = {
        dados: {},
      }

      headerKeys.forEach((key, index) => {
        if (!key) {
          return
        }
        const value = values[index]?.trim() ?? ''
        if (!value) {
          return
        }

        switch (key) {
          case 'id':
            registro.id = value
            break
          case 'criadoEm':
            registro.criadoEm = value
            break
          case 'atualizadoEm':
            registro.atualizadoEm = value
            break
          case 'temIndicacao':
            registro.dados!.temIndicacao = parseBooleanCsvValue(value)
            break
          case 'indicacaoNome':
            registro.dados!.indicacaoNome = value
            break
          case 'diaVencimento':
            registro.dados!.diaVencimento = value
            break
        case 'herdeiros':
          registro.dados!.herdeiros = parseHerdeirosCsvValue(value)
          break
        case 'propostaSnapshot': {
          try {
            const parsedSnapshot = JSON.parse(value)
            if (parsedSnapshot && typeof parsedSnapshot === 'object') {
              registro.propostaSnapshot = parsedSnapshot as OrcamentoSnapshotData
            }
          } catch (error) {
            console.warn('Não foi possível interpretar proposta_snapshot do CSV.', error)
          }
          break
        }
        default:
          registro.dados![key as keyof ClienteDados] = value
      }
      })

      return registro
    })
    .filter((item): item is Partial<ClienteRegistro> & { dados?: Partial<ClienteDados> } => Boolean(item))
}

const escapeCsvValue = (value: string, delimiter: string): string => {
  const stringValue = value ?? ''
  if (
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r') ||
    stringValue.includes(delimiter)
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

const buildClientesCsv = (registros: ClienteRegistro[]): string => {
  const header = CLIENTES_CSV_HEADERS.map((item) => escapeCsvValue(item.label, CLIENTES_CSV_DELIMITER)).join(
    CLIENTES_CSV_DELIMITER,
  )
  const rows = registros.map((registro) => {
    const dados = registro.dados
    const herdeiros = Array.isArray(dados.herdeiros)
      ? dados.herdeiros.map((item) => item.trim()).filter(Boolean).join(' | ')
      : ''
    const values: Record<string, string> = {
      id: registro.id,
      criadoEm: registro.criadoEm,
      atualizadoEm: registro.atualizadoEm,
      nome: dados.nome ?? '',
      documento: dados.documento ?? '',
      rg: dados.rg ?? '',
      estadoCivil: dados.estadoCivil ?? '',
      nacionalidade: dados.nacionalidade ?? '',
      profissao: dados.profissao ?? '',
      representanteLegal: dados.representanteLegal ?? '',
      email: dados.email ?? '',
      telefone: dados.telefone ?? '',
      cep: dados.cep ?? '',
      distribuidora: dados.distribuidora ?? '',
      uc: dados.uc ?? '',
      endereco: dados.endereco ?? '',
      cidade: dados.cidade ?? '',
      uf: dados.uf ?? '',
      temIndicacao: dados.temIndicacao ? 'true' : 'false',
      indicacaoNome: dados.indicacaoNome ?? '',
      nomeSindico: dados.nomeSindico ?? '',
      cpfSindico: dados.cpfSindico ?? '',
      contatoSindico: dados.contatoSindico ?? '',
      diaVencimento: dados.diaVencimento ?? '',
      herdeiros,
      propostaSnapshot: registro.propostaSnapshot
        ? JSON.stringify(registro.propostaSnapshot)
        : '',
    }

    return CLIENTES_CSV_HEADERS.map((item) => escapeCsvValue(values[item.key] ?? '', CLIENTES_CSV_DELIMITER)).join(
      CLIENTES_CSV_DELIMITER,
    )
  })

  return [header, ...rows].join('\n')
}

type NormalizeClienteRegistrosOptions = {
  existingIds?: Set<string>
  agoraIso?: string
}

const normalizeClienteRegistros = (
  items: unknown[],
  options: NormalizeClienteRegistrosOptions = {},
): { registros: ClienteRegistro[]; houveAtualizacaoIds: boolean } => {
  const agora = options.agoraIso ?? new Date().toISOString()
  const baseExistingIds = options.existingIds ? Array.from(options.existingIds) : []
  const existingIds = new Set<string>(baseExistingIds)
  let houveAtualizacaoIds = false

  const normalizados = items.map((item) => {
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

    const herdeirosNormalizados = normalizeClienteHerdeiros(
      (dados as { herdeiros?: unknown }).herdeiros,
    )

    let propostaSnapshot: OrcamentoSnapshotData | undefined
    const snapshotRaw =
      (registro as { propostaSnapshot?: unknown }).propostaSnapshot ??
      (registro as { snapshot?: unknown }).snapshot
    if (snapshotRaw && typeof snapshotRaw === 'object') {
      try {
        propostaSnapshot = cloneSnapshotData(snapshotRaw as OrcamentoSnapshotData)
      } catch (error) {
        console.warn('Não foi possível normalizar o snapshot do cliente.', error)
        propostaSnapshot = undefined
      }
    }

    const normalizado: ClienteRegistro = {
      id: idNormalizado,
      criadoEm: registro.criadoEm ?? agora,
      atualizadoEm: registro.atualizadoEm ?? registro.criadoEm ?? agora,
      dados: {
        nome: dados?.nome ?? '',
        documento: dados?.documento ?? '',
        rg: dados?.rg ?? '',
        estadoCivil: dados?.estadoCivil ?? '',
        nacionalidade: dados?.nacionalidade ?? '',
        profissao: dados?.profissao ?? '',
        representanteLegal: dados?.representanteLegal ?? '',
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
        nomeSindico: dados?.nomeSindico ?? '',
        cpfSindico: dados?.cpfSindico ?? '',
        contatoSindico: dados?.contatoSindico ?? '',
        diaVencimento: dados?.diaVencimento ?? '10',
        herdeiros: herdeirosNormalizados,
      },
      propostaSnapshot,
    }

    return normalizado
  })

  const ordenados = normalizados.sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1))

  return { registros: ordenados, houveAtualizacaoIds }
}

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

const PROPOSAL_PDF_REMINDER_INTERVAL_MS = 15 * 24 * 60 * 60 * 1000
const PROPOSAL_PDF_REMINDER_MESSAGE =
  'Integração de PDF não configurada. Configure o conector para salvar automaticamente ou utilize a opção “Imprimir” para gerar o PDF manualmente.'
const DEFAULT_PREVIEW_TOOLBAR_MESSAGE =
  'Revise o conteúdo e utilize as ações para imprimir ou salvar como PDF.'

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

const normalizeText = (value: string | null | undefined) =>
  (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const normalizeClienteString = (value: string) =>
  normalizeText(value)
    .replace(/\s+/g, ' ')
    .trim()

const normalizeClienteEmail = (value: string) => value.trim().toLowerCase()

const normalizeClienteNumbers = (value: string) => normalizeNumbers(value)

const formatWhatsappPhoneNumber = (value: string): string | null => {
  let digits = normalizeNumbers(value)

  if (!digits) {
    return null
  }

  digits = digits.replace(/^0+/, '')

  if (digits.startsWith('55')) {
    while (digits.length > 2 && digits[2] === '0') {
      digits = `55${digits.slice(3)}`
    }
  } else if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`
  } else {
    return null
  }

  if (digits.length < 12 || digits.length > 13) {
    return null
  }

  return digits
}

const createClienteComparisonData = (dados: ClienteDados) => {
  const normalized = {
    nome: normalizeClienteString(dados.nome),
    documento: normalizeClienteNumbers(dados.documento),
    rg: normalizeClienteNumbers(dados.rg),
    email: normalizeClienteEmail(dados.email),
    telefone: normalizeClienteNumbers(dados.telefone),
    cep: normalizeClienteNumbers(dados.cep),
    distribuidora: normalizeClienteString(dados.distribuidora),
    uc: normalizeClienteNumbers(dados.uc),
    endereco: normalizeClienteString(dados.endereco),
    cidade: normalizeClienteString(dados.cidade),
    uf: normalizeClienteString(dados.uf),
    temIndicacao: Boolean(dados.temIndicacao),
    indicacaoNome: normalizeClienteString(dados.indicacaoNome),
    nomeSindico: normalizeClienteString(dados.nomeSindico),
    cpfSindico: normalizeClienteNumbers(dados.cpfSindico),
    contatoSindico: normalizeClienteNumbers(dados.contatoSindico),
    herdeiros: Array.isArray(dados.herdeiros)
      ? dados.herdeiros.map((item) => normalizeClienteString(item)).filter(Boolean).sort()
      : [],
  }

  return {
    signature: JSON.stringify(normalized),
    nome: normalized.nome,
    documento: normalized.documento,
    rg: normalized.rg,
    uc: normalized.uc,
    telefone: normalized.telefone,
    email: normalized.email,
    endereco: normalized.endereco,
  }
}

const formatBudgetDate = (isoString: string) => {
  const parsed = new Date(isoString)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

type ClientesPanelProps = {
  registros: ClienteRegistro[]
  onClose: () => void
  onEditar: (registro: ClienteRegistro) => void
  onExcluir: (registro: ClienteRegistro) => void
  onExportarCsv: () => void
  onExportarJson: () => void
  onImportar: () => void
  isImportando: boolean
}

type ClienteContratoPayload = {
  nomeCompleto: string
  cpfCnpj: string
  enderecoCompleto: string
  unidadeConsumidora: string
  kWhContratado?: string
  uf?: string
  telefone?: string
  email?: string
  endereco?: string
  cidade?: string
  cep?: string
}

type ContractTemplateCategory = 'leasing' | 'vendas'

type ContractTemplatesModalProps = {
  title: string
  templates: string[]
  selectedTemplates: string[]
  isLoading: boolean
  errorMessage: string | null
  onToggleTemplate: (template: string) => void
  onSelectAll: (selectAll: boolean) => void
  onConfirm: () => void
  onClose: () => void
}

type LeasingContratoTipo = 'residencial' | 'condominio'

type LeasingAnexoId = 'ANEXO_I' | 'ANEXO_II' | 'ANEXO_III' | 'ANEXO_IV' | 'ANEXO_VII' | 'ANEXO_VIII'

type LeasingAnexoConfig = {
  id: LeasingAnexoId
  label: string
  descricao?: string
  tipos: LeasingContratoTipo[]
  autoInclude?: boolean
}

const LEASING_ANEXOS_CONFIG: LeasingAnexoConfig[] = [
  {
    id: 'ANEXO_II',
    label: 'Opção de Compra',
    descricao: 'Termo de opção de compra da usina ao final do contrato, conforme regras aplicáveis ao modelo de leasing.',
    tipos: ['residencial', 'condominio'],
    autoInclude: true,
  },
  {
    id: 'ANEXO_III',
    label: 'Metodologia de Cálculo',
    descricao: 'Documento com a metodologia interna utilizada para as simulações e estimativas de mensalidade.',
    tipos: ['residencial', 'condominio'],
    autoInclude: true,
  },
  {
    id: 'ANEXO_IV',
    label: 'Autorização do Proprietário',
    descricao: 'Declaração dos proprietários ou herdeiros autorizando a instalação.',
    tipos: ['residencial'],
    autoInclude: true,
  },
  {
    id: 'ANEXO_VIII',
    label: 'Procuração',
    descricao: 'Documento obrigatório para representação.',
    tipos: ['residencial', 'condominio'],
    autoInclude: true,
  },
  {
    id: 'ANEXO_I',
    label: 'Especificações Técnicas',
    descricao: 'Resumo técnico e proposta comercial detalhada conforme metodologia interna da SolarInvest.',
    tipos: ['residencial', 'condominio'],
  },
  {
    id: 'ANEXO_VII',
    label: 'Termo de Entrega e Aceite',
    descricao: 'Registro de entrega técnica da usina.',
    tipos: ['residencial', 'condominio'],
  },
]

const getDefaultLeasingAnexos = (tipo: LeasingContratoTipo): LeasingAnexoId[] => (
  LEASING_ANEXOS_CONFIG.filter((anexo) => anexo.autoInclude && anexo.tipos.includes(tipo))
    .map((anexo) => anexo.id)
)

const ensureRequiredLeasingAnexos = (
  anexosSelecionados: LeasingAnexoId[],
  tipo: LeasingContratoTipo,
): LeasingAnexoId[] => {
  const required = getDefaultLeasingAnexos(tipo)
  const merged = new Set<LeasingAnexoId>([...anexosSelecionados, ...required])
  return Array.from(merged)
}

type PropostaEnvioMetodo = 'whatsapp' | 'whatsapp-business' | 'airdrop' | 'quick-share'

type PropostaEnvioContato = {
  id: string
  nome: string
  telefone: string
  email?: string | undefined
  origem: 'cliente-atual' | 'cliente-salvo' | 'crm'
}

const PROPOSTA_ENVIO_ORIGEM_LABEL: Record<PropostaEnvioContato['origem'], string> = {
  'cliente-atual': 'Proposta em edição',
  'cliente-salvo': 'Clientes salvos',
  crm: 'CRM',
}

function ClientesPanel({
  registros,
  onClose,
  onEditar,
  onExcluir,
  onExportarCsv,
  onExportarJson,
  onImportar,
  isImportando,
}: ClientesPanelProps) {
  const panelTitleId = useId()
  const [clienteSearchTerm, setClienteSearchTerm] = useState('')
  const normalizedSearchTerm = clienteSearchTerm.trim().toLowerCase()
  const registrosFiltrados = useMemo(() => {
    if (!normalizedSearchTerm) {
      return registros
    }

    return registros.filter((registro) => {
      const nomeCliente = registro.dados.nome?.trim().toLowerCase()
      const documentoCliente = registro.dados.documento?.trim().toLowerCase()
      const matchNome = nomeCliente ? nomeCliente.includes(normalizedSearchTerm) : false
      const matchDocumento = documentoCliente
        ? documentoCliente.replace(/\D/g, '').includes(normalizedSearchTerm.replace(/\D/g, ''))
        : false
      return matchNome || matchDocumento
    })
  }, [normalizedSearchTerm, registros])
  const totalRegistros = registros.length
  const totalResultados = registrosFiltrados.length

  return (
    <div className="budget-search-page clients-page" aria-labelledby={panelTitleId}>
      <div className="budget-search-page-header">
        <div>
          <h2 id={panelTitleId}>Gestão de clientes</h2>
          <p>Clientes armazenados localmente neste dispositivo.</p>
        </div>
        <button type="button" className="ghost" onClick={onClose}>
          Voltar
        </button>
      </div>
      <div className="budget-search-panels">
        <section className="budget-search-panel clients-overview-panel" aria-label="Informações sobre clientes salvos">
          <div className="budget-search-header">
            <h4>Central de clientes</h4>
            <p>Sincronize contatos, mantenha a base atualizada e compartilhe dados com o time.</p>
          </div>
          <ul className="clients-overview-list">
            <li>Carregue clientes salvos para editar ou enviar novas propostas.</li>
            <li>Exporte um arquivo de backup para outras unidades ou dispositivos.</li>
            <li>Importe registros recebidos por e-mail ou compartilhados pelo time comercial.</li>
          </ul>
        </section>
        <section className="budget-search-panel clients-panel" aria-label="Registros de clientes salvos">
          <div className="budget-search-header">
            <h4>Registros salvos</h4>
            <div className="clients-panel-actions">
              <button
                type="button"
                className="ghost with-icon"
                onClick={onExportarJson}
                disabled={registros.length === 0}
                title="Exportar clientes salvos para um arquivo JSON"
              >
                <span aria-hidden="true">⬆️</span>
                <span>Exportar JSON</span>
              </button>
              <button
                type="button"
                className="ghost with-icon"
                onClick={onExportarCsv}
                disabled={registros.length === 0}
                title="Exportar clientes salvos para um arquivo CSV"
              >
                <span aria-hidden="true">📄</span>
                <span>Exportar CSV</span>
              </button>
              <button
                type="button"
                className="ghost with-icon"
                onClick={onImportar}
                disabled={isImportando}
                aria-busy={isImportando}
                title="Importar clientes a partir de um arquivo JSON ou CSV"
              >
                <span aria-hidden="true">⬇️</span>
                <span>{isImportando ? 'Importando…' : 'Importar'}</span>
              </button>
            </div>
          </div>
          <Field
            label={labelWithTooltip(
              'Pesquisar cliente',
              'Filtra os clientes salvos pelo nome ou CPF/CNPJ informado.',
            )}
            hint="Digite o nome ou CPF/CNPJ do cliente para filtrar os registros salvos."
          >
            <input
              type="search"
              value={clienteSearchTerm}
              onChange={(event) => setClienteSearchTerm(event.target.value)}
              placeholder="Ex.: Maria Silva ou 123.456.789-00"
            />
          </Field>
          <div className="budget-search-summary">
            <span>
              {totalRegistros === 0
                ? 'Nenhum cliente salvo até o momento.'
                : `${totalResultados} de ${totalRegistros} cliente(s) exibidos.`}
            </span>
            {clienteSearchTerm ? (
              <button type="button" className="link" onClick={() => setClienteSearchTerm('')}>
                Limpar busca
              </button>
            ) : null}
          </div>
          {registros.length === 0 ? (
            <p className="budget-search-empty">Nenhum cliente foi salvo até o momento.</p>
          ) : registrosFiltrados.length === 0 ? (
            <p className="budget-search-empty">
              Nenhum cliente encontrado para "<strong>{clienteSearchTerm}</strong>".
            </p>
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
                    {registrosFiltrados.map((registro) => {
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
  )
}

function ContractTemplatesModal({
  title,
  templates,
  selectedTemplates,
  isLoading,
  errorMessage,
  onToggleTemplate,
  onSelectAll,
  onConfirm,
  onClose,
}: ContractTemplatesModalProps) {
  const modalTitleId = useId()
  const checkboxBaseId = useId()
  const allSelected = templates.length > 0 && selectedTemplates.length === templates.length
  const hasSelection = selectedTemplates.length > 0

  return (
    <div
      className="modal contract-templates-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content contract-templates-modal__content">
        <div className="modal-header">
          <h3 id={modalTitleId}>{title}</h3>
          <button className="icon" onClick={onClose} aria-label="Fechar seleção de contratos">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>Selecione os modelos de contrato que deseja gerar.</p>
          {isLoading ? (
            <p className="muted">Carregando modelos disponíveis…</p>
          ) : errorMessage ? (
            <p className="muted">{errorMessage}</p>
          ) : templates.length === 0 ? (
            <p className="muted">Nenhum modelo de contrato disponível no momento.</p>
          ) : (
            <>
              <div className="contract-template-actions">
                <button
                  type="button"
                  className="link"
                  onClick={() => onSelectAll(!allSelected)}
                >
                  {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>
              <ul className="contract-template-list">
                {templates.map((template, index) => {
                  const checkboxId = `${checkboxBaseId}-${index}`
                  const fileName = template.split(/[\\/]/).pop() ?? template
                  const label = fileName.replace(/\.docx$/i, '')
                  const checked = selectedTemplates.includes(template)
                  return (
                    <li key={template} className="contract-template-item">
                      <label htmlFor={checkboxId} className="flex items-center gap-2">
                        <CheckboxSmall
                          id={checkboxId}
                          checked={checked}
                          onChange={() => onToggleTemplate(template)}
                        />
                        <span>
                          <strong>{label}</strong>
                          <span className="filename">{fileName}</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          {!isLoading && !errorMessage && templates.length > 0 && !hasSelection ? (
            <p className="muted">Selecione ao menos um modelo para gerar.</p>
          ) : null}
          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="primary"
              onClick={onConfirm}
              disabled={isLoading || templates.length === 0 || !hasSelection}
            >
              Gerar contratos selecionados
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type LeasingContractsModalProps = {
  tipoContrato: LeasingContratoTipo
  anexosSelecionados: LeasingAnexoId[]
  anexosAvailability: Record<LeasingAnexoId, boolean>
  isLoadingAvailability: boolean
  onToggleAnexo: (anexoId: LeasingAnexoId) => void
  onSelectAll: (selectAll: boolean) => void
  onConfirm: () => void
  onClose: () => void
  isGenerating: boolean
}

function LeasingContractsModal({
  tipoContrato,
  anexosSelecionados,
  anexosAvailability,
  isLoadingAvailability,
  onToggleAnexo,
  onSelectAll,
  onConfirm,
  onClose,
  isGenerating,
}: LeasingContractsModalProps) {
  const modalTitleId = useId()
  const checkboxBaseId = useId()
  const anexosDisponiveis = useMemo(
    () => LEASING_ANEXOS_CONFIG.filter((config) => config.tipos.includes(tipoContrato)),
    [tipoContrato],
  )
  const opcionais = anexosDisponiveis.filter((config) => !config.autoInclude)
  const allOptionalSelected =
    opcionais.length > 0 && opcionais.every((config) => anexosSelecionados.includes(config.id))

  const hasOpcionalSelecionavel = opcionais.length > 0

  return (
    <div
      className="modal contract-templates-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content contract-templates-modal__content">
        <div className="modal-header">
          <h3 id={modalTitleId}>
            {tipoContrato === 'condominio'
              ? 'Gerar documentos do leasing (condomínio)'
              : 'Gerar documentos do leasing (residencial)'}
          </h3>
          <button className="icon" onClick={onClose} aria-label="Fechar seleção de anexos">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>
            Escolha quais anexos devem acompanhar o contrato principal. Itens obrigatórios são
            incluídos automaticamente.
          </p>
          {hasOpcionalSelecionavel ? (
            <div className="contract-template-actions">
              <button
                type="button"
                className="link"
                onClick={() => onSelectAll(!allOptionalSelected)}
              >
                {allOptionalSelected ? 'Desmarcar opcionais' : 'Selecionar todos os opcionais'}
              </button>
            </div>
          ) : null}
          {isLoadingAvailability ? (
            <p className="muted">Verificando disponibilidade dos anexos...</p>
          ) : null}
          <ul className="contract-template-list">
            {anexosDisponiveis.map((config, index) => {
              const checkboxId = `${checkboxBaseId}-${index}`
              const isAvailable = anexosAvailability[config.id] !== false
              const checked = config.autoInclude || anexosSelecionados.includes(config.id)
              const disabled = Boolean(config.autoInclude) || !isAvailable
              return (
                <li key={config.id} className="contract-template-item">
                  <label htmlFor={checkboxId} className="flex items-center gap-2">
                    <CheckboxSmall
                      id={checkboxId}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => {
                        if (disabled) {
                          return
                        }
                        onToggleAnexo(config.id)
                      }}
                    />
                    <span>
                      <strong>{config.label}</strong>
                      {config.descricao ? (
                        <span className="filename">{config.descricao}</span>
                      ) : null}
                      {config.autoInclude ? (
                        <span className="filename">Documento obrigatório</span>
                      ) : null}
                      {!isAvailable ? (
                        <span className="filename" style={{ color: '#dc2626', fontSize: '0.875rem' }}>
                          Arquivo não disponível
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose} disabled={isGenerating}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={isGenerating}
          >
            {isGenerating ? 'Gerando…' : 'Gerar pacote'}
          </button>
        </div>
      </div>
    </div>
  )
}

type SaveDecisionChoice = 'save' | 'discard'

type SaveDecisionPromptRequest = {
  title: string
  description: string
  confirmLabel?: string
  discardLabel?: string
}

type SaveDecisionPromptState = SaveDecisionPromptRequest & {
  resolve: (choice: SaveDecisionChoice) => void
}

type SaveChangesDialogProps = {
  title: string
  description: string
  confirmLabel: string
  discardLabel: string
  onConfirm: () => void
  onDiscard: () => void
}

function SaveChangesDialog({
  title,
  description,
  confirmLabel,
  discardLabel,
  onConfirm,
  onDiscard,
}: SaveChangesDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDiscard()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDiscard])

  return (
    <div
      className="modal save-changes-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="modal-backdrop modal-backdrop--opaque" onClick={onDiscard} />
      <div className="modal-content save-changes-modal__content">
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
        </div>
        <div className="modal-body" id={descriptionId}>
          <p>{description}</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onDiscard}>
            {discardLabel}
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

type EnviarPropostaModalProps = {
  contatos: PropostaEnvioContato[]
  selectedContatoId: string | null
  onSelectContato: (id: string) => void
  onEnviar: (metodo: PropostaEnvioMetodo) => void
  onClose: () => void
}

function EnviarPropostaModal({
  contatos,
  selectedContatoId,
  onSelectContato,
  onEnviar,
  onClose,
}: EnviarPropostaModalProps) {
  const modalTitleId = useId()
  const contactsLegendId = useId()
  const contatoSelecionado = React.useMemo(() => {
    return contatos.find((contato) => contato.id === selectedContatoId) ?? null
  }, [contatos, selectedContatoId])
  const temContatos = contatos.length > 0
  const telefoneValido = React.useMemo(() => {
    if (!contatoSelecionado?.telefone) {
      return false
    }
    return Boolean(formatWhatsappPhoneNumber(contatoSelecionado.telefone))
  }, [contatoSelecionado?.telefone])

  const disabledMessage = telefoneValido
    ? undefined
    : 'Informe um telefone com DDD para enviar via WhatsApp.'

  return (
    <div className="modal enviar-proposta-modal" role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
      <button
        type="button"
        className="modal-backdrop modal-backdrop--opaque"
        onClick={onClose}
        aria-label="Fechar envio de proposta"
      />
      <div className="modal-content enviar-proposta-modal__content">
        <div className="modal-header">
          <h3 id={modalTitleId}>Enviar proposta</h3>
          <button className="icon" onClick={onClose} aria-label="Fechar envio de proposta">
            ✕
          </button>
        </div>
        <div className="modal-body enviar-proposta-modal__body">
          <p className="muted">
            Escolha um contato da lista e selecione como deseja compartilhar a proposta.
          </p>
          <fieldset className="share-contact-selector" aria-labelledby={contactsLegendId}>
            <legend id={contactsLegendId}>Contatos disponíveis</legend>
            {temContatos ? (
              <ul className="share-contact-list">
                {contatos.map((contato) => {
                  const origemLabel = PROPOSTA_ENVIO_ORIGEM_LABEL[contato.origem]
                  const isSelected = contato.id === selectedContatoId
                  return (
                    <li key={contato.id} className={`share-contact-item${isSelected ? ' is-selected' : ''}`}>
                      <label>
                        <input
                          type="radio"
                          name="share-contact"
                          value={contato.id}
                          checked={isSelected}
                          onChange={() => onSelectContato(contato.id)}
                        />
                        <span className="share-contact-details">
                          <span className="share-contact-name">{contato.nome || 'Contato sem nome'}</span>
                          <span className="share-contact-meta">
                            {contato.telefone ? contato.telefone : 'Telefone não informado'}
                          </span>
                          <span className="share-contact-origin">{origemLabel}</span>
                          {contato.email ? (
                            <span className="share-contact-meta">{contato.email}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="muted">
                Cadastre um cliente ou lead com telefone ou e-mail para disponibilizar o envio da proposta.
              </p>
            )}
          </fieldset>
          <div className="share-channel-grid" role="group" aria-label="Canais de envio disponíveis">
            <button
              type="button"
              className="share-channel-button whatsapp"
              onClick={() => onEnviar('whatsapp')}
              disabled={!temContatos || !contatoSelecionado || !telefoneValido}
              title={disabledMessage}
            >
              <span aria-hidden="true">💬</span>
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              className="share-channel-button whatsapp-business"
              onClick={() => onEnviar('whatsapp-business')}
              disabled={!temContatos || !contatoSelecionado || !telefoneValido}
              title={disabledMessage}
            >
              <span aria-hidden="true">🏢</span>
              <span>WhatsApp Business</span>
            </button>
            <button
              type="button"
              className="share-channel-button airdrop"
              onClick={() => onEnviar('airdrop')}
              disabled={!temContatos || !contatoSelecionado}
            >
              <span aria-hidden="true">📡</span>
              <span>AirDrop</span>
            </button>
            <button
              type="button"
              className="share-channel-button quick-share"
              onClick={() => onEnviar('quick-share')}
              disabled={!temContatos || !contatoSelecionado}
            >
              <span aria-hidden="true">⚡</span>
              <span>Quick Share</span>
            </button>
          </div>
        </div>
        <div className="modal-actions enviar-proposta-modal__actions">
          <button type="button" className="ghost" onClick={onClose}>
            Fechar
          </button>
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
  const generatedId = useId()
  let firstControlId: string | undefined

  const enhancedChildren = React.Children.map(children, (child, index) => {
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
        const existingProps = child.props as {
          className?: string
          id?: string
          name?: string
        }
        const existingClassName = existingProps.className ?? ''
        const classes = existingClassName.split(' ').filter(Boolean)
        if (!classes.includes('cfg-input')) {
          classes.push('cfg-input')
        }
        const resolvedId = existingProps.id ?? (index === 0 ? generatedId : `${generatedId}-${index}`)
        if (!firstControlId) {
          firstControlId = resolvedId
        }
        return React.cloneElement(child, {
          className: classes.join(' '),
          id: existingProps.id ?? resolvedId,
          name: existingProps.name ?? resolvedId,
        })
      }
    }

    return child
  })

  const labelHtmlFor = htmlFor ?? firstControlId

  return (
    <div className="field cfg-field">
      <label className="field-label cfg-label" {...(labelHtmlFor ? { htmlFor: labelHtmlFor } : undefined)}>
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

type PrecheckDecisionAction = 'adjust_current' | 'adjust_upgrade' | 'proceed' | 'cancel'
type PrecheckDecision = { action: PrecheckDecisionAction; clienteCiente: boolean }

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

function sanitizePrintableHtml(html: string | null): string | null {
  if (typeof html !== 'string') {
    return html
  }

  return html.replace(/html\s*coding/gi, '').trim()
}

const buildProposalPdfDocument = (layoutHtml: string, nomeCliente: string, variant: PrintVariant = 'standard') => {
  const safeCliente = nomeCliente?.trim() || 'SolarInvest'
  const safeHtml = layoutHtml || ''

  return `<!DOCTYPE html>
<html data-print-mode="download" data-print-variant="${variant}">
  <head>
    <meta charset="utf-8" />
    <title>Proposta-${safeCliente}</title>
    <style>
      ${printStyles}
      ${simplePrintStyles}
      body{margin:0;background:#f8fafc;}
      .preview-container{max-width:calc(210mm - 32mm);width:100%;margin:0 auto;padding:24px 0 40px;}
    </style>
  </head>
  <body data-print-mode="download" data-print-variant="${variant}">
    <div class="preview-container">${safeHtml}</div>
  </body>
</html>`
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
  const vendaSnapshotSignal = useVendaStore((state) => state)
  const leasingSnapshotSignal = useLeasingStore((state) => state)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return 'light'
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    ensureServerStorageSync({ timeoutMs: 4000 })
  }, [])
  useEffect(() => {
    removeFogOverlays()
    const disconnect = watchFogReinjection()
    return disconnect
  }, [])

  // Flags de sincronização — controlam dependência entre campos
  const syncStateRef = useRef({
    segmentEdited: false, // usuário mexeu manualmente no segmento
    tusdEdited: false, // usuário mexeu manualmente no TUSD
  })
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

    if (typeof window.matchMedia !== 'function') {
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
  const [activePage, setActivePage] = useState<ActivePage>(() => {
    if (typeof window === 'undefined') {
      return 'app'
    }

    const storedPage = window.localStorage.getItem(STORAGE_KEYS.activePage)
    if (storedPage === 'dashboard') {
      return 'app'
    }
    const isKnownPage =
      storedPage === 'dashboard' ||
      storedPage === 'app' ||
      storedPage === 'crm' ||
      storedPage === 'consultar' ||
      storedPage === 'clientes' ||
      storedPage === 'settings' ||
      storedPage === 'simulacoes'

    return isKnownPage ? (storedPage as ActivePage) : 'app'
  })
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window === 'undefined') {
      return INITIAL_VALUES.activeTab
    }

    const storedTab = window.localStorage.getItem(STORAGE_KEYS.activeTab)
    return storedTab === 'leasing' || storedTab === 'vendas' ? storedTab : INITIAL_VALUES.activeTab
  })
  const activeTabRef = useRef(activeTab)
  const [simulacoesSection, setSimulacoesSection] = useState<SimulacoesSection>('nova')
  const [aprovacaoStatus, setAprovacaoStatus] = useState<AprovacaoStatus>('pendente')
  const [aprovacaoChecklist, setAprovacaoChecklist] = useState<
    Record<AprovacaoChecklistKey, boolean>
  >({
    roi: true,
    tir: true,
    spread: false,
    vpl: false,
  })
  const [ultimaDecisaoTimestamp, setUltimaDecisaoTimestamp] = useState<number | null>(null)
  const isVendaDiretaTab = activeTab === 'vendas'
  useEffect(() => {
    const modo: ModoVenda = isVendaDiretaTab ? 'direta' : 'leasing'
    vendaActions.updateResumoProposta({ modo_venda: modo })
  }, [isVendaDiretaTab])
  const lastPrimaryPageRef = useRef<'dashboard' | 'app' | 'crm' | 'simulacoes'>('app')
  useEffect(() => {
    if (
      activePage === 'dashboard' ||
      activePage === 'app' ||
      activePage === 'crm' ||
      activePage === 'simulacoes'
    ) {
      lastPrimaryPageRef.current = activePage
    }
  }, [activePage])
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.innerWidth < 1000
  })
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleResize = () => {
      const width = window.innerWidth
      if (width <= 920) {
        setIsSidebarCollapsed(false)
      } else {
        setIsSidebarCollapsed(width < 1000)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 920px)')
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches)
      if (!event.matches) {
        setIsSidebarMobileOpen(false)
      }
    }

    setIsMobileViewport(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])
  const [orcamentosSalvos, setOrcamentosSalvos] = useState<OrcamentoSalvo[]>([])
  const [orcamentoSearchTerm, setOrcamentoSearchTerm] = useState('')
  const [orcamentoVisualizado, setOrcamentoVisualizado] = useState<PrintableProposalProps | null>(null)
  const [orcamentoVisualizadoInfo, setOrcamentoVisualizadoInfo] = useState<
    | {
        id: string
        cliente: string
      }
    | null
  >(null)
  const [orcamentoAtivoInfo, setOrcamentoAtivoInfo] = useState<
    | {
        id: string
        cliente: string
      }
    | null
  >(null)
  const [orcamentoRegistroBase, setOrcamentoRegistroBase] = useState<OrcamentoSalvo | null>(null)
  const [orcamentoDisponivelParaDuplicar, setOrcamentoDisponivelParaDuplicar] =
    useState<OrcamentoSalvo | null>(null)
  const [propostaImagens, setPropostaImagens] = useState<PrintableProposalImage[]>([])
  const lastSavedSignatureRef = useRef<string | null>(null)
  const userInteractedSinceSaveRef = useRef(false)
  const computeSignatureRef = useRef<() => string>(() => '')
  const initialSignatureSetRef = useRef(false)
  const limparOrcamentoAtivo = useCallback(() => {
    setOrcamentoAtivoInfo(null)
    setOrcamentoRegistroBase(null)
    setOrcamentoDisponivelParaDuplicar(null)
  }, [])
  const scheduleMarkStateAsSaved = useCallback((signatureOverride?: string | null) => {
    userInteractedSinceSaveRef.current = false
    lastSavedSignatureRef.current = signatureOverride ?? computeSignatureRef.current()

    if (typeof window === 'undefined') {
      return
    }

    window.setTimeout(() => {
      lastSavedSignatureRef.current = computeSignatureRef.current()
    }, 0)
  }, [])
  const [saveDecisionPrompt, setSaveDecisionPrompt] = useState<SaveDecisionPromptState | null>(null)

  const requestSaveDecision = useCallback(
    (options: SaveDecisionPromptRequest): Promise<SaveDecisionChoice> => {
      if (typeof window === 'undefined') {
        return Promise.resolve('discard')
      }

      return new Promise<SaveDecisionChoice>((resolve) => {
        setSaveDecisionPrompt({
          ...options,
          resolve,
        })
      })
    },
    [],
  )

  const resolveSaveDecisionPrompt = useCallback((choice: SaveDecisionChoice) => {
    setSaveDecisionPrompt((current) => {
      if (current) {
        current.resolve(choice)
      }

      return null
    })
  }, [])
  const atualizarOrcamentoAtivo = useCallback(
    (registro: OrcamentoSalvo) => {
      const dadosClonados = clonePrintableData(registro.dados)
      const clienteNome =
        registro.clienteNome?.trim() ||
        registro.dados.cliente.nome?.trim() ||
        dadosClonados.cliente.nome?.trim() ||
        registro.id
      const idNormalizado = normalizeProposalId(dadosClonados.budgetId ?? registro.id)
      const idParaExibir = idNormalizado || registro.id

      setOrcamentoAtivoInfo({
        id: idParaExibir,
        cliente: clienteNome,
      })
      const registroClonado = cloneOrcamentoSalvo(registro)
      setOrcamentoRegistroBase(registroClonado)
      setOrcamentoDisponivelParaDuplicar(registroClonado)
      setOrcamentoVisualizado(null)
      setOrcamentoVisualizadoInfo(null)
      const signatureOverride = registro.snapshot
        ? computeSnapshotSignature(registro.snapshot, dadosClonados)
        : null
      scheduleMarkStateAsSaved(signatureOverride)
    },
    [scheduleMarkStateAsSaved],
  )

  const [oneDriveIntegrationAvailable, setOneDriveIntegrationAvailable] = useState(() =>
    isOneDriveIntegrationAvailable(),
  )
  const [proposalPdfIntegrationAvailable, setProposalPdfIntegrationAvailable] = useState(() =>
    isProposalPdfIntegrationAvailable(),
  )
  useEffect(() => {
    setOneDriveIntegrationAvailable(isOneDriveIntegrationAvailable())
    setProposalPdfIntegrationAvailable(isProposalPdfIntegrationAvailable())
  }, [])
  const budgetIdRef = useRef<string>(createDraftBudgetId())
  const budgetIdTransitionRef = useRef(false)
  const [currentBudgetId, setCurrentBudgetId] = useState<string>(budgetIdRef.current)
  const [budgetStructuredItems, setBudgetStructuredItems] = useState<StructuredItem[]>([])
  const budgetUploadInputId = useId()
  const budgetTableContentId = useId()
  const tusdOptionsTitleId = useId()
  const tusdOptionsToggleId = useId()
  const tusdOptionsContentId = useId()
  const configuracaoUsinaObservacoesBaseId = useId()
  const budgetUploadInputRef = useRef<HTMLInputElement | null>(null)
  const imagensUploadInputRef = useRef<HTMLInputElement | null>(null)
  const moduleQuantityInputRef = useRef<HTMLInputElement | null>(null)
  const inverterModelInputRef = useRef<HTMLInputElement | null>(null)
  const editableContentRef = useRef<HTMLDivElement | null>(null)
  const leasingHomologacaoInputId = useId()
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
  const [potenciaFonteManual, setPotenciaFonteManualState] = useState(false)
  const [tarifaCheia, setTarifaCheiaState] = useState(INITIAL_VALUES.tarifaCheia)
  const [desconto, setDesconto] = useState(INITIAL_VALUES.desconto)
  const [taxaMinima, setTaxaMinimaState] = useState(INITIAL_VALUES.taxaMinima)
  const [taxaMinimaInputEmpty, setTaxaMinimaInputEmpty] = useState(() => false)
  const [encargosFixosExtras, setEncargosFixosExtras] = useState(
    INITIAL_VALUES.encargosFixosExtras,
  )
  const [tusdPercent, setTusdPercent] = useState(INITIAL_VALUES.tusdPercent)
  const [tusdTipoCliente, setTusdTipoCliente] = useState<TipoClienteTUSD>(() =>
    normalizeTipoBasico(INITIAL_VALUES.tusdTipoCliente),
  )
  const [tusdSubtipo, setTusdSubtipo] = useState(INITIAL_VALUES.tusdSubtipo)
  const [tusdSimultaneidade, setTusdSimultaneidade] = useState<number | null>(
    INITIAL_VALUES.tusdSimultaneidade,
  )
  const [tusdSimultaneidadeManualOverride, setTusdSimultaneidadeManualOverride] =
    useState(false)
  const [tusdTarifaRkwh, setTusdTarifaRkwh] = useState<number | null>(
    INITIAL_VALUES.tusdTarifaRkwh,
  )
  const [tusdAnoReferencia, setTusdAnoReferencia] = useState(
    INITIAL_VALUES.tusdAnoReferencia ?? DEFAULT_TUSD_ANO_REFERENCIA,
  )
  const [tusdOpcoesExpandidas, setTusdOpcoesExpandidas] = useState(false)
  const [leasingPrazo, setLeasingPrazo] = useState<LeasingPrazoAnos>(INITIAL_VALUES.leasingPrazo)
  const [ucGeradoraTitularPanelOpen, setUcGeradoraTitularPanelOpen] = useState(false)
  const [ucGeradoraTitularErrors, setUcGeradoraTitularErrors] =
    useState<UcGeradoraTitularErrors>({})
  const [ucGeradoraTitularCepMessage, setUcGeradoraTitularCepMessage] = useState<
    string | undefined
  >(undefined)
  const [ucGeradoraTitularBuscandoCep, setUcGeradoraTitularBuscandoCep] = useState(false)
  const [potenciaModulo, setPotenciaModuloState] = useState(INITIAL_VALUES.potenciaModulo)
  const [tipoRede, setTipoRede] = useState<TipoRede>(INITIAL_VALUES.tipoRede ?? 'monofasico')
  const [tipoRedeControle, setTipoRedeControle] = useState<'auto' | 'manual'>('auto')
  const tipoRedeLabel = useMemo(
    () => TIPOS_REDE.find((rede) => rede.value === tipoRede)?.label ?? tipoRede,
    [tipoRede],
  )
  const [potenciaModuloDirty, setPotenciaModuloDirtyState] = useState(false)
  const initialTipoInstalacao = normalizeTipoInstalacao(INITIAL_VALUES.tipoInstalacao)
  const [tipoInstalacao, setTipoInstalacaoState] = useState<TipoInstalacao>(
    () => initialTipoInstalacao,
  )
  const [tipoInstalacaoOutro, setTipoInstalacaoOutroState] = useState(
    INITIAL_VALUES.tipoInstalacaoOutro,
  )
  const [tipoSistema, setTipoSistemaState] = useState<TipoSistema>(INITIAL_VALUES.tipoSistema)
  const [modoOrcamento, setModoOrcamento] = useState<'auto' | 'manual'>('auto')
  const [autoKitValor, setAutoKitValor] = useState<number | null>(null)
  const [autoCustoFinal, setAutoCustoFinal] = useState<number | null>(null)
  const [autoPricingRede, setAutoPricingRede] = useState<Rede | null>(null)
  const [autoPricingVersion, setAutoPricingVersion] = useState<string | null>(null)
  const [autoBudgetReasonCode, setAutoBudgetReasonCode] = useState<string | null>(null)
  const [autoBudgetReason, setAutoBudgetReason] = useState<string | null>(null)
  const isManualBudgetForced = useMemo(
    () =>
      tipoInstalacao === 'solo' ||
      tipoInstalacao === 'outros' ||
      tipoSistema === 'HIBRIDO' ||
      tipoSistema === 'OFF_GRID',
    [tipoInstalacao, tipoSistema],
  )
  const manualBudgetForceReason = useMemo(() => {
    const reasons: string[] = []
    if (tipoInstalacao === 'solo' || tipoInstalacao === 'outros') {
      reasons.push('instalações em solo ou outros formatos')
    }
    if (tipoSistema === 'HIBRIDO' || tipoSistema === 'OFF_GRID') {
      reasons.push('sistemas híbridos ou off-grid')
    }
    return reasons.length > 0
      ? `Modo automático indisponível para ${reasons.join(' ou ')}.`
      : ''
  }, [tipoInstalacao, tipoSistema])
  const [segmentoCliente, setSegmentoClienteState] = useState<SegmentoCliente>(() =>
    normalizeTipoBasico(INITIAL_VALUES.segmentoCliente),
  )
  const [tipoEdificacaoOutro, setTipoEdificacaoOutro] = useState(
    INITIAL_VALUES.tipoEdificacaoOutro,
  )
  const [tipoInstalacaoDirty, setTipoInstalacaoDirtyState] = useState(false)
  const [numeroModulosManual, setNumeroModulosManualState] = useState<number | ''>(
    INITIAL_VALUES.numeroModulosManual,
  )
  const [configuracaoUsinaObservacoes, setConfiguracaoUsinaObservacoes] = useState(
    INITIAL_VALUES.configuracaoUsinaObservacoes,
  )
  const [configuracaoUsinaObservacoesExpanded, setConfiguracaoUsinaObservacoesExpanded] =
    useState(false)
  const configuracaoUsinaObservacoesLeasingId = `${configuracaoUsinaObservacoesBaseId}-leasing`
  const configuracaoUsinaObservacoesVendaId = `${configuracaoUsinaObservacoesBaseId}-venda`
  const configuracaoUsinaObservacoesLeasingContainerId = `${configuracaoUsinaObservacoesBaseId}-leasing-container`
  const configuracaoUsinaObservacoesVendaContainerId = `${configuracaoUsinaObservacoesBaseId}-venda-container`
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

  const getActiveBudgetId = useCallback(() => budgetIdRef.current, [])

  const switchBudgetId = useCallback(
    (nextId: string) => {
      const prevId = getActiveBudgetId()
      if (!nextId || nextId === prevId) {
        return
      }

      try {
        renameVendasSimulacao(prevId, nextId)
      } catch (error) {
        console.warn('[switchBudgetId] rename failed', error)
      }
      budgetIdTransitionRef.current = true
      budgetIdRef.current = nextId
      setCurrentBudgetId(nextId)
    },
    [getActiveBudgetId, renameVendasSimulacao],
  )

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

  useEffect(() => {
    if (isManualBudgetForced && modoOrcamento !== 'manual') {
      setModoOrcamento('manual')
    }
  }, [isManualBudgetForced, modoOrcamento])

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
  tipoInstalacaoOutro: string
  tipoSistema: TipoSistema
  consumoManual: boolean
  potenciaFonteManual: boolean
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
    tipoInstalacaoOutro: INITIAL_VALUES.tipoInstalacaoOutro,
    tipoSistema: INITIAL_VALUES.tipoSistema,
    consumoManual: false,
    potenciaFonteManual: false,
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

  const setPotenciaFonteManual = useCallback(
    (value: boolean) => {
      setPotenciaFonteManualState(value)
      updatePageSharedState((current) => {
        if (current.potenciaFonteManual === value) {
          return current
        }
        return { ...current, potenciaFonteManual: value }
      })
    },
    [updatePageSharedState],
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

  const [cliente, setCliente] = useState<ClienteDados>(() =>
    cloneClienteDados(CLIENTE_INICIAL),
  )
  const [clientesSalvos, setClientesSalvos] = useState<ClienteRegistro[]>([])
  const [clienteEmEdicaoId, setClienteEmEdicaoId] = useState<string | null>(null)
  const clienteEmEdicaoIdRef = useRef<string | null>(clienteEmEdicaoId)
  const lastSavedClienteRef = useRef<ClienteDados | null>(null)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHydratingRef = useRef(false)
  const [isHydrating, setIsHydrating] = useState(false)
  const isApplyingCepRef = useRef(false)
  const isEditingEnderecoRef = useRef(false)
  const lastCepAppliedRef = useRef<string>('')
  const isApplyingUcGeradoraCepRef = useRef(false)
  const lastUcGeradoraCepAppliedRef = useRef<string>('')
  const budgetIdMismatchLoggedRef = useRef(false)
  const novaPropostaEmAndamentoRef = useRef(false)

  // Refs to prevent stale closures in getCurrentSnapshot
  const clienteRef = useRef(cliente)
  const kcKwhMesRef = useRef(kcKwhMes)
  const pageSharedStateRef = useRef(pageSharedState)

  const setClienteSync = useCallback(
    (next: ClienteDados) => {
      clienteRef.current = next
      setCliente(next)
    },
    [setCliente],
  )

  const updateClienteSync = useCallback(
    (patch: Partial<ClienteDados>) => {
      const base = clienteRef.current ?? cliente
      const merged = { ...base, ...patch }
      clienteRef.current = merged
      setCliente(merged)
    },
    [cliente, setCliente],
  )

  const [clienteMensagens, setClienteMensagens] = useState<ClienteMensagens>({})
  const [ucsBeneficiarias, setUcsBeneficiarias] = useState<UcBeneficiariaFormState[]>([])
  const leasingContrato = useLeasingStore((state) => state.contrato)
  const leasingPrazoContratualMeses = useLeasingStore((state) => state.prazoContratualMeses)

  const distribuidorasDisponiveis = useMemo(() => {
    if (!ufTarifa) return [] as string[]
    return distribuidorasPorUf[ufTarifa] ?? []
  }, [distribuidorasPorUf, ufTarifa])

  const clienteUf = cliente.uf
  const clienteDistribuidorasDisponiveis = useMemo(() => {
    if (!clienteUf) return [] as string[]
    return distribuidorasPorUf[clienteUf] ?? []
  }, [clienteUf, distribuidorasPorUf])
  const isTitularDiferente = leasingContrato.ucGeradoraTitularDiferente === true
  const distribuidoraAneelEfetiva = useMemo(
    () =>
      getDistribuidoraAneelEfetiva({
        clienteDistribuidoraAneel: cliente.distribuidora,
        clienteUf: cliente.uf,
        titularUcGeradoraDistribuidoraAneel:
          leasingContrato.ucGeradoraTitularDistribuidoraAneel,
        titularUcGeradoraDiferente: leasingContrato.ucGeradoraTitularDiferente,
      }),
    [
      cliente.distribuidora,
      leasingContrato.ucGeradoraTitularDistribuidoraAneel,
      leasingContrato.ucGeradoraTitularDiferente,
    ],
  )
  const procuracaoUf = useMemo(() => {
    if (isTitularDiferente) {
      return (
        leasingContrato.ucGeradoraTitularDraft?.endereco.uf ??
        leasingContrato.ucGeradoraTitular?.endereco.uf ??
        ''
      )
    }
    return cliente.uf ?? ''
  }, [
    cliente.uf,
    isTitularDiferente,
    leasingContrato.ucGeradoraTitularDraft?.endereco.uf,
    leasingContrato.ucGeradoraTitular?.endereco.uf,
  ])
  const ucGeradoraTitularUf = (
    leasingContrato.ucGeradoraTitularDraft?.endereco.uf ??
    leasingContrato.ucGeradoraTitular?.endereco.uf ??
    ''
  )
    .trim()
    .toUpperCase()
  const ucGeradoraTitularDistribuidorasDisponiveis = useMemo(() => {
    if (!ucGeradoraTitularUf) return [] as string[]
    return distribuidorasPorUf[ucGeradoraTitularUf] ?? []
  }, [distribuidorasPorUf, ucGeradoraTitularUf])
  const disableClienteDistribuidora = isTitularDiferente
  const disableTitularDistribuidora = !isTitularDiferente
  const clienteDistribuidoraDisabled =
    disableClienteDistribuidora ||
    !cliente.uf ||
    clienteDistribuidorasDisponiveis.length === 0
  const titularDistribuidoraDisabled =
    disableTitularDistribuidora ||
    !ucGeradoraTitularUf ||
    ucGeradoraTitularDistribuidorasDisponiveis.length === 0

  const applyTarifasAutomaticas = useCallback(
    (row: MultiUcRowState, classe?: MultiUcClasse, force = false): MultiUcRowState => {
      const classeFinal = classe ?? row.classe
      const distribuidoraReferencia =
        distribuidoraAneelEfetiva && distribuidoraAneelEfetiva.trim()
          ? distribuidoraAneelEfetiva
          : 'DEFAULT'
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
    [distribuidoraAneelEfetiva, multiUcReferenciaData],
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

  const setTipoInstalacaoOutro = useCallback(
    (value: string) => {
      setTipoInstalacaoOutroState(value)
      updatePageSharedState((current) => {
        if (current.tipoInstalacaoOutro === value) {
          return current
        }
        return { ...current, tipoInstalacaoOutro: value }
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
    setTipoInstalacaoOutroState((prev) =>
      prev === snapshot.tipoInstalacaoOutro ? prev : snapshot.tipoInstalacaoOutro,
    )
    setTipoSistemaState((prev) => {
      const normalized = normalizeTipoSistemaValue(snapshot.tipoSistema) ?? prev
      return prev === normalized ? prev : normalized
    })
    setConsumoManualState((prev) => (prev === snapshot.consumoManual ? prev : snapshot.consumoManual))
    setPotenciaFonteManualState((prev) =>
      prev === snapshot.potenciaFonteManual ? prev : snapshot.potenciaFonteManual,
    )
    setPotenciaModuloDirtyState((prev) =>
      prev === snapshot.potenciaModuloDirty ? prev : snapshot.potenciaModuloDirty,
    )
    setTipoInstalacaoDirtyState((prev) =>
      prev === snapshot.tipoInstalacaoDirty ? prev : snapshot.tipoInstalacaoDirty,
    )
  }, [activeTab, pageSharedState])

  useEffect(() => {
    clienteEmEdicaoIdRef.current = clienteEmEdicaoId
  }, [clienteEmEdicaoId])

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])
  
  // Sync refs to prevent stale closures in getCurrentSnapshot
  useEffect(() => {
    clienteRef.current = cliente
  }, [cliente])
  
  useEffect(() => {
    kcKwhMesRef.current = kcKwhMes
  }, [kcKwhMes])
  
  useEffect(() => {
    pageSharedStateRef.current = pageSharedState
  }, [pageSharedState])

  useEffect(() => {
    if (isTitularDiferente) {
      return
    }
    const defaultDistribuidora = getDistribuidoraDefaultForUf(cliente.uf)
    if (!defaultDistribuidora) {
      return
    }
    if ((cliente.distribuidora ?? '').trim()) {
      return
    }
    updateClienteSync({ distribuidora: defaultDistribuidora })
  }, [cliente.distribuidora, cliente.uf, isTitularDiferente, updateClienteSync])

  useEffect(() => {
    budgetIdRef.current = currentBudgetId
    budgetIdTransitionRef.current = false
  }, [currentBudgetId])
  
  // Update prazoContratualMeses in leasing store when leasingPrazo (in years) changes
  useEffect(() => {
    const meses = leasingPrazo * 12
    leasingActions.update({ prazoContratualMeses: meses })
  }, [leasingPrazo])
  
  const clienteIndicacaoCheckboxId = useId()
  const clienteIndicacaoNomeId = useId()
  const clienteHerdeirosContentId = useId()
  const [clienteHerdeirosExpandidos, setClienteHerdeirosExpandidos] = useState(false)
  const [isImportandoClientes, setIsImportandoClientes] = useState(false)
  const clientesImportInputRef = useRef<HTMLInputElement | null>(null)
  const fecharClientesPainel = useCallback(() => {
    setActivePage(lastPrimaryPageRef.current)
  }, [setActivePage])

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
      herdeiros: Array.isArray(cliente.herdeiros)
        ? [...cliente.herdeiros]
        : [''],
    })
  }, [cliente])
  useEffect(() => {
    if (clienteHerdeirosExpandidos) {
      return
    }

    const lista = Array.isArray(cliente.herdeiros) ? cliente.herdeiros : []
    if (lista.some((nome) => typeof nome === 'string' && nome.trim().length > 0)) {
      setClienteHerdeirosExpandidos(true)
    }
  }, [cliente.herdeiros, clienteHerdeirosExpandidos])
  const [verificandoCidade, setVerificandoCidade] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const notificacaoSequencialRef = useRef(0)
  const notificacaoTimeoutsRef = useRef<Record<number, number>>({})

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

  const handleBudgetTotalValueChange = useCallback(
    (value: number | null) => {
      setKitBudget((prev) => {
        if (value === null) {
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
          if (
            prev.totalSource === null &&
            numbersAreClose(prev.total, 0) &&
            prev.totalInput === formattedZero
          ) {
            return prev
          }
          return {
            ...prev,
            totalInput: formattedZero,
            total: 0,
            totalSource: null,
          }
        }

        const normalized = normalizeCurrencyNumber(value)
        if (normalized === null) {
          const formattedZero = formatCurrencyInputValue(0)
          if (
            prev.totalSource === null &&
            numbersAreClose(prev.total, 0) &&
            prev.totalInput === formattedZero
          ) {
            return prev
          }
          return {
            ...prev,
            totalInput: formattedZero,
            total: 0,
            totalSource: null,
          }
        }

        const formatted = formatCurrencyInputValue(normalized)
        if (
          prev.totalSource === 'explicit' &&
          numbersAreClose(prev.total, normalized) &&
          prev.totalInput === formatted
        ) {
          return prev
        }
        return {
          ...prev,
          totalInput: formatted,
          total: normalized,
          totalSource: 'explicit',
        }
      })
    },
    [budgetItemsTotal],
  )

  const budgetTotalField = useBRNumberField({
    mode: 'money',
    value: kitBudget.total ?? null,
    onChange: handleBudgetTotalValueChange,
  })

  const kitBudgetTotal = useMemo(() => {
    if (kitBudget.totalSource === 'explicit') {
      return kitBudget.total ?? 0
    }
    if (budgetItemsTotal != null) {
      return budgetItemsTotal
    }
    if (kitBudget.total != null) {
      return kitBudget.total
    }
    return 0
  }, [budgetItemsTotal, kitBudget.total, kitBudget.totalSource])

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
    } else if (condicao === 'BOLETO') {
      const boletos = Number.isFinite(form.n_boletos) ? Number(form.n_boletos) : 0
      if (!boletos || boletos <= 0) {
        errors.n_boletos = 'Informe a quantidade de boletos.'
      }
    } else if (condicao === 'DEBITO_AUTOMATICO') {
      const debitos = Number.isFinite(form.n_debitos) ? Number(form.n_debitos) : 0
      if (!debitos || debitos <= 0) {
        errors.n_debitos = 'Informe a duração do débito automático.'
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

  const buildRequiredClientFields = useCallback(
    (mode: 'venda' | 'leasing') => {
      const input = {
        cliente,
        segmentoCliente,
        tipoEdificacaoOutro,
        leasingContrato,
      }
      return mode === 'venda'
        ? buildRequiredFieldsVenda(input)
        : buildRequiredFieldsLeasing(input)
    },
    [cliente, segmentoCliente, tipoEdificacaoOutro, leasingContrato],
  )

  const validateConsumoMinimoLeasing = useCallback(
    (mensagem: string) => {
      const consumoKwhMes = Number(kcKwhMes)
      if (!Number.isFinite(consumoKwhMes)) {
        adicionarNotificacao(mensagem, 'error')
        return false
      }
      if (consumoKwhMes < 300) {
        adicionarNotificacao(
          'O consumo médio do cliente está abaixo do perfil que a SolarInvest pode atender no leasing.',
          'error',
        )
        return false
      }
      return true
    },
    [adicionarNotificacao, kcKwhMes],
  )

  const validatePropostaLeasingMinimal = useCallback(() => {
    const nomeCliente = cliente.nome?.trim() ?? ''
    if (!nomeCliente) {
      adicionarNotificacao('Informe o Nome ou Razão Social para gerar a proposta.', 'error')
      return false
    }

    if (!validateConsumoMinimoLeasing('Informe o Consumo (kWh/mês) para gerar a proposta.')) {
      return false
    }

    return true
  }, [adicionarNotificacao, cliente.nome, validateConsumoMinimoLeasing])

  const guardClientFieldsOrReturn = useCallback(
    (mode: 'venda' | 'leasing') => {
      clearClientHighlights()
      const fields = buildRequiredClientFields(mode)
      const result = validateRequiredFields(fields)
      if (!result.ok) {
        const orderedSelectors = fields.map((field) => field.selector)
        highlightMissingFields(orderedSelectors, result.missingSelectors)
        adicionarNotificacao('Preencha os campos obrigatórios destacados.', 'error')
        return false
      }
      if (mode === 'venda' && isVendaDiretaTab && valorTotalPropostaNormalizado == null) {
        window.alert('Informe o Valor total da proposta para concluir a emissão.')
        return false
      }
      return true
    },
    [
      adicionarNotificacao,
      buildRequiredClientFields,
      isVendaDiretaTab,
      valorTotalPropostaNormalizado,
    ],
  )

  const validateClienteParaSalvar = useCallback(() => {
    const nomeCliente = cliente.nome?.trim() ?? ''
    if (!nomeCliente) {
      adicionarNotificacao('Informe o Nome ou Razão Social para salvar o cliente.', 'error')
      return false
    }

    const cidadeCliente = cliente.cidade?.trim() ?? ''
    if (!cidadeCliente) {
      adicionarNotificacao('Informe a Cidade para salvar o cliente.', 'error')
      return false
    }

    const consumoKwhMes = Number(kcKwhMes)
    if (Number.isFinite(consumoKwhMes) && consumoKwhMes > 0 && consumoKwhMes < 300) {
      adicionarNotificacao(
        'O consumo médio do cliente está abaixo do perfil que a SolarInvest pode atender no leasing.',
        'error',
      )
      return false
    }

    return true
  }, [adicionarNotificacao, cliente.cidade, cliente.nome, kcKwhMes])

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
    const mode = isVendaDiretaTab ? 'venda' : 'leasing'
    if (!guardClientFieldsOrReturn(mode)) {
      return
    }
    setRecalcularTick((prev) => prev + 1)
  }, [guardClientFieldsOrReturn, isVendaDiretaTab])

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
        const nextMutable = next as Record<keyof VendaForm, VendaForm[keyof VendaForm] | undefined>
        Object.entries(updates).forEach(([rawKey, value]) => {
          const key = rawKey as keyof VendaForm
          if (value === undefined) {
            if (next[key] !== undefined) {
              nextMutable[key] = value as VendaForm[typeof key] | undefined
              changed = true
            }
            return
          }
          if (next[key] !== value) {
            nextMutable[key] = value as VendaForm[typeof key]
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

  const tarifaCheiaField = useTarifaInputField(tarifaCheia, setTarifaCheia)
  const tarifaCheiaVendaField = useTarifaInputField(
    vendaForm.tarifa_cheia_r_kwh,
    (next) => {
      setTarifaCheia(next)
      applyVendaUpdates({ tarifa_cheia_r_kwh: next })
    },
  )

  const handlePotenciaInstaladaChange = useCallback(
    (value: string) => {
      if (!value) {
        setPotenciaFonteManual(false)
        setNumeroModulosManual('')
        applyVendaUpdates({ potencia_instalada_kwp: undefined })
        return
      }

      const parsed = Number(value)
      const normalized = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0

      setPotenciaFonteManual(true)

      if (normalized <= 0) {
        applyVendaUpdates({ potencia_instalada_kwp: undefined })
        return
      }

      applyVendaUpdates({ potencia_instalada_kwp: normalized })

      if (potenciaModulo > 0) {
        const modulos = Math.round((normalized * 1000) / potenciaModulo)
        if (Number.isFinite(modulos) && modulos > 0) {
          setNumeroModulosManual(Math.max(1, modulos))
        }
      }
    },
    [applyVendaUpdates, potenciaModulo, setNumeroModulosManual, setPotenciaFonteManual],
  )

  const handleTipoRedeSelection = useCallback(
    (value: TipoRede, controle: 'auto' | 'manual' = 'manual') => {
      if (controle === 'manual') {
        setTipoRedeControle('manual')
      }
      setTipoRede(value)
    },
    [],
  )

  function mapTipoLigacaoToRede(tipo: TipoLigacaoNorma): TipoRede {
    switch (tipo) {
      case 'MONOFASICO':
        return 'monofasico'
      case 'BIFASICO':
        return 'bifasico'
      case 'TRIFASICO':
        return 'trifasico'
      default:
        return 'monofasico'
    }
  }

  const applyNormativeAdjustment = useCallback(
    (params: { potenciaKw: number; tipoLigacao?: TipoLigacaoNorma }) => {
      const { potenciaKw, tipoLigacao } = params
      if (tipoLigacao) {
        handleTipoRedeSelection(mapTipoLigacaoToRede(tipoLigacao), 'manual')
      }
      handlePotenciaInstaladaChange(String(potenciaKw))
      return { potenciaKw, tipoLigacao }
    },
    [handlePotenciaInstaladaChange, handleTipoRedeSelection, mapTipoLigacaoToRede],
  )

  const [precheckClienteCiente, setPrecheckClienteCiente] = useState(false)
  const [precheckModalData, setPrecheckModalData] = useState<NormComplianceResult | null>(null)
  const [precheckModalClienteCiente, setPrecheckModalClienteCiente] = useState(false)
  const precheckDecisionResolverRef = useRef<((value: PrecheckDecision) => void) | null>(null)

  const buildPrecheckObservationText = useCallback(
    (params: {
      result: NormComplianceResult
      action: PrecheckDecisionAction
      clienteCiente: boolean
      potenciaAplicada?: number
      tipoLigacaoAplicada?: TipoLigacaoNorma
    }) => {
      const { result, action, clienteCiente, potenciaAplicada, tipoLigacaoAplicada } = params
      const tipoLabel = formatTipoLigacaoLabel(tipoLigacaoAplicada ?? result.tipoLigacao)
      const upgradeLabel =
        result.upgradeTo && result.upgradeTo !== result.tipoLigacao
          ? formatTipoLigacaoLabel(result.upgradeTo)
          : null

      const formatKw = (value?: number | null) =>
        value != null
          ? formatNumberBRWithOptions(value, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })
          : '—'

      const statusTextMap: Record<NormComplianceStatus, string> = {
        OK: 'dentro do limite do padrão',
        WARNING: 'regra provisória',
        FORA_DA_NORMA: 'acima do limite do padrão',
        LIMITADO: 'acima do limite mesmo com upgrade',
      }

      const baseLine = `Pré-check normativo (${result.uf}): potência informada ${formatKw(
        result.potenciaInversorKw,
      )} kW ${statusTextMap[result.status]} do padrão ${tipoLabel.toLowerCase()} (${formatKw(
        result.kwMaxPermitido,
      )} kW).`

      const recommendation = upgradeLabel && result.kwMaxUpgrade != null
        ? `Recomendação: upgrade do padrão de entrada para ${upgradeLabel.toLowerCase()} (até ${formatKw(
            result.kwMaxUpgrade,
          )} kW).`
        : 'Recomendação: sem upgrade sugerido para este caso.'

      const clienteCienteSuffix = action === 'proceed' ? ' Cliente ciente.' : ''

      return `${baseLine}\n${recommendation}${action === 'proceed' ? clienteCienteSuffix : ''}`
    },
    [],
  )

  const buildPrecheckObservationBlock = useCallback(
    (params: {
      result: NormComplianceResult
      action: PrecheckDecisionAction
      clienteCiente: boolean
      potenciaAplicada?: number
      tipoLigacaoAplicada?: TipoLigacaoNorma
    }) => buildPrecheckObservationText(params),
    [buildPrecheckObservationText],
  )

  const upsertPrecheckObservation = useCallback(
    (block: string) => {
      setConfiguracaoUsinaObservacoes((prev) => {
        const cleaned = prev.replace(/(^|\n)Pré-check normativo[\s\S]*?(?:\n{2,}|$)/g, '$1').trim()
        if (!cleaned) {
          return block
        }
        return `${cleaned}\n\n${block}`
      })
    },
    [setConfiguracaoUsinaObservacoes],
  )

  const requestPrecheckDecision = useCallback(
    (result: NormComplianceResult) =>
      new Promise<PrecheckDecision>((resolve) => {
        precheckDecisionResolverRef.current = resolve
        setPrecheckModalData(result)
        setPrecheckModalClienteCiente(precheckClienteCiente)
      }),
    [precheckClienteCiente],
  )

  const resolvePrecheckDecision = useCallback((decision: PrecheckDecision) => {
    precheckDecisionResolverRef.current?.(decision)
    precheckDecisionResolverRef.current = null
    setPrecheckModalData(null)
  }, [])

  const taxaMinimaCalculadaBase = useMemo(() => {
    const calculada = calcularTaxaMinima(tipoRede, Math.max(0, tarifaCheia))
    return Math.round(calculada * 100) / 100
  }, [tarifaCheia, tipoRede])
  const taxaMinimaAutoRef = useRef<number | null>(null)

  useEffect(() => {
    const taxaAtual = Number.isFinite(taxaMinima) ? Math.max(0, Number(taxaMinima)) : 0
    const vendaTaxaAtual = Number.isFinite(vendaForm.taxa_minima_mensal)
      ? Number(vendaForm.taxa_minima_mensal)
      : null
    const vendaTaxaEnergiaAtual = Number.isFinite(vendaForm.taxa_minima_r_mes)
      ? Number(vendaForm.taxa_minima_r_mes)
      : null
    const ultimaAuto = taxaMinimaAutoRef.current
    const deveAtualizarTaxaMinima =
      taxaMinimaInputEmpty || (ultimaAuto != null && numbersAreClose(taxaAtual, ultimaAuto))

    if (deveAtualizarTaxaMinima && !numbersAreClose(taxaAtual, taxaMinimaCalculadaBase)) {
      setTaxaMinimaInputEmpty(false)
      setTaxaMinima(taxaMinimaCalculadaBase)
    }

    if (!taxaMinimaInputEmpty) {
      const needsUpdate =
        vendaTaxaAtual == null ||
        vendaTaxaEnergiaAtual == null ||
        !numbersAreClose(vendaTaxaAtual, taxaAtual) ||
        !numbersAreClose(vendaTaxaEnergiaAtual, taxaAtual)
      if (needsUpdate) {
        applyVendaUpdates({
          taxa_minima_mensal: taxaAtual,
          taxa_minima_r_mes: taxaAtual,
        })
      }
    } else {
      const deveAtualizarVendaAuto =
        vendaTaxaAtual == null || ultimaAuto == null || numbersAreClose(vendaTaxaAtual, ultimaAuto)
      if (
        deveAtualizarVendaAuto &&
        !numbersAreClose(vendaTaxaAtual ?? 0, taxaMinimaCalculadaBase)
      ) {
        applyVendaUpdates({
          taxa_minima_mensal: taxaMinimaCalculadaBase,
          taxa_minima_r_mes: taxaMinimaCalculadaBase,
        })
      }
    }

    taxaMinimaAutoRef.current = taxaMinimaCalculadaBase
  }, [
    applyVendaUpdates,
    setTaxaMinima,
    setTaxaMinimaInputEmpty,
    taxaMinima,
    taxaMinimaCalculadaBase,
    taxaMinimaInputEmpty,
    vendaForm.taxa_minima_mensal,
    vendaForm.taxa_minima_r_mes,
  ])

  const resolveDefaultTusdSimultaneidade = useCallback((tipo: TipoClienteTUSD): number | null => {
    if (tipo === 'residencial') return 60
    if (tipo === 'comercial') return 70
    return null
  }, [])

  const setTusdSimultaneidadeFromSource = useCallback(
    (value: number | null, source: 'auto' | 'manual') => {
      const isManual = source === 'manual'
      if (tusdSimultaneidade === value) {
        setTusdSimultaneidadeManualOverride(isManual)
        return
      }
      setTusdSimultaneidade(value)
      setTusdSimultaneidadeManualOverride(isManual)
      if (value == null) {
        applyVendaUpdates({ tusd_simultaneidade: undefined })
      } else {
        applyVendaUpdates({ tusd_simultaneidade: value })
      }
    },
    [applyVendaUpdates, tusdSimultaneidade],
  )

  useEffect(() => {
    if (!tusdOpcoesExpandidas) {
      if (tusdSimultaneidadeManualOverride) {
        setTusdSimultaneidadeManualOverride(false)
      }
      return
    }
    if (tusdSimultaneidadeManualOverride) {
      return
    }
    const defaultSimultaneidade = resolveDefaultTusdSimultaneidade(tusdTipoCliente)
    setTusdSimultaneidadeFromSource(defaultSimultaneidade, 'auto')
  }, [
    resolveDefaultTusdSimultaneidade,
    setTusdSimultaneidadeFromSource,
    tusdOpcoesExpandidas,
    tusdSimultaneidadeManualOverride,
    tusdTipoCliente,
  ])

  const updateSegmentoCliente = useCallback(
    (value: SegmentoCliente, options: { updateVenda?: boolean } = {}) => {
      const shouldUpdateVenda = options.updateVenda ?? true
      if (segmentoCliente !== value) {
        setSegmentoCliente(value)
      }
      if (shouldUpdateVenda) {
        applyVendaUpdates({ segmento_cliente: value })
      }
    },
    [applyVendaUpdates, segmentoCliente, setSegmentoCliente],
  )

  const updateTusdTipoCliente = useCallback(
    (
      value: TipoClienteTUSD,
      options: { reset?: boolean; updateVenda?: boolean } = {},
    ) => {
      const shouldReset = options.reset ?? true
      const shouldUpdateVenda = options.updateVenda ?? true
      const changed = tusdTipoCliente !== value
      if (changed) {
        setTusdSimultaneidadeManualOverride(false)
        setTusdTipoCliente(value)
      }
      if (shouldUpdateVenda) {
        applyVendaUpdates({ tusd_tipo_cliente: value })
      }
      if (changed && shouldReset) {
        resetRetorno()
      }
    },
    [
      applyVendaUpdates,
      resetRetorno,
      setTusdSimultaneidadeManualOverride,
      setTusdTipoCliente,
      tusdTipoCliente,
    ],
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
    (novoValor: SegmentoCliente) => {
      // Marca que o usuário editou este campo
      syncStateRef.current.segmentEdited = true

      // Atualiza o estado original
      updateSegmentoCliente(novoValor)

      if (!isSegmentoCondominio(novoValor)) {
        const base = clienteRef.current ?? cliente
        if (base.nomeSindico || base.cpfSindico || base.contatoSindico) {
          setClienteSync({ ...base, nomeSindico: '', cpfSindico: '', contatoSindico: '' })
        }
      }

      // Se o outro lado NÃO foi editado manualmente, sincronizar
      if (!syncStateRef.current.tusdEdited) {
        updateTusdTipoCliente(novoValor)
      }

      resetRetorno?.()
    },
    [cliente, resetRetorno, setClienteSync, syncStateRef, updateSegmentoCliente, updateTusdTipoCliente],
  )

  const handleTusdTipoClienteChange = useCallback(
    (novoValor: TipoClienteTUSD) => {
      // Marca edição manual
      syncStateRef.current.tusdEdited = true

      updateTusdTipoCliente(novoValor)

      // Se o outro campo não tiver sido editado
      if (!syncStateRef.current.segmentEdited) {
        updateSegmentoCliente(novoValor as SegmentoCliente)
      }

      resetRetorno?.()
    },
    [resetRetorno, syncStateRef, updateSegmentoCliente, updateTusdTipoCliente],
  )

  const handleTipoSistemaChange = useCallback(
    (value: TipoSistema) => {
      setTipoSistema((prev) => (prev === value ? prev : value))
      applyVendaUpdates({ tipo_sistema: value })
    },
    [applyVendaUpdates, setTipoSistema],
  )

  const handleModoOrcamentoChange = useCallback(
    (value: 'auto' | 'manual') => {
      if (value === 'auto' && isManualBudgetForced) {
        return
      }
      setModoOrcamento(value)
    },
    [isManualBudgetForced],
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
        const resolved = normalizeTipoInstalacao(mergedParsed.tipo_instalacao)
        if (resolved && resolved !== tipoInstalacao) {
          setTipoInstalacao(resolved)
        }
        if (resolved === 'outros') {
          setTipoInstalacaoOutro(mergedParsed.tipo_instalacao)
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
      setTipoInstalacaoOutro,
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
        updates.n_boletos = undefined
        updates.n_debitos = undefined
      } else if (nextCondicao === 'PARCELADO') {
        updates.modo_pagamento = undefined
        updates.n_parcelas_fin = undefined
        updates.juros_fin_am_pct = undefined
        updates.juros_fin_aa_pct = undefined
        updates.entrada_financiamento = undefined
        updates.n_boletos = undefined
        updates.n_debitos = undefined
      } else if (nextCondicao === 'BOLETO') {
        updates.modo_pagamento = undefined
        updates.n_parcelas = undefined
        updates.juros_cartao_am_pct = undefined
        updates.juros_cartao_aa_pct = undefined
        updates.taxa_mdr_credito_parcelado_pct = undefined
        updates.n_parcelas_fin = undefined
        updates.juros_fin_am_pct = undefined
        updates.juros_fin_aa_pct = undefined
        updates.entrada_financiamento = undefined
        updates.n_boletos = vendaForm.n_boletos ?? 12
        updates.n_debitos = undefined
      } else if (nextCondicao === 'DEBITO_AUTOMATICO') {
        updates.modo_pagamento = undefined
        updates.n_parcelas = undefined
        updates.juros_cartao_am_pct = undefined
        updates.juros_cartao_aa_pct = undefined
        updates.taxa_mdr_credito_parcelado_pct = undefined
        updates.n_parcelas_fin = undefined
        updates.juros_fin_am_pct = undefined
        updates.juros_fin_aa_pct = undefined
        updates.entrada_financiamento = undefined
        updates.n_boletos = undefined
        updates.n_debitos = vendaForm.n_debitos ?? vendaForm.n_boletos ?? 12
      } else if (nextCondicao === 'FINANCIAMENTO') {
        updates.modo_pagamento = undefined
        updates.n_parcelas = undefined
        updates.juros_cartao_am_pct = undefined
        updates.juros_cartao_aa_pct = undefined
        updates.taxa_mdr_credito_parcelado_pct = undefined
        updates.n_boletos = undefined
        updates.n_debitos = undefined
      }
      applyVendaUpdates(updates)
    },
    [applyVendaUpdates, vendaForm.modo_pagamento, vendaForm.n_boletos, vendaForm.n_debitos],
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
        switchBudgetId(createDraftBudgetId())
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
  const [mostrarValorMercadoLeasing, setMostrarValorMercadoLeasing] = useState(
    INITIAL_VALUES.mostrarValorMercadoLeasing,
  )
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
  const [salvandoPropostaLeasing, setSalvandoPropostaLeasing] = useState(false)
  const [salvandoPropostaPdf, setSalvandoPropostaPdf] = useState(false)
  const [gerandoContratos, setGerandoContratos] = useState(false)
  const [isContractTemplatesModalOpen, setIsContractTemplatesModalOpen] = useState(false)
  const [isLeasingContractsModalOpen, setIsLeasingContractsModalOpen] = useState(false)
  const [leasingAnexosSelecionados, setLeasingAnexosSelecionados] = useState<LeasingAnexoId[]>(() =>
    getDefaultLeasingAnexos(leasingContrato.tipoContrato),
  )
  const [leasingAnexosAvailability, setLeasingAnexosAvailability] = useState<
    Record<LeasingAnexoId, boolean>
  >({})
  const [leasingAnexosLoading, setLeasingAnexosLoading] = useState(false)
  const [contractTemplatesCategory, setContractTemplatesCategory] =
    useState<ContractTemplateCategory>('vendas')
  const [contractTemplates, setContractTemplates] = useState<string[]>([])
  const [selectedContractTemplates, setSelectedContractTemplates] = useState<string[]>([])
  const [contractTemplatesLoading, setContractTemplatesLoading] = useState(false)
  const [contractTemplatesError, setContractTemplatesError] = useState<string | null>(null)
  const contratoClientePayloadRef = useRef<ClienteContratoPayload | null>(null)

  useEffect(() => {
    setLeasingAnexosSelecionados((prev) => {
      const anexosValidos = new Set(
        LEASING_ANEXOS_CONFIG.filter((anexo) =>
          anexo.tipos.includes(leasingContrato.tipoContrato),
        ).map((anexo) => anexo.id),
      )
      const filtrados = prev.filter((id) => anexosValidos.has(id))
      const baseSelecionados = filtrados.length > 0
        ? filtrados
        : getDefaultLeasingAnexos(leasingContrato.tipoContrato)
      return ensureRequiredLeasingAnexos(baseSelecionados, leasingContrato.tipoContrato)
    })
  }, [leasingContrato.tipoContrato])

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
    if (distribuidoraTarifa === distribuidoraAneelEfetiva) {
      return
    }
    setDistribuidoraTarifa(distribuidoraAneelEfetiva)
  }, [distribuidoraAneelEfetiva, distribuidoraTarifa, setDistribuidoraTarifa])

  useEffect(() => {
    let cancelado = false
    const uf = ufTarifa.trim()
    const dist = distribuidoraAneelEfetiva.trim()

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
  }, [distribuidoraAneelEfetiva, ufTarifa])

  useEffect(() => {
    const ufAtual = (ufTarifa || clienteUf || '').trim()
    if (!ufAtual) {
      return undefined
    }

    const distribuidoraAtual = distribuidoraAneelEfetiva.trim()
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
  }, [clienteUf, distribuidoraAneelEfetiva, ufTarifa])

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
      } else {
        document.documentElement.style.setProperty('--tabs-h', '0px')
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

  const vendaPotenciaCalculada = useMemo(() => {
    const dias = diasMesNormalizado > 0 ? diasMesNormalizado : DIAS_MES_PADRAO
    return calcPotenciaSistemaKwp({
      consumoKwhMes: kcKwhMes,
      irradiacao: baseIrradiacao,
      performanceRatio: eficienciaNormalizada,
      diasMes: dias,
      potenciaModuloWp: potenciaModulo,
    })
  }, [baseIrradiacao, diasMesNormalizado, eficienciaNormalizada, kcKwhMes, potenciaModulo])

  const numeroModulosInformado = useMemo(() => {
    if (typeof numeroModulosManual !== 'number') return null
    if (!Number.isFinite(numeroModulosManual) || numeroModulosManual <= 0) return null
    return Math.max(1, Math.round(numeroModulosManual))
  }, [numeroModulosManual])

  const numeroModulosCalculado = useMemo(() => {
    if (potenciaFonteManual) {
      const manual = Number(vendaForm.potencia_instalada_kwp)
      if (Number.isFinite(manual) && manual > 0 && potenciaModulo > 0) {
        const estimado = Math.round((manual * 1000) / potenciaModulo)
        if (Number.isFinite(estimado) && estimado > 0) {
          return estimado
        }
      }
    }

    if (vendaPotenciaCalculada?.quantidadeModulos) {
      return vendaPotenciaCalculada.quantidadeModulos
    }

    if (vendaPotenciaCalculada?.potenciaKwp && potenciaModulo > 0) {
      const estimado = Math.ceil((vendaPotenciaCalculada.potenciaKwp * 1000) / potenciaModulo)
      if (Number.isFinite(estimado) && estimado > 0) {
        return estimado
      }
    }

    return 0
  }, [
    potenciaFonteManual,
    potenciaModulo,
    vendaForm.potencia_instalada_kwp,
    vendaPotenciaCalculada?.potenciaKwp,
    vendaPotenciaCalculada?.quantidadeModulos,
  ])

  const potenciaInstaladaKwp = useMemo(() => {
    if (potenciaFonteManual) {
      const manual = Number(vendaForm.potencia_instalada_kwp)
      if (Number.isFinite(manual) && manual > 0) {
        return Math.round(manual * 100) / 100
      }
    }

    const modulos = numeroModulosInformado ?? numeroModulosCalculado
    if (modulos && potenciaModulo > 0) {
      return (modulos * potenciaModulo) / 1000
    }

    return vendaPotenciaCalculada?.potenciaKwp ?? 0
  }, [
    numeroModulosInformado,
    numeroModulosCalculado,
    potenciaModulo,
    potenciaFonteManual,
    vendaForm.potencia_instalada_kwp,
    vendaPotenciaCalculada?.potenciaKwp,
  ])
  const ufNorma = useMemo(() => {
    const uf =
      cliente.uf ||
      leasingContrato.ucGeradoraTitularDraft?.endereco.uf ||
      leasingContrato.ucGeradoraTitular?.endereco.uf ||
      ufTarifa
    return (uf ?? '').toUpperCase()
  }, [
    cliente.uf,
    leasingContrato.ucGeradoraTitular?.endereco.uf,
    leasingContrato.ucGeradoraTitularDraft?.endereco.uf,
    ufTarifa,
  ])
  const tipoLigacaoNorma = useMemo(() => normalizeTipoLigacaoNorma(tipoRede), [tipoRede])
  const normCompliance = useMemo<NormComplianceResult | null>(() => {
    return evaluateNormCompliance({
      uf: ufNorma,
      tipoLigacao: tipoLigacaoNorma,
      potenciaInversorKw: potenciaInstaladaKwp,
    })
  }, [potenciaInstaladaKwp, tipoLigacaoNorma, ufNorma])
  const tipoRedeCompatMessage = useMemo(() => {
    if (!normCompliance) {
      return ''
    }

    if (normCompliance.status === 'FORA_DA_NORMA' || normCompliance.status === 'LIMITADO') {
      return `Padrão de entrada: atenção — potência acima do limite do padrão atual (${normCompliance.uf}). Clique para revisar.`
    }

    return ''
  }, [normCompliance])
  const normComplianceBanner = useMemo(() => {
    if (!normCompliance) {
      return {
        tone: 'neutral',
        title: 'Pré-check normativo (padrão de entrada)',
        statusLabel: 'PENDENTE',
        message: 'Informe UF, tipo de rede e potência para validar o padrão de entrada.',
        details: [] as string[],
      }
    }

    const tipoLabel = formatTipoLigacaoLabel(normCompliance.tipoLigacao)
    const formatKw = (value?: number | null) =>
      value != null
        ? formatNumberBRWithOptions(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : null
    const details: string[] = []
    if (normCompliance.kwMaxPermitido != null) {
      const limiteLabel = formatKw(normCompliance.kwMaxPermitido)
      details.push(`Limite ${tipoLabel}: ${limiteLabel} kW.`)
    }
    if (normCompliance.upgradeTo && normCompliance.kwMaxUpgrade != null) {
      const limiteUpgradeLabel = formatKw(normCompliance.kwMaxUpgrade)
      details.push(
        `Upgrade sugerido: ${formatTipoLigacaoLabel(normCompliance.upgradeTo)} até ${limiteUpgradeLabel} kW.`,
      )
    }

    const statusMap = {
      OK: { tone: 'ok', label: 'Dentro do limite', message: 'Dentro do limite do padrão informado.' },
      WARNING: {
        tone: 'warning',
        label: 'Regra provisória',
        message: 'Regra provisória: valide com a distribuidora antes do envio.',
      },
      FORA_DA_NORMA: {
        tone: 'warning',
        label: 'Acima do limite',
        message: 'A potência informada está acima do limite do padrão atual.',
      },
      LIMITADO: {
        tone: 'danger',
        label: 'Acima do limite',
        message: 'A potência informada excede o limite mesmo com upgrade.',
      },
    } as const

    const statusInfo = statusMap[normCompliance.status]
    return {
      tone: statusInfo.tone,
      title: `Pré-check normativo (padrão de entrada)`,
      statusLabel: statusInfo.label,
      message: statusInfo.message,
      details,
    }
  }, [normCompliance, ufNorma])
  useEffect(() => {
    setPrecheckClienteCiente(false)
    setPrecheckModalClienteCiente(false)
  }, [
    normCompliance?.status,
    normCompliance?.uf,
    normCompliance?.tipoLigacao,
    normCompliance?.potenciaInversorKw,
    normCompliance?.kwMaxPermitido,
    normCompliance?.kwMaxUpgrade,
  ])

  const ensureNormativePrecheck = useCallback(async (): Promise<boolean> => {
    if (!normCompliance) {
      return true
    }

    if (normCompliance.status === 'OK' || normCompliance.status === 'WARNING') {
      return true
    }

    const decision = await requestPrecheckDecision(normCompliance)
    if (decision.action === 'cancel') {
      return false
    }

    if (decision.action === 'adjust_current') {
      const limite = normCompliance.kwMaxPermitido ?? normCompliance.potenciaInversorKw
      applyNormativeAdjustment({ potenciaKw: limite })
      await Promise.resolve()
      upsertPrecheckObservation(
        buildPrecheckObservationBlock({
          result: normCompliance,
          action: 'adjust_current',
          clienteCiente: decision.clienteCiente,
          potenciaAplicada: limite,
        }),
      )
      return true
    }

    if (decision.action === 'adjust_upgrade') {
      const limite =
        normCompliance.kwMaxUpgrade ?? normCompliance.kwMaxPermitido ?? normCompliance.potenciaInversorKw
      const tipo = normCompliance.upgradeTo ?? normCompliance.tipoLigacao
      applyNormativeAdjustment({ potenciaKw: limite, tipoLigacao: tipo })
      await Promise.resolve()
      upsertPrecheckObservation(
        buildPrecheckObservationBlock({
          result: normCompliance,
          action: 'adjust_upgrade',
          clienteCiente: decision.clienteCiente,
          potenciaAplicada: limite,
          tipoLigacaoAplicada: tipo,
        }),
      )
      return true
    }

    if (decision.action === 'proceed' && decision.clienteCiente) {
      setPrecheckClienteCiente(true)
      upsertPrecheckObservation(
        buildPrecheckObservationBlock({
          result: normCompliance,
          action: 'proceed',
          clienteCiente: decision.clienteCiente,
        }),
      )
      return true
    }

    return false
  }, [
    applyNormativeAdjustment,
    buildPrecheckObservationBlock,
    normCompliance,
    requestPrecheckDecision,
    setPrecheckClienteCiente,
    upsertPrecheckObservation,
  ])

  const numeroModulosEstimado = useMemo(() => {
    if (numeroModulosInformado) return numeroModulosInformado
    return numeroModulosCalculado
  }, [numeroModulosInformado, numeroModulosCalculado])

  const vendaAutoPotenciaKwp = useMemo(() => vendaPotenciaCalculada?.potenciaKwp ?? null, [
    vendaPotenciaCalculada?.potenciaKwp,
  ])

  const installTypeNormalized = useMemo<InstallType | null>(() => {
    if (tipoInstalacao === 'solo') return 'solo'
    if (tipoInstalacao === 'outros') return 'outros'
    return normalizeInstallType('telhado')
  }, [tipoInstalacao])

  const systemTypeNormalized = useMemo<SystemType | null>(
    () => normalizeSystemType(tipoSistema === 'OFF_GRID' ? 'offgrid' : tipoSistema.toLowerCase()),
    [tipoSistema],
  )

  const potenciaKwpElegivel = useMemo(
    () => (Number.isFinite(potenciaInstaladaKwp) && potenciaInstaladaKwp > 0 ? potenciaInstaladaKwp : null),
    [potenciaInstaladaKwp],
  )

  const tipoRedeAutoSugestao = useMemo<TipoRede | null>(() => {
    if (autoPricingRede) {
      return autoPricingRede === 'mono' ? 'monofasico' : 'trifasico'
    }

    if (!Number.isFinite(potenciaInstaladaKwp) || potenciaInstaladaKwp <= 0) {
      return null
    }

    const rede = getRedeByPotencia(potenciaInstaladaKwp)
    return rede === 'mono' ? 'monofasico' : 'trifasico'
  }, [autoPricingRede, potenciaInstaladaKwp])

  const autoBudgetFallbackMessage = useMemo(() => {
    switch (autoBudgetReasonCode) {
      case 'INSTALL_NOT_ELIGIBLE':
        return 'Instalação em solo/outros exige orçamento personalizado. Modo manual ativado.'
      case 'SYSTEM_NOT_ELIGIBLE':
        return 'Sistemas híbridos ou off-grid exigem orçamento personalizado. Modo manual ativado.'
      case 'KWP_LIMIT':
        return 'Para sistemas acima de 90 kWp, o orçamento é realizado de forma personalizada. Modo manual ativado.'
      case 'MISSING_SELECTION':
        return 'Selecione o tipo de instalação e o tipo de sistema para continuar.'
      default:
        return autoBudgetReason ?? ''
    }
  }, [autoBudgetReason, autoBudgetReasonCode])

  useEffect(() => {
    const eligibility = getAutoEligibility({
      installType: installTypeNormalized,
      systemType: systemTypeNormalized,
      kwp: potenciaKwpElegivel,
    })

    setAutoBudgetReason(eligibility.reason ?? null)
    setAutoBudgetReasonCode(eligibility.reasonCode ?? null)

    if (modoOrcamento !== 'auto') {
      setAutoKitValor(null)
      setAutoCustoFinal(null)
      setAutoPricingRede(null)
      setAutoPricingVersion(null)
      return
    }

    if (!eligibility.eligible) {
      if (modoOrcamento !== 'manual') {
        setModoOrcamento('manual')
      }
      setAutoKitValor(null)
      setAutoCustoFinal(null)
      setAutoPricingRede(null)
      setAutoPricingVersion(null)
      return
    }

    const pricing = potenciaKwpElegivel ? calcPricingPorKwp(potenciaKwpElegivel) : null
    if (!pricing) {
      setAutoKitValor(null)
      setAutoCustoFinal(null)
      setAutoPricingRede(null)
      setAutoPricingVersion(null)
      return
    }

    setAutoKitValor(pricing.kitValor)
    setAutoCustoFinal(pricing.custoFinal)
    setAutoPricingRede(pricing.rede)
    setAutoPricingVersion('pricing_kwp_v2')

  }, [
    installTypeNormalized,
    systemTypeNormalized,
    modoOrcamento,
    potenciaKwpElegivel,
    setModoOrcamento,
  ])

  const parseUcBeneficiariaConsumo = (valor: string): number => {
    const normalizado = valor.replace(/\./g, '').replace(',', '.')
    const parsed = Number(normalizado)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0
    }
    return parsed
  }

  const consumoTotalUcsBeneficiarias = ucsBeneficiarias.reduce(
    (acc, item) => acc + parseUcBeneficiariaConsumo(item.consumoKWh),
    0,
  )

  const consumoUcsExcedeInformado =
    kcKwhMes > 0 && consumoTotalUcsBeneficiarias > kcKwhMes

  const recalcularRateioAutomatico = (
    lista: UcBeneficiariaFormState[],
  ): UcBeneficiariaFormState[] => {
    const totalConsumo = lista.reduce(
      (acc, item) => acc + parseUcBeneficiariaConsumo(item.consumoKWh),
      0,
    )

    if (totalConsumo <= 0) {
      return lista
    }

    return lista.map((item) => {
      const consumo = parseUcBeneficiariaConsumo(item.consumoKWh)
      const percentual = consumo > 0 ? (consumo / totalConsumo) * 100 : 0
      const percentualFormatado = Number.isFinite(percentual)
        ? percentual.toFixed(2).replace('.', ',')
        : '0'
      return { ...item, rateioPercentual: percentualFormatado }
    })
  }

  const vendaQuantidadeModulos = useMemo(() => {
    const quantidade = vendaForm.quantidade_modulos
    if (!Number.isFinite(quantidade)) {
      return null
    }
    const resolved = Number(quantidade)
    return resolved > 0 ? resolved : null
  }, [vendaForm.quantidade_modulos, recalcularTick])

  const vendaGeracaoParametros = useMemo(
    () => ({
      hsp: baseIrradiacao > 0 ? baseIrradiacao : 0,
      pr: eficienciaNormalizada > 0 ? eficienciaNormalizada : 0,
    }),
    [baseIrradiacao, eficienciaNormalizada],
  )

  useEffect(() => {
    const tusdBase = vendaForm.tusd_tipo_cliente
      ? normalizeTipoBasico(vendaForm.tusd_tipo_cliente)
      : null
    const tusdValido: TipoClienteTUSD = tusdBase ?? INITIAL_VALUES.tusdTipoCliente
    const segmentoPreferido = TUSD_TO_SEGMENTO[tusdValido] ?? INITIAL_VALUES.segmentoCliente
    const segmentoAtual = vendaForm.segmento_cliente
      ? normalizeTipoBasico(vendaForm.segmento_cliente)
      : null
    const segmentoResolvido: SegmentoCliente = segmentoAtual ?? segmentoPreferido
    const tusdResolvido = SEGMENTO_TO_TUSD[segmentoResolvido] ?? INITIAL_VALUES.tusdTipoCliente

    updateSegmentoCliente(segmentoResolvido, {
      updateVenda: segmentoAtual !== segmentoResolvido,
    })
    updateTusdTipoCliente(tusdResolvido, {
      updateVenda: tusdBase !== tusdResolvido,
      reset: false,
    })
  }, [
    updateSegmentoCliente,
    updateTusdTipoCliente,
    vendaForm.segmento_cliente,
    vendaForm.tusd_tipo_cliente,
  ])

  useEffect(() => {
    const tipoAtual = normalizeTipoSistemaValue(vendaForm.tipo_sistema)
    if (tipoAtual && tipoAtual !== tipoSistema) {
      setTipoSistema(tipoAtual)
    }
  }, [setTipoSistema, tipoSistema, vendaForm.tipo_sistema])

  const areaInstalacao = useMemo(() => {
    if (numeroModulosEstimado <= 0) return 0
    const fator = tipoInstalacao === 'solo' ? 7 : 3.3
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

  const coletarAlertasProposta = useCallback(() => {
    const alertas: string[] = []

    if (consumoUcsExcedeInformado) {
      alertas.push(
        `A soma dos consumos das UCs beneficiárias (${formatNumberBRWithOptions(consumoTotalUcsBeneficiarias, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })} kWh/mês) excede o consumo mensal informado (${formatNumberBRWithOptions(kcKwhMes, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })} kWh/mês).`,
      )
    }

    return alertas
  }, [consumoTotalUcsBeneficiarias, consumoUcsExcedeInformado, kcKwhMes])

  const confirmarAlertasGerarProposta = useCallback(() => {
    const alertas = coletarAlertasProposta()

    if (!alertas.length) {
      return true
    }

    const mensagem = `${
      alertas.length === 1 ? 'Encontramos um alerta:' : 'Encontramos alguns alertas:'
    }\n\n- ${alertas.join('\n- ')}\n\nPressione "OK" para gerar a proposta assim mesmo ou "Cancelar" para voltar e ajustar os valores.`

    return window.confirm(mensagem)
  }, [coletarAlertasProposta])

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
    const aplicaTaxaMinima =
      typeof vendaForm.aplica_taxa_minima === 'boolean' ? vendaForm.aplica_taxa_minima : true
    const taxaMinimaCalculada = calcularTaxaMinima(tipoRede, Math.max(0, tarifaAtual))
    const taxaMinimaEnergia = aplicaTaxaMinima
      ? taxaMinimaInputEmpty
        ? taxaMinimaCalculada
        : Number.isFinite(taxaMinima)
          ? Math.max(0, taxaMinima)
          : 0
      : 0
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
      distribuidora: distribuidoraAneelEfetiva,
      irradiacao_kwhm2_dia: baseIrradiacao > 0 ? baseIrradiacao : 0,
      aplica_taxa_minima: aplicaTaxaMinima,
    })
  }, [
    baseIrradiacao,
    cliente.uf,
    distribuidoraAneelEfetiva,
    inflacaoAa,
    kcKwhMes,
    tarifaCheia,
    taxaMinima,
    taxaMinimaInputEmpty,
    vendaForm.consumo_kwh_mes,
    vendaForm.inflacao_energia_aa_pct,
    vendaForm.tarifa_r_kwh,
    vendaForm.aplica_taxa_minima,
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
        !potenciaFonteManual &&
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
    potenciaFonteManual,
    vendaForm.quantidade_modulos,
    recalcularTick,
  ])

  useEffect(() => {
    const { hsp, pr } = vendaGeracaoParametros
    if (hsp <= 0 || pr <= 0) {
      return
    }

    const potenciaManualValida =
      potenciaFonteManual &&
      Number.isFinite(vendaForm.potencia_instalada_kwp) &&
      (vendaForm.potencia_instalada_kwp ?? 0) > 0
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

    const potenciaNormalizadaAuto = potenciaBase ? Math.round(potenciaBase * 100) / 100 : 0
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
    potenciaFonteManual,
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
    () => Math.max(0, bandeiraEncargo + encargosFixosExtras),
    [bandeiraEncargo, encargosFixosExtras],
  )
  const cidKwhBase = useMemo(() => CONSUMO_MINIMO_FICTICIO[tipoRede] ?? 0, [tipoRede])

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
    const calculoAtual = tipoInstalacao === 'solo' ? composicaoSoloCalculo : composicaoTelhadoCalculo
    const valor = calculoAtual?.capex_base
    return Number.isFinite(valor ?? Number.NaN) ? Math.max(0, Number(valor)) : 0
  }, [capexBaseManualValor, tipoInstalacao, composicaoSoloCalculo, composicaoTelhadoCalculo])

  const margemOperacionalResumoValor = useMemo(() => {
    if (margemManualAtiva && margemManualValor !== undefined) {
      return margemManualValor
    }
    const calculoAtual = tipoInstalacao === 'solo' ? composicaoSoloCalculo : composicaoTelhadoCalculo
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
        tipoInstalacao === 'solo'
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
    const calculoAtual = tipoInstalacao === 'solo' ? composicaoSoloCalculo : composicaoTelhadoCalculo
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
        : (tipoInstalacao === 'solo'
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

  const valorVendaAtual = tipoInstalacao === 'solo' ? valorVendaSolo : valorVendaTelhado

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
    const aplicaTaxaMinima = vendaForm.aplica_taxa_minima ?? true
    const tusdPercentual = Math.max(0, tusdPercent)
    const tusdSubtipoNormalizado = tusdSubtipo.trim()
    const tusdSimValue = tusdSimultaneidade != null ? Math.max(0, tusdSimultaneidade) : null
    const tusdTarifaValue = tusdTarifaRkwh != null ? Math.max(0, tusdTarifaRkwh) : null
    const tusdAno = Number.isFinite(tusdAnoReferencia)
      ? Math.max(1, Math.trunc(tusdAnoReferencia))
      : DEFAULT_TUSD_ANO_REFERENCIA
    const taxaMinimaCalculadaBase = calcularTaxaMinima(tipoRede, Math.max(0, tarifaCheia))
    const taxaMinimaFonte = taxaMinimaInputEmpty
      ? taxaMinimaCalculadaBase
      : Number.isFinite(taxaMinima)
        ? Math.max(0, taxaMinima)
        : 0
    return {
      kcKwhMes: Math.max(0, kcKwhMes),
      tarifaCheia: Math.max(0, tarifaCheia),
      desconto: descontoDecimal,
      inflacaoAa: inflacaoAnual,
      prazoMeses: prazoMensalidades,
      taxaMinima: taxaMinimaFonte,
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
      consumoMensalKwh: Math.max(0, kcKwhMes),
      mesReajuste: Math.min(Math.max(Math.round(mesReajuste) || 6, 1), 12),
      mesReferencia: Math.min(Math.max(Math.round(mesReferencia) || 1, 1), 12),
      tusdPercent: tusdPercentual,
      tusdPercentualFioB: tusdPercentual,
      tusdTipoCliente,
      tusdSubtipo: tusdSubtipoNormalizado.length > 0 ? tusdSubtipoNormalizado : null,
      tusdSimultaneidade: tusdSimValue,
      tusdTarifaRkwh: tusdTarifaValue,
      tusdAnoReferencia: tusdAno,
      aplicaTaxaMinima,
      cidKwhBase,
      tipoRede,
    }
  }, [
    bandeiraEncargo,
    capex,
    cashbackPct,
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
    taxaMinimaInputEmpty,
    tributosAa,
    encargosFixosExtras,
    depreciacaoAa,
    duracaoMeses,
    cidKwhBase,
    tusdPercent,
    tusdTipoCliente,
    tusdSubtipo,
    tusdSimultaneidade,
    tusdTarifaRkwh,
    tusdAnoReferencia,
    vendaForm.aplica_taxa_minima,
    tipoRede,
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
    const aplicaTaxaMinima = simulationState.aplicaTaxaMinima ?? true

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
        const aplicaTaxaMinimaNoMes = aplicaTaxaMinima || mes > contratoMeses
        const encargosFixosAplicados = aplicaTaxaMinimaNoMes ? encargosFixos : 0
        const taxaMinimaMes = calcularTaxaMinima(tipoRede, tarifaCheiaMes)
        const taxaMinimaAplicada = aplicaTaxaMinimaNoMes
          ? Math.max(0, taxaMinima) > 0
            ? Math.max(0, taxaMinima)
            : taxaMinimaMes
          : 0
        const cidAplicado = aplicaTaxaMinimaNoMes ? simulationState.cidKwhBase * tarifaCheiaMes : 0
        const custoSemSistemaMes =
          kcKwhMes * tarifaCheiaMes + encargosFixosAplicados + taxaMinimaAplicada + cidAplicado
        const dentroPrazoMes = contratoMeses > 0 ? mes <= contratoMeses : false
        const custoComSistemaEnergiaMes = dentroPrazoMes ? kcKwhMes * tarifaDescontadaMes : 0
        const custoComSistemaBaseMes =
          custoComSistemaEnergiaMes + encargosFixosAplicados + taxaMinimaAplicada + cidAplicado
        const tusdMes = aplicaTaxaMinimaNoMes
          ? calcTusdEncargoMensal({
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
          : 0
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
      const taxaMinimaAno = Math.max(0, taxaMinima) > 0
        ? Math.max(0, taxaMinima)
        : calcularTaxaMinima(tipoRede, tarifaAno(ano))
      const custoSemSistemaMensal = Math.max(kcKwhMes * tarifaAno(ano), taxaMinimaAno)
      const economiaAnual = 12 * Math.max(custoSemSistemaMensal - taxaMinimaAno, 0)
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
    const aplicaTaxaMinima = simulationState.aplicaTaxaMinima ?? true
    const margemMinimaBase = aplicaTaxaMinima
      ? Math.max(0, simulationState.taxaMinima) + Math.max(0, simulationState.encargosFixos)
      : 0
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
      const cidMensal = aplicaTaxaMinima ? Math.max(0, simulationState.cidKwhBase) * tarifaCheiaMes : 0
      const margemMinima = margemMinimaBase + cidMensal
      const mensalidadeCheia = Number(
        Math.max(0, energiaCheia + margemMinima + manutencaoPrevencaoSeguroMensal).toFixed(2),
      )
      const tusdMensal = aplicaTaxaMinima
        ? calcTusdEncargoMensal({
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
        : 0
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

    const tarifaPrimeiroMes = tarifaProjetadaCheia(
      simulationState.tarifaCheia,
      simulationState.inflacaoAa,
      1,
      simulationState.mesReajuste,
      simulationState.mesReferencia,
    )
    const margemMinimaResumo = aplicaTaxaMinima
      ? margemMinimaBase + simulationState.cidKwhBase * tarifaPrimeiroMes
      : 0

    return {
      lista,
      tarifaDescontadaBase: selectTarifaDescontada(simulationState, 1),
      kcAjustado,
      creditoMensal: creditoEntradaMensal,
      margemMinima: margemMinimaResumo,
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

      const segmentoSnapshot = normalizeSegmentoClienteValue(
        vendaSnapshot.configuracao.segmento,
      )
      const segmentoFromForm = isVendaDiretaTab
        ? normalizeSegmentoClienteValue(vendaForm.segmento_cliente)
        : undefined
      const segmentoPrintable = segmentoSnapshot ?? segmentoFromForm ?? segmentoCliente

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
        validade_proposta_dias: vendasConfig.validade_proposta_dias,
      }

      const sanitizeNonNegativeNumber = (value: unknown): number | null =>
        Number.isFinite(value) ? Math.max(0, Number(value)) : null

      const sanitizeText = (value?: string | null): string | null => {
        if (typeof value !== 'string') {
          return null
        }
        const trimmed = value.trim()
        return trimmed ? trimmed : null
      }

      const tarifaCheiaAtual = sanitizeNonNegativeNumber(tarifaCheia)
      const tarifaFormulario = sanitizeNonNegativeNumber(vendaForm.tarifa_cheia_r_kwh)
      const tarifaSnapshot = sanitizeNonNegativeNumber(vendaSnapshot.parametros.tarifa_r_kwh)

      const energiaContratadaAtual = sanitizeNonNegativeNumber(kcKwhMes)
      const energiaContratadaSnapshotResultado = sanitizeNonNegativeNumber(
        vendaSnapshot.resultados.energia_contratada_kwh_mes,
      )
      const energiaContratadaSnapshotParametro = sanitizeNonNegativeNumber(
        vendaSnapshot.parametros.consumo_kwh_mes,
      )

      const distribuidoraAtual = sanitizeText(distribuidoraAneelEfetiva)
      const clienteDistribuidoraAtual = sanitizeText(cliente.distribuidora)
      const distribuidoraSnapshot = sanitizeText(vendaSnapshot.parametros.distribuidora)

      const formatClienteEnderecoCompleto = (): string => {
        const enderecoPrincipal = sanitizeText(cliente.endereco)
        const cidade = sanitizeText(cliente.cidade)
        const uf = sanitizeText(cliente.uf)
        const cep = sanitizeText(cliente.cep)
        const partes: string[] = []
        if (enderecoPrincipal) {
          partes.push(enderecoPrincipal)
        }
        if (cidade || uf) {
          if (cidade && uf) {
            partes.push(`${cidade} / ${uf}`)
          } else if (cidade) {
            partes.push(cidade)
          } else if (uf) {
            partes.push(uf)
          }
        }
        if (cep) {
          partes.push(`CEP ${cep}`)
        }
        return partes.join(' • ')
      }

      const ucGeradoraTitularAtivo =
        !isVendaDiretaTab &&
        leasingContrato.ucGeradoraTitularDiferente &&
        Boolean(leasingContrato.ucGeradoraTitular)
      const ucGeradoraTitularEndereco = ucGeradoraTitularAtivo
        ? sanitizeText(formatUcGeradoraTitularEndereco(leasingContrato.ucGeradoraTitular?.endereco))
        : null
      const ucGeradoraTitularPrintable: PrintableUcGeradoraTitular | null = ucGeradoraTitularAtivo
        ? {
            nomeCompleto: sanitizeText(leasingContrato.ucGeradoraTitular?.nomeCompleto) ?? '',
            cpf: sanitizeText(leasingContrato.ucGeradoraTitular?.cpf) ?? '',
            rg: sanitizeText(leasingContrato.ucGeradoraTitular?.rg) ?? '',
            endereco: ucGeradoraTitularEndereco ?? '',
          }
        : null
      const ucGeradoraNumero = sanitizeText(cliente.uc) ?? ''
      const ucGeradoraEndereco = ucGeradoraTitularEndereco ?? formatClienteEnderecoCompleto()
      const ucGeradoraPrintable: PrintableUcGeradora | null =
        ucGeradoraNumero || ucGeradoraEndereco
          ? { numero: ucGeradoraNumero, endereco: ucGeradoraEndereco }
          : null

      const normalizeRateioPercent = (valor: string): number | null => {
        if (typeof valor !== 'string') {
          return null
        }
        const trimmed = valor.trim()
        if (!trimmed) {
          return null
        }
        const normalized = trimmed.replace(/%/g, '').replace(',', '.')
        const parsed = Number(normalized)
        if (!Number.isFinite(parsed)) {
          return null
        }
        return parsed
      }

      const normalizeConsumoKWh = (valor: string): number | null => {
        if (typeof valor !== 'string') {
          return null
        }
        const trimmed = valor.trim()
        if (!trimmed) {
          return null
        }
        const normalized = trimmed.replace(/\./g, '').replace(',', '.')
        const parsed = Number(normalized)
        if (!Number.isFinite(parsed)) {
          return null
        }
        return parsed
      }

      const ucsBeneficiariasPrintable: PrintableUcBeneficiaria[] = ucsBeneficiarias
        .map((item) => {
          const numero = sanitizeText(item.numero) ?? ''
          const endereco = sanitizeText(item.endereco) ?? ''
          const rateio = normalizeRateioPercent(item.rateioPercentual)
          const consumo = normalizeConsumoKWh(item.consumoKWh)
          if (!numero && !endereco && rateio == null && consumo == null) {
            return null
          }
          return {
            numero,
            endereco,
            consumoKWh: consumo,
            rateioPercentual: rateio,
          }
        })
        .filter((item): item is PrintableUcBeneficiaria => Boolean(item))

      const tipoEdificacaoCodigo = segmentoPrintable ?? null
      const tipoEdificacaoLabel =
        segmentoPrintable != null ? mapTipoBasicoToLabel(segmentoPrintable) : null
      const tipoEdificacaoOutroPrintable =
        segmentoPrintable === 'outros' ? tipoEdificacaoOutro.trim() || null : null
      const tusdTipoClienteCodigo = tusdTipoCliente ?? null
      const tusdTipoClienteLabel = mapTipoBasicoToLabel(tusdTipoCliente)
      const tusdTipoClienteOutro = tusdTipoCliente === 'outros' ? tusdSubtipo || null : null
      const formatOutroDescricao = (
        codigo: string | null | undefined,
        outro: string | null | undefined,
        label: string | null | undefined,
      ) => {
        if (codigo === 'outros') {
          const outroTexto = (outro ?? '').trim()
          return outroTexto ? `Outros (${outroTexto})` : 'Outros'
        }
        return label ?? '—'
      }

      const tipoInstalacaoLabel = mapTipoToLabel(tipoInstalacao, TIPOS_INSTALACAO)
      const tipoInstalacaoOutroTrimmed = tipoInstalacaoOutro.trim()
      const tipoInstalacaoOutroPrintable =
        tipoInstalacao === 'outros' ? tipoInstalacaoOutroTrimmed || null : null
      const tipoInstalacaoCompleto = formatOutroDescricao(
        tipoInstalacao,
        tipoInstalacaoOutroPrintable,
        tipoInstalacaoLabel,
      )
      const tipoEdificacaoCompleto = formatOutroDescricao(
        tipoEdificacaoCodigo,
        tipoEdificacaoOutroPrintable,
        tipoEdificacaoLabel,
      )
      const tusdTipoClienteCompleto = formatOutroDescricao(
        tusdTipoClienteCodigo,
        tusdTipoClienteOutro,
        tusdTipoClienteLabel,
      )

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
        tipoInstalacaoCodigo: tipoInstalacao,
        tipoInstalacaoLabel,
        tipoInstalacaoOutro: tipoInstalacaoOutroPrintable,
        tipoInstalacaoCompleto,
        tipoSistema: tipoSistemaPrintable,
        tipoRede,
        segmentoCliente: segmentoPrintable,
        tipoEdificacaoCodigo,
        tipoEdificacaoLabel,
        tipoEdificacaoOutro: tipoEdificacaoOutroPrintable,
        tipoEdificacaoCompleto,
        tusdTipoClienteCodigo,
        tusdTipoClienteLabel,
        tusdTipoClienteOutro,
        tusdTipoClienteCompleto,
        areaInstalacao,
        descontoContratualPct: descontoConsiderado,
        parcelasLeasing: isVendaDiretaTab ? [] : parcelasSolarInvest.lista,
        leasingValorDeMercadoEstimado: isVendaDiretaTab
          ? null
          : leasingValorDeMercadoEstimado || 0,
        mostrarValorMercadoLeasing: isVendaDiretaTab ? false : mostrarValorMercadoLeasing,
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
          distribuidoraAtual ?? clienteDistribuidoraAtual ?? distribuidoraSnapshot ?? '',
        energiaContratadaKwh:
          energiaContratadaAtual ??
          energiaContratadaSnapshotResultado ??
          energiaContratadaSnapshotParametro ??
          0,
        tarifaCheia:
          tarifaCheiaAtual ??
          tarifaFormulario ??
          tarifaSnapshot ??
          0,
        vendaResumo,
        parsedPdfVenda: parsedVendaPdf ? { ...parsedVendaPdf } : null,
        orcamentoItens: printableBudgetItems,
        composicaoUfv: composicaoResumo,
        vendaSnapshot,
        multiUcResumo: multiUcPrintableResumo,
        vendasConfigSnapshot: printableVendasConfig,
        informacoesImportantesObservacao: vendasConfig.observacao_padrao_proposta,
        configuracaoUsinaObservacoes:
          configuracaoUsinaObservacoes.trim()
            ? configuracaoUsinaObservacoes.trim()
            : null,
        orcamentoModo: modoOrcamento,
        orcamentoAutoCustoFinal: autoCustoFinal ?? null,
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
        imagensInstalacao: propostaImagens.map((imagem) => ({ ...imagem })),
        ucGeradora: ucGeradoraPrintable,
        ucGeradoraTitular: ucGeradoraTitularPrintable,
        ucsBeneficiarias: ucsBeneficiariasPrintable,
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
      distribuidoraAneelEfetiva,
      tipoInstalacao,
      tipoInstalacaoOutro,
      tipoSistema,
      segmentoCliente,
      tusdSubtipo,
      tusdTipoCliente,
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
      propostaImagens,
      configuracaoUsinaObservacoes,
      ucsBeneficiarias,
      vendaSnapshotSignal,
      leasingSnapshotSignal,
      leasingContrato,
    ],
  )

  const resolvePreviewToolbarMessage = useCallback(
    (customMessage?: string) => {
      const trimmedMessage = customMessage?.trim()

      if (proposalPdfIntegrationAvailable) {
        return trimmedMessage || DEFAULT_PREVIEW_TOOLBAR_MESSAGE
      }

      if (!trimmedMessage || trimmedMessage === PROPOSAL_PDF_REMINDER_MESSAGE) {
        return PROPOSAL_PDF_REMINDER_MESSAGE
      }

      return `${trimmedMessage} ${PROPOSAL_PDF_REMINDER_MESSAGE}`
    },
    [proposalPdfIntegrationAvailable],
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

      const mensagemToolbar = resolvePreviewToolbarMessage(actionMessage)
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
    [resolvePreviewToolbarMessage],
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

    const sanitizedLayoutHtml = sanitizePrintableHtml(layoutHtml)

    if (!sanitizedLayoutHtml) {
      return null
    }

    return { html: sanitizedLayoutHtml, dados: dadosParaImpressao }
  }, [printableData])


  const mapClienteRegistroToSyncPayload = (
    registro: ClienteRegistro,
  ): ClienteRegistroSyncPayload => ({
    id: registro.id,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
    dados: cloneClienteDados(registro.dados),
    propostaSnapshot: registro.propostaSnapshot
      ? cloneSnapshotData(registro.propostaSnapshot)
      : undefined,
  })

  const parseClientesSalvos = useCallback((existenteRaw: string | null): ClienteRegistro[] => {
    if (!existenteRaw) {
      return []
    }

    try {
      const parsed = JSON.parse(existenteRaw)
      if (!Array.isArray(parsed)) {
        return []
      }

      const { registros, houveAtualizacaoIds } = normalizeClienteRegistros(parsed)

      if (houveAtualizacaoIds) {
        try {
          window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(registros))
        } catch (error) {
          console.warn('Não foi possível atualizar os identificadores dos clientes salvos.', error)
        }
      }

      return registros
    } catch (error) {
      console.warn('Não foi possível interpretar os clientes salvos existentes.', error)
      return []
    }
  }, [])

  const getUltimaAtualizacao = useCallback((registros: ClienteRegistro[]) => {
    return registros.reduce((maisRecente, registro) => {
      if (!maisRecente || registro.atualizadoEm > maisRecente) {
        return registro.atualizadoEm
      }
      return maisRecente
    }, '')
  }, [])

  const carregarClientesSalvos = useCallback((): ClienteRegistro[] => {
    if (typeof window === 'undefined') {
      return []
    }

    return parseClientesSalvos(window.localStorage.getItem(CLIENTES_STORAGE_KEY))
  }, [parseClientesSalvos])

  const carregarClientesPrioritarios = useCallback(async (): Promise<ClienteRegistro[]> => {
    if (typeof window === 'undefined') {
      return []
    }

    try {
      const remotoRaw = await fetchRemoteStorageEntry(CLIENTES_STORAGE_KEY, { timeoutMs: 4000 })
      const registrosLocais = carregarClientesSalvos()
      if (remotoRaw === null) {
        if (registrosLocais.length > 0) {
          await persistRemoteStorageEntry(CLIENTES_STORAGE_KEY, JSON.stringify(registrosLocais))
          return registrosLocais
        }

        window.localStorage.removeItem(CLIENTES_STORAGE_KEY)
        return []
      }
      if (remotoRaw !== undefined) {
        const registrosRemotos = parseClientesSalvos(remotoRaw)
        const ultimaAtualizacaoRemota = getUltimaAtualizacao(registrosRemotos)
        const ultimaAtualizacaoLocal = getUltimaAtualizacao(registrosLocais)

        if (ultimaAtualizacaoLocal && ultimaAtualizacaoLocal > ultimaAtualizacaoRemota) {
          await persistRemoteStorageEntry(CLIENTES_STORAGE_KEY, JSON.stringify(registrosLocais))
          return registrosLocais
        }

        window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(registrosRemotos))
        return registrosRemotos
      }
    } catch (error) {
      console.warn('Não foi possível carregar clientes do armazenamento remoto.', error)
    }

    try {
      const oneDrivePayload = await loadClientesFromOneDrive()
      if (oneDrivePayload !== null && oneDrivePayload !== undefined) {
        const raw =
          typeof oneDrivePayload === 'string'
            ? oneDrivePayload
            : JSON.stringify(oneDrivePayload)
        const registros = parseClientesSalvos(raw)
        window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(registros))
        return registros
      }
    } catch (error) {
      if (error instanceof OneDriveIntegrationMissingError) {
        console.info('Leitura via OneDrive ignorada: integração não configurada.')
      } else {
        console.warn('Não foi possível carregar clientes via OneDrive.', error)
      }
    }

    return carregarClientesSalvos()
  }, [carregarClientesSalvos, getUltimaAtualizacao, parseClientesSalvos])

  useEffect(() => {
    let cancelado = false
    const carregar = async () => {
      const registros = await carregarClientesPrioritarios()
      if (cancelado) {
        return
      }
      setClientesSalvos(registros)
      await ensureServerStorageSync({ timeoutMs: 4000 })
      if (typeof window !== 'undefined') {
        try {
          if (registros.length > 0) {
            window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(registros))
          } else {
            window.localStorage.removeItem(CLIENTES_STORAGE_KEY)
          }
        } catch (error) {
          console.warn('Não foi possível atualizar o armazenamento remoto com os clientes atuais.', error)
        }
      }
    }
    carregar()
    return () => {
      cancelado = true
    }
  }, [carregarClientesPrioritarios])

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
  const [isEnviarPropostaModalOpen, setIsEnviarPropostaModalOpen] = useState(false)
  const [contatoEnvioSelecionadoId, setContatoEnvioSelecionadoId] = useState<string | null>(null)
  const contatosEnvio = useMemo<PropostaEnvioContato[]>(() => {
    const mapa = new Map<string, PropostaEnvioContato>()

    const adicionarContato = (
      contato: Omit<PropostaEnvioContato, 'id'> & { id?: string },
    ) => {
      const telefone = contato.telefone?.trim() ?? ''
      const telefoneDigits = telefone ? normalizeNumbers(telefone) : ''
      const chave = telefoneDigits ? `fone-${telefoneDigits}` : contato.id ?? ''
      if (!chave) {
        return
      }

      const existente = mapa.get(chave)
      if (existente) {
        const nome = contato.nome?.trim()
        if (nome && !existente.nome) {
          existente.nome = nome
        }
        if (telefone && !existente.telefone) {
          existente.telefone = telefone
        }
        if (contato.email && !existente.email) {
          existente.email = contato.email
        }
        return
      }

      mapa.set(chave, {
        id: chave,
        nome: contato.nome?.trim() || '',
        telefone,
        email: contato.email?.trim() || undefined,
        origem: contato.origem,
      })
    }

    const nomeAtual = cliente.nome?.trim()
    const telefoneAtual = cliente.telefone?.trim()
    const emailAtual = cliente.email?.trim()
    if (nomeAtual || telefoneAtual || emailAtual) {
      adicionarContato({
        id: 'cliente-atual',
        nome: nomeAtual || 'Cliente atual',
        telefone: telefoneAtual || '',
        email: emailAtual || undefined,
        origem: 'cliente-atual',
      })
    }

    clientesSalvos.forEach((registro) => {
      const dados = registro.dados
      const telefone = dados.telefone?.trim() ?? ''
      const email = dados.email?.trim()
      const nome = dados.nome?.trim()
      if (nome || telefone || email) {
        adicionarContato({
          id: registro.id,
          nome: nome || 'Cliente salvo',
          telefone,
          email: email || undefined,
          origem: 'cliente-salvo',
        })
      }
    })

    crmDataset.leads.forEach((lead) => {
      const nome = lead.nome?.trim()
      const telefone = lead.telefone?.trim()
      const email = lead.email?.trim()
      if (nome || telefone || email) {
        adicionarContato({
          id: lead.id,
          nome: nome || 'Lead sem nome',
          telefone: telefone || '',
          email: email || undefined,
          origem: 'crm',
        })
      }
    })

    return Array.from(mapa.values())
  }, [cliente, clientesSalvos, crmDataset.leads])

  const contatoEnvioSelecionado = useMemo(() => {
    if (!contatoEnvioSelecionadoId) {
      return null
    }
    return contatosEnvio.find((contato) => contato.id === contatoEnvioSelecionadoId) ?? null
  }, [contatoEnvioSelecionadoId, contatosEnvio])

  useEffect(() => {
    if (contatosEnvio.length === 0) {
      setContatoEnvioSelecionadoId(null)
      return
    }

    setContatoEnvioSelecionadoId((prev) => {
      if (prev && contatosEnvio.some((contato) => contato.id === prev)) {
        return prev
      }
      return contatosEnvio[0]?.id ?? null
    })
  }, [contatosEnvio])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storageKey = STORAGE_KEYS.proposalPdfReminderAt

    if (proposalPdfIntegrationAvailable) {
      try {
        window.localStorage.removeItem(storageKey)
      } catch (error) {
        console.warn('Não foi possível limpar o lembrete da integração de PDF.', error)
      }
      return
    }

    try {
      const raw = window.localStorage.getItem(storageKey)
      const lastReminder = raw ? Number(raw) : NaN
      const now = Date.now()

      if (!Number.isFinite(lastReminder) || now - lastReminder >= PROPOSAL_PDF_REMINDER_INTERVAL_MS) {
        adicionarNotificacao(PROPOSAL_PDF_REMINDER_MESSAGE, 'error')
        window.localStorage.setItem(storageKey, String(now))
      }
    } catch (error) {
      console.warn('Não foi possível registrar o lembrete da integração de PDF.', error)
    }
  }, [proposalPdfIntegrationAvailable, adicionarNotificacao])

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
    <div className="crm-page">
      <div className="crm-main">
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
                      name="crm-nome"
                      id="crm-nome"
                      value={crmLeadForm.nome}
                      onChange={(event) => handleCrmLeadFormChange('nome', event.target.value)}
                      placeholder="Nome do contato"
                      required
                    />
                  </label>
                  <label>
                    Telefone / WhatsApp
                    <input
                      name="crm-telefone"
                      id="crm-telefone"
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
                      name="crm-cidade"
                      id="crm-cidade"
                      value={crmLeadForm.cidade}
                      onChange={(event) => handleCrmLeadFormChange('cidade', event.target.value)}
                      placeholder="Cidade do projeto"
                      required
                    />
                  </label>
                  <label>
                    Origem do lead
                    <input
                      name="crm-origem"
                      id="crm-origem"
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
                      name="crm-consumo-kwh"
                      id="crm-consumo-kwh"
                      value={crmLeadForm.consumoKwhMes}
                      onChange={(event) => handleCrmLeadFormChange('consumoKwhMes', event.target.value)}
                      placeholder="Ex: 1200"
                      required
                    />
                  </label>
                  <label>
                    Valor estimado (R$)
                    <input
                      name="crm-valor-estimado"
                      id="crm-valor-estimado"
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
                      name="crm-tipo-imovel"
                      id="crm-tipo-imovel"
                      value={crmLeadForm.tipoImovel}
                      onChange={(event) => handleCrmLeadFormChange('tipoImovel', event.target.value)}
                      placeholder="Residencial, Comercial, Cond. Vertical, Cond. Horizontal, Industrial ou Outros (texto)..."
                    />
                  </label>
                  <label>
                    Modelo de operação
                    <select
                      name="crm-tipo-operacao"
                      id="crm-tipo-operacao"
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
                    name="crm-notas"
                    id="crm-notas"
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
                      <Line
                        type="monotone"
                        dataKey="entradas"
                        name="Entradas"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="saidas"
                        name="Saídas"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="saldoAcumulado"
                        name="Saldo acumulado"
                        stroke="#38bdf8"
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
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
      </div>
    </div>
  )

  const downloadClientesArquivo = useCallback((blob: Blob, fileName: string) => {
    if (typeof window === 'undefined') {
      return
    }

    const link = window.document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = fileName
    window.document.body.appendChild(link)
    link.click()
    window.document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [])

  const buildClientesFileName = useCallback((extensao: string) => {
    const agora = new Date()
    const pad = (value: number) => value.toString().padStart(2, '0')
    return `solarinvest-clientes-${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(
      agora.getDate(),
    )}-${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}.${extensao}`
  }, [])

  const handleExportarClientesJson = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const registros = carregarClientesSalvos()
    setClientesSalvos(registros)

    if (registros.length === 0) {
      window.alert('Nenhum cliente salvo para exportar.')
      return
    }

    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        clientes: registros.map((registro) => ({
          ...registro,
          dados: cloneClienteDados(registro.dados),
        })),
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })

      const fileName = buildClientesFileName('json')
      downloadClientesArquivo(blob, fileName)

      adicionarNotificacao('Arquivo de clientes exportado com sucesso.', 'success')
    } catch (error) {
      console.error('Erro ao exportar clientes salvos.', error)
      window.alert('Não foi possível exportar os clientes. Tente novamente.')
    }
  }, [
    adicionarNotificacao,
    buildClientesFileName,
    carregarClientesSalvos,
    downloadClientesArquivo,
    setClientesSalvos,
  ])

  const handleExportarClientesCsv = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const registros = carregarClientesSalvos()
    setClientesSalvos(registros)

    if (registros.length === 0) {
      window.alert('Nenhum cliente salvo para exportar.')
      return
    }

    try {
      const csv = buildClientesCsv(registros)
      const blob = new Blob([`\ufeff${csv}`], {
        type: 'text/csv;charset=utf-8',
      })
      const fileName = buildClientesFileName('csv')
      downloadClientesArquivo(blob, fileName)

      adicionarNotificacao('Arquivo CSV exportado com sucesso.', 'success')
    } catch (error) {
      console.error('Erro ao exportar clientes salvos em CSV.', error)
      window.alert('Não foi possível exportar os clientes em CSV. Tente novamente.')
    }
  }, [
    adicionarNotificacao,
    buildClientesFileName,
    carregarClientesSalvos,
    downloadClientesArquivo,
    setClientesSalvos,
  ])

  const handleClientesImportarClick = useCallback(() => {
    if (isImportandoClientes) {
      return
    }

    const input = clientesImportInputRef.current
    if (input) {
      input.click()
    }
  }, [clientesImportInputRef, isImportandoClientes])

  const handleClientesImportarArquivo = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const arquivo = event.target.files?.[0]
      event.target.value = ''

      if (!arquivo || typeof window === 'undefined') {
        return
      }

      setIsImportandoClientes(true)

      try {
        const conteudo = await arquivo.text()
        let lista: unknown[] | null = null
        const isCsvFile =
          arquivo.name.toLowerCase().endsWith('.csv') ||
          arquivo.type.toLowerCase().includes('csv')

        if (isCsvFile) {
          lista = parseClientesCsv(conteudo)
        } else {
          let parsed: unknown
          try {
            parsed = JSON.parse(conteudo)
          } catch (error) {
            const fallbackCsv = parseClientesCsv(conteudo)
            if (fallbackCsv.length > 0) {
              lista = fallbackCsv
            } else {
              throw new Error('invalid-json')
            }
            parsed = null
          }

          if (parsed) {
            lista = Array.isArray(parsed)
              ? parsed
              : parsed && typeof parsed === 'object' && Array.isArray((parsed as { clientes?: unknown }).clientes)
              ? ((parsed as { clientes?: unknown }).clientes as unknown[])
              : null
          }
        }

        if (!lista || lista.length === 0) {
          window.alert('Nenhum cliente válido foi encontrado no arquivo selecionado.')
          return
        }

        const existentes = carregarClientesSalvos()
        const existingIds = new Set(existentes.map((registro) => registro.id))
        const { registros: importados } = normalizeClienteRegistros(lista, { existingIds })

        if (importados.length === 0) {
          window.alert('Nenhum cliente válido foi encontrado no arquivo selecionado.')
          return
        }

        const combinados = [...importados, ...existentes].sort((a, b) =>
          a.atualizadoEm < b.atualizadoEm ? 1 : -1,
        )

        try {
          window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(combinados))
        } catch (error) {
          console.error('Erro ao persistir clientes importados.', error)
          window.alert('Não foi possível salvar os clientes importados. Tente novamente.')
          return
        }

        setClientesSalvos(combinados)
        adicionarNotificacao('Clientes importados com sucesso.', 'success')
      } catch (error) {
        if ((error as Error).message === 'invalid-json') {
          window.alert('O arquivo selecionado está em um formato inválido (JSON ou CSV).')
        } else {
          console.error('Erro ao importar clientes salvos.', error)
          window.alert('Não foi possível importar os clientes. Verifique o arquivo e tente novamente.')
        }
      } finally {
        setIsImportandoClientes(false)
      }
    }, [
      adicionarNotificacao,
      carregarClientesSalvos,
      setClientesSalvos,
      setIsImportandoClientes,
    ])

  const isSnapshotEmpty = (snapshot: OrcamentoSnapshotData): boolean =>
    !snapshot?.cliente?.nome &&
    !snapshot?.cliente?.endereco &&
    !snapshot?.cliente?.documento &&
    Number(snapshot?.kcKwhMes ?? 0) === 0

  const createEmptySnapshot = (budgetId: string, activeTab: TabKey): OrcamentoSnapshotData => ({
    activeTab,
    settingsTab: INITIAL_VALUES.settingsTab,
    cliente: cloneClienteDados(CLIENTE_INICIAL),
    clienteEmEdicaoId: null,
    ucBeneficiarias: [],
    pageShared: createPageSharedSettings(),
    currentBudgetId: budgetId,
    budgetStructuredItems: [],
    kitBudget: createEmptyKitBudget(),
    budgetProcessing: {
      isProcessing: false,
      error: null,
      progress: null,
      isTableCollapsed: false,
      ocrDpi: DEFAULT_OCR_DPI,
    },
    propostaImagens: [],
    ufTarifa: INITIAL_VALUES.ufTarifa,
    distribuidoraTarifa: INITIAL_VALUES.distribuidoraTarifa,
    ufsDisponiveis: [...distribuidorasFallback.ufs],
    distribuidorasPorUf: cloneDistribuidorasMapa(distribuidorasFallback.distribuidorasPorUf),
    mesReajuste: INITIAL_VALUES.mesReajuste,
    kcKwhMes: INITIAL_VALUES.kcKwhMes,
    consumoManual: false,
    tarifaCheia: INITIAL_VALUES.tarifaCheia,
    desconto: INITIAL_VALUES.desconto,
    taxaMinima: INITIAL_VALUES.taxaMinima,
    taxaMinimaInputEmpty: false,
    encargosFixosExtras: INITIAL_VALUES.encargosFixosExtras,
    tusdPercent: INITIAL_VALUES.tusdPercent,
    tusdTipoCliente: INITIAL_VALUES.tusdTipoCliente,
    tusdSubtipo: INITIAL_VALUES.tusdSubtipo,
    tusdSimultaneidade: INITIAL_VALUES.tusdSimultaneidade,
    tusdTarifaRkwh: INITIAL_VALUES.tusdTarifaRkwh,
    tusdAnoReferencia: INITIAL_VALUES.tusdAnoReferencia ?? DEFAULT_TUSD_ANO_REFERENCIA,
    tusdOpcoesExpandidas: false,
    leasingPrazo: INITIAL_VALUES.leasingPrazo,
    potenciaModulo: INITIAL_VALUES.potenciaModulo,
    potenciaModuloDirty: false,
    tipoInstalacao: normalizeTipoInstalacao(INITIAL_VALUES.tipoInstalacao),
    tipoInstalacaoOutro: INITIAL_VALUES.tipoInstalacaoOutro,
    tipoInstalacaoDirty: false,
    tipoSistema: INITIAL_VALUES.tipoSistema,
    segmentoCliente: normalizeTipoBasico(INITIAL_VALUES.segmentoCliente),
    tipoEdificacaoOutro: INITIAL_VALUES.tipoEdificacaoOutro,
    numeroModulosManual: INITIAL_VALUES.numeroModulosManual,
    configuracaoUsinaObservacoes: INITIAL_VALUES.configuracaoUsinaObservacoes,
    composicaoTelhado: createInitialComposicaoTelhado(),
    composicaoSolo: createInitialComposicaoSolo(),
    aprovadoresText: '',
    impostosOverridesDraft: {},
    vendasConfig: JSON.parse(JSON.stringify(useVendasConfigStore.getState().config)) as VendasConfig,
    vendasSimulacoes: {},
    multiUc: {
      ativo: INITIAL_VALUES.multiUcAtivo,
      rows: [],
      rateioModo: INITIAL_VALUES.multiUcRateioModo,
      energiaGeradaKWh: INITIAL_VALUES.multiUcEnergiaGeradaKWh,
      energiaGeradaTouched: false,
      anoVigencia: INITIAL_VALUES.multiUcAnoVigencia,
      overrideEscalonamento: INITIAL_VALUES.multiUcOverrideEscalonamento,
      escalonamentoCustomPercent: INITIAL_VALUES.multiUcEscalonamentoCustomPercent,
    },
    precoPorKwp: INITIAL_VALUES.precoPorKwp,
    irradiacao: IRRADIACAO_FALLBACK,
    eficiencia: INITIAL_VALUES.eficiencia,
    diasMes: INITIAL_VALUES.diasMes,
    inflacaoAa: INITIAL_VALUES.inflacaoAa,
    vendaForm: createInitialVendaForm(),
    capexManualOverride: INITIAL_VALUES.capexManualOverride,
    parsedVendaPdf: null,
    estruturaTipoWarning: null,
    jurosFinAa: INITIAL_VALUES.jurosFinanciamentoAa,
    prazoFinMeses: INITIAL_VALUES.prazoFinanciamentoMeses,
    entradaFinPct: INITIAL_VALUES.entradaFinanciamentoPct,
    mostrarFinanciamento: INITIAL_VALUES.mostrarFinanciamento,
    mostrarGrafico: INITIAL_VALUES.mostrarGrafico,
    prazoMeses: INITIAL_VALUES.prazoMeses,
    bandeiraEncargo: INITIAL_VALUES.bandeiraEncargo,
    cipEncargo: INITIAL_VALUES.cipEncargo,
    entradaRs: INITIAL_VALUES.entradaRs,
    entradaModo: INITIAL_VALUES.entradaModo,
    mostrarValorMercadoLeasing: INITIAL_VALUES.mostrarValorMercadoLeasing,
    mostrarTabelaParcelas: INITIAL_VALUES.tabelaVisivel,
    mostrarTabelaBuyout: INITIAL_VALUES.tabelaVisivel,
    mostrarTabelaParcelasConfig: INITIAL_VALUES.tabelaVisivel,
    mostrarTabelaBuyoutConfig: INITIAL_VALUES.tabelaVisivel,
    oemBase: INITIAL_VALUES.oemBase,
    oemInflacao: INITIAL_VALUES.oemInflacao,
    seguroModo: INITIAL_VALUES.seguroModo,
    seguroReajuste: INITIAL_VALUES.seguroReajuste,
    seguroValorA: INITIAL_VALUES.seguroValorA,
    seguroPercentualB: INITIAL_VALUES.seguroPercentualB,
    exibirLeasingLinha: INITIAL_VALUES.exibirLeasingLinha,
    exibirFinLinha: INITIAL_VALUES.exibirFinanciamentoLinha,
    cashbackPct: INITIAL_VALUES.cashbackPct,
    depreciacaoAa: INITIAL_VALUES.depreciacaoAa,
    inadimplenciaAa: INITIAL_VALUES.inadimplenciaAa,
    tributosAa: INITIAL_VALUES.tributosAa,
    ipcaAa: INITIAL_VALUES.ipcaAa,
    custosFixosM: INITIAL_VALUES.custosFixosM,
    opexM: INITIAL_VALUES.opexM,
    seguroM: INITIAL_VALUES.seguroM,
    duracaoMeses: INITIAL_VALUES.duracaoMeses,
    pagosAcumAteM: INITIAL_VALUES.pagosAcumManual,
    modoOrcamento: 'auto',
    autoKitValor: null,
    autoCustoFinal: null,
    autoPricingRede: null,
    autoPricingVersion: null,
    autoBudgetReason: null,
    autoBudgetReasonCode: null,
    tipoRede: INITIAL_VALUES.tipoRede ?? 'monofasico',
    tipoRedeControle: 'auto',
    leasingAnexosSelecionados: [],
    vendaSnapshot: getVendaSnapshot(),
    leasingSnapshot: getInitialLeasingSnapshot(),
  })

  const mergeSnapshotWithDefaults = (
    snapshot: OrcamentoSnapshotData,
    budgetId: string,
  ): OrcamentoSnapshotData => {
    const base = createEmptySnapshot(budgetId, snapshot.activeTab)

    return {
      ...base,
      ...snapshot,
      cliente: cloneClienteDados(snapshot.cliente ?? base.cliente),
      clienteMensagens: snapshot.clienteMensagens ?? base.clienteMensagens,
      ucBeneficiarias: snapshot.ucBeneficiarias ?? base.ucBeneficiarias,
      pageShared: { ...base.pageShared, ...(snapshot.pageShared ?? {}) },
      budgetStructuredItems: snapshot.budgetStructuredItems ?? base.budgetStructuredItems,
      kitBudget: snapshot.kitBudget ?? base.kitBudget,
      budgetProcessing: { ...base.budgetProcessing, ...(snapshot.budgetProcessing ?? {}) },
      propostaImagens: snapshot.propostaImagens ?? base.propostaImagens,
      ufsDisponiveis: snapshot.ufsDisponiveis ?? base.ufsDisponiveis,
      distribuidorasPorUf: snapshot.distribuidorasPorUf ?? base.distribuidorasPorUf,
      composicaoTelhado: { ...base.composicaoTelhado, ...(snapshot.composicaoTelhado ?? {}) },
      composicaoSolo: { ...base.composicaoSolo, ...(snapshot.composicaoSolo ?? {}) },
      impostosOverridesDraft: {
        ...base.impostosOverridesDraft,
        ...(snapshot.impostosOverridesDraft ?? {}),
      },
      vendasConfig: snapshot.vendasConfig ?? base.vendasConfig,
      vendasSimulacoes: snapshot.vendasSimulacoes ?? base.vendasSimulacoes,
      multiUc: {
        ...base.multiUc,
        ...(snapshot.multiUc ?? {}),
        rows: snapshot.multiUc?.rows ?? base.multiUc.rows,
      },
      vendaForm: { ...base.vendaForm, ...(snapshot.vendaForm ?? {}) },
      leasingAnexosSelecionados:
        snapshot.leasingAnexosSelecionados ?? base.leasingAnexosSelecionados,
      vendaSnapshot: snapshot.vendaSnapshot ?? base.vendaSnapshot,
      leasingSnapshot: snapshot.leasingSnapshot ?? base.leasingSnapshot,
    }
  }

  const getCurrentSnapshot = (
    options?: { budgetIdOverride?: string },
  ): OrcamentoSnapshotData | null => {
    const vendasConfigState = useVendasConfigStore.getState()
    const vendasSimState = useVendasSimulacoesStore.getState()
    const vendaSnapshotAtual = getVendaSnapshot()
    const leasingSnapshotAtual = getLeasingSnapshot()
    const tab = activeTabRef.current
    const budgetIdRefNow = budgetIdRef.current
    const budgetIdStateNow = currentBudgetId
    const budgetId = options?.budgetIdOverride ?? getActiveBudgetId()
    const clienteFonte = clienteRef.current ?? cliente
    const tusdTipoClienteNormalizado = normalizeTipoBasico(tusdTipoCliente)
    const segmentoClienteNormalizado = normalizeTipoBasico(segmentoCliente)
    const vendaFormNormalizado: VendaForm = {
      ...vendaForm,
      segmento_cliente: vendaForm.segmento_cliente
        ? normalizeTipoBasico(vendaForm.segmento_cliente)
        : undefined,
      tusd_tipo_cliente: vendaForm.tusd_tipo_cliente
        ? normalizeTipoBasico(vendaForm.tusd_tipo_cliente)
        : undefined,
    }

    // Log sources before building snapshot (using refs for accuracy)
    if (budgetId !== currentBudgetId && !budgetIdMismatchLoggedRef.current) {
      setTimeout(() => {
        if (budgetIdRef.current === currentBudgetId || budgetIdMismatchLoggedRef.current) {
          return
        }
        budgetIdMismatchLoggedRef.current = true
        console.debug('[budgetId] mismatch', {
          budgetIdRef: budgetIdRef.current,
          budgetIdState: currentBudgetId,
        })
      }, 0)
    }

    if (
      budgetIdRefNow &&
      budgetIdStateNow &&
      budgetIdRefNow !== budgetIdStateNow &&
      !isHydratingRef.current &&
      !budgetIdTransitionRef.current
    ) {
      console.warn('[getCurrentSnapshot] budget id mismatch (using active budgetId)', {
        budgetIdRef: budgetIdRefNow,
        budgetIdState: budgetIdStateNow,
        activeBudgetId: budgetId,
      })
    }

    console.log('[getCurrentSnapshot] sources', {
      activeTab: tab,
      activeTabState: activeTab,
      budgetIdRef: budgetId,
      budgetIdState: currentBudgetId,
      clienteState: { 
        nome: clienteFonte.nome, 
        endereco: clienteFonte.endereco, 
        documento: clienteFonte.documento 
      },
      vendaStoreCliente: vendaSnapshotAtual?.cliente?.endereco ?? 'n/a',
      leasingStoreCliente: leasingSnapshotAtual?.cliente?.endereco ?? 'n/a',
      kcKwhMesState: kcKwhMesRef.current,
      pageSharedStateKc: pageSharedStateRef.current?.kcKwhMes,
    })

    // 🔒 CRITICAL: Use refs to get current state, not closure variables
    const kcAtual = Number(kcKwhMesRef.current ?? 0)
    const kcFallback = Number(pageSharedStateRef.current?.kcKwhMes ?? 0)
    const kcKwhMesFinal = kcAtual || kcFallback

    if (isHydratingRef.current) {
      console.warn('[getCurrentSnapshot] skipped during hydration', {
        budgetId,
      })
      return createEmptySnapshot(budgetId, tab)
    }

    const snapshotData = {
      activeTab: tab,
      settingsTab,
      cliente: cloneClienteDados(clienteFonte), // Use ref instead of closure
      clienteEmEdicaoId,
      clienteMensagens: Object.keys(clienteMensagens).length > 0 ? { ...clienteMensagens } : undefined,
      ucBeneficiarias: cloneUcBeneficiariasForm(ucsBeneficiarias),
      pageShared: { ...pageSharedStateRef.current }, // Use ref instead of closure
      currentBudgetId: budgetId,
      budgetStructuredItems: cloneStructuredItems(budgetStructuredItems),
      kitBudget: cloneKitBudgetState(kitBudget),
      budgetProcessing: {
        isProcessing: isBudgetProcessing,
        error: budgetProcessingError ?? null,
        progress: cloneBudgetUploadProgress(budgetProcessingProgress),
        isTableCollapsed: isBudgetTableCollapsed,
        ocrDpi,
      },
      propostaImagens: propostaImagens.map((imagem) => ({ ...imagem })),
      ufTarifa,
      distribuidoraTarifa: distribuidoraAneelEfetiva,
      ufsDisponiveis: [...ufsDisponiveis],
      distribuidorasPorUf: cloneDistribuidorasMapa(distribuidorasPorUf),
      mesReajuste,
      kcKwhMes: kcKwhMesFinal, // Use computed value from refs
      consumoManual,
      tarifaCheia,
      desconto,
      taxaMinima,
      taxaMinimaInputEmpty,
      encargosFixosExtras,
      tusdPercent,
      tusdTipoCliente: tusdTipoClienteNormalizado,
      tusdSubtipo,
      tusdSimultaneidade,
      tusdTarifaRkwh,
      tusdAnoReferencia,
      tusdOpcoesExpandidas,
      leasingPrazo,
      potenciaModulo,
      potenciaModuloDirty,
      tipoInstalacao,
      tipoInstalacaoOutro,
      tipoInstalacaoDirty,
      tipoSistema,
      segmentoCliente: segmentoClienteNormalizado,
      tipoEdificacaoOutro,
      numeroModulosManual,
      configuracaoUsinaObservacoes,
      composicaoTelhado: { ...composicaoTelhado },
      composicaoSolo: { ...composicaoSolo },
      aprovadoresText,
      impostosOverridesDraft: cloneImpostosOverrides(impostosOverridesDraft),
      vendasConfig: JSON.parse(JSON.stringify(vendasConfigState.config)) as VendasConfig,
      vendasSimulacoes: cloneVendasSimulacoes(vendasSimState.simulations),
      multiUc: {
        ativo: multiUcAtivo,
        rows: multiUcRows.map((row) => ({ ...row })),
        rateioModo: multiUcRateioModo,
        energiaGeradaKWh: multiUcEnergiaGeradaKWh,
        energiaGeradaTouched: multiUcEnergiaGeradaTouched,
        anoVigencia: multiUcAnoVigencia,
        overrideEscalonamento: multiUcOverrideEscalonamento,
        escalonamentoCustomPercent: multiUcEscalonamentoCustomPercent,
      },
      precoPorKwp,
      irradiacao,
      eficiencia,
      diasMes,
      inflacaoAa,
      vendaForm: { ...vendaFormNormalizado },
      capexManualOverride,
      parsedVendaPdf: parsedVendaPdf
        ? (JSON.parse(JSON.stringify(parsedVendaPdf)) as ParsedVendaPdfData)
        : null,
      estruturaTipoWarning: estruturaTipoWarning ?? null,
      jurosFinAa,
      prazoFinMeses,
      entradaFinPct,
      mostrarFinanciamento,
      mostrarGrafico,
      prazoMeses,
      bandeiraEncargo,
      cipEncargo,
      entradaRs,
      entradaModo,
      mostrarValorMercadoLeasing,
      mostrarTabelaParcelas,
      mostrarTabelaBuyout,
      mostrarTabelaParcelasConfig,
      mostrarTabelaBuyoutConfig,
      oemBase,
      oemInflacao,
      seguroModo,
      seguroReajuste,
      seguroValorA,
      seguroPercentualB,
      exibirLeasingLinha,
      exibirFinLinha,
      cashbackPct,
      depreciacaoAa,
      inadimplenciaAa,
      tributosAa,
      ipcaAa,
      custosFixosM,
      opexM,
      seguroM,
      duracaoMeses,
      pagosAcumAteM,
      modoOrcamento,
      autoKitValor,
      autoCustoFinal,
      autoPricingRede,
      autoPricingVersion,
      autoBudgetReason,
      autoBudgetReasonCode,
      tipoRede,
      tipoRedeControle,
      leasingAnexosSelecionados: [...leasingAnexosSelecionados],
      vendaSnapshot: vendaSnapshotAtual,
      leasingSnapshot: leasingSnapshotAtual,
    }
    
    // Debug: Check if returning empty snapshot
    const snapshotNome = (snapshotData.cliente?.nome ?? '').trim()
    const snapshotEndereco = (snapshotData.cliente?.endereco ?? '').trim()
    const snapshotKwh = Number(snapshotData.kcKwhMes ?? 0)
    
    // Final log showing what we're returning
    console.log('[getCurrentSnapshot] FINAL snapshot', {
      clienteNome: snapshotNome,
      clienteEndereco: snapshotEndereco,
      clienteDocumento: snapshotData.cliente?.documento ?? '',
      kcKwhMes: snapshotKwh,
      totalFields: Object.keys(snapshotData).length,
    })

    if (isSnapshotEmpty(snapshotData)) {
      return snapshotData
    }
    
    console.log('[getCurrentSnapshot] clienteFonte', {
      nome: clienteFonte?.nome ?? '',
      endereco: clienteFonte?.endereco ?? '',
      documento: clienteFonte?.documento ?? '',
    })

    return snapshotData
  }

  const buildEmptySnapshotForNewProposal = (
    tab: TabKey,
    budgetId: string,
  ): OrcamentoSnapshotData => {
    const baseSnapshot = getCurrentSnapshot({ budgetIdOverride: budgetId })
    const snapshot = baseSnapshot
      ? cloneSnapshotData(baseSnapshot)
      : createEmptySnapshot(budgetId, tab)

    snapshot.activeTab = tab
    snapshot.currentBudgetId = budgetId
    snapshot.cliente = {
      ...cloneClienteDados(CLIENTE_INICIAL),
      nome: '',
      endereco: '',
      documento: '',
    }
    snapshot.kcKwhMes = 0
    snapshot.consumoManual = false
    snapshot.tarifaCheia = snapshot.tarifaCheia ?? 0
    snapshot.entradaRs = 0
    snapshot.numeroModulosManual = ''
    snapshot.potenciaModulo = snapshot.potenciaModulo ?? 0

    return snapshot
  }

  // Helper: Hydrate cliente registro with latest data from clientStore
  const hydrateClienteRegistroFromStore = async (
    registro: ClienteRegistro,
  ): Promise<ClienteRegistro> => {
    try {
      const latestRegistro = await getClienteRegistroById(registro.id)
      if (latestRegistro) {
        console.log('[hydrateClienteRegistro] Loaded latest from clientStore:', {
          id: registro.id,
          nome: latestRegistro.dados?.nome,
          endereco: latestRegistro.dados?.endereco,
          updatedAt: latestRegistro.atualizadoEm,
        })
        return latestRegistro
      }
    } catch (e) {
      console.warn('[hydrateClienteRegistro] Failed to load latest for', registro.id, e)
    }
    return registro
  }

  const handleSalvarCliente = useCallback(async (options?: { skipGuard?: boolean }) => {
    if (typeof window === 'undefined') {
      return false
    }

    if (!validateClienteParaSalvar()) {
      return false
    }

    const dadosClonados = cloneClienteDados(cliente)
    dadosClonados.herdeiros = ensureClienteHerdeiros(dadosClonados.herdeiros).map((item) =>
      typeof item === 'string' ? item.trim() : '',
    )
    
    // Debug: Log cliente endereco before saving
    console.log('[ClienteSave] Cliente endereco BEFORE clone:', cliente.endereco)
    console.log('[ClienteSave] DadosClonados endereco AFTER clone:', dadosClonados.endereco)
    
    const snapshotAtual = getCurrentSnapshot()
    if (!snapshotAtual || isHydratingRef.current) {
      console.warn('[ClienteSave] Snapshot indisponível durante hidratação.')
      return false
    }
    const snapshotClonado = cloneSnapshotData(snapshotAtual)
    console.log(
      '[ClienteSave] Capturing FULL proposal snapshot with',
      Object.keys(snapshotClonado).length,
      'fields',
    )
    console.log('[ClienteSave] Sample fields:', {
      kcKwhMes: snapshotClonado.kcKwhMes,
      tarifaCheia: snapshotClonado.tarifaCheia,
      entradaRs: snapshotClonado.entradaRs,
      numeroModulosManual: snapshotClonado.numeroModulosManual,
      potenciaModulo: snapshotClonado.potenciaModulo,
    })
    console.log('[ClienteSave] Snapshot cliente endereco:', snapshotClonado.cliente?.endereco)
    
    // Salvar snapshot completo no IndexedDB para persistência cross-browser robusta
    try {
      await saveFormDraft(snapshotClonado)
      console.log('[ClienteSave] Form draft saved to IndexedDB successfully')
    } catch (error) {
      console.warn('[ClienteSave] Failed to save form draft to IndexedDB:', error)
      // Continuar mesmo se falhar - o localStorage ainda funciona como fallback
    }
    const agoraIso = new Date().toISOString()
    const estaEditando = Boolean(clienteEmEdicaoId)
    let registroSalvo: ClienteRegistro | null = null
    let registrosPersistidos: ClienteRegistro[] | null = null
    let houveErro = false
    setClientesSalvos((prevRegistros) => {
      const novoComparacao = createClienteComparisonData(dadosClonados)
      let registroCorrespondente: ClienteRegistro | null = null

      for (const registro of prevRegistros) {
        if (clienteEmEdicaoId && registro.id === clienteEmEdicaoId) {
          continue
        }

        const existenteComparacao = createClienteComparisonData(registro.dados)
        const nomeIgual =
          novoComparacao.nome &&
          existenteComparacao.nome &&
          novoComparacao.nome === existenteComparacao.nome
        const documentoIgual =
          novoComparacao.documento &&
          novoComparacao.documento === existenteComparacao.documento
        const rgIgual = novoComparacao.rg && novoComparacao.rg === existenteComparacao.rg

        if (novoComparacao.signature === existenteComparacao.signature) {
          registroCorrespondente = registro
          break
        }

        if (documentoIgual || rgIgual) {
          registroCorrespondente = registro
          break
        }
      }

      const existingIds = new Set(prevRegistros.map((registro) => registro.id))
      let registrosAtualizados: ClienteRegistro[] = prevRegistros
      let registroAtualizado: ClienteRegistro | null = null
      const registroIdAlvo = clienteEmEdicaoId ?? registroCorrespondente?.id ?? null

      if (registroIdAlvo) {
        let encontrado = false
        registrosAtualizados = prevRegistros.map((registro) => {
          if (registro.id === registroIdAlvo) {
            encontrado = true
            const atualizado: ClienteRegistro = {
              ...registro,
              dados: dadosClonados,
              atualizadoEm: agoraIso,
              propostaSnapshot: snapshotClonado,
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
            propostaSnapshot: snapshotClonado,
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
          propostaSnapshot: snapshotClonado,
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
      registrosPersistidos = ordenados
      return ordenados
    })

    const salvo = registroSalvo as ClienteRegistro | null
    if (houveErro || !salvo) {
      return false
    }

    const registroConfirmado: ClienteRegistro = salvo
    let sincronizadoComSucesso = false
    let erroSincronizacao: unknown = null

    if (registrosPersistidos) {
      try {
        await persistRemoteStorageEntry(
          CLIENTES_STORAGE_KEY,
          JSON.stringify(registrosPersistidos),
        )
      } catch (error) {
        console.warn('Não foi possível sincronizar clientes com o armazenamento remoto.', error)
      }
    }

    const integracaoOneDriveAtiva = isOneDriveIntegrationAvailable()
    setOneDriveIntegrationAvailable(integracaoOneDriveAtiva)

    if (!integracaoOneDriveAtiva) {
      erroSincronizacao = new OneDriveIntegrationMissingError()
      if (typeof console !== 'undefined') {
        console.info('Sincronização com o OneDrive ignorada: integração não configurada.')
      }
    } else {
      try {
        await persistClienteRegistroToOneDrive(mapClienteRegistroToSyncPayload(registroConfirmado))
        sincronizadoComSucesso = true
      } catch (error) {
        erroSincronizacao = error
        if (error instanceof OneDriveIntegrationMissingError) {
          setOneDriveIntegrationAvailable(false)
          if (typeof console !== 'undefined') {
            console.warn('Integração com o OneDrive indisponível.', error)
          }
        } else {
          console.error('Erro ao sincronizar cliente com o OneDrive.', error)
        }
      }
    }

    clienteEmEdicaoIdRef.current = registroConfirmado.id
    setClienteEmEdicaoId(registroConfirmado.id)
    lastSavedClienteRef.current = cloneClienteDados(dadosClonados)
    console.log('[ClienteSave] lastSavedClienteRef updated with endereco:', lastSavedClienteRef.current?.endereco)
    
    // Save to clientStore (IndexedDB) for guaranteed latest data
    try {
      await upsertClienteRegistro(registroConfirmado)
      console.log('[ClienteSave] Cliente saved to clientStore (IndexedDB):', {
        id: registroConfirmado.id,
        nome: registroConfirmado.dados?.nome,
        endereco: registroConfirmado.dados?.endereco,
      })
    } catch (error) {
      console.warn('[ClienteSave] Failed to save cliente to clientStore:', error)
      // Continue - localStorage is the source of truth
    }
    
    scheduleMarkStateAsSaved()

    if (sincronizadoComSucesso) {
      adicionarNotificacao(
        estaEditando
          ? 'Dados do cliente atualizados e sincronizados com o OneDrive com sucesso.'
          : 'Cliente salvo e sincronizado com o OneDrive com sucesso.',
        'success',
      )
    } else {
      if (erroSincronizacao instanceof OneDriveIntegrationMissingError) {
        adicionarNotificacao(
          'Cliente salvo localmente. Configure a integração com o OneDrive para sincronizar automaticamente.',
          'info',
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
    }

    return true
  }, [
    adicionarNotificacao,
    cliente,
    clienteEmEdicaoId,
    getCurrentSnapshot,
    isOneDriveIntegrationAvailable,
    persistClienteRegistroToOneDrive,
    scheduleMarkStateAsSaved,
    setOneDriveIntegrationAvailable,
    setClienteEmEdicaoId,
    validateClienteParaSalvar,
  ])


  const clienteRegistroEmEdicao = clienteEmEdicaoId
    ? clientesSalvos.find((registro) => registro.id === clienteEmEdicaoId) ?? null
    : null
  const clienteFormularioAlterado = (() => {
    if (!clienteRegistroEmEdicao) {
      return false
    }
    const snapshotAtualRaw = getCurrentSnapshot()
    if (!snapshotAtualRaw) {
      return false
    }
    const snapshotAtual = cloneSnapshotData(snapshotAtualRaw)
    const snapshotSalvo = clienteRegistroEmEdicao.propostaSnapshot
      ? cloneSnapshotData(clienteRegistroEmEdicao.propostaSnapshot)
      : null
    const assinaturaAtual = stableStringify({
      dados: cloneClienteDados(cliente),
      snapshot: snapshotAtual,
    })
    const assinaturaSalva = stableStringify({
      dados: cloneClienteDados(clienteRegistroEmEdicao.dados),
      snapshot: snapshotSalvo,
    })
    return assinaturaAtual !== assinaturaSalva
  })()
  const clienteSaveLabel =
    clienteEmEdicaoId && clienteFormularioAlterado ? 'Atualizar cliente' : 'Salvar cliente'

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
        setClienteSync(cloneClienteDados(CLIENTE_INICIAL))
        setClienteMensagens({})
        clienteEmEdicaoIdRef.current = null
        lastSavedClienteRef.current = null
        setClienteEmEdicaoId(null)
      }
    },
    [clienteEmEdicaoId, setClienteEmEdicaoId, setClienteMensagens, setClienteSync],
  )

  const parseOrcamentosSalvos = useCallback(
    (existenteRaw: string | null): OrcamentoSalvo[] => {
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

          const herdeirosNormalizados = normalizeClienteHerdeiros(
            (clienteDados as { herdeiros?: unknown }).herdeiros,
          )

          const clienteNormalizado: ClienteDados = {
            nome: clienteDados.nome ?? '',
            documento: clienteDados.documento ?? '',
            rg: clienteDados.rg ?? '',
            estadoCivil: clienteDados.estadoCivil ?? '',
            nacionalidade: clienteDados.nacionalidade ?? '',
            profissao: clienteDados.profissao ?? '',
            representanteLegal: clienteDados.representanteLegal ?? '',
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
            herdeiros: herdeirosNormalizados,
            nomeSindico: clienteDados.nomeSindico ?? '',
            cpfSindico: clienteDados.cpfSindico ?? '',
            contatoSindico: clienteDados.contatoSindico ?? '',
            diaVencimento: clienteDados.diaVencimento ?? '10',
          }

          const dadosNormalizados: PrintableProposalProps = {
            ...dados,
            budgetId: dados?.budgetId ?? registro.id,
            cliente: clienteNormalizado,
            distribuidoraTarifa: dados.distribuidoraTarifa ?? clienteNormalizado.distribuidora ?? '',
            tipoProposta: dados?.tipoProposta === 'VENDA_DIRETA' ? 'VENDA_DIRETA' : 'LEASING',
          }

          if (dados.ucGeradora && typeof dados.ucGeradora === 'object') {
            const numero = typeof dados.ucGeradora.numero === 'string' ? dados.ucGeradora.numero : ''
            const endereco =
              typeof dados.ucGeradora.endereco === 'string' ? dados.ucGeradora.endereco : ''
            dadosNormalizados.ucGeradora = { numero, endereco }
          } else {
            delete dadosNormalizados.ucGeradora
          }

          if (dados.ucGeradoraTitular && typeof dados.ucGeradoraTitular === 'object') {
            const nomeCompleto =
              typeof dados.ucGeradoraTitular.nomeCompleto === 'string'
                ? dados.ucGeradoraTitular.nomeCompleto
                : ''
            const cpf =
              typeof dados.ucGeradoraTitular.cpf === 'string' ? dados.ucGeradoraTitular.cpf : ''
            const rg = typeof dados.ucGeradoraTitular.rg === 'string' ? dados.ucGeradoraTitular.rg : ''
            const endereco =
              typeof dados.ucGeradoraTitular.endereco === 'string'
                ? dados.ucGeradoraTitular.endereco
                : ''
            dadosNormalizados.ucGeradoraTitular = { nomeCompleto, cpf, rg, endereco }
          } else {
            delete dadosNormalizados.ucGeradoraTitular
          }

          dadosNormalizados.ucsBeneficiarias = Array.isArray(dados.ucsBeneficiarias)
            ? dados.ucsBeneficiarias
                .filter((item): item is PrintableUcBeneficiaria => Boolean(item && typeof item === 'object'))
                .map((item) => ({
                  numero: typeof item.numero === 'string' ? item.numero : '',
                  endereco: typeof item.endereco === 'string' ? item.endereco : '',
                  rateioPercentual:
                    item.rateioPercentual != null && Number.isFinite(item.rateioPercentual)
                      ? Number(item.rateioPercentual)
                      : null,
                }))
            : []

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

          const id =
            typeof registro.id === 'string' && registro.id
              ? registro.id
              : ensureProposalId(dadosNormalizados.budgetId)
          const criadoEm =
            typeof registro.criadoEm === 'string' && registro.criadoEm
              ? registro.criadoEm
              : new Date().toISOString()

          const snapshotCandidate =
            registro.snapshot ??
            (registro as unknown as { propostaSnapshot?: unknown }).propostaSnapshot ??
            (dados as unknown as { snapshot?: unknown }).snapshot

          let snapshotNormalizado: OrcamentoSnapshotData | undefined
          if (snapshotCandidate && typeof snapshotCandidate === 'object') {
            try {
              snapshotNormalizado = cloneSnapshotData(snapshotCandidate as OrcamentoSnapshotData)
              if (snapshotNormalizado.currentBudgetId !== id) {
                snapshotNormalizado.currentBudgetId = id
              }
              snapshotNormalizado.tusdTipoCliente = normalizeTipoBasico(
                snapshotNormalizado.tusdTipoCliente,
              )
              snapshotNormalizado.segmentoCliente = normalizeTipoBasico(
                snapshotNormalizado.segmentoCliente,
              )
              snapshotNormalizado.vendaForm = {
                ...snapshotNormalizado.vendaForm,
                segmento_cliente: snapshotNormalizado.vendaForm.segmento_cliente
                  ? normalizeTipoBasico(snapshotNormalizado.vendaForm.segmento_cliente)
                  : undefined,
                tusd_tipo_cliente: snapshotNormalizado.vendaForm.tusd_tipo_cliente
                  ? normalizeTipoBasico(snapshotNormalizado.vendaForm.tusd_tipo_cliente)
                  : undefined,
              }
            } catch (error) {
              console.warn('Não foi possível interpretar o snapshot do orçamento salvo.', error)
              snapshotNormalizado = undefined
            }
          }

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
            snapshot: snapshotNormalizado,
          }
        })
      } catch (error) {
        console.warn('Não foi possível interpretar os orçamentos salvos existentes.', error)
        return []
      }
    },
    [carregarClientesSalvos],
  )

  const carregarOrcamentosSalvos = useCallback(
    (): OrcamentoSalvo[] => {
      if (typeof window === 'undefined') {
        return []
      }

      const existenteRaw = window.localStorage.getItem(BUDGETS_STORAGE_KEY)
      return parseOrcamentosSalvos(existenteRaw)
    },
    [parseOrcamentosSalvos],
  )

  const carregarOrcamentosPrioritarios = useCallback(async (): Promise<OrcamentoSalvo[]> => {
    if (typeof window === 'undefined') {
      return []
    }

    let remoto = undefined as string | null | undefined
    try {
      remoto = await fetchRemoteStorageEntry(BUDGETS_STORAGE_KEY, { timeoutMs: 4000 })
    } catch (error) {
      console.warn('Não foi possível carregar orçamentos do banco de dados.', error)
    }

    if (remoto !== undefined) {
      if (remoto === null) {
        const registrosLocais = carregarOrcamentosSalvos()
        if (registrosLocais.length > 0) {
          await persistRemoteStorageEntry(BUDGETS_STORAGE_KEY, JSON.stringify(registrosLocais))
          return registrosLocais
        }
        window.localStorage.removeItem(BUDGETS_STORAGE_KEY)
        return []
      }
      window.localStorage.setItem(BUDGETS_STORAGE_KEY, remoto)
      return parseOrcamentosSalvos(remoto)
    }

    try {
      const oneDrivePayload = await loadPropostasFromOneDrive()
      if (oneDrivePayload !== null && oneDrivePayload !== undefined) {
        const raw =
          typeof oneDrivePayload === 'string'
            ? oneDrivePayload
            : JSON.stringify(oneDrivePayload)
        window.localStorage.setItem(BUDGETS_STORAGE_KEY, raw)
        return parseOrcamentosSalvos(raw)
      }
    } catch (error) {
      if (error instanceof OneDriveIntegrationMissingError) {
        console.info('Leitura via OneDrive ignorada: integração não configurada.')
      } else {
        console.warn('Não foi possível carregar propostas via OneDrive.', error)
      }
    }

    const fallbackRaw = window.localStorage.getItem(BUDGETS_STORAGE_KEY)
    return parseOrcamentosSalvos(fallbackRaw)
  }, [carregarOrcamentosSalvos, parseOrcamentosSalvos])

  useEffect(() => {
    let cancelado = false
    const carregar = async () => {
      await ensureServerStorageSync({ timeoutMs: 4000 })
      if (cancelado) {
        return
      }
      const registros = await carregarOrcamentosPrioritarios()
      if (!cancelado) {
        setOrcamentosSalvos(registros)
      }
    }
    carregar()
    return () => {
      cancelado = true
    }
  }, [carregarOrcamentosPrioritarios])

  // Carregar draft do formulário do IndexedDB na inicialização
  useEffect(() => {
    let cancelado = false
    const carregarDraft = async () => {
      try {
        console.log('[App] Loading form draft from IndexedDB on mount')
        const envelope = await loadFormDraft<OrcamentoSnapshotData>()
        
        if (cancelado) {
          console.log('[App] Load cancelled (component unmounted)')
          return
        }
        
        if (envelope && envelope.data) {
          console.log('[App] Form draft found, applying snapshot')
          console.log('[App] BEFORE APPLY - Current cliente:', {
            nome: cliente.nome,
            endereco: cliente.endereco,
            cidade: cliente.cidade,
          })
          console.log('[App] SNAPSHOT TO APPLY - Cliente:', {
            nome: envelope.data.cliente?.nome,
            endereco: envelope.data.cliente?.endereco,
            cidade: envelope.data.cliente?.cidade,
          })
          
          // Enable hydration mode to prevent state reset and auto-save during apply
          isHydratingRef.current = true
          setIsHydrating(true)
          console.log('[App] Hydration mode enabled')
          
          try {
            aplicarSnapshot(envelope.data)
            
            // Wait for React to apply all setState calls
            await tick()
            
            console.log('[App] Hydration done')
          } finally {
            isHydratingRef.current = false
            setIsHydrating(false)
            console.log('[App] Hydration mode disabled')
          }

          console.log('[App] Form draft applied successfully')
        } else {
          console.log('[App] No form draft found in IndexedDB')
        }
      } catch (error) {
        console.error('[App] Failed to load form draft:', error)
      }
    }
    carregarDraft()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save debounced: salva o snapshot a cada 5 segundos quando houver mudanças
  useEffect(() => {
    // Skip auto-save during hydration to prevent overwriting draft with empty/partial state
    if (isHydratingRef.current) {
      console.log('[App] Auto-save skipped: hydrating')
      return
    }
    
    const AUTO_SAVE_INTERVAL_MS = 5000
    
    const scheduleAutoSave = () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
      
      autoSaveTimeoutRef.current = setTimeout(async () => {
        // Double-check hydration status before saving
        const activeBudgetId = getActiveBudgetId()
        if (isHydratingRef.current || !activeBudgetId) {
          console.log('[App] Auto-save skipped: hydrating or missing budgetId', {
            hydrating: isHydratingRef.current,
            budgetIdRef: budgetIdRef.current,
            budgetIdState: currentBudgetId,
          })
          return
        }
        
        try {
          const snapshot = getCurrentSnapshot()
          if (!snapshot || isHydratingRef.current) {
            console.warn('[AutoSave] Snapshot indisponível durante hidratação.')
            return
          }
          
          // Guard: Don't save empty snapshots that would corrupt the draft
          const snapshotNome = (snapshot?.cliente?.nome ?? '').trim()
          const snapshotEndereco = (snapshot?.cliente?.endereco ?? '').trim()
          const snapshotKwh = Number(snapshot?.kcKwhMes ?? 0)
          
          const isEmptySnapshot = !snapshotNome && !snapshotEndereco && snapshotKwh === 0
          
          if (isEmptySnapshot) {
            return
          }
          
          await saveFormDraft(snapshot)
          console.log('[App] Auto-saved form draft to IndexedDB')
        } catch (error) {
          console.warn('[App] Auto-save failed:', error)
        }
      }, AUTO_SAVE_INTERVAL_MS)
    }
    
    // Agendar primeiro auto-save
    scheduleAutoSave()
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [
    cliente,
    kcKwhMes,
    tarifaCheia,
    potenciaModulo,
    numeroModulosManual,
    activeTab,
    ucsBeneficiarias,
    budgetStructuredItems,
  ])

  const aplicarSnapshot = (
    snapshotEntrada: OrcamentoSnapshotData,
    options?: { budgetIdOverride?: string; allowEmpty?: boolean },
  ) => {
    console.log('[aplicarSnapshot] Starting to apply snapshot')
    console.log('[aplicarSnapshot] Snapshot cliente data:', {
      nome: snapshotEntrada.cliente?.nome,
      endereco: snapshotEntrada.cliente?.endereco,
      cidade: snapshotEntrada.cliente?.cidade,
      documento: snapshotEntrada.cliente?.documento,
    })
    
    // Guard: Block empty snapshot applications that would wipe form data
    const nome = (snapshotEntrada?.cliente?.nome ?? '').trim()
    const endereco = (snapshotEntrada?.cliente?.endereco ?? '').trim()
    const kwh = Number(snapshotEntrada?.kcKwhMes ?? 0)
    
    const isEmptyApply = !nome && !endereco && kwh === 0
    
    // Allow empty only if explicitly requested (intentional reset)
    if (isEmptyApply && !options?.allowEmpty) {
      console.warn('[aplicarSnapshot] BLOCKED empty snapshot apply (would wipe form)', {
        cliente: snapshotEntrada?.cliente,
        kcKwhMes: snapshotEntrada?.kcKwhMes,
        currentBudgetId: snapshotEntrada?.currentBudgetId,
        activeTab: snapshotEntrada?.activeTab,
      })
      console.trace('[aplicarSnapshot] caller stacktrace (who called apply with empty snapshot)')
      return
    }
    
    const snapshotClonado = cloneSnapshotData(snapshotEntrada)
    const budgetId = options?.budgetIdOverride ?? snapshotClonado.currentBudgetId
    const snapshot = mergeSnapshotWithDefaults(snapshotClonado, budgetId)
    snapshot.tipoInstalacao = normalizeTipoInstalacao(snapshot.tipoInstalacao)
    snapshot.tipoInstalacaoOutro = snapshot.tipoInstalacaoOutro || ''
    snapshot.tipoEdificacaoOutro = snapshot.tipoEdificacaoOutro || ''
    snapshot.pageShared = {
      ...snapshot.pageShared,
      tipoInstalacao: normalizeTipoInstalacao(snapshot.pageShared.tipoInstalacao),
      tipoInstalacaoOutro: snapshot.pageShared.tipoInstalacaoOutro || '',
    }

    fieldSyncActions.reset()
    setActiveTab(snapshot.activeTab)
    setSettingsTab(snapshot.settingsTab)
    const clienteClonado = cloneClienteDados(snapshot.cliente)
    console.log('[aplicarSnapshot] Setting cliente to:', {
      nome: clienteClonado.nome,
      endereco: clienteClonado.endereco,
      cidade: clienteClonado.cidade,
    })
    setClienteSync(clienteClonado)
    console.log('[aplicarSnapshot] clienteRef after setCliente:', clienteRef.current?.endereco)
    setClienteEmEdicaoId(snapshot.clienteEmEdicaoId)
    lastSavedClienteRef.current = snapshot.clienteEmEdicaoId ? clienteClonado : null
    setClienteMensagens(snapshot.clienteMensagens ? { ...snapshot.clienteMensagens } : {})
    setUcsBeneficiarias(cloneUcBeneficiariasForm(snapshot.ucBeneficiarias || []))
    setPageSharedState({ ...snapshot.pageShared })
    switchBudgetId(budgetId)
    setBudgetStructuredItems(cloneStructuredItems(snapshot.budgetStructuredItems))
    setKitBudget(cloneKitBudgetState(snapshot.kitBudget))
    setPropostaImagens(
      Array.isArray(snapshot.propostaImagens)
        ? snapshot.propostaImagens.map((imagem) => ({ ...imagem }))
        : [],
    )
    setIsBudgetProcessing(snapshot.budgetProcessing.isProcessing)
    setBudgetProcessingError(snapshot.budgetProcessing.error)
    setBudgetProcessingProgress(cloneBudgetUploadProgress(snapshot.budgetProcessing.progress))
    setIsBudgetTableCollapsed(snapshot.budgetProcessing.isTableCollapsed)
    setOcrDpi(snapshot.budgetProcessing.ocrDpi)
    setUfTarifa(snapshot.ufTarifa)
    setDistribuidoraTarifa(snapshot.distribuidoraTarifa)
    setUfsDisponiveis([...snapshot.ufsDisponiveis])
    setDistribuidorasPorUf(cloneDistribuidorasMapa(snapshot.distribuidorasPorUf))
    setMesReajuste(snapshot.mesReajuste)
    mesReferenciaRef.current = snapshot.mesReajuste
    setConsumoManual(snapshot.consumoManual)
    setKcKwhMes(snapshot.kcKwhMes, snapshot.consumoManual ? 'user' : 'auto')
    setTarifaCheia(snapshot.tarifaCheia)
    setDesconto(snapshot.desconto)
    setTaxaMinima(snapshot.taxaMinima)
    setTaxaMinimaInputEmpty(snapshot.taxaMinimaInputEmpty)
    setEncargosFixosExtras(snapshot.encargosFixosExtras)
    const tusdNormalizado = normalizeTipoBasico(snapshot.tusdTipoCliente)
    setTusdPercent(snapshot.tusdPercent)
    setTusdTipoCliente(tusdNormalizado)
    setTusdSubtipo(snapshot.tusdSubtipo)
    setTusdSimultaneidade(snapshot.tusdSimultaneidade)
    setTusdSimultaneidadeManualOverride(snapshot.tusdSimultaneidade != null)
    setTusdTarifaRkwh(snapshot.tusdTarifaRkwh)
    setTusdAnoReferencia(snapshot.tusdAnoReferencia)
    setTusdOpcoesExpandidas(snapshot.tusdOpcoesExpandidas)
    setLeasingPrazo(snapshot.leasingPrazo)
    setPotenciaModulo(snapshot.potenciaModulo)
    setPotenciaModuloDirty(snapshot.potenciaModuloDirty)
    setTipoInstalacao(snapshot.tipoInstalacao)
    setTipoInstalacaoOutro(snapshot.tipoInstalacaoOutro)
    setTipoInstalacaoDirty(snapshot.tipoInstalacaoDirty)
    setTipoSistema(snapshot.tipoSistema)
    setSegmentoCliente(normalizeTipoBasico(snapshot.segmentoCliente))
    setTipoEdificacaoOutro(snapshot.tipoEdificacaoOutro)
    setNumeroModulosManual(snapshot.numeroModulosManual)
    setConfiguracaoUsinaObservacoes(snapshot.configuracaoUsinaObservacoes ?? '')
    setComposicaoTelhado({ ...snapshot.composicaoTelhado })
    setComposicaoSolo({ ...snapshot.composicaoSolo })
    setAprovadoresText(snapshot.aprovadoresText)
    setImpostosOverridesDraft(cloneImpostosOverrides(snapshot.impostosOverridesDraft))
    useVendasConfigStore.getState().replace(snapshot.vendasConfig)
    const simulacoesClonadas = cloneVendasSimulacoes(snapshot.vendasSimulacoes)
    useVendasSimulacoesStore.setState({ simulations: simulacoesClonadas })
    setMultiUcAtivo(snapshot.multiUc.ativo)
    setMultiUcRows(snapshot.multiUc.rows.map((row) => ({ ...row })))
    setMultiUcRateioModo(snapshot.multiUc.rateioModo)
    setMultiUcEnergiaGeradaKWh(snapshot.multiUc.energiaGeradaKWh, 'auto')
    setMultiUcEnergiaGeradaTouched(snapshot.multiUc.energiaGeradaTouched)
    setMultiUcAnoVigencia(snapshot.multiUc.anoVigencia)
    setMultiUcOverrideEscalonamento(snapshot.multiUc.overrideEscalonamento)
    setMultiUcEscalonamentoCustomPercent(snapshot.multiUc.escalonamentoCustomPercent)
    multiUcConsumoAnteriorRef.current = snapshot.kcKwhMes
    multiUcIdCounterRef.current = snapshot.multiUc.rows.length + 1
    setPrecoPorKwp(snapshot.precoPorKwp)
    setIrradiacao(snapshot.irradiacao)
    setEficiencia(snapshot.eficiencia)
    setDiasMes(snapshot.diasMes)
    setInflacaoAa(snapshot.inflacaoAa)
    setVendaForm({
      ...snapshot.vendaForm,
      segmento_cliente: snapshot.vendaForm.segmento_cliente
        ? normalizeTipoBasico(snapshot.vendaForm.segmento_cliente)
        : undefined,
      tusd_tipo_cliente: snapshot.vendaForm.tusd_tipo_cliente
        ? normalizeTipoBasico(snapshot.vendaForm.tusd_tipo_cliente)
        : undefined,
    })
    setCapexManualOverride(snapshot.capexManualOverride)
    setParsedVendaPdf(snapshot.parsedVendaPdf)
    setEstruturaTipoWarning(snapshot.estruturaTipoWarning)
    setJurosFinAa(snapshot.jurosFinAa)
    setPrazoFinMeses(snapshot.prazoFinMeses)
    setEntradaFinPct(snapshot.entradaFinPct)
    setMostrarFinanciamento(snapshot.mostrarFinanciamento)
    setMostrarGrafico(snapshot.mostrarGrafico)
    setPrazoMeses(snapshot.prazoMeses)
    setBandeiraEncargo(snapshot.bandeiraEncargo)
    setCipEncargo(snapshot.cipEncargo)
    setEntradaRs(snapshot.entradaRs)
    setEntradaModo(snapshot.entradaModo)
    setMostrarValorMercadoLeasing(Boolean(snapshot.mostrarValorMercadoLeasing))
    setMostrarTabelaParcelas(snapshot.mostrarTabelaParcelas)
    setMostrarTabelaBuyout(snapshot.mostrarTabelaBuyout)
    setMostrarTabelaParcelasConfig(snapshot.mostrarTabelaParcelasConfig)
    setMostrarTabelaBuyoutConfig(snapshot.mostrarTabelaBuyoutConfig)
    setOemBase(snapshot.oemBase)
    setOemInflacao(snapshot.oemInflacao)
    setSeguroModo(snapshot.seguroModo)
    setSeguroReajuste(snapshot.seguroReajuste)
    setSeguroValorA(snapshot.seguroValorA)
    setSeguroPercentualB(snapshot.seguroPercentualB)
    setExibirLeasingLinha(snapshot.exibirLeasingLinha)
    setExibirFinLinha(snapshot.exibirFinLinha)
    setCashbackPct(snapshot.cashbackPct)
    setDepreciacaoAa(snapshot.depreciacaoAa)
    setInadimplenciaAa(snapshot.inadimplenciaAa)
    setTributosAa(snapshot.tributosAa)
    setIpcaAa(snapshot.ipcaAa)
    setCustosFixosM(snapshot.custosFixosM)
    setOpexM(snapshot.opexM)
    setSeguroM(snapshot.seguroM)
    setDuracaoMeses(snapshot.duracaoMeses)
    setPagosAcumAteM(snapshot.pagosAcumAteM)
    setModoOrcamento(snapshot.modoOrcamento ?? 'auto')
    setAutoKitValor(snapshot.autoKitValor ?? null)
    setAutoCustoFinal(snapshot.autoCustoFinal ?? null)
    setAutoPricingRede(snapshot.autoPricingRede ?? null)
    setAutoPricingVersion(snapshot.autoPricingVersion ?? null)
    setAutoBudgetReason(snapshot.autoBudgetReason ?? null)
    setAutoBudgetReasonCode(snapshot.autoBudgetReasonCode ?? null)
    setTipoRede(snapshot.tipoRede ?? 'monofasico')
    setTipoRedeControle(snapshot.tipoRedeControle ?? 'auto')
    setLeasingAnexosSelecionados(
      ensureRequiredLeasingAnexos(
        Array.isArray(snapshot.leasingAnexosSelecionados)
          ? [...snapshot.leasingAnexosSelecionados]
          : getDefaultLeasingAnexos(
              snapshot.leasingSnapshot?.contrato?.tipoContrato ?? 'residencial',
            ),
        snapshot.leasingSnapshot?.contrato?.tipoContrato ?? 'residencial',
      ),
    )

    vendaStore.setState((draft) => {
      Object.assign(draft, JSON.parse(JSON.stringify(snapshot.vendaSnapshot)) as VendaSnapshot)
    })
    leasingActions.update(snapshot.leasingSnapshot)

    if (options?.budgetIdOverride) {
      vendaActions.updateCodigos({ codigo_orcamento_interno: '', data_emissao: '' })
    }
  }

  const handleEditarCliente = useCallback(
    async (registro: ClienteRegistro) => {
      const registroHidratado = await hydrateClienteRegistroFromStore(registro)
      const dadosClonados = cloneClienteDados(registroHidratado.dados)
      const snapshotBase = registroHidratado.propostaSnapshot
        ? mergeSnapshotWithDefaults(
            registroHidratado.propostaSnapshot,
            registroHidratado.propostaSnapshot.currentBudgetId ?? getActiveBudgetId(),
          )
        : createEmptySnapshot(getActiveBudgetId(), activeTabRef.current ?? activeTab)
      const snapshotToApply: OrcamentoSnapshotData = {
        ...snapshotBase,
        cliente: dadosClonados,
        clienteEmEdicaoId: registroHidratado.id,
        clienteMensagens: {},
      }
      const allowEmpty =
        !registroHidratado.propostaSnapshot || isSnapshotEmpty(snapshotToApply)
      aplicarSnapshot(snapshotToApply, {
        budgetIdOverride: snapshotToApply.currentBudgetId ?? getActiveBudgetId(),
        allowEmpty,
      })
      fecharClientesPainel()
    },
    [
      activeTab,
      aplicarSnapshot,
      createEmptySnapshot,
      fecharClientesPainel,
      getActiveBudgetId,
      hydrateClienteRegistroFromStore,
      isSnapshotEmpty,
      mergeSnapshotWithDefaults,
    ],
  )

  const carregarOrcamentoParaEdicao = useCallback(
    async (registro: OrcamentoSalvo, options?: { notificationMessage?: string }) => {
      // Try to load complete snapshot from proposalStore first
      let snapshotToApply = registro.snapshot
      
      if (registro.id) {
        // Use normalized ID for consistent lookup
        const budgetIdKey = normalizeProposalId(registro.id) || registro.id
        console.log(`[carregarOrcamentoParaEdicao] Loading complete snapshot for budget: ${budgetIdKey} (original: ${registro.id})`)
        const completeSnapshot = await loadProposalSnapshotById(budgetIdKey)
        
        if (completeSnapshot) {
          // Validate that loaded snapshot is meaningful
          const nome = (completeSnapshot.cliente?.nome ?? '').trim()
          const endereco = (completeSnapshot.cliente?.endereco ?? '').trim()
          const documento = (completeSnapshot.cliente?.documento ?? '').trim()
          const kc = Number(completeSnapshot.kcKwhMes ?? 0)
          const isMeaningful = Boolean(nome || endereco || documento) || kc > 0
          
          if (isMeaningful) {
            console.log('[carregarOrcamentoParaEdicao] Using complete snapshot from proposalStore', {
              clienteNome: completeSnapshot.cliente?.nome,
              clienteEndereco: completeSnapshot.cliente?.endereco,
              kcKwhMes: completeSnapshot.kcKwhMes,
              totalFields: Object.keys(completeSnapshot).length,
            })
            snapshotToApply = completeSnapshot
          } else {
            console.warn('[carregarOrcamentoParaEdicao] proposalStore snapshot is empty, falling back to registro.snapshot')
          }
        } else {
          console.warn('[carregarOrcamentoParaEdicao] Complete snapshot not found, falling back to registro.snapshot')
        }
      }
      
      if (!snapshotToApply) {
        window.alert(
          'Este orçamento foi salvo sem histórico completo. Visualize o PDF ou salve novamente para gerar uma cópia editável.',
        )
        return
      }

      const targetBudgetId = normalizeProposalId(registro.id) || registro.id
      isHydratingRef.current = true
      setIsHydrating(true)
      try {
        switchBudgetId(targetBudgetId)
        await tick()
        aplicarSnapshot(snapshotToApply, { budgetIdOverride: targetBudgetId })
        await tick()
      } finally {
        isHydratingRef.current = false
        setIsHydrating(false)
      }
      setActivePage('app')
      atualizarOrcamentoAtivo(registro)
      adicionarNotificacao(
        options?.notificationMessage ??
          'Orçamento carregado para edição. Salve novamente para preservar as alterações.',
        'info',
      )
    },
    [adicionarNotificacao, aplicarSnapshot, atualizarOrcamentoAtivo, setActivePage],
  )

  const limparDadosModalidade = useCallback((tipo: PrintableProposalTipo) => {
    fieldSyncActions.reset()
    if (tipo === 'VENDA_DIRETA') {
      vendaStore.reset()
    } else {
      leasingActions.reset()
    }
  }, [])

  const salvarOrcamentoLocalmente = useCallback(
    (dados: PrintableProposalProps): OrcamentoSalvo | null => {
      if (typeof window === 'undefined') {
        return null
      }

      const distribuidoraValidation = getDistribuidoraValidationMessage(
        procuracaoUf || cliente.uf,
        distribuidoraAneelEfetiva,
      )
      if (distribuidoraValidation) {
        adicionarNotificacao(distribuidoraValidation, 'error')
        return null
      }

      try {
        const registrosExistentes = carregarOrcamentosSalvos()
        const dadosClonados = clonePrintableData(dados)
        const snapshotAtual = getCurrentSnapshot()
        const activeBudgetId = getActiveBudgetId()
        if (!snapshotAtual || isHydratingRef.current || !activeBudgetId) {
          console.warn('[salvarOrcamentoLocalmente] blocked: hydrating or missing budgetId', {
            hydrating: isHydratingRef.current,
            budgetIdRef: budgetIdRef.current,
            budgetIdState: currentBudgetId,
          })
          return null
        }
        const snapshotClonado = cloneSnapshotData(snapshotAtual)
        
        // Log snapshot quality before saving
        console.log('[salvarOrcamentoLocalmente] Snapshot from getCurrentSnapshot():', {
          clienteNome: snapshotClonado.cliente?.nome ?? '',
          clienteEndereco: snapshotClonado.cliente?.endereco ?? '',
          clienteDocumento: snapshotClonado.cliente?.documento ?? '',
          kcKwhMes: snapshotClonado.kcKwhMes ?? 0,
          totalFields: Object.keys(snapshotClonado).length,
        })
        
        // Check if snapshot is meaningful
        const nome = (snapshotClonado.cliente?.nome ?? '').trim()
        const endereco = (snapshotClonado.cliente?.endereco ?? '').trim()
        const documento = (snapshotClonado.cliente?.documento ?? '').trim()
        const kc = Number(snapshotClonado.kcKwhMes ?? 0)
        const hasCliente = Boolean(nome || endereco || documento)
        const hasConsumption = kc > 0
        const isSnapshotMeaningful = hasCliente || hasConsumption
        
        if (!isSnapshotMeaningful) {
          console.warn('[salvarOrcamentoLocalmente] Snapshot is empty - cannot save proposal without data')
          window.alert('Proposta sem dados para salvar. Preencha os campos do cliente e/ou consumo.')
          return null
        }
        
        const fingerprint = computeSnapshotSignature(snapshotClonado, dadosClonados)

        const registroExistenteIndex = registrosExistentes.findIndex((registro) => {
          if (registro.snapshot) {
            return computeSnapshotSignature(registro.snapshot, registro.dados) === fingerprint
          }
          return createBudgetFingerprint(registro.dados) === fingerprint
        })

        if (registroExistenteIndex >= 0) {
          const existente = registrosExistentes[registroExistenteIndex]
          if (!existente) {
            console.error('Orçamento salvo não encontrado para atualização.')
            return null
          }
          const snapshotAtualizado = cloneSnapshotData(snapshotClonado)
          snapshotAtualizado.currentBudgetId = existente.id
          if (snapshotAtualizado.vendaSnapshot.codigos) {
            snapshotAtualizado.vendaSnapshot.codigos = {
              ...snapshotAtualizado.vendaSnapshot.codigos,
              codigo_orcamento_interno: existente.id,
            }
          }
          const clienteIdAtual = clienteEmEdicaoIdRef.current
        const effectiveBudgetId = getActiveBudgetId()
        snapshotAtualizado.currentBudgetId = effectiveBudgetId
        const registroAtualizado: OrcamentoSalvo = {
          ...existente,
          clienteId: clienteIdAtual ?? existente.clienteId,
          clienteNome: dados.cliente.nome,
            clienteCidade: dados.cliente.cidade,
            clienteUf: dados.cliente.uf,
            clienteDocumento: dados.cliente.documento,
            clienteUc: dados.cliente.uc,
            dados: { ...dadosClonados, budgetId: existente.id },
            snapshot: snapshotAtualizado,
          }

          const registrosAtualizados = [
            registroAtualizado,
            ...registrosExistentes.filter((_, index) => index !== registroExistenteIndex),
          ]
          const { persisted, pruned } = persistBudgetsToLocalStorage(registrosAtualizados)
          setOrcamentosSalvos(persisted)
          alertPrunedBudgets(pruned)
          void persistRemoteStorageEntry(BUDGETS_STORAGE_KEY, JSON.stringify(persisted))
          void persistPropostasToOneDrive(JSON.stringify(persisted)).catch((error) => {
            if (error instanceof OneDriveIntegrationMissingError) {
              return
            }
            console.warn('Não foi possível sincronizar propostas com o OneDrive.', error)
          })
          
          // Save complete snapshot to proposalStore for full restoration
          const budgetIdKey = normalizeProposalId(effectiveBudgetId) || effectiveBudgetId
          console.log('[salvarOrcamentoLocalmente] Saving to proposalStore (update):', {
            budgetId: budgetIdKey,
            clienteNome: snapshotAtualizado.cliente?.nome ?? '',
            clienteEndereco: snapshotAtualizado.cliente?.endereco ?? '',
            clienteDocumento: snapshotAtualizado.cliente?.documento ?? '',
            kcKwhMes: snapshotAtualizado.kcKwhMes ?? 0,
            totalFields: Object.keys(snapshotAtualizado).length,
          })
          void saveProposalSnapshotById(budgetIdKey, snapshotAtualizado).catch((error) => {
            console.error('[proposalStore] ERROR saving snapshot for budget:', budgetIdKey, error)
          })
          
          return persisted.find((registro) => registro.id === registroAtualizado.id) ?? registroAtualizado
        }

        const existingIds = new Set(registrosExistentes.map((registro) => registro.id))
        const candidatoInformado = normalizeProposalId(dadosClonados.budgetId)
        const novoId =
          candidatoInformado && !existingIds.has(candidatoInformado)
            ? candidatoInformado
            : generateBudgetId(existingIds, dadosClonados.tipoProposta)
        switchBudgetId(novoId)
        const snapshotParaArmazenar = cloneSnapshotData(snapshotClonado)
        snapshotParaArmazenar.currentBudgetId = novoId
        if (snapshotParaArmazenar.vendaSnapshot.codigos) {
          snapshotParaArmazenar.vendaSnapshot.codigos = {
            ...snapshotParaArmazenar.vendaSnapshot.codigos,
            codigo_orcamento_interno: novoId,
          }
        }

        const clienteIdAtual = clienteEmEdicaoIdRef.current
        const registro: OrcamentoSalvo = {
          id: novoId,
          criadoEm: new Date().toISOString(),
          clienteId: clienteIdAtual ?? undefined,
          clienteNome: dados.cliente.nome,
          clienteCidade: dados.cliente.cidade,
          clienteUf: dados.cliente.uf,
          clienteDocumento: dados.cliente.documento,
          clienteUc: dados.cliente.uc,
          dados: { ...dadosClonados, budgetId: novoId },
          snapshot: snapshotParaArmazenar,
        }

        existingIds.add(registro.id)
        const registrosAtualizados = [registro, ...registrosExistentes]
        const { persisted, pruned } = persistBudgetsToLocalStorage(registrosAtualizados)
        setOrcamentosSalvos(persisted)
        alertPrunedBudgets(pruned)
        void persistRemoteStorageEntry(BUDGETS_STORAGE_KEY, JSON.stringify(persisted))
        void persistPropostasToOneDrive(JSON.stringify(persisted)).catch((error) => {
          if (error instanceof OneDriveIntegrationMissingError) {
            return
          }
          console.warn('Não foi possível sincronizar propostas com o OneDrive.', error)
        })
        
        // Save complete snapshot to proposalStore for full restoration
        const budgetIdKey = normalizeProposalId(registro.id) || registro.id
        console.log('[salvarOrcamentoLocalmente] Saving to proposalStore (new):', {
          budgetId: budgetIdKey,
          clienteNome: snapshotParaArmazenar.cliente?.nome ?? '',
          clienteEndereco: snapshotParaArmazenar.cliente?.endereco ?? '',
          clienteDocumento: snapshotParaArmazenar.cliente?.documento ?? '',
          kcKwhMes: snapshotParaArmazenar.kcKwhMes ?? 0,
          totalFields: Object.keys(snapshotParaArmazenar).length,
        })
        void saveProposalSnapshotById(budgetIdKey, snapshotParaArmazenar).catch((error) => {
          console.error('[proposalStore] ERROR saving snapshot for budget:', budgetIdKey, error)
        })
        
        return persisted.find((item) => item.id === registro.id) ?? registro
      } catch (error) {
        console.error('Erro ao salvar orçamento localmente.', error)
        window.alert('Não foi possível salvar o orçamento. Tente novamente.')
        return null
      }
    },
    [carregarOrcamentosSalvos],
  )

  useEffect(() => {
    computeSignatureRef.current = () => {
      const snapshot = getCurrentSnapshot()
      if (!snapshot) {
        const dadosAtuais = clonePrintableData(printableData)
        return stableStringify({ snapshot: null, dados: dadosAtuais })
      }
      const dadosAtuais = clonePrintableData(printableData)
      return stableStringify({ snapshot, dados: dadosAtuais })
    }
  })

  useEffect(() => {
    if (initialSignatureSetRef.current) {
      return
    }

    initialSignatureSetRef.current = true
    lastSavedSignatureRef.current = computeSignatureRef.current()
  })

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const handleUserInput = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-ignore-unsaved-warning]')) {
        return
      }

      userInteractedSinceSaveRef.current = true
    }

    document.addEventListener('input', handleUserInput, true)
    document.addEventListener('change', handleUserInput, true)

    return () => {
      document.removeEventListener('input', handleUserInput, true)
      document.removeEventListener('change', handleUserInput, true)
    }
  }, [])

  useEffect(() => {
    if (isHydrating) {
      return
    }
    console.log('[Hydration] DONE - cliente state:', {
      nome: cliente?.nome ?? '',
      endereco: cliente?.endereco ?? '',
      cidade: cliente?.cidade ?? '',
      documento: cliente?.documento ?? '',
    })
  }, [cliente?.cidade, cliente?.documento, cliente?.endereco, cliente?.nome, isHydrating])

  const hasUnsavedChanges = useCallback(() => {
    if (!userInteractedSinceSaveRef.current) {
      return false
    }

    if (lastSavedSignatureRef.current == null) {
      return initialSignatureSetRef.current
    }

    return computeSignatureRef.current() !== lastSavedSignatureRef.current
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const removerOrcamentoSalvo = useCallback(
    (id: string) => {
      if (typeof window === 'undefined') {
        return
      }

      setOrcamentosSalvos((prevRegistros) => {
        const registrosAtualizados = prevRegistros.filter((registro) => registro.id !== id)

        try {
          const { persisted } = persistBudgetsToLocalStorage(registrosAtualizados)
          return persisted
        } catch (error) {
          console.error('Erro ao atualizar os orçamentos salvos.', error)
          window.alert('Não foi possível atualizar os orçamentos salvos. Tente novamente.')
          return prevRegistros
        }
      })
    },
    [setOrcamentosSalvos],
  )

  const handleAbrirUploadImagens = useCallback(() => {
    imagensUploadInputRef.current?.click()
  }, [])

  const handleImagensSelecionadas = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const arquivos = Array.from(event.target.files ?? [])
      if (!arquivos.length) {
        event.target.value = ''
        return
      }

      const imagens = await Promise.all(arquivos.map((arquivo) => readPrintableImageFromFile(arquivo)))
      const imagensValidas = imagens.filter(
        (imagem): imagem is PrintableProposalImage => Boolean(imagem && imagem.url),
      )
      if (imagensValidas.length > 0) {
        setPropostaImagens((prev) => [...prev, ...imagensValidas])
      }
      event.target.value = ''
    },
    [setPropostaImagens],
  )

  const handleRemoverPropostaImagem = useCallback(
    (imagemId: string, fallbackIndex: number) => {
      setPropostaImagens((prevImagens) => {
        if (prevImagens.length === 0) {
          return prevImagens
        }

        const filtradas = prevImagens.filter((imagem) => imagem.id !== imagemId)
        if (filtradas.length !== prevImagens.length) {
          return filtradas
        }

        if (fallbackIndex >= 0 && fallbackIndex < prevImagens.length) {
          return prevImagens.filter((_, index) => index !== fallbackIndex)
        }

        return prevImagens
      })
    },
    [setPropostaImagens],
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
    if (isVendaDiretaTab) {
      if (!guardClientFieldsOrReturn('venda')) {
        return
      }
    } else if (!validatePropostaLeasingMinimal()) {
      return
    }

    if (!(await ensureNormativePrecheck())) {
      return
    }

    if (!confirmarAlertasGerarProposta()) {
      return
    }

    const clienteSalvo = await handleSalvarCliente({ skipGuard: true })
    if (!clienteSalvo) {
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
        observacaoImportante: printableData.informacoesImportantesObservacao ?? null,
      })

      const sanitizedHtml = sanitizePrintableHtml(html)

      if (!sanitizedHtml) {
        throw new Error('Não foi possível preparar o conteúdo da tabela para impressão.')
      }

      const nomeCliente = cliente.nome?.trim() || 'SolarInvest'
      const budgetIdNormalizado = normalizeProposalId(codigoOrcamento)

      pendingPreviewDataRef.current = null

      openBudgetPreviewWindow(sanitizedHtml, {
        nomeCliente,
        budgetId: budgetIdNormalizado || codigoOrcamento,
        actionMessage:
          'Revise a tabela e utilize as ações da barra superior para imprimir ou baixar o PDF.',
        initialMode: 'preview',
        initialVariant: 'buyout',
      })
    } catch (error) {
      console.error('Erro ao preparar a tabela de valor de transferência para impressão.', error)
      const mensagem =
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível abrir a visualização da tabela de valor de transferência. Tente novamente.'
      adicionarNotificacao(mensagem, 'error')
    } finally {
      setGerandoTabelaTransferencia(false)
    }
  }, [
    adicionarNotificacao,
    cliente,
    duracaoMeses,
    gerandoTabelaTransferencia,
    openBudgetPreviewWindow,
    printableData.budgetId,
    printableData.informacoesImportantesObservacao,
    renderPrintableBuyoutTableToHtml,
    tabelaBuyout,
    buyoutResumo,
  ])

  const handlePreviewActionRequest = useCallback(
    async ({ action: _action }: PreviewActionRequest): Promise<PreviewActionResponse> => {
      const previewData = pendingPreviewDataRef.current
      const budgetIdAtual = normalizeProposalId(getActiveBudgetId())

      if (!previewData) {
        return { proceed: true }
      }

      const { dados } = previewData
      const idExistente = normalizeProposalId(dados.budgetId ?? budgetIdAtual)
      if (idExistente) {
        const emissaoIso = new Date().toISOString().slice(0, 10)
        switchBudgetId(idExistente)
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
        switchBudgetId(registro.id)

        vendaActions.updateCodigos({
          codigo_orcamento_interno: registro.id,
          data_emissao: emissaoIso,
        })

        atualizarOrcamentoAtivo(registro)

        let htmlAtualizado = sanitizePrintableHtml(previewData.html) || ''
        try {
          const reprocessado = await renderPrintableProposalToHtml(dados)
          if (reprocessado) {
            const sanitized = sanitizePrintableHtml(reprocessado)
            if (sanitized) {
              htmlAtualizado = sanitized
              previewData.html = sanitized
            }
          }
        } catch (error) {
          console.warn('Não foi possível atualizar o HTML antes da impressão.', error)
        }

        try {
          const proposalType = activeTab === 'vendas' ? 'VENDA_DIRETA' : 'LEASING'
            const integracaoPdfDisponivel = isProposalPdfIntegrationAvailable()
            setProposalPdfIntegrationAvailable(integracaoPdfDisponivel)
            if (integracaoPdfDisponivel) {
              try {
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
                if (error instanceof ProposalPdfIntegrationMissingError) {
                  setProposalPdfIntegrationAvailable(false)
                  adicionarNotificacao(
                    'Proposta preparada, mas a integração para salvar PDF não está configurada.',
                    'info',
                  )
                } else {
                  console.error('Erro ao salvar a proposta em PDF durante a impressão.', error)
                  window.alert('Não foi possível salvar a proposta em PDF. Tente novamente.')
                  return { proceed: false }
                }
              }
            } else {
              adicionarNotificacao(
                'Proposta preparada, mas a integração para salvar PDF não está configurada.',
                'info',
              )
            }
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
        atualizarOrcamentoAtivo,
        clienteEmEdicaoId,
        getActiveBudgetId,
        isProposalPdfIntegrationAvailable,
        salvarOrcamentoLocalmente,
        setProposalPdfIntegrationAvailable,
        switchBudgetId,
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

  const prepararDadosContratoCliente = useCallback((): ClienteContratoPayload | null => {
    const nomeCompleto = cliente.nome?.trim() ?? ''
    const cpfCnpj = cliente.documento?.trim() ?? ''
    const unidadeConsumidora = cliente.uc?.trim() ?? ''
    const cep = cliente.cep?.trim() ?? ''
    const enderecoPrincipal = cliente.endereco?.trim() ?? ''
    const cidade = cliente.cidade?.trim() ?? ''
    const uf = (procuracaoUf || cliente.uf)?.trim().toUpperCase() ?? ''
    const distribuidora = distribuidoraAneelEfetiva
    const temIndicacao = Boolean(cliente.temIndicacao)
    const indicacaoNome = cliente.indicacaoNome?.trim() ?? ''
    const telefone = cliente.telefone?.trim() ?? ''
    const email = cliente.email?.trim() ?? ''

    const cpfDigits = normalizeNumbers(cpfCnpj)
    const cepDigits = normalizeNumbers(cep)
    const ucDigits = normalizeNumbers(unidadeConsumidora)

    const pendencias: string[] = []
    if (!nomeCompleto) pendencias.push('nome ou razão social')
    if (!cpfDigits || (cpfDigits.length !== 11 && cpfDigits.length !== 14)) {
      pendencias.push('CPF ou CNPJ completo')
    }
    if (!cepDigits || cepDigits.length !== 8) {
      pendencias.push('CEP com 8 dígitos')
    }
    if (!enderecoPrincipal) pendencias.push('endereço de instalação')
    if (!cidade) pendencias.push('cidade')
    if (!uf) pendencias.push('estado (UF)')
    if (!distribuidora) pendencias.push('distribuidora (ANEEL)')
    if (!ucDigits) pendencias.push('código da unidade consumidora (UC)')
    if (temIndicacao && !indicacaoNome) {
      pendencias.push('nome de quem indicou')
    }

    if (pendencias.length > 0) {
      const ultima = pendencias[pendencias.length - 1]
      const prefixo = pendencias.slice(0, -1)
      const campos = prefixo.length > 0 ? `${prefixo.join(', ')} e ${ultima}` : ultima
      adicionarNotificacao(
        `Preencha os campos obrigatórios do cliente antes de gerar contratos: ${campos}.`,
        'error',
      )
      return null
    }

    const enderecoPartes: string[] = []
    if (enderecoPrincipal) {
      enderecoPartes.push(enderecoPrincipal)
    }

    const cidadeUf = [cidade, uf].filter(Boolean).join('/')
    if (cidadeUf) {
      enderecoPartes.push(cidadeUf)
    }

    if (cep) {
      enderecoPartes.push(cep)
    }

    const enderecoCompleto = enderecoPartes.join(', ')

    return { 
      nomeCompleto, 
      cpfCnpj, 
      enderecoCompleto, 
      unidadeConsumidora, 
      kWhContratado: formatNumberBRWithOptions(Math.max(kcKwhMes || 0, 0), {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
      uf, 
      telefone, 
      email,
      endereco: enderecoPrincipal,
      cidade,
      cep
    }
  }, [
    adicionarNotificacao,
    cliente.cidade,
    cliente.cep,
    cliente.documento,
    cliente.email,
    cliente.endereco,
    cliente.indicacaoNome,
    cliente.nome,
    cliente.telefone,
    cliente.temIndicacao,
    cliente.uc,
    cliente.uf,
    procuracaoUf,
    distribuidoraAneelEfetiva,
    kcKwhMes,
  ])

  const prepararPayloadContratosLeasing = useCallback(() => {
    if (!validateConsumoMinimoLeasing('Informe o Consumo (kWh/mês) para gerar os documentos.')) {
      return null
    }

    const dadosBase = prepararDadosContratoCliente()
    if (!dadosBase) {
      return null
    }

    const pendencias: string[] = []

    const anexosSelecionadosSet = new Set<LeasingAnexoId>(leasingAnexosSelecionados)
    const requerEspecificacoesTecnicas = anexosSelecionadosSet.has('ANEXO_I')

    if (requerEspecificacoesTecnicas) {
      if (!leasingContrato.modulosFV.trim()) pendencias.push('descrição dos módulos FV')
      if (!leasingContrato.inversoresFV.trim()) pendencias.push('descrição dos inversores')
    }

    if (leasingContrato.tipoContrato === 'condominio') {
      if (!leasingContrato.nomeCondominio.trim()) pendencias.push('nome do condomínio')
      if (!leasingContrato.cnpjCondominio.trim()) pendencias.push('CNPJ do condomínio')
      if (!leasingContrato.nomeSindico.trim()) pendencias.push('nome do síndico')
      if (!leasingContrato.cpfSindico.trim()) pendencias.push('CPF do síndico')
    }

    if (pendencias.length > 0) {
      const ultima = pendencias[pendencias.length - 1]
      const inicio = pendencias.slice(0, -1)
      const lista = inicio.length > 0 ? `${inicio.join(', ')} e ${ultima}` : ultima
      adicionarNotificacao(
        `Preencha os campos contratuais obrigatórios antes de gerar os documentos: ${lista}.`,
        'error',
      )
      return null
    }

    const distribuidoraValidation = getDistribuidoraValidationMessage(
      procuracaoUf || cliente.uf,
      distribuidoraAneelEfetiva,
    )
    if (distribuidoraValidation) {
      adicionarNotificacao(distribuidoraValidation, 'error')
      return null
    }

    if (!isProcuracaoUfSupported(procuracaoUf)) {
      adicionarNotificacao(
        'UF não suportada para procuração automática. Atualize a UF selecionada.',
        'error',
      )
      return null
    }

    const formatDateForContract = (value: string) => {
      if (!value) {
        return ''
      }
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) {
        return ''
      }
      return parsed.toLocaleDateString('pt-BR')
    }

    const dataAtualExtenso = new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())

    const potenciaValor = Number.isFinite(potenciaInstaladaKwp) ? potenciaInstaladaKwp : 0
    const energiaValor = Number.isFinite(kcKwhMes) ? kcKwhMes : 0
    const tarifaValor = Number.isFinite(tarifaCheia) ? tarifaCheia : 0

    const potenciaFormatada = formatNumberBRWithOptions(Math.max(potenciaValor, 0), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const energiaFormatada = formatNumberBRWithOptions(Math.max(energiaValor, 0), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
    const tarifaBaseFormatada = formatNumberBRWithOptions(Math.max(tarifaValor, 0), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })

    const proprietariosPayload = leasingContrato.proprietarios
      .map((item) => ({
        nome: item.nome.trim(),
        cpfCnpj: formatCpfCnpj(item.cpfCnpj),
      }))
      .filter((item) => item.nome || item.cpfCnpj)

    const ucsPayload = ucsBeneficiarias
      .map((uc) => ({
        numero: uc.numero.trim(),
        endereco: uc.endereco.trim(),
        rateioPercentual: uc.rateioPercentual.trim(),
      }))
      .filter((uc) => uc.numero || uc.endereco)

    const formatEnderecoContratanteParaTag = (): string => {
      const partes = []
      const endereco = cliente.endereco?.trim() ?? ''
      const cidade = cliente.cidade?.trim() ?? ''
      const uf = cliente.uf?.trim() ?? ''
      const cep = cliente.cep?.trim() ?? ''
      if (endereco) {
        partes.push(endereco)
      }
      const cidadeUf = [cidade, uf].filter(Boolean).join('/')
      if (cidadeUf) {
        partes.push(cidadeUf)
      }
      if (cep) {
        partes.push(`CEP ${cep}`)
      }
      return partes.join(' — ')
    }

    const ucGeradoraTitularAtivo = Boolean(
      leasingContrato.ucGeradoraTitularDiferente && leasingContrato.ucGeradoraTitular,
    )
    const titularUcGeradora = ucGeradoraTitularAtivo
      ? leasingContrato.ucGeradoraTitular
      : null
    const titularUcGeradoraEndereco = ucGeradoraTitularAtivo
      ? formatUcGeradoraTitularEndereco(titularUcGeradora?.endereco)
      : formatEnderecoContratanteParaTag()
    const titularUcGeradoraNomeCompleto = ucGeradoraTitularAtivo
      ? titularUcGeradora?.nomeCompleto?.trim() ?? ''
      : cliente.nome?.trim() ?? ''
    const titularUcGeradoraCpf = ucGeradoraTitularAtivo
      ? titularUcGeradora?.cpf?.trim() ?? ''
      : cliente.documento?.trim() ?? ''
    const titularUcGeradoraRg = ucGeradoraTitularAtivo
      ? titularUcGeradora?.rg?.trim() ?? ''
      : cliente.rg?.trim() ?? ''

    let procuracaoTags: ProcuracaoTags
    try {
      procuracaoTags = buildProcuracaoTags({ cliente, leasingContrato })
    } catch (error) {
      const mensagem =
        error instanceof Error && error.message
          ? error.message
          : 'Preencha os dados do titular diferente da UC geradora para gerar a procuração.'
      adicionarNotificacao(mensagem, 'error')
      return null
    }

    const dadosLeasing = {
      ...dadosBase,
      cpfCnpj: formatCpfCnpj(dadosBase.cpfCnpj),
      // Additional personal/company information
      rg: cliente.rg?.trim() || '',
      estadoCivil: cliente.estadoCivil?.trim() || '',
      nacionalidade: cliente.nacionalidade?.trim() || '',
      profissao: cliente.profissao?.trim() || '',
      // representanteLegal for companies
      representanteLegal: cliente.representanteLegal?.trim() || '',
      // cnpj is mapped from the main documento field for template compatibility
      cnpj: formatCpfCnpj(cliente.documento), // Same as cpfCnpj, for template compatibility
      // Contract and technical data
      potencia: potenciaFormatada,
      kWhContratado: energiaFormatada,
      tarifaBase: tarifaBaseFormatada,
      dataInicio: formatDateForContract(leasingContrato.dataInicio),
      dataFim: formatDateForContract(leasingContrato.dataFim),
      localEntrega: titularUcGeradoraEndereco,
      enderecoUCGeradora: titularUcGeradoraEndereco,
      dataHomologacao: formatDateForContract(leasingContrato.dataHomologacao),
      dataAtualExtenso,
      diaVencimento: cliente.diaVencimento || '10',
      prazoContratual: `${leasingPrazoContratualMeses}`, // Prazo in months only
      modulosFV: leasingContrato.modulosFV.trim(),
      inversoresFV: leasingContrato.inversoresFV.trim(),
      // Contact information
      telefone: dadosBase.telefone,
      email: dadosBase.email,
      // Lists and arrays
      proprietarios: proprietariosPayload,
      ucsBeneficiarias: ucsPayload,
      nomeCondominio: leasingContrato.nomeCondominio.trim(),
      cnpjCondominio: formatCpfCnpj(leasingContrato.cnpjCondominio),
      nomeSindico: leasingContrato.nomeSindico.trim(),
      cpfSindico: formatCpfCnpj(leasingContrato.cpfSindico),
      ucGeradoraTitularDiferente: ucGeradoraTitularAtivo,
      titularUcGeradoraNomeCompleto: titularUcGeradoraNomeCompleto,
      titularUcGeradoraCPF: formatCpfCnpj(titularUcGeradoraCpf),
      titularUcGeradoraRG: titularUcGeradoraRg,
      titularUcGeradoraEndereco: titularUcGeradoraEndereco,
      ...procuracaoTags,
    }

    return {
      tipoContrato: leasingContrato.tipoContrato,
      dadosLeasing,
    }
  }, [
    adicionarNotificacao,
    kcKwhMes,
    leasingContrato,
    leasingPrazoContratualMeses,
    leasingAnexosSelecionados,
    potenciaInstaladaKwp,
    prepararDadosContratoCliente,
    tarifaCheia,
    ucsBeneficiarias,
    procuracaoUf,
    validateConsumoMinimoLeasing,
  ])

  const carregarTemplatesContrato = useCallback(
    async (category: ContractTemplateCategory) => {
      setContractTemplatesLoading(true)
      setContractTemplatesError(null)
      try {
        const params = new URLSearchParams({ categoria: category })
        const response = await fetch(
          resolveApiUrl(`/api/contracts/templates?${params.toString()}`),
        )
        if (!response.ok) {
          let mensagemErro = 'Não foi possível listar os templates de contrato.'
          const contentType = response.headers.get('content-type') ?? ''
          try {
            if (contentType.includes('application/json')) {
              const data = (await response.json()) as { error?: string } | undefined
              if (data?.error) {
                mensagemErro = data.error
              }
            } else {
              const texto = await response.text()
              if (texto.trim()) {
                mensagemErro = texto.trim()
              }
            }
          } catch (error) {
            console.warn('Não foi possível interpretar o erro ao listar templates.', error)
          }
          throw new Error(mensagemErro)
        }

        const payload = (await response.json()) as { templates?: unknown }
        const listaBruta = Array.isArray(payload.templates) ? payload.templates : []
        const nomes = listaBruta
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim())
        if (nomes.length === 0) {
          setContractTemplates([])
          setSelectedContractTemplates([])
          setContractTemplatesError(
            `Nenhum template de contrato disponível para ${category}.`,
          )
          return
        }

        const unicos = Array.from(new Set(nomes))
        setContractTemplates(unicos)
        setSelectedContractTemplates((prev) => {
          const ativos = prev.filter((item) => unicos.includes(item))
          return ativos.length > 0 ? ativos : unicos
        })
      } catch (error) {
        const mensagem =
          error instanceof Error && error.message
            ? error.message
            : 'Não foi possível listar os templates de contrato.'
        console.error('Não foi possível carregar os templates de contrato.', error)
        setContractTemplatesError(mensagem)
        setContractTemplates([])
        setSelectedContractTemplates([])
        adicionarNotificacao(mensagem, 'error')
      } finally {
        setContractTemplatesLoading(false)
      }
    },
    [adicionarNotificacao],
  )

  const carregarDisponibilidadeAnexos = useCallback(async () => {
    setLeasingAnexosLoading(true)
    try {
      const params = new URLSearchParams({
        tipoContrato: leasingContrato.tipoContrato,
        uf: cliente.uf || '',
      })
      const response = await fetch(
        resolveApiUrl(`/api/contracts/leasing/availability?${params.toString()}`),
      )
      if (!response.ok) {
        console.error('Não foi possível verificar disponibilidade dos anexos.')
        // Set all as available by default if check fails
        setLeasingAnexosAvailability({})
        return
      }

      const payload = (await response.json()) as { availability?: Record<string, boolean> }
      const availability = payload.availability || {}
      setLeasingAnexosAvailability(availability as Record<LeasingAnexoId, boolean>)
      setLeasingAnexosSelecionados((prev) => {
        const filtrados = prev.filter((anexoId) => availability[anexoId] !== false)
        return ensureRequiredLeasingAnexos(filtrados, leasingContrato.tipoContrato)
      })
    } catch (error) {
      console.error('Erro ao verificar disponibilidade dos anexos:', error)
      // Set all as available by default if check fails
      setLeasingAnexosAvailability({})
    } finally {
      setLeasingAnexosLoading(false)
    }
  }, [leasingContrato.tipoContrato, cliente.uf])

  const handleToggleContractTemplate = useCallback((template: string) => {
    setSelectedContractTemplates((prev) => {
      if (prev.includes(template)) {
        return prev.filter((item) => item !== template)
      }
      return [...prev, template]
    })
  }, [])

  const handleSelectAllContractTemplates = useCallback(
    (selectAll: boolean) => {
      setSelectedContractTemplates(selectAll ? contractTemplates : [])
    },
    [contractTemplates],
  )

  const handleToggleLeasingAnexo = useCallback((anexoId: LeasingAnexoId) => {
    const config = LEASING_ANEXOS_CONFIG.find((item) => item.id === anexoId)
    if (config?.autoInclude) {
      return
    }
    setLeasingAnexosSelecionados((prev) => {
      if (prev.includes(anexoId)) {
        return prev.filter((item) => item !== anexoId)
      }
      return [...prev, anexoId]
    })
  }, [])

  const handleSelectAllLeasingAnexos = useCallback(
    (selectAll: boolean) => {
      if (!selectAll) {
        setLeasingAnexosSelecionados(
          ensureRequiredLeasingAnexos([], leasingContrato.tipoContrato),
        )
        return
      }
      const disponiveis = LEASING_ANEXOS_CONFIG.filter(
        (config) =>
          config.tipos.includes(leasingContrato.tipoContrato) &&
          !config.autoInclude &&
          leasingAnexosAvailability[config.id] !== false,
      ).map((config) => config.id)
      setLeasingAnexosSelecionados(
        ensureRequiredLeasingAnexos(disponiveis, leasingContrato.tipoContrato),
      )
    },
    [leasingContrato.tipoContrato, leasingAnexosAvailability],
  )

  const handleFecharModalContratos = useCallback(() => {
    setIsContractTemplatesModalOpen(false)
    contratoClientePayloadRef.current = null
  }, [])

  const handleFecharLeasingContractsModal = useCallback(() => {
    setIsLeasingContractsModalOpen(false)
  }, [])

  const salvarContratoNoOneDrive = useCallback(
    async (fileName: string, blob: Blob, contentType?: string) => {
      try {
        const base64 = await readBlobAsBase64(blob)
        await persistContratoToOneDrive({
          fileName,
          contentBase64: base64,
          contentType,
        })
        return true
      } catch (error) {
        if (error instanceof OneDriveIntegrationMissingError) {
          adicionarNotificacao(
            'Integração com o OneDrive indisponível. Configure o conector para salvar contratos automaticamente.',
            'warning',
          )
        } else {
          console.error('Erro ao salvar contrato no OneDrive.', error)
          adicionarNotificacao(
            'Não foi possível salvar o contrato no OneDrive. Verifique a integração.',
            'error',
          )
        }
        return false
      }
    },
    [adicionarNotificacao],
  )

  const abrirSelecaoContratos = useCallback(
    (category: ContractTemplateCategory) => {
      if (gerandoContratos) {
        return
      }

      const payload = prepararDadosContratoCliente()
      if (!payload) {
        return
      }

      contratoClientePayloadRef.current = payload
      setContractTemplatesCategory(category)
      setIsContractTemplatesModalOpen(true)
      setContractTemplatesError(null)
      void carregarTemplatesContrato(category)
    },
    [carregarTemplatesContrato, gerandoContratos, prepararDadosContratoCliente],
  )

  const handleGerarContratoLeasing = useCallback(async () => {
    if (gerandoContratos) {
      return
    }
    if (!guardClientFieldsOrReturn('leasing')) {
      return
    }
    if (!validateConsumoMinimoLeasing('Informe o Consumo (kWh/mês) para gerar os documentos.')) {
      return
    }
    const clienteSalvo = await handleSalvarCliente({ skipGuard: true })
    if (!clienteSalvo) {
      return
    }
    const base = prepararDadosContratoCliente()
    if (!base) {
      return
    }
    setIsLeasingContractsModalOpen(true)
    // Load availability when modal opens
    carregarDisponibilidadeAnexos()
  }, [
    carregarDisponibilidadeAnexos,
    gerandoContratos,
    guardClientFieldsOrReturn,
    handleSalvarCliente,
    prepararDadosContratoCliente,
    validateConsumoMinimoLeasing,
  ])

  const handleGerarContratoVendas = useCallback(async () => {
    if (!guardClientFieldsOrReturn('venda')) {
      return
    }
    const clienteSalvo = await handleSalvarCliente({ skipGuard: true })
    if (!clienteSalvo) {
      return
    }
    abrirSelecaoContratos('vendas')
  }, [abrirSelecaoContratos, guardClientFieldsOrReturn, handleSalvarCliente])

  const handleConfirmarGeracaoContratosVendas = useCallback(async () => {
    const payload = contratoClientePayloadRef.current
    if (!payload) {
      adicionarNotificacao(
        'Não foi possível preparar os dados do contrato. Abra a seleção novamente.',
        'error',
      )
      handleFecharModalContratos()
      return
    }

    if (selectedContractTemplates.length === 0) {
      adicionarNotificacao('Selecione ao menos um modelo de contrato.', 'error')
      return
    }

    if (typeof window === 'undefined') {
      adicionarNotificacao('Recurso disponível apenas no navegador.', 'error')
      return
    }

    setIsContractTemplatesModalOpen(false)
    setGerandoContratos(true)

    const extrairErro = async (response: Response, template: string) => {
      let mensagemErro = `Não foi possível gerar o contrato (${template}). Tente novamente.`
      const contentType = response.headers.get('content-type') ?? ''
      try {
        if (contentType.includes('application/json')) {
          const data = (await response.json()) as { error?: string } | undefined
          if (data?.error) {
            mensagemErro = data.error
          }
        } else {
          const texto = await response.text()
          if (texto.trim()) {
            mensagemErro = texto.trim()
          }
        }
      } catch (error) {
        console.warn('Não foi possível interpretar o erro ao gerar contrato.', error)
      }
      return mensagemErro
    }

    let sucesso = 0
    const popupWarnings = { mostrado: false }
    let janelaPreview: Window | null = null

    const atualizarJanelaMensagem = (mensagem: string, isError = false) => {
      if (!janelaPreview || janelaPreview.closed) {
        return
      }

      try {
        const doc = janelaPreview.document
        doc.title = 'Gerando contratos'
        doc.body.innerHTML = ''

        const paragrafo = doc.createElement('p')
        paragrafo.textContent = mensagem
        paragrafo.style.fontFamily = 'sans-serif'
        if (isError) {
          paragrafo.style.color = '#c00'
        }

        doc.body.appendChild(paragrafo)
      } catch (error) {
        console.warn('Não foi possível atualizar a janela do contrato.', error)
      }
    }

    const garantirJanelaPreview = () => {
      if (janelaPreview && !janelaPreview.closed) {
        return janelaPreview
      }

      janelaPreview = window.open('', '_blank', 'noopener')
      if (janelaPreview && !janelaPreview.closed) {
        atualizarJanelaMensagem('Gerando contratos…')
        return janelaPreview
      }

      janelaPreview = null
      return null
    }

    const notificarPopupBloqueado = () => {
      if (popupWarnings.mostrado) {
        return
      }
      popupWarnings.mostrado = true
      adicionarNotificacao('Não foi possível abrir nova aba para o contrato. Verifique o bloqueio de pop-ups.', 'warning')
    }

    const renderizarPreviewNaJanela = (contratos: Array<{ templateLabel: string; url: string }>) => {
      if (!janelaPreview || janelaPreview.closed) {
        return
      }

      try {
        const doc = janelaPreview.document
        const data = JSON.stringify(
          contratos.map((item) => ({ label: item.templateLabel, url: item.url })),
        )

        doc.open()
        doc.write(`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Contratos gerados</title>
    <style>
      body {
        margin: 0;
        font-family: sans-serif;
        background: #f6f6f6;
        color: #111;
      }
      .contract-preview {
        display: flex;
        height: 100vh;
        width: 100vw;
      }
      .contract-preview__sidebar {
        width: 280px;
        background: #ffffff;
        border-right: 1px solid #e0e0e0;
        padding: 16px;
        box-sizing: border-box;
        overflow-y: auto;
      }
      .contract-preview__title {
        font-size: 18px;
        margin: 0 0 12px;
      }
      .contract-preview__list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .contract-preview__item {
        appearance: none;
        border: 1px solid #d0d0d0;
        background: #ffffff;
        border-radius: 6px;
        padding: 10px 12px;
        text-align: left;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s, border-color 0.2s;
      }
      .contract-preview__item:hover {
        background: #f0f7ff;
        border-color: #7aa7ff;
      }
      .contract-preview__item--active {
        background: #e6f0ff;
        border-color: #3273dc;
      }
      .contract-preview__content {
        flex: 1;
        display: flex;
        background: #d5d5d5;
      }
      .contract-preview__frame {
        border: 0;
        flex: 1;
      }
    </style>
  </head>
  <body>
    <main class="contract-preview">
      <aside class="contract-preview__sidebar">
        <h1 class="contract-preview__title">Contratos gerados</h1>
        <div class="contract-preview__list"></div>
      </aside>
      <section class="contract-preview__content">
        <iframe
          id="contract-preview__frame"
          class="contract-preview__frame"
          title="Pré-visualização do contrato"
        ></iframe>
      </section>
    </main>
    <script>
      (function () {
        const data = ${data};
        const list = document.querySelector('.contract-preview__list');
        const frame = document.getElementById('contract-preview__frame');
        if (!list || !frame || !Array.isArray(data)) {
          return;
        }

        const setActive = (button) => {
          document
            .querySelectorAll('.contract-preview__item--active')
            .forEach((element) => element.classList.remove('contract-preview__item--active'));
          if (button) {
            button.classList.add('contract-preview__item--active');
          }
        };

        data.forEach((item, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'contract-preview__item';
          button.textContent = item.label;
          button.addEventListener('click', () => {
            frame.src = item.url;
            setActive(button);
          });
          list.appendChild(button);
          if (index === 0) {
            button.click();
          }
        });
      })();
    </script>
  </body>
</html>`)
        doc.close()
      } catch (error) {
        console.warn('Não foi possível exibir a pré-visualização dos contratos.', error)
      }
    }

    const contratosGerados: Array<{ templateLabel: string; url: string }> = []
    let contratosSalvos = 0

    try {
      const janelaInicial = garantirJanelaPreview()
      if (!janelaInicial) {
        notificarPopupBloqueado()
      }

      for (const template of selectedContractTemplates) {
        const templateLabel = (template.split(/[\\/]/).pop() ?? template).replace(/\.docx$/i, '')
        try {
          const response = await fetch(resolveApiUrl('/api/contracts/render'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              template,
              cliente: payload,
            }),
          })

          if (!response.ok) {
            const mensagemErro = await extrairErro(response, templateLabel)
            throw new Error(mensagemErro)
          }

          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)

          contratosGerados.push({ templateLabel, url })
          if (await salvarContratoNoOneDrive(`${templateLabel}.pdf`, blob, blob.type)) {
            contratosSalvos += 1
          }

          if (!janelaPreview || janelaPreview.closed) {
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.target = '_blank'
            anchor.rel = 'noopener'
            anchor.style.display = 'none'
            document.body.appendChild(anchor)
            anchor.click()
            document.body.removeChild(anchor)
          } else {
            atualizarJanelaMensagem(`Contrato "${templateLabel}" gerado. Preparando próxima visualização…`)
          }

          window.setTimeout(() => {
            window.URL.revokeObjectURL(url)
          }, 10 * 60_000)

          sucesso += 1
        } catch (error) {
          if (janelaPreview && !janelaPreview.closed) {
            atualizarJanelaMensagem(
              error instanceof Error && error.message
                ? error.message
                : 'Não foi possível gerar o contrato. Feche esta aba e tente novamente.',
              true,
            )
          }
          throw error
        }
      }

      if (contratosGerados.length > 0 && janelaPreview && !janelaPreview.closed) {
        renderizarPreviewNaJanela(contratosGerados)
      }

      if (sucesso > 0) {
        const mensagem = sucesso === 1 ? 'Contrato gerado.' : `${sucesso} contratos gerados.`
        adicionarNotificacao(mensagem, 'success')
        if (contratosSalvos > 0) {
          const mensagemSalvo =
            contratosSalvos === 1
              ? 'Contrato salvo no OneDrive.'
              : `${contratosSalvos} contratos salvos no OneDrive.`
          adicionarNotificacao(mensagemSalvo, 'success')
        }
      }
    } catch (error) {
      console.error('Erro ao gerar contrato de leasing', error)
      const mensagem =
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível gerar o contrato. Tente novamente.'
      adicionarNotificacao(mensagem, 'error')
    } finally {
      setGerandoContratos(false)
      contratoClientePayloadRef.current = null
    }
  }, [
    adicionarNotificacao,
    handleFecharModalContratos,
    selectedContractTemplates,
    salvarContratoNoOneDrive,
  ])

  const handleConfirmarGeracaoLeasing = useCallback(async () => {
    const payload = prepararPayloadContratosLeasing()
    if (!payload) {
      return
    }

    if (typeof window === 'undefined') {
      adicionarNotificacao('Recurso disponível apenas no navegador.', 'error')
      return
    }

    setIsLeasingContractsModalOpen(false)
    setGerandoContratos(true)

    const extrairErro = async (response: Response) => {
      let mensagemErro = 'Não foi possível gerar os documentos de leasing. Tente novamente.'
      const contentType = response.headers.get('content-type') ?? ''
      const vercelId = response.headers.get('x-vercel-id')
      const headerRequestId = response.headers.get('x-request-id')
      try {
        if (contentType.includes('application/json')) {
          const data = (await response.json()) as
            | {
                error?: string
                message?: string
                hint?: string
                requestId?: string
                code?: string
                vercelId?: string
              }
            | undefined
          if (data?.message || data?.error) {
            const baseMessage = data.message ?? data.error ?? mensagemErro
            const hint = data.hint ? ` ${data.hint}` : ''
            const requestId = data.requestId || headerRequestId
            const requestLabel = requestId ? ` (ID: ${requestId})` : ''
            const code = data.code ? ` [${data.code}]` : ''
            const vercel = data.vercelId || vercelId
            const vercelLabel = vercel ? ` (Vercel: ${vercel})` : ''
            mensagemErro = `${baseMessage}${code}${hint}${requestLabel}${vercelLabel}`.trim()
            return mensagemErro
          }
        }
        const requestLabel = headerRequestId ? ` (ID: ${headerRequestId})` : ''
        const vercelLabel = vercelId ? ` (Vercel: ${vercelId})` : ''
        mensagemErro = `A função falhou antes de retornar uma resposta.${requestLabel}${vercelLabel}`
      } catch (error) {
        console.warn('Não foi possível interpretar o erro ao gerar o pacote de leasing.', error)
      }
      return mensagemErro
    }

    try {
      let propostaHtml = ''
      try {
        const resultado = await prepararPropostaParaExportacao({ incluirTabelaBuyout: false })
        const layoutHtml = resultado?.html ?? ''
        if (!layoutHtml) {
          adicionarNotificacao(
            'Não foi possível preparar a proposta comercial. O pacote será gerado sem o PDF da proposta.',
            'warning',
          )
        } else {
          propostaHtml = buildProposalPdfDocument(
            layoutHtml,
            payload.dadosLeasing.nomeCompleto || payload.dadosLeasing.cpfCnpj || 'SolarInvest',
          )
        }
      } catch (error) {
        console.error('Erro ao preparar a proposta comercial para anexar ao contrato.', error)
        adicionarNotificacao(
          'Não foi possível preparar a proposta comercial. O pacote será gerado sem o PDF da proposta.',
          'warning',
        )
      }

      const anexosSelecionados = ensureRequiredLeasingAnexos(
        leasingAnexosSelecionados,
        leasingContrato.tipoContrato,
      )

      const response = await fetch(resolveApiUrl('/api/contracts/leasing'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoContrato: payload.tipoContrato,
          dadosLeasing: payload.dadosLeasing,
          anexosSelecionados,
          propostaHtml,
        }),
      })

      if (!response.ok) {
        const mensagemErro = await extrairErro(response)
        throw new Error(mensagemErro)
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const mensagemErro = await extrairErro(response)
        throw new Error(mensagemErro)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const disposition = response.headers.get('content-disposition') ?? ''
      const match = disposition.match(/filename="?([^";]+)"?/i)
      const fallbackName = contentType.includes('application/pdf')
        ? 'contrato-leasing.pdf'
        : contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
          ? 'contrato-leasing.docx'
          : 'contratos-leasing.zip'
      const downloadName = match?.[1] ?? fallbackName
      const salvouContrato = await salvarContratoNoOneDrive(downloadName, blob, blob.type)

      if (!salvouContrato) {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = downloadName
        anchor.style.display = 'none'
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        window.setTimeout(() => {
          window.URL.revokeObjectURL(url)
        }, 60_000)
      } else {
        window.setTimeout(() => {
          window.URL.revokeObjectURL(url)
        }, 10_000)
      }

      const notice = response.headers.get('x-contracts-notice')
      if (notice) {
        adicionarNotificacao(notice, 'info')
      }
      if (contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        adicionarNotificacao('PDF indisponível; DOCX gerado com sucesso.', 'info')
      }
      adicionarNotificacao('Pacote de contratos de leasing gerado.', 'success')
      if (salvouContrato) {
        adicionarNotificacao('Contrato salvo no OneDrive.', 'success')
      }
    } catch (error) {
      console.error('Erro ao gerar contratos de leasing', error)
      const mensagem =
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível gerar os contratos de leasing. Tente novamente.'
      adicionarNotificacao(mensagem, 'error')
    } finally {
      setGerandoContratos(false)
    }
  }, [
    adicionarNotificacao,
    leasingContrato.tipoContrato,
    leasingAnexosSelecionados,
    prepararPropostaParaExportacao,
    prepararPayloadContratosLeasing,
    salvarContratoNoOneDrive,
  ])

  const confirmarAlertasAntesDeSalvar = useCallback(async (): Promise<boolean> => {
    const alertas = coletarAlertasProposta()

    if (alertas.length === 0) {
      return true
    }

    const descricao = `${
      alertas.length === 1
        ? 'Encontramos um alerta que precisa de atenção antes de salvar:'
        : 'Encontramos alguns alertas que precisam de atenção antes de salvar:'
    } ${alertas.map((texto) => `• ${texto}`).join(' ')}`

    const choice = await requestSaveDecision({
      title: 'Resolver alertas antes de salvar?',
      description: descricao,
      confirmLabel: 'Continuar',
      discardLabel: 'Voltar',
    })

    return choice === 'save'
  }, [coletarAlertasProposta, requestSaveDecision])

  const handleSalvarPropostaLeasing = useCallback(async (): Promise<boolean> => {
    if (salvandoPropostaLeasing) {
      return false
    }

    if (!guardClientFieldsOrReturn('leasing')) {
      return false
    }

    if (!(await ensureNormativePrecheck())) {
      return false
    }

    const confirmouAlertas = await confirmarAlertasAntesDeSalvar()
    if (!confirmouAlertas) {
      return false
    }

    const clienteSalvo = await handleSalvarCliente({ skipGuard: true })
    if (!clienteSalvo) {
      return false
    }

    setSalvandoPropostaLeasing(true)

    try {
      const resultado = await prepararPropostaParaExportacao({
        incluirTabelaBuyout: isVendaDiretaTab,
      })

      if (!resultado) {
        window.alert('Não foi possível preparar a proposta para salvar. Tente novamente.')
        return false
      }

      const { dados } = resultado
      const registroSalvo = salvarOrcamentoLocalmente(dados)
      if (!registroSalvo) {
        return false
      }

      const emissaoIso = new Date().toISOString().slice(0, 10)
      switchBudgetId(registroSalvo.id)

      vendaActions.updateCodigos({
        codigo_orcamento_interno: registroSalvo.id,
        data_emissao: emissaoIso,
      })

      atualizarOrcamentoAtivo(registroSalvo)
      scheduleMarkStateAsSaved()

      adicionarNotificacao(
        'Proposta de leasing salva com sucesso no banco de dados. Você pode recarregar os dados a qualquer momento.',
        'success',
      )

      return true
    } catch (error) {
      console.error('Erro ao salvar proposta de leasing.', error)
      adicionarNotificacao(
        'Não foi possível salvar a proposta de leasing. Tente novamente após corrigir os alertas.',
        'error',
      )
      return false
    } finally {
      setSalvandoPropostaLeasing(false)
    }
  }, [
    adicionarNotificacao,
    atualizarOrcamentoAtivo,
    confirmarAlertasAntesDeSalvar,
    ensureNormativePrecheck,
    guardClientFieldsOrReturn,
    handleSalvarCliente,
    isVendaDiretaTab,
    prepararPropostaParaExportacao,
    salvarOrcamentoLocalmente,
    salvandoPropostaLeasing,
    scheduleMarkStateAsSaved,
    switchBudgetId,
    vendaActions,
  ])

  const handleSalvarPropostaPdf = useCallback(async (): Promise<boolean> => {
    if (salvandoPropostaPdf) {
      return false
    }

    if (isVendaDiretaTab) {
      if (!guardClientFieldsOrReturn('venda')) {
        return false
      }
    } else if (!validatePropostaLeasingMinimal()) {
      return false
    }

    if (!(await ensureNormativePrecheck())) {
      return false
    }

    const clienteSalvo = await handleSalvarCliente({ skipGuard: true })
    if (!clienteSalvo) {
      return false
    }

    setSalvandoPropostaPdf(true)

    let salvouLocalmente = false
    let sucesso = false

    try {
      const resultado = await prepararPropostaParaExportacao({
        incluirTabelaBuyout: isVendaDiretaTab,
      })

      if (!resultado) {
        window.alert('Não foi possível preparar a proposta para salvar em PDF. Tente novamente.')
        return false
      }

      const { html, dados } = resultado
      const registroSalvo = salvarOrcamentoLocalmente(dados)
      if (!registroSalvo) {
        return false
      }

      salvouLocalmente = true
      dados.budgetId = registroSalvo.id

      const emissaoIso = new Date().toISOString().slice(0, 10)
      switchBudgetId(registroSalvo.id)

      vendaActions.updateCodigos({
        codigo_orcamento_interno: registroSalvo.id,
        data_emissao: emissaoIso,
      })

      atualizarOrcamentoAtivo(registroSalvo)

      let htmlComCodigo = sanitizePrintableHtml(html) || ''
      try {
        const atualizado = await renderPrintableProposalToHtml(dados)
        if (atualizado) {
          const sanitized = sanitizePrintableHtml(atualizado)
          if (sanitized) {
            htmlComCodigo = sanitized
          }
        }
      } catch (error) {
        console.warn('Não foi possível atualizar o HTML com o código do orçamento.', error)
      }

      const proposalType = activeTab === 'vendas' ? 'VENDA_DIRETA' : 'LEASING'

      const integracaoPdfDisponivel = isProposalPdfIntegrationAvailable()
      setProposalPdfIntegrationAvailable(integracaoPdfDisponivel)
      if (!integracaoPdfDisponivel) {
        adicionarNotificacao(
          'Proposta armazenada localmente. Configure a integração de PDF para gerar o arquivo automaticamente.',
          'info',
        )
        sucesso = true
      } else {
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
        sucesso = true
      }
    } catch (error) {
      if (error instanceof ProposalPdfIntegrationMissingError) {
        setProposalPdfIntegrationAvailable(false)
        adicionarNotificacao(
          'Proposta armazenada localmente, mas a integração de PDF não está configurada.',
          'info',
        )
        sucesso = salvouLocalmente
      } else {
        console.error('Erro ao salvar a proposta em PDF.', error)
        const mensagem =
          error instanceof Error && error.message
            ? error.message
            : 'Não foi possível salvar a proposta em PDF. Tente novamente.'
        const mensagemComFallback = salvouLocalmente
          ? `${mensagem} Uma cópia foi armazenada localmente no histórico de orçamentos.`
          : mensagem
        adicionarNotificacao(mensagemComFallback, 'error')
        sucesso = salvouLocalmente
      }
    } finally {
      setSalvandoPropostaPdf(false)
    }

    if (sucesso) {
      scheduleMarkStateAsSaved()
    }
    return sucesso
  }, [
    activeTab,
    adicionarNotificacao,
    ensureNormativePrecheck,
    guardClientFieldsOrReturn,
    handleSalvarCliente,
    isProposalPdfIntegrationAvailable,
    isVendaDiretaTab,
    prepararPropostaParaExportacao,
    salvarOrcamentoLocalmente,
    salvandoPropostaPdf,
    atualizarOrcamentoAtivo,
    setProposalPdfIntegrationAvailable,
    scheduleMarkStateAsSaved,
    switchBudgetId,
    validatePropostaLeasingMinimal,
  ])

  const runWithUnsavedChangesGuard = useCallback(
    async (
      action: () => void | Promise<void>,
      options?: Partial<SaveDecisionPromptRequest>,
    ): Promise<boolean> => {
      if (!hasUnsavedChanges()) {
        await action()
        return true
      }

      const choice = await requestSaveDecision({
        title: options?.title ?? 'Salvar alterações atuais?',
        description:
          options?.description ??
          'Existem alterações não salvas. Deseja salvar a proposta antes de continuar?',
        confirmLabel: options?.confirmLabel ?? 'Salvar',
        discardLabel: options?.discardLabel ?? 'Descartar',
      })

      if (choice === 'save') {
        const salvou = await handleSalvarPropostaPdf()
        if (!salvou) {
          return false
        }
      } else {
        scheduleMarkStateAsSaved()
      }

      await action()
      return true
    },
    [handleSalvarPropostaPdf, hasUnsavedChanges, requestSaveDecision, scheduleMarkStateAsSaved],
  )

  const handleGerarContratosComConfirmacao = useCallback(async () => {
    setActivePage('app')

    if (isVendaDiretaTab) {
      await handleGerarContratoVendas()
    } else {
      await handleGerarContratoLeasing()
    }
  }, [
    handleGerarContratoLeasing,
    handleGerarContratoVendas,
    isVendaDiretaTab,
    setActivePage,
  ])

  const abrirClientesPainel = useCallback(async () => {
    const canProceed = await runWithUnsavedChangesGuard(async () => {
      const registros = carregarClientesSalvos()
      
      // Hydrate with latest data from clientStore
      console.log('[abrirClientesPainel] Hydrating', registros.length, 'clientes from clientStore')
      const hidratados = await Promise.all(
        registros.map((r) => hydrateClienteRegistroFromStore(r))
      )
      console.log('[abrirClientesPainel] Hydration complete, displaying fresh data')
      
      setClientesSalvos(hidratados)
      setActivePage('clientes')
    })

    return canProceed
  }, [carregarClientesSalvos, runWithUnsavedChangesGuard, setActivePage])

  const abrirPesquisaOrcamentos = useCallback(async () => {
    const canProceed = await runWithUnsavedChangesGuard(async () => {
      const registros = await carregarOrcamentosPrioritarios()
      setOrcamentosSalvos(registros)
      setOrcamentoSearchTerm('')
      setActivePage('consultar')
    })

    return canProceed
  }, [carregarOrcamentosPrioritarios, runWithUnsavedChangesGuard, setActivePage])

  const abrirSimulacoes = useCallback(
    async (section?: SimulacoesSection) => {
      return runWithUnsavedChangesGuard(() => {
        setSimulacoesSection(section ?? 'nova')
        setActivePage('simulacoes')
      })
    },
    [runWithUnsavedChangesGuard, setActivePage],
  )

  const abrirConfiguracoes = useCallback(
    async (tab?: SettingsTabKey) => {
      return runWithUnsavedChangesGuard(() => {
        setSettingsTab(tab ?? 'mercado')
        setActivePage('settings')
      })
    },
    [runWithUnsavedChangesGuard, setActivePage, setSettingsTab],
  )

  const abrirDashboard = useCallback(async () => {
    return runWithUnsavedChangesGuard(() => {
      setActivePage('dashboard')
    })
  }, [runWithUnsavedChangesGuard, setActivePage])

  const abrirCrmCentral = useCallback(async () => {
    return runWithUnsavedChangesGuard(() => {
      setActivePage('crm')
    })
  }, [runWithUnsavedChangesGuard, setActivePage])

  const iniciarNovaProposta = useCallback(async () => {
    if (novaPropostaEmAndamentoRef.current) {
      console.warn('[Nova Proposta] Ignored (already running)')
      return
    }

    novaPropostaEmAndamentoRef.current = true

    // Protect against auto-save during reset
    console.log('[Nova Proposta] Starting - protecting against auto-save')
    isHydratingRef.current = true
    setIsHydrating(true)
    
    try {
      // Clear form draft to prevent stale data
      try {
        await clearFormDraft() // Use clearFormDraft instead of saveFormDraft(null)
        console.log('[Nova Proposta] Form draft cleared')
      } catch (error) {
        console.warn('[Nova Proposta] Failed to clear form draft:', error)
      }

      fieldSyncActions.reset()
      setSettingsTab(INITIAL_VALUES.settingsTab)
      setActivePage('app')
      setOrcamentoSearchTerm('')
      limparOrcamentoAtivo()
      setBudgetStructuredItems([])
      setKitBudget(createEmptyKitBudget())
      setIsBudgetProcessing(false)
      setBudgetProcessingError(null)
      setPageSharedState(createPageSharedSettings())
      if (budgetUploadInputRef.current) {
        budgetUploadInputRef.current.value = ''
      }
      if (imagensUploadInputRef.current) {
        imagensUploadInputRef.current.value = ''
      }

      setPropostaImagens([])
      setUcsBeneficiarias([])

      setUfTarifa(INITIAL_VALUES.ufTarifa)
      setDistribuidoraTarifa(INITIAL_VALUES.distribuidoraTarifa)
      setMesReajuste(INITIAL_VALUES.mesReajuste)
      mesReferenciaRef.current = new Date().getMonth() + 1
      setKcKwhMes(0)
      setPotenciaFonteManual(false)
      setTarifaCheia(INITIAL_VALUES.tarifaCheia)
      setDesconto(INITIAL_VALUES.desconto)
      setTaxaMinima(INITIAL_VALUES.taxaMinima)
      setTaxaMinimaInputEmpty(false)
      setEncargosFixosExtras(INITIAL_VALUES.encargosFixosExtras)
      setTusdPercent(INITIAL_VALUES.tusdPercent)
      setTusdTipoCliente(normalizeTipoBasico(INITIAL_VALUES.tusdTipoCliente))
      setTusdSubtipo(INITIAL_VALUES.tusdSubtipo)
      setTusdSimultaneidade(INITIAL_VALUES.tusdSimultaneidade)
      setTusdSimultaneidadeManualOverride(false)
      setTusdTarifaRkwh(INITIAL_VALUES.tusdTarifaRkwh)
      setTusdAnoReferencia(INITIAL_VALUES.tusdAnoReferencia ?? DEFAULT_TUSD_ANO_REFERENCIA)
      setTusdOpcoesExpandidas(false)
      setLeasingPrazo(INITIAL_VALUES.leasingPrazo)
      leasingActions.updateContrato({
        localEntrega: '',
        ucGeradoraTitularDiferente: false,
        ucGeradoraTitular: null,
        ucGeradoraTitularDraft: null,
        ucGeradoraTitularDistribuidoraAneel: '',
      })
      setUcGeradoraTitularPanelOpen(false)
      setUcGeradoraTitularErrors({})
      setUcGeradoraTitularCepMessage(undefined)
      setUcGeradoraTitularBuscandoCep(false)
      setPotenciaModulo(INITIAL_VALUES.potenciaModulo)
      setTipoRede(INITIAL_VALUES.tipoRede ?? 'monofasico')
      setTipoRedeControle('auto')
      setPotenciaModuloDirty(false)
      setTipoInstalacao(normalizeTipoInstalacao(INITIAL_VALUES.tipoInstalacao))
      setTipoInstalacaoOutro(INITIAL_VALUES.tipoInstalacaoOutro)
      setTipoInstalacaoDirty(false)
      setTipoSistema(INITIAL_VALUES.tipoSistema)
      setSegmentoCliente(normalizeTipoBasico(INITIAL_VALUES.segmentoCliente))
      setTipoEdificacaoOutro(INITIAL_VALUES.tipoEdificacaoOutro)
      setNumeroModulosManual(INITIAL_VALUES.numeroModulosManual)
      setConfiguracaoUsinaObservacoes(INITIAL_VALUES.configuracaoUsinaObservacoes)
      setConfiguracaoUsinaObservacoesExpanded(false)
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
      setMostrarValorMercadoLeasing(INITIAL_VALUES.mostrarValorMercadoLeasing)
      setMostrarTabelaParcelas(INITIAL_VALUES.tabelaVisivel)
      setMostrarTabelaBuyout(INITIAL_VALUES.tabelaVisivel)
      setMostrarTabelaParcelasConfig(INITIAL_VALUES.tabelaVisivel)
      setMostrarTabelaBuyoutConfig(INITIAL_VALUES.tabelaVisivel)
      setSalvandoPropostaLeasing(false)
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

      setClienteSync(cloneClienteDados(CLIENTE_INICIAL))
      setClienteMensagens({})
      clienteEmEdicaoIdRef.current = null
      lastSavedClienteRef.current = null
      setClienteEmEdicaoId(null)
      setActivePage('app')
      setNotificacoes([])
      const novoBudgetId = createDraftBudgetId()
      console.log('[Nova Proposta] New budget ID created', novoBudgetId)

      budgetIdTransitionRef.current = true
      budgetIdRef.current = novoBudgetId
      setCurrentBudgetId(novoBudgetId)

      await Promise.resolve()
      await tick()

      const snapshotVazio = buildEmptySnapshotForNewProposal(activeTabRef.current, novoBudgetId)
      aplicarSnapshot(snapshotVazio, { budgetIdOverride: novoBudgetId, allowEmpty: true })
      scheduleMarkStateAsSaved()
      
      console.log('[Nova Proposta] Reset complete, re-enabling auto-save', {
        budgetIdRef: budgetIdRef.current,
        budgetIdState: novoBudgetId,
      })
    } catch (error) {
      console.error('[Nova Proposta] Failed', error)
    } finally {
      isHydratingRef.current = false
      setIsHydrating(false)
      novaPropostaEmAndamentoRef.current = false
    }
  }, [
    createPageSharedSettings,
    setActivePage,
    applyTarifasAutomaticas,
    resetRetorno,
    scheduleMarkStateAsSaved,
    setDistribuidoraTarifa,
    setKcKwhMes,
    leasingActions,
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
    limparOrcamentoAtivo,
    setClienteSync,
    setCurrentBudgetId,
  ])

  const handleNovaProposta = useCallback(async () => {
    if (hasUnsavedChanges()) {
      const choice = await requestSaveDecision({
        title: 'Salvar proposta atual?',
        description:
          'Existem alterações não salvas. Deseja salvar a proposta antes de iniciar uma nova?',
      })

      if (choice === 'save') {
        const salvou = await handleSalvarPropostaPdf()
        if (!salvou) {
          return
        }
      }

      iniciarNovaProposta()
      return
    }

    iniciarNovaProposta()
  }, [
    hasUnsavedChanges,
    handleSalvarPropostaPdf,
    iniciarNovaProposta,
    requestSaveDecision,
  ])

  const duplicarOrcamentoAtual = () => {
    const registroParaDuplicar = orcamentoRegistroBase ?? orcamentoDisponivelParaDuplicar
    if (!registroParaDuplicar) {
      return
    }

    if (!registroParaDuplicar.snapshot) {
      window.alert(
        'Não foi possível duplicar este orçamento automaticamente. Abra e salve novamente para gerar um snapshot completo.',
      )
      return
    }

    const novoBudgetId = createDraftBudgetId()
    switchBudgetId(novoBudgetId)
    isHydratingRef.current = true
    setIsHydrating(true)
    aplicarSnapshot(registroParaDuplicar.snapshot, { budgetIdOverride: novoBudgetId })
    tick()
      .then(() => {
        isHydratingRef.current = false
        setIsHydrating(false)
      })
      .catch(() => {
        isHydratingRef.current = false
        setIsHydrating(false)
      })
    limparOrcamentoAtivo()
    lastSavedSignatureRef.current = null
    userInteractedSinceSaveRef.current = true
    setActivePage('app')
    adicionarNotificacao(
      'Uma cópia do orçamento foi carregada para edição. Salve para gerar um novo número.',
      'info',
    )
  }

  const podeSalvarProposta = activeTab === 'leasing' || activeTab === 'vendas'

  const handleAdicionarUcBeneficiaria = useCallback(() => {
    setUcsBeneficiarias((prev) => recalcularRateioAutomatico([...prev, createEmptyUcBeneficiaria()]))
  }, [])

  const handleAtualizarUcBeneficiaria = useCallback(
    (
      id: string,
      field: 'numero' | 'endereco' | 'rateioPercentual' | 'consumoKWh',
      value: string,
    ) => {
      setUcsBeneficiarias((prev) => {
        const atualizada = prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
        if (field === 'consumoKWh') {
          return recalcularRateioAutomatico(atualizada)
        }
        return atualizada
      })
    },
    [],
  )

  const handleRemoverUcBeneficiaria = useCallback((id: string) => {
    setUcsBeneficiarias((prev) => recalcularRateioAutomatico(prev.filter((item) => item.id !== id)))
  }, [])

  const syncClienteField = useCallback(
    (field: FieldSyncKey, value: string) => {
      applyFieldSyncChange(field, 'cliente', () => {
        if (field === 'uf') {
          setUfTarifa(value)
        } else if (field === 'distribuidora') {
          setDistribuidoraTarifa(value)
        }
      })
    },
    [setDistribuidoraTarifa, setUfTarifa],
  )

  const handleParametrosUfChange = useCallback(
    (value: string) => {
      const ufNormalizada = value.toUpperCase()
      setUfTarifa(ufNormalizada)
      applyFieldSyncChange('uf', 'parametros', () => {
        const base = clienteRef.current ?? cliente
        if (base.uf === ufNormalizada) {
          return
        }
        updateClienteSync({ uf: ufNormalizada })
      })
    },
    [cliente, setUfTarifa, updateClienteSync],
  )

  const handleParametrosDistribuidoraChange = useCallback(
    (value: string) => {
      setDistribuidoraTarifa(value)
      applyFieldSyncChange('distribuidora', 'parametros', () => {
        const base = clienteRef.current ?? cliente
        if (base.distribuidora === value) {
          return
        }
        updateClienteSync({ distribuidora: value })
      })
    },
    [cliente, setDistribuidoraTarifa, updateClienteSync],
  )

  const clearFieldHighlight = (element?: HTMLElement | null) => {
    if (!element) {
      return
    }
    element.classList.remove('field-error')
    element.classList.remove('field-error-bg')
  }

  const handleClienteChange = <K extends keyof ClienteDados>(key: K, rawValue: ClienteDados[K]) => {
    if (key === 'temIndicacao') {
      const checked = Boolean(rawValue)
      const base = clienteRef.current ?? cliente
      let next = base
      if (base.temIndicacao === checked) {
        if (!checked && base.indicacaoNome) {
          next = { ...base, temIndicacao: false, indicacaoNome: '' }
        }
      } else {
        next = checked
          ? { ...base, temIndicacao: true }
          : { ...base, temIndicacao: false, indicacaoNome: '' }
      }
      if (next !== base) {
        setClienteSync(next)
      }
      return
    }

    if (key === 'uf' && typeof rawValue === 'string') {
      const value = rawValue.toUpperCase()
      let distribuidoraAtualizada: string | undefined
      let ufAlterada = false
      let distribuidoraAlterada = false
      const base = clienteRef.current ?? cliente
      const ufNormalizada = value
      const listaDistribuidoras = distribuidorasPorUf[ufNormalizada] ?? []
      let proximaDistribuidora = base.distribuidora

      if (listaDistribuidoras.length === 1) {
        proximaDistribuidora = listaDistribuidoras[0]
      } else if (proximaDistribuidora && !listaDistribuidoras.includes(proximaDistribuidora)) {
        proximaDistribuidora = ''
      }
      if (!proximaDistribuidora) {
        const defaultDistribuidora = getDistribuidoraDefaultForUf(ufNormalizada)
        if (defaultDistribuidora) {
          proximaDistribuidora = defaultDistribuidora
        }
      }

      if (base.uf !== ufNormalizada || base.distribuidora !== proximaDistribuidora) {
        ufAlterada = base.uf !== ufNormalizada
        distribuidoraAlterada = proximaDistribuidora !== base.distribuidora
        distribuidoraAtualizada = proximaDistribuidora
        setClienteSync({ ...base, uf: ufNormalizada, distribuidora: proximaDistribuidora })
      }
      if (ufAlterada) {
        syncClienteField('uf', value)
      }
      if (distribuidoraAlterada) {
        syncClienteField('distribuidora', distribuidoraAtualizada ?? '')
      }
      return
    }

    let nextValue = rawValue

    if (typeof rawValue === 'string') {
      if (key === 'documento' || key === 'cpfSindico') {
        nextValue = formatCpfCnpj(rawValue) as ClienteDados[K]
      } else if (key === 'email') {
        nextValue = rawValue.trim() as ClienteDados[K]
      } else if (key === 'telefone' || key === 'contatoSindico') {
        nextValue = formatTelefone(rawValue) as ClienteDados[K]
      } else if (key === 'cep') {
        nextValue = formatCep(rawValue) as ClienteDados[K]
      }
    }

    const base = clienteRef.current ?? cliente
    const clienteAtualizado = base[key] !== nextValue
    if (clienteAtualizado) {
      updateClienteSync({ [key]: nextValue } as Partial<ClienteDados>)
    }

    if (clienteAtualizado && isSyncedClienteField(key) && typeof nextValue === 'string') {
      syncClienteField(key, nextValue)
    }

    if (key === 'email' && typeof nextValue === 'string') {
      const trimmed = nextValue.trim()
      setClienteMensagens((prev) => ({
        ...prev,
        email: trimmed && !emailValido(trimmed) ? 'Informe um e-mail válido.' : undefined,
      }))
    }
  }

  const handleLeasingContratoCampoChange = useCallback(
    <K extends keyof LeasingContratoDados>(key: K, value: LeasingContratoDados[K]) => {
      leasingActions.updateContrato({ [key]: value } as Partial<LeasingContratoDados>)
    },
    [],
  )

  const clearUcGeradoraTitularError = useCallback(
    (field: keyof UcGeradoraTitularErrors) => {
      setUcGeradoraTitularErrors((prev) => {
        if (!prev[field]) {
          return prev
        }
        const next = { ...prev }
        delete next[field]
        return next
      })
    },
    [],
  )

  const updateUcGeradoraTitularDraft = useCallback(
    (patch: Partial<LeasingUcGeradoraTitular> & { endereco?: Partial<LeasingEndereco> }) => {
      const baseDraft = leasingContrato.ucGeradoraTitularDraft ?? createEmptyUcGeradoraTitular()
      const nextDraft: LeasingUcGeradoraTitular = {
        ...baseDraft,
        ...patch,
        endereco: {
          ...baseDraft.endereco,
          ...(patch.endereco ?? {}),
        },
      }
      leasingActions.updateContrato({ ucGeradoraTitularDraft: nextDraft })
    },
    [leasingContrato.ucGeradoraTitularDraft],
  )

  const handleUcGeradoraTitularUfChange = useCallback(
    (value: string) => {
      const ufNormalizada = value.toUpperCase()
      updateUcGeradoraTitularDraft({ endereco: { uf: ufNormalizada } })
      const listaDistribuidoras = distribuidorasPorUf[ufNormalizada] ?? []
      const atual = leasingContrato.ucGeradoraTitularDistribuidoraAneel
      let proximaDistribuidora = atual
      if (listaDistribuidoras.length === 1) {
        proximaDistribuidora = listaDistribuidoras[0]
      } else if (proximaDistribuidora && !listaDistribuidoras.includes(proximaDistribuidora)) {
        proximaDistribuidora = ''
      }
      if (!proximaDistribuidora) {
        const defaultDistribuidora = getDistribuidoraDefaultForUf(ufNormalizada)
        if (defaultDistribuidora) {
          proximaDistribuidora = defaultDistribuidora
        }
      }
      if (proximaDistribuidora !== atual) {
        leasingActions.updateContrato({
          ucGeradoraTitularDistribuidoraAneel: proximaDistribuidora ?? '',
        })
      }
    },
    [
      distribuidorasPorUf,
      leasingContrato.ucGeradoraTitularDistribuidoraAneel,
      updateUcGeradoraTitularDraft,
    ],
  )

  const handleUcGeradoraTitularDistribuidoraChange = useCallback(
    (value: string) => {
      leasingActions.updateContrato({
        ucGeradoraTitularDistribuidoraAneel: value,
      })
      const ufAssociada = resolveUfForDistribuidora(distribuidorasPorUf, value)
      if (!ufAssociada) {
        return
      }
      const ufAtual = (
        leasingContrato.ucGeradoraTitularDraft?.endereco.uf ??
        leasingContrato.ucGeradoraTitular?.endereco.uf ??
        ''
      )
        .trim()
        .toUpperCase()
      if (ufAtual !== ufAssociada) {
        updateUcGeradoraTitularDraft({ endereco: { uf: ufAssociada } })
      }
    },
    [
      distribuidorasPorUf,
      leasingContrato.ucGeradoraTitular?.endereco.uf,
      leasingContrato.ucGeradoraTitularDraft?.endereco.uf,
      updateUcGeradoraTitularDraft,
    ],
  )

  useEffect(() => {
    if (!leasingContrato.ucGeradoraTitularDiferente) {
      return
    }
    const distribuidoraAtual = leasingContrato.ucGeradoraTitularDistribuidoraAneel
    if (!distribuidoraAtual) {
      return
    }
    const ufAssociada = resolveUfForDistribuidora(
      distribuidorasPorUf,
      distribuidoraAtual,
    )
    if (!ufAssociada) {
      return
    }
    const ufAtual = (
      leasingContrato.ucGeradoraTitularDraft?.endereco.uf ??
      leasingContrato.ucGeradoraTitular?.endereco.uf ??
      ''
    )
      .trim()
      .toUpperCase()
    if (ufAtual && ufAtual !== ufAssociada) {
      updateUcGeradoraTitularDraft({ endereco: { uf: ufAssociada } })
    }
  }, [
    distribuidorasPorUf,
    leasingContrato.ucGeradoraTitularDiferente,
    leasingContrato.ucGeradoraTitularDistribuidoraAneel,
    leasingContrato.ucGeradoraTitularDraft?.endereco.uf,
    leasingContrato.ucGeradoraTitular?.endereco.uf,
    updateUcGeradoraTitularDraft,
  ])

  const buildUcGeradoraTitularErrors = useCallback((draft: LeasingUcGeradoraTitular) => {
    const errors: UcGeradoraTitularErrors = {}
    if (!draft.nomeCompleto.trim()) {
      errors.nomeCompleto = 'Informe o nome completo.'
    }
    if (!draft.cpf.trim()) {
      errors.cpf = 'Informe o CPF.'
    }
    if (!draft.rg.trim()) {
      errors.rg = 'Informe o RG.'
    }
    if (!draft.endereco.cep.trim()) {
      errors.cep = 'Informe o CEP.'
    }
    if (!draft.endereco.logradouro.trim()) {
      errors.logradouro = 'Informe o logradouro.'
    }
    if (!draft.endereco.cidade.trim()) {
      errors.cidade = 'Informe a cidade.'
    }
    if (!draft.endereco.uf.trim()) {
      errors.uf = 'Informe a UF.'
    }
    return errors
  }, [])

  const handleToggleUcGeradoraTitularDiferente = useCallback(
    (checked: boolean) => {
      if (checked) {
        const baseDraft = leasingContrato.ucGeradoraTitular
          ? cloneUcGeradoraTitular(leasingContrato.ucGeradoraTitular)
          : createEmptyUcGeradoraTitular()
        leasingActions.updateContrato({
          ucGeradoraTitularDiferente: true,
          ucGeradoraTitularDraft: baseDraft,
        })
        setUcGeradoraTitularPanelOpen(true)
        setUcGeradoraTitularErrors({})
        setUcGeradoraTitularCepMessage(undefined)
        setUcGeradoraTitularBuscandoCep(false)
        return
      }
      leasingActions.updateContrato({
        ucGeradoraTitularDiferente: false,
        ucGeradoraTitular: null,
        ucGeradoraTitularDraft: null,
      })
      setUcGeradoraTitularPanelOpen(false)
      setUcGeradoraTitularErrors({})
      setUcGeradoraTitularCepMessage(undefined)
      setUcGeradoraTitularBuscandoCep(false)
    },
    [leasingContrato.ucGeradoraTitular],
  )

  const handleCancelarUcGeradoraTitular = useCallback(() => {
    const hasSavedTitular = Boolean(leasingContrato.ucGeradoraTitular)
    if (hasSavedTitular) {
      leasingActions.updateContrato({
        ucGeradoraTitularDraft: null,
        ucGeradoraTitularDiferente: true,
      })
    } else {
      leasingActions.updateContrato({
        ucGeradoraTitularDiferente: false,
        ucGeradoraTitular: null,
        ucGeradoraTitularDraft: null,
      })
    }
    setUcGeradoraTitularPanelOpen(false)
    setUcGeradoraTitularErrors({})
    setUcGeradoraTitularCepMessage(undefined)
    setUcGeradoraTitularBuscandoCep(false)
  }, [leasingContrato.ucGeradoraTitular])

  const handleSalvarUcGeradoraTitular = useCallback(async () => {
    const draft = leasingContrato.ucGeradoraTitularDraft ?? createEmptyUcGeradoraTitular()
    const errors = buildUcGeradoraTitularErrors(draft)
    if (Object.keys(errors).length > 0) {
      setUcGeradoraTitularErrors(errors)
      return
    }

    const titularAnterior = leasingContrato.ucGeradoraTitular
      ? cloneUcGeradoraTitular(leasingContrato.ucGeradoraTitular)
      : null
    const titularAtualizado = cloneUcGeradoraTitular(draft)

    leasingActions.updateContrato({
      ucGeradoraTitular: titularAtualizado,
      ucGeradoraTitularDiferente: true,
    })

    const salvou = await handleSalvarCliente({ skipGuard: true })
    if (!salvou) {
      leasingActions.updateContrato({
        ucGeradoraTitular: titularAnterior,
        ucGeradoraTitularDiferente: true,
        ucGeradoraTitularDraft: draft,
      })
      adicionarNotificacao(
        'Não foi possível salvar os dados do titular da UC geradora. Tente novamente.',
        'error',
      )
      return
    }

    leasingActions.updateContrato({
      ucGeradoraTitular: titularAtualizado,
      ucGeradoraTitularDiferente: true,
      ucGeradoraTitularDraft: null,
    })
    setUcGeradoraTitularErrors({})
    setUcGeradoraTitularCepMessage(undefined)
    setUcGeradoraTitularBuscandoCep(false)
    setUcGeradoraTitularPanelOpen(false)
  }, [
    adicionarNotificacao,
    buildUcGeradoraTitularErrors,
    handleSalvarCliente,
    leasingContrato.ucGeradoraTitular,
    leasingContrato.ucGeradoraTitularDraft,
  ])

  const handleEditarUcGeradoraTitular = useCallback(() => {
    if (!leasingContrato.ucGeradoraTitular) {
      return
    }
    leasingActions.updateContrato({
      ucGeradoraTitularDraft: cloneUcGeradoraTitular(leasingContrato.ucGeradoraTitular),
      ucGeradoraTitularDiferente: true,
    })
    setUcGeradoraTitularPanelOpen(true)
    setUcGeradoraTitularErrors({})
    setUcGeradoraTitularCepMessage(undefined)
    setUcGeradoraTitularBuscandoCep(false)
  }, [leasingContrato.ucGeradoraTitular])

  useEffect(() => {
    if (
      leasingContrato.ucGeradoraTitularDiferente &&
      !leasingContrato.ucGeradoraTitular
    ) {
      setUcGeradoraTitularPanelOpen(true)
    }
  }, [leasingContrato.ucGeradoraTitular, leasingContrato.ucGeradoraTitularDiferente])

  const handleLeasingContratoProprietarioChange = useCallback(
    (index: number, campo: keyof LeasingContratoProprietario, valor: string) => {
      const atualizados = leasingContrato.proprietarios.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [campo]: valor } : item,
      )
      leasingActions.updateContrato({ proprietarios: atualizados })
    },
    [leasingContrato.proprietarios],
  )

  const handleAdicionarContratoProprietario = useCallback(() => {
    leasingActions.updateContrato({
      proprietarios: [...leasingContrato.proprietarios, { nome: '', cpfCnpj: '' }],
    })
  }, [leasingContrato.proprietarios])

  const handleRemoverContratoProprietario = useCallback(
    (index: number) => {
      if (leasingContrato.proprietarios.length <= 1) {
        leasingActions.updateContrato({ proprietarios: [{ nome: '', cpfCnpj: '' }] })
        return
      }
      const proximos = leasingContrato.proprietarios.filter((_, idx) => idx !== index)
      leasingActions.updateContrato({ proprietarios: proximos })
    },
    [leasingContrato.proprietarios],
  )

  const handleHerdeiroChange = useCallback((index: number, value: string) => {
    const base = clienteRef.current ?? cliente
    const atual = ensureClienteHerdeiros(base.herdeiros)
    if (index < 0 || index >= atual.length) {
      return
    }

    if (atual[index] === value) {
      return
    }

    const proximo = [...atual]
    proximo[index] = value
    setClienteSync({ ...base, herdeiros: proximo })
  }, [cliente, setClienteSync])

  const handleAdicionarHerdeiro = useCallback(() => {
    const base = clienteRef.current ?? cliente
    const atual = ensureClienteHerdeiros(base.herdeiros)
    setClienteSync({ ...base, herdeiros: [...atual, ''] })
    setClienteHerdeirosExpandidos(true)
  }, [cliente, setClienteSync])

  const handleRemoverHerdeiro = useCallback((index: number) => {
    const base = clienteRef.current ?? cliente
    const atual = ensureClienteHerdeiros(base.herdeiros)
    if (index < 0 || index >= atual.length) {
      return
    }

    if (atual.length === 1) {
      if (atual[0] === '') {
        return
      }
      setClienteSync({ ...base, herdeiros: [''] })
      return
    }

    const proximo = atual.filter((_, idx) => idx !== index)
    setClienteSync({ ...base, herdeiros: proximo.length > 0 ? proximo : [''] })
  }, [cliente, setClienteSync])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const cepNumeros = normalizeNumbers(clienteRef.current?.cep ?? cliente.cep)
    console.log('[CEP effect] run', {
      cep: cepNumeros,
      hydrating: isHydratingRef.current,
      editingEndereco: isEditingEnderecoRef.current,
      last: lastCepAppliedRef.current,
    })

    if (isHydratingRef.current || isApplyingCepRef.current || isEditingEnderecoRef.current) {
      return
    }

    if (cepNumeros.length !== 8) {
      setBuscandoCep(false)
      setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cep: undefined }))
      return
    }

    if (cepNumeros === lastCepAppliedRef.current) {
      return
    }

    let ativo = true
    const controller = new AbortController()

    const consultarCep = async () => {
      setBuscandoCep(true)
      setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cep: undefined }))

      try {
        isApplyingCepRef.current = true
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

        const base = clienteRef.current ?? cliente
        const enderecoAtual = base.endereco?.trim() ?? ''
        const patch: Partial<ClienteDados> = {}
        if (localidade && localidade !== base.cidade) {
          patch.cidade = localidade
        }
        if (uf && uf !== base.uf) {
          patch.uf = uf
        }
        if (uf && uf !== base.uf) {
          const listaDistribuidoras = distribuidorasPorUf[uf] ?? []
          let proximaDistribuidora = base.distribuidora
          if (listaDistribuidoras.length === 1) {
            proximaDistribuidora = listaDistribuidoras[0]
          } else if (
            proximaDistribuidora &&
            !listaDistribuidoras.includes(proximaDistribuidora)
          ) {
            proximaDistribuidora = ''
          }
          if (!proximaDistribuidora) {
            const defaultDistribuidora = getDistribuidoraDefaultForUf(uf)
            if (defaultDistribuidora) {
              proximaDistribuidora = defaultDistribuidora
            }
          }
          if (proximaDistribuidora !== base.distribuidora) {
            patch.distribuidora = proximaDistribuidora
          }
        }
        if (!enderecoAtual && logradouro) {
          patch.endereco = logradouro
        }
        if (Object.keys(patch).length > 0) {
          updateClienteSync(patch)
        }

        lastCepAppliedRef.current = cepNumeros
        setClienteMensagens((prev): ClienteMensagens => ({
          ...prev,
          cep: undefined,
          cidade: undefined,
        }))
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
        isApplyingCepRef.current = false
      }
    }

    consultarCep()

    return () => {
      ativo = false
      controller.abort()
    }
  }, [cliente.cep, distribuidorasPorUf])

  useEffect(() => {
    const draft = leasingContrato.ucGeradoraTitularDraft
    if (!draft) {
      setUcGeradoraTitularBuscandoCep(false)
      setUcGeradoraTitularCepMessage(undefined)
      return
    }

    const cepNumeros = normalizeNumbers(draft.endereco.cep ?? '')

    if (isHydratingRef.current || isApplyingUcGeradoraCepRef.current) {
      return
    }

    if (cepNumeros.length !== 8) {
      setUcGeradoraTitularBuscandoCep(false)
      setUcGeradoraTitularCepMessage(undefined)
      return
    }

    if (cepNumeros === lastUcGeradoraCepAppliedRef.current) {
      return
    }

    let ativo = true
    const controller = new AbortController()

    const consultarCep = async () => {
      setUcGeradoraTitularBuscandoCep(true)
      setUcGeradoraTitularCepMessage(undefined)

      try {
        isApplyingUcGeradoraCepRef.current = true
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
          setUcGeradoraTitularCepMessage('CEP não encontrado.')
          return
        }

        const logradouro = data?.logradouro?.trim() ?? ''
        const localidade = data?.localidade?.trim() ?? ''
        const uf = data?.uf?.trim().toUpperCase() ?? ''

        const patchEndereco: Partial<LeasingEndereco> = {}
        if (logradouro && !draft.endereco.logradouro.trim()) {
          patchEndereco.logradouro = logradouro
        }
        if (localidade && localidade !== draft.endereco.cidade) {
          patchEndereco.cidade = localidade
        }
        if (uf && uf !== draft.endereco.uf) {
          patchEndereco.uf = uf
        }
        if (Object.keys(patchEndereco).length > 0) {
          updateUcGeradoraTitularDraft({ endereco: patchEndereco })
        }

        lastUcGeradoraCepAppliedRef.current = cepNumeros
        setUcGeradoraTitularCepMessage(undefined)
      } catch (error) {
        if (!ativo || controller.signal.aborted) {
          return
        }

        setUcGeradoraTitularCepMessage('Não foi possível consultar o CEP agora.')
      } finally {
        if (ativo) {
          setUcGeradoraTitularBuscandoCep(false)
        }
        isApplyingUcGeradoraCepRef.current = false
      }
    }

    consultarCep()

    return () => {
      ativo = false
      controller.abort()
    }
  }, [leasingContrato.ucGeradoraTitularDraft, updateUcGeradoraTitularDraft])

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
        const sanitizedLayoutHtml = sanitizePrintableHtml(layoutHtml)

        if (!sanitizedLayoutHtml) {
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

        openBudgetPreviewWindow(sanitizedLayoutHtml, {
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

  const carregarOrcamentoSalvo = useCallback(
    async (registroInicial: OrcamentoSalvo) => {
      let registro = registroInicial

      if (!registro.snapshot) {
        carregarOrcamentoParaEdicao(registro)
        return
      }

      const assinaturaAtual = computeSignatureRef.current()
      const assinaturaRegistro = computeSnapshotSignature(registro.snapshot, registro.dados)

      if (assinaturaRegistro === assinaturaAtual) {
        carregarOrcamentoParaEdicao(registro, {
          notificationMessage:
            'Os dados desta proposta já estavam carregados. A versão salva foi reaplicada.',
        })
        return
      }

      if (hasUnsavedChanges()) {
        const choice = await requestSaveDecision({
          title: 'Salvar alterações atuais?',
          description:
            'Existem alterações não salvas. Deseja salvar a proposta atual antes de carregar a selecionada?',
        })

        if (choice === 'save') {
          const salvou = await handleSalvarPropostaPdf()
          if (!salvou) {
            return
          }

          limparDadosModalidade(printableData.tipoProposta)

          const registrosAtualizados = await carregarOrcamentosPrioritarios()
          const atualizado = registrosAtualizados.find((item) => item.id === registro.id)
          if (atualizado?.snapshot) {
            registro = atualizado
          }
        } else {
          limparDadosModalidade(printableData.tipoProposta)
        }
      }

      const tipoRegistro = registro.dados.tipoProposta
      const possuiDadosPreenchidos =
        tipoRegistro === 'VENDA_DIRETA' ? hasVendaStateChanges() : hasLeasingStateChanges()

      if (possuiDadosPreenchidos) {
        limparDadosModalidade(tipoRegistro)
      }

      carregarOrcamentoParaEdicao(registro)
    },
    [
      carregarOrcamentoParaEdicao,
      carregarOrcamentosPrioritarios,
      handleSalvarPropostaPdf,
      hasUnsavedChanges,
      requestSaveDecision,
      limparDadosModalidade,
      printableData.tipoProposta,
    ],
  )

  const fecharPesquisaOrcamentos = () => {
    setOrcamentoVisualizado(null)
    setOrcamentoVisualizadoInfo(null)
    voltarParaPaginaPrincipal()
  }

  const voltarParaPaginaPrincipal = useCallback(() => {
    setActivePage(lastPrimaryPageRef.current)
  }, [setActivePage])

  const toggleAprovacaoChecklist = useCallback((key: AprovacaoChecklistKey) => {
    setAprovacaoChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }, [])

  const registrarDecisaoInterna = useCallback((status: AprovacaoStatus) => {
    setAprovacaoStatus(status)
    setUltimaDecisaoTimestamp(Date.now())
  }, [])

  const isSimulacoesWorkspaceActive = simulacoesSection === 'nova' || simulacoesSection === 'salvas'

  const budgetCodeDisplay = useMemo(() => {
    return normalizeProposalId(printableData.budgetId) || null
  }, [printableData.budgetId])

  const selecionarContatoEnvio = useCallback((id: string) => {
    setContatoEnvioSelecionadoId(id)
  }, [])

  const fecharEnvioPropostaModal = useCallback(() => {
    setIsEnviarPropostaModalOpen(false)
  }, [])

  const abrirEnvioPropostaModal = useCallback(() => {
    setActivePage('app')
    setIsEnviarPropostaModalOpen(true)
    if (contatosEnvio.length === 0) {
      adicionarNotificacao(
        'Cadastre um cliente ou lead com telefone ou e-mail para enviar a proposta.',
        'info',
      )
    }
  }, [adicionarNotificacao, contatosEnvio.length, setActivePage])

  const handleEnviarProposta = useCallback(
    async (metodo: PropostaEnvioMetodo) => {
      const mode = isVendaDiretaTab ? 'venda' : 'leasing'
      if (!guardClientFieldsOrReturn(mode)) {
        return
      }
      const contato = contatoEnvioSelecionado
      if (!contato) {
        adicionarNotificacao('Selecione um contato para enviar a proposta.', 'error')
        return
      }

      const nomeContato = contato.nome?.trim() || 'cliente'
      const primeiroNome = nomeContato.split(/\s+/).filter(Boolean)[0] || nomeContato
      const codigoProposta = budgetCodeDisplay || normalizeProposalId(currentBudgetId) || null
      const valorReferencia =
        valorTotalPropostaNormalizado ?? valorTotalPropostaState ?? printableData.valorTotalProposta ?? null
      const valorTexto =
        typeof valorReferencia === 'number' && Number.isFinite(valorReferencia)
          ? currency(valorReferencia)
          : null
      const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

      const mensagemBase = [
        `Olá ${primeiroNome}!`,
        'Segue a proposta financeira da SolarInvest',
        codigoProposta ? `código ${codigoProposta}` : null,
        valorTexto ? `no valor total de ${valorTexto}` : null,
        'com as condições personalizadas para o seu projeto.',
      ]
        .filter(Boolean)
        .join(' ')
      const mensagemCompleta = `${mensagemBase}${shareUrl ? ` ${shareUrl}` : ''}`

      if (metodo === 'whatsapp' || metodo === 'whatsapp-business') {
        const telefoneWhatsapp =
          contato.telefone && formatWhatsappPhoneNumber(contato.telefone)
        if (!telefoneWhatsapp) {
          adicionarNotificacao(
            'Informe um telefone com DDD para enviar via WhatsApp.',
            'error',
          )
          return
        }

        if (typeof window === 'undefined') {
          adicionarNotificacao('Abra o aplicativo no navegador para compartilhar via WhatsApp.', 'error')
          return
        }

        const whatsappUrl = `https://wa.me/${telefoneWhatsapp}?text=${encodeURIComponent(
          mensagemCompleta,
        )}`
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
        adicionarNotificacao('Abra o WhatsApp para concluir o envio da proposta.', 'info')
        setIsEnviarPropostaModalOpen(false)
        return
      }

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: 'Proposta SolarInvest',
            text: mensagemBase,
            url: shareUrl || undefined,
          })
          adicionarNotificacao('Compartilhamento iniciado no dispositivo.', 'success')
          setIsEnviarPropostaModalOpen(false)
        } catch (error) {
          if (!(error instanceof DOMException) || error.name !== 'AbortError') {
            adicionarNotificacao('Não foi possível compartilhar a proposta neste dispositivo.', 'error')
          }
        }
      } else {
        adicionarNotificacao('Compartilhamento nativo indisponível neste dispositivo.', 'error')
      }
    },
    [
      adicionarNotificacao,
      budgetCodeDisplay,
      contatoEnvioSelecionado,
      currentBudgetId,
      guardClientFieldsOrReturn,
      isVendaDiretaTab,
      printableData.valorTotalProposta,
      valorTotalPropostaNormalizado,
      valorTotalPropostaState,
    ],
  )

  const renderClienteDadosSection = () => {
    const herdeirosPreenchidos = cliente.herdeiros.filter((nome) => nome.trim().length > 0)
    const herdeirosResumo =
      herdeirosPreenchidos.length === 0
        ? 'Nenhum herdeiro cadastrado'
        : `${herdeirosPreenchidos.length} ${
            herdeirosPreenchidos.length === 1
              ? 'herdeiro cadastrado'
              : 'herdeiros cadastrados'
          }`
    const isCondominio = isSegmentoCondominio(segmentoCliente)

    return (
      <section className="card">
        <div className="card-header">
          <h2>Dados do cliente</h2>
          {budgetCodeDisplay ? (
            <div
              className="budget-code-badge"
            role="status"
            aria-live="polite"
            aria-label="Código do orçamento salvo"
          >
            <span className="budget-code-badge__label">Orçamento</span>
            <span className="budget-code-badge__value">{budgetCodeDisplay}</span>
          </div>
        ) : null}
      </div>
      <div className="grid g2">
        <Field
          label={labelWithTooltip(
            'Nome ou Razão social',
            'Identificação oficial do cliente utilizada em contratos, relatórios e integração com o CRM. Para empresas, informar a Razão Social.',
          )}
        >
          <input
            data-field="cliente-nomeRazao"
            value={cliente.nome}
            onChange={(e) => {
              handleClienteChange('nome', e.target.value)
              clearFieldHighlight(e.currentTarget)
            }}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'CPF/CNPJ',
            'Documento fiscal do titular da unidade consumidora. Para pessoa física: CPF. Para pessoa jurídica: CNPJ.',
          )}
        >
          <input
            data-field="cliente-cpfCnpj"
            value={cliente.documento}
            onChange={(e) => {
              handleClienteChange('documento', e.target.value)
              clearFieldHighlight(e.currentTarget)
            }}
            inputMode="numeric"
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Representante Legal',
            'Nome do representante legal (para pessoa jurídica/CNPJ). Deixar em branco para pessoa física.',
          )}
        >
          <input
            value={cliente.representanteLegal || ''}
            onChange={(e) => handleClienteChange('representanteLegal', e.target.value)}
            placeholder="Nome do diretor ou sócio"
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'RG',
            'Registro Geral (documento de identidade) do contratante pessoa física.',
          )}
        >
          <input
            data-field="cliente-rg"
            value={cliente.rg || ''}
            onChange={(e) => {
              handleClienteChange('rg', e.target.value)
              clearFieldHighlight(e.currentTarget)
            }}
            placeholder="00.000.000-0"
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Estado Civil',
            'Estado civil do contratante pessoa física (solteiro, casado, divorciado, viúvo, etc.).',
          )}
        >
          <select
            data-field="cliente-estadoCivil"
            value={cliente.estadoCivil || ''}
            onChange={(e) => {
              handleClienteChange('estadoCivil', e.target.value)
              clearFieldHighlight(e.currentTarget)
            }}
          >
            <option value="">Selecione</option>
            <option value="Solteiro(a)">Solteiro(a)</option>
            <option value="Casado(a)">Casado(a)</option>
            <option value="Divorciado(a)">Divorciado(a)</option>
            <option value="Viúvo(a)">Viúvo(a)</option>
            <option value="União Estável">União Estável</option>
          </select>
        </Field>
        <Field
          label={labelWithTooltip(
            'Nacionalidade',
            'Nacionalidade do contratante pessoa física.',
          )}
        >
          <input
            value={cliente.nacionalidade || ''}
            onChange={(e) => handleClienteChange('nacionalidade', e.target.value)}
            placeholder="Brasileira"
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Profissão',
            'Ocupação ou profissão do contratante pessoa física.',
          )}
        >
          <input
            value={cliente.profissao || ''}
            onChange={(e) => handleClienteChange('profissao', e.target.value)}
            placeholder="Ex: Engenheiro, Advogado, Empresário"
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
            data-field="cliente-email"
            value={cliente.email}
            onChange={(e) => {
              handleClienteChange('email', e.target.value)
              clearFieldHighlight(e.currentTarget)
            }}
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
            data-field="cliente-telefone"
            value={cliente.telefone}
            onChange={(e) => {
              handleClienteChange('telefone', e.target.value)
              clearFieldHighlight(e.currentTarget)
            }}
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
            data-field="cliente-cep"
            value={cliente.cep}
            onChange={(e) => {
              handleClienteChange('cep', e.target.value)
              clearFieldHighlight(e.currentTarget)
            }}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Cidade',
            'Município da instalação utilizado em relatórios, cálculo de impostos locais e validação de CEP.',
          )}
          hint={verificandoCidade ? 'Verificando cidade...' : clienteMensagens.cidade}
        >
          <input
            data-field="cliente-cidade"
            value={cliente.cidade}
            onChange={(e) => {
              const nextCidade = e.target.value
              handleClienteChange('cidade', nextCidade)
              clearFieldHighlight(e.currentTarget)
              if (nextCidade.trim() && cliente.uf.trim()) {
                clearFieldHighlight(
                  document.querySelector('[data-field="cliente-uf"]') as HTMLElement | null,
                )
              }
            }}
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'UF ou Estado',
            'Estado da instalação; utilizado para listar distribuidoras disponíveis, definir tarifas e parâmetros regionais.',
          )}
        >
          <select
            data-field="cliente-uf"
            value={cliente.uf}
            onChange={(e) => {
              const nextUf = e.target.value
              handleClienteChange('uf', nextUf)
              clearFieldHighlight(e.currentTarget)
              if (cliente.cidade.trim() && nextUf.trim()) {
                clearFieldHighlight(
                  document.querySelector('[data-field="cliente-cidade"]') as HTMLElement | null,
                )
              }
            }}
          >
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
            'Distribuidora (ANEEL)',
            'Concessionária responsável pela unidade consumidora; define tarifas homologadas e regras de compensação.',
          )}
        >
          <select
            data-field="cliente-distribuidoraAneel"
            value={cliente.distribuidora}
            onChange={(e) => {
              handleClienteChange('distribuidora', e.target.value)
              clearFieldHighlight(e.currentTarget)
            }}
            disabled={clienteDistribuidoraDisabled}
            aria-disabled={clienteDistribuidoraDisabled}
            style={
              clienteDistribuidoraDisabled
                ? { opacity: 0.6, cursor: 'not-allowed' }
                : undefined
            }
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
            'Tipo de Edificação',
            'Classificação da edificação (Residencial, Comercial, Cond. Vertical, Cond. Horizontal, Industrial ou Outros (texto)), utilizada para relatórios e cálculos de tarifas.',
          )}
        >
          <select
            data-field="cliente-tipoEdificacao"
            value={segmentoCliente}
            onChange={(event) => {
              handleSegmentoClienteChange(event.target.value as SegmentoCliente)
              clearFieldHighlight(event.currentTarget)
            }}
          >
            {NOVOS_TIPOS_EDIFICACAO.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {(segmentoCliente === 'outros' || tusdTipoCliente === 'outros') && (
            <input
              type="text"
              placeholder="Descreva..."
              style={{ marginTop: '6px' }}
              value={tipoEdificacaoOutro}
              onChange={(event) => setTipoEdificacaoOutro(event.target.value)}
            />
          )}
        </Field>
        <Field
          label={labelWithTooltip(
            'UC Geradora (número)',
            'Código numérico da unidade consumidora geradora junto à distribuidora, usado para vincular contratos e projeções de consumo.',
          )}
        >
          <input
            data-field="cliente-ucGeradoraNumero"
            value={cliente.uc}
            onChange={(e) => {
              handleClienteChange('uc', e.target.value)
              clearFieldHighlight(e.currentTarget)
            }}
            placeholder="Número da UC geradora"
          />
        </Field>
        <Field
          label={labelWithTooltip(
            'Endereço do Contratante',
            'Endereço do contratante; será usado nos contratos. Pode ser diferente do endereço de instalação.',
          )}
        >
          <input
            data-field="cliente-enderecoContratante"
            value={cliente.endereco ?? ''}
            onChange={(e) => {
              updateClienteSync({ endereco: e.target.value })
              clearFieldHighlight(e.currentTarget)
            }}
            onFocus={() => {
              isEditingEnderecoRef.current = true
            }}
            onBlur={() => {
              isEditingEnderecoRef.current = false
            }}
            autoComplete="street-address"
            placeholder="Rua, número, complemento"
          />
        </Field>
        <Field
          label={
            <div className="leasing-location-label">
              <div className="leasing-location-title">
                <span className="leasing-field-label-text">
                  Informações da UC geradora
                </span>
                <label className="leasing-location-checkbox flex items-center gap-2">
                  <CheckboxSmall
                    checked={leasingContrato.ucGeradoraTitularDiferente}
                    onChange={(event) =>
                      handleToggleUcGeradoraTitularDiferente(event.target.checked)
                    }
                  />
                  <span>Diferente titular da UC geradora</span>
                </label>
              </div>
            </div>
          }
          hint="O endereço da UC geradora seguirá o endereço do contratante, exceto quando houver titular diferente."
        >
          <div aria-hidden="true" />
        </Field>
        {leasingContrato.ucGeradoraTitularDiferente ? (
          <div className="uc-geradora-titular-panel-row">
            <div className="uc-geradora-titular-panel">
              {ucGeradoraTitularPanelOpen ? (
                <>
                  <div className="uc-geradora-titular-grid">
                    <Field
                      label="Nome completo"
                      hint={<FieldError message={ucGeradoraTitularErrors.nomeCompleto} />}
                    >
                      <input
                        data-field="ucGeradoraTitular-nomeCompleto"
                        value={leasingContrato.ucGeradoraTitularDraft?.nomeCompleto ?? ''}
                        onChange={(event) => {
                          updateUcGeradoraTitularDraft({ nomeCompleto: event.target.value })
                          clearUcGeradoraTitularError('nomeCompleto')
                        }}
                        placeholder="Nome completo"
                      />
                    </Field>
                    <Field
                      label="CPF"
                      hint={<FieldError message={ucGeradoraTitularErrors.cpf} />}
                    >
                      <input
                        data-field="ucGeradoraTitular-cpf"
                        value={leasingContrato.ucGeradoraTitularDraft?.cpf ?? ''}
                        onChange={(event) => {
                          updateUcGeradoraTitularDraft({
                            cpf: formatCpfCnpj(event.target.value),
                          })
                          clearUcGeradoraTitularError('cpf')
                        }}
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                      />
                    </Field>
                    <Field
                      label="RG"
                      hint={<FieldError message={ucGeradoraTitularErrors.rg} />}
                    >
                      <input
                        data-field="ucGeradoraTitular-rg"
                        value={leasingContrato.ucGeradoraTitularDraft?.rg ?? ''}
                        onChange={(event) => {
                          updateUcGeradoraTitularDraft({ rg: event.target.value })
                          clearUcGeradoraTitularError('rg')
                        }}
                        placeholder="RG"
                      />
                    </Field>
                    <Field
                      label="CEP"
                      hint={
                        ucGeradoraTitularErrors.cep ||
                        ucGeradoraTitularBuscandoCep ||
                        ucGeradoraTitularCepMessage ? (
                          <>
                            <FieldError message={ucGeradoraTitularErrors.cep} />
                            {ucGeradoraTitularBuscandoCep ? (
                              <span>Buscando CEP...</span>
                            ) : ucGeradoraTitularCepMessage ? (
                              <span>{ucGeradoraTitularCepMessage}</span>
                            ) : null}
                          </>
                        ) : undefined
                      }
                    >
                      <input
                        data-field="ucGeradoraTitular-cep"
                        value={leasingContrato.ucGeradoraTitularDraft?.endereco.cep ?? ''}
                        onChange={(event) => {
                          setUcGeradoraTitularCepMessage(undefined)
                          setUcGeradoraTitularBuscandoCep(false)
                          updateUcGeradoraTitularDraft({
                            endereco: { cep: formatCep(event.target.value) },
                          })
                          clearUcGeradoraTitularError('cep')
                        }}
                        placeholder="00000-000"
                        inputMode="numeric"
                      />
                    </Field>
                    <Field
                      label="Logradouro"
                      hint={<FieldError message={ucGeradoraTitularErrors.logradouro} />}
                    >
                      <input
                        data-field="ucGeradoraTitular-logradouro"
                        value={leasingContrato.ucGeradoraTitularDraft?.endereco.logradouro ?? ''}
                        onChange={(event) => {
                          updateUcGeradoraTitularDraft({
                            endereco: { logradouro: event.target.value },
                          })
                          clearUcGeradoraTitularError('logradouro')
                        }}
                        placeholder="Rua, avenida, etc."
                      />
                    </Field>
                    <Field
                      label="Cidade"
                      hint={<FieldError message={ucGeradoraTitularErrors.cidade} />}
                    >
                      <input
                        data-field="ucGeradoraTitular-cidade"
                        value={leasingContrato.ucGeradoraTitularDraft?.endereco.cidade ?? ''}
                        onChange={(event) => {
                          updateUcGeradoraTitularDraft({
                            endereco: { cidade: event.target.value },
                          })
                          clearUcGeradoraTitularError('cidade')
                        }}
                        placeholder="Cidade"
                      />
                    </Field>
                    <Field
                      label="UF"
                      hint={<FieldError message={ucGeradoraTitularErrors.uf} />}
                    >
                      <select
                        data-field="ucGeradoraTitular-uf"
                        value={leasingContrato.ucGeradoraTitularDraft?.endereco.uf ?? ''}
                        onChange={(event) => {
                          handleUcGeradoraTitularUfChange(event.target.value)
                          clearUcGeradoraTitularError('uf')
                        }}
                      >
                        <option value="">UF</option>
                        {ufsDisponiveis.map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Field
                        label={labelWithTooltip(
                          'Distribuidora (ANEEL)',
                          'Concessionária responsável pela UC geradora; define tarifas homologadas e regras de compensação.',
                        )}
                      >
                        <select
                          data-field="ucGeradoraTitular-distribuidoraAneel"
                          value={leasingContrato.ucGeradoraTitularDistribuidoraAneel}
                          onChange={(event) =>
                            handleUcGeradoraTitularDistribuidoraChange(event.target.value)
                          }
                          disabled={titularDistribuidoraDisabled}
                          aria-disabled={titularDistribuidoraDisabled}
                          style={
                            titularDistribuidoraDisabled
                              ? { opacity: 0.6, cursor: 'not-allowed' }
                              : undefined
                          }
                        >
                          <option value="">
                            {ucGeradoraTitularUf ? 'Selecione a distribuidora' : 'Selecione a UF'}
                          </option>
                          {ucGeradoraTitularDistribuidorasDisponiveis.map((nome) => (
                            <option key={nome} value={nome}>
                              {nome}
                            </option>
                          ))}
                          {leasingContrato.ucGeradoraTitularDistribuidoraAneel &&
                          !ucGeradoraTitularDistribuidorasDisponiveis.includes(
                            leasingContrato.ucGeradoraTitularDistribuidoraAneel,
                          ) ? (
                            <option value={leasingContrato.ucGeradoraTitularDistribuidoraAneel}>
                              {leasingContrato.ucGeradoraTitularDistribuidoraAneel}
                            </option>
                          ) : null}
                        </select>
                      </Field>
                    </div>
                  </div>
                  <div className="uc-geradora-titular-actions">
                    <button
                      type="button"
                      className="primary uc-geradora-titular-button"
                      onClick={handleSalvarUcGeradoraTitular}
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      className="ghost uc-geradora-titular-button"
                      onClick={handleCancelarUcGeradoraTitular}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : leasingContrato.ucGeradoraTitular ? (
                <div className="uc-geradora-titular-summary">
                  <div className="uc-geradora-titular-summary-info">
                    <strong>{leasingContrato.ucGeradoraTitular.nomeCompleto}</strong>
                    <span>CPF: {leasingContrato.ucGeradoraTitular.cpf}</span>
                    <span>RG: {leasingContrato.ucGeradoraTitular.rg}</span>
                    <span>
                      {formatUcGeradoraTitularEndereco(
                        leasingContrato.ucGeradoraTitular.endereco,
                      )}
                    </span>
                    {leasingContrato.ucGeradoraTitularDistribuidoraAneel ? (
                      <span>
                        Distribuidora (ANEEL): {leasingContrato.ucGeradoraTitularDistribuidoraAneel}
                      </span>
                    ) : null}
                  </div>
                  <div className="uc-geradora-titular-summary-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={handleEditarUcGeradoraTitular}
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {isCondominio ? (
          <div className="grid g3">
            <Field label="Nome do síndico">
              <input
                value={cliente.nomeSindico}
                onChange={(event) => handleClienteChange('nomeSindico', event.target.value)}
                placeholder="Nome completo"
              />
            </Field>
            <Field label="CPF do síndico">
              <input
                value={cliente.cpfSindico}
                onChange={(event) => handleClienteChange('cpfSindico', event.target.value)}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </Field>
            <Field label="Contato do síndico">
              <input
                value={cliente.contatoSindico}
                onChange={(event) => handleClienteChange('contatoSindico', event.target.value)}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>
          </div>
        ) : null}
        <Field
          label={labelWithTooltip(
            'UCs Beneficiárias',
            'Cadastre as unidades consumidoras que receberão rateio automático dos créditos de energia gerados.',
          )}
        >
          <div className="cliente-ucs-beneficiarias-group">
            {ucsBeneficiarias.length === 0 ? (
              <p className="cliente-ucs-beneficiarias-empty">
                Nenhuma UC beneficiária cadastrada. Utilize o botão abaixo para adicionar.
              </p>
            ) : null}
            {ucsBeneficiarias.map((uc, index) => (
              <div className="cliente-ucs-beneficiaria-row" key={uc.id}>
                <span className="cliente-ucs-beneficiaria-index" aria-hidden="true">
                  UC {index + 1}
                </span>
                <input
                  className="cliente-ucs-beneficiaria-numero"
                  value={uc.numero}
                  onChange={(event) =>
                    handleAtualizarUcBeneficiaria(uc.id, 'numero', event.target.value)
                  }
                  placeholder="Número da UC"
                  aria-label={`Número da UC beneficiária ${index + 1}`}
                />
                <input
                  className="cliente-ucs-beneficiaria-endereco"
                  value={uc.endereco}
                  onChange={(event) =>
                    handleAtualizarUcBeneficiaria(uc.id, 'endereco', event.target.value)
                  }
                  placeholder="Endereço completo"
                  aria-label={`Endereço completo da UC beneficiária ${index + 1}`}
                />
                <input
                  className="cliente-ucs-beneficiaria-consumo"
                  value={uc.consumoKWh}
                  onChange={(event) =>
                    handleAtualizarUcBeneficiaria(uc.id, 'consumoKWh', event.target.value)
                  }
                  placeholder="Consumo (kWh/mês)"
                  inputMode="decimal"
                  aria-label={`Consumo mensal da UC beneficiária ${index + 1}`}
                />
                <input
                  className="cliente-ucs-beneficiaria-rateio"
                  value={uc.rateioPercentual}
                  onChange={(event) =>
                    handleAtualizarUcBeneficiaria(
                      uc.id,
                      'rateioPercentual',
                      event.target.value,
                    )
                  }
                  placeholder="Rateio (%)"
                  inputMode="decimal"
                  aria-label={`Rateio percentual da UC beneficiária ${index + 1}`}
                />
                <button
                  type="button"
                  className="ghost cliente-ucs-beneficiaria-remove"
                  onClick={() => handleRemoverUcBeneficiaria(uc.id)}
                  aria-label={`Remover UC beneficiária ${index + 1}`}
                >
                  Remover
                </button>
              </div>
            ))}
            <div className="cliente-ucs-beneficiarias-actions">
              <button
                type="button"
                className="ghost"
                onClick={handleAdicionarUcBeneficiaria}
              >
                Adicionar UC beneficiária
              </button>
            </div>
          </div>
        </Field>
        {consumoUcsExcedeInformado ? (
          <div className="warning ucs-consumo-warning" role="alert">
            <strong>Consumo das UCs acima do total informado.</strong>{' '}
            A soma dos consumos das UCs beneficiárias (
            {formatNumberBRWithOptions(consumoTotalUcsBeneficiarias, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}{' '}
            kWh/mês) ultrapassa o consumo mensal informado (
            {formatNumberBRWithOptions(kcKwhMes, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}{' '}
            kWh/mês). Ajuste os valores para manter o rateio consistente.
          </div>
        ) : null}
        <Field
          label={labelWithTooltip(
            'Indicação',
            'Marque quando o cliente tiver sido indicado e registre quem realizou a indicação para controle comercial.',
          )}
          hint={cliente.temIndicacao ? 'Informe o nome do responsável pela indicação.' : undefined}
        >
          <div className="cliente-indicacao-group">
            <label
              className="cliente-indicacao-toggle flex items-center gap-2"
              htmlFor={clienteIndicacaoCheckboxId}
            >
              <CheckboxSmall
                id={clienteIndicacaoCheckboxId}
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
        <Field
          label={labelWithTooltip(
            'Herdeiros (opcional)',
            'Registre os herdeiros do cliente e utilize as tags {{herdeiro#1}}, {{herdeiro#2}} e assim por diante em modelos e textos.',
          )}
          hint="As tags seguem o formato {{herdeiro#n}} conforme a ordem dos campos."
        >
          <div className="cliente-herdeiros-group">
            <button
              type="button"
              className="cliente-herdeiros-toggle"
              onClick={() => setClienteHerdeirosExpandidos((prev) => !prev)}
              aria-expanded={clienteHerdeirosExpandidos}
              aria-controls={clienteHerdeirosContentId}
            >
              {clienteHerdeirosExpandidos ? 'Ocultar herdeiros' : 'Gerenciar herdeiros'}
            </button>
            <small className="cliente-herdeiros-summary">{herdeirosResumo}</small>
            {clienteHerdeirosExpandidos ? (
              <div
                className="cliente-herdeiros-content"
                id={clienteHerdeirosContentId}
                aria-hidden={false}
              >
                {cliente.herdeiros.map((herdeiro, index) => (
                  <div className="cliente-herdeiro-row" key={`cliente-herdeiro-${index}`}>
                    <input
                      value={herdeiro}
                      onChange={(event) => handleHerdeiroChange(index, event.target.value)}
                      placeholder={`Nome do herdeiro ${index + 1}`}
                      aria-label={`Nome do herdeiro ${index + 1}`}
                    />
                    <span className="cliente-herdeiro-tag" aria-hidden="true">
                      {`{{herdeiro#${index + 1}}}`}
                    </span>
                    {cliente.herdeiros.length > 1 ? (
                      <button
                        type="button"
                        className="ghost cliente-herdeiro-remove"
                        onClick={() => handleRemoverHerdeiro(index)}
                        aria-label={`Remover herdeiro ${index + 1}`}
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                ))}
                <div className="cliente-herdeiros-actions">
                  <button
                    type="button"
                    className="ghost cliente-herdeiro-add"
                    onClick={handleAdicionarHerdeiro}
                  >
                    Adicionar herdeiro
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </Field>
      </div>
      <div className="card-actions">
        {(!clienteEmEdicaoId || clienteFormularioAlterado) && (
          <button type="button" className="primary" onClick={handleSalvarCliente}>
            {clienteSaveLabel}
          </button>
        )}
        <button type="button" className="ghost" onClick={() => void abrirClientesPainel()}>
          Ver clientes
        </button>
      </div>
      {!oneDriveIntegrationAvailable ? (
        <p className="muted integration-hint" role="status">
          Sincronização automática com o OneDrive indisponível. Configure a integração para habilitar o envio.
        </p>
      ) : null}
      </section>
    )
  }

  const renderLeasingContratoSection = () => {
    const isCondominioContrato = leasingContrato.tipoContrato === 'condominio'
    const renderLeasingLabel = (text: string) => (
      <span className="leasing-field-label-text">{text}</span>
    )
    const tipoContratoSelecionado = leasingContrato.tipoContrato
    return (
      <section className="card leasing-contract-card">
        <div className="card-header">
          <h2>Dados contratuais do leasing</h2>
        </div>
        <div className="leasing-form-grid">
          <div className="leasing-contract-dates-grid">
            <Field label="Tipo de contrato">
              <div
                className="flex flex-row gap-3 items-center leasing-contract-toggle-group"
                role="radiogroup"
                aria-label="Tipo de contrato"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={tipoContratoSelecionado === 'residencial'}
                  className={`leasing-contract-toggle${
                    tipoContratoSelecionado === 'residencial' ? ' is-active' : ''
                  }`}
                  onClick={() => handleLeasingContratoCampoChange('tipoContrato', 'residencial')}
                >
                  Residencial
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={tipoContratoSelecionado === 'condominio'}
                  className={`leasing-contract-toggle${
                    tipoContratoSelecionado === 'condominio' ? ' is-active' : ''
                  }`}
                  onClick={() => handleLeasingContratoCampoChange('tipoContrato', 'condominio')}
                >
                  Condomínio
                </button>
              </div>
            </Field>
            <Field label={renderLeasingLabel('Data de início do contrato')}>
              <input
                className="leasing-compact-input"
                type="date"
                value={leasingContrato.dataInicio}
                onChange={(event) => handleLeasingContratoCampoChange('dataInicio', event.target.value)}
              />
            </Field>
            <Field label={renderLeasingLabel('Data de término do contrato')}>
              <input
                className="leasing-compact-input"
                type="date"
                value={leasingContrato.dataFim}
                onChange={(event) => handleLeasingContratoCampoChange('dataFim', event.target.value)}
              />
            </Field>
            <Field label={renderLeasingLabel('Dia de vencimento da mensalidade')}>
              <select
                className="leasing-compact-input"
                value={cliente.diaVencimento || '10'}
                onChange={(event) => handleClienteChange('diaVencimento', event.target.value)}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={String(day)}>
                    Dia {day}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={renderLeasingLabel('Data da homologação (opcional)')}>
              <input
                id={leasingHomologacaoInputId}
                className="leasing-compact-input"
                type="date"
                value={leasingContrato.dataHomologacao}
                onChange={(event) =>
                  handleLeasingContratoCampoChange('dataHomologacao', event.target.value)
                }
              />
            </Field>
          </div>
          <div className="leasing-equipments-grid">
            <Field label="Módulos fotovoltaicos instalados">
              <textarea
                value={leasingContrato.modulosFV}
                onChange={(event) => handleLeasingContratoCampoChange('modulosFV', event.target.value)}
                rows={2}
              />
            </Field>
            <Field label="Inversores instalados">
              <textarea
                value={leasingContrato.inversoresFV}
                onChange={(event) =>
                  handleLeasingContratoCampoChange('inversoresFV', event.target.value)
                }
                rows={2}
              />
            </Field>
          </div>
          {isCondominioContrato ? (
            <div className="leasing-condominio-grid">
              <Field label="Nome do condomínio">
                <input
                  value={leasingContrato.nomeCondominio}
                  onChange={(event) =>
                    handleLeasingContratoCampoChange('nomeCondominio', event.target.value)
                  }
                />
              </Field>
              <Field label="CNPJ do condomínio">
                <input
                  value={leasingContrato.cnpjCondominio}
                  onChange={(event) =>
                    handleLeasingContratoCampoChange('cnpjCondominio', event.target.value)
                  }
                />
              </Field>
              <Field label="Nome do síndico">
                <input
                  value={leasingContrato.nomeSindico}
                  onChange={(event) =>
                    handleLeasingContratoCampoChange('nomeSindico', event.target.value)
                  }
                />
              </Field>
              <Field label="CPF do síndico">
                <input
                  value={leasingContrato.cpfSindico}
                  onChange={(event) =>
                    handleLeasingContratoCampoChange('cpfSindico', event.target.value)
                  }
                />
              </Field>
              <Field
                label="Proprietários / representantes legais (autorização do proprietário)"
                hint="Inclua o nome e o CPF/CNPJ que devem constar no termo de autorização."
              >
                <div className="cliente-herdeiros-group">
                  {leasingContrato.proprietarios.map((proprietario, index) => (
                    <div className="cliente-herdeiro-row" key={`leasing-proprietario-${index}`}>
                      <input
                        value={proprietario.nome}
                        onChange={(event) =>
                          handleLeasingContratoProprietarioChange(index, 'nome', event.target.value)
                        }
                        placeholder={`Nome do proprietário ${index + 1}`}
                      />
                      <input
                        value={proprietario.cpfCnpj}
                        onChange={(event) =>
                          handleLeasingContratoProprietarioChange(
                            index,
                            'cpfCnpj',
                            event.target.value,
                          )
                        }
                        placeholder="CPF ou CNPJ"
                      />
                      <button
                        type="button"
                        className="ghost cliente-herdeiro-remove"
                        onClick={() => handleRemoverContratoProprietario(index)}
                        aria-label={`Remover proprietário ${index + 1}`}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <div className="cliente-herdeiros-actions">
                    <button
                      type="button"
                      className="ghost cliente-herdeiro-add"
                      onClick={handleAdicionarContratoProprietario}
                    >
                      Adicionar proprietário
                    </button>
                  </div>
                </div>
              </Field>
            </div>
          ) : null}
        </div>
      </section>
    )
  }

  const renderPropostaImagensSection = () => {
    if (propostaImagens.length === 0) {
      return null
    }

    const descricao =
      activeTab === 'leasing'
        ? 'Estas imagens serão exibidas na proposta de leasing. Remova as que não devem aparecer.'
        : 'Estas imagens serão exibidas na proposta de vendas. Remova as que não devem aparecer.'

    return (
      <section className="card proposal-images-card">
        <div className="card-header">
          <h2>Imagens anexadas à proposta</h2>
          <button type="button" className="ghost" onClick={handleAbrirUploadImagens}>
            Adicionar imagens
          </button>
        </div>
        <p className="muted proposal-images-description">{descricao}</p>
        <div className="proposal-images-grid">
          {propostaImagens.map((imagem, index) => {
            const trimmedName = imagem.fileName?.trim()
            const label = trimmedName && trimmedName.length > 0 ? trimmedName : `Imagem ${index + 1}`
            return (
              <figure
                key={imagem.id ?? `imagem-${index}`}
                className="proposal-images-item"
                aria-label={`Pré-visualização da imagem ${index + 1}`}
              >
                <div className="proposal-images-thumb">
                  <img src={imagem.url} alt={`Imagem anexada: ${label}`} />
                </div>
                <figcaption>
                  <span title={label}>{label}</span>
                  <button
                    type="button"
                    className="link danger"
                    onClick={() => handleRemoverPropostaImagem(imagem.id, index)}
                  >
                    Remover
                  </button>
                </figcaption>
              </figure>
            )
          })}
        </div>
      </section>
    )
  }

  function renderTusdParametersSection() {
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
            <label
              className="tusd-options-toggle flex items-center gap-2"
              htmlFor={tusdOptionsToggleId}
            >
              <CheckboxSmall
                id={tusdOptionsToggleId}
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
                onChange={(event) =>
                  handleTusdTipoClienteChange(event.target.value as TipoClienteTUSD)
                }
              >
                {NOVOS_TIPOS_TUSD.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {(segmentoCliente === 'outros' || tusdTipoCliente === 'outros') && (
                <input
                  type="text"
                  placeholder="Descreva..."
                  style={{ marginTop: '6px' }}
                  value={tipoEdificacaoOutro}
                  onChange={(event) => setTipoEdificacaoOutro(event.target.value)}
                />
              )}
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
                    setTusdSimultaneidadeFromSource(null, 'manual')
                  } else {
                    const parsed = Number(value)
                    const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
                    setTusdSimultaneidadeFromSource(normalized, 'manual')
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
            <div className="mt-2 flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Taxa mínima ({tipoRedeLabel})
              </label>
              <Switch
                checked={vendaForm.aplica_taxa_minima ?? true}
                onCheckedChange={(value) => applyVendaUpdates({ aplica_taxa_minima: value })}
              />
              <span className="text-xs text-gray-500">
                {vendaForm.aplica_taxa_minima ?? true
                  ? 'Cliente paga taxa mínima (padrão)'
                  : 'Cliente isento de taxa mínima'}
              </span>
            </div>
          </Field>
          <Field
            label={labelWithTooltip(
              'Tarifa cheia (R$/kWh)',
              'Valor cobrado por kWh sem descontos; multiplicado pelo consumo projetado para estimar a conta cheia.',
            )}
          >
            <input
              type="text"
              inputMode="decimal"
              value={tarifaCheiaField.value}
              onChange={tarifaCheiaField.onChange}
              onFocus={tarifaCheiaField.onFocus}
              onBlur={tarifaCheiaField.onBlur}
              onKeyDown={tarifaCheiaField.onKeyDown}
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
              <label className="multi-uc-toggle flex items-center gap-2">
                <CheckboxSmall
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
                    <label className="multi-uc-checkbox flex items-center gap-2">
                      <CheckboxSmall
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
                  Distribuidora de referência: {distribuidoraAneelEfetiva ?? ''}
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
    if (value !== 'outros') {
      setTipoInstalacaoOutro('')
    }
  }

  const renderConfiguracaoUsinaSection = () => (
    <section className="card configuracao-usina-card">
      <div className="configuracao-usina-card__header">
        <h2>Configuração da UF</h2>
        <button
          type="button"
          className="configuracao-usina-card__toggle"
          aria-expanded={configuracaoUsinaObservacoesExpanded}
          aria-controls={configuracaoUsinaObservacoesLeasingContainerId}
          onClick={() =>
            setConfiguracaoUsinaObservacoesExpanded((previous) => !previous)
          }
        >
          {configuracaoUsinaObservacoesExpanded
            ? 'Ocultar observações'
            : configuracaoUsinaObservacoes.trim()
            ? 'Editar observações'
            : 'Adicionar observações'}
        </button>
      </div>
      <div className={`norm-precheck-banner norm-precheck-banner--${normComplianceBanner.tone}`}>
        <div className="norm-precheck-banner__header">
          <strong>{normComplianceBanner.title}</strong>
          <span className="norm-precheck-banner__status">{normComplianceBanner.statusLabel}</span>
        </div>
        <p>{normComplianceBanner.message}</p>
        {normComplianceBanner.details.length > 0 ? (
          <ul>
            {normComplianceBanner.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
        {normCompliance?.status === 'FORA_DA_NORMA' ? (
          <label className="norm-precheck-banner__ack">
            <input
              type="checkbox"
              checked={precheckClienteCiente}
              onChange={(event) => setPrecheckClienteCiente(event.target.checked)}
            />
            <span>Cliente ciente e fará adequação do padrão.</span>
          </label>
        ) : null}
      </div>
      <div
        id={configuracaoUsinaObservacoesLeasingContainerId}
        className="configuracao-usina-card__observacoes"
        hidden={!configuracaoUsinaObservacoesExpanded}
      >
        <label className="configuracao-usina-card__observacoes-label" htmlFor={configuracaoUsinaObservacoesLeasingId}>
          Observações
        </label>
        <textarea
          id={configuracaoUsinaObservacoesLeasingId}
          value={configuracaoUsinaObservacoes}
          onChange={(event) => setConfiguracaoUsinaObservacoes(event.target.value)}
          placeholder="Inclua observações relevantes sobre a configuração da usina"
          rows={3}
        />
      </div>
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
            'Tipo de rede',
            'Seleciona a rede do cliente para calcular o custo de disponibilidade (CID) padrão de 30/50/100 kWh e somá-lo às tarifas quando a taxa mínima estiver ativa.',
          )}
        >
          <select
            value={tipoRede}
            onChange={(event) => handleTipoRedeSelection(event.target.value as TipoRede)}
          >
            {TIPOS_REDE.map((rede) => (
              <option key={rede.value} value={rede.value}>
                {rede.label}
              </option>
            ))}
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
            type="number"
            min={0}
            step="0.01"
            value={
              potenciaFonteManual
                ? vendaForm.potencia_instalada_kwp ?? ''
                : potenciaInstaladaKwp || ''
            }
            onChange={(event) => handlePotenciaInstaladaChange(event.target.value)}
            onFocus={selectNumberInputOnFocus}
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
      {tipoRedeCompatMessage ? (
        <div className="warning rede-compat-warning" role="alert">
          <strong>Incompatibilidade entre potência e rede.</strong> {tipoRedeCompatMessage}
        </div>
      ) : null}
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

  const renderPrecheckModal = () => {
    if (!precheckModalData) {
      return null
    }

    const isFora = precheckModalData.status === 'FORA_DA_NORMA'
    const isLimitado = precheckModalData.status === 'LIMITADO'
    const isWarning = precheckModalData.status === 'WARNING'
    const tipoLabel = formatTipoLigacaoLabel(precheckModalData.tipoLigacao)
    const limiteAtual = precheckModalData.kwMaxPermitido
    const upgradeLabel = precheckModalData.upgradeTo
      ? formatTipoLigacaoLabel(precheckModalData.upgradeTo)
      : null
    const limiteUpgrade = precheckModalData.kwMaxUpgrade

    const formatKw = (value?: number | null) =>
      value != null
        ? formatNumberBRWithOptions(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : null

    const potenciaLabel = formatKw(precheckModalData.potenciaInversorKw) ?? '—'
    const limiteAtualLabel = formatKw(limiteAtual)
    const limiteUpgradeLabel = formatKw(limiteUpgrade)

    const canAdjustCurrent = Boolean(limiteAtual)
    const canAdjustUpgrade = Boolean(upgradeLabel && limiteUpgrade)

    const statusMessageMap: Record<NormComplianceStatus, string> = {
      OK: 'Dentro do limite do padrão informado.',
      WARNING: 'Regra provisória: valide com a distribuidora antes do envio. Você pode continuar, mas recomendamos confirmar o padrão.',
      FORA_DA_NORMA:
        'A potência informada está acima do limite do padrão atual. Você pode ajustar para o limite atual ou simular o upgrade do padrão.',
      LIMITADO:
        'A potência informada excede o limite do padrão atual e também o limite do próximo upgrade. É necessário adequar a potência/projeto.',
    }

    return (
      <div className="modal precheck-modal" role="dialog" aria-modal="true">
        <div
          className="modal-backdrop precheck-modal__backdrop"
          onClick={() => resolvePrecheckDecision({ action: 'cancel', clienteCiente: false })}
          aria-hidden="true"
        />
        <div className="modal-content precheck-modal__content">
          <div className="modal-header">
            <div>
              <h3>Pré-check normativo (padrão de entrada)</h3>
              <p className="muted">
                UF: {precheckModalData.uf} • Padrão atual: {tipoLabel} • Potência informada: {potenciaLabel} kW
              </p>
            </div>
            <button
              type="button"
              className="icon"
              onClick={() => resolvePrecheckDecision({ action: 'cancel', clienteCiente: false })}
              aria-label="Fechar pré-check normativo"
            >
              ✕
            </button>
          </div>
          <div className="modal-body">
            <p>{statusMessageMap[precheckModalData.status]}</p>
            <div className="precheck-modal__limits">
              <ul>
                <li>Limite do padrão atual: {limiteAtualLabel ? `${limiteAtualLabel} kW` : '—'}</li>
                {upgradeLabel && limiteUpgradeLabel ? (
                  <li>
                    Upgrade sugerido: {upgradeLabel} (até {limiteUpgradeLabel} kW)
                  </li>
                ) : (
                  <li>Sem upgrade sugerido para este caso.</li>
                )}
              </ul>
            </div>
            {isFora ? (
              <label className="precheck-modal__ack">
                <input
                  type="checkbox"
                  checked={precheckModalClienteCiente}
                  onChange={(event) => setPrecheckModalClienteCiente(event.target.checked)}
                />
                <span>
                  Cliente ciente. A SolarInvest seguirá com a proposta, e o cliente se compromete a adequar o
                  padrão junto à distribuidora.
                </span>
              </label>
            ) : null}
            {isLimitado ? (
              <p className="muted">Este cenário exige ajuste antes de gerar a proposta.</p>
            ) : null}
            {isWarning ? (
              <p className="muted">Você pode continuar, mas recomendamos confirmar a regra com a distribuidora.</p>
            ) : null}
          </div>
          <div className="modal-actions precheck-modal__actions">
            {canAdjustCurrent ? (
              <button
                type="button"
                className="primary"
                onClick={() =>
                  resolvePrecheckDecision({ action: 'adjust_current', clienteCiente: precheckModalClienteCiente })
                }
              >
                Ajustar para {limiteAtualLabel} kW
              </button>
            ) : null}
            {canAdjustUpgrade ? (
              <button
                type="button"
                className="primary"
                onClick={() =>
                  resolvePrecheckDecision({ action: 'adjust_upgrade', clienteCiente: precheckModalClienteCiente })
                }
              >
                Upgrade para {upgradeLabel} ({limiteUpgradeLabel} kW)
              </button>
            ) : null}
            {isFora ? (
              <button
                type="button"
                className="ghost"
                disabled={!precheckModalClienteCiente}
                title={
                  precheckModalClienteCiente
                    ? undefined
                    : 'Marque cliente ciente para continuar sem ajuste'
                }
                onClick={() =>
                  resolvePrecheckDecision({ action: 'proceed', clienteCiente: precheckModalClienteCiente })
                }
              >
                Gerar sem ajuste
              </button>
            ) : null}
            <button
              type="button"
              className="ghost"
              onClick={() => resolvePrecheckDecision({ action: 'cancel', clienteCiente: false })}
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    )
  }

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
          <div className="mt-2 flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">
              Taxa mínima ({tipoRedeLabel})
            </label>
            <Switch
              checked={vendaForm.aplica_taxa_minima ?? true}
              onCheckedChange={(value) => applyVendaUpdates({ aplica_taxa_minima: value })}
            />
            <span className="text-xs text-gray-500">
              {vendaForm.aplica_taxa_minima ?? true
                ? 'Cliente paga taxa mínima (padrão)'
                : 'Cliente isento de taxa mínima'}
            </span>
          </div>
        </Field>
        <Field
          label={labelWithTooltip(
            'Tarifa cheia (R$/kWh)',
            'Valor cobrado por kWh sem descontos contratuais; base para calcular a conta de energia projetada.',
          )}
        >
          <input
            type="text"
            inputMode="decimal"
            value={tarifaCheiaVendaField.value}
            onChange={tarifaCheiaVendaField.onChange}
            onFocus={tarifaCheiaVendaField.onFocus}
            onBlur={tarifaCheiaVendaField.onBlur}
            onKeyDown={tarifaCheiaVendaField.onKeyDown}
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
          <select value={ufTarifa} onChange={(event) => handleParametrosUfChange(event.target.value)}>
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
            onChange={(event) => handleParametrosDistribuidoraChange(event.target.value)}
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
    <section className="card configuracao-usina-card">
      <div className="configuracao-usina-card__header">
        <h2>Configuração da UF</h2>
        <button
          type="button"
          className="configuracao-usina-card__toggle"
          aria-expanded={configuracaoUsinaObservacoesExpanded}
          aria-controls={configuracaoUsinaObservacoesVendaContainerId}
          onClick={() =>
            setConfiguracaoUsinaObservacoesExpanded((previous) => !previous)
          }
        >
          {configuracaoUsinaObservacoesExpanded
            ? 'Ocultar observações'
            : configuracaoUsinaObservacoes.trim()
            ? 'Editar observações'
            : 'Adicionar observações'}
        </button>
      </div>
      <div
        id={configuracaoUsinaObservacoesVendaContainerId}
        className="configuracao-usina-card__observacoes"
        hidden={!configuracaoUsinaObservacoesExpanded}
      >
        <label className="configuracao-usina-card__observacoes-label" htmlFor={configuracaoUsinaObservacoesVendaId}>
          Observações
        </label>
        <textarea
          id={configuracaoUsinaObservacoesVendaId}
          value={configuracaoUsinaObservacoes}
          onChange={(event) => setConfiguracaoUsinaObservacoes(event.target.value)}
          placeholder="Inclua observações relevantes sobre a configuração da usina"
          rows={3}
        />
      </div>
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
            'Tipo de instalação',
            'Selecione entre Telhado de fibrocimento, Telhas metálicas, Telhas cerâmicas, Laje, Solo ou Outros (texto); a escolha impacta área estimada e custos de estrutura.',
          )}
        >
          <select
            value={tipoInstalacao}
            onChange={(event) =>
              handleTipoInstalacaoChange(event.target.value as TipoInstalacao)
            }
          >
            {TIPOS_INSTALACAO.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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
            label={labelWithTooltip(
              'Tipo de rede',
              'Seleciona a rede do cliente para calcular o custo de disponibilidade (CID) padrão de 30/50/100 kWh e somá-lo às tarifas quando a taxa mínima estiver ativa.',
            )}
          >
            <select
              value={tipoRede}
              onChange={(event) => handleTipoRedeSelection(event.target.value as TipoRede)}
            >
              {TIPOS_REDE.map((rede) => (
                <option key={rede.value} value={rede.value}>
                  {rede.label}
                </option>
            ))}
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
            type="number"
            min={0}
            step="0.01"
            value={
              potenciaFonteManual
                ? vendaForm.potencia_instalada_kwp ?? ''
                : potenciaInstaladaKwp || ''
            }
            onChange={(event) => handlePotenciaInstaladaChange(event.target.value)}
            onFocus={selectNumberInputOnFocus}
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
      {tipoRedeCompatMessage ? (
        <div className="warning rede-compat-warning" role="alert">
          <strong>Incompatibilidade entre potência e rede.</strong> {tipoRedeCompatMessage}
        </div>
      ) : null}
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
      void abrirConfiguracoes('vendas')
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
                onFocus={(event) => {
                  descontosMoneyField.handleFocus(event)
                  selectNumberInputOnFocus(event)
                }}
                placeholder={MONEY_INPUT_PLACEHOLDER}
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
                onFocus={(event) => {
                  capexBaseResumoField.handleFocus(event)
                  selectNumberInputOnFocus(event)
                }}
                placeholder={
                  typeof capexBaseManualValor === 'number'
                    ? MONEY_INPUT_PLACEHOLDER
                    : 'Automático (calculado)'
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
                onFocus={(event) => {
                  margemOperacionalResumoField.handleFocus(event)
                  selectNumberInputOnFocus(event)
                }}
                placeholder={
                  margemManualAtiva ? MONEY_INPUT_PLACEHOLDER : 'Automático (padrão)'
                }
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

    const isTelhado = tipoInstalacao !== 'solo'
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
                    <label className="inline-checkbox flex items-center gap-2">
                      <CheckboxSmall
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
                      onFocus={(event) => {
                        capexBaseResumoSettingsField.handleFocus(event)
                        selectNumberInputOnFocus(event)
                      }}
                      placeholder={
                        typeof capexBaseManualValor === 'number'
                          ? MONEY_INPUT_PLACEHOLDER
                          : 'Automático (calculado)'
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
                      onFocus={(event) => {
                        margemOperacionalResumoSettingsField.handleFocus(event)
                        selectNumberInputOnFocus(event)
                      }}
                      placeholder={
                        margemManualAtiva ? MONEY_INPUT_PLACEHOLDER : 'Automático (padrão)'
                      }
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
                    <label className="inline-checkbox flex items-center gap-2">
                      <CheckboxSmall
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
                  <label className="inline-checkbox flex items-center gap-2">
                    <CheckboxSmall
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
                <label className="inline-checkbox flex items-center gap-2">
                  <CheckboxSmall
                    checked={vendasConfig.exibir_precos_unitarios}
                    onChange={(event) =>
                      updateVendasConfig({ exibir_precos_unitarios: event.target.checked })
                    }
                  />
                  <span>Mostrar valores unitários dos itens na proposta.</span>
                </label>
              </Field>
              <Field label="Exibir margem">
                <label className="inline-checkbox flex items-center gap-2">
                  <CheckboxSmall
                    checked={vendasConfig.exibir_margem}
                    onChange={(event) => updateVendasConfig({ exibir_margem: event.target.checked })}
                  />
                  <span>Mostrar margem operacional no PDF.</span>
                </label>
              </Field>
              <Field label="Exibir comissão">
                <label className="inline-checkbox flex items-center gap-2">
                  <CheckboxSmall
                    checked={vendasConfig.exibir_comissao}
                    onChange={(event) => updateVendasConfig({ exibir_comissao: event.target.checked })}
                  />
                  <span>Exibir comissão líquida para o cliente.</span>
                </label>
              </Field>
              <Field label="Exibir impostos">
                <label className="inline-checkbox flex items-center gap-2">
                  <CheckboxSmall
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
    const condicaoInfo = getPagamentoCondicaoInfo(condicao)
    const modoInfo =
      condicao === 'AVISTA'
        ? getPagamentoModoInfo(vendaForm.modo_pagamento ?? 'PIX')
        : null
    const pagamentoCardTitle =
      condicao === 'AVISTA' && modoInfo
        ? modoInfo.label
        : condicaoInfo?.label ?? 'Modalidade de pagamento'
    const pagamentoCardSummary =
      condicao === 'AVISTA' && modoInfo ? modoInfo.summary : condicaoInfo?.summary ?? ''
    const pagamentoCardHighlights =
      condicao === 'AVISTA' && modoInfo
        ? modoInfo.highlights
        : condicaoInfo?.highlights ?? []
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
              <option value="AVISTA">{PAGAMENTO_CONDICAO_INFO.AVISTA.label}</option>
              <option value="PARCELADO">{PAGAMENTO_CONDICAO_INFO.PARCELADO.label}</option>
              <option value="BOLETO">{PAGAMENTO_CONDICAO_INFO.BOLETO.label}</option>
              <option value="DEBITO_AUTOMATICO">{PAGAMENTO_CONDICAO_INFO.DEBITO_AUTOMATICO.label}</option>
              <option value="FINANCIAMENTO">{PAGAMENTO_CONDICAO_INFO.FINANCIAMENTO.label}</option>
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
              onFocus={(event) => {
                capexMoneyField.handleFocus(event)
                selectNumberInputOnFocus(event)
              }}
              placeholder={MONEY_INPUT_PLACEHOLDER}
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
        {pagamentoCardSummary || pagamentoCardHighlights.length > 0 ? (
          <div className="payment-highlight-card">
            {condicaoInfo ? (
              <span className="payment-highlight-card__badge">{condicaoInfo.label}</span>
            ) : null}
            <strong className="payment-highlight-card__title">{pagamentoCardTitle}</strong>
            {pagamentoCardSummary ? (
              <p className="payment-highlight-card__summary">{pagamentoCardSummary}</p>
            ) : null}
            {pagamentoCardHighlights.length > 0 ? (
              <ul className="payment-highlight-card__list">
                {pagamentoCardHighlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {condicao === 'AVISTA' ? (
          <div className="grid g3">
            <Field
              label={labelWithTooltip(
                'Modo de pagamento',
                'Define o meio de pagamento à vista e ajusta as taxas de MDR quando aplicável.',
              )}
            >
              <select
                value={vendaForm.modo_pagamento ?? 'PIX'}
                onChange={(event) => applyVendaUpdates({ modo_pagamento: event.target.value as ModoPagamento })}
              >
                <option value="PIX">{PAGAMENTO_MODO_INFO.PIX.label}</option>
                <option value="DEBITO">{PAGAMENTO_MODO_INFO.DEBITO.label}</option>
                <option value="CREDITO">{PAGAMENTO_MODO_INFO.CREDITO.label}</option>
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
        {condicao === 'BOLETO' ? (
          <div className="grid g3">
            <Field
              label={labelWithTooltip(
                'Nº de boletos',
                'Quantidade de boletos emitidos. O valor total da proposta é dividido igualmente entre eles.',
              )}
            >
              <input
                type="number"
                min={1}
                step={1}
                value={Number.isFinite(vendaForm.n_boletos) ? vendaForm.n_boletos : ''}
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ n_boletos: undefined })
                    return
                  }
                  const parsed = Number(value)
                  const normalized = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1
                  applyVendaUpdates({ n_boletos: normalized })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.n_boletos} />
            </Field>
          </div>
        ) : null}
        {condicao === 'DEBITO_AUTOMATICO' ? (
          <div className="grid g3">
            <Field
              label={labelWithTooltip(
                'Duração do débito automático (meses)',
                'Quantidade de meses com débito recorrente em conta. O valor total é dividido igualmente entre os débitos.',
              )}
            >
              <input
                type="number"
                min={1}
                step={1}
                value={Number.isFinite(vendaForm.n_debitos) ? vendaForm.n_debitos : ''}
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    applyVendaUpdates({ n_debitos: undefined })
                    return
                  }
                  const parsed = Number(value)
                  const normalized = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1
                  applyVendaUpdates({ n_debitos: normalized })
                }}
                onFocus={selectNumberInputOnFocus}
              />
              <FieldError message={vendaFormErrors.n_debitos} />
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
      { label: 'ROI acumulado (30 anos): ', value: roiLabel },
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
              <span>Payback estimado: </span>
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
          <h2>Retorno Financeiro</h2>
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

  const leasingBuyoutSection = (
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
                    <td>{row.valorResidual == null ? '' : currency(row.valorResidual)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )

  const leasingChartSection = mostrarGrafico ? (
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
  ) : null

  const handleSidebarMenuToggle = useCallback(() => {
    if (isMobileViewport) {
      setIsSidebarMobileOpen((previous) => {
        const next = !previous
        if (next) {
          setIsSidebarCollapsed(false)
        }
        return next
      })
      return
    }

    setIsSidebarCollapsed((previous) => !previous)
  }, [isMobileViewport])

  const handleSidebarNavigate = useCallback(() => {
    if (isMobileViewport) {
      setIsSidebarMobileOpen(false)
    }
  }, [isMobileViewport])

  const handleSidebarClose = useCallback(() => {
    setIsSidebarMobileOpen(false)
  }, [])

  const crmPageActions = (
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
  )

  const renderDashboardPage = () => {
    const leadsAtivos = Math.max(0, crmKpis.totalLeads - crmKpis.leadsFechados)
    const receitaProjetadaLeasing = crmFinanceiroResumo.previsaoLeasing
    const receitaProjetadaVendas = crmFinanceiroResumo.previsaoVendas
    const proximasVisitas = crmPosVendaResumo.proximas.slice(0, 3)
    const alertasCriticos = crmPosVendaResumo.alertasCriticos.slice(0, 2)
    const chamadosRecentes = crmPosVendaResumo.chamadosRecentes.slice(0, 4)
    const margensDestaque = crmFinanceiroResumo.margens.slice(0, 4)

    const formatLeadNome = (leadId: string) => {
      const lead = crmDataset.leads.find((item) => item.id === leadId)
      return lead?.nome ?? 'Lead não identificado'
    }

    return (
      <div className="dashboard-page">
        <section className="card dashboard-panel dashboard-kpi-card">
          <div className="card-header">
            <h2>Resumo geral</h2>
            <p>Indicadores consolidados de propostas, CRM e finanças da SolarInvest.</p>
          </div>
          <div className="kpi-grid dashboard-kpis">
            <div className="kpi">
              <span>Leads ativos</span>
              <strong>{formatNumberBRWithOptions(leadsAtivos, { maximumFractionDigits: 0 })}</strong>
            </div>
            <div className="kpi">
              <span>Leads fechados</span>
              <strong>{formatNumberBRWithOptions(crmKpis.leadsFechados, { maximumFractionDigits: 0 })}</strong>
            </div>
            <div className="kpi">
              <span>Orçamentos salvos</span>
              <strong>{formatNumberBRWithOptions(totalOrcamentos, { maximumFractionDigits: 0 })}</strong>
            </div>
            <div className="kpi kpi-highlight">
              <span>Saldo em caixa</span>
              <strong>{currency(crmFinanceiroResumo.saldo)}</strong>
            </div>
            <div className="kpi">
              <span>Receita recorrente (leasing)</span>
              <strong>{currency(receitaProjetadaLeasing)}</strong>
            </div>
            <div className="kpi">
              <span>Receita pontual (vendas)</span>
              <strong>{currency(receitaProjetadaVendas)}</strong>
            </div>
          </div>
        </section>

        <div className="dashboard-panels">
          <section className="card dashboard-panel">
            <div className="card-header">
              <h3>Próximas manutenções</h3>
              <p>Visitas técnicas e acompanhamentos previstos para os próximos dias.</p>
            </div>
            <ul className="dashboard-list">
              {proximasVisitas.length > 0 ? (
                proximasVisitas.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{formatarDataCurta(item.dataIso)}</strong>
                      <span>{item.tipo}</span>
                    </div>
                    <span className="dashboard-list-subtitle">{formatLeadNome(item.leadId)}</span>
                  </li>
                ))
              ) : (
                <li className="dashboard-empty">Nenhuma manutenção pendente.</li>
              )}
            </ul>
            {alertasCriticos.length > 0 ? (
              <div className="dashboard-alerts" role="status">
                {alertasCriticos.map((alerta, index) => (
                  <span key={index}>{alerta}</span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="card dashboard-panel">
            <div className="card-header">
              <h3>Atividades recentes</h3>
              <p>Últimas anotações registradas pela equipe comercial.</p>
            </div>
            <ul className="dashboard-list">
              {chamadosRecentes.length > 0 ? (
                chamadosRecentes.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.dataFormatada}</strong>
                      <span>{item.mensagem}</span>
                    </div>
                    <span className="dashboard-list-subtitle">{formatLeadNome(item.leadId)}</span>
                  </li>
                ))
              ) : (
                <li className="dashboard-empty">Nenhuma atividade registrada nesta semana.</li>
              )}
            </ul>
          </section>
        </div>

        <section className="card dashboard-panel">
          <div className="card-header">
            <h3>Indicadores financeiros</h3>
            <p>Visão rápida do fluxo de caixa e contratos acompanhados.</p>
          </div>
          <dl className="dashboard-metrics">
            <div>
              <dt>Entradas acumuladas</dt>
              <dd>{currency(crmFinanceiroResumo.entradas)}</dd>
            </div>
            <div>
              <dt>Saídas acumuladas</dt>
              <dd>{currency(crmFinanceiroResumo.saidas)}</dd>
            </div>
            <div>
              <dt>Contratos ativos</dt>
              <dd>{formatNumberBRWithOptions(crmFinanceiroResumo.contratosAtivos, { maximumFractionDigits: 0 })}</dd>
            </div>
            <div>
              <dt>Contratos inadimplentes</dt>
              <dd>{formatNumberBRWithOptions(crmFinanceiroResumo.inadimplentes, { maximumFractionDigits: 0 })}</dd>
            </div>
          </dl>
        </section>

        <section className="card dashboard-panel">
          <div className="card-header">
            <h3>Margens por cliente</h3>
            <p>Projetos com maior potencial de retorno financeiro.</p>
          </div>
          <div className="dashboard-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Modelo</th>
                  <th scope="col">Margem</th>
                  <th scope="col">ROI</th>
                </tr>
              </thead>
              <tbody>
                {margensDestaque.length > 0 ? (
                  margensDestaque.map((item) => (
                    <tr key={item.leadId}>
                      <td>{formatLeadNome(item.leadId)}</td>
                      <td>{item.modelo === 'LEASING' ? 'Leasing' : 'Venda direta'}</td>
                      <td>{currency(item.margemBruta)}</td>
                      <td>
                        {typeof item.roi === 'number'
                          ? `${formatNumberBRWithOptions(item.roi * 100, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 1,
                            })}%`
                          : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="dashboard-empty" colSpan={4}>
                      Nenhuma margem calculada até o momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )
  }

  const contentActions = activePage === 'crm' ? crmPageActions : null
  const contentSubtitle =
    activePage === 'dashboard'
      ? undefined
      : activePage === 'crm'
        ? 'CRM Gestão de Relacionamento e Operações'
        : activePage === 'consultar'
          ? 'Consulta de orçamentos salvos'
          : activePage === 'clientes'
            ? 'Gestão de clientes salvos'
            : activePage === 'simulacoes'
              ? 'Simulações financeiras, risco e aprovação interna'
              : activePage === 'settings'
                ? 'Preferências e integrações da proposta'
                : undefined
  const currentPageIndicator =
    activePage === 'dashboard'
      ? 'Dashboard'
      : activePage === 'crm'
        ? 'Central CRM'
        : activePage === 'consultar'
          ? 'Consultar'
          : activePage === 'clientes'
            ? 'Clientes'
            : activePage === 'simulacoes'
              ? 'Simulações'
              : activePage === 'settings'
                ? 'Configurações'
                : activeTab === 'vendas'
                  ? 'Vendas'
                  : 'Leasing'
  const topbarSubtitle = contentSubtitle

  const sidebarGroups: SidebarGroup[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      items: [
        {
          id: 'dashboard-home',
          label: 'Dashboard',
          icon: '📊',
          onSelect: () => {
            void abrirDashboard()
          },
        },
      ],
    },
    {
      id: 'propostas',
      label: 'Propostas',
      items: [
        {
          id: 'propostas-leasing',
          label: 'Leasing',
          icon: '📝',
          onSelect: () => {
            setActivePage('app')
            setActiveTab('leasing')
          },
        },
        {
          id: 'propostas-vendas',
          label: 'Vendas',
          icon: '🧾',
          onSelect: () => {
            setActivePage('app')
            setActiveTab('vendas')
          },
        },
        {
          id: 'propostas-nova',
          label: 'Nova proposta',
          icon: '✨',
          onSelect: () => {
            setActivePage('app')
            handleNovaProposta()
          },
        },
        {
          id: 'propostas-salvar',
          label: salvandoPropostaPdf ? 'Salvando…' : 'Salvar proposta',
          icon: '💾',
          onSelect: () => {
            setActivePage('app')
            handleSalvarPropostaPdf()
          },
          disabled: !podeSalvarProposta || salvandoPropostaPdf,
          title: !proposalPdfIntegrationAvailable
            ? 'Configure a integração de PDF para salvar o arquivo automaticamente.'
            : undefined,
        },
        {
          id: 'propostas-contratos',
          label: gerandoContratos ? 'Gerando…' : 'Gerar contratos',
          icon: '🖋️',
          onSelect: () => {
            void handleGerarContratosComConfirmacao()
          },
          disabled: gerandoContratos,
        },
        {
          id: 'propostas-imagens',
          label: 'Incluir imagens',
          icon: '🖼️',
          onSelect: () => {
            setActivePage('app')
            handleAbrirUploadImagens()
          },
        },
        {
          id: 'propostas-enviar',
          label: 'Enviar proposta',
          icon: '📨',
          onSelect: () => {
            abrirEnvioPropostaModal()
          },
          disabled: contatosEnvio.length === 0,
          title:
            contatosEnvio.length === 0
              ? 'Cadastre um cliente ou lead com telefone para compartilhar a proposta.'
              : undefined,
        },
      ],
    },
    {
      id: 'simulacoes',
      label: 'Simulações',
      items: [
        {
          id: 'simulacoes-nova',
          label: 'Nova Simulação',
          icon: '🧮',
          onSelect: () => {
            void abrirSimulacoes('nova')
          },
        },
        {
          id: 'simulacoes-salvas',
          label: 'Simulações Salvas',
          icon: '💾',
          onSelect: () => {
            void abrirSimulacoes('salvas')
          },
        },
        {
          id: 'simulacoes-ia',
          label: 'Análises IA (AI Analytics)',
          icon: '🤖',
          onSelect: () => {
            void abrirSimulacoes('ia')
          },
        },
        {
          id: 'simulacoes-risco',
          label: 'Risco & Monte Carlo',
          icon: '🎲',
          onSelect: () => {
            void abrirSimulacoes('risco')
          },
        },
        {
          id: 'simulacoes-packs',
          label: 'Packs',
          icon: '📦',
          onSelect: () => {
            void abrirSimulacoes('packs')
          },
        },
        {
          id: 'simulacoes-packs-inteligentes',
          label: 'Packs Inteligentes',
          icon: '🧠',
          onSelect: () => {
            void abrirSimulacoes('packs-inteligentes')
          },
        },
        {
          id: 'simulacoes-analise',
          label: 'Análise Financeira & Aprovação',
          icon: '✅',
          onSelect: () => {
            void abrirSimulacoes('analise')
          },
        },
      ],
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      items: [
        {
          id: 'relatorios-pdfs',
          label: 'Ver propostas',
          icon: '📂',
          onSelect: () => {
            void abrirPesquisaOrcamentos()
          },
        },
        {
          id: 'relatorios-exportacoes',
          label: 'Exportações',
          icon: '📤',
          onSelect: () => {
            setActivePage('app')
          },
        },
        {
          id: 'relatorios-exportar-pdf',
          label: 'Gerar proposta',
          icon: '🖨️',
          onSelect: () => {
            setActivePage('app')
            void handlePrint()
          },
        },
      ],
    },
    {
      id: 'orcamentos',
      label: 'Orçamentos',
      items: [
        {
          id: 'orcamentos-importar',
          label: 'Consultar',
          icon: '📄',
          onSelect: () => {
            void abrirPesquisaOrcamentos()
          },
        },
      ],
    },
    {
      id: 'crm',
      label: 'CRM',
      items: [
        {
          id: 'crm-central',
          label: 'Central CRM',
          icon: '📇',
          onSelect: () => {
            void abrirCrmCentral()
          },
        },
        {
          id: 'crm-clientes',
          label: 'Clientes salvos',
          icon: '👥',
          onSelect: () => {
            void abrirClientesPainel()
          },
        },
        {
          id: 'crm-operacoes',
          label: 'Operações',
          icon: '🗂️',
          items: [
            {
              id: 'crm-captura',
              label: 'Captura de leads',
              icon: '🛰️',
              onSelect: () => {
                void abrirCrmCentral()
              },
            },
            {
              id: 'crm-pos-venda',
              label: 'Pós-venda',
              icon: '🤝',
              onSelect: () => {
                void abrirCrmCentral()
              },
            },
          ],
        },
      ],
    },
    {
      id: 'configuracoes',
      label: 'Configurações',
      items: [
        {
          id: 'config-preferencias',
          label: 'Preferências',
          icon: '⚙️',
          onSelect: () => {
            void abrirConfiguracoes()
          },
        },
      ],
    },
  ]

  const renderBudgetSearchPage = () => (
    <div className="budget-search-page">
      <div className="budget-search-page-header">
        <div>
          <h2>Consultar orçamentos</h2>
          <p>
            Localize propostas salvas pelo cliente, documento, unidade consumidora ou código do orçamento e carregue-as
            novamente na proposta.
          </p>
        </div>
        <button type="button" className="ghost" onClick={fecharPesquisaOrcamentos}>
          Voltar
        </button>
      </div>
      <div className="budget-search-panels">
        <section className="budget-search-panel">
          <div className="budget-search-header">
            <h4>Consulta rápida</h4>
            <p>Busque pelo cliente, código interno, CPF/CNPJ ou unidade consumidora.</p>
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
            <p className="budget-search-empty">Nenhum orçamento foi salvo ainda. Gere uma proposta para começar.</p>
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
                      const registroIdPadronizado = normalizeProposalId(registro.id) || registro.id
                      const cidadeUf = [cidade, uf].filter(Boolean).join(' / ')
                      return (
                        <tr
                          key={registro.id}
                          className={
                            orcamentoVisualizadoInfo?.id === registroIdPadronizado ? 'is-selected' : undefined
                          }
                        >
                          <td>
                            <button
                              type="button"
                              className="budget-search-code"
                              onClick={() => carregarOrcamentoSalvo(registro)}
                              title="Visualizar orçamento salvo"
                            >
                              {registro.id}
                            </button>
                          </td>
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
                                onClick={() => carregarOrcamentoSalvo(registro)}
                                aria-label="Carregar orçamento salvo"
                                title="Carregar orçamento"
                              >
                                📂
                              </button>
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
      {orcamentoVisualizado ? (
        <section className="budget-search-panel budget-search-viewer">
          <div className="budget-search-header">
            <h4>
              Visualizando orçamento <strong>{orcamentoVisualizadoInfo?.id ?? '—'}</strong>
            </h4>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setOrcamentoVisualizado(null)
                setOrcamentoVisualizadoInfo(null)
              }}
            >
              Fechar visualização
            </button>
          </div>
          <p className="budget-viewer-subtitle">
            Dados somente leitura para {orcamentoVisualizadoInfo?.cliente ?? 'o cliente selecionado'}.
          </p>
          <div className="budget-viewer-body">
            <React.Suspense fallback={<p className="budget-search-empty">Carregando orçamento selecionado…</p>}>
              <div className="budget-viewer-content">
                <PrintableProposal {...orcamentoVisualizado} />
              </div>
            </React.Suspense>
          </div>
        </section>
      ) : null}
    </div>
  )

  const renderSimulacoesPage = () => {
    const formatAprovacaoData = (timestamp: number | null) => {
      if (!timestamp) {
        return '—'
      }
      try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
          new Date(timestamp),
        )
      } catch (error) {
        return '—'
      }
    }

    const sectionCopy = SIMULACOES_SECTION_COPY[simulacoesSection]

    return (
      <div className="simulacoes-page">
        <div className="simulacoes-hero-card">
          <div>
            <p className="simulacoes-tag">Módulo dedicado</p>
            <h2>Simulações &amp; análise financeira</h2>
            <p>{sectionCopy}</p>
          </div>
          <div className="simulacoes-hero-actions">
            <span className={`simulacoes-status status-${aprovacaoStatus}`}>{APROVACAO_SELLOS[aprovacaoStatus]}</span>
            <small>Última decisão: {formatAprovacaoData(ultimaDecisaoTimestamp)}</small>
            <div className="simulacoes-hero-buttons">
              <button type="button" className="primary" onClick={() => registrarDecisaoInterna('aprovado')}>
                Aprovar
              </button>
              <button type="button" className="secondary" onClick={() => registrarDecisaoInterna('reprovado')}>
                Reprovar
              </button>
            </div>
          </div>
        </div>

        <nav className="simulacoes-nav" aria-label="Navegação do módulo de simulações">
          {SIMULACOES_MENU.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`simulacoes-nav-btn${simulacoesSection === item.id ? ' is-active' : ''}`}
              onClick={() => void abrirSimulacoes(item.id)}
              aria-current={simulacoesSection === item.id ? 'page' : undefined}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </nav>

        <div className="simulacoes-panels">
          <section
            className="simulacoes-main-card"
            hidden={!isSimulacoesWorkspaceActive}
            aria-hidden={!isSimulacoesWorkspaceActive}
            style={{ display: isSimulacoesWorkspaceActive ? 'flex' : 'none' }}
          >
            <header>
              <div>
                <p className="simulacoes-tag ghost">Workspace</p>
                <h3>{simulacoesSection === 'nova' ? 'Nova simulação' : 'Simulações salvas'}</h3>
                <p className="simulacoes-description">
                  Layout full-width para criação, comparação e duplicação de cenários com Monte Carlo e IA na mesma
                  área.
                </p>
              </div>
            </header>
            <SimulacoesTab
              consumoKwhMes={kcKwhMes}
              valorInvestimento={capex}
              tipoSistema={tipoSistema}
              prazoLeasingAnos={leasingPrazo}
            />
          </section>

          {simulacoesSection === 'ia' ? (
            <section className="simulacoes-module-card">
              <header>
                <h3>Análises IA</h3>
                <p>Insights automáticos, recomendações de desconto e priorização de cenários sensíveis.</p>
              </header>
              <div className="simulacoes-module-grid">
                <div className="simulacoes-module-tile">
                  <h4>KPIs monitorados</h4>
                  <ul>
                    <li>ROI, TIR e payback revisados continuamente.</li>
                    <li>Alertas de margem mínima e spread solar.</li>
                    <li>Clustering de consumo por perfil residencial ou empresarial.</li>
                  </ul>
                </div>
                <div className="simulacoes-module-tile">
                  <h4>Recomendações</h4>
                  <ul>
                    <li>Descontos ótimos por distribuidora e bandeira.</li>
                    <li>Revisão automática de TUSD e capex.</li>
                    <li>Geração de sugestões para Packs Inteligentes.</li>
                  </ul>
                </div>
                <div className="simulacoes-module-tile">
                  <h4>Exportação</h4>
                  <ul>
                    <li>Resumo IA preparado para PDF interno e externo.</li>
                    <li>Trilha de recomendações com timestamp.</li>
                    <li>Integração com painel de aprovação.</li>
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {simulacoesSection === 'risco' ? (
            <section className="simulacoes-module-card">
              <header>
                <h3>Risco &amp; Monte Carlo</h3>
                <p>Simulações de risco em tela cheia, cobrindo volatilidade tarifária e performance energética.</p>
              </header>
              <div className="simulacoes-module-grid">
                <div className="simulacoes-module-tile">
                  <h4>Entradas</h4>
                  <ul>
                    <li>Inflação energética, TUSD e consumo ajustável.</li>
                    <li>Distribuições customizadas para cenários pessimista e otimista.</li>
                    <li>Capex SolarInvest com seguro e encargo embutidos.</li>
                  </ul>
                </div>
                <div className="simulacoes-module-tile">
                  <h4>Saídas</h4>
                  <ul>
                    <li>Faixas de VPL e ROI com IC 95%.</li>
                    <li>Mapa de sensibilidade full-width.</li>
                    <li>Exportação rápida para análise interna.</li>
                  </ul>
                </div>
                <div className="simulacoes-module-tile">
                  <h4>Operação</h4>
                  <ul>
                    <li>Rodadas paralelas para cada cenário salvo.</li>
                    <li>Integração com IA para detectar outliers.</li>
                    <li>Pronto para aprovação interna no próximo passo.</li>
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {simulacoesSection === 'packs' ? (
            <section className="simulacoes-module-card">
              <header>
                <h3>Packs</h3>
                <p>Biblioteca de pacotes comerciais agrupando kits, composições e propostas aprovadas.</p>
              </header>
              <div className="simulacoes-module-grid">
                <div className="simulacoes-module-tile">
                  <h4>Organização</h4>
                  <ul>
                    <li>Separação por segmento (residencial, comercial, rural).</li>
                    <li>Padrões de desconto e prazo salvos.</li>
                    <li>Tags rápidas para buscas no CRM.</li>
                  </ul>
                </div>
                <div className="simulacoes-module-tile">
                  <h4>Aplicação</h4>
                  <ul>
                    <li>Aplicar pack diretamente no workspace.</li>
                    <li>Duplicar e adaptar valores de mercado.</li>
                    <li>Conectar com proposta PDF em um clique.</li>
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {simulacoesSection === 'packs-inteligentes' ? (
            <section className="simulacoes-module-card">
              <header>
                <h3>Packs Inteligentes</h3>
                <p>Fluxos automatizados com IA, definindo upgrades de forma preditiva.</p>
              </header>
              <div className="simulacoes-module-grid">
                <div className="simulacoes-module-tile">
                  <h4>Automação</h4>
                  <ul>
                    <li>Regras por ROI mínimo e VPL alvo.</li>
                    <li>Ajuste automático de potência e seguros.</li>
                    <li>Alertas quando o pack sai da faixa aprovada.</li>
                  </ul>
                </div>
                <div className="simulacoes-module-tile">
                  <h4>IA Assistida</h4>
                  <ul>
                    <li>Sugere combinações de módulos e inversores.</li>
                    <li>Reaproveita simulações vencedoras.</li>
                    <li>Cria versões para teste A/B com clientes.</li>
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {simulacoesSection === 'analise' ? (
            <section className="simulacoes-module-card">
              <header>
                <h3>Análise Financeira &amp; Aprovação</h3>
                <p>Checklist interno SolarInvest com selo de aprovação e registro de decisão.</p>
              </header>
              <div className="simulacoes-approval-grid">
                <div className="simulacoes-module-tile">
                  <h4>Checklist</h4>
                  <ul className="simulacoes-checklist">
                    {(['roi', 'tir', 'spread', 'vpl'] as AprovacaoChecklistKey[]).map((item) => (
                      <li key={item}>
                        <label className="simulacoes-check">
                          <input
                            type="checkbox"
                            checked={aprovacaoChecklist[item]}
                            onChange={() => toggleAprovacaoChecklist(item)}
                          />
                          <span>
                            {item === 'roi'
                              ? 'ROI mínimo SolarInvest atendido'
                              : item === 'tir'
                                ? 'TIR acima do piso do comitê'
                                : item === 'spread'
                                  ? 'Spread e margem dentro do range'
                                  : 'VPL positivo no horizonte definido'}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="simulacoes-module-tile">
                  <h4>Selo e decisão</h4>
                  <p className={`simulacoes-status status-${aprovacaoStatus}`}>{APROVACAO_SELLOS[aprovacaoStatus]}</p>
                  <p className="simulacoes-description">
                    Última decisão registrada: {formatAprovacaoData(ultimaDecisaoTimestamp)}
                  </p>
                  <div className="simulacoes-hero-buttons">
                    <button type="button" className="primary" onClick={() => registrarDecisaoInterna('aprovado')}>
                      Aprovar
                    </button>
                    <button type="button" className="secondary" onClick={() => registrarDecisaoInterna('reprovado')}>
                      Reprovar
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => registrarDecisaoInterna(aprovacaoStatus)}
                    >
                      Salvar decisão
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    )
  }

  const renderSettingsPage = () => (
    <div className="settings-page">
      <div className="settings-page-header">
        <div>
          <h2>Preferências</h2>
          <p>Configure parâmetros de mercado e vendas para personalizar as propostas.</p>
        </div>
        <button type="button" className="ghost" onClick={voltarParaPaginaPrincipal}>
          Voltar
        </button>
      </div>
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
                  readOnly
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
                  {mostrarTabelaParcelasConfig
                    ? 'Ocultar tabela de parcelas (configurações)'
                    : 'Exibir tabela de parcelas (configurações)'}
                </button>
              </div>
              {mostrarTabelaParcelasConfig ? (
                <div className="table-wrapper">
                  <table id="config-parcelas-total">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Mensalidade projetada</th>
                        <th>TUSD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelasSolarInvest.lista.length > 0 ? (
                        parcelasSolarInvest.lista.map((row) => (
                          <tr key={`config-parcela-${row.mes}`}>
                            <td>{row.mes}</td>
                            <td>{currency(row.mensalidade)}</td>
                            <td>{currency(row.tusd)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="muted">
                            Defina um prazo contratual para visualizar a tabela configurável de parcelas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
            <div className="settings-subsection">
              <p className="settings-subheading">Financiamento</p>
              <div className="grid g3">
                <Field
                  label={labelWithTooltip(
                    'Juros anuais (%)',
                    'Taxa de juros anual aplicada na simulação de financiamento para comparação.',
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
                    'Prazo financiamento (meses)',
                    'Quantidade de meses considerados no cenário de financiamento.',
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
                          <td colSpan={2} className="muted">
                            Defina os parâmetros para visualizar a receita acumulada.
                          </td>
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
                    'Inflação O&M (%)',
                    'Reajuste anual do contrato de operação e manutenção.',
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
                    'Percentual anual de reajuste do seguro quando o modo percentual está ativo.',
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
                  <select value={density} onChange={(event) => setDensity(event.target.value as DensityMode)}>
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
                  <select
                    value={mostrarFinanciamento ? '1' : '0'}
                    onChange={(e) => setMostrarFinanciamento(e.target.value === '1')}
                  >
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
  )

  const renderClientesPage = () => (
    <ClientesPanel
      registros={clientesSalvos}
      onClose={fecharClientesPainel}
      onEditar={handleEditarCliente}
      onExcluir={handleExcluirCliente}
      onExportarCsv={handleExportarClientesCsv}
      onExportarJson={handleExportarClientesJson}
      onImportar={handleClientesImportarClick}
      isImportando={isImportandoClientes}
    />
  )

  const activeSidebarItem =
    activePage === 'dashboard'
      ? 'dashboard-home'
      : activePage === 'crm'
        ? 'crm-central'
        : activePage === 'clientes'
          ? 'crm-clientes'
          : activePage === 'consultar'
            ? 'orcamentos-importar'
            : activePage === 'settings'
              ? 'config-preferencias'
              : activePage === 'simulacoes'
                ? `simulacoes-${simulacoesSection}`
                : activeTab === 'vendas'
                  ? 'propostas-vendas'
                  : 'propostas-leasing'


  return (
    <>
      <AppRoutes>
        <AppShell
          topbar={{
            subtitle: topbarSubtitle,
          }}
          sidebar={{
            collapsed: isSidebarCollapsed,
            mobileOpen: isSidebarMobileOpen,
            groups: sidebarGroups,
            activeItemId: activeSidebarItem,
            onNavigate: handleSidebarNavigate,
            onCloseMobile: handleSidebarClose,
            onToggleCollapse: handleSidebarMenuToggle,
            menuButtonLabel: isMobileViewport
              ? isSidebarMobileOpen
                ? 'Fechar menu Painel SolarInvest'
                : 'Abrir menu Painel SolarInvest'
              : 'Painel SolarInvest',
            menuButtonExpanded: isMobileViewport ? isSidebarMobileOpen : !isSidebarCollapsed,
            menuButtonText: 'Painel SolarInvest',
          }}
          content={{
            subtitle: contentSubtitle,
            actions: contentActions ?? undefined,
            pageIndicator: currentPageIndicator,
          }}
          mobileMenuButton={
            isMobileViewport
              ? {
                  onToggle: handleSidebarMenuToggle,
                  label: isSidebarMobileOpen
                    ? 'Fechar menu Painel SolarInvest'
                    : 'Abrir menu Painel SolarInvest',
                  expanded: isSidebarMobileOpen,
                }
              : undefined
          }
        >
        <div className="printable-proposal-hidden" aria-hidden="true">
          <React.Suspense fallback={null}>
            <PrintableProposal ref={printableRef} {...printableData} />
          </React.Suspense>
        </div>
        {activePage === 'dashboard' ? (
          renderDashboardPage()
        ) : activePage === 'crm' ? (
          renderCrmPage()
        ) : activePage === 'consultar' ? (
          renderBudgetSearchPage()
        ) : activePage === 'clientes' ? (
          renderClientesPage()
        ) : activePage === 'simulacoes' ? (
          renderSimulacoesPage()
        ) : activePage === 'settings' ? (
          renderSettingsPage()
        ) : (
          <div className="page">
            <div className="app-main">
              <main className={`content page-content${activeTab === 'vendas' ? ' vendas' : ''}`}>
              {orcamentoAtivoInfo ? (
                <section className="card loaded-budget-viewer">
                  <div className="card-header loaded-budget-header">
                    <h2>
                      Editando orçamento <strong>{orcamentoAtivoInfo.id}</strong>
                    </h2>
                    <div className="loaded-budget-actions">
                      <span>
                        Cliente: <strong>{orcamentoAtivoInfo.cliente}</strong>
                      </span>
                      {(orcamentoRegistroBase ?? orcamentoDisponivelParaDuplicar)?.snapshot ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={duplicarOrcamentoAtual}
                        >
                          Duplicar
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="loaded-budget-subtitle">
                    As alterações realizadas abaixo serão mantidas até que você salve a proposta novamente.
                  </p>
                </section>
              ) : null}
              <div className="page-editable">
                <div ref={editableContentRef} className="page-editable-body">
                  {isVendaDiretaTab || orcamentoAtivoInfo ? (
                    <div className="page-actions">
                      {isVendaDiretaTab ? (
                        <button type="button" className="ghost" onClick={handleRecalcularVendas}>
                          Recalcular
                        </button>
                      ) : null}
                      {(orcamentoRegistroBase ?? orcamentoDisponivelParaDuplicar)?.snapshot ? (
                        <button
                          type="button"
                          className={`primary${activeTab === 'leasing' ? ' solid' : ''}`}
                          onClick={duplicarOrcamentoAtual}
                        >
                          Duplicar
                        </button>
                      ) : null}
                    </div>
                    ) : null}
                    {renderClienteDadosSection()}
                    {activeTab === 'vendas' ? (
                      <>
                        <section className="card">
                          <h2>Tipo de instalação e sistema</h2>
                          <div className="grid g2">
                            <Field label="Tipo de instalação">
                              <select
                                value={tipoInstalacao}
                                onChange={(event) =>
                                  handleTipoInstalacaoChange(event.target.value as TipoInstalacao)
                                }
                                aria-label="Selecionar tipo de instalação"
                              >
                                {TIPOS_INSTALACAO.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {tipoInstalacao === 'outros' ? (
                                <input
                                  type="text"
                                  placeholder="Descreva o tipo de instalação"
                                  value={tipoInstalacaoOutro || ''}
                                  onChange={(event) => setTipoInstalacaoOutro(event.target.value)}
                                  style={{ marginTop: '6px' }}
                                />
                              ) : null}
                            </Field>
                            <Field label="Tipo de sistema">
                              <div
                                className="toggle-group"
                                role="radiogroup"
                                aria-label="Selecionar tipo de sistema"
                              >
                                {TIPO_SISTEMA_VALUES.map((value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={tipoSistema === value}
                                    className={`toggle-option${
                                      tipoSistema === value ? ' active' : ''
                                    }`}
                                    onClick={() => handleTipoSistemaChange(value)}
                                  >
                                    {value === 'ON_GRID'
                                      ? 'On-grid'
                                      : value === 'HIBRIDO'
                                      ? 'Híbrido'
                                      : 'Off-grid'}
                                  </button>
                                ))}
                              </div>
                            </Field>
                          </div>
                          {isManualBudgetForced ? (
                            <p className="warning" role="alert">
                              {manualBudgetForceReason}
                            </p>
                          ) : null}
                        </section>
                        <section className="card">
                          <h2>Modo de orçamento</h2>
                          <div
                            className="toggle-group"
                            role="radiogroup"
                            aria-label="Selecionar modo de orçamento"
                          >
                            <button
                              type="button"
                              role="radio"
                              aria-checked={modoOrcamento === 'auto'}
                              aria-disabled={isManualBudgetForced}
                              disabled={isManualBudgetForced}
                              className={`toggle-option${modoOrcamento === 'auto' ? ' active' : ''}${
                                isManualBudgetForced ? ' disabled' : ''
                              }`}
                              onClick={() => handleModoOrcamentoChange('auto')}
                            >
                              Orçamento automático
                            </button>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={modoOrcamento === 'manual'}
                              className={`toggle-option${modoOrcamento === 'manual' ? ' active' : ''}`}
                              onClick={() => handleModoOrcamentoChange('manual')}
                            >
                              Orçamento manual
                            </button>
                          </div>
                          <p className="muted" role="status">
                            {isManualBudgetForced
                              ? manualBudgetForceReason
                              : modoOrcamento === 'auto'
                              ? 'Preencha poucos campos e o sistema calcula o orçamento.'
                              : 'Use o modo manual para valores personalizados.'}
                          </p>
                          {modoOrcamento === 'manual' && autoBudgetFallbackMessage ? (
                            <p className="warning" role="alert" style={{ marginTop: '8px' }}>
                              {autoBudgetFallbackMessage}
                            </p>
                          ) : null}
                        </section>
                      </>
                    ) : null}
                    {renderPropostaImagensSection()}
              {activeTab === 'leasing' ? (
                <>
                  {renderParametrosPrincipaisSection()}
                  {renderConfiguracaoUsinaSection()}
                  {renderLeasingContratoSection()}
                  <section className="card">
                    <div className="card-header">
                      <h2>SolarInvest Leasing</h2>
                      <div className="card-actions">
                        <button
                          type="button"
                          className="primary"
                          onClick={handleSalvarPropostaLeasing}
                          disabled={!podeSalvarProposta || salvandoPropostaLeasing}
                        >
                          {salvandoPropostaLeasing ? 'Salvando…' : 'Salvar proposta'}
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={handleSalvarPropostaLeasing}
                          disabled={salvandoPropostaLeasing}
                        >
                          Refresh
                        </button>
                      </div>
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

                    <div className="grid g3">
                      <Field label=" ">
                        <label className="inline-checkbox inline-checkbox--small flex items-center gap-2">
                          <CheckboxSmall
                            aria-label="Apresentar valor de mercado na proposta"
                            checked={mostrarValorMercadoLeasing}
                            onChange={(event) =>
                              setMostrarValorMercadoLeasing(event.target.checked)
                            }
                          />
                          <span>Apresentar valor de mercado na proposta</span>
                        </label>
                      </Field>
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

          </>
        ) : (
          <>
            {modoOrcamento === 'auto' ? (
              <section className="card">
                <h2>Orçamento automático</h2>
                <div className="grid g2">
                  <Field label="Consumo (kWh/mês)">
                    <input
                      type="number"
                      placeholder="Ex.: 800"
                      inputMode="decimal"
                      value={kcKwhMes || ''}
                      onChange={(event) => setKcKwhMes(Number(event.target.value) || 0, 'user')}
                    />
                  </Field>
                  <Field label="Potência (kWp)">
                    <input
                      type="number"
                      placeholder="Ex.: 5.5"
                      inputMode="decimal"
                      value={
                        potenciaFonteManual
                          ? vendaForm.potencia_instalada_kwp ?? ''
                          : vendaAutoPotenciaKwp ?? ''
                      }
                      onChange={(event) => handlePotenciaInstaladaChange(event.target.value)}
                    />
                  </Field>
                </div>
                <div className="grid g3 mt-4">
                  <Field label="Tipo de rede">
                    <div className="grid g1 gap-1">
                      <select
                        value={tipoRedeControle === 'auto' ? 'auto' : tipoRede}
                        onChange={(event) => {
                          const value = event.target.value
                          if (value === 'auto') {
                            setTipoRedeControle('auto')
                            return
                          }
                          handleTipoRedeSelection(value as TipoRede, 'manual')
                        }}
                      >
                        <option value="auto">Automático</option>
                        {TIPOS_REDE.map((rede) => (
                          <option key={rede.value} value={rede.value}>
                            {rede.label}
                          </option>
                        ))}
                      </select>
                      {tipoRedeControle === 'auto' ? (
                        <span className="muted">
                          {tipoRedeAutoSugestao
                            ? `Sugerido automaticamente: ${
                                TIPOS_REDE.find((item) => item.value === tipoRedeAutoSugestao)?.label ??
                                tipoRedeAutoSugestao
                              }.`
                            : 'Aguardando potência para sugerir a rede adequada.'}
                        </span>
                      ) : (
                        <span className="muted">Rede definida manualmente; cálculos usam {tipoRedeLabel}.</span>
                      )}
                    </div>
                  </Field>
                  <Field label="Kit solar (R$)">
                    <input
                      readOnly
                      placeholder="—"
                      value={autoKitValor != null ? formatBRL(autoKitValor) : ''}
                    />
                  </Field>
                  <Field label="Custo final projetado (R$)">
                    <input
                      readOnly
                      placeholder="—"
                      value={autoCustoFinal != null ? formatBRL(autoCustoFinal) : ''}
                    />
                  </Field>
                </div>
                {autoPricingVersion ? (
                  <p className="muted" style={{ marginTop: '12px' }}>
                    Regra de pricing aplicada: {autoPricingVersion}
                  </p>
                ) : null}
              </section>
            ) : null}
            {modoOrcamento === 'manual' ? (
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
                        <span className="budget-upload-status">{describeBudgetProgress(budgetProcessingProgress)}</span>
                      ) : null}
                      {budgetProcessingError ? <span className="budget-upload-error">{budgetProcessingError}</span> : null}
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
                  <div className="grid g2" style={{ marginTop: '12px' }}>
                    <Field label="Valor total do orçamento (R$)">
                      <input
                        ref={budgetTotalField.ref}
                        type="text"
                        inputMode="decimal"
                        value={budgetTotalField.text}
                        onChange={budgetTotalField.handleChange}
                        onBlur={budgetTotalField.handleBlur}
                        onFocus={(event) => {
                          budgetTotalField.handleFocus(event)
                          selectNumberInputOnFocus(event)
                        }}
                        placeholder={MONEY_INPUT_PLACEHOLDER}
                      />
                      <p className="muted">
                        Informe manualmente o valor do kit ou deixe em branco para usar a soma dos itens.
                      </p>
                    </Field>
                  </div>
                  {budgetMissingSummary ? (
                    <div className="budget-missing-alert">
                      <div>
                        <h3>Informações ausentes do documento</h3>
                        <p>
                          Não foi possível identificar {budgetMissingSummary.fieldsText} de <strong>módulos e/ou inversor</strong>
                          {' '}
                          neste orçamento. Você pode editar manualmente ou reenviar um arquivo em outro formato.
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
                        Nenhum item de orçamento foi carregado ainda. Faça o upload de um arquivo ou adicione itens manualmente.
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
                            {isBudgetTableCollapsed ? 'Expandir itens do orçamento' : 'Recolher itens do orçamento'}
                          </span>
                        </button>
                      </div>
                      <div
                        id={budgetTableContentId}
                        className={`budget-table card ${isBudgetTableCollapsed ? 'collapsed' : ''}`}
                        aria-hidden={isBudgetTableCollapsed}
                      >
                        <table>
                          <thead>
                            <tr>
                              <th>Descrição</th>
                              <th>Quantidade</th>
                              <th>Valor unitário</th>
                              <th>Total</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {kitBudget.items.map((item, index) => (
                              <tr key={`budget-item-${item.id}`}>
                                <td>
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(event) =>
                                      handleBudgetItemChange(index, { ...item, description: event.target.value })
                                    }
                                    placeholder="Descrição do item"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.quantity}
                                    onChange={(event) =>
                                      handleBudgetItemChange(index, { ...item, quantity: Number(event.target.value) })
                                    }
                                    placeholder="Quantidade"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.unitValue}
                                    onChange={(event) =>
                                      handleBudgetItemChange(index, { ...item, unitValue: Number(event.target.value) })
                                    }
                                    placeholder="Valor unitário"
                                  />
                                </td>
                                <td>
                                  <input type="text" value={currency(item.total)} readOnly aria-label="Total do item" />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="ghost danger"
                                    onClick={() => handleRemoveBudgetItem(index)}
                                  >
                                    Remover
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="budget-table-footer">
                          <button type="button" className="ghost" onClick={handleAddBudgetItem}>
                            Adicionar item
                          </button>
                          <div className="budget-table-total">
                            <span>Total do kit:</span> <strong>{currency(kitBudgetTotal)}</strong>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </section>
                {renderCondicoesPagamentoSection()}
                {renderRetornoProjetadoSection()}
              </>
            ) : null}
          </>
        )}
                </div>
                {activeTab === 'leasing' ? (
                  <>
                    {leasingBuyoutSection}
                    {leasingChartSection}
                  </>
                ) : null}
              </div>

              </main>
            </div>
          </div>
        )}
      </AppShell>
      <input
        ref={imagensUploadInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImagensSelecionadas}
        style={{ display: 'none' }}
      />

      {isEnviarPropostaModalOpen ? (
        <EnviarPropostaModal
          contatos={contatosEnvio}
          selectedContatoId={contatoEnvioSelecionadoId}
          onSelectContato={selecionarContatoEnvio}
          onEnviar={handleEnviarProposta}
          onClose={fecharEnvioPropostaModal}
        />
      ) : null}

      <input
        ref={clientesImportInputRef}
        type="file"
        accept="application/json,text/csv,.csv"
        style={{ display: 'none' }}
        onChange={handleClientesImportarArquivo}
      />

      {isLeasingContractsModalOpen ? (
        <LeasingContractsModal
          tipoContrato={leasingContrato.tipoContrato}
          anexosSelecionados={leasingAnexosSelecionados}
          anexosAvailability={leasingAnexosAvailability}
          isLoadingAvailability={leasingAnexosLoading}
          onToggleAnexo={handleToggleLeasingAnexo}
          onSelectAll={handleSelectAllLeasingAnexos}
          onConfirm={handleConfirmarGeracaoLeasing}
          onClose={handleFecharLeasingContractsModal}
          isGenerating={gerandoContratos}
        />
      ) : null}
      {isContractTemplatesModalOpen ? (
        <ContractTemplatesModal
          templates={contractTemplates}
          selectedTemplates={selectedContractTemplates}
          title={contractTemplatesCategory === 'vendas' ? 'Gerar contratos de vendas' : 'Gerar contratos de leasing'}
          isLoading={contractTemplatesLoading}
          errorMessage={contractTemplatesError}
          onToggleTemplate={handleToggleContractTemplate}
          onSelectAll={handleSelectAllContractTemplates}
          onConfirm={handleConfirmarGeracaoContratosVendas}
          onClose={handleFecharModalContratos}
        />
      ) : null}
      {renderPrecheckModal()}

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
      {saveDecisionPrompt ? (
        <SaveChangesDialog
          title={saveDecisionPrompt.title}
          description={saveDecisionPrompt.description}
          confirmLabel={saveDecisionPrompt.confirmLabel ?? 'Sim'}
          discardLabel={saveDecisionPrompt.discardLabel ?? 'Não'}
          onConfirm={() => resolveSaveDecisionPrompt('save')}
          onDiscard={() => resolveSaveDecisionPrompt('discard')}
        />
      ) : null}
    </>
  )
}
