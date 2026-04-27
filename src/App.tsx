import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  type CrmIntegrationMode,
  formatarDataCurta,
  useCrm,
  CrmPage,
  CrmPageActions,
} from './features/crm'
import { CheckboxSmall } from './components/CheckboxSmall'
import { ActionBar } from './components/layout/ActionBar'
import { InfoTooltip, labelWithTooltip } from './components/InfoTooltip'
import { createRoot } from 'react-dom/client'

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
import { shouldUseBentoGrid } from './utils/pdfVariant'
import { renderBentoLeasingToHtml, buildBentoLeasingPdfDocument } from './utils/renderBentoLeasing'
import { renderPrintableProposalToHtml, renderPrintableBuyoutTableToHtml } from './utils/renderPdf'
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
  setStorageTokenProvider,
} from './app/services/serverStorage'
import { saveFormDraft, loadFormDraft, clearFormDraft } from './lib/persist/formDraft'
import {
  saveProposalSnapshotById,
  loadProposalSnapshotById,
} from './lib/persist/proposalStore'
import { formatEnderecoCompleto } from './lib/formatEnderecoCompleto'
import {
  upsertClienteRegistro,
  getClienteRegistroById,
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
import { calcTusdEncargoMensal, DEFAULT_TUSD_ANO_REFERENCIA, TUSD_TIPO_LABELS } from './lib/finance/tusd'
import type { TipoClienteTUSD } from './lib/finance/tusd'
import {
  calcularAnaliseFinanceira,
  resolveCustoProjetoPorFaixa,
  resolveCrea,
  PRECO_PLACA_RS,
} from './lib/finance/analiseFinanceiraSpreadsheet'
import type { AnaliseFinanceiraInput } from './types/analiseFinanceira'
import { estimateMonthlyGenerationKWh, estimateMonthlyKWh } from './lib/energy/generation'
import { clearClientHighlights, highlightMissingFields } from './lib/ui/fieldHighlight'
import { buildRequiredFieldsLeasing } from './lib/validation/buildRequiredFieldsLeasing'
import { buildRequiredFieldsVenda } from './lib/validation/buildRequiredFieldsVenda'
import { validateRequiredFields } from './lib/validation/validateRequiredFields'
import {
  validateClientReadinessForContract,
  type ValidationIssue,
} from './lib/validation/clientReadiness'
import { ClientReadinessErrorModal } from './components/validation/ClientReadinessErrorModal'
import { validateProposalReadinessForClosing } from './lib/services/closeProposalPipeline'
import {
  parseVendaPdfText,
  mergeParsedVendaPdfData,
  type EstruturaUtilizadaTipoWarning,
  type ParsedVendaPdfData,
} from './lib/pdf/extractVendas'
import {
  formatMoneyBR,
  formatNumberBR,
  formatNumberBRWithOptions,
  formatPercentBRWithDigits,
  toNumberFlexible,
} from './lib/locale/br-number'
import { MONEY_INPUT_PLACEHOLDER, useBRNumberField } from './lib/locale/useBRNumberField'
import {
  calcPotenciaSistemaKwp,
  calcProjectedCostsByConsumption,
  formatBRL,
  getRedeByPotencia,
  type Rede,
} from './lib/pricing/pricingPorKwp'
import { calcularPrecheckNormativo } from './domain/normas/precheckNormativo'
import {
  formatTipoLigacaoLabel,
  normalizeTipoLigacaoNorma,
  type NormComplianceResult,
  type PrecheckDecision,
  type PrecheckDecisionAction,
  type TipoLigacaoNorma,
} from './domain/normas/padraoEntradaRules'
import { lookupCep } from './shared/cepLookup'
import { isExemptRegion, calculateInstallerTravelCost } from './lib/finance/travelCost'
import { calcRoundTripKm, BASE_CITY_NAME } from './shared/geocoding'
import { searchCidades, type CidadeDB, MIN_CITY_SEARCH_LENGTH } from './data/cidades'
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
  type LeasingCorresponsavel,
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
import { TIPOS_INSTALACAO, TIPOS_REDE } from './constants/instalacao'
import './styles/config-page.css'
import './styles/toast.css'
import './styles/bulk-import.css'
import './styles/backup-modal.css'
import '@/styles/fix-fog-safari.css'
import { AppRoutes } from './app/Routes'
import { AppShell } from './layout/AppShell'
import type { SidebarGroup } from './layout/Sidebar'
import { buildSidebarGroups } from './config/sidebarConfig'
import { useRouteGuard } from './hooks/useRouteGuard'
import { useTheme } from './hooks/useTheme'
import { useShellLayout } from './hooks/useShellLayout'
import { CHART_THEME } from './helpers/ChartTheme'
import {
  ANALISE_ANOS_PADRAO,
  DIAS_MES_PADRAO,
  INITIAL_VALUES,
  LEASING_PRAZO_OPCOES,
  PAINEL_OPCOES,
  SETTINGS_TABS,
  SIMULACOES_SECTIONS,
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
import { MULTI_UC_CLASSES, MULTI_UC_CLASS_LABELS, type MultiUcClasse } from './types/multiUc'
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
  NOVOS_TIPOS_TUSD,
  TIPO_BASICO_OPTIONS,
} from './types/tipoBasico'
import type { VendasConfig } from './types/vendasConfig'
import type { PrintableBuyoutTableProps } from './components/print/PrintableBuyoutTable'
import {
  currency,
  formatAxis,
  formatCep,
  formatCpfCnpj,
  formatKwhWithUnit,
  formatTelefone,
  formatUcGeradoraTitularEndereco,
  normalizeNumbers,
  tarifaCurrency,
} from './utils/formatters'
import { normalizeText } from './utils/textUtils'
import {
  createEmptyUcGeradoraTitularEndereco,
  createEmptyUcGeradoraTitular,
  cloneUcGeradoraTitular,
} from './utils/ucGeradoraTitularFactory'
import {
  getDistribuidoraDefaultForUf,
  resolveUfForDistribuidora,
} from './utils/distribuidoraHelpers'
import { Switch } from './components/ui/switch'
import { useStackUser } from './app/stack-context'
import { performLogout } from './lib/auth/logout'
import { useStackRbac } from './lib/auth/rbac'
import { useAuthSession } from './auth/auth-session'
import {
  createProposal,
  deleteProposal,
  type CreateProposalInput,
  listProposals as listProposalsFromApi,
  type ProposalRow,
  setProposalsTokenProvider,
  type UpdateProposalInput,
  updateProposal,
} from './lib/api/proposalsApi'
import {
  ClientsApiError,
  type ConsultantEntry,
  deleteClientById,
  isClientNotFoundError,
  listClients as listClientsFromApi,
  listConsultants as listConsultantsFromApi,
  type ClientRow,
  setClientsTokenProvider,
  runConsultorBackfillSweep,
  upsertClientByDocument,
  updateClientById,
  type UpsertClientInput,
  type UpdateClientInput,
  bulkImport,
  type BulkImportRowInput,
} from './lib/api/clientsApi'
import {
  analyzeImportRows,
  type AnalyzedImportRow,
  type SuggestedAction as ImportSuggestedAction,
} from './lib/clients/deduplication'
import { BulkImportPreviewModal } from './components/clients/BulkImportPreviewModal'
import { BackupActionModal } from './components/clients/BackupActionModal'
import type { BackupDestino } from './components/clients/BackupActionModal'
import { isOnline as isConnectivityOnline } from './lib/connectivity'
import { runSync } from './lib/sync/syncEngine'
import {
  migrateLocalStorageToServer,
  setMigrationTokenProvider,
} from './lib/migrateLocalStorageToServer'
import { AdminUsersPage } from './features/admin-users/AdminUsersPage'
import { SettingsPage } from './pages/SettingsPage'
import { setAdminUsersTokenProvider } from './services/auth/admin-users'
import { setFetchAuthTokenProvider } from './lib/auth/fetchWithStackAuth'
import { useAuthorizationSnapshot } from './auth/useAuthorizationSnapshot'
import { clearOfflineSnapshot } from './lib/auth/authorizationSnapshot'
import { ClientPortfolioPage } from './pages/ClientPortfolioPage'
import { FinancialManagementPage } from './pages/FinancialManagementPage'
import { OperationalDashboardPage } from './pages/OperationalDashboardPage'
import { DashboardPage } from './pages/DashboardPage'
import { setPortfolioTokenProvider } from './services/clientPortfolioApi'
import { convertClientToClosedDeal } from './services/deals/convert-client-to-closed-deal'
import { setFinancialManagementTokenProvider } from './services/financialManagementApi'
import { setProjectsTokenProvider } from './services/projectsApi'
import { setProjectFinanceTokenProvider } from './features/project-finance/api'
import { setFinancialImportTokenProvider } from './services/financialImportApi'
import { setInvoicesTokenProvider } from './services/invoicesApi'
import { setOperationalDashboardTokenProvider } from './lib/api/operationalDashboardApi'
import { fetchConsultantsForPicker, type ConsultantPickerEntry, consultorDisplayName, formatConsultantOptionLabel } from './services/personnelApi'
import type { ActivePage, SimulacoesSection } from './types/navigation'
import {
  type AprovacaoStatus,
  type AprovacaoChecklistKey,
} from './features/simulacoes/simulacoesConstants'
import { SimulacoesPage } from './features/simulacoes/SimulacoesPage'
import { useAfDeslocamentoStore } from './features/simulacoes/useAfDeslocamentoStore'
import {
  selectAfCidadeDestino,
  selectAfCidadeShowSuggestions,
  selectAfCidadeSuggestions,
  selectAfDeslocamentoCidadeLabel,
  selectAfDeslocamentoErro,
  selectAfDeslocamentoKm,
  selectAfDeslocamentoRs,
  selectAfDeslocamentoStatus,
  selectSelectCidadeAndCalculateDeslocamento,
} from './features/simulacoes/afDeslocamentoSelectors'
import { cloneImpostosOverrides, parseNumericInput, toNumberSafe } from './utils/vendasHelpers'
import { formatWhatsappPhoneNumber } from './utils/phoneUtils'
import { Field, FieldError } from './components/ui/Field'
import { ClientesPage } from './pages/ClientesPage'
import { BudgetSearchPage } from './pages/BudgetSearchPage'
import { PrecheckModal } from './pages/PrecheckModal'
import { PropostaImagensSection } from './components/PropostaImagensSection'
import { ComposicaoUfvSection } from './components/ComposicaoUfvSection'
import { VendaConfiguracaoSection } from './components/VendaConfiguracaoSection'
import { VendaResumoPublicoSection } from './components/VendaResumoPublicoSection'
import { UcGeradoraTitularPanel } from './components/UcGeradoraTitularPanel'
import { ClienteDadosSection } from './components/ClienteDadosSection'
import { CondicoesPagamentoSection } from './components/CondicoesPagamentoSection'
import { LeasingContratoSection } from './components/LeasingContratoSection'
import { LeasingConfiguracaoUsinaSection } from './components/LeasingConfiguracaoUsinaSection'
import { RetornoProjetadoSection } from './components/RetornoProjetadoSection'
import { VendasParametrosInternosSettings } from './pages/settings/VendasParametrosInternosSettings'
import { TusdParametersSection } from './components/TusdParametersSection'
import { ParametrosPrincipaisSection } from './components/ParametrosPrincipaisSection'
import { VendaParametrosSection } from './components/VendaParametrosSection'
import type { ClienteMensagens } from './types/cliente'
import type { UcBeneficiariaFormState } from './types/ucBeneficiaria'
import type { UcGeradoraTitularErrors } from './types/ucGeradoraTitular'
import { isSegmentoCondominio } from './utils/segmento'

// NOVAS OPÇÕES — A SEREM USADAS COMO FONTES DOS SELECTS
const NOVOS_TIPOS_CLIENTE = TIPO_BASICO_OPTIONS
const NOVOS_TIPOS_EDIFICACAO = NOVOS_TIPOS_CLIENTE


const normalizeCidade = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const getCustosFixosContaEnergiaPadrao = (cidade?: string | null): number | null => {
  const normalized = normalizeCidade(cidade ?? '')
  if (!normalized) return null
  if (normalized.includes('goiania')) return 15
  if (normalized.includes('brasilia')) return 10
  if (normalized.includes('anapolis')) return 6
  return null
}

const PrintableProposal = React.lazy(() => import('./components/print/PrintableProposal'))
const PrintPageLeasing = React.lazy(() => import('./pages/PrintPageLeasing').then(m => ({ default: m.PrintPageLeasing })))
const PrintableBuyoutTable = React.lazy(() => import('./components/print/PrintableBuyoutTable'))
const LeasingBeneficioChart = React.lazy(() => import('./components/leasing/LeasingBeneficioChart').then(m => ({ default: m.LeasingBeneficioChart })))

const TIPO_SISTEMA_VALUES: readonly TipoSistema[] = ['ON_GRID', 'HIBRIDO', 'OFF_GRID'] as const

const REGIME_TRIBUTARIO_LABELS: Record<RegimeTributario, string> = {
  simples: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
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

const normalizeTusdTipoClienteValue = (value: unknown): TipoClienteTUSD => {
  const normalized = normalizeTipoBasico(typeof value === 'string' ? value : null)
  return (normalized || 'residencial')
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

const _TUSD_TIPO_OPTIONS = NOVOS_TIPOS_TUSD.map(({ value }) => value)

const TUSD_TO_SEGMENTO: Record<TipoClienteTUSD, SegmentoCliente> = {
  residencial: 'residencial' as SegmentoCliente,
  comercial: 'comercial' as SegmentoCliente,
  cond_vertical: 'cond_vertical' as SegmentoCliente,
  cond_horizontal: 'cond_horizontal' as SegmentoCliente,
  industrial: 'industrial' as SegmentoCliente,
  outros: 'outros' as SegmentoCliente,
} as Record<TipoClienteTUSD, SegmentoCliente>

const SEGMENTO_TO_TUSD: Record<SegmentoCliente, TipoClienteTUSD> = {
  '': 'residencial' as TipoClienteTUSD,
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

const _SEGMENTO_OPTIONS = NOVOS_TIPOS_EDIFICACAO.map(({ value }) => value as SegmentoCliente)
const _SEGMENTO_LABELS = NOVOS_TIPOS_EDIFICACAO.reduce(
  (acc, { value, label }) => ({ ...acc, [value as SegmentoCliente]: label }),
  { '': 'Selecione' } as Record<SegmentoCliente, string>,
)

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

const _calcularLucroBrutoPadrao = (valorOrcamento: number, subtotalSemLucro: number) => {
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

type IbgeEstado = {
  sigla?: string
}

type ClienteRegistro = {
  id: string
  criadoEm: string
  atualizadoEm: string
  dados: ClienteDados
  propostaSnapshot?: OrcamentoSnapshotData
  consumption_kwh_month?: number | null
  system_kwp?: number | null
  term_months?: number | null
  /** Display name of the user who owns this client record (server-loaded, privileged views only) */
  ownerName?: string
  /** Email of the user who owns this client record (server-loaded, privileged views only) */
  ownerEmail?: string
  /** Stack user id of the owner (server-loaded, privileged views only) */
  ownerUserId?: string
  /**
   * Stack user ID of the user who created the record (created_by_user_id from DB).
   * Used as the primary key for the consultant filter on the Gestão de Clientes page.
   */
  createdByUserId?: string | null
  /**
   * Soft-delete timestamp from the database (deleted_at).
   * Null/undefined means the record is active. Deleted records must not appear in the table.
   */
  deletedAt?: string | null
  /**
   * Whether this client has been activated in the portfolio (clients.in_portfolio).
   * When true, the "Ativar Cliente" button must be disabled and show a "negócio fechado" icon.
   */
  inPortfolio?: boolean
  /**
   * Timestamp when the client was first activated in the portfolio (clients.portfolio_exported_at).
   */
  clientActivatedAt?: string | null
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

const toFiniteNonNegativeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(parsed)) return null
  return parsed >= 0 ? parsed : null
}

const resolveConsumptionFromSnapshot = (snapshot: OrcamentoSnapshotData | null): number | null => {
  if (!snapshot) return null
  const legacyPageShared = (snapshot.pageShared as { kcKwhMes?: unknown } | undefined)?.kcKwhMes
  const parametrosConsumo = (snapshot.parametros as { consumo_kwh_mes?: unknown } | undefined)?.consumo_kwh_mes
  const vendaParametrosConsumo = (
    snapshot.vendaSnapshot as { parametros?: { consumo_kwh_mes?: unknown } } | undefined
  )?.parametros?.consumo_kwh_mes
  const candidates = [
    snapshot.kcKwhMes,
    legacyPageShared,
    parametrosConsumo,
    snapshot.leasingSnapshot?.energiaContratadaKwhMes,
    snapshot.vendaForm?.consumo_kwh_mes,
    vendaParametrosConsumo,
  ]
  for (const candidate of candidates) {
    const parsed = toFiniteNonNegativeNumber(candidate)
    if (parsed !== null) return parsed
  }
  return null
}

const resolveSystemKwpFromSnapshot = (snapshot: OrcamentoSnapshotData | null): number | null => {
  if (!snapshot) return null
  return (
    toFiniteNonNegativeNumber(snapshot.leasingSnapshot?.dadosTecnicos?.potenciaInstaladaKwp) ??
    toFiniteNonNegativeNumber(snapshot.vendaForm?.potencia_sistema_kwp) ??
    toFiniteNonNegativeNumber(snapshot.vendaSnapshot?.potenciaCalculadaKwp) ??
    null
  )
}

const resolveTermMonthsFromSnapshot = (snapshot: OrcamentoSnapshotData | null): number | null => {
  if (!snapshot) return null
  return (
    toFiniteNonNegativeNumber(snapshot.leasingSnapshot?.prazoContratualMeses) ??
    toFiniteNonNegativeNumber(snapshot.prazoMeses) ??
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    toFiniteNonNegativeNumber(snapshot.vendaSnapshot?.financiamento?.prazoMeses) ??
    null
  )
}

const normalizeCurrencyNumber = (value: number | null) =>
  value === null ? null : Math.round(value * 100) / 100

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
  useBentoGridPdf: boolean
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
  temCorresponsavelFinanceiro: boolean
  corresponsavel: LeasingCorresponsavel | null
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
  /** Display name of the consultant who owns this proposal (server-loaded, privileged views only) */
  ownerName?: string
  /** Stack user id of the owner (server-loaded, privileged views only) */
  ownerUserId?: string
}

type CorresponsavelErrors = {
  nome?: string
  cpf?: string
  telefone?: string
  email?: string
  endereco?: string
}

const CLIENTES_STORAGE_KEY = 'solarinvest-clientes'
const CLIENTS_RECONCILIATION_KEY = 'clients-reconciliation-v1'
const BUDGETS_STORAGE_KEY = 'solarinvest-orcamentos'
/** Caches the consultant list so it's available immediately on page reload (avoids "Sem consultor" flash). */
const CONSULTORES_CACHE_KEY = 'solarinvest-consultores-cache'

type PersistedClientReconciliation = {
  deletedClientKeys: string[]
  updatedAt: number
  version: 1
}

/**
 * Maps a server-side ClientRow (from /api/clients) to the local ClienteRegistro format.
 * Used by privileged roles (admin, office, financeiro) to populate the clients list
 * from the RBAC-aware REST API instead of the user-scoped storage.
 *
 * Document field priority: `document` (canonical formatted field set by the server)
 * → `cpf_raw` (raw CPF digits) → `cnpj_raw` (raw CNPJ digits) → empty string.
 */
function serverClientToRegistro(row: ClientRow): ClienteRegistro {
  const ownerName = row.owner_display_name ?? row.owner_email ?? row.owner_user_id
  const ownerEmail = row.owner_email
  const ownerUserId = row.owner_user_id
  const ep = row.energy_profile
  const lp = row.latest_proposal_profile

  // Derive commercial fields prioritizing metadata (user-saved), then latest proposal, then energy profile.
  const meta = row.metadata ?? {}
  const metaTemIndicacao = meta.tem_indicacao as boolean | undefined
  const metaIndicacaoNome = (meta.indicacao_nome as string | undefined)?.trim() || ''
  const hasIndicacao = metaTemIndicacao != null
    ? metaTemIndicacao
    : Boolean(lp?.tem_indicacao || lp?.indicacao?.trim() || ep?.indicacao?.trim())
  const indicacaoNome = metaIndicacaoNome || lp?.indicacao?.trim() || ep?.indicacao?.trim() || ''
  const validTipoRede: TipoRede[] = ['monofasico', 'bifasico', 'trifasico', 'nenhum']
  const resolvedTipoRede: TipoRede =
    lp?.tipo_rede && validTipoRede.includes(lp.tipo_rede as TipoRede)
      ? (lp.tipo_rede as TipoRede)
      : ep?.tipo_rede && validTipoRede.includes(ep.tipo_rede as TipoRede)
        ? (ep.tipo_rede as TipoRede)
        : 'nenhum'
  const resolvedModalidade: TabKey =
    ep?.modalidade === 'venda' ? 'vendas' : 'leasing'
  const parsePositiveConsumption = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
    if (typeof value === 'string') {
      const parsed = toNumberFlexible(value)
      if (Number.isFinite(parsed) && parsed > 0) return parsed
    }
    return null
  }
  const resolvedKwhContratado = (
    parsePositiveConsumption(row.consumption_kwh_month)
    ?? parsePositiveConsumption(lp?.kwh_contratado)
    ?? parsePositiveConsumption(ep?.kwh_contratado)
  )
  const resolvedTarifaAtual = lp?.tarifa_atual ?? ep?.tarifa_atual ?? null
  const resolvedDesconto = lp?.desconto_percentual ?? ep?.desconto_percentual ?? null
  const resolvedUcsBeneficiarias = Array.isArray(lp?.ucs_beneficiarias) ? lp.ucs_beneficiarias : []

  const dados: ClienteDados = {
    nome: row.name,
    apelido: (meta.apelido as string | undefined) ?? '',
    // `document` is the formatted canonical field; cpf_raw/cnpj_raw are fallbacks
    // when the formatted field was not set (older records).
    documento: row.document ?? row.cpf_raw ?? row.cnpj_raw ?? '',
    rg: (meta.rg as string | undefined) ?? '',
    estadoCivil: (meta.estado_civil as string | undefined) ?? '',
    nacionalidade: (meta.nacionalidade as string | undefined) ?? '',
    profissao: (meta.profissao as string | undefined) ?? '',
    representanteLegal: (meta.representante_legal as string | undefined) ?? '',
    email: row.email ?? '',
    telefone: row.phone ?? '',
    cep: formatCep(row.cep ?? ''),
    distribuidora: row.distribuidora ?? '',
    uc: row.uc ?? '',
    endereco: row.address ?? '',
    cidade: row.city ?? '',
    uf: row.state ?? '',
    temIndicacao: hasIndicacao,
    indicacaoNome: hasIndicacao ? indicacaoNome : '',
    // consultant_id: resolve canonical FK first, then fall back to legacy metadata.consultor_id.
    // Never use created_by_user_id or owner_user_id as a substitute.
    consultorId: (() => {
      const canonical = row.consultant_id != null && row.consultant_id !== '' ? String(row.consultant_id).trim() : ''
      if (canonical) {
        console.debug('[consultant][hydrate]', { clientId: row.id, source: 'canonical', consultantId: canonical })
        return canonical
      }
      const legacyId = (meta.consultor_id as string | number | undefined)
      if (legacyId != null && legacyId !== '') {
        const legacyStr = String(legacyId).trim()
        console.debug('[consultant][hydrate]', { clientId: row.id, source: 'legacy-metadata', consultantId: legacyStr })
        return legacyStr
      }
      console.debug('[consultant][hydrate]', { clientId: row.id, source: 'none', canonicalNull: row.consultant_id, legacyMetadata: meta.consultor_id })
      return ''
    })(),
    consultorNome: (meta.consultor_nome as string | undefined) ?? '',
    herdeiros: (() => {
      if (!Array.isArray(meta.herdeiros)) return ['']
      const filtered = (meta.herdeiros as string[]).filter((h) => typeof h === 'string' && h.trim())
      return filtered.length > 0 ? filtered : ['']
    })(),
    nomeSindico: (meta.nome_sindico as string | undefined) ?? '',
    cpfSindico: (meta.cpf_sindico as string | undefined) ?? '',
    contatoSindico: (meta.contato_sindico as string | undefined) ?? '',
    diaVencimento: (meta.dia_vencimento as string | undefined) ?? '10',
  }

  // Build a partial proposal snapshot from the energy profile so that
  // handleEditarCliente can pre-populate the form fields when the user loads
  // a client that was previously saved with energy data.
  const propostaSnapshot: OrcamentoSnapshotData | undefined = (ep || lp)
    ? ({
        // Minimal snapshot seeded with energy profile values.
        // All unset fields are filled in by mergeSnapshotWithDefaults (spreads the
        // createEmptySnapshot base over this object, then uses ?? to fall back to
        // defaults for any null/undefined fields).
        activeTab: resolvedModalidade,
        settingsTab: 'painel',
        cliente: dados,
        clienteEmEdicaoId: row.id,
        clienteMensagens: {},
        ucBeneficiarias: resolvedUcsBeneficiarias.map((item, index) => ({
          id: item.id ?? `lp-uc-${index + 1}`,
          numero: typeof item.numero === 'string' ? item.numero : '',
          endereco: typeof item.endereco === 'string' ? item.endereco : '',
          consumoKWh: String(item.consumoKWh ?? ''),
          rateioPercentual: String(item.rateioPercentual ?? ''),
        })),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        pageShared: { procuracao: { uf: row.state ?? '', cidade: row.city ?? '' } } as PageSharedSettings,
        currentBudgetId: '',
        budgetStructuredItems: [],
        kitBudget: null,
        budgetProcessing: { isProcessing: false, error: null, progress: null, isTableCollapsed: false, ocrDpi: 150 },
        propostaImagens: [],
        ufTarifa: row.state ?? '',
        distribuidoraTarifa: row.distribuidora ?? '',
        ufsDisponiveis: [],
        distribuidorasPorUf: {},
        mesReajuste: 1,
        kcKwhMes: resolvedKwhContratado != null ? Number(resolvedKwhContratado) : 0,
        consumoManual: resolvedKwhContratado != null && resolvedKwhContratado > 0,
        tarifaCheia: resolvedTarifaAtual != null ? Number(resolvedTarifaAtual) : 0,
        desconto: resolvedDesconto != null ? Number(resolvedDesconto) : 0,
        taxaMinima: 0,
        taxaMinimaInputEmpty: false,
        encargosFixosExtras: 0,
        tusdPercent: 0,
        tusdTipoCliente: 'residencial',
        tusdSubtipo: '',
        tusdSimultaneidade: null,
        tusdTarifaRkwh: null,
        tusdAnoReferencia: new Date().getFullYear(),
        tusdOpcoesExpandidas: false,
        leasingPrazo: ep?.prazo_meses != null ? Math.round(ep.prazo_meses / 12) as LeasingPrazoAnos : 20,
        potenciaModulo: 0,
        potenciaModuloDirty: false,
        tipoInstalacao: 'residencial',
        tipoInstalacaoOutro: '',
        tipoInstalacaoDirty: false,
        tipoSistema: 'ongrid',
        segmentoCliente: 'residencial',
        tipoEdificacaoOutro: '',
        numeroModulosManual: '',
        configuracaoUsinaObservacoes: '',
        composicaoTelhado: null,
        composicaoSolo: null,
        aprovadoresText: '',
        impostosOverridesDraft: {},
        vendasConfig: null,
        vendasSimulacoes: {},
        multiUc: { ativo: false, rows: [], rateioModo: 'proporcional', energiaGeradaKWh: 0, energiaGeradaTouched: false, anoVigencia: new Date().getFullYear(), overrideEscalonamento: false, escalonamentoCustomPercent: null },
        precoPorKwp: 0,
        irradiacao: 0,
        eficiencia: 0.8,
        diasMes: 30,
        inflacaoAa: 0,
        vendaForm: {
          consumo_kwh_mes: resolvedKwhContratado != null ? Number(resolvedKwhContratado) : 0,
          modelo_inversor: ep?.marca_inversor ?? '',
        },
        capexManualOverride: false,
        parsedVendaPdf: null,
        estruturaTipoWarning: null,
        jurosFinAa: 0,
        prazoFinMeses: 0,
        entradaFinPct: 0,
        mostrarFinanciamento: false,
        mostrarGrafico: true,
        useBentoGridPdf: false,
        prazoMeses: ep?.prazo_meses != null ? Number(ep.prazo_meses) : 240,
        bandeiraEncargo: 0,
        cipEncargo: 0,
        entradaRs: 0,
        entradaModo: 'percentual',
        mostrarValorMercadoLeasing: false,
        mostrarTabelaParcelas: false,
        mostrarTabelaBuyout: false,
        mostrarTabelaParcelasConfig: false,
        mostrarTabelaBuyoutConfig: false,
        oemBase: 0,
        oemInflacao: 0,
        seguroModo: 'percentual',
        seguroReajuste: 0,
        seguroValorA: 0,
        seguroPercentualB: 0,
        exibirLeasingLinha: true,
        exibirFinLinha: false,
        cashbackPct: 0,
        depreciacaoAa: 0,
        inadimplenciaAa: 0,
        tributosAa: 0,
        ipcaAa: 0,
        custosFixosM: 0,
        opexM: 0,
        seguroM: 0,
        duracaoMeses: 0,
        pagosAcumAteM: 0,
        modoOrcamento: 'auto',
        autoKitValor: null,
        autoCustoFinal: null,
        autoPricingRede: null,
        autoPricingVersion: null,
        autoBudgetReason: null,
        autoBudgetReasonCode: null,
        tipoRede: resolvedTipoRede,
        tipoRedeControle: 'manual',
        temCorresponsavelFinanceiro: false,
        corresponsavel: null,
        leasingAnexosSelecionados: [],
        vendaSnapshot: null,
        leasingSnapshot: {
          prazoContratualMeses: ep?.prazo_meses != null ? Number(ep.prazo_meses) : 240,
          energiaContratadaKwhMes: resolvedKwhContratado != null ? Number(resolvedKwhContratado) : 0,
          tarifaInicial: resolvedTarifaAtual != null ? Number(resolvedTarifaAtual) : 0,
          descontoContratual: resolvedDesconto != null ? Number(resolvedDesconto) : 0,
          inflacaoEnergiaAa: 0,
          investimentoSolarinvest: 0,
          dataInicioOperacao: '',
          responsavelSolarinvest: 'Operação, manutenção, suporte técnico, limpeza e seguro da usina.',
          valorDeMercadoEstimado: 0,
          dadosTecnicos: {
            potenciaInstaladaKwp: ep?.potencia_kwp != null ? Number(ep.potencia_kwp) : 0,
            geracaoEstimadakWhMes: 0,
            energiaContratadaKwhMes: resolvedKwhContratado != null ? Number(resolvedKwhContratado) : 0,
            potenciaPlacaWp: 0,
            numeroModulos: 0,
            tipoInstalacao: '',
            areaUtilM2: 0,
          },
          projecao: {
            mensalidadesAno: [[ep?.mensalidade != null ? Number(ep.mensalidade) : 0]],
            economiaProjetada: [],
          },
          contrato: {
            tipoContrato: 'residencial',
            dataInicio: '',
            dataFim: '',
            dataHomologacao: '',
            localEntrega: '',
            ucGeradoraTitularDiferente: false,
            ucGeradoraTitular: null,
            ucGeradoraTitularDraft: null,
            ucGeradoraTitularDistribuidoraAneel: '',
            ucGeradora_importarEnderecoCliente: false,
            modulosFV: '',
            inversoresFV: ep?.marca_inversor ?? '',
            nomeCondominio: '',
            cnpjCondominio: '',
            nomeSindico: '',
            cpfSindico: '',
            temCorresponsavelFinanceiro: false,
            corresponsavel: null,
            proprietarios: [{ nome: '', cpfCnpj: '' }],
          },
        },
      } as unknown as OrcamentoSnapshotData)
    : undefined

  return {
    id: row.id,
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
    ...(ownerName != null ? { ownerName } : {}),
    ...(ownerEmail != null ? { ownerEmail } : {}),
    ...(ownerUserId != null ? { ownerUserId } : {}),
    createdByUserId: row.created_by_user_id ?? null,
    deletedAt: row.deleted_at ?? null,
    inPortfolio: Boolean(row.in_portfolio),
    clientActivatedAt: row.portfolio_exported_at ?? null,
    consumption_kwh_month: resolvedKwhContratado,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    system_kwp: row.system_kwp ?? null,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    term_months: row.term_months ?? null,
    dados,
    ...(propostaSnapshot != null ? { propostaSnapshot } : {}),
  }
}

/**
 * Maps a server-side ProposalRow (from /api/proposals) to the local OrcamentoSalvo format.
 *
 * The server stores the complete OrcamentoSnapshotData (raw form state) as payload_json.
 * We use it as both:
 *   - `snapshot`: used by carregarOrcamentoParaEdicao to reload the form for editing
 *   - `dados`   : used by the listing page to read client metadata (nome, cidade, uc, etc.)
 *                 and by carregarOrcamentoSalvo to determine proposal type
 *
 * The double cast (as unknown as …) is intentional: payload_json is typed as
 * Record<string,unknown> at the API boundary but is guaranteed to be an
 * OrcamentoSnapshotData object written by the auto-save path.  The fields
 * required for listing (cliente.*) and editing (full snapshot) are all present.
 * Used by privileged roles (admin, office, financeiro).
 */
function serverProposalToOrcamento(row: ProposalRow): OrcamentoSalvo {
  // payload_json is always an OrcamentoSnapshotData written by the auto-save path.
  const snapshot = row.payload_json as unknown as OrcamentoSnapshotData
  const tipoProposta: PrintableProposalTipo =
    row.proposal_type === 'venda' ? 'VENDA_DIRETA' : 'LEASING'
  // Merge tipoProposta into the snapshot so that carregarOrcamentoSalvo can
  // determine the tab type without needing the full PrintableProposalProps.
  const dados = {
    ...(snapshot ?? {}),
    tipoProposta,
  } as unknown as PrintableProposalProps
  const ownerName = row.owner_display_name ?? row.owner_email ?? row.owner_user_id
  const ownerUserId = row.owner_user_id
  // Prefer proposal_code (e.g. "SLRINVST-LSE-12345678") as the local id so
  // it follows the established naming convention.  Fall back to the server
  // UUID only when no code was stored — this can happen for legacy rows that
  // were created before proposal_code was consistently populated.
  const proposalId = row.proposal_code ?? row.id
  return {
    id: proposalId,
    criadoEm: row.created_at,
    clienteId: undefined,
    clienteNome: row.client_name ?? snapshot?.cliente?.nome ?? '',
    clienteCidade: row.client_city ?? snapshot?.cliente?.cidade ?? '',
    clienteUf: row.client_state ?? snapshot?.cliente?.uf ?? '',
    clienteDocumento: row.client_document ?? snapshot?.cliente?.documento ?? undefined,
    clienteUc: snapshot?.cliente?.uc ?? undefined,
    ...(ownerName != null ? { ownerName } : {}),
    ...(ownerUserId != null ? { ownerUserId } : {}),
    dados,
    snapshot: snapshot ?? undefined,
  }
}
const PROPOSAL_SERVER_ID_MAP_STORAGE_KEY = 'solarinvest-proposal-server-id-map'
const CLIENT_SERVER_ID_MAP_STORAGE_KEY = 'solarinvest-client-server-id-map'
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
  consultorId: '',
  consultorNome: '',
  herdeiros: [''],
  nomeSindico: '',
  cpfSindico: '',
  contatoSindico: '',
  diaVencimento: '10',
}

const isSyncedClienteField = (key: keyof ClienteDados): key is FieldSyncKey =>
  key === 'uf' || key === 'cidade' || key === 'distribuidora' || key === 'cep' || key === 'endereco'

const normalizeDistribuidoraName = (value?: string | null): string =>
  value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase() ?? ''


const getDistribuidoraValidationMessage = (
  ufRaw?: string | null,
  distribuidoraRaw?: string | null,
): string | null => {
  const uf = ufRaw?.trim().toUpperCase() ?? ''
  const distribuidora = distribuidoraRaw?.trim() ?? ''
  const expected = getDistribuidoraDefaultForUf(uf)
  const distribuidoraNormalizada = normalizeDistribuidoraName(distribuidora)
  const expectedNormalizada = normalizeDistribuidoraName(expected)

  if (!uf && distribuidora) {
    return 'Informe a UF antes de definir a distribuidora.'
  }

  if (expected) {
    if (!distribuidora) {
      return `Informe a distribuidora para a UF ${uf}. Sugestão: ${expected}.`
    }
    if (distribuidoraNormalizada !== expectedNormalizada) {
      return `Distribuidora incompatível com a UF ${uf}. Use ${expected}.`
    }
    return null
  }

  if (uf && !distribuidora) {
    return 'Informe a distribuidora para a UF selecionada.'
  }

  return null
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


const createEmptyCorresponsavel = (): LeasingCorresponsavel => ({
  nome: '',
  nacionalidade: '',
  estadoCivil: '',
  cpf: '',
  endereco: createEmptyUcGeradoraTitularEndereco(),
  email: '',
  telefone: '',
})


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
    return 'Neoenergia Brasilia'
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

const resolveCorresponsavelEndereco = (
  endereco?: LeasingCorresponsavel['endereco'] | null,
): LeasingEndereco => {
  if (!endereco) {
    return createEmptyUcGeradoraTitularEndereco()
  }
  if (typeof endereco === 'string') {
    return { ...createEmptyUcGeradoraTitularEndereco(), logradouro: endereco }
  }
  return {
    ...createEmptyUcGeradoraTitularEndereco(),
    ...endereco,
  }
}

const buildCorresponsavelDraft = (
  value?: LeasingCorresponsavel | null,
): LeasingCorresponsavel => {
  if (!value) {
    return createEmptyCorresponsavel()
  }
  return {
    ...value,
    endereco: resolveCorresponsavelEndereco(value.endereco),
  }
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
    const titular = leasingContrato.ucGeradoraTitular ?? leasingContrato.ucGeradoraTitularDraft
    const endereco = titular?.endereco
    const camposObrigatorios = [
      titular?.nomeCompleto?.trim(),
      titular?.cpf?.trim(),
      endereco?.logradouro?.trim(),
      endereco?.cidade?.trim(),
      endereco?.uf?.trim(),
      endereco?.cep?.trim(),
    ]
    if (camposObrigatorios.some((campo) => !campo)) {
      if (leasingContrato.ucGeradora_importarEnderecoCliente) {
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

const persistWithFallback = <T,>(
  key: string,
  registros: T[],
  options: {
    serialize: (items: T[]) => string
    reduce: (items: T[]) => T[] | null
  },
): { persisted: T[]; droppedCount: number } => {
  if (typeof window === 'undefined') {
    return { persisted: registros, droppedCount: 0 }
  }

  if (registros.length === 0) {
    window.localStorage.removeItem(key)
    return { persisted: [], droppedCount: 0 }
  }

  const working = [...registros]
  let droppedCount = 0
  let lastError: unknown = null

  while (working.length >= 0) {
    try {
      if (working.length === 0) {
        window.localStorage.removeItem(key)
      } else {
        window.localStorage.setItem(key, options.serialize(working))
      }
      return { persisted: working, droppedCount }
    } catch (error) {
      lastError = error
      if (!isQuotaExceededError(error)) {
        throw error
      }

      const next = options.reduce(working)
      if (!next) {
        break
      }
      droppedCount += Math.max(0, working.length - next.length)
      working.splice(0, working.length, ...next)
    }
  }

  if (lastError) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError as unknown as string))
  }

  throw new Error('Falha ao salvar orçamentos no armazenamento local.')
}

const persistBudgetsToLocalStorage = (
  registros: OrcamentoSalvo[],
): { persisted: OrcamentoSalvo[]; droppedCount: number } =>
  persistWithFallback(BUDGETS_STORAGE_KEY, registros, {
    serialize: (items) => JSON.stringify(items),
    reduce: (items) => items.slice(0, -1),
  })

const persistClientesToLocalStorage = (
  registros: ClienteRegistro[],
): { persisted: ClienteRegistro[]; droppedCount: number } => {
  let strippedSnapshots = false
  return persistWithFallback(CLIENTES_STORAGE_KEY, registros, {
    serialize: (items) => (strippedSnapshots ? JSON.stringify(items) : serializeClientesForStorage(items)),
    reduce: (items) => {
      if (!strippedSnapshots) {
        strippedSnapshots = true
        return items.map((registro) => {
          const { propostaSnapshot: _propostaSnapshot, ...rest } = registro
          return rest as ClienteRegistro
        })
      }
      return items.slice(0, -1)
    },
  })
}

const alertPrunedBudgets = (droppedCount: number) => {
  if (typeof window === 'undefined' || droppedCount === 0) {
    return
  }

  const mensagem =
    droppedCount === 1
      ? 'O armazenamento local estava cheio. O orçamento mais antigo foi removido para salvar a versão atual.'
      : `O armazenamento local estava cheio. ${droppedCount} orçamentos antigos foram removidos para salvar a versão atual.`

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
    } catch (_error) {
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

    if (seen.has(input)) {
      return null
    }

    seen.add(input)

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

const _formatTarifaDigitsFromValue = (value: number | null | undefined): string => {
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
  const anos = Array.isArray(dados?.anos) ? dados.anos : []
  const leasingROI = Array.isArray(dados?.leasingROI) ? dados.leasingROI : []
  const financiamentoFluxo = Array.isArray(dados?.financiamentoFluxo) ? dados.financiamentoFluxo : []
  const financiamentoROI = Array.isArray(dados?.financiamentoROI) ? dados.financiamentoROI : []
  const tabelaBuyout = Array.isArray(dados?.tabelaBuyout) ? dados.tabelaBuyout : []
  const parcelasLeasing = Array.isArray(dados?.parcelasLeasing) ? dados.parcelasLeasing : []
  const clone: PrintableProposalProps = {
    ...dados,
    cliente: {
      ...dados.cliente,
      herdeiros: Array.isArray(dados.cliente.herdeiros)
        ? [...dados.cliente.herdeiros]
        : [''],
    },
    anos: [...anos],
    leasingROI: [...leasingROI],
    financiamentoFluxo: [...financiamentoFluxo],
    financiamentoROI: [...financiamentoROI],
    tabelaBuyout: tabelaBuyout.map((row) => ({ ...row })),
    buyoutResumo: { ...dados.buyoutResumo },
    parcelasLeasing: parcelasLeasing.map((row) => ({ ...row })),
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

const cloneEssentialCategoryInfo = (info: EssentialInfoSummary['modules']) => {
  if (!info || typeof info !== 'object') {
    return { missingFields: [], totalRequired: 0, totalFound: 0 }
  }
  return {
    ...info,
    missingFields: Array.isArray(info.missingFields) ? [...info.missingFields] : [],
  }
}

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

const cloneKitBudgetState = (state: KitBudgetState): KitBudgetState => {
  const s: Partial<KitBudgetState> = (state && typeof state === 'object') ? state : {}
  return {
    items: (Array.isArray(s.items) ? s.items : []).map((item) => ({ ...item })),
    warnings: [...(Array.isArray(s.warnings) ? s.warnings : [])],
    missingInfo: cloneKitBudgetMissingInfo(s.missingInfo as KitBudgetMissingInfo),
  } as KitBudgetState
}

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

const cloneSnapshotData = (snapshot: OrcamentoSnapshotData): OrcamentoSnapshotData => {
  const s: Partial<OrcamentoSnapshotData> = (snapshot && typeof snapshot === 'object') ? snapshot : {}
  return {
    ...(s as OrcamentoSnapshotData),
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    cliente: cloneClienteDados((s as OrcamentoSnapshotData).cliente),
    clienteMensagens: s.clienteMensagens ? { ...s.clienteMensagens } : undefined,
    ucBeneficiarias: cloneUcBeneficiariasForm(Array.isArray(s.ucBeneficiarias) ? s.ucBeneficiarias : []),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    pageShared: s.pageShared ? { ...s.pageShared } : ({} as OrcamentoSnapshotData['pageShared']),
    configuracaoUsinaObservacoes: s.configuracaoUsinaObservacoes ?? '',
    propostaImagens: Array.isArray(s.propostaImagens)
      ? s.propostaImagens.map((imagem) => ({ ...imagem }))
      : [],
    budgetStructuredItems: cloneStructuredItems(Array.isArray(s.budgetStructuredItems) ? s.budgetStructuredItems : []),
    kitBudget: cloneKitBudgetState((s.kitBudget ?? {}) as KitBudgetState),
    budgetProcessing: s.budgetProcessing
      ? {
          ...s.budgetProcessing,
          progress: cloneBudgetUploadProgress(s.budgetProcessing.progress ?? null),
        }
      : { isProcessing: false, error: null, progress: null, isTableCollapsed: false, ocrDpi: 150 },
    ufsDisponiveis: Array.isArray(s.ufsDisponiveis) ? [...s.ufsDisponiveis] : [],
    distribuidorasPorUf: s.distribuidorasPorUf ? cloneDistribuidorasMapa(s.distribuidorasPorUf) : {},
    multiUc: s.multiUc
      ? {
          ...s.multiUc,
          rows: Array.isArray(s.multiUc.rows) ? s.multiUc.rows.map((row) => ({ ...row })) : [],
        }
      : { rows: [] } as OrcamentoSnapshotData['multiUc'],
    composicaoTelhado: s.composicaoTelhado ? { ...s.composicaoTelhado } : ({} as OrcamentoSnapshotData['composicaoTelhado']),
    composicaoSolo: s.composicaoSolo ? { ...s.composicaoSolo } : ({} as OrcamentoSnapshotData['composicaoSolo']),
    impostosOverridesDraft: cloneImpostosOverrides(s.impostosOverridesDraft ?? {}),
    vendasConfig: s.vendasConfig ? (JSON.parse(JSON.stringify(s.vendasConfig)) as VendasConfig) : ({} as VendasConfig),
    vendasSimulacoes: s.vendasSimulacoes ? cloneVendasSimulacoes(s.vendasSimulacoes) : {},
    vendaForm: s.vendaForm ? { ...s.vendaForm } : ({} as VendaForm),
    leasingAnexosSelecionados: Array.isArray(s.leasingAnexosSelecionados)
      ? [...s.leasingAnexosSelecionados]
      : [],
    parsedVendaPdf: s.parsedVendaPdf
      ? (JSON.parse(JSON.stringify(s.parsedVendaPdf)) as ParsedVendaPdfData)
      : null,
    estruturaTipoWarning: s.estruturaTipoWarning ?? null,
    vendaSnapshot: s.vendaSnapshot
      ? (JSON.parse(JSON.stringify(s.vendaSnapshot)) as VendaSnapshot)
      : ({} as VendaSnapshot),
    leasingSnapshot: s.leasingSnapshot
      ? (JSON.parse(JSON.stringify(s.leasingSnapshot)) as LeasingState)
      : ({} as LeasingState),
  }
}

/** Safe JSON byte size estimate (using Blob for accuracy when available). */
const _getJsonSizeBytes = (obj: unknown): number => {
  try {
    const str = JSON.stringify(obj) ?? ''
    if (typeof Blob !== 'undefined') {
      return new Blob([str]).size
    }
    return str.length * 2 // worst-case UTF-16 estimate
  } catch {
    return 0
  }
}

/**
 * Conservative limit for a single key in the remote /api/storage.
 * Keeps us well below any typical 1 MB server body limit once JSON overhead is added.
 */
const _SAFE_STORAGE_PAYLOAD_BYTES = 250_000

/**
 * Strip large/reconstructable fields from a snapshot before writing it to
 * localStorage or sending to /api/storage.  Returns a partial copy that
 * preserves only the data that matters for offline recovery.
 */
const stripSnapshotForStorage = (
  snapshot: OrcamentoSnapshotData | null | undefined,
): OrcamentoSnapshotData | undefined => {
  if (!snapshot) return undefined
  const stripped: Partial<OrcamentoSnapshotData> = {
    ...snapshot,
    // Drop large blobs that are reconstructable from the proposal PDF / re-upload
    parsedVendaPdf: null,
    // Drop precomputed image list — not needed for client recovery
    propostaImagens: [],
    // Drop large budget item lists — can be re-parsed from PDF
    budgetStructuredItems: [],
    // Drop raw kit budget items — kept in proposals separately
    kitBudget: snapshot.kitBudget
      ? {
          ...snapshot.kitBudget,
          items: [],
          missingInfo: null,
          warnings: [],
        }
      : ({} as KitBudgetState),
    // Drop transient processing state
    budgetProcessing: {
      isProcessing: false,
      error: null,
      progress: null,
      isTableCollapsed: false,
      ocrDpi: 150,
    },
    // Drop per-simulation cache — large and reconstructable
    vendasSimulacoes: {},
    // Drop static lookups
    ufsDisponiveis: [],
    distribuidorasPorUf: {},
  }
  return stripped as OrcamentoSnapshotData
}

/**
 * Serialize a list of client records for localStorage / remote storage.
 * Strips heavy snapshot fields so the payload stays within quota limits.
 */
const serializeClientesForStorage = (registros: ClienteRegistro[]): string => {
  const lite = registros.map((r) => ({
    ...r,
    propostaSnapshot: stripSnapshotForStorage(r.propostaSnapshot),
  }))
  return JSON.stringify(lite)
}

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
  { key: 'apelido', label: 'apelido' },
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
  { key: 'consultorId', label: 'consultor_id' },
  { key: 'consultorNome', label: 'consultor_nome' },
  { key: 'nomeSindico', label: 'nome_sindico' },
  { key: 'cpfSindico', label: 'cpf_sindico' },
  { key: 'contatoSindico', label: 'contato_sindico' },
  { key: 'diaVencimento', label: 'dia_vencimento' },
  { key: 'herdeiros', label: 'herdeiros' },
  { key: 'propostaSnapshot', label: 'proposta_snapshot' },
  // Energy profile fields (imported but stored in client_energy_profile, not ClienteDados)
  { key: 'kwh_contratado', label: 'kwh_contratado' },
  { key: 'potencia_kwp', label: 'potencia_kwp' },
  { key: 'tipo_rede', label: 'tipo_rede' },
  { key: 'tarifa_atual', label: 'tarifa_atual' },
  { key: 'desconto_percentual', label: 'desconto_percentual' },
  { key: 'mensalidade', label: 'mensalidade' },
  { key: 'indicacao', label: 'indicacao' },
  { key: 'modalidade', label: 'modalidade' },
  { key: 'prazo_meses', label: 'prazo_meses' },
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
  apelido: 'apelido',
  nickname: 'apelido',
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
  consultorid: 'consultorId',
  consultor_id: 'consultorId',
  consultornome: 'consultorNome',
  consultor_nome: 'consultorNome',
  consultor: 'consultorNome',
  nomesindico: 'nomeSindico',
  cpfsindico: 'cpfSindico',
  contatosindico: 'contatoSindico',
  diavencimento: 'diaVencimento',
  herdeiros: 'herdeiros',
  propostasnapshot: 'propostaSnapshot',
  proposta: 'propostaSnapshot',
  snapshot: 'propostaSnapshot',
  // Energy profile fields
  kwhcontratado: 'kwh_contratado',
  kwh: 'kwh_contratado',
  consumokwh: 'kwh_contratado',
  consumo: 'kwh_contratado',
  potenciakwp: 'potencia_kwp',
  potencia: 'potencia_kwp',
  kwp: 'potencia_kwp',
  tiporede: 'tipo_rede',
  rede: 'tipo_rede',
  tarifaatual: 'tarifa_atual',
  tarifa: 'tarifa_atual',
  descontopercentual: 'desconto_percentual',
  desconto: 'desconto_percentual',
  mensalidade: 'mensalidade',
  indicacao: 'indicacao',
  origemlead: 'indicacao',
  lead: 'indicacao',
  modalidade: 'modalidade',
  tipocontrato: 'modalidade',
  prazomeses: 'prazo_meses',
  prazo: 'prazo_meses',
  termo: 'prazo_meses',
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const registro: any = {
        dados: {} as Partial<ClienteDados>,
      }

      headerKeys.forEach((key, index) => {
        if (!key) {
          return
        }
        const value = values[index]?.trim() ?? ''
        if (!value) {
          return
        }

        /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
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
        case 'kwh_contratado':
        case 'potencia_kwp':
        case 'tarifa_atual':
        case 'desconto_percentual':
        case 'mensalidade':
        case 'prazo_meses': {
          const num = toNumberFlexible(value)
          if (Number.isFinite(num)) {
            if (!registro.energyProfile) registro.energyProfile = {}
            registro.energyProfile[key] = num
          }
          break
        }
        case 'tipo_rede':
        case 'indicacao':
        case 'modalidade': {
          if (!registro.energyProfile) registro.energyProfile = {}
          registro.energyProfile[key] = value
          break
        }
        default:
           
          ;(registro.dados as Record<string, unknown>)[key] = value
      }
        /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
      })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return registro
    })
    .filter((item): item is Partial<ClienteRegistro> & { dados?: Partial<ClienteDados>; energyProfile?: Record<string, string | number | null> } => Boolean(item))
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
  /** Warn only once per normalization batch to avoid console spam. */
  let snapshotWarnedInBatch = false

  const normalizados = items.map((item) => {
    const registro = item as Partial<ClienteRegistro> & { dados?: Partial<ClienteDados> }
    const dados = registro.dados ?? (registro as unknown as { cliente?: Partial<ClienteDados> }).cliente ?? {}
    const rawId = (registro.id ?? '').toString()
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const sanitizedCandidate = normalizeClienteIdCandidate(rawId)
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
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
        if (!snapshotWarnedInBatch) {
          snapshotWarnedInBatch = true
          console.warn(
            `Não foi possível normalizar o snapshot do cliente (id: ${idNormalizado}). Os dados do cliente foram preservados.`,
            error,
          )
        }
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
      ...(propostaSnapshot ? { propostaSnapshot } : {}),
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

const PROPOSAL_PDF_REMINDER_MESSAGE =
  'Integração de PDF não configurada. Configure o conector para salvar automaticamente ou utilize a opção “Imprimir” para gerar o PDF manualmente.'
const DEFAULT_PREVIEW_TOOLBAR_MESSAGE =
  'Revise o conteúdo e utilize as ações para imprimir ou salvar como PDF.'

const normalizeClienteString = (value: string) =>
  normalizeText(value)
    .replace(/\s+/g, ' ')
    .trim()

const normalizeClienteEmail = (value: string) => value.trim().toLowerCase()

const normalizeClienteNumbers = (value: string) => normalizeNumbers(value)

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

type LeasingAnexoId =
  | 'ANEXO_I'
  | 'ANEXO_II'
  | 'ANEXO_III'
  | 'ANEXO_IV'
  | 'ANEXO_VII'
  | 'ANEXO_VIII'
  | 'ANEXO_X'

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
  {
    id: 'ANEXO_X',
    label: 'Corresponsável financeiro',
    descricao: 'Dados do corresponsável financeiro para assinatura complementar.',
    tipos: ['residencial', 'condominio'],
  },
]

const getDefaultLeasingAnexos = (
  tipo: LeasingContratoTipo,
  options?: { corresponsavelAtivo?: boolean },
): LeasingAnexoId[] => {
  const defaults = LEASING_ANEXOS_CONFIG.filter(
    (anexo) => anexo.autoInclude && anexo.tipos.includes(tipo),
  ).map((anexo) => anexo.id)
  if (options?.corresponsavelAtivo) {
    defaults.push('ANEXO_X')
  }
  return defaults
}

const ensureRequiredLeasingAnexos = (
  anexosSelecionados: LeasingAnexoId[],
  tipo: LeasingContratoTipo,
  options?: { corresponsavelAtivo?: boolean },
): LeasingAnexoId[] => {
  const required = getDefaultLeasingAnexos(tipo, options)
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
  corresponsavelAtivo: boolean
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
  corresponsavelAtivo,
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
  const isRequired = useCallback(
    (config: LeasingAnexoConfig) =>
      Boolean(config.autoInclude || (corresponsavelAtivo && config.id === 'ANEXO_X')),
    [corresponsavelAtivo],
  )
  const opcionais = anexosDisponiveis.filter((config) => !isRequired(config))
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
              const required = isRequired(config)
              const checked = required || anexosSelecionados.includes(config.id)
              const disabled = required || !isAvailable
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
                      {required ? (
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

type CorresponsavelModalProps = {
  draft: LeasingCorresponsavel
  errors: CorresponsavelErrors
  temCorresponsavelFinanceiro: boolean
  onChange: (field: keyof LeasingCorresponsavel, value: string) => void
  onChangeEndereco: (field: keyof LeasingEndereco, value: string) => void
  onSave: () => void
  onDeactivate: () => void
  onClose: () => void
}

function CorresponsavelModal({
  draft,
  errors,
  temCorresponsavelFinanceiro,
  onChange,
  onChangeEndereco,
  onSave,
  onDeactivate,
  onClose,
}: CorresponsavelModalProps) {
  const modalTitleId = useId()
  const endereco = resolveCorresponsavelEndereco(draft.endereco)

  return (
    <div className="modal corresponsavel-modal" role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content corresponsavel-modal__content">
        <div className="modal-header">
          <h3 id={modalTitleId}>Corresponsável financeiro</h3>
          <button className="icon" onClick={onClose} aria-label="Fechar cadastro do corresponsável">
            ✕
          </button>
        </div>
        <div className="modal-body corresponsavel-modal__body">
          <div className="grid g3">
            <Field label="Nome completo" hint={<FieldError message={errors.nome} />}>
              <input
                value={draft.nome}
                onChange={(event) => onChange('nome', event.target.value)}
                placeholder="Nome completo"
              />
            </Field>
            <Field label="CPF" hint={<FieldError message={errors.cpf} />}>
              <input
                value={draft.cpf}
                onChange={(event) => onChange('cpf', formatCpfCnpj(event.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </Field>
            <Field label="Estado civil">
              <input
                value={draft.estadoCivil}
                onChange={(event) => onChange('estadoCivil', event.target.value)}
                placeholder="Ex.: Solteiro(a)"
              />
            </Field>
          </div>
          <div className="grid g3">
            <Field label="Nacionalidade">
              <input
                value={draft.nacionalidade}
                onChange={(event) => onChange('nacionalidade', event.target.value)}
                placeholder="Ex.: Brasileira"
              />
            </Field>
            <Field label="E-mail" hint={<FieldError message={errors.email} />}>
              <input
                type="email"
                value={draft.email}
                onChange={(event) => onChange('email', event.target.value)}
                placeholder="nome@email.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Telefone" hint={<FieldError message={errors.telefone} />}>
              <input
                value={draft.telefone}
                onChange={(event) => onChange('telefone', event.target.value)}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>
          </div>
          <div className="grid g3">
            <Field label="CEP">
              <input
                value={endereco.cep}
                onChange={(event) => onChangeEndereco('cep', formatCep(event.target.value))}
                placeholder="00000-000"
                inputMode="numeric"
              />
            </Field>
            <Field label="Número">
              <input
                value={endereco.numero}
                onChange={(event) => onChangeEndereco('numero', event.target.value)}
                placeholder="Número"
              />
            </Field>
            <Field label="Complemento">
              <input
                value={endereco.complemento}
                onChange={(event) => onChangeEndereco('complemento', event.target.value)}
                placeholder="Apto, bloco, etc."
              />
            </Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Logradouro" hint={<FieldError message={errors.endereco} />}>
                <input
                  value={endereco.logradouro}
                  onChange={(event) => onChangeEndereco('logradouro', event.target.value)}
                  placeholder="Rua, avenida, etc."
                />
              </Field>
            </div>
            <Field label="Bairro">
              <input
                value={endereco.bairro}
                onChange={(event) => onChangeEndereco('bairro', event.target.value)}
                placeholder="Bairro"
              />
            </Field>
            <Field label="Cidade">
              <input
                value={endereco.cidade}
                onChange={(event) => onChangeEndereco('cidade', event.target.value)}
                placeholder="Cidade"
              />
            </Field>
            <Field label="UF">
              <input
                value={endereco.uf}
                onChange={(event) => onChangeEndereco('uf', event.target.value.toUpperCase())}
                placeholder="UF"
                maxLength={2}
              />
            </Field>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancelar
          </button>
          {temCorresponsavelFinanceiro ? (
            <button type="button" className="ghost" onClick={onDeactivate}>
              Desativar
            </button>
          ) : null}
          <button type="button" className="primary" onClick={onSave}>
            Salvar
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

type ConfirmDialogState = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  resolve: (confirmed: boolean) => void
}

type ConfirmDialogProps = {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="modal save-changes-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="modal-backdrop modal-backdrop--opaque" onClick={onCancel} />
      <div className="modal-content save-changes-modal__content">
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
        </div>
        <div className="modal-body" id={descriptionId}>
          <p>{description}</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
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
  /** Pre-opened Window reference. When provided, skips window.open() so Safari popup policy is respected. */
  preOpenedWindow?: Window | null | undefined
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

  // Check if this is Bento Grid HTML (contains the marker)
  if (safeHtml.includes('data-testid="proposal-bento-root"')) {
    // Use Bento Grid document wrapper
    return buildBentoLeasingPdfDocument(safeHtml, safeCliente)
  }

  // Legacy PDF document structure
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


export default function App() {
  const { appTheme, cycleAppTheme } = useTheme()
  const user = useStackUser()
  const {
    isAdmin: isAdminFromStack,
    role: userRole,
    isOffice,
    isFinanceiro,
    isLoading: isStackPermLoading,
    canSeeFinancialAnalysis,
    canSeeContracts,
    canSeeClients,
    canSeeProposals,
    canSeeUsers,
    canSeeDashboard,
    canSeeFinancialManagement,
  } = useStackRbac()

  // Keep a ref to the latest user object so getAccessToken can always call
  // the most recent getAccessToken() without needing user in its deps array.
  // This makes getAccessToken a stable reference that never changes identity,
  // preventing effects that depend on it from re-running on every SDK polling
  // cycle where the Stack Auth user object reference is replaced.
  const userRef = useRef(user)
  userRef.current = user

  // Stable token getter — created once and never recreated (empty deps).
  // Always reads from userRef.current so it picks up token refreshes.
  const getAccessToken = useCallback(
    async (): Promise<string | null> => userRef.current?.getAccessToken() ?? null,
    [], // intentionally empty — stable for the lifetime of the component
  )
  // Read the internal DB role from /api/auth/me. This is the ground-truth for
  // admin status: the bootstrap admin always has role='admin' in the DB, even
  // before the Stack Auth native permission 'role_admin' is granted.
  const { me, authState: meAuthState } = useAuthSession(user ? getAccessToken : null)
  // Fetch and cache the full authorization snapshot from /api/authz/me.
  // The snapshot is reused for offline mode and provides capability-level RBAC.
  const { snapshot: authzSnapshot } = useAuthorizationSnapshot({
    getAccessToken: user ? getAccessToken : null,
    enabled: Boolean(user),
    cleared: !user,
  })

  // isAdmin: Stack Auth native permission OR internal DB role (whichever resolves first).
  // This ensures the admin can see protected pages even before 'role_admin' is
  // granted in the Stack Auth dashboard (which requires STACK_SECRET_SERVER_KEY).
  const isAdmin = isAdminFromStack || (me?.role === 'admin' && me?.authorized === true)

  const authzPermissions = new Set(authzSnapshot?.permissions ?? [])
  const hasAuthzPermission = (...permissionIds: string[]) =>
    permissionIds.some((permissionId) => authzPermissions.has(permissionId))
  const canSeeFinancialAnalysisEffective =
    isAdmin || isOffice || canSeeFinancialAnalysis || hasAuthzPermission('page_financial_analysis', 'page:financial_analysis')
  // role_office ("Acesso irrestrito a todos os clientes e propostas") inherits
  // contracts, clients and proposals visibility — no separate page_* permission needed.
  const canSeeContractsEffective =
    isAdmin || isOffice || canSeeContracts || hasAuthzPermission('page_contracts', 'page:contracts')
  const canSeeClientsEffective =
    isAdmin || isOffice || canSeeClients || hasAuthzPermission('page_clients', 'page:clients')
  const canSeeProposalsEffective =
    isAdmin || isOffice || canSeeProposals || hasAuthzPermission('page_proposals', 'page:proposals')
  const canSeeUsersEffective = isAdmin || canSeeUsers || hasAuthzPermission('page_users', 'page:users')
  const canSeeDashboardEffective =
    isAdmin || canSeeDashboard || hasAuthzPermission('page_dashboard', 'page:dashboard')

  // Carteira de Clientes: admin | office | financeiro
  const canSeePortfolioEffective = isAdmin || isOffice || isFinanceiro

  // Gestão Financeira: requires explicit page_financial_management permission or admin
  const canSeeFinancialManagementEffective =
    isAdmin || canSeeFinancialManagement || hasAuthzPermission('page_financial_management')

  // Keep the redirect guard from firing until BOTH sources have resolved so we
  // don't prematurely redirect the admin away from protected pages.
  const isRbacLoading = isStackPermLoading || meAuthState === 'loading'
  const showAdminDiagnostics = useMemo(() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    return params.get('adminDiag') === '1'
  }, [])

  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      clearOfflineSnapshot()
      // Quick fire-and-forget sync before logout (max 1.5 s) to flush any
      // pending offline queue entries. Does not block logout if offline or slow.
      if (isConnectivityOnline()) {
        await Promise.race([
          runSync(),
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ])
      }
      // performLogout handles all cleanup steps and ends with a hard redirect.
      // The hard redirect means setIsLoggingOut(false) below is rarely reached,
      // but it serves as a safety net if window.location.assign is somehow blocked.
      await performLogout(user ? () => user.signOut() : undefined)
    } catch {
      setIsLoggingOut(false)
    }
  }, [isLoggingOut, user])

  // Check if we're in print mode (for Bento Grid PDF generation)
  const isPrintMode = useMemo(() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    return params.get('mode') === 'print' && params.get('type') === 'leasing'
  }, [])

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
  // Incremented when auth is established so that data-load effects re-run and
  // fetch from Neon. Declared before the auth useEffects to satisfy React's TDZ rules.
  const [authSyncKey, setAuthSyncKey] = useState(0)
  // Stable primitive derived from the Stack Auth user identity.
  // Using user.id (string | null) instead of the user object avoids re-running
  // the bootstrap effect when the SDK replaces the user object reference during
  // internal token refreshes or polling cycles (same user, new object identity).
  const userId = user?.id ?? null
  // Wire up Stack Auth Bearer token for cross-device data persistence.
  // When the user resolves, register the token provider so serverStorage
  // and proposalsApi can include Authorization: Bearer <token> in requests.
  // Storage sync runs only after auth is available to avoid unauthenticated
  // /api/storage calls that can generate noisy 5xx/401 logs.
  //
  // Keyed on userId (primitive) + getAccessToken (stable ref from userRef pattern)
  // so this runs ONCE per real login — not on every SDK polling cycle.
  useEffect(() => {
    if (!userId) return
    setStorageTokenProvider(getAccessToken)
    setProposalsTokenProvider(getAccessToken)
    setClientsTokenProvider(getAccessToken)
    setAdminUsersTokenProvider(getAccessToken)
    setPortfolioTokenProvider(getAccessToken)
    setFinancialManagementTokenProvider(getAccessToken)
    setProjectsTokenProvider(getAccessToken)
    setProjectFinanceTokenProvider(getAccessToken)
    setFinancialImportTokenProvider(getAccessToken)
    setInvoicesTokenProvider(getAccessToken)
    setOperationalDashboardTokenProvider(getAccessToken)
    // Register token provider for the local→Neon migration tool.
    setMigrationTokenProvider(getAccessToken)
    // Register global token provider for httpClient.ts (used by personnelApi
    // and other services that go through the shared apiFetch helper).
    setFetchAuthTokenProvider(getAccessToken)
    // Silently migrate any locally-stored clients/proposals to Neon.
    // Fire-and-forget: errors are caught internally; does not block auth flow.
    void migrateLocalStorageToServer()
    // Re-run server storage sync now that auth is available.
    void ensureServerStorageSync({ timeoutMs: 6000 })
    // Signal data-load effects to re-run now that auth token is available.
    // This fixes cross-device/cross-browser: the initial load runs before auth
    // resolves; this increment triggers a reload once the token provider is set.
    setAuthSyncKey((k) => k + 1)
  }, [userId, getAccessToken])
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

    const htmlElement = document.documentElement
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
    const isKnownPage =
      storedPage === 'dashboard' ||
      storedPage === 'operational-dashboard' ||
      storedPage === 'app' ||
      storedPage === 'crm' ||
      storedPage === 'consultar' ||
      storedPage === 'clientes' ||
      storedPage === 'settings' ||
      storedPage === 'simulacoes' ||
      storedPage === 'admin-users' ||
      storedPage === 'carteira' ||
      storedPage === 'financial-management'

    return isKnownPage ? (storedPage as ActivePage) : 'app'
  })
  // Pending project ID to auto-open in Gestão Financeira when navigating there from another page.
  const [pendingFinancialProjectId, setPendingFinancialProjectId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window === 'undefined') {
      return INITIAL_VALUES.activeTab
    }

    const storedTab = window.localStorage.getItem(STORAGE_KEYS.activeTab)
    return storedTab === 'leasing' || storedTab === 'vendas' ? storedTab : INITIAL_VALUES.activeTab
  })
  const activeTabRef = useRef(activeTab)
  const [simulacoesSection, setSimulacoesSection] = useState<SimulacoesSection>(() => {
    if (typeof window === 'undefined') return 'nova'
    const stored = window.localStorage.getItem(STORAGE_KEYS.simulacoesSection)
    return (stored && (SIMULACOES_SECTIONS as readonly string[]).includes(stored))
      ? (stored as SimulacoesSection)
      : 'nova'
  })
  const [aprovacaoStatus, setAprovacaoStatus] = useState<AprovacaoStatus>('pendente')
  const [aprovacaoChecklist, setAprovacaoChecklist] = useState<
    Record<AprovacaoChecklistKey, boolean>
  >({
    roi: true,
    tir: true,
    spread: false,
    vpl: false,
    payback: true,
    eficiencia: true,
    lucro: true,
  })
  const [ultimaDecisaoTimestamp, setUltimaDecisaoTimestamp] = useState<number | null>(null)

  // Financial Analysis (Spreadsheet v1) state
  const [afModo, setAfModo] = useState<'venda' | 'leasing'>('venda')
  const [afCustoKit, setAfCustoKit] = useState(0)
  const [afCustoKitManual, setAfCustoKitManual] = useState(false)
  const [afFrete, setAfFrete] = useState(0)
  const [afFreteManual, setAfFreteManual] = useState(false)
  const [afDescarregamento, setAfDescarregamento] = useState(0)
  const [afHotelPousada, setAfHotelPousada] = useState(0)
  const [afTransporteCombustivel, setAfTransporteCombustivel] = useState(0)
  const [afOutros, setAfOutros] = useState(0)
  // Travel cost auto-calculation state
  const [afCidadeDestino, setAfCidadeDestino] = useState('')
  const [afDeslocamentoKm, setAfDeslocamentoKm] = useState(0)
  const [afDeslocamentoRs, setAfDeslocamentoRs] = useState(0)
  const [afDeslocamentoStatus, setAfDeslocamentoStatus] = useState<'idle' | 'loading' | 'isenta' | 'ok' | 'error'>('idle')
  const [afDeslocamentoCidadeLabel, setAfDeslocamentoCidadeLabel] = useState('')
  const [afDeslocamentoErro, setAfDeslocamentoErro] = useState('')
  const [afValorContrato, setAfValorContrato] = useState(0)
  const [afImpostosVenda, setAfImpostosVenda] = useState(6)
  const [afImpostosLeasing, setAfImpostosLeasing] = useState(4)
  const [afInadimplencia, setAfInadimplencia] = useState(2)
  const [afCustoOperacional, setAfCustoOperacional] = useState(3)
  const [afMesesProjecao, setAfMesesProjecao] = useState(60)
  const [afMensalidadeBase, setAfMensalidadeBase] = useState(0)
  const [afMensalidadeBaseAuto, setAfMensalidadeBaseAuto] = useState(0)
  const [afMargemLiquidaVenda, setAfMargemLiquidaVenda] = useState(25)
  const [afMargemLiquidaMinima, setAfMargemLiquidaMinima] = useState(15)
  const [afComissaoMinimaPercent, setAfComissaoMinimaPercent] = useState(5)
  const [afTaxaDesconto, setAfTaxaDesconto] = useState(20)
  // Editable base system overrides (0 / '' = unset → memo falls back to proposal value)
  const [afConsumoOverride, setAfConsumoOverride] = useState(0)
  const [afIrradiacaoOverride, setAfIrradiacaoOverride] = useState(0)
  const [afPROverride, setAfPROverride] = useState(0)
  const [afDiasOverride, setAfDiasOverride] = useState(0)
  const [afModuloWpOverride, setAfModuloWpOverride] = useState(0)
  const [afUfOverride, setAfUfOverride] = useState<'' | 'GO' | 'DF'>('')
  // N modules / kWp mutual-calc (null = use engine value)
  const [afNumModulosOverride, setAfNumModulosOverride] = useState<number | null>(null)
  const [afPlaca, setAfPlaca] = useState(18)
  // null = auto (12% of kit), user can override
  // Auto-computed Material CA: max(1000, round(850 + 0.40 × consumo)).
  // Declared before afMaterialCAField (which reads it) to avoid TDZ in production builds.
  const [afAutoMaterialCA, setAfAutoMaterialCA] = useState(0)
  const [afMaterialCAOverride, setAfMaterialCAOverride] = useState<number | null>(null)
  const [afProjetoOverride, setAfProjetoOverride] = useState<number | null>(null)
  const [afCreaOverride, setAfCreaOverride] = useState<number | null>(null)
  const [afCidadeSuggestions, setAfCidadeSuggestions] = useState<CidadeDB[]>([])
  const [afCidadeShowSuggestions, setAfCidadeShowSuggestions] = useState(false)
  const storeAfCidadeDestino = useAfDeslocamentoStore(selectAfCidadeDestino)
  const storeAfDeslocamentoKm = useAfDeslocamentoStore(selectAfDeslocamentoKm)
  const storeAfDeslocamentoRs = useAfDeslocamentoStore(selectAfDeslocamentoRs)
  const storeAfDeslocamentoStatus = useAfDeslocamentoStore(selectAfDeslocamentoStatus)
  const storeAfDeslocamentoCidadeLabel = useAfDeslocamentoStore(selectAfDeslocamentoCidadeLabel)
  const storeAfDeslocamentoErro = useAfDeslocamentoStore(selectAfDeslocamentoErro)
  const storeAfCidadeSuggestions = useAfDeslocamentoStore(selectAfCidadeSuggestions)
  const storeAfCidadeShowSuggestions = useAfDeslocamentoStore(selectAfCidadeShowSuggestions)
  const setStoreAfCidadeDestino = useAfDeslocamentoStore((state) => state.setAfCidadeDestino)
  const setStoreAfDeslocamentoKm = useAfDeslocamentoStore((state) => state.setAfDeslocamentoKm)
  const setStoreAfDeslocamentoRs = useAfDeslocamentoStore((state) => state.setAfDeslocamentoRs)
  const setStoreAfDeslocamentoStatus = useAfDeslocamentoStore((state) => state.setAfDeslocamentoStatus)
  const setStoreAfDeslocamentoCidadeLabel = useAfDeslocamentoStore((state) => state.setAfDeslocamentoCidadeLabel)
  const setStoreAfDeslocamentoErro = useAfDeslocamentoStore((state) => state.setAfDeslocamentoErro)
  const setStoreAfCidadeSuggestions = useAfDeslocamentoStore((state) => state.setAfCidadeSuggestions)
  const setStoreAfCidadeShowSuggestions = useAfDeslocamentoStore((state) => state.setAfCidadeShowSuggestions)
  const selectCidadeAndCalculateDeslocamento = useAfDeslocamentoStore(selectSelectCidadeAndCalculateDeslocamento)
  const afBaseInitializedRef = useRef(false)
  const afCidadeBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // BR money fields for financial analysis currency inputs (type="text", comma support, no spinners)
  const afCustoKitField = useBRNumberField({ mode: 'money', value: afCustoKit, onChange: (v) => { setAfCustoKit(v ?? 0); setAfCustoKitManual(true) } })
  const afValorContratoField = useBRNumberField({ mode: 'money', value: afValorContrato, onChange: (v) => setAfValorContrato(v ?? 0) })
  const afFreteField = useBRNumberField({ mode: 'money', value: afFrete, onChange: (v) => { setAfFrete(v ?? 0); setAfFreteManual(true) } })
  const afDescarregamentoField = useBRNumberField({ mode: 'money', value: afDescarregamento, onChange: (v) => setAfDescarregamento(v ?? 0) })
  const afPlacaField = useBRNumberField({ mode: 'money', value: afPlaca, onChange: (v) => setAfPlaca(v ?? 18) })
  const afHotelPousadaField = useBRNumberField({ mode: 'money', value: afHotelPousada, onChange: (v) => setAfHotelPousada(v ?? 0) })
  const afTransporteCombustivelField = useBRNumberField({ mode: 'money', value: afTransporteCombustivel, onChange: (v) => setAfTransporteCombustivel(v ?? 0) })
  const afOutrosField = useBRNumberField({ mode: 'money', value: afOutros, onChange: (v) => setAfOutros(v ?? 0) })
  const afMensalidadeBaseField = useBRNumberField({ mode: 'money', value: afMensalidadeBase > 0 ? afMensalidadeBase : null, onChange: (v) => setAfMensalidadeBase(v ?? 0) })
  const afMaterialCAField = useBRNumberField({ mode: 'money', value: afMaterialCAOverride ?? afAutoMaterialCA, onChange: (v) => setAfMaterialCAOverride(v != null && v >= 0 ? v : null) })
  const afProjetoField = useBRNumberField({ mode: 'money', value: afProjetoOverride, onChange: (v) => setAfProjetoOverride(v != null && v >= 0 ? v : null) })
  const afCreaField = useBRNumberField({ mode: 'money', value: afCreaOverride, onChange: (v) => setAfCreaOverride(v != null && v >= 0 ? v : null) })
  const isVendaDiretaTab = activeTab === 'vendas'
  useEffect(() => {
    const modo: ModoVenda = isVendaDiretaTab ? 'direta' : 'leasing'
    vendaActions.updateResumoProposta({ modo_venda: modo })
  }, [isVendaDiretaTab])
  // Initialize AF base system overrides from proposal values on first visit to analise section
  useEffect(() => {
    if (simulacoesSection === 'analise' && !afBaseInitializedRef.current) {
      afBaseInitializedRef.current = true
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      setAfIrradiacaoOverride(baseIrradiacao > 0 ? baseIrradiacao : 5.0)
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      setAfPROverride(eficienciaNormalizada > 0 ? eficienciaNormalizada : 0.8)
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      setAfDiasOverride(diasMesNormalizado > 0 ? diasMesNormalizado : 30)
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      setAfModuloWpOverride(potenciaModulo > 0 ? potenciaModulo : 550)
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      setAfUfOverride(ufTarifa === 'DF' ? 'DF' : 'GO')
    }
   
  }, [simulacoesSection])
  // NOTE: kcKwhMes must be declared here — before the useEffect below uses it in its
  // dependency array.  Declaring it any later (e.g. at the original line ~4818 position)
  // places it after the useEffect call site, which causes a Temporal Dead Zone (TDZ)
  // crash in production builds: Terser evaluates the deps array before the `const`
  // initializer has run, producing "Cannot access '<minified>' before initialization".
  const [kcKwhMes, setKcKwhMesState] = useState(INITIAL_VALUES.kcKwhMes)
  // Reactively auto-populate Kit, Frete and Material CA when consumo changes, unless manually edited.
  // Kit  : R$ = round(1500 + 9.5  × kWh/mês)  — fitted on real quotes, always positive margin
  // Frete: R$ = round(300  + 0.52 × kWh/mês)  — same approach; consumo-based (no module count needed)
  // Mat.CA: R$ = max(1000, round(850 + 0.40 × kWh/mês)) — per requirement
  //
  // NOTE: this runs unconditionally (not gated on simulacoesSection === 'analise') so that
  // custoFinalProjetadoCanonico is always populated when a client/proposal is loaded, even
  // before the user visits the "Análise Financeira" section. Previously the guard caused
  // afCustoKit to remain 0 on Leasing/Venda pages, making analiseFinanceiraResult return
  // null and leaving "Valor atual de venda" blank until the AF page was opened manually.
  useEffect(() => {
    const consumo = afConsumoOverride > 0 ? afConsumoOverride : kcKwhMes
    if (consumo <= 0) return
    if (!afCustoKitManual) {
      setAfCustoKit(Math.round(1500 + 9.5 * consumo))
    }
    if (!afFreteManual) {
      setAfFrete(Math.round(300 + 0.52 * consumo))
    }
    // Material CA: always auto-update unless the user typed a manual override
    if (afMaterialCAOverride == null) {
      setAfAutoMaterialCA(Math.max(1000, Math.round(850 + 0.4 * consumo)))
    }
  }, [kcKwhMes, afConsumoOverride, afCustoKitManual, afFreteManual, afMaterialCAOverride])
  const vendasConfig = useVendasConfigStore(vendasConfigSelectors.config)
  const updateVendasConfig = useVendasConfigStore((state) => state.update)
  // City autocomplete: update suggestions as user types
  useEffect(() => {
    const trimmed = afCidadeDestino.trim()
    if (trimmed.length < MIN_CITY_SEARCH_LENGTH) {
      setAfCidadeSuggestions([])
      return
    }
    setAfCidadeSuggestions(searchCidades(trimmed))
  }, [afCidadeDestino])

  const handleSelectCidade = useCallback((city: CidadeDB) => {
    const travelConfig = {
      faixa1Km: vendasConfig.af_deslocamento_faixa1_km,
      faixa1Valor: vendasConfig.af_deslocamento_faixa1_rs,
      faixa2Km: vendasConfig.af_deslocamento_faixa2_km,
      faixa2Valor: vendasConfig.af_deslocamento_faixa2_rs,
      kmExcedenteValor: vendasConfig.af_deslocamento_km_excedente_rs,
    }
    const regioesIsentas = vendasConfig.af_deslocamento_regioes_isentas.map(
      (r) => `${r.cidade}/${r.uf}`,
    )
    const { ufOverride, deslocamentoRs } = selectCidadeAndCalculateDeslocamento(city, {
      travelConfig,
      regioesIsentas,
    })
    setAfUfOverride(ufOverride)
    setAfTransporteCombustivel(deslocamentoRs)
    const snap = useAfDeslocamentoStore.getState()
    setAfCidadeDestino(snap.afCidadeDestino)
    setAfCidadeSuggestions(snap.afCidadeSuggestions)
    setAfCidadeShowSuggestions(snap.afCidadeShowSuggestions)
    setAfDeslocamentoKm(snap.afDeslocamentoKm)
    setAfDeslocamentoRs(snap.afDeslocamentoRs)
    setAfDeslocamentoStatus(snap.afDeslocamentoStatus)
    setAfDeslocamentoCidadeLabel(snap.afDeslocamentoCidadeLabel)
    setAfDeslocamentoErro(snap.afDeslocamentoErro)
  }, [selectCidadeAndCalculateDeslocamento, vendasConfig.af_deslocamento_regioes_isentas, vendasConfig.af_deslocamento_faixa1_km, vendasConfig.af_deslocamento_faixa1_rs, vendasConfig.af_deslocamento_faixa2_km, vendasConfig.af_deslocamento_faixa2_rs, vendasConfig.af_deslocamento_km_excedente_rs])

  useEffect(() => {
    setAfTransporteCombustivel(afDeslocamentoRs)
  }, [afDeslocamentoRs])

  useEffect(() => {
    setStoreAfCidadeDestino(afCidadeDestino)
    setStoreAfDeslocamentoKm(afDeslocamentoKm)
    setStoreAfDeslocamentoRs(afDeslocamentoRs)
    setStoreAfDeslocamentoStatus(afDeslocamentoStatus)
    setStoreAfDeslocamentoCidadeLabel(afDeslocamentoCidadeLabel)
    setStoreAfDeslocamentoErro(afDeslocamentoErro)
    setStoreAfCidadeSuggestions(afCidadeSuggestions)
    setStoreAfCidadeShowSuggestions(afCidadeShowSuggestions)
  }, [
    afCidadeDestino,
    afDeslocamentoKm,
    afDeslocamentoRs,
    afDeslocamentoStatus,
    afDeslocamentoCidadeLabel,
    afDeslocamentoErro,
    afCidadeSuggestions,
    afCidadeShowSuggestions,
    setStoreAfCidadeDestino,
    setStoreAfDeslocamentoKm,
    setStoreAfDeslocamentoRs,
    setStoreAfDeslocamentoStatus,
    setStoreAfDeslocamentoCidadeLabel,
    setStoreAfDeslocamentoErro,
    setStoreAfCidadeSuggestions,
    setStoreAfCidadeShowSuggestions,
  ])

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }
    console.debug('[AF DEBUG]', {
      afCidadeDestino: { state: afCidadeDestino, store: storeAfCidadeDestino },
      afDeslocamentoKm: { state: afDeslocamentoKm, store: storeAfDeslocamentoKm },
      afDeslocamentoRs: { state: afDeslocamentoRs, store: storeAfDeslocamentoRs },
      afDeslocamentoStatus: { state: afDeslocamentoStatus, store: storeAfDeslocamentoStatus },
      afDeslocamentoCidadeLabel: {
        state: afDeslocamentoCidadeLabel,
        store: storeAfDeslocamentoCidadeLabel,
      },
      afDeslocamentoErro: { state: afDeslocamentoErro, store: storeAfDeslocamentoErro },
      afCidadeSuggestions: {
        stateCount: afCidadeSuggestions.length,
        storeCount: storeAfCidadeSuggestions.length,
      },
      afCidadeShowSuggestions: {
        state: afCidadeShowSuggestions,
        store: storeAfCidadeShowSuggestions,
      },
    })
  }, [
    afCidadeDestino,
    afDeslocamentoKm,
    afDeslocamentoRs,
    afDeslocamentoStatus,
    afDeslocamentoCidadeLabel,
    afDeslocamentoErro,
    afCidadeSuggestions,
    afCidadeShowSuggestions,
    storeAfCidadeDestino,
    storeAfDeslocamentoKm,
    storeAfDeslocamentoRs,
    storeAfDeslocamentoStatus,
    storeAfDeslocamentoCidadeLabel,
    storeAfDeslocamentoErro,
    storeAfCidadeSuggestions,
    storeAfCidadeShowSuggestions,
  ])

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

  // Guard protected pages: redirect unauthorized users away from 'settings',
  // 'simulacoes/analise', 'admin-users', and 'dashboard' once RBAC permissions
  // have been resolved. The isRbacLoading check prevents premature redirects.
  useRouteGuard({
    activePage,
    simulacoesSection,
    isRbacLoading,
    isAdmin,
    canSeeFinancialAnalysisEffective,
    canSeeUsersEffective,
    canSeeDashboardEffective,
    canSeePortfolioEffective,
    canSeeFinancialManagementEffective,
    setActivePage,
  })
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
  type ClientsSyncState = 'online-db' | 'reconciling' | 'degraded-api' | 'local-fallback'
  type ClientsSource = 'api' | 'server-storage' | 'local-browser-storage' | 'memory'
  const [orcamentosSalvos, setOrcamentosSalvos] = useState<OrcamentoSalvo[]>([])
  const [proposalsSyncState, setProposalsSyncState] = useState<'synced' | 'pending' | 'failed' | 'local-only'>('pending')
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

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)

  const requestConfirmDialog = useCallback(
    (options: Omit<ConfirmDialogState, 'resolve'>): Promise<boolean> => {
      if (typeof window === 'undefined') {
        return Promise.resolve(false)
      }

      return new Promise<boolean>((resolve) => {
        setConfirmDialog({ ...options, resolve })
      })
    },
    [],
  )

  const resolveConfirmDialog = useCallback((confirmed: boolean) => {
    setConfirmDialog((current) => {
      if (current) {
        current.resolve(confirmed)
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

  // kcKwhMes is declared earlier (before the useEffect that uses it in its dep array)
  // to avoid a Temporal Dead Zone (TDZ) crash in production builds.  See the comment
  // above that declaration for the full explanation.
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
    normalizeTusdTipoClienteValue(INITIAL_VALUES.tusdTipoCliente),
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
  const [tipoRede, setTipoRede] = useState<TipoRede>(INITIAL_VALUES.tipoRede ?? 'nenhum')
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
    INITIAL_VALUES.segmentoCliente
      ? normalizeTipoBasico(INITIAL_VALUES.segmentoCliente)
      : '',
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
    return raw === 1 || raw === 10 || raw === 50 || raw === 100 ? (raw) : 100
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
  const [clientsSyncState, setClientsSyncState] = useState<ClientsSyncState>('reconciling')
  const [clientsSource, setClientsSource] = useState<ClientsSource>('memory')
  const [clientsLastLoadError, setClientsLastLoadError] = useState<string | null>(null)
  const [clientsLastDeleteError, setClientsLastDeleteError] = useState<string | null>(null)
  const [lastSuccessfulApiLoadAt, setLastSuccessfulApiLoadAt] = useState<number | null>(null)
  const [lastDeleteReconciledAt, setLastDeleteReconciledAt] = useState<number | null>(null)
  const [reconciliationReady, setReconciliationReady] = useState(false)
  const [allConsultores, setAllConsultores] = useState<ConsultantEntry[]>(() => {
    // Pre-populate from localStorage so consultant names are available immediately on page
    // refresh / re-login — before the API response arrives (avoids "Sem consultor" flash).
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(CONSULTORES_CACHE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return []
      return (parsed as ConsultantEntry[]).filter((e) => e && typeof e.id === 'string')
    } catch {
      return []
    }
  })
  const [formConsultores, setFormConsultores] = useState<ConsultantPickerEntry[]>([])
  const [clienteEmEdicaoId, setClienteEmEdicaoId] = useState<string | null>(null)
  const clienteEmEdicaoIdRef = useRef<string | null>(clienteEmEdicaoId)
  const lastSavedClienteRef = useRef<ClienteDados | null>(null)
  const [originalClientData, setOriginalClientData] = useState<ClienteDados>(() =>
    cloneClienteDados(CLIENTE_INICIAL),
  )
  const [clientLastSaveStatus, setClientLastSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const clientsLoadInFlightRef = useRef<Promise<ClienteRegistro[]> | null>(null)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clientAutoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clientsSyncStateRef = useRef<ClientsSyncState>(clientsSyncState)
  const deletingClientIdsRef = useRef<Set<string>>(new Set())
  const deletedClientKeysRef = useRef<Set<string>>(new Set())
  const proposalServerIdMapRef = useRef<Record<string, string>>({})
  const clientServerIdMapRef = useRef<Record<string, string>>({})
  const proposalServerAutoSaveInFlightRef = useRef(false)
  const clientServerAutoSaveInFlightRef = useRef(false)
  const clientLastPayloadSignatureRef = useRef<string | null>(null)
  const consultantBackfillRanRef = useRef(false)
  const isHydratingRef = useRef(false)
  const [isHydrating, setIsHydrating] = useState(false)
  const isApplyingCepRef = useRef(false)
  const isEditingEnderecoRef = useRef(false)
  const lastCepAppliedRef = useRef<string>('')
  const isApplyingUcGeradoraCepRef = useRef(false)
  const lastUcGeradoraCepAppliedRef = useRef<string>('')
  const cepCidadeAvisoRef = useRef<string | null>(null)
  const budgetIdMismatchLoggedRef = useRef(false)
  /** Timestamp (ms) of the last budget-id-mismatch warn log. Used to throttle spam. */
  const budgetIdMismatchWarnedAtRef = useRef(0)
  const novaPropostaEmAndamentoRef = useRef(false)
  const lastUfSelecionadaRef = useRef<string>(cliente.uf)

  // Refs to prevent stale closures in getCurrentSnapshot
  const clienteRef = useRef(cliente)
  const kcKwhMesRef = useRef(kcKwhMes)
  const pageSharedStateRef = useRef(pageSharedState)
  /** Stores the logged-in user's linked consultant entry once resolved by fetchConsultantsForPicker.
   *  Used to auto-assign the consultant when a new client form is started (Issue 2). */
  const myConsultorDefaultRef = useRef<{ id: string; nome: string } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      const raw = window.localStorage.getItem(PROPOSAL_SERVER_ID_MAP_STORAGE_KEY)
      if (!raw) {
        proposalServerIdMapRef.current = {}
        return
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (!parsed || typeof parsed !== 'object') {
        proposalServerIdMapRef.current = {}
        return
      }
      proposalServerIdMapRef.current = Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      )
    } catch (error) {
      console.warn('[AutoSave] Failed to hydrate proposal server-id map:', error)
      proposalServerIdMapRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      const raw = window.localStorage.getItem(CLIENT_SERVER_ID_MAP_STORAGE_KEY)
      if (!raw) {
        clientServerIdMapRef.current = {}
        return
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (!parsed || typeof parsed !== 'object') {
        clientServerIdMapRef.current = {}
        return
      }
      clientServerIdMapRef.current = Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      )
    } catch (error) {
      console.warn('[ClienteAutoSave] Failed to hydrate client server-id map:', error)
      clientServerIdMapRef.current = {}
    }
  }, [])

  const updateProposalServerIdMap = useCallback((budgetId: string, serverId: string) => {
    if (typeof window === 'undefined' || !budgetId || !serverId) {
      return
    }
    proposalServerIdMapRef.current = {
      ...proposalServerIdMapRef.current,
      [budgetId]: serverId,
    }
    try {
      window.localStorage.setItem(
        PROPOSAL_SERVER_ID_MAP_STORAGE_KEY,
        JSON.stringify(proposalServerIdMapRef.current),
      )
    } catch (error) {
      console.warn('[AutoSave] Failed to persist proposal server-id map:', error)
    }
  }, [])

  const removeProposalServerIdMapEntry = useCallback((budgetId: string) => {
    if (typeof window === 'undefined' || !budgetId) {
      return
    }
    if (!(budgetId in proposalServerIdMapRef.current)) {
      return
    }
    const next = { ...proposalServerIdMapRef.current }
    delete next[budgetId]
    proposalServerIdMapRef.current = next
    try {
      window.localStorage.setItem(PROPOSAL_SERVER_ID_MAP_STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      console.warn('[AutoSave] Failed to remove proposal server-id map entry:', error)
    }
  }, [])

  const updateClientServerIdMap = useCallback((localClientId: string, serverId: string) => {
    if (typeof window === 'undefined' || !localClientId || !serverId) {
      return
    }
    clientServerIdMapRef.current = {
      ...clientServerIdMapRef.current,
      [localClientId]: serverId,
    }
    try {
      window.localStorage.setItem(
        CLIENT_SERVER_ID_MAP_STORAGE_KEY,
        JSON.stringify(clientServerIdMapRef.current),
      )
    } catch (error) {
      console.warn('[ClienteAutoSave] Failed to persist client server-id map:', error)
    }
  }, [])

  const removeClientServerIdMapEntry = useCallback((localClientId: string) => {
    if (typeof window === 'undefined' || !localClientId) {
      return
    }
    if (!(localClientId in clientServerIdMapRef.current)) {
      return
    }
    const next = { ...clientServerIdMapRef.current }
    delete next[localClientId]
    clientServerIdMapRef.current = next
    try {
      window.localStorage.setItem(CLIENT_SERVER_ID_MAP_STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      console.warn('[ClienteAutoSave] Failed to remove client server-id map entry:', error)
    }
  }, [])

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
  const [cidadeBloqueadaPorCep, setCidadeBloqueadaPorCep] = useState(false)
  const [ucGeradoraCidadeBloqueadaPorCep, setUcGeradoraCidadeBloqueadaPorCep] = useState(false)
  const [ibgeMunicipiosPorUf, setIbgeMunicipiosPorUf] = useState<Record<string, string[]>>({})
  const [ibgeMunicipiosLoading, setIbgeMunicipiosLoading] = useState<Record<string, boolean>>({})
  const ibgeMunicipiosInFlightRef = useRef(new Map<string, Promise<string[]>>())
  const [cidadeSearchTerm, setCidadeSearchTerm] = useState('')
  const [cidadeSelectOpen, setCidadeSelectOpen] = useState(false)
  const [ucsBeneficiarias, setUcsBeneficiarias] = useState<UcBeneficiariaFormState[]>([])
  const leasingContrato = useLeasingStore((state) => state.contrato)
  const _leasingPrazoContratualMeses = useLeasingStore((state) => state.prazoContratualMeses)
  const corresponsavelAtivo = useMemo(() => {
    const corresponsavel = leasingContrato.corresponsavel
    if (!leasingContrato.temCorresponsavelFinanceiro || !corresponsavel) {
      return false
    }
    return Boolean(corresponsavel.nome?.trim() && corresponsavel.cpf?.trim())
  }, [leasingContrato.corresponsavel, leasingContrato.temCorresponsavelFinanceiro])

  const distribuidorasDisponiveis = useMemo(() => {
    if (!ufTarifa) return [] as string[]
    return distribuidorasPorUf[ufTarifa] ?? []
  }, [distribuidorasPorUf, ufTarifa])

  const ensureIbgeMunicipios = useCallback(
    async (uf: string, signal?: AbortSignal): Promise<string[]> => {
      const normalizedUf = uf.trim().toUpperCase()
      if (!normalizedUf) {
        return []
      }
      if (ibgeMunicipiosPorUf[normalizedUf]?.length) {
        return ibgeMunicipiosPorUf[normalizedUf]
      }
      const inflight = ibgeMunicipiosInFlightRef.current.get(normalizedUf)
      if (inflight) {
        return inflight
      }
      const promise = (async () => {
        setIbgeMunicipiosLoading((prev) => ({ ...prev, [normalizedUf]: true }))
        try {
          const response = await fetch(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${normalizedUf}/municipios`,
            { signal },
          )
          if (!response.ok) {
            throw new Error('Falha ao buscar municípios no IBGE.')
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const data: IbgeMunicipio[] = await response.json()
          const municipios = Array.isArray(data)
            ? data
                .map((item) => item?.nome?.trim())
                .filter((item): item is string => Boolean(item))
                .sort((a, b) => a.localeCompare(b, 'pt-BR'))
            : []
          setIbgeMunicipiosPorUf((prev) => ({
            ...prev,
            [normalizedUf]: municipios,
          }))
          return municipios
        } catch (error) {
          if (!(error instanceof DOMException) || error.name !== 'AbortError') {
            console.warn('[IBGE] Não foi possível carregar municípios:', error)
          }
          setIbgeMunicipiosPorUf((prev) => ({
            ...prev,
            [normalizedUf]: prev[normalizedUf] ?? [],
          }))
          return ibgeMunicipiosPorUf[normalizedUf] ?? []
        } finally {
          ibgeMunicipiosInFlightRef.current.delete(normalizedUf)
          setIbgeMunicipiosLoading((prev) => ({ ...prev, [normalizedUf]: false }))
        }
      })()
      ibgeMunicipiosInFlightRef.current.set(normalizedUf, promise)
      return promise
    },
    [ibgeMunicipiosPorUf],
  )

  useEffect(() => {
    const controller = new AbortController()
    const carregarEstadosIbge = async () => {
      try {
        const response = await fetch(
          'https://servicodados.ibge.gov.br/api/v1/localidades/estados',
          { signal: controller.signal },
        )
        if (!response.ok) {
          throw new Error('Falha ao buscar estados no IBGE.')
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data: IbgeEstado[] = await response.json()
        const estados = Array.isArray(data)
          ? data
              .map((item) => item?.sigla?.trim().toUpperCase())
              .filter((item): item is string => Boolean(item))
              .sort((a, b) => a.localeCompare(b, 'pt-BR'))
          : []
        if (estados.length > 0) {
          setUfsDisponiveis(estados)
        }
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'AbortError') {
          console.warn('[IBGE] Não foi possível carregar estados:', error)
        }
      }
    }

    void carregarEstadosIbge()

    return () => {
      controller.abort()
    }
  }, [setUfsDisponiveis])

  const clienteUf = cliente.uf
  const clienteDistribuidorasDisponiveis = useMemo(() => {
    if (!clienteUf) return [] as string[]
    return distribuidorasPorUf[clienteUf] ?? []
  }, [clienteUf, distribuidorasPorUf])
  const clienteUfNormalizada = cliente.uf.trim().toUpperCase()
  const cidadesDisponiveis = useMemo(() => {
    if (!clienteUfNormalizada) return [] as string[]
    return ibgeMunicipiosPorUf[clienteUfNormalizada] ?? []
  }, [clienteUfNormalizada, ibgeMunicipiosPorUf])
  const cidadesCarregando = Boolean(
    clienteUfNormalizada && ibgeMunicipiosLoading[clienteUfNormalizada],
  )
  const cidadesFiltradas = useMemo(() => {
    const termo = normalizeText(cidadeSearchTerm.trim())
    if (!termo) {
      return cidadesDisponiveis
    }
    return cidadesDisponiveis.filter((cidade) => normalizeText(cidade).includes(termo))
  }, [cidadeSearchTerm, cidadesDisponiveis])
  const cidadeManualDigitada = cidadeSearchTerm.trim()
  const cidadeManualDisponivel =
    Boolean(cidadeManualDigitada) &&
    !cidadesDisponiveis.some(
      (cidade) => normalizeText(cidade) === normalizeText(cidadeManualDigitada),
    )

  useEffect(() => {
    if (!clienteUfNormalizada) {
      return
    }
    const controller = new AbortController()
    void ensureIbgeMunicipios(clienteUfNormalizada, controller.signal)
    return () => {
      controller.abort()
    }
  }, [clienteUfNormalizada, ensureIbgeMunicipios])

  useEffect(() => {
    if (cidadeBloqueadaPorCep) {
      setCidadeSelectOpen(false)
      setCidadeSearchTerm('')
    }
  }, [cidadeBloqueadaPorCep])
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
  const clienteConsultorSelectId = useId()
  const clienteHerdeirosContentId = useId()
  const [clienteHerdeirosExpandidos, setClienteHerdeirosExpandidos] = useState(false)
  const [isCorresponsavelModalOpen, setIsCorresponsavelModalOpen] = useState(false)
  const [corresponsavelDraft, setCorresponsavelDraft] =
    useState<LeasingCorresponsavel>(createEmptyCorresponsavel)
  const [corresponsavelErrors, setCorresponsavelErrors] = useState<CorresponsavelErrors>({})
  const [isImportandoClientes, setIsImportandoClientes] = useState(false)
  const [isGerandoBackupBanco, setIsGerandoBackupBanco] = useState(false)
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false)
  // Bulk import preview state
  const [bulkImportPreviewRows, setBulkImportPreviewRows] = useState<AnalyzedImportRow[]>([])
  const [isBulkImportPreviewOpen, setIsBulkImportPreviewOpen] = useState(false)
  const [bulkImportAutoMerge, setBulkImportAutoMerge] = useState(false)
  const [isBulkImportConfirming, setIsBulkImportConfirming] = useState(false)
  const pendingImportRawRowsRef = useRef<Array<{ energyProfile?: Record<string, string | number | null> }>>([])
  const clientesImportInputRef = useRef<HTMLInputElement | null>(null)
  const backupImportInputRef = useRef<HTMLInputElement | null>(null)
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
      consultorId: cliente.consultorId ?? '',
      consultorNome: cliente.consultorNome ?? '',
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
  useEffect(() => {
    if (lastUfSelecionadaRef.current !== clienteUfNormalizada) {
      setCidadeSearchTerm('')
      setCidadeSelectOpen(false)
      lastUfSelecionadaRef.current = clienteUfNormalizada
    }
  }, [clienteUfNormalizada])
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

  const crmState = useCrm({ adicionarNotificacao })
  const {
    crmIntegrationMode,
    setCrmIntegrationMode,
    crmIsSaving,
    crmBackendStatus,
    crmBackendError,
    crmLastSync,
    crmDataset,
    crmKpis,
    crmFinanceiroResumo,
    crmPosVendaResumo,
    handleSyncCrmManualmente,
  } = crmState
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.simulacoesSection, simulacoesSection)
  }, [simulacoesSection])

  const budgetItemsTotal = useMemo(
    () => computeBudgetItemsTotalValue(kitBudget.items),
    [kitBudget.items],
  )

  const budgetMissingSummary = useMemo(() => {
    const info = kitBudget?.missingInfo
    if (!info || !info.modules || !info.inverter || kitBudget.items.length === 0) {
      return null
    }
    const fieldSet = new Set<string>()
    const moduleFields = Array.isArray(info.modules.missingFields) ? info.modules.missingFields : []
    const inverterFields = Array.isArray(info.inverter.missingFields) ? info.inverter.missingFields : []
    moduleFields.forEach((field) => fieldSet.add(field))
    inverterFields.forEach((field) => fieldSet.add(field))
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
        const safeItems = Array.isArray(prev?.items) ? prev.items : []
        const nextItems = safeItems.map((item) => (item.id === itemId ? updater(item) : item))
        return {
          ...prev,
          items: nextItems,
          missingInfo: computeBudgetMissingInfo(nextItems),
        }
      })
    },
    [],
  )

  const _handleBudgetItemTextChange = useCallback(
    (itemId: string, field: 'productName' | 'description', value: string) => {
      updateKitBudgetItem(itemId, (item) => ({ ...item, [field]: value }))
    },
    [updateKitBudgetItem],
  )

  const _handleBudgetItemQuantityChange = useCallback(
    (itemId: string, value: string) => {
      const parsed = parseNumericInput(value)
      const isValidQuantity = typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
      updateKitBudgetItem(itemId, (item) => ({
        ...item,
        quantity: isValidQuantity ? Math.round(parsed) : null,
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
        kcKwhMes,
        tarifaCheia,
        tipoRede,
      }
      return mode === 'venda'
        ? buildRequiredFieldsVenda(input)
        : buildRequiredFieldsLeasing(input)
    },
    [cliente, segmentoCliente, tipoEdificacaoOutro, kcKwhMes, tarifaCheia, tipoRede],
  )

  const validateConsumoMinimoLeasing = useCallback(
    (mensagem: string) => {
      const consumoKwhMes = Number(kcKwhMes)
      if (!Number.isFinite(consumoKwhMes) || consumoKwhMes <= 0) {
        adicionarNotificacao(mensagem, 'error')
        return false
      }
      return true
    },
    [adicionarNotificacao, kcKwhMes],
  )

  const validateTipoRedeLeasing = useCallback(
    (mensagem: string) => {
      if (tipoRede === 'nenhum') {
        adicionarNotificacao(mensagem, 'error')
        return false
      }
      return true
    },
    [adicionarNotificacao, tipoRede],
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

  const validateClienteParaSalvar = useCallback((options?: { silent?: boolean }) => {
    const reportError = (mensagem: string) => {
      if (!options?.silent) {
        adicionarNotificacao(mensagem, 'error')
      }
    }
    const nomeCliente = cliente.nome?.trim() ?? ''
    if (!nomeCliente) {
      reportError('Informe o Nome ou Razão Social para salvar o cliente.')
      return false
    }

    const documentoCliente = cliente.documento?.trim() ?? ''
    if (!documentoCliente) {
      reportError('Informe o CPF/CNPJ para salvar o cliente.')
      return false
    }

    const cepCliente = cliente.cep?.trim() ?? ''
    if (!cepCliente) {
      reportError('Informe o CEP para salvar o cliente.')
      return false
    }

    if (!segmentoCliente) {
      reportError('Selecione o Tipo de Edificação para salvar o cliente.')
      return false
    }

    if (segmentoCliente === 'outros' && !tipoEdificacaoOutro.trim()) {
      reportError('Descreva o Tipo de Edificação para salvar o cliente.')
      return false
    }

    const consumoKwhMes = Number(kcKwhMes)
    if (!Number.isFinite(consumoKwhMes) || consumoKwhMes <= 0) {
      reportError('Informe o Consumo (kWh/mês) para salvar o cliente.')
      return false
    }

    const tarifaValor = Number.isFinite(tarifaCheia) ? tarifaCheia : 0
    if (tarifaValor < 0.9) {
      reportError('Perfil de cliente inelegivel. Tarifa cheia deve ser maior do que R$ 0,90')
      return false
    }

    if (tipoRede === 'nenhum') {
      reportError('Selecione o tipo de rede para salvar o cliente.')
      return false
    }

    return true
  }, [
    cliente.cep,
    cliente.documento,
    cliente.nome,
    kcKwhMes,
    segmentoCliente,
    tarifaCheia,
    tipoEdificacaoOutro,
    tipoRede,
  ])

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
        return 'nenhum'
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
      const { result, action: _action, clienteCiente: _clienteCiente, tipoLigacaoAplicada } = params
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

      const recomendacao =
        upgradeLabel && result.kwMaxUpgrade != null
          ? `upgrade do padrão de entrada para ${upgradeLabel.toLowerCase()} (até ${formatKw(
              result.kwMaxUpgrade,
            )} kW)`
          : 'sem upgrade sugerido para este caso'
      return [
        `Pré-check normativo (${result.uf}).`,
        `Tipo de ligação informado: ${tipoLabel}.`,
        `Potência informada: ${formatKw(result.potenciaInversorKw)} kW (limite do padrão: ${formatKw(
          result.kwMaxPermitido,
        )} kW).`,
        `Situação: ${statusTextMap[result.status]}.`,
        `Recomendação: ${recomendacao}.`,
      ].join('\n')
    },
    [],
  )

  const isPrecheckObservationTextValid = useCallback((text: string) => {
    const lines = text.split('\n')
    if (lines.length > 5) return false
    if (lines.some((line) => line.trim().length === 0)) return false
    if (lines.some((line) => line.length > 120)) return false
    if (/(\[PRECHECK|{|}|<|>|•)/.test(text)) return false
    if (/cliente ciente/i.test(text)) return false
    if (/[\u{1F300}-\u{1FAFF}]/u.test(text)) return false
    return true
  }, [])

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

  const cleanPrecheckObservation = useCallback((value: string) => {
    return value
      .replace(/(^|\n)Pré-check normativo[\s\S]*?(?:\n{2,}|$)/g, '$1')
      .split('\n')
      .filter((line) => !/Pré-check normativo|\[PRECHECK|\{|\}|•|Cliente ciente/i.test(line))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }, [])

  const upsertPrecheckObservation = useCallback(
    (block: string) => {
      setConfiguracaoUsinaObservacoes((prev) => {
        const cleaned = cleanPrecheckObservation(prev)
        if (!cleaned) {
          return block
        }
        return `${cleaned}\n\n${block}`
      })
    },
    [cleanPrecheckObservation, setConfiguracaoUsinaObservacoes],
  )

  const removePrecheckObservation = useCallback(() => {
    setConfiguracaoUsinaObservacoes((prev) => cleanPrecheckObservation(prev))
  }, [cleanPrecheckObservation, setConfiguracaoUsinaObservacoes])

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
    const custosFixosPadrao = getCustosFixosContaEnergiaPadrao(cliente.cidade)
    if (custosFixosPadrao != null) {
      return custosFixosPadrao
    }
    const calculada = calcularTaxaMinima(tipoRede, Math.max(0, tarifaCheia))
    return Math.round(calculada * 100) / 100
  }, [cliente.cidade, tarifaCheia, tipoRede])
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
    if (tipo === 'residencial') return 70
    if (tipo === 'comercial') return 80
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
    const info = kitBudget?.missingInfo ?? null
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

    const modulesMissingFields = Array.isArray(info?.modules?.missingFields) ? info.modules.missingFields : []
    const inverterMissingFields = Array.isArray(info?.inverter?.missingFields) ? info.inverter.missingFields : []

    if (info) {
      if (modulesMissingFields.length > 0 && tryFocusCategory(info.modules)) {
        return
      }
      if (inverterMissingFields.length > 0 && tryFocusCategory(info.inverter)) {
        return
      }
    }

    const modulesMissing = info ? modulesMissingFields.length > 0 : true
    if (modulesMissing && moduleQuantityInputRef.current) {
      moduleQuantityInputRef.current.focus()
      moduleQuantityInputRef.current.select?.()
      return
    }
    if (info && inverterMissingFields.length > 0 && inverterModelInputRef.current) {
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
  const [useBentoGridPdf, setUseBentoGridPdf] = useState(() => {
    if (typeof window === 'undefined') {
      return INITIAL_VALUES.useBentoGridPdf
    }
    const stored = window.localStorage.getItem('useBentoGridPdf')
    return stored !== null ? stored === 'true' : INITIAL_VALUES.useBentoGridPdf
  })
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    
    try {
      window.localStorage.setItem('useBentoGridPdf', useBentoGridPdf.toString())
    } catch (error) {
      console.warn('Não foi possível persistir a preferência de Bento Grid PDF.', error)
    }
  }, [useBentoGridPdf])

  const [mobileSimpleView, setMobileSimpleView] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    const stored = window.localStorage.getItem('mobileSimpleView')
    return stored !== null ? stored === 'true' : true
  })
  const [desktopSimpleView, setDesktopSimpleView] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    const stored = window.localStorage.getItem('desktopSimpleView')
    return stored !== null ? stored === 'true' : true
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem('mobileSimpleView', mobileSimpleView.toString())
    } catch (error) {
      console.warn('Não foi possível persistir a preferência Mobile view simples.', error)
    }
  }, [mobileSimpleView])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem('desktopSimpleView', desktopSimpleView.toString())
    } catch (error) {
      console.warn('Não foi possível persistir a preferência Desktop view simples.', error)
    }
  }, [desktopSimpleView])

  const isMobileSimpleEnabled = isMobileViewport && mobileSimpleView
  const isDesktopSimpleEnabled = !isMobileViewport && desktopSimpleView
  const shouldHideSimpleViewItems = isMobileSimpleEnabled || isDesktopSimpleEnabled

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
  const [clientReadinessErrors, setClientReadinessErrors] = useState<ValidationIssue[] | null>(null)
  const [leasingAnexosSelecionados, setLeasingAnexosSelecionados] = useState<LeasingAnexoId[]>(() =>
    getDefaultLeasingAnexos(leasingContrato.tipoContrato, { corresponsavelAtivo }),
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
        : getDefaultLeasingAnexos(leasingContrato.tipoContrato, { corresponsavelAtivo })
      return ensureRequiredLeasingAnexos(baseSelecionados, leasingContrato.tipoContrato, {
        corresponsavelAtivo,
      })
    })
  }, [corresponsavelAtivo, leasingContrato.tipoContrato])

  useEffect(() => {
    setLeasingAnexosSelecionados((prev) => {
      if (!corresponsavelAtivo) {
        return prev.filter((id) => id !== 'ANEXO_X')
      }
      return ensureRequiredLeasingAnexos(prev, leasingContrato.tipoContrato, {
        corresponsavelAtivo,
      })
    })
  }, [corresponsavelAtivo, leasingContrato.tipoContrato])

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
        if (import.meta.env.DEV) console.warn('[Tarifa] Não foi possível atualizar tarifa cheia automaticamente:', error)
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
  const _tipoLigacaoNorma = useMemo(() => normalizeTipoLigacaoNorma(tipoRede), [tipoRede])
  const precheckNormativo = useMemo(
    () =>
      calcularPrecheckNormativo({
        uf: ufNorma,
        tipoRede,
        potenciaKw: potenciaInstaladaKwp,
      }),
    [potenciaInstaladaKwp, tipoRede, ufNorma],
  )
  const normCompliance = precheckNormativo.compliance
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
      if (precheckNormativo.status === 'INDETERMINADO') {
        return {
          tone: 'neutral',
          title: 'Pré-check normativo (padrão de entrada)',
          statusLabel: 'INDETERMINADO',
          message: precheckNormativo.observacoes.join(' '),
          details: [] as string[],
        }
      }
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
    const isAboveLimit =
      normCompliance.status === 'FORA_DA_NORMA' || normCompliance.status === 'LIMITADO'
    if (isAboveLimit && normCompliance.upgradeTo && normCompliance.kwMaxUpgrade != null) {
      const limiteUpgradeLabel = formatKw(normCompliance.kwMaxUpgrade)
      details.push(
        `Upgrade sugerido: ${formatTipoLigacaoLabel(normCompliance.upgradeTo)} até ${limiteUpgradeLabel} kW.`,
      )
    }

    const statusMap = {
      OK: { tone: 'ok', label: 'Dentro do limite', message: 'Dentro do limite do padrão informado.' },
      WARNING: {
        tone: 'error',
        label: 'Regra provisória',
        message: 'Regra provisória: valide com a distribuidora antes do envio.',
      },
      FORA_DA_NORMA: {
        tone: 'error',
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
  }, [normCompliance, precheckNormativo, ufNorma])
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
  useEffect(() => {
    if (!precheckModalData || !normCompliance) {
      return
    }

    setPrecheckModalData(normCompliance)
  }, [normCompliance, precheckModalData])
  useEffect(() => {
    if (!normCompliance) {
      if (precheckNormativo.status === 'INDETERMINADO') {
        removePrecheckObservation()
      }
      return
    }

    const observation = buildPrecheckObservationBlock({
      result: normCompliance,
      action: 'proceed',
      clienteCiente: precheckClienteCiente,
    })

    if (!isPrecheckObservationTextValid(observation)) {
      return
    }

    upsertPrecheckObservation(observation)
  }, [
    buildPrecheckObservationBlock,
    isPrecheckObservationTextValid,
    normCompliance,
    precheckClienteCiente,
    precheckNormativo.status,
    removePrecheckObservation,
    upsertPrecheckObservation,
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
      return true
    }

    if (decision.action === 'adjust_upgrade') {
      const limite =
        normCompliance.kwMaxUpgrade ?? normCompliance.kwMaxPermitido ?? normCompliance.potenciaInversorKw
      const tipo = normCompliance.upgradeTo ?? normCompliance.tipoLigacao
      applyNormativeAdjustment({ potenciaKw: limite, tipoLigacao: tipo })
      await Promise.resolve()
      return true
    }

    if (decision.action === 'proceed' && decision.clienteCiente) {
      setPrecheckClienteCiente(true)
      return true
    }

    return false
  }, [
    applyNormativeAdjustment,
    normCompliance,
    requestPrecheckDecision,
    setPrecheckClienteCiente,
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

  useEffect(() => {
    if (tipoRedeControle !== 'auto') {
      return
    }
    if (!tipoRedeAutoSugestao) {
      return
    }
    if (tipoRede === tipoRedeAutoSugestao) {
      return
    }
    setTipoRede(tipoRedeAutoSugestao)
  }, [tipoRede, tipoRedeAutoSugestao, tipoRedeControle])

  const margemLucroPadraoFracao = useMemo(() => {
    const percentual = Number(vendasConfig.margem_operacional_padrao_percent)
    if (!Number.isFinite(percentual)) return 0
    return Math.max(0, percentual) / 100
  }, [vendasConfig.margem_operacional_padrao_percent])

  const comissaoPadraoFracao = useMemo(() => {
    const percentual = Number(vendasConfig.comissao_default_percent)
    if (!Number.isFinite(percentual)) return 0
    return Math.max(0, percentual) / 100
  }, [vendasConfig.comissao_default_percent])

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

    const projectedCosts = calcProjectedCostsByConsumption({
      consumoKwhMes: kcKwhMes,
      uf: ufTarifa,
      tarifaCheia,
      descontoPercentual: desconto,
      irradiacao: baseIrradiacao,
      performanceRatio: eficienciaNormalizada,
      diasMes: diasMesNormalizado > 0 ? diasMesNormalizado : DIAS_MES_PADRAO,
      potenciaModuloWp: potenciaModulo,
      margemLucroPct: margemLucroPadraoFracao,
      comissaoVendaPct: comissaoPadraoFracao,
    })

    if (!projectedCosts) {
      setAutoKitValor(null)
      setAutoCustoFinal(null)
      setAutoPricingRede(null)
      setAutoPricingVersion(null)
      return
    }

    const custoFinalProjetado = isVendaDiretaTab
      ? projectedCosts.custoFinalVenda
      : projectedCosts.custoFinalLeasing

    setAutoKitValor(projectedCosts.kitAtualizado)
    setAutoCustoFinal(custoFinalProjetado)
    setAutoPricingRede(projectedCosts.potenciaKwp > 23.22 ? 'trifasico' : 'mono')
    setAutoPricingVersion('pricing_consumo_v3')

  }, [
    installTypeNormalized,
    systemTypeNormalized,
    modoOrcamento,
    potenciaKwpElegivel,
    setModoOrcamento,
    kcKwhMes,
    ufTarifa,
    tarifaCheia,
    desconto,
    baseIrradiacao,
    eficienciaNormalizada,
    diasMesNormalizado,
    potenciaModulo,
    isVendaDiretaTab,
    margemLucroPadraoFracao,
    comissaoPadraoFracao,
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

  const _vendaQuantidadeModulos = useMemo(() => {
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
    const tusdValido: TipoClienteTUSD = vendaForm.tusd_tipo_cliente
      ? normalizeTusdTipoClienteValue(vendaForm.tusd_tipo_cliente)
      : INITIAL_VALUES.tusdTipoCliente
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
      updateVenda: tusdValido !== tusdResolvido,
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

  // Sincroniza Consumo (kWh/mês) com a geração estimada sempre que o sistema
  // tiver potência suficiente para calcular geracaoMensalKwh e o consumo ainda
  // não foi editado manualmente pelo usuário (consumoManual === false).
  // Resolve o impasse em que o segundo efeito (abaixo) exige vendaAutoPotenciaKwp
  // que, por sua vez, precisa de kcKwhMes > 0 — ovo-e-galinha.
  useEffect(() => {
    if (consumoManual) {
      return
    }

    if (geracaoMensalKwh <= 0) {
      return
    }

    const geracaoArredondada = Math.round(geracaoMensalKwh * 10) / 10

    if (numbersAreClose(kcKwhMes, geracaoArredondada, 0.05)) {
      return
    }

    setKcKwhMes(geracaoArredondada, 'auto')

    setVendaForm((prev) => {
      if (numbersAreClose(prev.consumo_kwh_mes ?? 0, geracaoArredondada, 0.05)) {
        return prev
      }
      return { ...prev, consumo_kwh_mes: geracaoArredondada }
    })

    setVendaFormErrors((prev) => {
      if (!prev.consumo_kwh_mes) {
        return prev
      }
      const { consumo_kwh_mes: _omit, ...rest } = prev
      return rest
    })
  }, [
    consumoManual,
    geracaoMensalKwh,
    kcKwhMes,
    setKcKwhMes,
    setVendaForm,
    setVendaFormErrors,
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

  const _composicaoTelhadoSubtotalSemLucro = useMemo(
    () =>
      sumComposicaoValoresExcluding(composicaoTelhado, [
        'lucroBruto',
        'comissaoLiquida',
        'impostoRetido',
      ]),
    [composicaoTelhado],
  )

  const _composicaoSoloSubtotalSemLucro = useMemo(
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

  const capex = useMemo(() => {
    const projected = calcProjectedCostsByConsumption({
      consumoKwhMes: kcKwhMes,
      uf: ufTarifa,
      tarifaCheia,
      descontoPercentual: desconto,
      irradiacao: baseIrradiacao,
      performanceRatio: eficienciaNormalizada,
      diasMes: diasMesNormalizado > 0 ? diasMesNormalizado : DIAS_MES_PADRAO,
      potenciaModuloWp: potenciaModulo,
      margemLucroPct: margemLucroPadraoFracao,
      comissaoVendaPct: comissaoPadraoFracao,
    })
    if (projected) {
      return Math.max(0, projected.custoBaseProjeto)
    }
    return potenciaInstaladaKwp * precoPorKwp
  }, [
    baseIrradiacao,
    kcKwhMes,
    desconto,
    diasMesNormalizado,
    eficienciaNormalizada,
    kcKwhMes,
    potenciaInstaladaKwp,
    potenciaModulo,
    precoPorKwp,
    tarifaCheia,
    ufTarifa,
    margemLucroPadraoFracao,
    comissaoPadraoFracao,
  ])

  // AF-specific simulation state used ONLY to derive afMensalidadeBaseAuto.
  // Built from AF's own raw inputs — never spread from simulationState (leasing proposal) —
  // so that the auto mensalidade shown in Análise Financeira always reflects AF's local
  // consumo and generation, not the Proposta de Leasing values ("local first" policy).
  const afSimEstadoMensalidade = useMemo<SimulationState | null>(() => {
    const resolveOverride = (override: number, fallback: number, def: number) => {
      const v = override > 0 ? override : fallback
      return v > 0 ? v : def
    }
    const consumo = resolveOverride(afConsumoOverride, kcKwhMes, 0)
    if (consumo <= 0) return null

    const irr = resolveOverride(afIrradiacaoOverride, baseIrradiacao, 5.0)
    const pr = resolveOverride(afPROverride, eficienciaNormalizada, 0.8)
    const dias = resolveOverride(afDiasOverride, diasMesNormalizado, 30)
    const modulo = resolveOverride(afModuloWpOverride, potenciaModulo, 550)

    let potenciaKwp = 0
    if (afNumModulosOverride != null && afNumModulosOverride > 0) {
      potenciaKwp = (afNumModulosOverride * modulo) / 1000
    } else {
      const computed = calcPotenciaSistemaKwp({
        consumoKwhMes: consumo,
        irradiacao: irr,
        performanceRatio: pr,
        diasMes: dias,
        potenciaModuloWp: modulo,
      })
      potenciaKwp = computed?.potenciaKwp ?? 0
    }
    const afGeracaoKwh = potenciaKwp * irr * pr * dias

    const tusdPercentual = Math.max(0, tusdPercent)
    const tusdSubtipoNorm = tusdSubtipo.trim()
    return {
      kcKwhMes: consumo,
      consumoMensalKwh: consumo,
      geracaoMensalKwh: Math.max(0, afGeracaoKwh),
      prazoMeses: afMesesProjecao,
      entradaRs: 0,
      modoEntrada: 'NONE',
      // Tariff/TUSD fields — same normalization used in simulationState and afSimState
      tarifaCheia: Math.max(0, tarifaCheia),
      desconto: Math.max(0, Math.min(descontoConsiderado / 100, 1)),
      inflacaoAa: Math.max(-0.99, inflacaoAa / 100),
      taxaMinima: taxaMinimaInputEmpty
        ? calcularTaxaMinima(tipoRede, Math.max(0, tarifaCheia))
        : Number.isFinite(taxaMinima) ? Math.max(0, taxaMinima) : 0,
      aplicaTaxaMinima: vendaForm.aplica_taxa_minima ?? true,
      tipoRede,
      tusdPercent: tusdPercentual,
      tusdPercentualFioB: tusdPercentual,
      tusdTipoCliente,
      tusdSubtipo: tusdSubtipoNorm.length > 0 ? tusdSubtipoNorm : null,
      tusdSimultaneidade: tusdSimultaneidade != null ? Math.max(0, tusdSimultaneidade) : null,
      tusdTarifaRkwh: tusdTarifaRkwh != null ? Math.max(0, tusdTarifaRkwh) : null,
      tusdAnoReferencia: Number.isFinite(tusdAnoReferencia)
        ? Math.max(1, Math.trunc(tusdAnoReferencia))
        : DEFAULT_TUSD_ANO_REFERENCIA,
      mesReajuste: Math.min(Math.max(Math.round(mesReajuste) || 6, 1), 12),
      mesReferencia: Math.min(Math.max(Math.round(mesReferencia) || 1, 1), 12),
      encargosFixos,
      cidKwhBase,
      // Fields not consulted by selectMensalidades — safe zero defaults
      vm0: 0,
      depreciacaoAa: 0,
      ipcaAa: 0,
      inadimplenciaAa: 0,
      tributosAa: 0,
      custosFixosM: 0,
      opexM: 0,
      seguroM: 0,
      cashbackPct: 0,
      pagosAcumManual: 0,
      duracaoMeses: 0,
    }
  }, [
    afConsumoOverride, kcKwhMes,
    afIrradiacaoOverride, baseIrradiacao,
    afPROverride, eficienciaNormalizada,
    afDiasOverride, diasMesNormalizado,
    afModuloWpOverride, potenciaModulo,
    afNumModulosOverride,
    afMesesProjecao,
    tarifaCheia, descontoConsiderado, inflacaoAa, taxaMinima, taxaMinimaInputEmpty,
    tipoRede, tusdPercent, tusdTipoCliente, tusdSubtipo, tusdSimultaneidade,
    tusdTarifaRkwh, tusdAnoReferencia, mesReajuste, mesReferencia,
    vendaForm.aplica_taxa_minima, encargosFixos, cidKwhBase,
  ])

  const analiseFinanceiraResult = useMemo(() => {
    const resolveOverride = (override: number, fallback: number, defaultVal: number) => {
      const v = override > 0 ? override : fallback
      return v > 0 ? v : defaultVal
    }
    const irr = resolveOverride(afIrradiacaoOverride, baseIrradiacao, 5.0)
    const pr = resolveOverride(afPROverride, eficienciaNormalizada, 0.8)
    const dias = resolveOverride(afDiasOverride, diasMesNormalizado, 30)
    const consumo = resolveOverride(afConsumoOverride, kcKwhMes, 0)
    const modulo = resolveOverride(afModuloWpOverride, potenciaModulo, 550)
    const uf = (afUfOverride || ufTarifa) === 'DF' ? 'DF' as const : 'GO' as const

    if (consumo <= 0 || afCustoKit <= 0) {
      return null
    }

    // Pre-compute base system using the same engine as the leasing proposals page
    const nModulosOverride = afNumModulosOverride != null && afNumModulosOverride > 0
      ? afNumModulosOverride
      : undefined
    let baseSistema: { quantidade_modulos: number; potencia_sistema_kwp: number }
    if (nModulosOverride != null) {
      baseSistema = { quantidade_modulos: nModulosOverride, potencia_sistema_kwp: (nModulosOverride * modulo) / 1000 }
    } else {
      const computed = calcPotenciaSistemaKwp({
        consumoKwhMes: consumo,
        irradiacao: irr,
        performanceRatio: pr,
        diasMes: dias,
        potenciaModuloWp: modulo,
      })
      if (!computed) return null
      const qtd = computed.quantidadeModulos ?? Math.ceil((computed.potenciaKwp * 1000) / modulo)
      baseSistema = { quantidade_modulos: qtd, potencia_sistema_kwp: computed.potenciaKwp }
    }
    const instalacaoCalculada = baseSistema.quantidade_modulos * 70

    // Pre-compute variable cost for leasing (used as valor_contrato for insurance)
    const preProjetoCusto = resolveCustoProjetoPorFaixa(baseSistema.potencia_sistema_kwp)
    const preMaterialCA = afMaterialCAOverride != null ? afMaterialCAOverride : afAutoMaterialCA
    const preCrea = resolveCrea(uf)
    const prePlaca = afPlaca > 0 ? afPlaca : baseSistema.quantidade_modulos * PRECO_PLACA_RS
    const preProjetoFinal = afProjetoOverride != null ? afProjetoOverride : preProjetoCusto
    const preCreaFinal = afCreaOverride != null ? afCreaOverride : preCrea
    const preCustoVariavel =
      afCustoKit +
      afFrete +
      afDescarregamento +
      preProjetoFinal +
      instalacaoCalculada +
      preMaterialCA +
      preCreaFinal +
      prePlaca +
      afHotelPousada +
      afTransporteCombustivel +
      afOutros +
      afDeslocamentoRs

    const valorContrato = afModo === 'leasing' ? preCustoVariavel : afValorContrato
    // Build the projected mensalidades series for leasing mode using an AF-isolated
    // SimulationState. This prevents the Proposta de Leasing's simulationState (which
    // uses the proposal's own consumo/geração/prazo) from contaminating the AF calculation.
    // Each screen uses the same motor but with its own input context.
    let mensalidadesFinal: number[]
    if (afModo === 'leasing' && afMensalidadeBase <= 0) {
      // Compute AF's monthly generation from its own irr/PR/dias/kWp inputs
      const afGeracaoKwh = baseSistema.potencia_sistema_kwp * irr * pr * dias
      // Build AF-specific SimulationState from raw component variables.
      // IMPORTANT: do NOT spread `simulationState` here — it is declared later in this
      // component and referencing it before its const-declaration would cause a
      // Temporal Dead Zone (TDZ) crash ("Cannot access '...' before initialization").
      // All fields are built from the same raw state/derived variables that
      // `simulationState` uses, so the values are equivalent for the fields that
      // selectMensalidades actually reads.
      const afSimState: SimulationState = {
        // AF-specific overrides
        kcKwhMes: consumo,
        consumoMensalKwh: consumo,
        geracaoMensalKwh: afGeracaoKwh,
        prazoMeses: afMesesProjecao,
        entradaRs: 0,
        modoEntrada: 'NONE',
        // Shared tariff/TUSD fields — same normalization as simulationState
        tarifaCheia: Math.max(0, tarifaCheia),
        desconto: Math.max(0, Math.min(descontoConsiderado / 100, 1)),
        inflacaoAa: Math.max(-0.99, inflacaoAa / 100),
        taxaMinima: taxaMinimaInputEmpty
          ? calcularTaxaMinima(tipoRede, Math.max(0, tarifaCheia))
          : Number.isFinite(taxaMinima) ? Math.max(0, taxaMinima) : 0,
        aplicaTaxaMinima: vendaForm.aplica_taxa_minima ?? true,
        tipoRede,
        tusdPercent: Math.max(0, tusdPercent),
        tusdPercentualFioB: Math.max(0, tusdPercent),
        tusdTipoCliente,
        tusdSubtipo: tusdSubtipo.trim().length > 0 ? tusdSubtipo.trim() : null,
        tusdSimultaneidade: tusdSimultaneidade != null ? Math.max(0, tusdSimultaneidade) : null,
        tusdTarifaRkwh: tusdTarifaRkwh != null ? Math.max(0, tusdTarifaRkwh) : null,
        tusdAnoReferencia: Number.isFinite(tusdAnoReferencia)
          ? Math.max(1, Math.trunc(tusdAnoReferencia))
          : DEFAULT_TUSD_ANO_REFERENCIA,
        mesReajuste: Math.min(Math.max(Math.round(mesReajuste) || 6, 1), 12),
        mesReferencia: Math.min(Math.max(Math.round(mesReferencia) || 1, 1), 12),
        encargosFixos,
        cidKwhBase,
        // Fields not consulted by selectMensalidades — safe zero defaults
        vm0: 0,
        depreciacaoAa: 0,
        ipcaAa: 0,
        inadimplenciaAa: 0,
        tributosAa: 0,
        custosFixosM: 0,
        opexM: 0,
        seguroM: 0,
        cashbackPct: 0,
        pagosAcumManual: 0,
        duracaoMeses: 0,
      }
      const rawSeries = selectMensalidades(afSimState)
      if (rawSeries.length >= afMesesProjecao) {
        mensalidadesFinal = rawSeries.slice(0, afMesesProjecao)
      } else if (rawSeries.length > 0) {
        const last = rawSeries[rawSeries.length - 1]
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        mensalidadesFinal = [...rawSeries, ...Array(afMesesProjecao - rawSeries.length).fill(last)]
      } else {
        mensalidadesFinal = Array(afMesesProjecao).fill(afMensalidadeBaseAuto) as number[]
      }
    } else {
      const base = afMensalidadeBase > 0 ? afMensalidadeBase : afMensalidadeBaseAuto
      mensalidadesFinal = Array(afMesesProjecao).fill(base) as number[]
    }
    const margemAlvo = afMargemLiquidaVenda

    try {
      const input: AnaliseFinanceiraInput = {
        modo: afModo,
        uf,
        consumo_kwh_mes: consumo,
        irradiacao_kwh_m2_dia: irr,
        performance_ratio: pr,
        dias_mes: dias,
        potencia_modulo_wp: modulo,
        ...(nModulosOverride != null ? { quantidade_modulos_override: nModulosOverride } : {}),
        custo_kit_rs: afCustoKit,
        frete_rs: afFrete,
        descarregamento_rs: afDescarregamento,
        instalacao_rs: instalacaoCalculada,
        hotel_pousada_rs: afHotelPousada,
        transporte_combustivel_rs: afTransporteCombustivel,
        outros_rs: afOutros,
        deslocamento_instaladores_rs: afDeslocamentoRs,
        placa_rs_override: prePlaca,
        material_ca_rs_override: preMaterialCA,
        projeto_rs_override: preProjetoFinal,
        crea_rs_override: preCreaFinal,
        valor_contrato_rs: valorContrato,
        impostos_percent: afModo === 'venda' ? afImpostosVenda : afImpostosLeasing,
        custo_fixo_rateado_percent: vendasConfig.af_custo_fixo_rateado_percent,
        lucro_minimo_percent: vendasConfig.af_lucro_minimo_percent,
        comissao_minima_percent: afComissaoMinimaPercent,
        margem_liquida_alvo_percent: afModo === 'venda' ? margemAlvo : undefined,
        margem_liquida_minima_percent: afModo === 'venda' ? afMargemLiquidaMinima : undefined,
        inadimplencia_percent: afInadimplencia,
        custo_operacional_percent: afCustoOperacional,
        meses_projecao: mensalidadesFinal.length,
        mensalidades_previstas_rs: mensalidadesFinal,
        investimento_inicial_rs: preCustoVariavel,
        taxa_desconto_aa_pct: afTaxaDesconto > 0 ? afTaxaDesconto : null,
      }
      return calcularAnaliseFinanceira(input)
    } catch {
      return null
    }
  }, [
    afConsumoOverride,
    afIrradiacaoOverride,
    afPROverride,
    afDiasOverride,
    afModuloWpOverride,
    afUfOverride,
    afNumModulosOverride,
    afCustoKit,
    afCustoOperacional,
    afDescarregamento,
    afFrete,
    afHotelPousada,
    afTransporteCombustivel,
    afOutros,
    afDeslocamentoRs,
    afInadimplencia,
    afMensalidadeBase,
    afMesesProjecao,
    // NOTE: the raw deps below replace the former `simulationState` entry.
    // `simulationState` is declared AFTER this useMemo in the component body,
    // so referencing it caused a TDZ crash.  Instead, list the raw variables
    // that afSimState actually reads (same set simulationState is built from).
    tarifaCheia,
    descontoConsiderado,
    inflacaoAa,
    taxaMinima,
    taxaMinimaInputEmpty,
    tipoRede,
    tusdPercent,
    tusdTipoCliente,
    tusdSubtipo,
    tusdSimultaneidade,
    tusdTarifaRkwh,
    tusdAnoReferencia,
    mesReajuste,
    mesReferencia,
    vendaForm.aplica_taxa_minima,
    encargosFixos,
    cidKwhBase,
    afModo,
    afValorContrato,
    afImpostosVenda,
    afImpostosLeasing,
    afMargemLiquidaVenda,
    afMargemLiquidaMinima,
    afPlaca,
    afMaterialCAOverride,
    afAutoMaterialCA,
    afProjetoOverride,
    afCreaOverride,
    baseIrradiacao,
    diasMesNormalizado,
    eficienciaNormalizada,
    kcKwhMes,
    afMensalidadeBaseAuto,
    potenciaModulo,
    ufTarifa,
    afComissaoMinimaPercent,
    afTaxaDesconto,
    vendasConfig.af_custo_fixo_rateado_percent,
    vendasConfig.af_lucro_minimo_percent,
  ])

  const indicadorEficienciaProjeto = useMemo(() => {
    if (!analiseFinanceiraResult || afModo !== 'leasing') return null

    const payback = analiseFinanceiraResult.payback_total_meses ?? Number.POSITIVE_INFINITY
    const roi = analiseFinanceiraResult.roi_percent ?? 0
    const tir = analiseFinanceiraResult.tir_anual_percent ?? 0
    const investimento = analiseFinanceiraResult.investimento_total_leasing_rs ?? 0
    const lucroMensal = analiseFinanceiraResult.lucro_mensal_medio_rs ?? 0
    const lucroRelativo = investimento > 0 ? (lucroMensal / investimento) * 100 : 0

    const paybackScore = Math.max(0, Math.min(100, (60 - payback) / 60 * 100))
    const roiScore = Math.max(0, Math.min(100, roi))
    const tirScore = Math.max(0, Math.min(100, tir / 2))
    const lucroRelativoScore = Math.max(0, Math.min(100, lucroRelativo * 12))

    const score = Math.round(
      paybackScore * 0.35 +
      roiScore * 0.25 +
      tirScore * 0.2 +
      lucroRelativoScore * 0.2,
    )

    const classificacao = score >= 85
      ? 'Excelente'
      : score >= 70
        ? 'Bom'
        : score >= 50
          ? 'Atenção'
          : 'Fraco'

    return { score, classificacao }
  }, [afModo, analiseFinanceiraResult])

  const custoFinalProjetadoCanonico = useMemo(() => {
    // Este valor é o "Preço ideal" da Análise Financeira — corresponde ao
    // valorBaseOriginalAtivo (VM contratual) para o cálculo de buyout.
    // Prioridade:
    //   1. preco_ideal_rs     — "Preço Ideal" da AF (venda com margem-alvo configurada).
    //      É o valor canônico exibido na página de Análise Financeira como "Preço Ideal".
    //   2. preco_minimo_saudavel_rs — fallback quando preco_ideal não está disponível
    //      (ex.: modo leasing, ou sem margem-alvo configurada).
    //   3. autoCustoFinal     — engine de auto-pricing (quando modoOrcamento === 'auto').
    //   4. valorVendaAtual    — valor informado manualmente.
    //   5. capex              — CAPEX bruto como último recurso.
    // NÃO confundir com CAPEX do orçamento PDF nem com mensalidade.
    const precoIdeal = analiseFinanceiraResult?.preco_ideal_rs
    if (Number.isFinite(precoIdeal) && precoIdeal != null && precoIdeal > 0) {
      console.info('[current-sale-value] recompute', {
        source: 'preco_ideal_rs',
        value: precoIdeal,
        isReady: true,
      })
      return precoIdeal
    }

    const precoMinSaudavel = analiseFinanceiraResult?.preco_minimo_saudavel_rs
    if (Number.isFinite(precoMinSaudavel) && precoMinSaudavel != null && precoMinSaudavel > 0) {
      console.info('[current-sale-value] recompute', {
        source: 'preco_minimo_saudavel_rs',
        value: precoMinSaudavel,
        isReady: true,
      })
      return precoMinSaudavel
    }

    const auto = Number(autoCustoFinal)
    if (modoOrcamento === 'auto' && Number.isFinite(auto) && auto > 0) {
      console.info('[current-sale-value] recompute', {
        source: 'autoCustoFinal',
        value: auto,
        isReady: true,
      })
      return auto
    }

    const venda = Number(valorVendaAtual)
    if (Number.isFinite(venda) && venda > 0) {
      console.info('[current-sale-value] recompute', {
        source: 'valorVendaAtual',
        value: venda,
        isReady: true,
      })
      return venda
    }

    console.info('[current-sale-value] recompute', {
      source: 'capex-fallback',
      value: Math.max(0, capex),
      isReady: false,
      reasons: [
        analiseFinanceiraResult == null ? 'analiseFinanceiraResult ausente (afCustoKit <= 0 ou consumo <= 0?)' : null,
        !analiseFinanceiraResult?.preco_ideal_rs ? 'preco_ideal_rs ausente' : null,
        !analiseFinanceiraResult?.preco_minimo_saudavel_rs ? 'preco_minimo_saudavel_rs ausente' : null,
      ].filter(Boolean),
    })
    return Math.max(0, capex)
  }, [analiseFinanceiraResult, autoCustoFinal, capex, modoOrcamento, valorVendaAtual])

  const capexSolarInvest = useMemo(
    () => Math.max(0, custoFinalProjetadoCanonico * 0.7),
    [custoFinalProjetadoCanonico],
  )

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
    // Mantemos o valor de mercado (vm0) amarrado ao custo final projetado canônico neste mesmo memo
    // para evitar dependências de ordem que poderiam reaparecer em merges futuros. Assim garantimos
    // uma única fonte de verdade entre a projeção principal e o fluxo de buyout.
    const valorMercadoBase = Math.max(0, custoFinalProjetadoCanonico)
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
    custoFinalProjetadoCanonico,
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
  // AF-specific mensalidades — derived from afSimEstadoMensalidade (AF's own inputs, not leasing's).
  // This is what drives afMensalidadeBaseAuto so the AF section is isolated from the leasing proposal.
  const mensalidadesAfPorAno = useMemo(
    () => (afSimEstadoMensalidade != null ? selectMensalidadesPorAno(afSimEstadoMensalidade) : []),
    [afSimEstadoMensalidade],
  )
  useEffect(() => {
    setAfMensalidadeBaseAuto(mensalidadesAfPorAno[0] ?? 0)
  }, [mensalidadesAfPorAno])
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
    const valorInvestimento = Math.max(0, capexSolarInvest)
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
    capexSolarInvest,
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
      const _economia = 12 * kcKwhMes * tarifaAno(ano)
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
  const _taxaMensalFinPct = useMemo(() => taxaMensalFin * 100, [taxaMensalFin])
  const _totalPagoFinanciamento = useMemo(
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
    // valorBaseOriginalAtivo = vm0 = Preço ideal da Análise Financeira (custoFinalProjetadoCanonico).
    // É o valor-base/original do ativo no início do contrato — não é mensalidade nem CAPEX do PDF.
    valorBaseOriginalAtivo: vm0,
    vm0, // @deprecated: alias de compatibilidade com snapshots antigos
    depreciacaoPct: depreciacaoAa,
    infEnergia: inflacaoAa,
    ipca: ipcaAa,
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
        leasingValorMercadoProjetado: isVendaDiretaTab ? null : buyoutResumo.valorBaseOriginalAtivo,
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
      custoFinalProjetadoCanonico,
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
        preOpenedWindow,
      }: BudgetPreviewOptions,
    ) => {
      if (!layoutHtml) {
        preOpenedWindow?.close()
        window.alert('Não foi possível preparar a visualização do orçamento selecionado.')
        return
      }

      // Use the pre-opened window when available (required for Safari, which blocks window.open()
      // called after async operations). Fall back to window.open() for synchronous callers.
      const printWindow = (preOpenedWindow && !preOpenedWindow.closed)
        ? preOpenedWindow
        : window.open('', '_blank', 'width=1024,height=768')
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
      layoutHtml = await renderPrintableProposalToHtml(dadosParaImpressao, useBentoGridPdf)
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
  }, [printableData, useBentoGridPdf])


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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(existenteRaw)
      if (!Array.isArray(parsed)) {
        return []
      }

      const { registros, houveAtualizacaoIds } = normalizeClienteRegistros(parsed)

      if (houveAtualizacaoIds) {
        try {
          persistClientesToLocalStorage(registros)
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

  const _getUltimaAtualizacao = useCallback((registros: ClienteRegistro[]) => {
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

  const getClientStableKey = useCallback((registro: ClienteRegistro): string => {
    const mapped = clientServerIdMapRef.current[registro.id]
    return String(mapped ?? registro.id ?? '')
  }, [])

  const persistDeletedClientKeys = useCallback((keys: Set<string>, reconciledAt: number) => {
    if (typeof window === 'undefined') return
    const payload: PersistedClientReconciliation = {
      deletedClientKeys: Array.from(keys),
      updatedAt: reconciledAt,
      version: 1,
    }
    try {
      window.localStorage.setItem(CLIENTS_RECONCILIATION_KEY, JSON.stringify(payload))
    } catch (error) {
      console.warn('[clients][reconciliation][persist] failed', error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    console.info('[clients][browser-env]', {
      userAgent: navigator.userAgent,
      hasIndexedDB: typeof indexedDB !== 'undefined',
      hasLocalStorage: typeof localStorage !== 'undefined',
      visibilityState: document.visibilityState,
    })
    try {
      const raw = window.localStorage.getItem(CLIENTS_RECONCILIATION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedClientReconciliation>
        const restored = Array.isArray(parsed?.deletedClientKeys) ? parsed.deletedClientKeys : []
        deletedClientKeysRef.current = new Set(restored.map((value) => String(value)))
        if (typeof parsed?.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)) {
          setLastDeleteReconciledAt(parsed.updatedAt)
        }
      }
      console.info('[clients][reconciliation][restore]', {
        restoredDeletedKeys: Array.from(deletedClientKeysRef.current),
      })
    } catch (error) {
      console.warn('[clients][reconciliation][restore] failed', error)
      deletedClientKeysRef.current = new Set()
    } finally {
      setReconciliationReady(true)
    }
  }, [])

  // Keep clientsSyncStateRef in sync so carregarClientesPrioritarios can read
  // the current value for logging without having it in the useCallback deps
  // (which would recreate the callback and trigger spurious reloads).
  useEffect(() => {
    clientsSyncStateRef.current = clientsSyncState
  }, [clientsSyncState])

  const carregarClientesPrioritarios = useCallback(async (options?: { silent?: boolean }): Promise<ClienteRegistro[]> => {
    if (clientsLoadInFlightRef.current) {
      return clientsLoadInFlightRef.current
    }
    const task = (async () => {
    if (typeof window === 'undefined') {
      return []
    }
    if (meAuthState !== 'authenticated') {
      console.info('[clients][load] skipped', { authState: meAuthState })
      return carregarClientesSalvos()
    }
    console.info('[clients][load] start', {
      authenticated: true,
      syncState: clientsSyncStateRef.current,
      browser: navigator.userAgent,
    })

    // All authenticated users: try Neon DB first. PostgreSQL RLS enforces per-role
    // access control (admin/financeiro → all; office → own + comercial; comercial → own).
    try {
      const allRegistros: ClienteRegistro[] = []
      const clientMapUpdates: Record<string, string> = {}
      let page = 1
      const limit = 100
      const MAX_PAGES = 50 // safety cap: up to 5,000 records
      for (;;) {
        const result = await listClientsFromApi({ page, limit })
        allRegistros.push(
          ...result.data.map((row) => {
            if (row.id) {
              clientMapUpdates[row.id] = row.id
            }
            return serverClientToRegistro(row)
          }),
        )
        if (page >= result.meta.totalPages || result.data.length === 0 || page >= MAX_PAGES) break
        page++
      }
      const filteredRegistros = allRegistros.filter((registro) => !deletedClientKeysRef.current.has(getClientStableKey(registro)))
      if (Object.keys(clientMapUpdates).length > 0) {
        clientServerIdMapRef.current = {
          ...clientServerIdMapRef.current,
          ...clientMapUpdates,
        }
        try {
          window.localStorage.setItem(
            CLIENT_SERVER_ID_MAP_STORAGE_KEY,
            JSON.stringify(clientServerIdMapRef.current),
          )
        } catch (error) {
          console.warn('[clients] Failed to persist client server-id map after API load:', error)
        }
      }
      // Cache fresh Neon data in localStorage for offline fallback
      try { persistClientesToLocalStorage(filteredRegistros) } catch {}
      setClientsSyncState('online-db')
      setClientsSource('api')
      setLastSuccessfulApiLoadAt(Date.now())
      setClientsLastLoadError(null)
      console.info('[clients][load] source', {
        source: 'api',
        count: filteredRegistros.length,
        deletedKeysCount: deletedClientKeysRef.current.size,
      })
      console.info('[clients][load] success', { count: filteredRegistros.length })
      console.info('[clients][load] commit', {
        source: 'api',
        count: filteredRegistros.length,
        keys: filteredRegistros.slice(0, 10).map(getClientStableKey),
      })
      return filteredRegistros
    } catch (error) {
      const localFallback = !(error instanceof ClientsApiError)
      setClientsSyncState(localFallback ? 'local-fallback' : 'degraded-api')
      setClientsSource(localFallback ? 'local-browser-storage' : 'memory')
      setClientsLastLoadError(error instanceof Error ? error.message : String(error))
      console.error('[clients][load] failed', { message: error instanceof Error ? error.message : String(error) })
      console.warn('[clients][load] fallback-activated', {
        reason: error instanceof Error ? error.message : String(error),
        sourceAttempted: 'api',
      })
      if (!options?.silent) {
        adicionarNotificacao(
          localFallback
            ? 'Clientes em modo local temporário: backend indisponível no momento.'
            : 'Falha ao recarregar a lista de clientes do banco. Alterações confirmadas podem demorar para aparecer.',
          localFallback ? 'error' : 'warning',
        )
      }
      // Fall through to storage-based loading
    }

    try {
      const oneDrivePayload = await loadClientesFromOneDrive()
      if (oneDrivePayload !== null && oneDrivePayload !== undefined) {
        const raw =
          typeof oneDrivePayload === 'string'
            ? oneDrivePayload
            : JSON.stringify(oneDrivePayload)
        const registros = parseClientesSalvos(raw)
        persistClientesToLocalStorage(registros)
        const reconciled = registros.filter((registro) => !deletedClientKeysRef.current.has(getClientStableKey(registro)))
        setClientsSource('server-storage')
        console.info('[clients][load] source', {
          source: 'server-storage',
          count: registros.length,
          deletedKeysCount: deletedClientKeysRef.current.size,
        })
        console.info('[clients][load] commit', {
          source: 'server-storage',
          count: reconciled.length,
          keys: reconciled.slice(0, 10).map(getClientStableKey),
        })
        return reconciled
      }
    } catch (error) {
      if (error instanceof OneDriveIntegrationMissingError) {
        if (import.meta.env.DEV) console.debug('Leitura via OneDrive ignorada: integração não configurada.')
      } else {
        console.warn('Não foi possível carregar clientes via OneDrive.', error)
      }
    }

    const local = carregarClientesSalvos()
    const reconciled = local.filter((registro) => !deletedClientKeysRef.current.has(getClientStableKey(registro)))
    setClientsSource('local-browser-storage')
    console.info('[clients][load] source', {
      source: 'local-browser-storage',
      count: local.length,
      deletedKeysCount: deletedClientKeysRef.current.size,
    })
    console.info('[clients][load] commit', {
      source: 'local-browser-storage',
      count: reconciled.length,
      keys: reconciled.slice(0, 10).map(getClientStableKey),
    })
    return reconciled
    })()
    clientsLoadInFlightRef.current = task
    try {
      return await task
    } finally {
      clientsLoadInFlightRef.current = null
    }
  }, [adicionarNotificacao, carregarClientesSalvos, getClientStableKey, meAuthState, parseClientesSalvos])

  useEffect(() => {
    if (meAuthState !== 'authenticated' || !reconciliationReady) {
      return
    }
    let cancelado = false
    const carregar = async () => {
      const registros = await carregarClientesPrioritarios()
      if (cancelado) {
        return
      }
      setClientesSalvos(registros)
      if (typeof window !== 'undefined') {
        try {
          if (registros.length > 0) {
            persistClientesToLocalStorage(registros)
          } else {
            window.localStorage.removeItem(CLIENTES_STORAGE_KEY)
          }
        } catch (error) {
          console.warn('Não foi possível atualizar o cache local de clientes.', error)
        }
      }
    }
    void carregar()
    return () => {
      cancelado = true
    }
  // authSyncKey increments when Stack Auth token becomes available, ensuring
  // this effect re-runs on new devices where auth resolves after initial mount.
   
  }, [carregarClientesPrioritarios, authSyncKey, meAuthState, reconciliationReady])

  // Fetch all registered consultants for privileged users so the client
  // management page can populate its consultant filter dropdown.
  useEffect(() => {
    if (!user || !(isAdmin || isOffice || isFinanceiro)) {
      setAllConsultores([])
      // Clear cache on logout so stale data isn't shown on the next login
      if (!user) {
        try { window.localStorage.removeItem(CONSULTORES_CACHE_KEY) } catch {}
      }
      return
    }
    let cancelado = false
    listConsultantsFromApi()
      .then((entries) => {
        if (!cancelado) {
          setAllConsultores(entries)
          // Persist to localStorage so the list is available immediately on next page load
          // (avoids the "Sem consultor" flash while the API response is in-flight).
          try {
            window.localStorage.setItem(CONSULTORES_CACHE_KEY, JSON.stringify(entries))
          } catch {
            // localStorage quota or security error — non-critical
          }
        }
      })
      .catch(() => {
        // Non-critical: fall back to names derived from loaded clients
      })
    return () => {
      cancelado = true
    }
   
  }, [user, isAdmin, isOffice, isFinanceiro, authSyncKey])

  // Fetch active consultants for the proposal form picker (any authenticated user).
  // Auto-selects the logged-in user's consultant entry on first load using the auto-detect API.
  // Also listens for consultant link changes to re-run auto-detection.
  useEffect(() => {
    if (!user) {
      setFormConsultores([])
      return
    }
    let cancelado = false

    // Fetch consultants for the dropdown
    fetchConsultantsForPicker()
      .then((entries) => {
        if (cancelado) return
        setFormConsultores(entries)
      })
      .catch(() => {
        // Non-critical: form works without the dropdown
      })

    // Function to run auto-detection
    const runAutoDetection = () => {
      if (import.meta.env.DEV) {
        console.debug('[consultant][auto-detect] Running auto-detection...')
      }
      import('./services/personnelApi').then(({ autoDetectLinkedConsultant }) => {
        autoDetectLinkedConsultant()
          .then((result) => {
            if (cancelado) return
            if (result.consultant && me) {
              // Prefer the logged-in user's own name as the default consultant display name
              const defaultNome = me.fullName?.trim() || consultorDisplayName(result.consultant)
              // Store for reuse when iniciarNovaProposta resets the form
              myConsultorDefaultRef.current = { id: String(result.consultant.id), nome: defaultNome }
              const current = clienteRef.current ?? cliente
              // Always update when auto-detection runs (handles both initial load and link changes)
              updateClienteSync({ consultorId: String(result.consultant.id), consultorNome: defaultNome })
              if (import.meta.env.DEV) {
                console.debug('[consultant][auto-detect] Matched consultant via', result.matchType, {
                  consultantId: result.consultant.id,
                  nome: defaultNome,
                  currentClienteConsultorId: current.consultorId
                })
              }
            } else if (result.consultant === null && me) {
              // No consultant found - clear the selection if previously set
              const current = clienteRef.current ?? cliente
              if (current.consultorId && myConsultorDefaultRef.current) {
                myConsultorDefaultRef.current = null
                updateClienteSync({ consultorId: '', consultorNome: '' })
                if (import.meta.env.DEV) {
                  console.debug('[consultant][auto-detect] No consultant found, clearing selection')
                }
              }
            }
          })
          .catch((err) => {
            if (!cancelado) {
              console.warn('[consultant][auto-detect] Failed to auto-detect linked consultant:', err)
            }
          })
      }).catch(() => {
        // Module import failed (shouldn't happen in normal flow)
      })
    }

    // Run initial auto-detection
    runAutoDetection()

    // Listen for consultant link change events
    const cleanup = import('./events/consultantEvents').then(({ onConsultantLinkChanged }) => {
      return onConsultantLinkChanged((detail) => {
        // Only re-run auto-detection if the link change affects the current user
        // Compare using both database id and auth provider id to handle both scenarios
        const matchesById = me?.id && detail.userId === me.id
        const matchesByAuthId = me?.authProviderId && detail.userId === me.authProviderId

        if (import.meta.env.DEV) {
          console.debug('[consultant][auto-detect] Link change event received', {
            detail,
            me: { id: me?.id, authProviderId: me?.authProviderId },
            matchesById,
            matchesByAuthId,
            willRunDetection: matchesById || matchesByAuthId
          })
        }

        if (matchesById || matchesByAuthId) {
          if (import.meta.env.DEV) {
            console.debug('[consultant][auto-detect] Link changed for current user, re-running auto-detection')
          }
          runAutoDetection()
        }
      })
    }).catch(() => {
      return () => {}
    })

    return () => {
      cancelado = true
      cleanup.then((cleanupFn) => cleanupFn()).catch(() => {})
    }
  }, [user, authSyncKey])

  useEffect(() => {
    if (consultantBackfillRanRef.current) return
    if (meAuthState !== 'authenticated') return
    if (!isAdmin) return

    consultantBackfillRanRef.current = true
    let cancelado = false

    const executarBackfill = async () => {
      try {
        const { updatedCount } = await runConsultorBackfillSweep()
        if (cancelado) return
        if (updatedCount > 0) {
          const refreshed = await carregarClientesPrioritarios({ silent: true })
          if (!cancelado) {
            setClientesSalvos(refreshed)
          }
        }
        adicionarNotificacao(
          updatedCount > 0
            ? `Varredura de consultores concluída: ${updatedCount} cliente(s) atualizado(s).`
            : 'Varredura de consultores concluída: nenhum cliente precisou de atualização.',
          'info',
        )
      } catch (error) {
        console.warn('[clients][consultor-backfill] sweep failed', error)
      }
    }

    void executarBackfill()

    return () => {
      cancelado = true
    }
  }, [adicionarNotificacao, carregarClientesPrioritarios, isAdmin, meAuthState])

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

  // Note: a proactive global notification used to be raised here every 15 days
  // when the PDF integration was missing. It surfaced as an out-of-context
  // error toast on app load. The same message is already shown contextually
  // (a) inside the proposal preview toolbar via `resolvePreviewToolbarMessage`
  // and (b) at the moment the user actually attempts to save a PDF
  // (see the `persistProposalPdf` call sites). The proactive effect has been
  // removed to avoid the misplaced notification.

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
    carregarClientesPrioritarios,
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

  const handleBackupUploadArquivo = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    if (!arquivo || typeof window === 'undefined') return

    console.log('[backup-ui] upload start', { fileName: arquivo.name, size: arquivo.size })
    setIsGerandoBackupBanco(true)
    try {
      const texto = await arquivo.text()
      const json = JSON.parse(texto) as unknown
      const token = await getAccessToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers.Authorization = `Bearer ${token}`
        headers['x-stack-access-token'] = token
      }
      console.log('[backup-ui] upload request-dispatched')
      const response = await fetch(resolveApiUrl('/api/admin/database-backup'), {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ action: 'import', payload: json }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; importedClients?: number; failedClients?: number; importedProposals?: number; failedProposals?: number }
        | null

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Falha ao carregar backup.')
      }
      const failed = (payload.failedClients ?? 0) + (payload.failedProposals ?? 0)
      const successMsg = `Backup carregado com sucesso (${payload.importedClients ?? 0} clientes e ${payload.importedProposals ?? 0} propostas).`
      adicionarNotificacao(successMsg, 'success')
      if (failed > 0) {
        adicionarNotificacao(`${failed} registro(s) não puderam ser importados (verifique os logs).`, 'error')
      }
      console.log('[backup-ui] upload success', { importedClients: payload.importedClients, importedProposals: payload.importedProposals, failedClients: payload.failedClients, failedProposals: payload.failedProposals })
    } catch (error) {
      console.error('[backup-ui] upload failed', error)
      adicionarNotificacao(
        error instanceof Error ? error.message : 'Não foi possível carregar o backup selecionado. Verifique o arquivo e tente novamente.',
        'error',
      )
    } finally {
      setIsGerandoBackupBanco(false)
    }
  }, [adicionarNotificacao, getAccessToken])

  const handleBackupBancoDados = useCallback(() => {
    if (typeof window === 'undefined' || isGerandoBackupBanco) return
    console.log('[backup-ui] click')
    setIsBackupModalOpen(true)
  }, [isGerandoBackupBanco])

  const handleBackupModalUpload = useCallback(() => {
    console.log('[backup-ui] upload selected')
    setIsBackupModalOpen(false)
    backupImportInputRef.current?.click()
  }, [backupImportInputRef])

  const handleBackupModalDownload = useCallback(async (destino: BackupDestino) => {
    setIsBackupModalOpen(false)

    const destinoApi: 'platform' | 'cloud' | 'local' =
      destino === 'plataforma' ? 'platform' : destino === 'nuvem' ? 'cloud' : 'local'

    console.log('[backup-ui] download start', { destino: destinoApi })
    setIsGerandoBackupBanco(true)

    try {
      const token = await getAccessToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers.Authorization = `Bearer ${token}`
        headers['x-stack-access-token'] = token
      }
      console.log('[backup-ui] download request-dispatched')
      const response = await fetch(resolveApiUrl('/api/admin/database-backup'), {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ action: 'export', destination: destinoApi }),
      })

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean
            error?: string
            fileName?: string
            payload?: unknown
            platformSaved?: boolean
            checksumSha256?: string
          }
        | null

      if (!response.ok || !payload?.ok || !payload.payload) {
        throw new Error(payload?.error ?? 'Falha ao gerar backup.')
      }

      const json = JSON.stringify(payload.payload, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const fileName = payload.fileName ?? buildClientesFileName('json')

      if (destinoApi === 'local' || destinoApi === 'cloud') {
        console.log('[backup-ui] download-start', { fileName })
        downloadClientesArquivo(blob, fileName)
      }

      if (destinoApi === 'cloud') {
        const file = new File([blob], fileName, { type: 'application/json' })
        if (navigator.canShare?.({ files: [file] }) && navigator.share) {
          await navigator.share({
            title: 'Backup SolarInvest',
            text: 'Backup do banco de dados SolarInvest',
            files: [file],
          })
        } else {
          adicionarNotificacao('Web Share indisponível neste dispositivo. O arquivo foi baixado localmente.', 'info')
        }
      }

      const destinoLabel =
        destinoApi === 'platform' ? 'plataforma' : destinoApi === 'cloud' ? 'nuvem' : 'dispositivo local'
      const checksumTexto = payload.checksumSha256 ? ` (checksum: ${payload.checksumSha256.slice(0, 12)}...)` : ''
      adicionarNotificacao(`Backup gerado com sucesso para ${destinoLabel}${checksumTexto}.`, 'success')
      console.log('[backup-ui] download success', { checksum: payload.checksumSha256 })

      if (payload.platformSaved) {
        adicionarNotificacao('Cópia adicional registrada na plataforma (Neon).', 'success')
      }
    } catch (error) {
      console.error('[backup-ui] download failed', error)
      adicionarNotificacao(
        error instanceof Error ? error.message : 'Não foi possível gerar o backup do banco. Tente novamente.',
        'error',
      )
    } finally {
      setIsGerandoBackupBanco(false)
    }
  }, [adicionarNotificacao, buildClientesFileName, downloadClientesArquivo, getAccessToken])

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
          } catch (_error) {
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

        // Build import rows for the preview (including energy profile data)
        type RawImportRow = Partial<ClienteRegistro> & { dados?: Partial<ClienteDados>; energyProfile?: Record<string, string | number | null> }
        const rawRows = lista as RawImportRow[]

        // Map raw rows to ImportRow format for deduplication engine
        const importRows = rawRows.map((r) => ({
          name: (r.dados?.nome ?? (r as unknown as { nome?: string }).nome ?? '').trim(),
          document: r.dados?.documento ?? (r as unknown as { documento?: string }).documento ?? null,
          uc: r.dados?.uc ?? (r as unknown as { uc?: string }).uc ?? null,
          email: r.dados?.email ?? (r as unknown as { email?: string }).email ?? null,
          phone: r.dados?.telefone ?? (r as unknown as { telefone?: string }).telefone ?? null,
          city: r.dados?.cidade ?? (r as unknown as { cidade?: string }).cidade ?? null,
          state: r.dados?.uf ?? (r as unknown as { uf?: string }).uf ?? null,
          address: r.dados?.endereco ?? (r as unknown as { endereco?: string }).endereco ?? null,
          distribuidora: r.dados?.distribuidora ?? (r as unknown as { distribuidora?: string }).distribuidora ?? null,
          kwh_contratado: typeof r.energyProfile?.kwh_contratado === 'number' ? r.energyProfile.kwh_contratado : null,
          potencia_kwp: typeof r.energyProfile?.potencia_kwp === 'number' ? r.energyProfile.potencia_kwp : null,
          tipo_rede: typeof r.energyProfile?.tipo_rede === 'string' ? r.energyProfile.tipo_rede : null,
          tarifa_atual: typeof r.energyProfile?.tarifa_atual === 'number' ? r.energyProfile.tarifa_atual : null,
          desconto_percentual: typeof r.energyProfile?.desconto_percentual === 'number' ? r.energyProfile.desconto_percentual : null,
          mensalidade: typeof r.energyProfile?.mensalidade === 'number' ? r.energyProfile.mensalidade : null,
          indicacao: typeof r.energyProfile?.indicacao === 'string' ? r.energyProfile.indicacao : null,
          modalidade: typeof r.energyProfile?.modalidade === 'string' ? r.energyProfile.modalidade : null,
          prazo_meses: typeof r.energyProfile?.prazo_meses === 'number' ? r.energyProfile.prazo_meses : null,
        }))

        // Filter out rows without a name
        const validImportRows = importRows.filter((r) => r.name.length > 0)

        if (validImportRows.length === 0) {
          window.alert('Nenhum cliente válido foi encontrado no arquivo selecionado.')
          return
        }

        // Keep the raw rows for later use during confirm
        pendingImportRawRowsRef.current = rawRows

        // Run client-side deduplication against existing (localStorage) clients
        const existentes = carregarClientesSalvos()
        const existingSlim = existentes
          .filter((r) => r.deletedAt == null)
          .map((r) => ({
            id: r.id,
            name: r.dados.nome,
            document: r.dados.documento ?? null,
            uc: r.dados.uc ?? null,
            email: r.dados.email ?? null,
            phone: r.dados.telefone ?? null,
            city: r.dados.cidade ?? null,
          }))

        const analyzed = analyzeImportRows(validImportRows, existingSlim)
        setBulkImportPreviewRows(analyzed)
        setIsBulkImportPreviewOpen(true)
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
      carregarClientesSalvos,
      setIsImportandoClientes,
    ])

  /**
   * Executed when the user confirms the import from the preview modal.
   * If server API is available, uses bulk-import endpoint; otherwise falls back to localStorage.
   */
  const handleBulkImportConfirm = useCallback(async () => {
    const selectedRows = bulkImportPreviewRows.filter((r) => r.selected)
    if (selectedRows.length === 0) return

    setIsBulkImportConfirming(true)

    try {
      // Try server-side import first
      const token = await getAccessToken().catch(() => null)
      if (token) {
        const apiRows: BulkImportRowInput[] = selectedRows.map((r) => {
          const hasEnergyData =
            r.kwh_contratado != null ||
            r.potencia_kwp != null ||
            r.tipo_rede != null ||
            r.tarifa_atual != null ||
            r.desconto_percentual != null ||
            r.mensalidade != null ||
            r.indicacao != null ||
            r.modalidade != null ||
            r.prazo_meses != null
          const row: BulkImportRowInput = {
            name: r.name,
            document: r.document ?? null,
            uc: r.uc ?? null,
            email: r.email ?? null,
            phone: r.phone ?? null,
            city: r.city ?? null,
            state: r.state ?? null,
            address: r.address ?? null,
            distribuidora: r.distribuidora ?? null,
          }
          if (hasEnergyData) {
            row.energyProfile = {
              ...(r.kwh_contratado != null ? { kwh_contratado: r.kwh_contratado } : {}),
              ...(r.potencia_kwp != null ? { potencia_kwp: r.potencia_kwp } : {}),
              ...(r.tipo_rede != null ? { tipo_rede: r.tipo_rede } : {}),
              ...(r.tarifa_atual != null ? { tarifa_atual: r.tarifa_atual } : {}),
              ...(r.desconto_percentual != null ? { desconto_percentual: r.desconto_percentual } : {}),
              ...(r.mensalidade != null ? { mensalidade: r.mensalidade } : {}),
              ...(r.indicacao != null ? { indicacao: r.indicacao } : {}),
              ...(r.modalidade != null ? { modalidade: r.modalidade } : {}),
              ...(r.prazo_meses != null ? { prazo_meses: r.prazo_meses } : {}),
            }
          }
          return row
        })

        try {
          const result = await bulkImport(apiRows, { autoMerge: bulkImportAutoMerge })
          const { created, merged, skipped, errors } = result.summary
          adicionarNotificacao(
            `Importação concluída: ${created} criado(s), ${merged} mesclado(s), ${skipped} ignorado(s)${errors > 0 ? `, ${errors} erro(s)` : ''}.`,
            errors > 0 ? 'error' : 'success',
          )
          setIsBulkImportPreviewOpen(false)
          // Reload clients from server
          await carregarClientesPrioritarios()
          return
        } catch (serverErr) {
          console.warn('[bulk-import] Server import failed, falling back to localStorage:', serverErr)
          // Fall through to localStorage import
        }
      }

      // Fallback: localStorage import (original behavior)
      const rawRows = pendingImportRawRowsRef.current
      const selectedIndices = new Set(selectedRows.map((r) => r.rowIndex))
      const selectedRaw = rawRows.filter((_, idx) => selectedIndices.has(idx))

      const existentes = carregarClientesSalvos()
      const existingIds = new Set(existentes.map((r) => r.id))
      const { registros: importados } = normalizeClienteRegistros(selectedRaw, { existingIds })

      if (importados.length === 0) {
        window.alert('Nenhum cliente válido para importar.')
        return
      }

      const combinados = [...importados, ...existentes].sort((a, b) =>
        a.atualizadoEm < b.atualizadoEm ? 1 : -1,
      )

      try {
        persistClientesToLocalStorage(combinados)
      } catch (error) {
        if (isQuotaExceededError(error)) {
          try {
            // snapshots already stripped via spread, so raw stringify is safe here
            const ultraLite = combinados.map((r) => ({ ...r, propostaSnapshot: undefined }))
            window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(ultraLite))
          } catch {
            try { window.localStorage.removeItem(CLIENTES_STORAGE_KEY) } catch { /* noop */ }
          }
        }
        console.warn('[bulk-import] local cache update failed (non-blocking)', error)
      }

      setClientesSalvos(combinados)
      adicionarNotificacao(`${importados.length} cliente(s) importado(s) com sucesso.`, 'success')
      setIsBulkImportPreviewOpen(false)
    } catch (error) {
      console.error('Erro durante confirmação da importação.', error)
      window.alert('Não foi possível importar os clientes. Tente novamente.')
    } finally {
      setIsBulkImportConfirming(false)
    }
  }, [
    adicionarNotificacao,
    bulkImportAutoMerge,
    bulkImportPreviewRows,
    carregarClientesSalvos,
    carregarClientesPrioritarios,
    getAccessToken,
    normalizeClienteRegistros,
    setClientesSalvos,
  ])

  const handleBulkImportRowSelection = useCallback((rowIndex: number, selected: boolean) => {
    setBulkImportPreviewRows((prev) =>
      prev.map((r) => (r.rowIndex === rowIndex ? { ...r, selected } : r)),
    )
  }, [])

  const handleBulkImportRowAction = useCallback((rowIndex: number, action: ImportSuggestedAction) => {
    setBulkImportPreviewRows((prev) =>
      prev.map((r) => (r.rowIndex === rowIndex ? { ...r, userAction: action } : r)),
    )
  }, [])

  const handleBulkImportSelectAllValid = useCallback(() => {
    setBulkImportPreviewRows((prev) =>
      prev.map((r) => ({
        ...r,
        selected:
          r.dedupResult.status === 'new' ||
          (r.dedupResult.matchLevel !== 'hard' && r.dedupResult.status !== 'existing'),
      })),
    )
  }, [])

  const handleBulkImportSelectAll = useCallback(() => {
    setBulkImportPreviewRows((prev) => prev.map((r) => ({ ...r, selected: true })))
  }, [])

  const handleBulkImportClearSelection = useCallback(() => {
    setBulkImportPreviewRows((prev) => prev.map((r) => ({ ...r, selected: false })))
  }, [])

  const handleBulkImportClose = useCallback(() => {
    setIsBulkImportPreviewOpen(false)
    pendingImportRawRowsRef.current = []
    setBulkImportPreviewRows([])
  }, [])

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
    useBentoGridPdf: INITIAL_VALUES.useBentoGridPdf,
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
    tipoRede: INITIAL_VALUES.tipoRede ?? 'nenhum',
    tipoRedeControle: 'auto',
    temCorresponsavelFinanceiro: false,
    corresponsavel: null,
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
    const tusdTipoClienteNormalizado = normalizeTusdTipoClienteValue(tusdTipoCliente)
    const segmentoClienteNormalizado = normalizeTipoBasico(segmentoCliente)
    const vendaFormNormalizado: VendaForm = {
      ...vendaForm,
      segmento_cliente: vendaForm.segmento_cliente
        ? normalizeTipoBasico(vendaForm.segmento_cliente)
        : undefined,
      tusd_tipo_cliente: vendaForm.tusd_tipo_cliente
        ? normalizeTusdTipoClienteValue(vendaForm.tusd_tipo_cliente)
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
      const now = Date.now()
      if (now - budgetIdMismatchWarnedAtRef.current > 30_000) {
        budgetIdMismatchWarnedAtRef.current = now
        console.warn('[getCurrentSnapshot] budget id mismatch (using active budgetId)', {
          budgetIdRef: budgetIdRefNow,
          budgetIdState: budgetIdStateNow,
          activeBudgetId: budgetId,
        })
      }
    }

    if (import.meta.env.DEV) {
      console.debug('[getCurrentSnapshot] sources', {
        activeTab: tab,
        budgetIdRef: budgetId,
        budgetIdState: currentBudgetId,
        kcKwhMesState: kcKwhMesRef.current,
      })
    }

    // 🔒 CRITICAL: Use refs to get current state, not closure variables
    const kcAtual = Number(kcKwhMesRef.current ?? 0)
    const kcFallback = Number(pageSharedStateRef.current?.kcKwhMes ?? 0)
    const kcKwhMesFinal = kcAtual || kcFallback

    if (isHydratingRef.current) {
      if (import.meta.env.DEV) console.debug('[getCurrentSnapshot] skipped during hydration', { budgetId })
      return createEmptySnapshot(budgetId, tab)
    }

    const temCorresponsavelFinanceiroSnapshot = Boolean(
      leasingSnapshotAtual?.contrato?.temCorresponsavelFinanceiro,
    )
    const corresponsavelSnapshot = leasingSnapshotAtual?.contrato?.corresponsavel
    const corresponsavelSnapshotClonado = corresponsavelSnapshot
      ? {
          ...corresponsavelSnapshot,
          endereco:
            typeof corresponsavelSnapshot.endereco === 'object' &&
            corresponsavelSnapshot.endereco
              ? { ...corresponsavelSnapshot.endereco }
              : corresponsavelSnapshot.endereco ?? null,
        }
      : null

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
      useBentoGridPdf,
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
      temCorresponsavelFinanceiro: temCorresponsavelFinanceiroSnapshot,
      corresponsavel: corresponsavelSnapshotClonado,
      leasingAnexosSelecionados: [...leasingAnexosSelecionados],
      vendaSnapshot: vendaSnapshotAtual,
      leasingSnapshot: leasingSnapshotAtual,
    }
    
    // Debug: Check if returning empty snapshot
    const _snapshotNome = (snapshotData.cliente?.nome ?? '').trim()
    const _snapshotEndereco = (snapshotData.cliente?.endereco ?? '').trim()
    const snapshotKwh = Number(snapshotData.kcKwhMes ?? 0)
    
    // Final log showing what we're returning
    if (import.meta.env.DEV) {
      console.debug('[getCurrentSnapshot] FINAL snapshot', {
        kcKwhMes: snapshotKwh,
        totalFields: Object.keys(snapshotData).length,
      })
    }

    if (isSnapshotEmpty(snapshotData)) {
      return snapshotData
    }
    
    if (import.meta.env.DEV) {
      console.debug('[getCurrentSnapshot] clienteFonte resolved')
    }

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

  // Helper: Hydrate cliente registro with latest data from clientStore.
  // Uses a 3-second timeout so that a hanging IndexedDB call (common on
  // Mobile Safari with ITP / private-browsing restrictions) never blocks
  // navigation.
  const hydrateClienteRegistroFromStore = async (
    registro: ClienteRegistro,
  ): Promise<ClienteRegistro> => {
    try {
      const result = await Promise.race([
        getClienteRegistroById(registro.id),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ])
      if (result) {
        return result
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[hydrateClienteRegistro] Failed to load latest for', registro.id, e)
    }
    return registro
  }

  // IMPORTANT: keep these derived values declared before handleSalvarCliente.
  // The save callback depends on them in both function body and dependency array;
  // moving them below would reintroduce a TDZ crash in production bundles.
  const clienteRegistroEmEdicao = useMemo(
    () =>
      clienteEmEdicaoId
        ? clientesSalvos.find((registro) => registro.id === clienteEmEdicaoId) ?? null
        : null,
    [clienteEmEdicaoId, clientesSalvos],
  )
  const clienteFormularioAlterado = useMemo(() => {
    if (!clienteRegistroEmEdicao) {
      return false
    }
    // Compare only the client data fields — the full proposal snapshot comparison was too
    // expensive (cloneSnapshotData + stableStringify on the entire app state on every render).
    // The save handler always persists the latest proposal snapshot regardless.
    return (
      stableStringify(cloneClienteDados(cliente)) !==
      stableStringify(cloneClienteDados(clienteRegistroEmEdicao.dados))
    )
  }, [clienteRegistroEmEdicao, cliente])
  const clienteTemDadosNaoSalvos = useMemo(() => {
    const clienteInicial = cloneClienteDados(CLIENTE_INICIAL)
    const clienteAtual = cloneClienteDados(cliente)
    const hasClientDiff =
      clienteEmEdicaoId
        ? clienteFormularioAlterado
        : stableStringify(clienteAtual) !== stableStringify(clienteInicial)
    if (hasClientDiff) {
      return true
    }
    if (lastSavedSignatureRef.current == null) {
      return false
    }
    return computeSignatureRef.current() !== lastSavedSignatureRef.current
  }, [cliente, clienteEmEdicaoId, clienteFormularioAlterado])
  const clientIsDirty = useMemo(
    () =>
      stableStringify(cloneClienteDados(cliente)) !==
      stableStringify(cloneClienteDados(originalClientData)),
    [cliente, originalClientData],
  )
  const clienteSaveLabel =
    clienteEmEdicaoId && clienteTemDadosNaoSalvos ? 'Atualizar cliente' : 'Salvar cliente'

  const buildClientUpsertPayload = useCallback((
    dados: ClienteDados,
    source: string,
    snapshot?: OrcamentoSnapshotData | null,
  ): UpsertClientInput => {
    const documentDigits = normalizeNumbers(dados?.documento ?? '')
    const payload: UpsertClientInput = {
      name: (dados?.nome ?? '').trim(),
      ...(dados?.email?.trim() ? { email: dados.email.trim() } : {}),
      ...(dados?.telefone?.trim() ? { phone: dados.telefone.trim() } : {}),
      ...(dados?.cidade?.trim() ? { city: dados.cidade.trim() } : {}),
      ...(dados?.uf?.trim() ? { state: dados.uf.trim() } : {}),
      ...(dados?.endereco?.trim() ? { address: dados.endereco.trim() } : {}),
      ...(dados?.cep?.trim()
        ? { client_cep: dados.cep.replace(/\D/g, ''), cep: dados.cep.replace(/\D/g, '') }
        : {}),
      ...(dados?.uc?.trim() ? { uc: dados.uc.trim() } : {}),
      ...(dados?.distribuidora?.trim() ? { distribuidora: dados.distribuidora.trim() } : {}),
      metadata: {
        source,
        ...(dados?.rg?.trim() ? { rg: dados.rg.trim() } : {}),
        ...(dados?.estadoCivil?.trim() ? { estado_civil: dados.estadoCivil.trim() } : {}),
        ...(dados?.nacionalidade?.trim() ? { nacionalidade: dados.nacionalidade.trim() } : {}),
        ...(dados?.profissao?.trim() ? { profissao: dados.profissao.trim() } : {}),
        ...(dados?.representanteLegal?.trim() ? { representante_legal: dados.representanteLegal.trim() } : {}),
        ...(Array.isArray(dados?.herdeiros) && dados.herdeiros.some((h) => typeof h === 'string' && h.trim())
          ? { herdeiros: dados.herdeiros.map((h) => h.trim()).filter(Boolean) }
          : {}),
        ...(dados?.nomeSindico?.trim() ? { nome_sindico: dados.nomeSindico.trim() } : {}),
        ...(dados?.cpfSindico?.trim() ? { cpf_sindico: dados.cpfSindico.trim() } : {}),
        ...(dados?.contatoSindico?.trim() ? { contato_sindico: dados.contatoSindico.trim() } : {}),
        ...(dados?.diaVencimento?.trim() ? { dia_vencimento: dados.diaVencimento.trim() } : {}),
        ...(dados?.temIndicacao != null ? { tem_indicacao: dados.temIndicacao } : {}),
        ...(dados?.indicacaoNome?.trim() ? { indicacao_nome: dados.indicacaoNome.trim() } : {}),
        ...(dados?.consultorId?.trim() ? { consultor_id: dados.consultorId.trim() } : {}),
        ...(dados?.consultorNome?.trim() ? { consultor_nome: dados.consultorNome.trim() } : {}),
      },
      // Persist consultant_id as a canonical top-level field (clients.consultant_id column).
      // Only set when a consultant is explicitly present — never send null to avoid accidentally
      // clearing an existing value on the server (the server uses COALESCE to preserve it).
      ...(dados?.consultorId?.trim() ? { consultant_id: dados.consultorId.trim() } : {}),
    }
    const resolvedConsumption = resolveConsumptionFromSnapshot(snapshot ?? null)
    const resolvedSystemKwp = resolveSystemKwpFromSnapshot(snapshot ?? null)
    const resolvedTermMonths = resolveTermMonthsFromSnapshot(snapshot ?? null)
    const resolvedUcBeneficiaria =
      snapshot?.ucBeneficiarias?.map((item) => item?.numero?.trim()).filter(Boolean).join(', ') ?? ''
    if (resolvedConsumption !== null) {
      payload.consumption_kwh_month = resolvedConsumption
    }
    if (resolvedSystemKwp !== null) {
      payload.system_kwp = resolvedSystemKwp
    }
    if (resolvedTermMonths !== null) {
      payload.term_months = Math.round(resolvedTermMonths)
    }
    if (resolvedUcBeneficiaria) {
      payload.uc_beneficiaria = resolvedUcBeneficiaria
    }
    if (documentDigits.length === 11) {
      payload.cpf_raw = documentDigits
      payload.document = documentDigits
    } else if (documentDigits.length === 14) {
      payload.cnpj_raw = documentDigits
      payload.document = documentDigits
    } else if (documentDigits.length > 0) {
      payload.document = documentDigits
    }
    return payload
  }, [])

  const buildProposalUpsertPayload = useCallback((snapshot: OrcamentoSnapshotData): UpdateProposalInput => {
    const clienteSnapshot = snapshot.cliente ?? {}
    const resolvedConsumption = resolveConsumptionFromSnapshot(snapshot)
    const resolvedSystemKwp = resolveSystemKwpFromSnapshot(snapshot)
    const resolvedTermMonths = resolveTermMonthsFromSnapshot(snapshot)
    const clientCepDigits = normalizeNumbers(clienteSnapshot.cep ?? '').slice(0, 8)
    const ucBeneficiaria = snapshot.ucBeneficiarias
      ?.map((item) => item.numero?.trim())
      .filter((item): item is string => Boolean(item))
      .join(', ')

    return {
      payload_json: snapshot as unknown as Record<string, unknown>,
      ...(clienteSnapshot.nome?.trim() ? { client_name: clienteSnapshot.nome.trim() } : {}),
      ...(clienteSnapshot.documento?.trim() ? { client_document: normalizeNumbers(clienteSnapshot.documento) } : {}),
      ...(clienteSnapshot.cidade?.trim() ? { client_city: clienteSnapshot.cidade.trim() } : {}),
      ...(clienteSnapshot.uf?.trim() ? { client_state: clienteSnapshot.uf.trim() } : {}),
      ...(clienteSnapshot.telefone?.trim() ? { client_phone: clienteSnapshot.telefone.trim() } : {}),
      ...(clienteSnapshot.email?.trim() ? { client_email: clienteSnapshot.email.trim() } : {}),
      ...(clientCepDigits ? { client_cep: clientCepDigits } : {}),
      ...(typeof resolvedConsumption === 'number' ? { consumption_kwh_month: resolvedConsumption } : {}),
      ...(typeof resolvedSystemKwp === 'number' ? { system_kwp: resolvedSystemKwp } : {}),
      ...(typeof resolvedTermMonths === 'number' ? { term_months: Math.round(resolvedTermMonths) } : {}),
      ...(ucBeneficiaria ? { uc_beneficiaria: ucBeneficiaria } : {}),
    }
  }, [])

  const handleSalvarCliente = useCallback(
    async (options?: { skipGuard?: boolean; silent?: boolean }) => {
    if (typeof window === 'undefined') {
      return false
    }
    if (!options?.skipGuard && !clienteTemDadosNaoSalvos) {
      return false
    }

    console.info('[client-save] starting client mutation', {
      clientId: clienteEmEdicaoId ?? null,
      hasExistingClient: Boolean(clienteEmEdicaoId),
      skipGuard: Boolean(options?.skipGuard),
    })

    if (!validateClienteParaSalvar({ silent: options?.silent })) {
      console.warn('[client-save] client mutation blocked by validation', {
        clientId: clienteEmEdicaoId ?? null,
        nome: Boolean(cliente.nome?.trim()),
        documento: Boolean(cliente.documento?.trim()),
        cep: Boolean(cliente.cep?.trim()),
      })
      return false
    }
    setClientLastSaveStatus('saving')

    const dadosClonados = cloneClienteDados(cliente)
    dadosClonados.herdeiros = ensureClienteHerdeiros(dadosClonados.herdeiros).map((item) =>
      typeof item === 'string' ? item.trim() : '',
    )
    
    // Debug: Log cliente endereco before saving
    if (import.meta.env.DEV) {
      console.debug('[ClienteSave] preparing clone')
    }
    
    const snapshotAtual = getCurrentSnapshot()
    if (!snapshotAtual || isHydratingRef.current) {
      console.warn('[ClienteSave] Snapshot indisponível durante hidratação.')
      return false
    }
    const snapshotClonado = cloneSnapshotData(snapshotAtual)
    if (import.meta.env.DEV) {
      console.debug('[ClienteSave] Capturing FULL proposal snapshot with', Object.keys(snapshotClonado).length, 'fields', {
        kcKwhMes: snapshotClonado.kcKwhMes,
        tarifaCheia: snapshotClonado.tarifaCheia,
        totalFields: Object.keys(snapshotClonado).length,
      })
    }
    
    const online = isConnectivityOnline()
    const agoraIso = new Date().toISOString()
    const estaEditando = Boolean(clienteEmEdicaoId)
    const resolvedConsumption = resolveConsumptionFromSnapshot(snapshotClonado)
    const resolvedSystemKwp = resolveSystemKwpFromSnapshot(snapshotClonado)
    const resolvedTermMonths = resolveTermMonthsFromSnapshot(snapshotClonado)

    // Build Neon payload from dadosClonados before state update.
    // Neon DB is the primary store; localStorage is only a fallback/cache.

    // Extract energy profile from the current snapshot to persist alongside client data.
    const leasingSnap = snapshotClonado.leasingSnapshot
    const vendaSnap = snapshotClonado.vendaForm
    const isLeasingTab = snapshotClonado.activeTab === 'leasing'
    const energyProfile: UpsertClientInput['energyProfile'] = {
      kwh_contratado: Number.isFinite(snapshotClonado.kcKwhMes) && snapshotClonado.kcKwhMes > 0
        ? snapshotClonado.kcKwhMes
        : (Number.isFinite(leasingSnap?.energiaContratadaKwhMes) && leasingSnap.energiaContratadaKwhMes > 0
          ? leasingSnap.energiaContratadaKwhMes
          : (Number.isFinite(vendaSnap?.consumo_kwh_mes) && vendaSnap.consumo_kwh_mes > 0
            ? vendaSnap.consumo_kwh_mes
            : null)),
      potencia_kwp: Number.isFinite(leasingSnap?.dadosTecnicos?.potenciaInstaladaKwp) && leasingSnap.dadosTecnicos.potenciaInstaladaKwp > 0
        ? leasingSnap.dadosTecnicos.potenciaInstaladaKwp
        : null,
      tipo_rede: snapshotClonado.tipoRede && snapshotClonado.tipoRede !== 'nenhum'
        ? snapshotClonado.tipoRede
        : null,
      tarifa_atual: Number.isFinite(snapshotClonado.tarifaCheia) && snapshotClonado.tarifaCheia > 0
        ? snapshotClonado.tarifaCheia
        : null,
      desconto_percentual: Number.isFinite(snapshotClonado.desconto) && snapshotClonado.desconto > 0
        ? snapshotClonado.desconto
        : null,
      mensalidade: isLeasingTab && Array.isArray(leasingSnap?.projecao?.mensalidadesAno) && leasingSnap.projecao.mensalidadesAno.length > 0
        ? (Number(leasingSnap.projecao.mensalidadesAno[0]?.[0] ?? 0) || null)
        : null,
      indicacao: dadosClonados.temIndicacao && dadosClonados.indicacaoNome?.trim()
        ? dadosClonados.indicacaoNome.trim()
        : null,
      modalidade: isLeasingTab ? 'leasing' : 'venda',
      prazo_meses: isLeasingTab && Number.isFinite(leasingSnap?.prazoContratualMeses) && leasingSnap.prazoContratualMeses > 0
        ? leasingSnap.prazoContratualMeses
        : (Number.isFinite(snapshotClonado.prazoMeses) && snapshotClonado.prazoMeses > 0
          ? snapshotClonado.prazoMeses
          : null),
      marca_inversor: isLeasingTab
        ? (leasingSnap?.contrato?.inversoresFV?.trim() || null)
        : (vendaSnap?.modelo_inversor?.trim() || null),
    }

    const upsertPayload: UpsertClientInput = {
      ...buildClientUpsertPayload(dadosClonados, 'manual_save', snapshotClonado),
      energyProfile,
      // Persist the official "valor de mercado" (Preço Ideal da Análise Financeira) for leasing proposals.
      // Uses the same source as custoFinalProjetadoCanonico (computed at component level).
      ...(isLeasingTab && Number.isFinite(custoFinalProjetadoCanonico) && custoFinalProjetadoCanonico > 0
        ? { valordemercado: custoFinalProjetadoCanonico }
        : {}),
    }

    // Debug log for consultant persistence tracing.
    console.info('[consultant][save-client]', {
      clientId: clienteEmEdicaoId ?? null,
      existingConsultantId: clienteEmEdicaoId
        ? (clientesSalvos.find((r) => r.id === clienteEmEdicaoId)?.dados.consultorId ?? null)
        : null,
      selectedConsultantId: dadosClonados.consultorId || null,
      payloadConsultantId: (upsertPayload as { consultant_id?: string | null }).consultant_id ?? null,
    })

    // Neon DB save FIRST so data is durable before the local cache is updated.
    let syncedToBackend = false
    let neonServerId: string | null = null
    // True when the backend returned a 5xx "service unavailable" status (e.g. DATABASE_URL
    // not configured in a preview deployment).  In that case we fall through to local save
    // rather than blocking the entire operation.
    let backendServiceUnavailable = false
    try {
      if (online) {
        // For edits use the known server ID; for new clients let the backend deduplicate.
        const knownServerId = clienteEmEdicaoId
          ? (clientServerIdMapRef.current[clienteEmEdicaoId] ?? null)
          : null
        console.info('[client-save] dispatching client API call', {
          clientId: clienteEmEdicaoId ?? null,
          serverId: knownServerId ?? null,
          operation: knownServerId ? 'PUT /api/clients/:id' : 'POST /api/clients/upsert-by-cpf',
        })
        // When creating (no known server ID), always pass the local client UUID as an
        // idempotency key so the server can return the existing record on retries or
        // cross-device saves instead of creating a new duplicate.
        const createPayload: UpsertClientInput = knownServerId
          ? upsertPayload
          : { ...upsertPayload, ...(clienteEmEdicaoId ? { offline_origin_id: clienteEmEdicaoId } : {}) }
        const serverRow = knownServerId
          ? await updateClientById(knownServerId, upsertPayload as UpdateClientInput)
          : await upsertClientByDocument(createPayload)
        neonServerId = serverRow.id
        console.info('[client-save] client mutation success', { clientId: serverRow.id, serverId: serverRow.id })
        clientLastPayloadSignatureRef.current = stableStringify(
          buildClientUpsertPayload(dadosClonados, 'client_autosave', snapshotClonado),
        )
        setClientLastSaveStatus('success')
        setOriginalClientData(cloneClienteDados(dadosClonados))
        userInteractedSinceSaveRef.current = false
        lastSavedSignatureRef.current = computeSignatureRef.current()
        syncedToBackend = true
        setClientsSyncState('online-db')
      } else {
        console.info('[client-save] client mutation skipped: offline — will save to localStorage only')
      }
    } catch (error) {
      setClientLastSaveStatus('error')
      setClientsSyncState('degraded-api')
      console.warn('[client-save] client mutation failed', error)
      console.warn('[ClienteSave] Neon save failed; saving locally as fallback:', error)
      // 503/502/504 means the backend is unreachable or not configured (e.g. no DATABASE_URL
      // in a Vercel preview deployment).  Treat this like an offline event so the data is
      // at least preserved in localStorage instead of being lost entirely.
      if (error instanceof ClientsApiError && (error.status === 503 || error.status === 502 || error.status === 504)) {
        backendServiceUnavailable = true
      }
    }

    if (online && !syncedToBackend && !backendServiceUnavailable) {
      setClientLastSaveStatus('error')
      console.error('[clients][mutation] failed', { operation: estaEditando ? 'update' : 'create', reason: 'backend_not_confirmed' })
      if (!options?.silent) {
        adicionarNotificacao('Falha ao salvar no servidor. Alteração não confirmada no banco.', 'error')
      }
      return false
    }

    // Compute the new client record and sorted list synchronously using the current
    // clientesSalvos snapshot.  We must NOT do this inside the setClientesSalvos
    // updater and then rely on a captured variable, because React 18 (createRoot +
    // automatic batching) calls state updaters asynchronously — the captured variable
    // would still be null when read on the very next line, causing a false "save failed".
    let localSaveWarning: string | null = null
    const novoComparacao = createClienteComparisonData(dadosClonados)
    let registroCorrespondente: ClienteRegistro | null = null

    for (const registro of clientesSalvos) {
      if (clienteEmEdicaoId && registro.id === clienteEmEdicaoId) {
        continue
      }

      const existenteComparacao = createClienteComparisonData(registro.dados)
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

    const existingIds = new Set(clientesSalvos.map((registro) => registro.id))
    let registrosAtualizados: ClienteRegistro[] = clientesSalvos
    let registroSalvo: ClienteRegistro | null = null
    const registroIdAlvo = clienteEmEdicaoId ?? registroCorrespondente?.id ?? null

    if (registroIdAlvo) {
      let encontrado = false
      registrosAtualizados = clientesSalvos.map((registro) => {
        if (registro.id === registroIdAlvo) {
          encontrado = true
          const atualizado: ClienteRegistro = {
            ...registro,
            dados: dadosClonados,
            atualizadoEm: agoraIso,
            propostaSnapshot: snapshotClonado,
            consumption_kwh_month: resolvedConsumption,
            system_kwp: resolvedSystemKwp,
            term_months: resolvedTermMonths,
          }
          registroSalvo = atualizado
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
          consumption_kwh_month: resolvedConsumption,
          system_kwp: resolvedSystemKwp,
          term_months: resolvedTermMonths,
        }
        registroSalvo = novoRegistro
        registrosAtualizados = [novoRegistro, ...clientesSalvos]
      }
    } else {
      const novoRegistro: ClienteRegistro = {
        id: generateClienteId(existingIds),
        criadoEm: agoraIso,
        atualizadoEm: agoraIso,
        dados: dadosClonados,
        propostaSnapshot: snapshotClonado,
        consumption_kwh_month: resolvedConsumption,
        system_kwp: resolvedSystemKwp,
        term_months: resolvedTermMonths,
      }
      registroSalvo = novoRegistro
      registrosAtualizados = [novoRegistro, ...clientesSalvos]
    }

    const ordenados = [...registrosAtualizados].sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1))

    // Persist to localStorage (best-effort, non-blocking for the save result).
    // When syncedToBackend is true the data is already safe on the server, so any
    // cache/quota failure here is purely cosmetic and must NOT produce a user-visible
    // toast that competes with the success message.  Demote such failures to console
    // warnings only.  User-visible warnings are reserved for offline / degraded mode
    // where localStorage really is the primary store.
    try {
      const { droppedCount } = persistClientesToLocalStorage(ordenados)
      if (droppedCount > 0) {
        console.warn(`[ClienteSave] localStorage quota tight — pruned ${droppedCount} registro(s) do cache`)
        if (!syncedToBackend) {
          localSaveWarning =
            'Dados salvos localmente com espaço reduzido. Alguns registros antigos foram removidos do cache do navegador.'
        }
      }
    } catch (error) {
      console.warn('[ClienteSave] non-quota localStorage error — backend save already confirmed; proceeding without local cache', error)
      if (!syncedToBackend) {
        localSaveWarning =
          'Não foi possível salvar localmente. Seus dados foram enviados ao servidor mas podem não estar disponíveis offline.'
      }
    }

    // Commit the pre-computed sorted list directly — no updater function needed since
    // we already computed the new state above from the synchronous snapshot.
    setClientesSalvos(ordenados)

    if (!registroSalvo) {
      adicionarNotificacao('Não foi possível salvar o cliente. Tente novamente.', 'error')
      return false
    }

    // Surface localStorage warnings only when the server was not available (offline /
    // degraded mode).  When syncedToBackend is true the data is already persisted in
    // the database and the cache issue is an implementation detail, not a user problem.
    if (localSaveWarning) {
      adicionarNotificacao(localSaveWarning, 'info')
    }

    // When the backend was unreachable (503/502/504) but local save succeeded, inform
    // the user in degraded mode rather than showing a hard failure.
    if (backendServiceUnavailable && !options?.silent) {
      adicionarNotificacao(
        'Servidor indisponível. Dados salvos localmente — serão sincronizados quando o serviço for restaurado.',
        'info',
      )
    }

    // Confirm to the user that their change was durably persisted in the database.
    // This toast is intentionally skipped in silent mode (auto-saves, linked saves).
    if (syncedToBackend && !options?.silent) {
      adicionarNotificacao(
        estaEditando ? 'Cliente atualizado com sucesso.' : 'Cliente criado com sucesso.',
        'success',
      )
    }

    const registroConfirmado: ClienteRegistro = registroSalvo

    // Update server ID map now that we have the local ID (from state) and Neon ID.
    if (syncedToBackend && neonServerId) {
      updateClientServerIdMap(registroConfirmado.id, neonServerId)
    }

    if (!online || !syncedToBackend) {
      // Fallback only: persist local draft when offline or backend save fails.
      try {
        await saveFormDraft(snapshotClonado)
        if (import.meta.env.DEV) {
          console.debug('[ClienteSave] Fallback draft saved to IndexedDB (offline/backend failure)')
        }
      } catch (error) {
        console.warn('[ClienteSave] Failed to persist fallback draft:', error)
      }
    } else {
      try {
        await clearFormDraft()
      } catch {
        // noop
      }
    }

    let sincronizadoComSucesso = false
    let erroSincronizacao: unknown = null


    const integracaoOneDriveAtiva = isOneDriveIntegrationAvailable()
    setOneDriveIntegrationAvailable(integracaoOneDriveAtiva)

    if (!integracaoOneDriveAtiva) {
      erroSincronizacao = new OneDriveIntegrationMissingError()
      if (import.meta.env.DEV && typeof console !== 'undefined') {
        console.debug('Sincronização com o OneDrive ignorada: integração não configurada.')
      }
    } else {
      try {
        await persistClienteRegistroToOneDrive(mapClienteRegistroToSyncPayload(registroConfirmado))
        sincronizadoComSucesso = true
      } catch (error) {
        erroSincronizacao = error
        if (error instanceof OneDriveIntegrationMissingError) {
          setOneDriveIntegrationAvailable(false)
          if (import.meta.env.DEV && typeof console !== 'undefined') {
            console.debug('Integração com o OneDrive indisponível.', error)
          }
        } else {
          console.error('Erro ao sincronizar cliente com o OneDrive.', error)
        }
      }
    }

    clienteEmEdicaoIdRef.current = registroConfirmado.id
    setClienteEmEdicaoId(registroConfirmado.id)
    lastSavedClienteRef.current = cloneClienteDados(dadosClonados)
    
    // Save to clientStore (IndexedDB) for guaranteed latest data
    try {
      await upsertClienteRegistro(registroConfirmado)
    } catch (error) {
      console.warn('[ClienteSave] Failed to save cliente to clientStore:', error)
      // Continue - localStorage is the source of truth
    }
    
    scheduleMarkStateAsSaved()

    if (!sincronizadoComSucesso && !(erroSincronizacao instanceof OneDriveIntegrationMissingError)) {
      const mensagemErro =
        erroSincronizacao instanceof Error && erroSincronizacao.message
          ? erroSincronizacao.message
          : 'Erro desconhecido ao sincronizar com o OneDrive.'
      adicionarNotificacao(
        syncedToBackend
          ? `Cliente salvo no banco de dados, mas houve erro ao sincronizar com o OneDrive. ${mensagemErro}`
          : `Cliente salvo localmente, mas houve erro ao sincronizar com o OneDrive. ${mensagemErro}`,
        syncedToBackend ? 'info' : 'error',
      )
    }

    if (syncedToBackend) {
      try {
        const budgetId = getActiveBudgetId()
        if (budgetId) {
          const proposalType = activeTabRef.current === 'vendas' ? 'venda' : 'leasing'
          const proposalPayload = buildProposalUpsertPayload(snapshotClonado)
          const knownServerId = proposalServerIdMapRef.current[budgetId]
          console.info('[client-save] proceeding to linked proposal save', {
            budgetId,
            proposalServerId: knownServerId ?? null,
            operation: knownServerId ? 'PATCH /api/proposals/:id' : 'POST /api/proposals',
          })
          const proposalRow = knownServerId
            ? await updateProposal(knownServerId, proposalPayload)
            : await createProposal({
                proposal_type: proposalType,
                payload_json: proposalPayload.payload_json ?? {},
                ...proposalPayload,
                proposal_code: budgetId,
              } satisfies CreateProposalInput)
          updateProposalServerIdMap(budgetId, proposalRow.id)
        }
      } catch (error) {
        console.warn('[ClienteSave] Proposal upsert on client save failed:', error)
      }

      try {
        const refreshed = await carregarClientesPrioritarios({ silent: true })
        setClientesSalvos(refreshed)
      } catch (error) {
        console.error('[clients][refresh-safe] failed', error)
        setClientsSyncState('degraded-api')
      }
    }

    return true
  }, [
    adicionarNotificacao,
    carregarClientesPrioritarios,
    cliente,
    clienteEmEdicaoId,
    clientesSalvos,
    custoFinalProjetadoCanonico,
    getCurrentSnapshot,
    isOneDriveIntegrationAvailable,
    persistClienteRegistroToOneDrive,
    scheduleMarkStateAsSaved,
    setClientesSalvos,
    setClientLastSaveStatus,
    setOneDriveIntegrationAvailable,
    setClienteEmEdicaoId,
    setOriginalClientData,
    updateClientServerIdMap,
    updateProposalServerIdMap,
    buildClientUpsertPayload,
    buildProposalUpsertPayload,
    validateClienteParaSalvar,
    clienteTemDadosNaoSalvos,
    getActiveBudgetId,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const AUTO_SAVE_CLIENT_INTERVAL_MS = 5000

    const scheduleClientAutoSave = () => {
      if (clientAutoSaveTimeoutRef.current) {
        clearTimeout(clientAutoSaveTimeoutRef.current)
      }

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      clientAutoSaveTimeoutRef.current = setTimeout(async () => {
        if (isHydratingRef.current || !clienteEmEdicaoId) {
          return
        }
        if (deletingClientIdsRef.current.has(clienteEmEdicaoId)) {
          return
        }
        if (!isConnectivityOnline()) {
          try {
            const snapshotFallback = getCurrentSnapshot()
            if (snapshotFallback && !isHydratingRef.current) {
              await saveFormDraft(snapshotFallback)
            }
          } catch (fallbackError) {
            console.warn('[ClienteAutoSave] Failed to save offline fallback draft:', fallbackError)
          }
          return
        }
        if (clientServerAutoSaveInFlightRef.current) {
          return
        }

        const nome = (cliente.nome ?? '').trim()
        if (!nome) {
          return
        }

        const snapshotAtual = getCurrentSnapshot()
        const payload = buildClientUpsertPayload(cliente, 'client_autosave', snapshotAtual)
        const payloadSignature = stableStringify(payload)
        if (payloadSignature === clientLastPayloadSignatureRef.current) {
          return
        }

        clientServerAutoSaveInFlightRef.current = true
        try {
          const knownServerId = clientServerIdMapRef.current[clienteEmEdicaoId]
          // When no server ID is known, include the local client UUID as an idempotency
          // key so repeated auto-saves don't create duplicate server records.
          const autoSavePayload: UpsertClientInput = knownServerId
            ? payload
            : { ...payload, offline_origin_id: clienteEmEdicaoId }
          const serverRow = knownServerId
            ? await updateClientById(knownServerId, payload as UpdateClientInput)
            : await upsertClientByDocument(autoSavePayload)
          clientLastPayloadSignatureRef.current = payloadSignature
          updateClientServerIdMap(clienteEmEdicaoId, serverRow.id)
          await clearFormDraft()
        } catch (error) {
          console.warn('[ClienteAutoSave] Failed to auto-save cliente to backend:', error)
          try {
            const snapshotFallback = getCurrentSnapshot()
            if (snapshotFallback && !isHydratingRef.current) {
              await saveFormDraft(snapshotFallback)
            }
          } catch (fallbackError) {
            console.warn('[ClienteAutoSave] Failed to save fallback draft after backend failure:', fallbackError)
          }
        } finally {
          clientServerAutoSaveInFlightRef.current = false
        }
      }, AUTO_SAVE_CLIENT_INTERVAL_MS)
    }

    scheduleClientAutoSave()

    return () => {
      if (clientAutoSaveTimeoutRef.current) {
        clearTimeout(clientAutoSaveTimeoutRef.current)
      }
    }
  }, [cliente, clienteEmEdicaoId, getCurrentSnapshot, updateClientServerIdMap, buildClientUpsertPayload])

  const handleExcluirCliente = useCallback(
    async (registro: ClienteRegistro) => {
      if (typeof window === 'undefined') {
        return
      }

      const nomeCliente = registro.dados.nome?.trim() || 'este cliente'
      const confirmado = await requestConfirmDialog({
        title: 'Excluir cliente',
        description: `Deseja realmente excluir ${nomeCliente}? Essa ação não poderá ser desfeita.`,
        confirmLabel: 'Excluir',
        cancelLabel: 'Cancelar',
      })
      if (!confirmado) {
        return
      }
      deletingClientIdsRef.current.add(registro.id)
      const targetKey = getClientStableKey(registro)
      deletedClientKeysRef.current.add(targetKey)
      const reconciledAt = Date.now()
      setLastDeleteReconciledAt(reconciledAt)
      persistDeletedClientKeys(deletedClientKeysRef.current, reconciledAt)
      if (clientAutoSaveTimeoutRef.current) {
        clearTimeout(clientAutoSaveTimeoutRef.current)
      }
      console.info('[clients][delete] start', { id: registro.id })

      const serverIdCandidate =
        clientServerIdMapRef.current[registro.id] ??
        (CLIENTE_ID_PATTERN.test(registro.id) ? null : registro.id)
      if (isConnectivityOnline() && serverIdCandidate) {
        setClientsSyncState('reconciling')
        try {
          await deleteClientById(serverIdCandidate)
          setClientsSyncState('online-db')
          setClientsLastDeleteError(null)
          console.info('[clients][delete] success', { id: serverIdCandidate })
          adicionarNotificacao(`"${nomeCliente}" removido com sucesso.`, 'success')
        } catch (error) {
          if (!isClientNotFoundError(error)) {
            console.error('Erro ao excluir cliente no backend.', error)
            console.error('[clients][mutation] failed', { operation: 'delete', error })
            setClientsSyncState('degraded-api')
            setClientsLastDeleteError(error instanceof Error ? error.message : String(error))
            console.error('[clients][delete] failed', {
              id: serverIdCandidate,
              message: error instanceof Error ? error.message : String(error),
            })
            // Rollback optimistic hide: the backend did NOT confirm the delete,
            // so remove the key from the ref and persist the corrected state.
            console.info('[clients][delete] rollback-local-hide', { id: registro.id, key: targetKey })
            deletedClientKeysRef.current.delete(targetKey)
            persistDeletedClientKeys(deletedClientKeysRef.current, Date.now())
            const motivo = error instanceof Error && error.message ? error.message : 'Erro desconhecido.'
            adicionarNotificacao(
              `Não foi possível excluir "${nomeCliente}" no servidor. ${motivo}`,
              'error',
            )
            deletingClientIdsRef.current.delete(registro.id)
            return
          }
          console.info('[clients] cliente já inexistente no backend; UI reconciliada', { id: serverIdCandidate })
          adicionarNotificacao(
            'Cliente removido. A recarga completa da lista falhou, mas a remoção foi reconciliada e não deve reaparecer após atualização.',
            'warning',
          )
        }
      }

      let removeuEdicaoAtual = false
      let localCacheWarning: string | null = null

      setClientesSalvos((prevRegistros) => {
        const registrosAtualizados = prevRegistros.filter((item) => item.id !== registro.id)
        if (registrosAtualizados.length === prevRegistros.length) {
          return prevRegistros
        }

        // Always commit the removal in React state first — backend already confirmed the delete.
        // Cache update is best-effort and must never revert a successful backend operation.
        try {
          if (registrosAtualizados.length > 0) {
            persistClientesToLocalStorage(registrosAtualizados)
          } else {
            window.localStorage.removeItem(CLIENTES_STORAGE_KEY)
          }
        } catch (cacheError) {
          // Quota or other local-storage failure: try progressively lighter payloads.
          if (isQuotaExceededError(cacheError)) {
            try {
              const ultraLite = registrosAtualizados.map((r) => ({ ...r, propostaSnapshot: undefined }))
              window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(ultraLite))
            } catch {
              try { window.localStorage.removeItem(CLIENTES_STORAGE_KEY) } catch { /* noop */ }
            }
          }
          console.warn('[clients][delete] local cache update failed (non-blocking — backend delete already confirmed)', cacheError)
          localCacheWarning = 'Cache local não pôde ser atualizado por limite de armazenamento. O cliente foi excluído do servidor com sucesso.'
        }

        if (clienteEmEdicaoId === registro.id) {
          removeuEdicaoAtual = true
        }

        return registrosAtualizados
      })

      if (localCacheWarning) {
        adicionarNotificacao(localCacheWarning, 'info')
      }

      if (removeuEdicaoAtual) {
        setClienteSync(cloneClienteDados(CLIENTE_INICIAL))
        setClienteMensagens({})
        clienteEmEdicaoIdRef.current = null
        lastSavedClienteRef.current = null
        setClienteEmEdicaoId(null)
      }

      removeClientServerIdMapEntry(registro.id)

      if (isConnectivityOnline() && serverIdCandidate) {
        try {
          const refreshed = await carregarClientesPrioritarios()
          setClientesSalvos(refreshed)
        } catch (error) {
          console.warn('[clients][refresh-safe] failed; preserving optimistic state', error)
          setClientsSyncState('degraded-api')
        }
      }
      deletingClientIdsRef.current.delete(registro.id)
    },
    [
      adicionarNotificacao,
      carregarClientesPrioritarios,
      clienteEmEdicaoId,
      getClientStableKey,
      persistDeletedClientKeys,
      removeClientServerIdMapEntry,
      requestConfirmDialog,
      setClienteEmEdicaoId,
      setClienteMensagens,
      setClientesSalvos,
      setClienteSync,
    ],
  )

  const handleExportarParaCarteira = useCallback(
    async (registro: ClienteRegistro) => {
      const nomeCliente = registro.dados.nome?.trim() || 'este cliente'

      // ── Data-integrity gate ─────────────────────────────────────────────
      // Run the full proposal readiness pipeline before allowing portfolio export.
      // This validates: CEP, CPF/CNPJ, phone, email, UC geradora (errors),
      // plus distribuidora, system_kwp, geração estimada, prazo (warnings).
      const ucBeneficiariasNums = (
        registro.propostaSnapshot?.ucBeneficiarias ?? []
      ).map((uc) => uc?.numero ?? null)

      const readiness = validateProposalReadinessForClosing({
        proposalId: registro.propostaSnapshot?.currentBudgetId ?? null,
        clienteDados: {
          nome: registro.dados.nome,
          documento: registro.dados.documento,
          email: registro.dados.email,
          telefone: registro.dados.telefone,
          cep: registro.dados.cep,
          cidade: registro.dados.cidade,
          uf: registro.dados.uf,
          endereco: registro.dados.endereco,
          distribuidora: registro.dados.distribuidora,
          uc: registro.dados.uc,
          indicacaoNome: registro.dados.indicacaoNome,
          temIndicacao: registro.dados.temIndicacao,
          diaVencimento: registro.dados.diaVencimento,
        },
        snapshot: registro.propostaSnapshot ?? {},
        ucBeneficiarias: ucBeneficiariasNums.length > 0 ? ucBeneficiariasNums : [],
      })

      if (!readiness.ok) {
        setClientReadinessErrors(readiness.issues)
        return
      }
      // ────────────────────────────────────────────────────────────────────

      const serverIdCandidate =
        clientServerIdMapRef.current[registro.id] ??
        (CLIENTE_ID_PATTERN.test(registro.id) ? null : registro.id)

      if (!serverIdCandidate) {
        window.alert(`${nomeCliente} ainda não está sincronizado com o servidor. Salve o cliente antes de ativar na Carteira.`)
        return
      }

      const confirmado = await requestConfirmDialog({
        title: 'Ativar Cliente',
        description: `Ativar ${nomeCliente} na Carteira de Clientes? O cliente continuará visível aqui e também aparecerá na Carteira.`,
        confirmLabel: 'Ativar Cliente',
        cancelLabel: 'Cancelar',
      })
      if (!confirmado) return

      try {
        // The canonical ClienteDados type does not yet include razaoSocial,
        // cnpj/cpf split fields, telefoneSecundario, or address parts (bairro,
        // numero, complemento). Read them defensively in case the underlying
        // record carries them as extras (snapshot cliente sub-object,
        // imported records, future model extensions).
        const dadosExtras = registro.dados as unknown as Record<string, unknown>
        const readStr = (key: string): string | undefined => {
          const v = dadosExtras[key]
          return typeof v === 'string' && v.trim() !== '' ? v : undefined
        }
        const result = await convertClientToClosedDeal({
          clientId: Number(serverIdCandidate),
          proposalId: registro.propostaSnapshot?.currentBudgetId ?? null,
          clienteDados: {
            nome: registro.dados.nome,
            razaoSocial: readStr('razaoSocial'),
            documento: registro.dados.documento,
            cpf: readStr('cpf'),
            cnpj: readStr('cnpj'),
            email: registro.dados.email,
            telefone: registro.dados.telefone,
            telefoneSecundario: readStr('telefoneSecundario'),
            cep: registro.dados.cep,
            cidade: registro.dados.cidade,
            uf: registro.dados.uf,
            endereco: registro.dados.endereco,
            bairro: readStr('bairro'),
            numero: readStr('numero'),
            complemento: readStr('complemento'),
            distribuidora: registro.dados.distribuidora,
            uc: registro.dados.uc,
            indicacaoNome: registro.dados.indicacaoNome,
            temIndicacao: registro.dados.temIndicacao,
            diaVencimento: registro.dados.diaVencimento,
            consultorId: registro.dados.consultorId,
            ownerUserId: registro.ownerUserId,
            createdByUserId: registro.createdByUserId,
          },
          snapshot: registro.propostaSnapshot ?? {},
          consultants: formConsultores,
          ucBeneficiarias: ucBeneficiariasNums.filter((u): u is string => typeof u === 'string'),
        })

        if (!result.ok) {
          window.alert(`Não foi possível ativar ${nomeCliente} na Carteira. Tente novamente.`)
          return
        }

        adicionarNotificacao(`${nomeCliente} ativado na Carteira de Clientes com sucesso!`, 'success')
        const refreshed = await carregarClientesPrioritarios({ silent: true })
        setClientesSalvos(refreshed)
      } catch (err) {
        console.error('[portfolio] export failed', err)
        window.alert(`Não foi possível ativar ${nomeCliente} na Carteira. Tente novamente.`)
      }
    },
    [adicionarNotificacao, requestConfirmDialog, carregarClientesPrioritarios, setClientesSalvos, formConsultores],
  )

  const parseOrcamentosSalvos = useCallback(
    (existenteRaw: string | null): OrcamentoSalvo[] => {
      if (!existenteRaw) {
        return []
      }

      try {
        const parsed = JSON.parse(existenteRaw) as unknown
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
              snapshotNormalizado.tusdTipoCliente = normalizeTusdTipoClienteValue(
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
                  ? normalizeTusdTipoClienteValue(snapshotNormalizado.vendaForm.tusd_tipo_cliente)
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

  // Loads the local draft cache from localStorage. NOT the official source of truth.
  // The backend (/api/proposals) is the source of truth per docs/PROPOSALS_SOURCE_OF_TRUTH.md.
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

    // All authenticated users: try Neon DB first. PostgreSQL RLS enforces per-role
    // access control (admin/financeiro → all; office → own + comercial; comercial → own).
    try {
      const allRegistros: OrcamentoSalvo[] = []
      const proposalMapUpdates: Record<string, string> = {}
      let page = 1
      const limit = 100
      const MAX_PAGES = 50 // safety cap: up to 5,000 records
      for (;;) {
        const result = await listProposalsFromApi({ page, limit })
        allRegistros.push(
          ...result.data.map((row) => {
            const mapped = serverProposalToOrcamento(row)
            if (mapped.id && row.id) {
              proposalMapUpdates[mapped.id] = row.id
            }
            return mapped
          }),
        )
        if (page >= result.pagination.pages || result.data.length === 0 || page >= MAX_PAGES) break
        page++
      }
      if (Object.keys(proposalMapUpdates).length > 0) {
        proposalServerIdMapRef.current = {
          ...proposalServerIdMapRef.current,
          ...proposalMapUpdates,
        }
        try {
          window.localStorage.setItem(
            PROPOSAL_SERVER_ID_MAP_STORAGE_KEY,
            JSON.stringify(proposalServerIdMapRef.current),
          )
        } catch (error) {
          console.warn('[proposals] Failed to persist proposal server-id map after API load:', error)
        }
      }
      // Cache fresh Neon data in localStorage for offline fallback
      try { window.localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(allRegistros)) } catch {}
      setProposalsSyncState('synced')
      return allRegistros
    } catch (error) {
      setProposalsSyncState('local-only')
      adicionarNotificacao('Propostas em modo local temporário: backend indisponível / sem sincronização com o banco.', 'error')
      console.warn('[proposals] Falha ao carregar propostas via API; fallback para armazenamento local.', error)
      // Fall through to storage-based loading
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
        if (import.meta.env.DEV) console.debug('Leitura via OneDrive ignorada: integração não configurada.')
      } else {
        console.warn('Não foi possível carregar propostas via OneDrive.', error)
      }
    }

    const fallbackRaw = window.localStorage.getItem(BUDGETS_STORAGE_KEY)
    return parseOrcamentosSalvos(fallbackRaw)
  }, [adicionarNotificacao, carregarOrcamentosSalvos, parseOrcamentosSalvos])

  useEffect(() => {
    // Only load proposals once the backend session is confirmed authenticated.
    // Without this guard the effect fires before the token provider is registered,
    // producing a noisy 401 on /api/proposals and an unnecessary fallback cascade.
    if (meAuthState !== 'authenticated') return
    let cancelado = false
    const carregar = async () => {
      if (cancelado) {
        return
      }
      const registros = await carregarOrcamentosPrioritarios()
      if (!cancelado) {
        setOrcamentosSalvos(registros)
      }
    }
    void carregar()
    return () => {
      cancelado = true
    }
  // authSyncKey increments when Stack Auth token becomes available, ensuring
  // this effect re-runs on new devices where auth resolves after initial mount.
   
  }, [carregarOrcamentosPrioritarios, authSyncKey, meAuthState])

  // Carregar draft do formulário do IndexedDB na inicialização
  useEffect(() => {
    let cancelado = false
    const carregarDraft = async () => {
      try {
        if (import.meta.env.DEV) console.debug('[App] Loading form draft from IndexedDB on mount')
        const envelope = await loadFormDraft<OrcamentoSnapshotData>()
        
        if (cancelado) {
          return
        }
        
        if (envelope && envelope.data) {
          if (import.meta.env.DEV) console.debug('[App] Form draft found, applying snapshot')
          
          // Enable hydration mode to prevent state reset and auto-save during apply
          isHydratingRef.current = true
          setIsHydrating(true)
          if (import.meta.env.DEV) console.debug('[App] Hydration mode enabled')
          
          try {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            aplicarSnapshot(envelope.data)
            
            // Wait for React to apply all setState calls
            await tick()
            
            if (import.meta.env.DEV) console.debug('[App] Hydration done')
          } finally {
            isHydratingRef.current = false
            setIsHydrating(false)
          }

          // Show a discreet recovery notification
          const clientName = (envelope.data.cliente?.nome ?? '').trim()
          const recoveryMsg = clientName
            ? `Progresso recuperado: ${clientName}`
            : 'Progresso recuperado automaticamente'
          adicionarNotificacao(recoveryMsg, 'info')

          if (import.meta.env.DEV) console.debug('[App] Form draft applied successfully')
        } else {
          if (import.meta.env.DEV) console.debug('[App] No form draft found in IndexedDB')
        }
      } catch (error) {
        console.error('[App] Failed to load form draft:', error)
      }
    }
    void carregarDraft()
    return () => {
      cancelado = true
    }
     
  }, [])

  // Auto-save debounced: prioriza persistência oficial no backend (/api/proposals).
  // O rascunho local (IndexedDB) é usado somente quando estiver offline.
  useEffect(() => {
    // Skip auto-save during hydration to prevent overwriting draft with empty/partial state
    if (isHydratingRef.current) {
      return
    }
    
    const AUTO_SAVE_INTERVAL_MS = 5000
    
    const scheduleAutoSave = () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
      
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      autoSaveTimeoutRef.current = setTimeout(async () => {
        // Double-check hydration status before saving
        const activeBudgetId = getActiveBudgetId()
        if (isHydratingRef.current || !activeBudgetId) {
          if (import.meta.env.DEV) console.debug('[App] Auto-save skipped: hydrating or missing budgetId')
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
          
          const online = isConnectivityOnline()

          if (!online) {
            await saveFormDraft(snapshot)
            if (import.meta.env.DEV) {
              console.debug('[App] Auto-saved form draft to IndexedDB (offline fallback)')
            }
            return
          }

          if (proposalServerAutoSaveInFlightRef.current) {
            if (import.meta.env.DEV) console.debug('[App] Auto-save skipped: server request already in flight')
            return
          }

          proposalServerAutoSaveInFlightRef.current = true
          try {
            const proposalType = activeTabRef.current === 'vendas' ? 'venda' : 'leasing'
            const budgetId = activeBudgetId
            const knownServerId = proposalServerIdMapRef.current[budgetId]
            const proposalPayload = buildProposalUpsertPayload(snapshot)

            const row = knownServerId
              ? await updateProposal(knownServerId, proposalPayload)
              : await createProposal({
                  proposal_type: proposalType,
                  proposal_code: budgetId,
                  payload_json: proposalPayload.payload_json ?? {},
                  ...(proposalPayload.client_name ? { client_name: proposalPayload.client_name } : {}),
                  ...(proposalPayload.client_document ? { client_document: proposalPayload.client_document } : {}),
                  ...(proposalPayload.client_city ? { client_city: proposalPayload.client_city } : {}),
                  ...(proposalPayload.client_state ? { client_state: proposalPayload.client_state } : {}),
                  ...(proposalPayload.client_phone ? { client_phone: proposalPayload.client_phone } : {}),
                  ...(proposalPayload.client_email ? { client_email: proposalPayload.client_email } : {}),
                  ...(proposalPayload.client_cep ? { client_cep: proposalPayload.client_cep } : {}),
                  ...(typeof proposalPayload.consumption_kwh_month === 'number'
                    ? { consumption_kwh_month: proposalPayload.consumption_kwh_month }
                    : {}),
                  ...(typeof proposalPayload.system_kwp === 'number' ? { system_kwp: proposalPayload.system_kwp } : {}),
                  ...(typeof proposalPayload.term_months === 'number' ? { term_months: proposalPayload.term_months } : {}),
                  ...(proposalPayload.uc_beneficiaria ? { uc_beneficiaria: proposalPayload.uc_beneficiaria } : {}),
                } satisfies CreateProposalInput)

            updateProposalServerIdMap(budgetId, row.id)
            await clearFormDraft()
            if (import.meta.env.DEV) {
              console.debug('[App] Auto-saved proposal to server', {
                budgetId,
                proposalId: row.id,
                mode: knownServerId ? 'update' : 'create',
              })
            }
          } finally {
            proposalServerAutoSaveInFlightRef.current = false
          }
        } catch (error) {
          console.warn('[App] Auto-save failed:', error)
          try {
            const snapshotFallback = getCurrentSnapshot()
            if (snapshotFallback && !isHydratingRef.current) {
              await saveFormDraft(snapshotFallback)
              if (import.meta.env.DEV) {
                console.debug('[App] Auto-save fallback: form draft saved to IndexedDB after server failure')
              }
            }
          } catch (fallbackError) {
            console.warn('[App] Auto-save fallback failed:', fallbackError)
          }
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
    buildProposalUpsertPayload,
    getActiveBudgetId,
    getCurrentSnapshot,
    updateProposalServerIdMap,
  ])

  // Idle sync: reload clients and proposals from Neon every 2 minutes while online.
  // Keeps data fresh without requiring manual navigation and catches changes made
  // from other devices or sessions.
  useEffect(() => {
    const IDLE_SYNC_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const timer = setInterval(async () => {
      if (!isConnectivityOnline()) return
      try {
        const [clientes, orcamentos] = await Promise.allSettled([
          carregarClientesPrioritarios(),
          carregarOrcamentosPrioritarios(),
        ])
        if (clientes.status === 'fulfilled') setClientesSalvos(clientes.value)
        if (orcamentos.status === 'fulfilled') setOrcamentosSalvos(orcamentos.value)
      } catch {
        // Non-critical: ignore failures, next interval will retry
      }
    }, IDLE_SYNC_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [carregarClientesPrioritarios, carregarOrcamentosPrioritarios])

  const aplicarSnapshot = (
    snapshotEntrada: OrcamentoSnapshotData,
    options?: { budgetIdOverride?: string; allowEmpty?: boolean },
  ) => {
    if (import.meta.env.DEV) console.debug('[aplicarSnapshot] Starting to apply snapshot')
    
    // Guard: Block empty snapshot applications that would wipe form data
    const nome = (snapshotEntrada?.cliente?.nome ?? '').trim()
    const endereco = (snapshotEntrada?.cliente?.endereco ?? '').trim()
    const kwh = Number(snapshotEntrada?.kcKwhMes ?? 0)
    
    const isEmptyApply = !nome && !endereco && kwh === 0
    
    // Allow empty only if explicitly requested (intentional reset)
    if (isEmptyApply && !options?.allowEmpty) {
      console.warn('[aplicarSnapshot] BLOCKED empty snapshot apply (would wipe form)')
      return
    }
    
    const snapshotClonado = cloneSnapshotData(snapshotEntrada)
    const budgetId = options?.budgetIdOverride ?? snapshotClonado.currentBudgetId
    const snapshot = mergeSnapshotWithDefaults(snapshotClonado, budgetId)
    snapshot.tipoInstalacao = normalizeTipoInstalacao(snapshot.tipoInstalacao)
    snapshot.tipoInstalacaoOutro = snapshot.tipoInstalacaoOutro || ''
    snapshot.tipoEdificacaoOutro = snapshot.tipoEdificacaoOutro || ''
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    snapshot.pageShared = {
      ...snapshot.pageShared,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      tipoInstalacao: normalizeTipoInstalacao(snapshot.pageShared.tipoInstalacao),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      tipoInstalacaoOutro: snapshot.pageShared.tipoInstalacaoOutro || '',
    }

    fieldSyncActions.reset()
    setActiveTab(snapshot.activeTab)
    setSettingsTab(snapshot.settingsTab)
    const clienteClonado = cloneClienteDados(snapshot.cliente)
    setClienteSync(clienteClonado)
    setClienteEmEdicaoId(snapshot.clienteEmEdicaoId)
    lastSavedClienteRef.current = snapshot.clienteEmEdicaoId ? clienteClonado : null
    setClienteMensagens(snapshot.clienteMensagens ? { ...snapshot.clienteMensagens } : {})
    setUcsBeneficiarias(cloneUcBeneficiariasForm(snapshot.ucBeneficiarias || []))
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
    const tusdNormalizado = normalizeTusdTipoClienteValue(snapshot.tusdTipoCliente)
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
        ? normalizeTusdTipoClienteValue(snapshot.vendaForm.tusd_tipo_cliente)
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
    setUseBentoGridPdf(snapshot.useBentoGridPdf ?? INITIAL_VALUES.useBentoGridPdf)
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
    setTipoRede(snapshot.tipoRede ?? 'nenhum')
    setTipoRedeControle(snapshot.tipoRedeControle ?? 'auto')
    setLeasingAnexosSelecionados(
      ensureRequiredLeasingAnexos(
        Array.isArray(snapshot.leasingAnexosSelecionados)
          ? [...snapshot.leasingAnexosSelecionados]
          : getDefaultLeasingAnexos(
              snapshot.leasingSnapshot?.contrato?.tipoContrato ?? 'residencial',
              { corresponsavelAtivo },
            ),
        snapshot.leasingSnapshot?.contrato?.tipoContrato ?? 'residencial',
        { corresponsavelAtivo },
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
      setOriginalClientData(cloneClienteDados(dadosClonados))
      setClientLastSaveStatus('idle')
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
      setOriginalClientData,
    ],
  )

  const carregarOrcamentoParaEdicao = useCallback(
    async (registro: OrcamentoSalvo, options?: { notificationMessage?: string }) => {
      // Try to load complete snapshot from proposalStore first
      let snapshotToApply = registro.snapshot
      
      if (registro.id) {
        // Use normalized ID for consistent lookup
        const budgetIdKey = normalizeProposalId(registro.id) || registro.id
        if (import.meta.env.DEV) console.debug(`[carregarOrcamentoParaEdicao] Loading snapshot for budget: ${budgetIdKey}`)
        const completeSnapshot = await loadProposalSnapshotById(budgetIdKey)
        
        if (completeSnapshot) {
          // Validate that loaded snapshot is meaningful
          const nome = (completeSnapshot.cliente?.nome ?? '').trim()
          const endereco = (completeSnapshot.cliente?.endereco ?? '').trim()
          const documento = (completeSnapshot.cliente?.documento ?? '').trim()
          const kc = Number(completeSnapshot.kcKwhMes ?? 0)
          const isMeaningful = Boolean(nome || endereco || documento) || kc > 0
          
          if (isMeaningful) {
            if (import.meta.env.DEV) {
              console.debug('[carregarOrcamentoParaEdicao] Using proposalStore snapshot', {
                totalFields: Object.keys(completeSnapshot).length,
              })
            }
            snapshotToApply = completeSnapshot
          } else {
            if (import.meta.env.DEV) console.debug('[carregarOrcamentoParaEdicao] proposalStore snapshot empty, using fallback')
          }
        } else {
          if (import.meta.env.DEV) console.debug('[carregarOrcamentoParaEdicao] snapshot not found, using fallback')
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
      // Re-sync prazoContratualMeses immediately after reset so the store
      // never stays at 0 while leasingPrazo hasn't changed (effect wouldn't re-fire)
      leasingActions.update({ prazoContratualMeses: leasingPrazo * 12 })
    }
  }, [leasingPrazo])

  // Saves proposal data to local storage (localStorage + IndexedDB) as a local draft cache.
  // ⚠️  This is NOT the backend persistence. It is a local draft cache only.
  // The official source of truth is Neon via POST/PATCH /api/proposals.
  // See docs/PROPOSALS_SOURCE_OF_TRUTH.md.
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
        if (import.meta.env.DEV) {
          console.debug('[salvarOrcamentoLocalmente] Snapshot from getCurrentSnapshot():', {
            kcKwhMes: snapshotClonado.kcKwhMes ?? 0,
            totalFields: Object.keys(snapshotClonado).length,
          })
        }
        
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
          const { persisted, droppedCount } = persistBudgetsToLocalStorage(registrosAtualizados)
          setOrcamentosSalvos(persisted)
          alertPrunedBudgets(droppedCount)
          void persistRemoteStorageEntry(BUDGETS_STORAGE_KEY, JSON.stringify(persisted))
          void persistPropostasToOneDrive(JSON.stringify(persisted)).catch((error) => {
            if (error instanceof OneDriveIntegrationMissingError) {
              return
            }
            if (import.meta.env.DEV) console.warn('Não foi possível sincronizar propostas com o OneDrive.', error)
          })
          
          // Save complete snapshot to proposalStore for full restoration
          const budgetIdKey = normalizeProposalId(effectiveBudgetId) || effectiveBudgetId
          if (import.meta.env.DEV) console.debug('[salvarOrcamentoLocalmente] Saving to proposalStore (update):', budgetIdKey)
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
        const { persisted, droppedCount } = persistBudgetsToLocalStorage(registrosAtualizados)
        setOrcamentosSalvos(persisted)
        alertPrunedBudgets(droppedCount)
        void persistRemoteStorageEntry(BUDGETS_STORAGE_KEY, JSON.stringify(persisted))
        void persistPropostasToOneDrive(JSON.stringify(persisted)).catch((error) => {
          if (error instanceof OneDriveIntegrationMissingError) {
            return
          }
          if (import.meta.env.DEV) console.warn('Não foi possível sincronizar propostas com o OneDrive.', error)
        })
        
        // Save complete snapshot to proposalStore for full restoration
        const budgetIdKey = normalizeProposalId(registro.id) || registro.id
        if (import.meta.env.DEV) console.debug('[salvarOrcamentoLocalmente] Saving to proposalStore (new):', budgetIdKey)
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
  },
  [validateClienteParaSalvar],
  )

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
    if (import.meta.env.DEV) {
      console.debug('[Hydration] DONE - cliente state updated')
    }
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
      // Marca saída limpa da sessão — na próxima visita os stores iniciam com estado padrão.
      // Se o browser crashar/tab for morta sem disparar beforeunload, 'session_active' permanece
      // 'true' e os stores farão recuperação automática a partir do sessionStorage.
      window.sessionStorage.removeItem('session_active')

      // Emergency snapshot: save current form state to IndexedDB before the page
      // unloads.  This is a synchronous-start / fire-and-forget write — the browser
      // gives us a small window to initiate async work in beforeunload, and IndexedDB
      // transactions started here will generally complete even if the page is torn down.
      if (!isHydratingRef.current) {
        try {
          const snapshot = getCurrentSnapshot()
          if (snapshot) {
            const nome = (snapshot?.cliente?.nome ?? '').trim()
            const endereco = (snapshot?.cliente?.endereco ?? '').trim()
            const kwh = Number(snapshot?.kcKwhMes ?? 0)
            if (nome || endereco || kwh > 0) {
              // Fire-and-forget — we can't await in beforeunload
              void saveFormDraft(snapshot)
            }
          }
        } catch {
          // Best effort — don't block unload
        }
      }

      if (!hasUnsavedChanges()) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    // Save a snapshot when the page loses visibility (user switches tabs/apps).
    // This covers scenarios where the browser might kill the tab in the background.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !isHydratingRef.current) {
        try {
          const snapshot = getCurrentSnapshot()
          if (snapshot) {
            const nome = (snapshot?.cliente?.nome ?? '').trim()
            const endereco = (snapshot?.cliente?.endereco ?? '').trim()
            const kwh = Number(snapshot?.kcKwhMes ?? 0)
            if (nome || endereco || kwh > 0) {
              void saveFormDraft(snapshot)
            }
          }
        } catch {
          // Best effort
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [hasUnsavedChanges, getCurrentSnapshot])

  // Marca a sessão como ativa logo após o mount. Combinado com a remoção no beforeunload,
  // permite que os stores detectem crashes (session_active === 'true' no próximo boot).
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('session_active', 'true')
    }
  }, [])

  const removerOrcamentoSalvo = useCallback(
    async (id: string) => {
      if (typeof window === 'undefined') {
        return
      }

      const serverId = proposalServerIdMapRef.current[id]
      if (isConnectivityOnline() && serverId) {
        setProposalsSyncState('pending')
        try {
          await deleteProposal(serverId)
          setProposalsSyncState('synced')
        } catch (error) {
          console.error('Erro ao excluir orçamento no backend.', error)
          setProposalsSyncState('failed')
          window.alert('Não foi possível excluir o orçamento no servidor. Tente novamente.')
          return
        }
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

      removeProposalServerIdMapEntry(id)
    },
    [removeProposalServerIdMapEntry, setOrcamentosSalvos],
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
    if (!validatePropostaLeasingMinimal()) {
      return
    }

    if (!confirmarAlertasGerarProposta()) {
      return
    }

    // Open the preview window synchronously here — before any await — so that Safari's
    // popup policy (which only allows window.open() within a synchronous user-gesture
    // handler) is satisfied.  All subsequent async work writes into this already-opened
    // window via the preOpenedWindow option of openBudgetPreviewWindow.
    const preOpenedWindow = window.open('', '_blank', 'width=1024,height=768')

    if (!(await ensureNormativePrecheck())) {
      preOpenedWindow?.close()
      return
    }

    await handleSalvarCliente({ skipGuard: true, silent: true })

    const resultado = await prepararPropostaParaExportacao({
      incluirTabelaBuyout: isVendaDiretaTab,
    })

    if (!resultado) {
      preOpenedWindow?.close()
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
      preOpenedWindow,
    })
  }

  const handleImprimirTabelaTransferencia = useCallback(async () => {
    if (gerandoTabelaTransferencia) {
      return
    }

    const codigoOrcamento = printableData.budgetId?.trim()
    const codigoOrcamentoImpressao =
      codigoOrcamento || normalizeProposalId(getActiveBudgetId()) || 'RASCUNHO'

    const possuiValoresTransferencia = tabelaBuyout.some(
      (row) => row.valorResidual != null && Number.isFinite(row.valorResidual) && row.mes >= 7,
    )
    if (!possuiValoresTransferencia) {
      window.alert(
        'Não há valores calculados para a compra antecipada desta proposta. Atualize a simulação antes de imprimir a tabela.',
      )
      return
    }

    // Open the preview window synchronously before any await (required for Safari popup policy).
    const preOpenedWindow = window.open('', '_blank', 'width=1024,height=768')

    setGerandoTabelaTransferencia(true)

    try {
      const html = await renderPrintableBuyoutTableToHtml({
        cliente: cloneClienteDados(cliente),
        budgetId: codigoOrcamentoImpressao,
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
      const budgetIdNormalizado = normalizeProposalId(codigoOrcamentoImpressao)

      pendingPreviewDataRef.current = null

      openBudgetPreviewWindow(sanitizedHtml, {
        nomeCliente,
        budgetId: budgetIdNormalizado || codigoOrcamentoImpressao,
        actionMessage:
          'Revise a tabela e utilize as ações da barra superior para imprimir ou baixar o PDF.',
        initialMode: 'preview',
        initialVariant: 'buyout',
        preOpenedWindow,
      })
    } catch (error) {
      preOpenedWindow?.close()
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
          const reprocessado = await renderPrintableProposalToHtml(dados, useBentoGridPdf)
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

    if (!validateTipoRedeLeasing('Selecione o tipo de rede para gerar os documentos.')) {
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

  const ucGeradoraTitularReferencia =
    leasingContrato.ucGeradoraTitular ?? leasingContrato.ucGeradoraTitularDraft ?? null
  const ucGeradoraTitularAtivo = Boolean(
    leasingContrato.ucGeradoraTitularDiferente && ucGeradoraTitularReferencia,
  )
  const titularUcGeradora = ucGeradoraTitularAtivo ? ucGeradoraTitularReferencia : null
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

    const corresponsavelEndereco = formatEnderecoCompleto(leasingContrato.corresponsavel?.endereco)
    const corresponsavelPayload = leasingContrato.corresponsavel
      ? {
          nome: leasingContrato.corresponsavel.nome.trim(),
          nacionalidade: leasingContrato.corresponsavel.nacionalidade.trim(),
          estadoCivil: leasingContrato.corresponsavel.estadoCivil.trim(),
          cpf: formatCpfCnpj(leasingContrato.corresponsavel.cpf),
          endereco: leasingContrato.corresponsavel.endereco,
          email: leasingContrato.corresponsavel.email.trim(),
          telefone: leasingContrato.corresponsavel.telefone.trim(),
        }
      : null

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
      prazoContratual: `${leasingPrazo * 12}`, // Prazo in months only (derived from authoritative leasingPrazo state)
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
      procuracaoUf: (procuracaoUf || cliente.uf || '').trim().toUpperCase(),
      ucGeradora_importarEnderecoCliente: leasingContrato.ucGeradora_importarEnderecoCliente,
      ucGeradoraEndereco: {
        cep: ucGeradoraTitularReferencia?.endereco.cep ?? '',
        logradouro: ucGeradoraTitularReferencia?.endereco.logradouro ?? '',
        cidade: ucGeradoraTitularReferencia?.endereco.cidade ?? '',
        uf: ucGeradoraTitularReferencia?.endereco.uf ?? '',
        distribuidora: leasingContrato.ucGeradoraTitularDistribuidoraAneel ?? '',
      },
      temCorresponsavelFinanceiro: leasingContrato.temCorresponsavelFinanceiro,
      corresponsavel: corresponsavelPayload,
      nomeCorresponsavel: corresponsavelPayload?.nome ?? '',
      nacionalidadeCorresponsavel: corresponsavelPayload?.nacionalidade ?? '',
      estadoCivilCorresponsavel: corresponsavelPayload?.estadoCivil ?? '',
      cpfCorresponsavel: corresponsavelPayload?.cpf ?? '',
      enderecoCorresponsavel: corresponsavelEndereco,
      emailCorresponsavel: corresponsavelPayload?.email ?? '',
      telefoneCorresponsavel: corresponsavelPayload?.telefone ?? '',
      ...procuracaoTags,
      // Valor atual de mercado (Preço Ideal da Análise Financeira) — preenche a tag {{valordemercado_atual}}
      // The formatted string is kept for direct pass-through; the raw number enables backend extenso generation
      // and DB-fallback resolution if this value is zero.
      valordemercado_atual: Number.isFinite(custoFinalProjetadoCanonico) && custoFinalProjetadoCanonico > 0
        ? `R$ ${formatNumberBRWithOptions(custoFinalProjetadoCanonico, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : (() => {
            console.warn('[contract][leasing] valordemercado_atual not available — backend will attempt DB fallback')
            return ''
          })(),
      // Raw numeric value for the backend to use when generating the extenso and for DB fallback
      valordemercado_atual_numero: Number.isFinite(custoFinalProjetadoCanonico) && custoFinalProjetadoCanonico > 0
        ? custoFinalProjetadoCanonico
        : 0,
    }

    // Server-side client ID for DB fallback lookup of valordemercado
    const serverClientId = clienteEmEdicaoId
      ? (clientServerIdMapRef.current[clienteEmEdicaoId] ?? clienteEmEdicaoId)
      : null

    return {
      tipoContrato: leasingContrato.tipoContrato,
      dadosLeasing,
      clientId: serverClientId,
    }
  }, [
    adicionarNotificacao,
    clienteEmEdicaoId,
    custoFinalProjetadoCanonico,
    kcKwhMes,
    leasingContrato,
    leasingPrazo,
    leasingAnexosSelecionados,
    potenciaInstaladaKwp,
    prepararDadosContratoCliente,
    tarifaCheia,
    ucsBeneficiarias,
    procuracaoUf,
    validateConsumoMinimoLeasing,
    validateTipoRedeLeasing,
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
        return ensureRequiredLeasingAnexos(filtrados, leasingContrato.tipoContrato, {
          corresponsavelAtivo,
        })
      })
    } catch (error) {
      console.error('Erro ao verificar disponibilidade dos anexos:', error)
      // Set all as available by default if check fails
      setLeasingAnexosAvailability({})
    } finally {
      setLeasingAnexosLoading(false)
    }
  }, [corresponsavelAtivo, leasingContrato.tipoContrato, cliente.uf])

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
    if (config?.autoInclude || (corresponsavelAtivo && anexoId === 'ANEXO_X')) {
      return
    }
    setLeasingAnexosSelecionados((prev) => {
      if (prev.includes(anexoId)) {
        return prev.filter((item) => item !== anexoId)
      }
      return [...prev, anexoId]
    })
  }, [corresponsavelAtivo])

  const handleSelectAllLeasingAnexos = useCallback(
    (selectAll: boolean) => {
    if (!selectAll) {
      setLeasingAnexosSelecionados(
        ensureRequiredLeasingAnexos([], leasingContrato.tipoContrato, { corresponsavelAtivo }),
      )
      return
    }
    const disponiveis = LEASING_ANEXOS_CONFIG.filter(
      (config) =>
        config.tipos.includes(leasingContrato.tipoContrato) &&
        !(config.autoInclude || (corresponsavelAtivo && config.id === 'ANEXO_X')) &&
        leasingAnexosAvailability[config.id] !== false,
    ).map((config) => config.id)
    setLeasingAnexosSelecionados(
      ensureRequiredLeasingAnexos(disponiveis, leasingContrato.tipoContrato, {
        corresponsavelAtivo,
      }),
    )
  },
    [corresponsavelAtivo, leasingContrato.tipoContrato, leasingAnexosAvailability],
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
            'error',
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
      console.info('[contract][leasing] skipped — already generating')
      return
    }
    if (!guardClientFieldsOrReturn('leasing')) {
      console.info('[contract][leasing] skipped — client fields validation failed')
      return
    }
    if (!validateConsumoMinimoLeasing('Informe o Consumo (kWh/mês) para gerar os documentos.')) {
      console.info('[contract][leasing] skipped — consumo mínimo validation failed')
      return
    }
    // Attempt to save client data to backend (best-effort).
    // Contract generation must NOT be blocked by a backend persistence failure —
    // the contract template only needs the in-memory client data, not a persisted
    // server record. When the client is later converted to the portfolio via
    // "Negócio fechado", any pending contracts will be linked automatically.
    const clienteSalvo = await handleSalvarCliente({ skipGuard: true, silent: true })
    if (!clienteSalvo) {
      console.warn('[contract][leasing] client save returned false — proceeding with in-memory data (pending-link mode)')
    }
    const base = prepararDadosContratoCliente()
    if (!base) {
      console.warn('[contract][leasing] skipped — prepararDadosContratoCliente returned null')
      return
    }
    setIsLeasingContractsModalOpen(true)
    // Load availability when modal opens
    void carregarDisponibilidadeAnexos()
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
      console.info('[contract][vendas] skipped — client fields validation failed')
      return
    }
    // Attempt to save client data to backend (best-effort).
    // Contract generation must NOT be blocked by a backend persistence failure —
    // the contract template only needs the in-memory client data, not a persisted
    // server record.
    const clienteSalvo = await handleSalvarCliente({ skipGuard: true, silent: true })
    if (!clienteSalvo) {
      console.warn('[contract][vendas] client save returned false — proceeding with in-memory data (pending-link mode)')
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
      adicionarNotificacao('Não foi possível abrir nova aba para o contrato. Verifique o bloqueio de pop-ups.', 'error')
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
            'error',
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
          'error',
        )
      }

      const anexosSelecionados = ensureRequiredLeasingAnexos(
        leasingAnexosSelecionados,
        leasingContrato.tipoContrato,
        { corresponsavelAtivo },
      )

      const response = await fetch(resolveApiUrl('/api/contracts/leasing'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoContrato: payload.tipoContrato,
          dadosLeasing: payload.dadosLeasing,
          clientId: payload.clientId ?? null,
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
    corresponsavelAtivo,
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

    if (!validatePropostaLeasingMinimal()) {
      return false
    }

    if (!(await ensureNormativePrecheck())) {
      return false
    }

    const confirmouAlertas = await confirmarAlertasAntesDeSalvar()
    if (!confirmouAlertas) {
      return false
    }

    await handleSalvarCliente({ skipGuard: true, silent: true })

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
        'Proposta de leasing salva localmente. Para persistência oficial, certifique-se de salvar via servidor.',
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
    handleSalvarCliente,
    isVendaDiretaTab,
    prepararPropostaParaExportacao,
    salvarOrcamentoLocalmente,
    salvandoPropostaLeasing,
    scheduleMarkStateAsSaved,
    setClientesSalvos,
    switchBudgetId,
    validatePropostaLeasingMinimal,
    vendaActions,
  ])

  const handleSalvarPropostaPdf = useCallback(async (): Promise<boolean> => {
    if (salvandoPropostaPdf) {
      return false
    }

    if (!validatePropostaLeasingMinimal()) {
      return false
    }

    if (!(await ensureNormativePrecheck())) {
      return false
    }

    console.info('[client-save] proceeding to proposal save', { proposalId: proposalServerIdMapRef.current })

    const clienteSalvoComSucesso = await handleSalvarCliente({ skipGuard: true, silent: true })
    if (!clienteSalvoComSucesso) {
      console.warn('[client-save] client mutation did not succeed — proposal will still be saved, but client data may not be updated in DB')
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
        const atualizado = await renderPrintableProposalToHtml(dados, useBentoGridPdf)
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
        const mensagemLocal = clienteSalvoComSucesso
          ? 'Cliente e proposta armazenados localmente. Configure a integração de PDF para gerar o arquivo automaticamente.'
          : 'Proposta armazenada localmente. Os dados do cliente não foram atualizados no servidor.'
        adicionarNotificacao(mensagemLocal, 'info')
        sucesso = true
      } else {
        await persistProposalPdf({
          html: htmlComCodigo,
          budgetId: registroSalvo.id,
          clientName: dados.cliente.nome,
          proposalType,
        })

        const mensagemSucesso = clienteSalvoComSucesso
          ? (salvouLocalmente
            ? 'Cliente e proposta salvos com sucesso. Uma cópia foi armazenada localmente.'
            : 'Cliente e proposta salvos com sucesso.')
          : (salvouLocalmente
            ? 'Proposta salva em PDF. Os dados do cliente não foram atualizados no servidor.'
            : 'Proposta salva em PDF. Os dados do cliente não foram atualizados no servidor.')
        adicionarNotificacao(mensagemSucesso, clienteSalvoComSucesso ? 'success' : 'info')
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
    handleSalvarCliente,
    isProposalPdfIntegrationAvailable,
    isVendaDiretaTab,
    prepararPropostaParaExportacao,
    salvarOrcamentoLocalmente,
    salvandoPropostaPdf,
    atualizarOrcamentoAtivo,
    setProposalPdfIntegrationAvailable,
    scheduleMarkStateAsSaved,
    setClientesSalvos,
    switchBudgetId,
    validatePropostaLeasingMinimal,
  ])

  // Pages where the proposal dirty-state guard applies.
  // Non-proposal pages (carteira, dashboard, settings, admin-users, simulacoes, crm)
  // have their own data models and must NOT trigger the proposal save prompt.
  const isProposalPage = activePage === 'app' || activePage === 'consultar' || activePage === 'clientes'

  const runWithUnsavedChangesGuard = useCallback(
    async (
      action: () => void | Promise<void>,
      options?: Partial<SaveDecisionPromptRequest>,
    ): Promise<boolean> => {
      // Only check proposal dirty state when the user is on a proposal-related page.
      // Non-proposal pages (carteira, dashboard, settings, etc.) must never show
      // proposal validation messages or save prompts.
      if (!isProposalPage || !hasUnsavedChanges()) {
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
    [handleSalvarPropostaPdf, hasUnsavedChanges, isProposalPage, requestSaveDecision, scheduleMarkStateAsSaved],
  )

  const handleGerarContratosComConfirmacao = useCallback(async () => {
    // ── Data-integrity gate ───────────────────────────────────────────────
    // Run the central readiness check before allowing contract generation.
    // UC beneficiárias are validated when entries exist.
    const ucBeneficiariasNums = ucsBeneficiarias.map((uc) => uc.numero)

    const readiness = validateClientReadinessForContract({
      cep: cliente.cep,
      document: cliente.documento,
      phone: cliente.telefone,
      email: cliente.email,
      ucGeradora: cliente.uc,
      ...(ucBeneficiariasNums.length > 0 ? { ucBeneficiarias: ucBeneficiariasNums } : {}),
    })

    if (!readiness.ok) {
      setClientReadinessErrors(readiness.issues)
      return
    }
    // ─────────────────────────────────────────────────────────────────────

    setActivePage('app')

    if (isVendaDiretaTab) {
      await handleGerarContratoVendas()
    } else {
      await handleGerarContratoLeasing()
    }
  }, [
    cliente.cep,
    cliente.documento,
    cliente.email,
    cliente.telefone,
    cliente.uc,
    handleGerarContratoLeasing,
    handleGerarContratoVendas,
    isVendaDiretaTab,
    setActivePage,
    ucsBeneficiarias,
  ])

  const abrirClientesPainel = useCallback(async () => {
    const skipPromptAfterSuccessfulClientSave = clientLastSaveStatus === 'success' || !clientIsDirty
    if (skipPromptAfterSuccessfulClientSave) {
      if (isAdmin || isOffice || isFinanceiro) {
        setActivePage('clientes')
        const registros = await carregarClientesPrioritarios({ silent: true })
        setClientesSalvos(registros)
        return true
      }

      const registros = carregarClientesSalvos()
      setClientesSalvos(registros)
      setActivePage('clientes')
      void Promise.all(registros.map((r) => hydrateClienteRegistroFromStore(r))).then((hidratados) => {
        setClientesSalvos(hidratados)
      })
      return true
    }

    const canProceed = await runWithUnsavedChangesGuard(async () => {
      // For privileged roles, fetch from the RBAC-aware REST API to show all
      // relevant users' clients. For comercial, use localStorage for speed.
      if (isAdmin || isOffice || isFinanceiro) {
        setActivePage('clientes')
        const registros = await carregarClientesPrioritarios({ silent: true })
        setClientesSalvos(registros)
        return
      }

      // Show localStorage data and navigate immediately — do NOT await IndexedDB
      // hydration here.  On Mobile Safari (and occasionally Brave) IndexedDB can
      // stall indefinitely, which previously caused setActivePage('clientes') to
      // never be called, making the button appear broken.
      const registros = carregarClientesSalvos()
      setClientesSalvos(registros)
      setActivePage('clientes')

      // Hydrate from IndexedDB in the background; each call already has a 3-second
      // timeout, so this can never block the UI.
      if (import.meta.env.DEV) console.debug('[abrirClientesPainel] Background hydration started for', registros.length, 'clientes')
      void Promise.all(registros.map((r) => hydrateClienteRegistroFromStore(r))).then(
        (hidratados) => {
          setClientesSalvos(hidratados)
          if (import.meta.env.DEV) console.debug('[abrirClientesPainel] Background hydration complete')
        },
      )
    })

    return canProceed
  }, [carregarClientesPrioritarios, carregarClientesSalvos, clientIsDirty, clientLastSaveStatus, isAdmin, isFinanceiro, isOffice, runWithUnsavedChangesGuard, setActivePage, hydrateClienteRegistroFromStore])

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
    (section?: SimulacoesSection) => {
      if (section === 'analise' && !canSeeFinancialAnalysisEffective) {
        return false
      }
      setSimulacoesSection(section ?? 'nova')
      setActivePage('simulacoes')
      return true
    },
    [setActivePage, canSeeFinancialAnalysisEffective],
  )

  const abrirConfiguracoes = useCallback(
    async (tab?: SettingsTabKey) => {
      if (!isAdmin) {
        return false
      }
      return runWithUnsavedChangesGuard(() => {
        setSettingsTab(tab ?? 'mercado')
        setActivePage('settings')
      })
    },
    [runWithUnsavedChangesGuard, setActivePage, setSettingsTab, isAdmin],
  )

  const abrirAdminUsuarios = useCallback(async () => {
    if (!canSeeUsersEffective) return false
    return abrirConfiguracoes('usuarios')
  }, [abrirConfiguracoes, canSeeUsersEffective])

  const abrirDashboard = useCallback(async () => {
    return runWithUnsavedChangesGuard(() => {
      setActivePage('dashboard')
    })
  }, [runWithUnsavedChangesGuard, setActivePage])

  const abrirCarteira = useCallback(async () => {
    if (!canSeePortfolioEffective) return false
    return runWithUnsavedChangesGuard(() => {
      setActivePage('carteira')
    })
  }, [runWithUnsavedChangesGuard, setActivePage, canSeePortfolioEffective])

  const abrirGestaoFinanceira = useCallback(async () => {
    if (!canSeeFinancialManagementEffective) return false
    return runWithUnsavedChangesGuard(() => {
      setActivePage('financial-management')
    })
  }, [runWithUnsavedChangesGuard, setActivePage, canSeeFinancialManagementEffective])

  const abrirDashboardOperacional = useCallback(async () => {
    if (!canSeeDashboardEffective) return false
    return runWithUnsavedChangesGuard(() => {
      setActivePage('operational-dashboard')
    })
  }, [runWithUnsavedChangesGuard, setActivePage, canSeeDashboardEffective])

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
    if (import.meta.env.DEV) console.debug('[Nova Proposta] Starting')
    isHydratingRef.current = true
    setIsHydrating(true)
    
    try {
      // Clear form draft to prevent stale data
      try {
        await clearFormDraft() // Use clearFormDraft instead of saveFormDraft(null)
        if (import.meta.env.DEV) console.debug('[Nova Proposta] Form draft cleared')
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
      setTusdTipoCliente(normalizeTusdTipoClienteValue(INITIAL_VALUES.tusdTipoCliente))
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
      setTipoRede(INITIAL_VALUES.tipoRede ?? 'nenhum')
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
      setUseBentoGridPdf(INITIAL_VALUES.useBentoGridPdf)

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
      if (import.meta.env.DEV) console.debug('[Nova Proposta] New budget ID created', novoBudgetId)

      budgetIdTransitionRef.current = true
      budgetIdRef.current = novoBudgetId
      setCurrentBudgetId(novoBudgetId)

      await Promise.resolve()
      await tick()

      const snapshotVazio = buildEmptySnapshotForNewProposal(activeTabRef.current, novoBudgetId)
      aplicarSnapshot(snapshotVazio, { budgetIdOverride: novoBudgetId, allowEmpty: true })

      // Re-apply the logged-in user's consultant as default — the snapshot reset clears
      // consultorId to '' (from CLIENTE_INICIAL).  myConsultorDefaultRef was populated
      // when the user's consultant was resolved in fetchConsultantsForPicker (Issue 2).
      // Use setClienteSync with the current ref value to avoid depending on the
      // unstable updateClienteSync (which re-creates on every cliente change).
      if (myConsultorDefaultRef.current && clienteRef.current) {
        setClienteSync({
          ...clienteRef.current,
          consultorId: myConsultorDefaultRef.current.id,
          consultorNome: myConsultorDefaultRef.current.nome,
        })
      }

      scheduleMarkStateAsSaved()
      
      if (import.meta.env.DEV) console.debug('[Nova Proposta] Reset complete')
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
    setClientesSalvos,
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

      void iniciarNovaProposta()
      return
    }

    void iniciarNovaProposta()
  }, [
    hasUnsavedChanges,
    handleSalvarPropostaPdf,
    iniciarNovaProposta,
    requestSaveDecision,
  ])

  /**
   * Navega para uma aba de proposta (Leasing ou Vendas) com reset completo do estado.
   *
   * Implementa A.1 do padrão de controle de estado:
   * - Sempre inicia a página com valores default.
   * - Exibe guarda de alterações não salvas antes de resetar.
   */
  const handleNavigateToProposalTab = useCallback(
    async (targetTab: 'leasing' | 'vendas') => {
      await runWithUnsavedChangesGuard(async () => {
        // Atualiza a ref ANTES de iniciarNovaProposta para que buildEmptySnapshotForNewProposal
        // (linha 17646 aprox.) use a aba correta ao construir o snapshot vazio inicial.
        // Se não atualizarmos aqui, o snapshot seria gerado para a aba anterior e
        // snapshot.activeTab ficaria inconsistente com a aba que o usuário selecionou.
        activeTabRef.current = targetTab
        await iniciarNovaProposta()
        setActiveTab(targetTab)
      })
    },
    [runWithUnsavedChangesGuard, iniciarNovaProposta, setActiveTab],
  )

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

  // role_financeiro is read-only: no save, no delete actions allowed in the UI.
  // The backend enforces this regardless, but hiding the buttons improves UX.
  // Explicitly exclude isOffice — users with both office+financeiro should have write access
  // because office grants write permissions and takes precedence over financeiro.
  const isProposalReadOnly = isFinanceiro && !isAdmin && !isOffice
  const podeSalvarProposta = (activeTab === 'leasing' || activeTab === 'vendas') && !isProposalReadOnly

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

  const updateCorresponsavelDraft = useCallback(
    (partial: Partial<LeasingCorresponsavel>) => {
      setCorresponsavelDraft((prev) => ({
        ...prev,
        ...partial,
        endereco: partial.endereco
          ? resolveCorresponsavelEndereco(partial.endereco)
          : prev.endereco,
      }))
    },
    [],
  )

  const updateCorresponsavelEndereco = useCallback(
    (partial: Partial<LeasingEndereco>) => {
      setCorresponsavelDraft((prev) => ({
        ...prev,
        endereco: {
          ...resolveCorresponsavelEndereco(prev.endereco),
          ...partial,
        },
      }))
    },
    [],
  )

  const buildCorresponsavelErrors = useCallback((draft: LeasingCorresponsavel) => {
    const errors: CorresponsavelErrors = {}
    if (!draft.nome.trim()) {
      errors.nome = 'Informe o nome completo.'
    }
    const cpfDigits = draft.cpf.replace(/\D/g, '')
    if (!cpfDigits) {
      errors.cpf = 'Informe o CPF.'
    } else if (cpfDigits.length !== 11) {
      errors.cpf = 'CPF deve conter 11 dígitos.'
    }
    const telefoneDigits = draft.telefone.replace(/\D/g, '')
    if (!telefoneDigits) {
      errors.telefone = 'Informe o telefone.'
    } else if (telefoneDigits.length < 10) {
      errors.telefone = 'Telefone deve conter ao menos 10 dígitos.'
    }
    const email = draft.email.trim()
    if (email && !email.includes('@')) {
      errors.email = 'Informe um e-mail válido.'
    }
    const endereco = resolveCorresponsavelEndereco(draft.endereco)
    if (!endereco.cidade.trim() && !endereco.uf.trim() && !endereco.logradouro.trim()) {
      errors.endereco = 'Informe ao menos cidade/UF ou endereço.'
    }
    return errors
  }, [])

  const handleImportEnderecoClienteParaUcGeradora = useCallback(
    (checked: boolean) => {
      leasingActions.updateContrato({ ucGeradora_importarEnderecoCliente: checked })
      if (!checked) {
        return
      }
      if (!leasingContrato.ucGeradoraTitularDraft) {
        const baseDraft = leasingContrato.ucGeradoraTitular
          ? cloneUcGeradoraTitular(leasingContrato.ucGeradoraTitular)
          : createEmptyUcGeradoraTitular()
        leasingActions.updateContrato({
          ucGeradoraTitularDiferente: true,
          ucGeradoraTitularDraft: baseDraft,
        })
        setUcGeradoraTitularPanelOpen(true)
      }
      leasingActions.importEnderecoClienteParaUcGeradora({
        cep: cliente.cep?.trim(),
        logradouro: cliente.endereco?.trim(),
        cidade: cliente.cidade?.trim(),
        uf: cliente.uf?.trim(),
        distribuidora: cliente.distribuidora?.trim(),
      })
    },
    [
      cliente.cidade,
      cliente.cep,
      cliente.distribuidora,
      cliente.endereco,
      cliente.uf,
      leasingContrato.ucGeradoraTitular,
      leasingContrato.ucGeradoraTitularDraft,
      setUcGeradoraTitularPanelOpen,
    ],
  )

  const handleAbrirCorresponsavelModal = useCallback(() => {
    setCorresponsavelDraft(buildCorresponsavelDraft(leasingContrato.corresponsavel))
    setCorresponsavelErrors({})
    setIsCorresponsavelModalOpen(true)
  }, [leasingContrato.corresponsavel])

  const handleFecharCorresponsavelModal = useCallback(() => {
    setIsCorresponsavelModalOpen(false)
    setCorresponsavelErrors({})
  }, [])

  const handleSalvarCorresponsavel = useCallback(() => {
    const errors = buildCorresponsavelErrors(corresponsavelDraft)
    if (Object.keys(errors).length > 0) {
      setCorresponsavelErrors(errors)
      return
    }
    const endereco = resolveCorresponsavelEndereco(corresponsavelDraft.endereco)
    const normalized: LeasingCorresponsavel = {
      nome: corresponsavelDraft.nome.trim(),
      nacionalidade: corresponsavelDraft.nacionalidade.trim(),
      estadoCivil: corresponsavelDraft.estadoCivil.trim(),
      cpf: formatCpfCnpj(corresponsavelDraft.cpf),
      endereco: {
        ...endereco,
        logradouro: endereco.logradouro.trim(),
        numero: endereco.numero.trim(),
        complemento: endereco.complemento.trim(),
        bairro: endereco.bairro.trim(),
        cidade: endereco.cidade.trim(),
        uf: endereco.uf.trim(),
        cep: endereco.cep.trim(),
      },
      email: corresponsavelDraft.email.trim(),
      telefone: corresponsavelDraft.telefone.trim(),
    }
    leasingActions.updateContrato({
      temCorresponsavelFinanceiro: true,
      corresponsavel: normalized,
    })
    setIsCorresponsavelModalOpen(false)
    setCorresponsavelErrors({})
  }, [buildCorresponsavelErrors, corresponsavelDraft])

  const handleDesativarCorresponsavel = useCallback(() => {
    leasingActions.updateContrato({
      temCorresponsavelFinanceiro: false,
    })
    setIsCorresponsavelModalOpen(false)
    setCorresponsavelErrors({})
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
        ucGeradora_importarEnderecoCliente: false,
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
    if (import.meta.env.DEV) {
      console.debug('[CEP effect] run', {
        cep: cepNumeros,
        hydrating: isHydratingRef.current,
        editingEndereco: isEditingEnderecoRef.current,
        last: lastCepAppliedRef.current,
      })
    }

    if (isHydratingRef.current || isApplyingCepRef.current || isEditingEnderecoRef.current) {
      return
    }

    if (cepNumeros.length !== 8) {
      setBuscandoCep(false)
      setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cep: undefined }))
      setCidadeBloqueadaPorCep(false)
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
        const data = await lookupCep(cepNumeros, controller.signal)
        if (!ativo) {
          return
        }

        if (!data) {
          setClienteMensagens((prev) => ({ ...prev, cep: 'CEP não encontrado.' }))
          setCidadeBloqueadaPorCep(false)
          return
        }

        const logradouro = data?.logradouro?.trim() ?? ''
        const localidade = data?.cidade?.trim() ?? ''
        const uf = data?.uf?.trim().toUpperCase() ?? ''

        const base = clienteRef.current ?? cliente
        const enderecoAtual = base.endereco?.trim() ?? ''
        const patch: Partial<ClienteDados> = {}
        const cidadesDaUf = uf ? await ensureIbgeMunicipios(uf, controller.signal) : []
        const cidadeNormalizada = normalizeText(localidade)
        const cidadeEncontrada = cidadesDaUf.find(
          (cidade) => normalizeText(cidade) === cidadeNormalizada,
        )
        let avisoCidade: string | undefined

        if (uf && uf !== base.uf) {
          patch.uf = uf
        }

        if (localidade && uf) {
          if (cidadeEncontrada) {
            if (cidadeEncontrada !== base.cidade) {
              patch.cidade = cidadeEncontrada
            }
            setCidadeBloqueadaPorCep(true)
          } else {
            avisoCidade = 'Cidade do CEP não encontrada na base do IBGE. Informe manualmente.'
            setCidadeBloqueadaPorCep(false)
            if (localidade !== base.cidade) {
              patch.cidade = localidade
            }
          }
        } else {
          setCidadeBloqueadaPorCep(false)
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
        cepCidadeAvisoRef.current = avisoCidade ? base.cidade?.trim() ?? '' : null
        setClienteMensagens((prev): ClienteMensagens => ({
          ...prev,
          cep: undefined,
          cidade: avisoCidade,
        }))
      } catch (_error) {
        if (!ativo || controller.signal.aborted) {
          return
        }

        setClienteMensagens((prev) => ({
          ...prev,
          cep: 'Não foi possível consultar o CEP.',
        }))
        setCidadeBloqueadaPorCep(false)
      } finally {
        if (ativo) {
          setBuscandoCep(false)
        }
        isApplyingCepRef.current = false
      }
    }

    const timeoutId = window.setTimeout(() => {
      void consultarCep()
    }, 500)

    return () => {
      ativo = false
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [cliente.cep, distribuidorasPorUf, ensureIbgeMunicipios])

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
      setUcGeradoraCidadeBloqueadaPorCep(false)
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
        const data = await lookupCep(cepNumeros, controller.signal)
        if (!ativo) {
          return
        }

        if (!data) {
          setUcGeradoraTitularCepMessage('CEP não encontrado.')
          setUcGeradoraCidadeBloqueadaPorCep(false)
          return
        }

        const logradouro = data?.logradouro?.trim() ?? ''
        const localidade = data?.cidade?.trim() ?? ''
        const uf = data?.uf?.trim().toUpperCase() ?? ''
        const cidadesDaUf = uf ? await ensureIbgeMunicipios(uf, controller.signal) : []
        const cidadeNormalizada = normalizeText(localidade)
        const cidadeEncontrada = cidadesDaUf.find(
          (cidade) => normalizeText(cidade) === cidadeNormalizada,
        )
        let avisoCidade: string | undefined

        const patchEndereco: Partial<LeasingEndereco> = {}
        if (logradouro && !draft.endereco.logradouro.trim()) {
          patchEndereco.logradouro = logradouro
        }
        if (localidade) {
          if (cidadeEncontrada) {
            if (cidadeEncontrada !== draft.endereco.cidade) {
              patchEndereco.cidade = cidadeEncontrada
            }
            setUcGeradoraCidadeBloqueadaPorCep(true)
          } else {
            avisoCidade = 'Cidade do CEP não encontrada na base do IBGE. Informe manualmente.'
            setUcGeradoraCidadeBloqueadaPorCep(false)
            if (localidade !== draft.endereco.cidade) {
              patchEndereco.cidade = localidade
            }
          }
        } else {
          setUcGeradoraCidadeBloqueadaPorCep(false)
        }
        if (uf && uf !== draft.endereco.uf) {
          patchEndereco.uf = uf
        }
        if (Object.keys(patchEndereco).length > 0) {
          updateUcGeradoraTitularDraft({ endereco: patchEndereco })
        }

        lastUcGeradoraCepAppliedRef.current = cepNumeros
        setUcGeradoraTitularCepMessage(avisoCidade)
      } catch (_error) {
        if (!ativo || controller.signal.aborted) {
          return
        }

        setUcGeradoraTitularCepMessage('Não foi possível consultar o CEP.')
        setUcGeradoraCidadeBloqueadaPorCep(false)
      } finally {
        if (ativo) {
          setUcGeradoraTitularBuscandoCep(false)
        }
        isApplyingUcGeradoraCepRef.current = false
      }
    }

    void consultarCep()

    return () => {
      ativo = false
      controller.abort()
    }
  }, [ensureIbgeMunicipios, leasingContrato.ucGeradoraTitularDraft, updateUcGeradoraTitularDraft])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nomeCidade = cliente.cidade.trim()
    const ufSelecionada = cliente.uf.trim().toUpperCase()

    if (cepCidadeAvisoRef.current !== null) {
      if (nomeCidade === cepCidadeAvisoRef.current) {
        setVerificandoCidade(false)
        return
      }
      cepCidadeAvisoRef.current = null
    }

    if (nomeCidade.length < 3) {
      setVerificandoCidade(false)
      setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cidade: undefined }))
      return
    }

    let ativo = true
    const controller = new AbortController()
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data: IbgeMunicipio[] = await response.json()

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
      } catch (_error) {
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
      // Open the preview window synchronously before any await (required for Safari popup policy).
      const preOpenedWindow = window.open('', '_blank', 'width=1024,height=768')
      try {
        const dadosParaImpressao: PrintableProposalProps = {
          ...registro.dados,
          budgetId: ensureProposalId(registro.dados.budgetId ?? registro.id),
          tipoProposta:
            registro.dados.tipoProposta === 'VENDA_DIRETA' ? 'VENDA_DIRETA' : 'LEASING',
        }
        const layoutHtml = await renderPrintableProposalToHtml(dadosParaImpressao, useBentoGridPdf)
        const sanitizedLayoutHtml = sanitizePrintableHtml(layoutHtml)

        if (!sanitizedLayoutHtml) {
          preOpenedWindow?.close()
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
          preOpenedWindow,
        })
      } catch (error) {
        preOpenedWindow?.close()
        console.error('Erro ao abrir orçamento salvo.', error)
        window.alert('Não foi possível abrir o orçamento selecionado. Tente novamente.')
      }
    },
    [openBudgetPreviewWindow, useBentoGridPdf],
  )

  const confirmarRemocaoOrcamento = useCallback(
    async (registro: OrcamentoSalvo) => {
      if (typeof window === 'undefined') {
        return
      }

      const nomeCliente = registro.clienteNome || registro.dados.cliente.nome || 'este cliente'
      const confirmado = await requestConfirmDialog({
        title: 'Excluir orçamento',
        description: `Deseja realmente excluir o orçamento ${registro.id} de ${nomeCliente}? Essa ação não poderá ser desfeita.`,
        confirmLabel: 'Excluir',
        cancelLabel: 'Cancelar',
      })

      if (!confirmado) {
        return
      }

      await removerOrcamentoSalvo(registro.id)
    },
    [removerOrcamentoSalvo, requestConfirmDialog],
  )

  const carregarOrcamentoSalvo = useCallback(
    async (registroInicial: OrcamentoSalvo) => {
      let registro = registroInicial

      if (!registro.snapshot) {
        void carregarOrcamentoParaEdicao(registro)
        return
      }

      const assinaturaAtual = computeSignatureRef.current()
      const assinaturaRegistro = computeSnapshotSignature(registro.snapshot, registro.dados)

      if (assinaturaRegistro === assinaturaAtual) {
        void carregarOrcamentoParaEdicao(registro, {
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

      void carregarOrcamentoParaEdicao(registro)
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

  const voltarParaPaginaPrincipal = useCallback(() => {
    setActivePage(lastPrimaryPageRef.current)
  }, [setActivePage])

  const fecharPesquisaOrcamentos = () => {
    voltarParaPaginaPrincipal()
  }

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

  const handleTipoInstalacaoChange = (value: TipoInstalacao) => {
    setTipoInstalacaoDirty(true)
    setTipoInstalacao(value)
    if (value !== 'outros') {
      setTipoInstalacaoOutro('')
    }
  }

  // renderConfiguracaoUsinaSection extracted to LeasingConfiguracaoUsinaSection component

  // renderVendaParametrosSection extracted to VendaParametrosSection component


  // renderVendaResumoPublicoSection extracted to VendaResumoPublicoSection component


  const condicoesPagamentoSection = (
    <CondicoesPagamentoSection
      vendaForm={vendaForm}
      vendaFormErrors={vendaFormErrors}
      capexMoneyField={capexMoneyField}
      isVendaDiretaTab={isVendaDiretaTab}
      valorTotalPropostaNormalizado={valorTotalPropostaNormalizado}
      onCondicaoPagamentoChange={handleCondicaoPagamentoChange}
      onVendaUpdate={applyVendaUpdates}
    />
  )


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
          onClick={() => { void handleImprimirTabelaTransferencia() }}
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
    <React.Suspense fallback={null}>
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
    </React.Suspense>
  ) : null

  const contentActions = activePage === 'crm'
    ? <CrmPageActions {...crmState} onVoltar={() => setActivePage('app')} />
    : null
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

  const crmItems = [
    ...(canSeeProposalsEffective
      ? [
          {
            id: 'crm-central',
            label: 'Central CRM',
            icon: '📇',
            onSelect: () => {
              void abrirCrmCentral()
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
        ]
      : []),
    ...(canSeeClientsEffective
      ? [
          {
            id: 'crm-clientes',
            label: 'Clientes salvos',
            icon: '👥',
            onSelect: () => {
              void abrirClientesPainel()
            },
          },
        ]
      : []),
  ]

  const sidebarGroups = buildSidebarGroups({
    canSeeDashboardEffective,
    canSeePortfolioEffective,
    canSeeFinancialManagementEffective,
    canSeeProposalsEffective,
    canSeeContractsEffective,
    canSeeClientsEffective,
    canSeeFinancialAnalysisEffective,
    isAdmin,
    abrirDashboard,
    abrirCarteira,
    abrirGestaoFinanceira,
    abrirDashboardOperacional,
    handleNavigateToProposalTab,
    abrirSimulacoes,
    handleGerarContratosComConfirmacao,
    abrirEnvioPropostaModal,
    abrirPesquisaOrcamentos,
    setActivePage,
    crmItems,
    gerandoContratos,
    contatosEnvio,
  })

  const {
    shellTopbarSubtitle,
    mobileTopbarSubtitle,
    shellContentSubtitle,
    shellPageIndicator,
    mobileAllowedIds,
    allSidebarItems,
    mobileSidebarGroups,
    desktopSimpleSidebarGroups,
    activeSidebarItem,
    menuButtonLabel,
    menuButtonExpanded,
    handleSidebarMenuToggle,
    handleSidebarNavigate,
    handleSidebarClose,
  } = useShellLayout({
    activePage,
    activeTab,
    simulacoesSection,
    isMobileViewport,
    isSidebarMobileOpen,
    isSidebarCollapsed,
    isDesktopSimpleEnabled,
    contentSubtitle,
    currentPageIndicator,
    sidebarGroups,
    canSeeProposalsEffective,
    canSeeContractsEffective,
    canSeeClientsEffective,
    canSeePortfolioEffective,
    canSeeFinancialAnalysisEffective,
    canSeeFinancialManagementEffective,
    setIsSidebarCollapsed,
    setIsSidebarMobileOpen,
  })


  // renderSimulacoesPage extracted to SimulacoesPage component (Subfase 2B-final)


  // If in print mode, render the Bento Grid print page
  if (isPrintMode) {
    return (
      <React.Suspense fallback={<div style={{ padding: '20px' }}>Carregando proposta...</div>}>
        <PrintPageLeasing data={printableData} />
      </React.Suspense>
    )
  }

  return (
    <>
      <AppRoutes>
        <AppShell
          topbar={{
            subtitle: shellTopbarSubtitle,
            mobileSubtitle: mobileTopbarSubtitle,
          }}
          sidebar={{
            collapsed: isSidebarCollapsed,
            mobileOpen: isSidebarMobileOpen,
            groups: mobileSidebarGroups,
            activeItemId: activeSidebarItem,
            onNavigate: handleSidebarNavigate,
            onCloseMobile: handleSidebarClose,
            onToggleCollapse: isMobileViewport ? undefined : handleSidebarMenuToggle,
            menuButtonLabel,
            menuButtonExpanded,
            menuButtonText: 'Painel SolarInvest',
            userInfo: user?.displayName
              ? { name: user.displayName, role: userRole }
              : undefined,
          }}
          content={{
            subtitle: shellContentSubtitle,
            actions: contentActions ?? undefined,
            pageIndicator: shellPageIndicator,
            className: activePage === 'app' ? 'content-wrap--proposal' : undefined,
          }}
          mobileMenuButton={
            isMobileViewport
              ? {
                  onToggle: handleSidebarMenuToggle,
                  label: isSidebarMobileOpen
                    ? 'Fechar menu Painel SolarInvest'
                    : 'Abrir menu Painel SolarInvest',
                  expanded: isSidebarMobileOpen,
                  userInfo: user?.displayName
                    ? { name: user.displayName, role: userRole }
                    : undefined,
                }
              : undefined
          }
          theme={appTheme}
          onCycleTheme={cycleAppTheme}
          onOpenPreferences={isAdmin ? () => { void abrirConfiguracoes() } : undefined}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        >
        <div className="printable-proposal-hidden" aria-hidden="true">
          <React.Suspense fallback={null}>
            <PrintableProposal ref={printableRef} {...printableData} />
          </React.Suspense>
        </div>
        {activePage === 'dashboard' ? (
          <DashboardPage />
        ) : activePage === 'crm' ? (
          <CrmPage {...crmState} />
        ) : activePage === 'consultar' ? (
          <BudgetSearchPage
            registros={orcamentosSalvos}
            isPrivilegedUser={isAdmin || isOffice || isFinanceiro}
            isProposalReadOnly={isProposalReadOnly}
            onClose={fecharPesquisaOrcamentos}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onCarregarOrcamento={carregarOrcamentoSalvo}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onAbrirOrcamento={abrirOrcamentoSalvo}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onConfirmarRemocao={confirmarRemocaoOrcamento}
          />
        ) : activePage === 'clientes' ? (
          <ClientesPage
            registros={clientesSalvos}
            onClose={fecharClientesPainel}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onEditar={handleEditarCliente}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onExcluir={handleExcluirCliente}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onExportarCarteira={handleExportarParaCarteira}
            onExportarCsv={handleExportarClientesCsv}
            onExportarJson={handleExportarClientesJson}
            onImportar={handleClientesImportarClick}
            onBackupCliente={handleBackupBancoDados}
            isImportando={isImportandoClientes}
            isGerandoBackupBanco={isGerandoBackupBanco}
            canBackupBanco={isAdmin || isOffice}
            isPrivilegedUser={isAdmin || isOffice || isFinanceiro}
            canExportarCarteira={isAdmin || isOffice}
            allConsultores={allConsultores}
            formConsultores={formConsultores}
          />
        ) : activePage === 'simulacoes' ? (
          <SimulacoesPage
            simulacoesSection={simulacoesSection}
            isMobileViewport={isMobileViewport}
            isMobileSimpleEnabled={isMobileSimpleEnabled}
            isSimulacoesWorkspaceActive={isSimulacoesWorkspaceActive}
            onAbrirSimulacoes={abrirSimulacoes}
            capexSolarInvest={capexSolarInvest}
            tipoSistema={tipoSistema}
            leasingPrazo={leasingPrazo}
            aprovacaoStatus={aprovacaoStatus}
            ultimaDecisaoTimestamp={ultimaDecisaoTimestamp}
            registrarDecisaoInterna={registrarDecisaoInterna}
            kcKwhMes={kcKwhMes}
            afModo={afModo}
            setAfModo={setAfModo}
            afConsumoOverride={afConsumoOverride}
            setAfConsumoOverride={setAfConsumoOverride}
            afNumModulosOverride={afNumModulosOverride}
            setAfNumModulosOverride={setAfNumModulosOverride}
            afModuloWpOverride={afModuloWpOverride}
            setAfModuloWpOverride={setAfModuloWpOverride}
            afIrradiacaoOverride={afIrradiacaoOverride}
            setAfIrradiacaoOverride={setAfIrradiacaoOverride}
            afPROverride={afPROverride}
            setAfPROverride={setAfPROverride}
            afDiasOverride={afDiasOverride}
            setAfDiasOverride={setAfDiasOverride}
            potenciaModulo={potenciaModulo}
            baseIrradiacao={baseIrradiacao}
            eficienciaNormalizada={eficienciaNormalizada}
            diasMesNormalizado={diasMesNormalizado}
            afCustoKitField={afCustoKitField}
            afValorContratoField={afValorContratoField}
            afFreteField={afFreteField}
            afDescarregamentoField={afDescarregamentoField}
            afMaterialCAField={afMaterialCAField}
            afPlacaField={afPlacaField}
            afProjetoField={afProjetoField}
            afCreaField={afCreaField}
            afHotelPousadaField={afHotelPousadaField}
            afTransporteCombustivelField={afTransporteCombustivelField}
            afOutrosField={afOutrosField}
            afMensalidadeBaseField={afMensalidadeBaseField}
            afAutoMaterialCA={afAutoMaterialCA}
            setAfAutoMaterialCA={setAfAutoMaterialCA}
            afMaterialCAOverride={afMaterialCAOverride}
            setAfMaterialCAOverride={setAfMaterialCAOverride}
            afProjetoOverride={afProjetoOverride}
            setAfProjetoOverride={setAfProjetoOverride}
            afCreaOverride={afCreaOverride}
            setAfCreaOverride={setAfCreaOverride}
            afCustoKit={afCustoKit}
            setAfCustoKit={setAfCustoKit}
            setAfCustoKitManual={setAfCustoKitManual}
            afFrete={afFrete}
            setAfFrete={setAfFrete}
            setAfFreteManual={setAfFreteManual}
            afDescarregamento={afDescarregamento}
            setAfDescarregamento={setAfDescarregamento}
            afHotelPousada={afHotelPousada}
            setAfHotelPousada={setAfHotelPousada}
            afTransporteCombustivel={afTransporteCombustivel}
            setAfTransporteCombustivel={setAfTransporteCombustivel}
            afOutros={afOutros}
            setAfOutros={setAfOutros}
            afValorContrato={afValorContrato}
            setAfValorContrato={setAfValorContrato}
            afPlaca={afPlaca}
            setAfPlaca={setAfPlaca}
            afMensalidadeBase={afMensalidadeBase}
            setAfMensalidadeBase={setAfMensalidadeBase}
            afMensalidadeBaseAuto={afMensalidadeBaseAuto}
            afImpostosVenda={afImpostosVenda}
            setAfImpostosVenda={setAfImpostosVenda}
            afImpostosLeasing={afImpostosLeasing}
            setAfImpostosLeasing={setAfImpostosLeasing}
            afMargemLiquidaVenda={afMargemLiquidaVenda}
            setAfMargemLiquidaVenda={setAfMargemLiquidaVenda}
            afMargemLiquidaMinima={afMargemLiquidaMinima}
            setAfMargemLiquidaMinima={setAfMargemLiquidaMinima}
            afComissaoMinimaPercent={afComissaoMinimaPercent}
            setAfComissaoMinimaPercent={setAfComissaoMinimaPercent}
            afTaxaDesconto={afTaxaDesconto}
            setAfTaxaDesconto={setAfTaxaDesconto}
            afInadimplencia={afInadimplencia}
            setAfInadimplencia={setAfInadimplencia}
            afCustoOperacional={afCustoOperacional}
            setAfCustoOperacional={setAfCustoOperacional}
            afMesesProjecao={afMesesProjecao}
            setAfMesesProjecao={setAfMesesProjecao}
            afCidadeDestino={afCidadeDestino}
            setAfCidadeDestino={setAfCidadeDestino}
            afCidadeSuggestions={afCidadeSuggestions}
            setAfCidadeSuggestions={setAfCidadeSuggestions}
            afCidadeShowSuggestions={afCidadeShowSuggestions}
            setAfCidadeShowSuggestions={setAfCidadeShowSuggestions}
            afDeslocamentoStatus={afDeslocamentoStatus}
            setAfDeslocamentoStatus={setAfDeslocamentoStatus}
            afDeslocamentoCidadeLabel={afDeslocamentoCidadeLabel}
            setAfDeslocamentoCidadeLabel={setAfDeslocamentoCidadeLabel}
            afDeslocamentoKm={afDeslocamentoKm}
            setAfDeslocamentoKm={setAfDeslocamentoKm}
            afDeslocamentoRs={afDeslocamentoRs}
            setAfDeslocamentoRs={setAfDeslocamentoRs}
            afDeslocamentoErro={afDeslocamentoErro}
            setAfDeslocamentoErro={setAfDeslocamentoErro}
            afCidadeBlurTimerRef={afCidadeBlurTimerRef}
            handleSelectCidade={handleSelectCidade}
            analiseFinanceiraResult={analiseFinanceiraResult}
            indicadorEficienciaProjeto={indicadorEficienciaProjeto}
            vendasConfig={vendasConfig}
            aprovacaoChecklist={aprovacaoChecklist}
            toggleAprovacaoChecklist={toggleAprovacaoChecklist}
            afBaseInitializedRef={afBaseInitializedRef}
            selectNumberInputOnFocus={selectNumberInputOnFocus}
          />
        ) : activePage === 'settings' ? (
          <SettingsPage
            settingsTab={settingsTab}
            setSettingsTab={setSettingsTab}
            voltarParaPaginaPrincipal={voltarParaPaginaPrincipal}
            canSeeUsersEffective={canSeeUsersEffective}
            inflacaoAa={inflacaoAa}
            setInflacaoAa={setInflacaoAa}
            precoPorKwp={precoPorKwp}
            setPrecoPorKwp={setPrecoPorKwp}
            irradiacao={irradiacao}
            eficiencia={eficiencia}
            setEficiencia={setEficiencia}
            handleEficienciaInput={handleEficienciaInput}
            diasMes={diasMes}
            setDiasMes={setDiasMes}
            vendasConfig={vendasConfig}
            tipoInstalacao={tipoInstalacao}
            composicaoTelhadoCalculo={composicaoTelhadoCalculo}
            composicaoSoloCalculo={composicaoSoloCalculo}
            composicaoTelhado={composicaoTelhado}
            composicaoSolo={composicaoSolo}
            descontosValor={descontosValor}
            aprovadoresResumo={aprovadoresResumo}
            capexBaseResumoSettingsField={capexBaseResumoSettingsField}
            capexBaseResumoValor={capexBaseResumoValor}
            capexBaseManualValor={capexBaseManualValor}
            margemOperacionalResumoSettingsField={margemOperacionalResumoSettingsField}
            margemManualAtiva={margemManualAtiva}
            impostosOverridesDraft={impostosOverridesDraft}
            aprovadoresText={aprovadoresText}
            custoImplantacaoReferencia={custoImplantacaoReferencia}
            updateVendasConfig={updateVendasConfig}
            onUpdateResumoProposta={(data) => vendaActions.updateResumoProposta(data)}
            onComposicaoTelhadoChange={handleComposicaoTelhadoChange}
            onComposicaoSoloChange={handleComposicaoSoloChange}
            setImpostosOverridesDraft={setImpostosOverridesDraft}
            setAprovadoresText={setAprovadoresText}
            prazoMeses={prazoMeses}
            setPrazoMeses={setPrazoMeses}
            bandeiraEncargo={bandeiraEncargo}
            setBandeiraEncargo={setBandeiraEncargo}
            cipEncargo={cipEncargo}
            setCipEncargo={setCipEncargo}
            entradaModo={entradaModo}
            setEntradaModo={setEntradaModo}
            parcelasSolarInvest={parcelasSolarInvest}
            mostrarTabelaParcelasConfig={mostrarTabelaParcelasConfig}
            setMostrarTabelaParcelasConfig={setMostrarTabelaParcelasConfig}
            jurosFinAa={jurosFinAa}
            setJurosFinAa={setJurosFinAa}
            prazoFinMeses={prazoFinMeses}
            setPrazoFinMeses={setPrazoFinMeses}
            entradaFinPct={entradaFinPct}
            setEntradaFinPct={setEntradaFinPct}
            cashbackPct={cashbackPct}
            setCashbackPct={setCashbackPct}
            depreciacaoAa={depreciacaoAa}
            setDepreciacaoAa={setDepreciacaoAa}
            inadimplenciaAa={inadimplenciaAa}
            setInadimplenciaAa={setInadimplenciaAa}
            tributosAa={tributosAa}
            setTributosAa={setTributosAa}
            ipcaAa={ipcaAa}
            setIpcaAa={setIpcaAa}
            custosFixosM={custosFixosM}
            setCustosFixosM={setCustosFixosM}
            opexM={opexM}
            setOpexM={setOpexM}
            seguroM={seguroM}
            setSeguroM={setSeguroM}
            duracaoMeses={duracaoMeses}
            setDuracaoMeses={setDuracaoMeses}
            pagosAcumAteM={pagosAcumAteM}
            setPagosAcumAteM={setPagosAcumAteM}
            mostrarTabelaBuyoutConfig={mostrarTabelaBuyoutConfig}
            setMostrarTabelaBuyoutConfig={setMostrarTabelaBuyoutConfig}
            buyoutReceitaRows={buyoutReceitaRows}
            buyoutAceiteFinal={buyoutAceiteFinal}
            buyoutMesAceiteFinal={buyoutMesAceiteFinal}
            oemBase={oemBase}
            setOemBase={setOemBase}
            oemInflacao={oemInflacao}
            setOemInflacao={setOemInflacao}
            seguroReajuste={seguroReajuste}
            setSeguroReajuste={setSeguroReajuste}
            seguroModo={seguroModo}
            setSeguroModo={setSeguroModo}
            seguroValorA={seguroValorA}
            setSeguroValorA={setSeguroValorA}
            seguroPercentualB={seguroPercentualB}
            setSeguroPercentualB={setSeguroPercentualB}
            density={density}
            setDensity={setDensity}
            mostrarGrafico={mostrarGrafico}
            setMostrarGrafico={setMostrarGrafico}
            useBentoGridPdf={useBentoGridPdf}
            setUseBentoGridPdf={setUseBentoGridPdf}
            mostrarFinanciamento={mostrarFinanciamento}
            setMostrarFinanciamento={setMostrarFinanciamento}
            mobileSimpleView={mobileSimpleView}
            setMobileSimpleView={setMobileSimpleView}
            desktopSimpleView={desktopSimpleView}
            setDesktopSimpleView={setDesktopSimpleView}
          />
        ) : activePage === 'admin-users' ? (
          <AdminUsersPage onBack={() => setActivePage(lastPrimaryPageRef.current)} />
        ) : activePage === 'carteira' ? (
          canSeePortfolioEffective
            ? <ClientPortfolioPage
                onBack={() => setActivePage(lastPrimaryPageRef.current)}
                onClientRemovedFromPortfolio={() => {
                  carregarClientesPrioritarios({ silent: true })
                    .then((refreshed) => setClientesSalvos(refreshed))
                    .catch((err: unknown) => console.warn('[portfolio] reload after remove failed', err))
                }}
                onOpenFinancialProject={(projectId) => {
                  setPendingFinancialProjectId(projectId)
                  setActivePage('financial-management')
                }}
              />
            : null
        ) : activePage === 'financial-management' ? (
          canSeeFinancialManagementEffective
            ? <FinancialManagementPage
                onBack={() => setActivePage(lastPrimaryPageRef.current)}
                initialProjectId={pendingFinancialProjectId}
              />
            : null
        ) : activePage === 'operational-dashboard' ? (
          canSeeDashboardEffective
            ? <OperationalDashboardPage />
            : null
        ) : (
          <div className="page">
            <div className="app-main">
              <main className={`content page-content${activeTab === 'vendas' ? ' vendas' : ''}`}>
                <div className="proposal-page-top-chrome">
                  {isProposalReadOnly && (
                    <div className="proposal-readonly-notice" role="status">
                      🔒 Modo somente leitura — seu perfil (<strong>{userRole}</strong>) não permite salvar ou excluir propostas.
                    </div>
                  )}
                  <ActionBar
                    onGenerateProposal={() => {
                      void handlePrint()
                    }}
                    onSaveProposal={() => {
                      void handleSalvarPropostaPdf()
                    }}
                    onNewProposal={() => {
                      void handleNovaProposta()
                    }}
                    onIncludeImages={handleAbrirUploadImagens}
                    isSaving={salvandoPropostaPdf}
                    isDisabled={!podeSalvarProposta}
                  />
                </div>
                <div className="proposal-main-content proposal-form-wrapper">
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
                    <ClienteDadosSection
                      cliente={cliente}
                      budgetCodeDisplay={budgetCodeDisplay}
                      segmentoCliente={segmentoCliente}
                      tipoEdificacaoOutro={tipoEdificacaoOutro}
                      tusdTipoCliente={tusdTipoCliente}
                      clienteMensagens={clienteMensagens}
                      buscandoCep={buscandoCep}
                      cidadeBloqueadaPorCep={cidadeBloqueadaPorCep}
                      cidadeSelectOpen={cidadeSelectOpen}
                      cidadeSearchTerm={cidadeSearchTerm}
                      cidadesCarregando={cidadesCarregando}
                      cidadesFiltradas={cidadesFiltradas}
                      cidadeManualDigitada={cidadeManualDigitada}
                      cidadeManualDisponivel={cidadeManualDisponivel}
                      verificandoCidade={verificandoCidade}
                      ufsDisponiveis={ufsDisponiveis}
                      clienteDistribuidorasDisponiveis={clienteDistribuidorasDisponiveis}
                      clienteDistribuidoraDisabled={clienteDistribuidoraDisabled}
                      ucGeradoraTitularDiferente={leasingContrato.ucGeradoraTitularDiferente}
                      ucGeradora_importarEnderecoCliente={leasingContrato.ucGeradora_importarEnderecoCliente}
                      ucGeradoraTitularPanel={
                        <UcGeradoraTitularPanel
                          ucGeradoraTitularDiferente={leasingContrato.ucGeradoraTitularDiferente}
                          ucGeradoraTitular={leasingContrato.ucGeradoraTitular}
                          ucGeradoraTitularDraft={leasingContrato.ucGeradoraTitularDraft}
                          ucGeradoraTitularDistribuidoraAneel={leasingContrato.ucGeradoraTitularDistribuidoraAneel}
                          panelOpen={ucGeradoraTitularPanelOpen}
                          errors={ucGeradoraTitularErrors}
                          buscandoCep={ucGeradoraTitularBuscandoCep}
                          cepMessage={ucGeradoraTitularCepMessage}
                          cidadeBloqueadaPorCep={ucGeradoraCidadeBloqueadaPorCep}
                          ufsDisponiveis={ufsDisponiveis}
                          titularDistribuidoraDisabled={titularDistribuidoraDisabled}
                          ucGeradoraTitularUf={ucGeradoraTitularUf}
                          ucGeradoraTitularDistribuidorasDisponiveis={ucGeradoraTitularDistribuidorasDisponiveis}
                          onUpdateDraft={updateUcGeradoraTitularDraft}
                          onClearError={clearUcGeradoraTitularError}
                          onUfChange={handleUcGeradoraTitularUfChange}
                          onDistribuidoraChange={handleUcGeradoraTitularDistribuidoraChange}
                          onSalvar={() => { void handleSalvarUcGeradoraTitular() }}
                          onCancelar={handleCancelarUcGeradoraTitular}
                          onEditar={handleEditarUcGeradoraTitular}
                          onSetCepMessage={setUcGeradoraTitularCepMessage}
                          onSetBuscandoCep={setUcGeradoraTitularBuscandoCep}
                          onSetCidadeBloqueada={setUcGeradoraCidadeBloqueadaPorCep}
                        />
                      }
                      ucsBeneficiarias={ucsBeneficiarias}
                      consumoTotalUcsBeneficiarias={consumoTotalUcsBeneficiarias}
                      consumoUcsExcedeInformado={consumoUcsExcedeInformado}
                      kcKwhMes={kcKwhMes}
                      temCorresponsavelFinanceiro={leasingContrato.temCorresponsavelFinanceiro}
                      clienteIndicacaoCheckboxId={clienteIndicacaoCheckboxId}
                      clienteIndicacaoNomeId={clienteIndicacaoNomeId}
                      clienteConsultorSelectId={clienteConsultorSelectId}
                      clienteHerdeirosContentId={clienteHerdeirosContentId}
                      clienteHerdeirosExpandidos={clienteHerdeirosExpandidos}
                      formConsultores={formConsultores}
                      clienteTemDadosNaoSalvos={clienteTemDadosNaoSalvos}
                      clienteSaveLabel={clienteSaveLabel}
                      oneDriveIntegrationAvailable={oneDriveIntegrationAvailable}
                      onClienteChange={handleClienteChange}
                      onUpdateClienteSync={updateClienteSync}
                      onClearFieldHighlight={clearFieldHighlight}
                      onSetCidadeBloqueadaPorCep={setCidadeBloqueadaPorCep}
                      onSetCidadeSelectOpen={setCidadeSelectOpen}
                      onSetCidadeSearchTerm={setCidadeSearchTerm}
                      onSetClienteMensagens={setClienteMensagens}
                      onClearCepAviso={() => { cepCidadeAvisoRef.current = null }}
                      onSegmentoChange={handleSegmentoClienteChange}
                      onTipoEdificacaoOutroChange={setTipoEdificacaoOutro}
                      onEnderecoFocus={() => { isEditingEnderecoRef.current = true }}
                      onEnderecoBlur={() => { isEditingEnderecoRef.current = false }}
                      onToggleUcGeradoraTitularDiferente={handleToggleUcGeradoraTitularDiferente}
                      onImportEnderecoClienteParaUcGeradora={handleImportEnderecoClienteParaUcGeradora}
                      onAtualizarUcBeneficiaria={handleAtualizarUcBeneficiaria}
                      onAdicionarUcBeneficiaria={handleAdicionarUcBeneficiaria}
                      onRemoverUcBeneficiaria={handleRemoverUcBeneficiaria}
                      onHerdeiroChange={handleHerdeiroChange}
                      onAdicionarHerdeiro={handleAdicionarHerdeiro}
                      onRemoverHerdeiro={handleRemoverHerdeiro}
                      onSetClienteHerdeirosExpandidos={setClienteHerdeirosExpandidos}
                      onAbrirCorresponsavelModal={handleAbrirCorresponsavelModal}
                      onSalvarCliente={() => { void handleSalvarCliente() }}
                      onAbrirClientesPainel={() => { void abrirClientesPainel() }}
                    />
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
                    <PropostaImagensSection
                      propostaImagens={propostaImagens}
                      activeTab={activeTab}
                      onAddImages={handleAbrirUploadImagens}
                      onRemoveImagem={handleRemoverPropostaImagem}
                    />
              {activeTab === 'leasing' ? (
                <>
                  <ParametrosPrincipaisSection
                    kcKwhMes={kcKwhMes}
                    tipoRedeLabel={tipoRedeLabel}
                    vendaForm={vendaForm}
                    tarifaCheiaField={tarifaCheiaField}
                    taxaMinimaInputEmpty={taxaMinimaInputEmpty}
                    taxaMinima={taxaMinima}
                    encargosFixosExtras={encargosFixosExtras}
                    baseIrradiacao={baseIrradiacao}
                    shouldHideSimpleViewItems={shouldHideSimpleViewItems}
                    tusdPercent={tusdPercent}
                    tusdTipoCliente={tusdTipoCliente}
                    tusdSubtipo={tusdSubtipo}
                    tusdSimultaneidade={tusdSimultaneidade}
                    tusdTarifaRkwh={tusdTarifaRkwh}
                    tusdAnoReferencia={tusdAnoReferencia}
                    tusdOpcoesExpandidas={tusdOpcoesExpandidas}
                    segmentoCliente={segmentoCliente}
                    tipoEdificacaoOutro={tipoEdificacaoOutro}
                    tusdOptionsTitleId={tusdOptionsTitleId}
                    tusdOptionsToggleId={tusdOptionsToggleId}
                    tusdOptionsContentId={tusdOptionsContentId}
                    multiUcAtivo={multiUcAtivo}
                    multiUcRateioModo={multiUcRateioModo}
                    multiUcEnergiaGeradaKWh={multiUcEnergiaGeradaKWh}
                    multiUcEnergiaGeradaTouched={multiUcEnergiaGeradaTouched}
                    multiUcAnoVigencia={multiUcAnoVigencia}
                    multiUcOverrideEscalonamento={multiUcOverrideEscalonamento}
                    multiUcEscalonamentoCustomPercent={multiUcEscalonamentoCustomPercent}
                    multiUcEscalonamentoPadrao={multiUcEscalonamentoPadrao}
                    multiUcEscalonamentoPercentual={multiUcEscalonamentoPercentual}
                    multiUcEscalonamentoTabela={multiUcEscalonamentoTabela}
                    multiUcRows={multiUcRows}
                    multiUcResultado={multiUcResultado}
                    multiUcResultadoPorId={multiUcResultadoPorId}
                    multiUcRateioPercentualTotal={multiUcRateioPercentualTotal}
                    multiUcRateioManualTotal={multiUcRateioManualTotal}
                    multiUcErrors={multiUcErrors}
                    multiUcWarnings={multiUcWarnings}
                    distribuidoraAneelEfetiva={distribuidoraAneelEfetiva}
                    initialMultiUcAnoVigencia={INITIAL_VALUES.multiUcAnoVigencia}
                    onSetKcKwhMes={setKcKwhMes}
                    onApplyVendaUpdates={applyVendaUpdates}
                    onNormalizeTaxaMinimaInputValue={normalizeTaxaMinimaInputValue}
                    onSetEncargosFixosExtras={setEncargosFixosExtras}
                    onTusdPercentChange={(normalized) => {
                      setTusdPercent(normalized)
                      applyVendaUpdates({ tusd_percentual: normalized })
                      resetRetorno()
                    }}
                    onTusdTipoClienteChange={handleTusdTipoClienteChange}
                    onTusdSubtipoChange={(value) => {
                      setTusdSubtipo(value)
                      applyVendaUpdates({ tusd_subtipo: value || undefined })
                      resetRetorno()
                    }}
                    onTusdSimultaneidadeChange={(value) => {
                      setTusdSimultaneidadeFromSource(value, 'manual')
                      resetRetorno()
                    }}
                    onTusdTarifaRkwhChange={(value) => {
                      setTusdTarifaRkwh(value)
                      applyVendaUpdates({ tusd_tarifa_r_kwh: value ?? undefined })
                      resetRetorno()
                    }}
                    onTusdAnoReferenciaChange={(value) => {
                      setTusdAnoReferencia(value)
                      applyVendaUpdates({ tusd_ano_referencia: value })
                      resetRetorno()
                    }}
                    onTusdOpcoesExpandidasChange={setTusdOpcoesExpandidas}
                    onTipoEdificacaoOutroChange={setTipoEdificacaoOutro}
                    onHandleMultiUcToggle={handleMultiUcToggle}
                    onHandleMultiUcQuantidadeChange={handleMultiUcQuantidadeChange}
                    onSetMultiUcEnergiaGeradaKWh={setMultiUcEnergiaGeradaKWh}
                    onHandleMultiUcRateioModoChange={handleMultiUcRateioModoChange}
                    onSetMultiUcAnoVigencia={setMultiUcAnoVigencia}
                    onSetMultiUcOverrideEscalonamento={setMultiUcOverrideEscalonamento}
                    onSetMultiUcEscalonamentoCustomPercent={setMultiUcEscalonamentoCustomPercent}
                    onHandleMultiUcClasseChange={handleMultiUcClasseChange}
                    onHandleMultiUcConsumoChange={handleMultiUcConsumoChange}
                    onHandleMultiUcRateioPercentualChange={handleMultiUcRateioPercentualChange}
                    onHandleMultiUcManualRateioChange={handleMultiUcManualRateioChange}
                    onHandleMultiUcTeChange={handleMultiUcTeChange}
                    onHandleMultiUcTusdTotalChange={handleMultiUcTusdTotalChange}
                    onHandleMultiUcTusdFioBChange={handleMultiUcTusdFioBChange}
                    onHandleMultiUcObservacoesChange={handleMultiUcObservacoesChange}
                    onHandleMultiUcAdicionar={handleMultiUcAdicionar}
                    onHandleMultiUcRecarregarTarifas={handleMultiUcRecarregarTarifas}
                    onHandleMultiUcRemover={handleMultiUcRemover}
                  />
                  <LeasingConfiguracaoUsinaSection
                    configuracaoUsinaObservacoesExpanded={configuracaoUsinaObservacoesExpanded}
                    configuracaoUsinaObservacoesLeasingContainerId={configuracaoUsinaObservacoesLeasingContainerId}
                    setConfiguracaoUsinaObservacoesExpanded={setConfiguracaoUsinaObservacoesExpanded}
                    configuracaoUsinaObservacoes={configuracaoUsinaObservacoes}
                    configuracaoUsinaObservacoesLeasingId={configuracaoUsinaObservacoesLeasingId}
                    setConfiguracaoUsinaObservacoes={setConfiguracaoUsinaObservacoes}
                    normComplianceBanner={normComplianceBanner}
                    normComplianceStatus={normCompliance?.status}
                    precheckClienteCiente={precheckClienteCiente}
                    setPrecheckClienteCiente={setPrecheckClienteCiente}
                    potenciaModulo={potenciaModulo}
                    setPotenciaModuloDirty={setPotenciaModuloDirty}
                    setPotenciaModulo={setPotenciaModulo}
                    numeroModulosManual={numeroModulosManual}
                    numeroModulosEstimado={numeroModulosEstimado}
                    moduleQuantityInputRef={moduleQuantityInputRef}
                    setNumeroModulosManual={setNumeroModulosManual}
                    tipoRede={tipoRede}
                    handleTipoRedeSelection={handleTipoRedeSelection}
                    potenciaFonteManual={potenciaFonteManual}
                    vendaForm={vendaForm}
                    potenciaInstaladaKwp={potenciaInstaladaKwp}
                    handlePotenciaInstaladaChange={handlePotenciaInstaladaChange}
                    geracaoMensalKwh={geracaoMensalKwh}
                    areaInstalacao={areaInstalacao}
                    tipoRedeCompatMessage={tipoRedeCompatMessage}
                    estruturaTipoWarning={estruturaTipoWarning}
                    handleMissingInfoUploadClick={handleMissingInfoUploadClick}
                    inverterModelInputRef={inverterModelInputRef}
                    applyVendaUpdates={applyVendaUpdates}
                    geracaoDiariaKwh={geracaoDiariaKwh}
                  />
                  {shouldHideSimpleViewItems ? null : (
                    <LeasingContratoSection
                      leasingContrato={leasingContrato}
                      leasingHomologacaoInputId={leasingHomologacaoInputId}
                      clienteDiaVencimento={cliente.diaVencimento}
                      onCampoChange={handleLeasingContratoCampoChange}
                      onClienteDiaVencimentoChange={(value) => handleClienteChange('diaVencimento', value)}
                      onProprietarioChange={handleLeasingContratoProprietarioChange}
                      onAdicionarProprietario={handleAdicionarContratoProprietario}
                      onRemoverProprietario={handleRemoverContratoProprietario}
                    />
                  )}
                  <section className="card">
                    <div className="card-header">
                      <h2>SolarInvest Leasing</h2>
                      <div className="card-actions">
                        <button
                          type="button"
                          className="primary"
                          // eslint-disable-next-line @typescript-eslint/no-misused-promises
                          onClick={handleSalvarPropostaLeasing}
                          disabled={!podeSalvarProposta || salvandoPropostaLeasing}
                        >
                          {salvandoPropostaLeasing ? 'Salvando…' : 'Salvar proposta'}
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
                        <InfoTooltip text="Preço Mín. Saudável (Análise Financeira v1). Quando disponível, usa o preço mínimo saudável calculado pelo motor de análise. Caso contrário, usa o custo final projetado automático." />
                        Valor atual de venda
                        <strong>{currency(custoFinalProjetadoCanonico)}</strong>
                      </span>
                      <span className="pill">
                        <InfoTooltip text="Tarifa com desconto = Tarifa cheia ajustada pelos reajustes anuais × (1 - desconto contratual)." />
                        Tarifa c/ desconto
                        <strong>{tarifaCurrency(parcelasSolarInvest.tarifaDescontadaBase)} / kWh</strong>
                      </span>
                      {shouldHideSimpleViewItems ? null : (
                        <span className="pill">
                          <InfoTooltip text="CAPEX (SolarInvest) = Valor atual de venda × 70%. Representa o capital investido pela SolarInvest para executar o projeto." />
                          CAPEX (SolarInvest)
                          <strong>{currency(capexSolarInvest)}</strong>
                        </span>
                      )}
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

                    {!shouldHideSimpleViewItems ? (
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
                    ) : null}

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

            {shouldHideSimpleViewItems ? null : (
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
            )}

          </>
        ) : (
          <>
            {modoOrcamento === 'auto' ? (
              <section className="card">
                <h2>Orçamento automático</h2>
                <div className="grid g2">
                  <Field label="Consumo (kWh/mês)">
                    <input
                      data-field="cliente-consumo"
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
                        data-field="cliente-tipoRede"
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
                  <Field label="Valor atual de venda (R$)">
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
                <VendaParametrosSection
                  vendaForm={vendaForm}
                  vendaFormErrors={vendaFormErrors}
                  taxaMinimaInputEmpty={taxaMinimaInputEmpty}
                  taxaMinima={taxaMinima}
                  tipoRedeLabel={tipoRedeLabel}
                  tarifaCheiaVendaField={tarifaCheiaVendaField}
                  baseIrradiacao={baseIrradiacao}
                  tusdPercent={tusdPercent}
                  tusdTipoCliente={tusdTipoCliente}
                  tusdSubtipo={tusdSubtipo}
                  tusdSimultaneidade={tusdSimultaneidade}
                  tusdTarifaRkwh={tusdTarifaRkwh}
                  tusdAnoReferencia={tusdAnoReferencia}
                  tusdOpcoesExpandidas={tusdOpcoesExpandidas}
                  segmentoCliente={segmentoCliente}
                  tipoEdificacaoOutro={tipoEdificacaoOutro}
                  tusdOptionsTitleId={tusdOptionsTitleId}
                  tusdOptionsToggleId={tusdOptionsToggleId}
                  tusdOptionsContentId={tusdOptionsContentId}
                  ufTarifa={ufTarifa}
                  ufsDisponiveis={ufsDisponiveis}
                  distribuidoraTarifa={distribuidoraTarifa}
                  distribuidorasDisponiveis={distribuidorasDisponiveis}
                  calcularModulosPorGeracao={calcularModulosPorGeracao}
                  calcularPotenciaSistemaKwp={calcularPotenciaSistemaKwp}
                  estimarGeracaoPorPotencia={estimarGeracaoPorPotencia}
                  normalizarGeracaoMensal={normalizarGeracaoMensal}
                  normalizarPotenciaKwp={normalizarPotenciaKwp}
                  normalizeTaxaMinimaInputValue={normalizeTaxaMinimaInputValue}
                  onSetNumeroModulosManual={setNumeroModulosManual}
                  onSetKcKwhMes={setKcKwhMes}
                  onApplyVendaUpdates={applyVendaUpdates}
                  onSetInflacaoAa={setInflacaoAa}
                  onHandleParametrosUfChange={handleParametrosUfChange}
                  onHandleParametrosDistribuidoraChange={handleParametrosDistribuidoraChange}
                  onSetTusdPercent={setTusdPercent}
                  onTusdTipoClienteChange={handleTusdTipoClienteChange}
                  onSetTusdSubtipo={setTusdSubtipo}
                  onTusdSimultaneidadeFromSource={setTusdSimultaneidadeFromSource}
                  onSetTusdTarifaRkwh={setTusdTarifaRkwh}
                  onSetTusdAnoReferencia={setTusdAnoReferencia}
                  onSetTusdOpcoesExpandidas={setTusdOpcoesExpandidas}
                  onSetTipoEdificacaoOutro={setTipoEdificacaoOutro}
                  onResetRetorno={resetRetorno}
                />
                <VendaConfiguracaoSection
                  configuracaoUsinaObservacoesExpanded={configuracaoUsinaObservacoesExpanded}
                  configuracaoUsinaObservacoesVendaContainerId={configuracaoUsinaObservacoesVendaContainerId}
                  setConfiguracaoUsinaObservacoesExpanded={setConfiguracaoUsinaObservacoesExpanded}
                  configuracaoUsinaObservacoes={configuracaoUsinaObservacoes}
                  configuracaoUsinaObservacoesVendaId={configuracaoUsinaObservacoesVendaId}
                  setConfiguracaoUsinaObservacoes={setConfiguracaoUsinaObservacoes}
                  potenciaModulo={potenciaModulo}
                  setPotenciaModuloDirty={setPotenciaModuloDirty}
                  setPotenciaModulo={setPotenciaModulo}
                  numeroModulosManual={numeroModulosManual}
                  numeroModulosEstimado={numeroModulosEstimado}
                  moduleQuantityInputRef={moduleQuantityInputRef}
                  setNumeroModulosManual={setNumeroModulosManual}
                  applyVendaUpdates={applyVendaUpdates}
                  tipoInstalacao={tipoInstalacao}
                  handleTipoInstalacaoChange={handleTipoInstalacaoChange}
                  tipoSistema={tipoSistema}
                  handleTipoSistemaChange={handleTipoSistemaChange}
                  tipoRede={tipoRede}
                  handleTipoRedeSelection={handleTipoRedeSelection}
                  potenciaFonteManual={potenciaFonteManual}
                  vendaForm={vendaForm}
                  potenciaInstaladaKwp={potenciaInstaladaKwp}
                  handlePotenciaInstaladaChange={handlePotenciaInstaladaChange}
                  geracaoMensalKwh={geracaoMensalKwh}
                  areaInstalacao={areaInstalacao}
                  tipoRedeCompatMessage={tipoRedeCompatMessage}
                  estruturaTipoWarning={estruturaTipoWarning}
                  handleMissingInfoUploadClick={handleMissingInfoUploadClick}
                  inverterModelInputRef={inverterModelInputRef}
                  geracaoDiariaKwh={geracaoDiariaKwh}
                />
                <VendaResumoPublicoSection
                  valorTotalPropostaNormalizado={valorTotalPropostaNormalizado}
                  economiaEstimativaValorCalculado={economiaEstimativaValorCalculado}
                />
                <ComposicaoUfvSection
                  descontosMoneyField={descontosMoneyField}
                  capexBaseResumoField={capexBaseResumoField}
                  capexBaseResumoValor={capexBaseResumoValor}
                  capexBaseManualValor={capexBaseManualValor}
                  margemOperacionalResumoField={margemOperacionalResumoField}
                  margemManualAtiva={margemManualAtiva}
                  onOpenVendasConfig={() => { void abrirConfiguracoes('vendas') }}
                />
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
                        // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
                                    onChange={(event) => {
                                      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
                                      return handleBudgetItemChange(index, { ...item, description: event.target.value })
                                    }}
                                    placeholder="Descrição do item"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.quantity}
                                    onChange={(event) => {
                                      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
                                      return handleBudgetItemChange(index, { ...item, quantity: Number(event.target.value) })
                                    }}
                                    placeholder="Quantidade"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.unitValue as unknown as number}
                                    onChange={(event) => {
                                      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
                                      return handleBudgetItemChange(index, { ...item, unitValue: Number(event.target.value) })
                                    }}
                                    placeholder="Valor unitário"
                                  />
                                </td>
                                <td>
                                  <input type="text" value={currency(item.total as unknown as number)} readOnly aria-label="Total do item" />
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
                {condicoesPagamentoSection}
                <RetornoProjetadoSection
                  retornoProjetado={retornoProjetado}
                  retornoStatus={retornoStatus}
                  retornoError={retornoError}
                  capexTotal={Number.isFinite(vendaForm.capex_total) ? Number(vendaForm.capex_total) : 0}
                  onCalcular={handleCalcularRetorno}
                />
              </>
            ) : null}
          </>
        )}
                </div>
                {activeTab === 'leasing' ? (
                  <>
                    {leasingBuyoutSection}
                    {shouldHideSimpleViewItems ? null : leasingChartSection}
                  </>
                ) : null}
              </div>

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
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onChange={handleImagensSelecionadas}
        style={{ display: 'none' }}
      />

      {isEnviarPropostaModalOpen ? (
        <EnviarPropostaModal
          contatos={contatosEnvio}
          selectedContatoId={contatoEnvioSelecionadoId}
          onSelectContato={selecionarContatoEnvio}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onEnviar={handleEnviarProposta}
          onClose={fecharEnvioPropostaModal}
        />
      ) : null}
      {isCorresponsavelModalOpen ? (
        <CorresponsavelModal
          draft={corresponsavelDraft}
          errors={corresponsavelErrors}
          temCorresponsavelFinanceiro={leasingContrato.temCorresponsavelFinanceiro}
          onChange={(field, value) =>
            updateCorresponsavelDraft({ [field]: value } as Partial<LeasingCorresponsavel>)
          }
          onChangeEndereco={(field, value) =>
            updateCorresponsavelEndereco({ [field]: value } as Partial<LeasingEndereco>)
          }
          onSave={handleSalvarCorresponsavel}
          onDeactivate={handleDesativarCorresponsavel}
          onClose={handleFecharCorresponsavelModal}
        />
      ) : null}

      <input
        ref={clientesImportInputRef}
        type="file"
        accept="application/json,text/csv,.csv"
        style={{ display: 'none' }}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onChange={handleClientesImportarArquivo}
      />
      <input
        ref={backupImportInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onChange={handleBackupUploadArquivo}
      />

      {isBackupModalOpen ? (
        <BackupActionModal
          isLoading={isGerandoBackupBanco}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onDownload={handleBackupModalDownload}
          onUpload={handleBackupModalUpload}
          onClose={() => setIsBackupModalOpen(false)}
        />
      ) : null}

      {isBulkImportPreviewOpen ? (
        <BulkImportPreviewModal
          rows={bulkImportPreviewRows}
          autoMerge={bulkImportAutoMerge}
          isLoading={isBulkImportConfirming}
          onAutoMergeChange={setBulkImportAutoMerge}
          onRowSelectionChange={handleBulkImportRowSelection}
          onRowActionChange={handleBulkImportRowAction}
          onSelectAllValid={handleBulkImportSelectAllValid}
          onSelectAll={handleBulkImportSelectAll}
          onClearSelection={handleBulkImportClearSelection}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onConfirm={handleBulkImportConfirm}
          onClose={handleBulkImportClose}
        />
      ) : null}

      {isLeasingContractsModalOpen ? (
        <LeasingContractsModal
          tipoContrato={leasingContrato.tipoContrato}
          anexosSelecionados={leasingAnexosSelecionados}
          anexosAvailability={leasingAnexosAvailability}
          isLoadingAvailability={leasingAnexosLoading}
          corresponsavelAtivo={corresponsavelAtivo}
          onToggleAnexo={handleToggleLeasingAnexo}
          onSelectAll={handleSelectAllLeasingAnexos}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onConfirm={handleConfirmarGeracaoContratosVendas}
          onClose={handleFecharModalContratos}
        />
      ) : null}
      {precheckModalData ? (
        <PrecheckModal
          data={precheckModalData}
          clienteCiente={precheckModalClienteCiente}
          setClienteCiente={setPrecheckModalClienteCiente}
          onDecision={resolvePrecheckDecision}
        />
      ) : null}

      {(clientsSyncState === 'local-fallback' || clientsSyncState === 'degraded-api' || proposalsSyncState === 'local-only' || proposalsSyncState === 'failed') ? (
        <div className="sync-warning-banner" role="status" aria-live="polite">
          {clientsSyncState === 'degraded-api'
            ? '⚠️ Clientes atualizados, mas a recarga completa da lista falhou no momento.'
            : '⚠️ Dados em modo local temporário. A sincronização com o banco (Neon) está indisponível no momento.'}
        </div>
      ) : null}
      {showAdminDiagnostics && isAdmin ? (
        <div
          style={{
            position: 'fixed',
            right: 12,
            bottom: 12,
            zIndex: 9999,
            maxWidth: 360,
            background: '#111827',
            color: '#f9fafb',
            fontSize: 12,
            padding: 12,
            borderRadius: 8,
            opacity: 0.95,
          }}
        >
          <strong>Admin diagnostics</strong>
          <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0 0' }}>
            {JSON.stringify({
              authState: meAuthState,
              authSource: me?.authSource ?? null,
              meAuthenticated: me?.authenticated ?? null,
              meAuthorized: me?.authorized ?? null,
              clientsSyncState,
              clientsSource,
              proposalsSyncState,
              dbSource: null,
              dbHost: null,
              dbName: null,
              dbSchema: null,
              clientsLastLoadError,
              clientsLastDeleteError,
              lastSuccessfulApiLoadAt,
              lastDeleteReconciledAt,
            }, null, 2)}
          </pre>
        </div>
      ) : null}

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
      {confirmDialog ? (
        <ConfirmDialog
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmLabel={confirmDialog.confirmLabel ?? 'Confirmar'}
          cancelLabel={confirmDialog.cancelLabel ?? 'Cancelar'}
          onConfirm={() => resolveConfirmDialog(true)}
          onCancel={() => resolveConfirmDialog(false)}
        />
      ) : null}
      {clientReadinessErrors ? (
        <ClientReadinessErrorModal
          title="Dados cadastrais inválidos"
          intro="Não é possível prosseguir porque há dados inválidos ou incompletos. Corrija os campos abaixo antes de fechar o negócio ou gerar os contratos:"
          issues={clientReadinessErrors}
          onClose={() => setClientReadinessErrors(null)}
        />
      ) : null}
    </>
  )
}
