import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  useCrm,
  CrmPage,
  CrmPageActions,
} from './features/crm'
import { CheckboxSmall } from './components/CheckboxSmall'
import { ActionBar } from './components/layout/ActionBar'
import { InfoTooltip, labelWithTooltip } from './components/InfoTooltip'

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
import { getDistribuidorasFallback } from './utils/distribuidorasAneel'
import { selectNumberInputOnFocus } from './utils/focusHandlers'
import { resolveApiUrl } from './utils/apiUrl'
import {
  persistClienteRegistroToOneDrive,
  persistContratoToOneDrive,
  type ClienteRegistroSyncPayload,
  isOneDriveIntegrationAvailable,
  OneDriveIntegrationMissingError,
} from './utils/onedrive'
import {
  isProposalPdfIntegrationAvailable,
} from './utils/proposalPdf'
import {
  sanitizePrintableHtml,
  buildProposalPdfDocument,
  renderPrintableBuyoutTableToHtml,
  type PrintVariant,
} from './lib/pdf/printRenderers'
import { buildPrintableData, clonePrintableData } from './lib/pdf/buildPrintableData'
import { usePrintOrchestration } from './lib/pdf/usePrintOrchestration'
import type { StructuredBudget, StructuredItem } from './utils/structuredBudgetParser'
import {
  classifyBudgetItem,
  sumModuleQuantities,
  type EssentialInfoSummary,
} from './utils/moduleDetection'
import { removeFogOverlays, watchFogReinjection } from './utils/antiOverlay'
import { saveFormDraft, clearFormDraft } from './lib/persist/formDraft'
import { formatEnderecoCompleto } from './lib/formatEnderecoCompleto'
import {
  upsertClienteRegistro,
  getClienteRegistroById,
} from './app/services/clientStore'
import {
  computeROI,
  type PagamentoCondicao,
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
  validateClientReadinessForContract,
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
  formatNumberBRWithOptions,
  toNumberFlexible,
} from './lib/locale/br-number'
import { MONEY_INPUT_PLACEHOLDER, useBRNumberField } from './lib/locale/useBRNumberField'
import {
  calcPotenciaSistemaKwp,
  calcProjectedCostsByConsumption,
  formatBRL,
  getRedeByPotencia,
} from './lib/pricing/pricingPorKwp'
import { calcularPrecheckNormativo } from './domain/normas/precheckNormativo'
import {
  formatTipoLigacaoLabel,
  type TipoLigacaoNorma,
} from './domain/normas/padraoEntradaRules'
import { lookupCep } from './shared/cepLookup'
import {
  getAutoEligibility,
  normalizeInstallType,
  normalizeSystemType,
  type InstallType,
  type SystemType,
} from './lib/pricing/autoEligibility'
import { normalizeProposalId } from './lib/ids'
import {
  getVendaSnapshot,
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
import { printStyles, simplePrintStyles } from './styles/printTheme'
import { TIPOS_REDE } from './constants/instalacao'
import './styles/config-page.css'
import './styles/toast.css'
import './styles/bulk-import.css'
import './styles/backup-modal.css'
import '@/styles/fix-fog-safari.css'
import { AppRoutes } from './app/Routes'
import { PageRenderer } from './app/PageRenderer'
import { AppShell } from './layout/AppShell'
import type { SidebarGroup } from './layout/Sidebar'
import { buildSidebarGroups } from './config/sidebarConfig'
import { useRouteGuard } from './hooks/useRouteGuard'
import { useTheme } from './hooks/useTheme'
import { useModalPrompts } from './hooks/useModalPrompts'
import { useSystemColorScheme } from './hooks/useSystemColorScheme'
import { useIbgeMunicipios } from './hooks/useIbgeMunicipios'
import { useMultiUcState } from './features/simulacoes/useMultiUcState'
import { useDisplayPreferences } from './hooks/useDisplayPreferences'
import { useAdminSettingsDraft } from './hooks/useAdminSettingsDraft'
import { useAneelTarifaState } from './features/simulacoes/useAneelTarifaState'
import { useContractModalState } from './hooks/useContractModalState'
import { useNotificacoes } from './hooks/useNotificacoes'
import { usePropostaEnvioModal } from './hooks/usePropostaEnvioModal'
import { useLeasingFinanciamentoState } from './features/simulacoes/useLeasingFinanciamentoState'
import { usePrecheckNormativo } from './features/simulacoes/usePrecheckNormativo'
import type { ClienteContratoPayload } from './types/contratoTypes'
import { useSolarInvestAppController } from './app/useSolarInvestAppController'
import {
  ANALISE_ANOS_PADRAO,
  DIAS_MES_PADRAO,
  INITIAL_VALUES,
  PAINEL_OPCOES,
  UF_LABELS,
  createEmptyKitBudget,
  createInitialComposicaoSolo,
  createInitialComposicaoTelhado,
  createInitialVendaForm,
  createDefaultMultiUcRow,
  CONSUMO_MINIMO_FICTICIO,
  type KitBudgetMissingInfo,
  type KitBudgetState,
  type SeguroModo,
  type SettingsTabKey,
  type TabKey,
  type TipoRede,
} from './app/config'
import { useVendasConfigStore, vendasConfigSelectors } from './store/useVendasConfigStore'
import { useVendasSimulacoesStore } from './store/useVendasSimulacoesStore'
import type { VendasSimulacao } from './store/useVendasSimulacoesStore'
import {
  calcularComposicaoUFV,
  type Inputs as ComposicaoUFVInputs,
} from './lib/venda/calcComposicaoUFV'
import {
  DEFAULT_OCR_DPI,
  type BudgetUploadProgress,
} from './app/services/budgetUpload'
import type {
  BuyoutResumo,
  BuyoutRow,
  ClienteDados,
  PrintableProposalImage,
  MensalidadeRow,
  PrintableProposalProps,
  TipoInstalacao,
  UfvComposicaoSoloValores,
  UfvComposicaoTelhadoValores,
} from './types/printableProposal'
import {
  normalizeTipoBasico,
} from './types/tipoBasico'
import type { VendasConfig } from './types/vendasConfig'
import {
  currency,
  formatAxis,
  formatCep,
  formatCpfCnpj,
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
  type CreateProposalInput,
  updateProposal,
} from './lib/api/proposalsApi'
import {
  ClientsApiError,
  deleteClientById,
  isClientNotFoundError,
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
import { AdminUsersPage } from './features/admin-users/AdminUsersPage'
import { SettingsPage } from './pages/SettingsPage'
import { useAuthorizationSnapshot } from './auth/useAuthorizationSnapshot'
import { clearOfflineSnapshot } from './lib/auth/authorizationSnapshot'
import { ClientPortfolioPage } from './pages/ClientPortfolioPage'
import { RevenueAndBillingPage } from './pages/RevenueAndBillingPage'
import { OperationalDashboardPage } from './pages/OperationalDashboardPage'
import { DashboardPage } from './pages/DashboardPage'
import { convertClientToClosedDeal } from './services/deals/convert-client-to-closed-deal'
import type { ConsultantForResolution } from './domain/clients/consultant-resolution'
import { useAnaliseFinanceiraState } from './features/simulacoes/useAnaliseFinanceiraState'
import { SimuladorPage } from './features/simulador/SimuladorPage'
import { cloneImpostosOverrides, parseNumericInput, toNumberSafe } from './utils/vendasHelpers'
import { formatWhatsappPhoneNumber } from './utils/phoneUtils'
import { Field, FieldError } from './components/ui/Field'
import { ClientesPage } from './pages/ClientesPage'
import { BudgetSearchPage } from './pages/BudgetSearchPage'
import { PrecheckModal } from './pages/PrecheckModal'
import { PropostaImagensSection } from './components/PropostaImagensSection'
import { CondicoesPagamentoSection } from './components/CondicoesPagamentoSection'
import { UcGeradoraTitularPanel } from './components/UcGeradoraTitularPanel'
import { ClienteDadosSection } from './components/ClienteDadosSection'
import { TusdParametersSection } from './components/TusdParametersSection'
import { LeasingSections } from './features/simulador/leasing/LeasingSections'
import { VendasSections } from './features/simulador/vendas/VendasSections'
import { VendasForm } from './features/simulador/vendas/VendasForm'
import type { ClienteMensagens } from './types/cliente'
import type { UcBeneficiariaFormState } from './types/ucBeneficiaria'
import type { UcGeradoraTitularErrors } from './types/ucGeradoraTitular'
import { isSegmentoCondominio } from './utils/segmento'
import {
  ContractTemplatesModal,
} from './components/modals/ContractTemplatesModal'
import {
  LeasingContractsModal,
  type LeasingAnexoId,
  getDefaultLeasingAnexos,
  ensureRequiredLeasingAnexos,
} from './components/modals/LeasingContractsModal'
import {
  CorresponsavelModal,
  type CorresponsavelErrors,
  resolveCorresponsavelEndereco,
} from './components/modals/CorresponsavelModal'
import {
  SaveChangesDialog,
  type SaveDecisionPromptRequest,
} from './components/modals/SaveChangesDialog'
import {
  ConfirmDialog,
} from './components/modals/ConfirmDialog'
import {
  EnviarPropostaModal,
  type PropostaEnvioMetodo,
} from './components/modals/EnviarPropostaModal'

// ── Extracted client state types, helpers, and hook ──────────────────────────
import type {
  OrcamentoSnapshotData,
  PageSharedSettings,
  ClienteRegistro,
} from './types/orcamentoTypes'
import {
  CLIENTES_STORAGE_KEY,
  CLIENTE_ID_PATTERN,
  CLIENTE_INICIAL,
  isSyncedClienteField,
  getDistribuidoraValidationMessage,
  cloneClienteDados,
  ensureClienteHerdeiros,
  generateClienteId,
  isQuotaExceededError,
  persistClientesToLocalStorage,
  normalizeClienteRegistros,
} from './features/clientes/clienteHelpers'
import { useClientImportExport } from './features/clientes/useClientImportExport'
import {
  tick,
  createDraftBudgetId as createDraftBudgetIdHelper,
  resolveConsumptionFromSnapshot,
  resolveSystemKwpFromSnapshot,
  resolveTermMonthsFromSnapshot,
  normalizeTusdTipoClienteValue,
  buildProposalUpsertPayload,
} from './features/propostas/proposalHelpers'
import { useProposalImageActions } from './features/simulacoes/useProposalImageActions'
import { useSimuladorTabActions } from './features/simulacoes/useSimuladorTabActions'
import { useProposalSaveActions } from './features/propostas/useProposalSaveActions'
import { useProposalListActions } from './features/propostas/useProposalListActions'
import { useClientAddressLookup } from './features/clientes/useClientAddressLookup'
// ─────────────────────────────────────────────────────────────────────────────


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
const LeasingBeneficioChart = React.lazy(() => import('./components/leasing/LeasingBeneficioChart').then(m => ({ default: m.LeasingBeneficioChart })))

const TIPO_SISTEMA_VALUES: readonly TipoSistema[] = ['ON_GRID', 'HIBRIDO', 'OFF_GRID'] as const


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

const ECONOMIA_ESTIMATIVA_PADRAO_ANOS = 5


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


type NotificacaoTipo = 'success' | 'info' | 'error'

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

const iconeNotificacaoPorTipo: Record<NotificacaoTipo, string> = {
  success: '✔',
  info: 'ℹ',
  error: '⚠',
}

const createDraftBudgetId = () => createDraftBudgetIdHelper()

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


const cloneBudgetUploadProgress = (
  progress: BudgetUploadProgress | null,
): BudgetUploadProgress | null => (progress ? { ...progress } : null)

const cloneEssentialCategoryInfo = (info: EssentialInfoSummary['modules']) => {
  if (!info || typeof info !== 'object') {
    return { hasAny: false, hasProduct: false, hasDescription: false, hasQuantity: false, missingFields: [] }
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
    cliente: cloneClienteDados((s as OrcamentoSnapshotData).cliente),
    clienteMensagens: s.clienteMensagens ? { ...s.clienteMensagens } : undefined,
    ucBeneficiarias: cloneUcBeneficiariasForm(Array.isArray(s.ucBeneficiarias) ? s.ucBeneficiarias : []),

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
      : ({ rows: [] } as unknown as OrcamentoSnapshotData['multiUc']),
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


const computeSnapshotSignature = (
  snapshot: OrcamentoSnapshotData,
  dados: PrintableProposalProps,
): string =>
  stableStringify({
    snapshot: cloneSnapshotData(snapshot),
    dados: clonePrintableData(dados),
  })

const createBudgetFingerprint = (dados: PrintableProposalProps): string => {
  const clone = clonePrintableData(dados)
  delete clone.budgetId
  return stableStringify(clone)
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

// ClienteContratoPayload is now exported from ./types/contratoTypes

type PrintMode = 'preview' | 'print' | 'download'

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
  // System colour-scheme (light/dark) and derived chart tokens.
  // Extracted into useSystemColorScheme; the hook owns the matchMedia listener
  // and sets data-theme / colorScheme on documentElement.
  const { theme, chartTheme } = useSystemColorScheme()
  // Stable primitive derived from the Stack Auth user identity.
  // Using user.id (string | null) instead of the user object avoids re-running
  // the bootstrap effect when the SDK replaces the user object reference during
  // internal token refreshes or polling cycles (same user, new object identity).
  const userId = user?.id ?? null
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
  // NOTE: kcKwhMes must be declared here — before effects that use it in their
  // dependency arrays. Declaring it any later causes a Temporal Dead Zone (TDZ)
  // crash in production builds.
  const [kcKwhMes, setKcKwhMesState] = useState(INITIAL_VALUES.kcKwhMes)
  const vendasConfig = useVendasConfigStore(vendasConfigSelectors.config)
  const updateVendasConfig = useVendasConfigStore((state) => state.update)

  const [propostaImagens, setPropostaImagens] = useState<PrintableProposalImage[]>([])
  const lastSavedSignatureRef = useRef<string | null>(null)
  const userInteractedSinceSaveRef = useRef(false)
  const computeSignatureRef = useRef<() => string>(() => '')
  const initialSignatureSetRef = useRef(false)
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
  // Modal prompts: save-decision + confirm dialog.
  // Extracted into useModalPrompts; same API as before.
  const {
    saveDecisionPrompt,
    requestSaveDecision,
    resolveSaveDecisionPrompt,
    confirmDialog,
    requestConfirmDialog,
    resolveConfirmDialog,
  } = useModalPrompts()

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
  const budgetUploadInputId = useId()
  const budgetTableContentId = useId()
  const tusdOptionsTitleId = useId()
  const tusdOptionsToggleId = useId()
  const tusdOptionsContentId = useId()
  const configuracaoUsinaObservacoesBaseId = useId()
  const imagensUploadInputRef = useRef<HTMLInputElement | null>(null)
  const moduleQuantityInputRef = useRef<HTMLInputElement | null>(null)
  const inverterModelInputRef = useRef<HTMLInputElement | null>(null)
  const editableContentRef = useRef<HTMLDivElement | null>(null)
  const leasingHomologacaoInputId = useId()
  const mesReferenciaRef = useRef(new Date().getMonth() + 1)

  // ── Cluster B: Admin settings draft state ──────────────────────────────────
  const {
    settingsTab, setSettingsTab,
    aprovadoresText, setAprovadoresText,
    impostosOverridesDraft, setImpostosOverridesDraft,
    arredondarPasso,
    aprovadoresResumo,
  } = useAdminSettingsDraft({ vendasConfig })

  // ANEEL/tariff raw state — declared here (before controller) so tarifaCheia
  // is available for the proposal snapshot orchestration inside the controller.
  // The effects, wrapper setters, and derived memos are managed by
  // useAneelTarifaState called after distribuidoraAneelEfetiva is computed.
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
  const [tarifaCheia, setTarifaCheiaState] = useState(INITIAL_VALUES.tarifaCheia)
  const [desconto, setDesconto] = useState(INITIAL_VALUES.desconto)
  const [taxaMinima, setTaxaMinimaState] = useState(INITIAL_VALUES.taxaMinima)
  const [taxaMinimaInputEmpty, setTaxaMinimaInputEmpty] = useState(() => false)
  const [encargosFixosExtras, setEncargosFixosExtras] = useState(
    INITIAL_VALUES.encargosFixosExtras,
  )

  const [consumoManual, setConsumoManualState] = useState(false)
  const [potenciaFonteManual, setPotenciaFonteManualState] = useState(false)

  const [ucGeradoraTitularPanelOpen, setUcGeradoraTitularPanelOpen] = useState(false)
  const [ucGeradoraTitularErrors, setUcGeradoraTitularErrors] =
    useState<UcGeradoraTitularErrors>({})
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
  const renameVendasSimulacao = useVendasSimulacoesStore((state) => state.rename)
  const consumoAnteriorRef = useRef(kcKwhMes)

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

  // ── Notification state ─────────────────────────────────────────────────────
  const { notificacoes, adicionarNotificacao, removerNotificacao, clearNotificacoes } = useNotificacoes()

  const crmState = useCrm({ adicionarNotificacao })
  const {
    crmDataset,
  } = crmState

  // ── State and refs that live in App.tsx but feed into / depend on the controller ──

  const leasingContrato = useLeasingStore((state) => state.contrato)
  const budgetIdMismatchLoggedRef = useRef(false)
  /** Timestamp (ms) of the last budget-id-mismatch warn log. Used to throttle spam. */
  const budgetIdMismatchWarnedAtRef = useRef(0)
  const novaPropostaEmAndamentoRef = useRef(false)
  // Refs to prevent stale closures in getCurrentSnapshot
  const kcKwhMesRef = useRef(kcKwhMes)
  const pageSharedStateRef = useRef(pageSharedState)
  // ucsBeneficiarias is declared before the controller so it can be passed as a param
  const [ucsBeneficiarias, setUcsBeneficiarias] = useState<UcBeneficiariaFormState[]>([])
  const {
    // Late-binding refs (App.tsx assigns .current after declaring their targets)
    runWithUnsavedChangesGuardRef,
    applyDraftRef,
    autoFillVendaFromBudgetRef,
    procuracaoUfRef,
    distribuidoraAneelEfetivaRef,
    // Navigation
    activePage,
    setActivePage,
    activeTab,
    setActiveTab,
    activeTabRef,
    simulacoesSection,
    pendingFinancialProjectId,
    setPendingFinancialProjectId,
    lastPrimaryPageRef,
    isSidebarCollapsed,
    isSidebarMobileOpen,
    isMobileViewport,
    handleSidebarMenuToggle,
    handleSidebarNavigate,
    handleSidebarClose,
    activeSidebarItem,
    abrirDashboard,
    abrirCarteira,
    abrirCrmCentral,
    abrirGestaoFinanceira,
    abrirSimulacoes,
    abrirDashboardOperacional,
    // TUSD
    tusdPercent, setTusdPercent,
    tusdTipoCliente, setTusdTipoCliente,
    tusdSubtipo, setTusdSubtipo,
    tusdSimultaneidade, setTusdSimultaneidade,
    setTusdSimultaneidadeManualOverride,
    tusdTarifaRkwh, setTusdTarifaRkwh,
    tusdAnoReferencia, setTusdAnoReferencia,
    tusdOpcoesExpandidas, setTusdOpcoesExpandidas,
    setTusdSimultaneidadeFromSource,
    // Leasing / venda simulation
    leasingPrazo, setLeasingPrazo,
    precoPorKwp, setPrecoPorKwp,
    irradiacao, setIrradiacao,
    eficiencia, setEficiencia,
    diasMes, setDiasMes,
    inflacaoAa, setInflacaoAa,
    vendaForm, setVendaForm,
    vendaFormErrors, setVendaFormErrors,
    retornoProjetado, setRetornoProjetado,
    retornoStatus, setRetornoStatus,
    retornoError, setRetornoError,
    recalcularTick, setRecalcularTick,
    valorTotalPropostaNormalizado,
    resetRetorno,
    applyVendaUpdates,
    // Budget upload
    budgetIdRef,
    budgetIdTransitionRef,
    currentBudgetId, setCurrentBudgetId,
    budgetStructuredItems, setBudgetStructuredItems,
    budgetUploadInputRef,
    kitBudget, setKitBudget,
    isBudgetProcessing, setIsBudgetProcessing,
    budgetProcessingError, setBudgetProcessingError,
    budgetProcessingProgress, setBudgetProcessingProgress,
    ocrDpi, setOcrDpi,
    isBudgetTableCollapsed, setIsBudgetTableCollapsed,
    modoOrcamento, setModoOrcamento,
    autoKitValor, setAutoKitValor,
    autoCustoFinal, setAutoCustoFinal,
    autoPricingRede, setAutoPricingRede,
    autoPricingVersion, setAutoPricingVersion,
    autoBudgetReasonCode, setAutoBudgetReasonCode,
    autoBudgetReason, setAutoBudgetReason,
    isManualBudgetForced,
    manualBudgetForceReason,
    valorOrcamentoConsiderado,
    budgetMissingSummary,
    kitBudgetTotal,
    getActiveBudgetId,
    switchBudgetId,
    handleModoOrcamentoChange,
    updateKitBudgetItem,
    handleBudgetItemTextChange: _handleBudgetItemTextChange,
    handleBudgetItemQuantityChange: _handleBudgetItemQuantityChange,
    handleRemoveBudgetItem,
    handleAddBudgetItem,
    handleBudgetTotalValueChange,
    handleBudgetFileChange,
    handleMissingInfoManualEdit,
    handleMissingInfoUploadClick,
    // Storage hydration
    isHydratingRef,
    setIsHydrating,
    // Client state
    cliente,
    clientesSalvos, setClientesSalvos,
    clientsSyncState, setClientsSyncState,
    clientsSource,
    clientsLastLoadError,
    clientsLastDeleteError, setClientsLastDeleteError,
    lastSuccessfulApiLoadAt,
    lastDeleteReconciledAt, setLastDeleteReconciledAt,
    allConsultores,
    formConsultores,
    clienteEmEdicaoId, setClienteEmEdicaoId,
    originalClientData, setOriginalClientData,
    clientLastSaveStatus, setClientLastSaveStatus,
    clienteMensagens, setClienteMensagens,
    clienteRef,
    clienteEmEdicaoIdRef,
    lastSavedClienteRef,
    clientAutoSaveTimeoutRef,
    deletingClientIdsRef,
    deletedClientKeysRef,
    clientServerIdMapRef,
    clientServerAutoSaveInFlightRef,
    clientLastPayloadSignatureRef,
    consultantBackfillRanRef,
    myConsultorDefaultRef,
    updateClientServerIdMap,
    removeClientServerIdMapEntry,
    setClienteSync,
    updateClienteSync,
    carregarClientesSalvos,
    getClientStableKey,
    persistDeletedClientKeys,
    carregarClientesPrioritarios,
    // Proposal orchestration
    orcamentosSalvos,
    setOrcamentosSalvos,
    proposalsSyncState,
    orcamentoAtivoInfo,
    orcamentoRegistroBase,
    orcamentoDisponivelParaDuplicar,
    limparOrcamentoAtivo,
    atualizarOrcamentoAtivo,
    updateProposalServerIdMap,
    carregarOrcamentosPrioritarios,
    carregarOrcamentoParaEdicao,
    salvarOrcamentoLocalmente,
    removerOrcamentoSalvo,
    abrirPesquisaOrcamentos,
    getCurrentSnapshotRef,
    aplicarSnapshotRef,
    proposalServerIdMapRef,
  } = useSolarInvestAppController({
    // Navigation flags
    canSeePortfolioEffective,
    canSeeFinancialManagementEffective,
    canSeeDashboardEffective,
    canSeeFinancialAnalysisEffective,
    // Auth / user
    userId,
    getAccessToken,
    meAuthState,
    user,
    me,
    isAdmin,
    isOffice,
    isFinanceiro,
    adicionarNotificacao,
    // Budget upload
    renameVendasSimulacao,
    tipoInstalacao,
    tipoSistema,
    moduleQuantityInputRef,
    inverterModelInputRef,
    // Proposal orchestration
    scheduleMarkStateAsSaved,
    cloneSnapshotData,
    computeSnapshotSignature,
    createBudgetFingerprint,
    kcKwhMes,
    tarifaCheia,
    potenciaModulo,
    numeroModulosManual,
    ucsBeneficiarias,
  })

  // ── Cluster A: Display preferences ────────────────────────────────────────
  const {
    useBentoGridPdf, setUseBentoGridPdf,
    density, setDensity,
    mobileSimpleView, setMobileSimpleView,
    desktopSimpleView, setDesktopSimpleView,
    isMobileSimpleEnabled,
    isDesktopSimpleEnabled,
    shouldHideSimpleViewItems,
  } = useDisplayPreferences({ isMobileViewport })

  // ──────────────────────────────────────────────────────────────────────────

  // ── Code that depends on controller results ───────────────────────────────
  // (Previously placed between individual hook calls; now grouped here where
  //  all hook results are guaranteed to be in scope.)

  const isVendaDiretaTab = activeTab === 'vendas'
  useEffect(() => {
    const modo: ModoVenda = isVendaDiretaTab ? 'direta' : 'leasing'
    vendaActions.updateResumoProposta({ modo_venda: modo })
  }, [isVendaDiretaTab])

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

  const vendasSimulacao = useVendasSimulacoesStore((state) => state.simulations[currentBudgetId])
  const initializeVendasSimulacao = useVendasSimulacoesStore((state) => state.initialize)
  const updateVendasSimulacao = useVendasSimulacoesStore((state) => state.update)

  const { handleAbrirUploadImagens, handleImagensSelecionadas, handleRemoverPropostaImagem } =
    useProposalImageActions({ imagensUploadInputRef, setPropostaImagens })

  // Initializes the vendas simulation entry for the active budget. Kept in
  // App.tsx because it bridges the vendasSimulacao store (separate from the
  // budget-upload hook) with currentBudgetId from the controller.
  useEffect(() => {
    initializeVendasSimulacao(currentBudgetId)
  }, [currentBudgetId, initializeVendasSimulacao])

  const capexBaseManualValorRaw = vendasSimulacao?.capexBaseManual
  const capexBaseManualValor =
    typeof capexBaseManualValorRaw === 'number' && Number.isFinite(capexBaseManualValorRaw)
      ? Math.max(0, capexBaseManualValorRaw)
      : undefined

  const margemManualValorRaw = vendasSimulacao?.margemManualValor
  const margemManualAtiva =
    typeof margemManualValorRaw === 'number' && Number.isFinite(margemManualValorRaw)
  const margemManualValor = margemManualAtiva ? Number(margemManualValorRaw) : undefined
  const descontosValor = Math.max(0, vendasSimulacao?.descontos ?? 0)

  const lastUfSelecionadaRef = useRef<string>(cliente.uf)
  const corresponsavelAtivo = useMemo(() => {
    const corresponsavel = leasingContrato.corresponsavel
    if (!leasingContrato.temCorresponsavelFinanceiro || !corresponsavel) {
      return false
    }
    return Boolean(corresponsavel.nome?.trim() && corresponsavel.cpf?.trim())
  }, [leasingContrato.corresponsavel, leasingContrato.temCorresponsavelFinanceiro])

  const clienteUf = cliente.uf
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
  useEffect(() => { distribuidoraAneelEfetivaRef.current = distribuidoraAneelEfetiva }, [distribuidoraAneelEfetiva])

  // ── Cluster C: ANEEL tariff state manager ──────────────────────────────────
  // Raw useState lives above (before controller) so tarifaCheia is available
  // for proposal orchestration. This hook manages effects, wrapper setters, and
  // derived memos — calling it here after distribuidoraAneelEfetiva is in scope.
  const {
    setTarifaCheia,
    setTaxaMinima,
    setUfTarifa,
    setDistribuidoraTarifa,
    normalizeTaxaMinimaInputValue,
    distribuidorasDisponiveis,
    clienteDistribuidorasDisponiveis,
  } = useAneelTarifaState({
    ufTarifa,
    distribuidoraTarifa,
    distribuidorasPorUf,
    tarifaCheia,
    taxaMinima,
    setUfTarifaState,
    setDistribuidoraTarifaState,
    setUfsDisponiveis,
    setDistribuidorasPorUf,
    setMesReajuste,
    setTarifaCheiaState,
    setTaxaMinimaState,
    setTaxaMinimaInputEmpty,
    distribuidoraAneelEfetiva,
    clienteUf,
    updatePageSharedState,
  })

  // IBGE municipality state, city-search dropdown, and derived city lists.
  // Extracted into useIbgeMunicipios; cidadeBloqueadaPorCep is owned by the hook
  // and its setter is exposed so the CEP lookup effects (below) can update it.
  const clienteUfNormalizada = clienteUf.trim().toUpperCase()
  const {
    cidadeBloqueadaPorCep,
    setCidadeBloqueadaPorCep,
    cidadeSearchTerm,
    setCidadeSearchTerm,
    cidadeSelectOpen,
    setCidadeSelectOpen,
    cidadesCarregando,
    cidadesFiltradas,
    cidadeManualDigitada,
    cidadeManualDisponivel,
    ensureIbgeMunicipios,
  } = useIbgeMunicipios({
    clienteUfNormalizada,
    setUfsDisponiveis,
  })

  const {
    multiUcAtivo, setMultiUcAtivo,
    multiUcRows, setMultiUcRows,
    multiUcRateioModo, setMultiUcRateioModo,
    multiUcEnergiaGeradaKWh, setMultiUcEnergiaGeradaKWhState,
    multiUcEnergiaGeradaTouched, setMultiUcEnergiaGeradaTouched,
    multiUcAnoVigencia, setMultiUcAnoVigencia,
    multiUcOverrideEscalonamento, setMultiUcOverrideEscalonamento,
    multiUcEscalonamentoCustomPercent, setMultiUcEscalonamentoCustomPercent,
    multiUcEscalonamentoPadrao,
    multiUcConsumoAnteriorRef, multiUcIdCounterRef,
    multiUcRateioPercentualTotal,
    multiUcRateioManualTotal,
    multiUcEscalonamentoPercentual,
    multiUcEscalonamentoTabela,
    multiUcResultado,
    multiUcResultadoPorId,
    multiUcWarnings,
    multiUcErrors,
    multiUcPrintableResumo,
    applyTarifasAutomaticas,
    setMultiUcEnergiaGeradaKWh,
    handleMultiUcClasseChange,
    handleMultiUcConsumoChange,
    handleMultiUcRateioPercentualChange,
    handleMultiUcManualRateioChange,
    handleMultiUcTeChange,
    handleMultiUcTusdTotalChange,
    handleMultiUcTusdFioBChange,
    handleMultiUcObservacoesChange,
    handleMultiUcAdicionar,
    handleMultiUcRemover,
    handleMultiUcQuantidadeChange,
    handleMultiUcRecarregarTarifas,
    handleMultiUcRateioModoChange,
  } = useMultiUcState({ distribuidoraAneelEfetiva, kcKwhMes, setKcKwhMes })
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
  useEffect(() => { procuracaoUfRef.current = procuracaoUf ?? null }, [procuracaoUf])
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
  const {
    // state
    isImportandoClientes,
    isGerandoBackupBanco,
    isBackupModalOpen,
    setIsBackupModalOpen,
    bulkImportPreviewRows,
    setBulkImportPreviewRows,
    isBulkImportPreviewOpen,
    setIsBulkImportPreviewOpen,
    bulkImportAutoMerge,
    setBulkImportAutoMerge,
    isBulkImportConfirming,
    // refs
    pendingImportRawRowsRef,
    clientesImportInputRef,
    backupImportInputRef,
    // handlers
    downloadClientesArquivo,
    buildClientesFileName,
    handleExportarClientesJson,
    handleExportarClientesCsv,
    handleClientesImportarClick,
    handleBackupUploadArquivo,
    handleBackupBancoDados,
    handleBackupModalUpload,
    handleBackupModalDownload,
    handleClientesImportarArquivo,
    handleBulkImportConfirm,
    handleBulkImportRowSelection,
    handleBulkImportRowAction,
    handleBulkImportSelectAllValid,
    handleBulkImportSelectAll,
    handleBulkImportClearSelection,
    handleBulkImportClose,
  } = useClientImportExport({
    adicionarNotificacao,
    carregarClientesPrioritarios,
    carregarClientesSalvos,
    setClientesSalvos,
    getAccessToken,
    normalizeClienteRegistros,
  })
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
  const [capexManualOverride, setCapexManualOverride] = useState(
    INITIAL_VALUES.capexManualOverride,
  )
  const [parsedVendaPdf, setParsedVendaPdf] = useState<ParsedVendaPdfData | null>(null)
  const [estruturaTipoWarning, setEstruturaTipoWarning] =
    useState<EstruturaUtilizadaTipoWarning | null>(null)

  const budgetTotalField = useBRNumberField({
    mode: 'money',
    value: kitBudget.total ?? null,
    onChange: handleBudgetTotalValueChange,
  })

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

  const {
    precheckClienteCiente,
    setPrecheckClienteCiente,
    precheckModalData,
    setPrecheckModalData,
    precheckModalClienteCiente,
    setPrecheckModalClienteCiente,
    isPrecheckObservationTextValid,
    buildPrecheckObservationBlock,
    upsertPrecheckObservation,
    removePrecheckObservation,
    requestPrecheckDecision,
    resolvePrecheckDecision,
  } = usePrecheckNormativo({ setConfiguracaoUsinaObservacoes })

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
        updateTusdTipoCliente(SEGMENTO_TO_TUSD[novoValor])
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
            const numeric = potenciaMatch[1]!.replace(/\D+/g, '')
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
  autoFillVendaFromBudgetRef.current = autoFillVendaFromBudget

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

  const {
    jurosFinAa,
    setJurosFinAa,
    prazoFinMeses,
    setPrazoFinMeses,
    entradaFinPct,
    setEntradaFinPct,
    mostrarFinanciamento,
    setMostrarFinanciamento,
    mostrarGrafico,
    setMostrarGrafico,
    prazoMeses,
    setPrazoMeses,
    bandeiraEncargo,
    setBandeiraEncargo,
    cipEncargo,
    setCipEncargo,
    entradaRs,
    setEntradaRs,
    entradaModo,
    setEntradaModo,
    mostrarValorMercadoLeasing,
    setMostrarValorMercadoLeasing,
    mostrarTabelaParcelas,
    setMostrarTabelaParcelas,
    mostrarTabelaBuyout,
    setMostrarTabelaBuyout,
    gerandoTabelaTransferencia,
    setGerandoTabelaTransferencia,
    mostrarTabelaParcelasConfig,
    setMostrarTabelaParcelasConfig,
    mostrarTabelaBuyoutConfig,
    setMostrarTabelaBuyoutConfig,
  } = useLeasingFinanciamentoState()

  // Late-bound ref for prepararDadosContratoCliente — assigned below after the
  // callback is declared (same TDZ-safe pattern used by applyVendaUpdatesRef).
  const prepararDadosRef = useRef<(() => ClienteContratoPayload | null) | null>(null)

  // ── Cluster D: Contract modal state ─────────────────────────────────────────
  const {
    gerandoContratos, setGerandoContratos,
    isContractTemplatesModalOpen, setIsContractTemplatesModalOpen,
    isLeasingContractsModalOpen, setIsLeasingContractsModalOpen,
    clientReadinessErrors, setClientReadinessErrors,
    leasingAnexosSelecionados, setLeasingAnexosSelecionados,
    leasingAnexosAvailability,
    leasingAnexosLoading,
    contractTemplatesCategory,
    contractTemplates,
    selectedContractTemplates,
    contractTemplatesLoading,
    contractTemplatesError,
    contratoClientePayloadRef,
    carregarDisponibilidadeAnexos,
    handleToggleContractTemplate,
    handleSelectAllContractTemplates,
    handleToggleLeasingAnexo,
    handleSelectAllLeasingAnexos,
    handleFecharModalContratos,
    handleFecharLeasingContractsModal,
    abrirSelecaoContratos,
  } = useContractModalState({
    tipoContrato: leasingContrato.tipoContrato,
    corresponsavelAtivo,
    clienteUf,
    adicionarNotificacao,
    prepararDadosRef,
  })

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
      setModoOrcamento('manual')
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

  // ---------------------------------------------------------------------------
  // Financial Analysis hook — owns all af* state, aprovação, and derived memos
  // ---------------------------------------------------------------------------
  const {
    // aprovação
    aprovacaoChecklist,
    ultimaDecisaoTimestamp,
    toggleAprovacaoChecklist,
    registrarDecisaoInterna,
    // af* state
    afModo, setAfModo,
    afCustoKit, setAfCustoKit,
    setAfCustoKitManual,
    afFrete, setAfFrete,
    setAfFreteManual,
    afDescarregamento, setAfDescarregamento,
    afHotelPousada, setAfHotelPousada,
    afTransporteCombustivel, setAfTransporteCombustivel,
    afOutros, setAfOutros,
    afCidadeDestino, setAfCidadeDestino,
    afDeslocamentoKm, setAfDeslocamentoKm,
    afDeslocamentoRs, setAfDeslocamentoRs,
    afDeslocamentoStatus, setAfDeslocamentoStatus,
    afDeslocamentoCidadeLabel, setAfDeslocamentoCidadeLabel,
    afDeslocamentoErro, setAfDeslocamentoErro,
    afValorContrato, setAfValorContrato,
    afImpostosVenda, setAfImpostosVenda,
    afImpostosLeasing, setAfImpostosLeasing,
    afInadimplencia, setAfInadimplencia,
    afCustoOperacional, setAfCustoOperacional,
    afMesesProjecao, setAfMesesProjecao,
    afMensalidadeBase, setAfMensalidadeBase,
    afMensalidadeBaseAuto,
    afMargemLiquidaVenda, setAfMargemLiquidaVenda,
    afMargemLiquidaMinima, setAfMargemLiquidaMinima,
    afComissaoMinimaPercent, setAfComissaoMinimaPercent,
    afTaxaDesconto, setAfTaxaDesconto,
    afConsumoOverride, setAfConsumoOverride,
    afIrradiacaoOverride, setAfIrradiacaoOverride,
    afPROverride, setAfPROverride,
    afDiasOverride, setAfDiasOverride,
    afModuloWpOverride, setAfModuloWpOverride,
    afNumModulosOverride, setAfNumModulosOverride,
    afPlaca, setAfPlaca,
    afAutoMaterialCA, setAfAutoMaterialCA,
    afMaterialCAOverride, setAfMaterialCAOverride,
    afProjetoOverride, setAfProjetoOverride,
    afCreaOverride, setAfCreaOverride,
    afCidadeSuggestions, setAfCidadeSuggestions,
    afCidadeShowSuggestions, setAfCidadeShowSuggestions,
    // refs
    afBaseInitializedRef,
    afCidadeBlurTimerRef,
    // BR number fields
    afCustoKitField,
    afValorContratoField,
    afFreteField,
    afDescarregamentoField,
    afPlacaField,
    afHotelPousadaField,
    afTransporteCombustivelField,
    afOutrosField,
    afMensalidadeBaseField,
    afMaterialCAField,
    afProjetoField,
    afCreaField,
    // callbacks
    handleSelectCidade,
    // aprovação status
    aprovacaoStatus,
    // derived memos
    analiseFinanceiraResult,
    indicadorEficienciaProjeto,
  } = useAnaliseFinanceiraState({
    kcKwhMes,
    simulacoesSection,
    vendasConfig,
    baseIrradiacao,
    eficienciaNormalizada,
    diasMesNormalizado,
    potenciaModulo,
    ufTarifa,
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
    vendaFormAplicaTaxaMinima: vendaForm.aplica_taxa_minima,
    encargosFixos,
    cidKwhBase,
  })

  const modoEntradaNormalizado = useMemo<EntradaModo>(() => {
    if (!entradaConsiderada || entradaConsiderada <= 0) return 'NONE'
    const label = (entradaModo ?? '').toLowerCase().trim()
    if (label.includes('crédito')) return 'CREDITO'
    if (label.includes('reduz')) return 'REDUZ'
    return 'NONE'
  }, [entradaConsiderada, entradaModo])

  const composicaoTelhadoCalculo = useMemo(() => {
    const input: ComposicaoUFVInputs = {
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

    const input: ComposicaoUFVInputs = {
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
      const mensalidade = mensalidades[index]!
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
      totalPago: lista.length > 0 ? lista[lista.length - 1]!.totalAcumulado : 0,
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
  const buyoutAceiteFinal = tabelaBuyout.find((row) => row.mes === buyoutMesAceiteFinal)
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
    () => buildPrintableData({
      vendaSnapshot: getVendaSnapshot(),
      cliente,
      currentBudgetId,
      isVendaDiretaTab,
      potenciaInstaladaKwp,
      geracaoMensalKwh,
      numeroModulosEstimado,
      potenciaModulo,
      tipoSistema,
      tipoRede,
      segmentoCliente,
      tipoInstalacao,
      tipoInstalacaoOutro,
      tipoEdificacaoOutro,
      tusdTipoCliente,
      tusdSubtipo,
      areaInstalacao,
      capex,
      descontoConsiderado,
      kcKwhMes,
      tarifaCheia,
      distribuidoraAneelEfetiva,
      valorOrcamentoConsiderado,
      valorVendaTelhado,
      valorVendaSolo,
      margemManualAtiva,
      margemManualValor,
      descontosValor,
      arredondarPasso,
      valorTotalPropostaNormalizado,
      valorTotalPropostaState,
      custoImplantacaoReferencia,
      parcelasSolarInvest,
      leasingPrazoConsiderado,
      leasingValorDeMercadoEstimado,
      mostrarValorMercadoLeasing,
      inflacaoAa,
      leasingContrato,
      leasingROI,
      financiamentoFluxo,
      financiamentoROI,
      mostrarFinanciamento,
      tabelaBuyout,
      buyoutResumo,
      composicaoTelhado,
      composicaoSolo,
      composicaoTelhadoTotal,
      composicaoSoloTotal,
      composicaoTelhadoCalculo,
      composicaoSoloCalculo,
      vendasConfig,
      vendaForm,
      vendaRetornoAuto,
      parsedVendaPdf,
      multiUcPrintableResumo,
      ucsBeneficiarias,
      budgetStructuredItems,
      propostaImagens,
      configuracaoUsinaObservacoes,
      modoOrcamento,
      autoCustoFinal,
      anosArray,
    }),
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

  const {
    isEnviarPropostaModalOpen,
    setIsEnviarPropostaModalOpen,
    contatoEnvioSelecionadoId,
    contatosEnvio,
    contatoEnvioSelecionado,
    selecionarContatoEnvio,
    fecharEnvioPropostaModal,
  } = usePropostaEnvioModal({ cliente, clientesSalvos, crmLeads: crmDataset.leads })

  // Note: a proactive global notification used to be raised here every 15 days
  // when the PDF integration was missing. It surfaced as an out-of-context
  // error toast on app load. The same message is already shown contextually
  // (a) inside the proposal preview toolbar via `resolvePreviewToolbarMessage`
  // and (b) at the moment the user actually attempts to save a PDF
  // (see the `persistProposalPdf` call sites). The proactive effect has been
  // removed to avoid the misplaced notification.

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
  getCurrentSnapshotRef.current = getCurrentSnapshot

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
        return result as ClienteRegistro
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

    if (!validateClienteParaSalvar(options?.silent !== undefined ? { silent: options.silent } : {})) {
      console.warn('[client-save] client mutation blocked by validation', {
        clientId: clienteEmEdicaoId ?? null,
        nome: Boolean(cliente.nome?.trim()),
        documento: Boolean(cliente.documento?.trim()),
        cep: Boolean(cliente.cep?.trim()),
      })
      return false
    }

    // Cancel any pending auto-save and wait for any in-flight auto-save to
    // complete before dispatching the manual save.  This prevents the race
    // condition where both writes reach the server simultaneously and the
    // name-based deduplication check passes for both (the first INSERT hasn't
    // committed yet when the second transaction reads), resulting in two
    // identical client rows being created.
    if (clientAutoSaveTimeoutRef.current) {
      clearTimeout(clientAutoSaveTimeoutRef.current)
      clientAutoSaveTimeoutRef.current = null
    }
    if (clientServerAutoSaveInFlightRef.current) {
      // Poll until the in-flight auto-save settles (max 3 s to avoid blocking indefinitely).
      await new Promise<void>((resolve) => {
        const deadline = Date.now() + 3000
        const poll = () => {
          if (!clientServerAutoSaveInFlightRef.current || Date.now() >= deadline) {
            resolve()
          } else {
            setTimeout(poll, 50)
          }
        }
        poll()
      })
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
        ? (Number(leasingSnap.projecao.mensalidadesAno[0]?.mensalidade ?? 0) || null)
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

  // ── Print orchestration hook ──────────────────────────────────────────────
  // Owns: printableRef, pendingPreviewDataRef, prepararPropostaParaExportacao,
  //       handlePrint, handlePreviewActionRequest, window.__solarinvestOnPreviewAction
  const _printOrch = usePrintOrchestration({
    printableData,
    isVendaDiretaTab,
    activeTab,
    clienteEmEdicaoId,
    useBentoGridPdf,
    callbacks: {
      validatePropostaLeasingMinimal: () => validatePropostaLeasingMinimal(),
      confirmarAlertasGerarProposta: () => confirmarAlertasGerarProposta(),
      ensureNormativePrecheck: () => ensureNormativePrecheck(),
      handleSalvarCliente: (opts) => handleSalvarCliente(opts),
      openBudgetPreviewWindow: (html, opts) => openBudgetPreviewWindow(html, opts),
      salvarOrcamentoLocalmente: (dados) => salvarOrcamentoLocalmente(dados),
      switchBudgetId: (id) => switchBudgetId(id),
      getActiveBudgetId: () => getActiveBudgetId(),
      atualizarOrcamentoAtivo: (r) => atualizarOrcamentoAtivo(r),
      adicionarNotificacao: (msg, type) => adicionarNotificacao(msg, type),
      setProposalPdfIntegrationAvailable: (v) => setProposalPdfIntegrationAvailable(v),
    },
  })
  const printableRef = _printOrch.printableRef
  const prepararPropostaParaExportacao = (...args: Parameters<typeof _printOrch.prepararPropostaParaExportacao>) => _printOrch.prepararPropostaParaExportacao(...args)
  const handlePrint = () => _printOrch.handlePrint()
  const clearPendingPreview = () => _printOrch.clearPendingPreview()

  // Late-bound ref so useProposalListActions can call hasUnsavedChanges (declared later)
  const hasUnsavedChangesRef = useRef<() => boolean>(() => false)

  const {
    salvandoPropostaLeasing,
    setSalvandoPropostaLeasing,
    salvandoPropostaPdf,
    setSalvandoPropostaPdf,
    handleSalvarPropostaLeasing,
    handleSalvarPropostaPdf,
  } = useProposalSaveActions({
    isVendaDiretaTab,
    activeTab,
    useBentoGridPdf,
    validatePropostaLeasingMinimal,
    ensureNormativePrecheck,
    coletarAlertasProposta,
    handleSalvarCliente,
    prepararPropostaParaExportacao,
    salvarOrcamentoLocalmente,
    atualizarOrcamentoAtivo,
    switchBudgetId,
    scheduleMarkStateAsSaved,
    requestSaveDecision,
    adicionarNotificacao,
    isProposalPdfIntegrationAvailable,
    setProposalPdfIntegrationAvailable,
    proposalServerIdMapRef,
  })

  const { abrirOrcamentoSalvo, confirmarRemocaoOrcamento, carregarOrcamentoSalvo } =
    useProposalListActions({
      useBentoGridPdf,
      printableDataTipoProposta: printableData.tipoProposta,
      leasingPrazo,
      removerOrcamentoSalvo,
      carregarOrcamentoParaEdicao,
      carregarOrcamentosPrioritarios,
      requestConfirmDialog,
      requestSaveDecision,
      hasUnsavedChangesRef,
      handleSalvarPropostaPdf,
      computeSnapshotSignature,
      computeSignatureRef,
      openBudgetPreviewWindow,
    })

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
            'info',
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
        snapshot: (registro.propostaSnapshot ?? {}) as Parameters<typeof validateProposalReadinessForClosing>[0]['snapshot'],
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
          } as Parameters<typeof convertClientToClosedDeal>[0]['clienteDados'],
          snapshot: (registro.propostaSnapshot ?? {}) as Parameters<typeof convertClientToClosedDeal>[0]['snapshot'],
          consultants: formConsultores as ConsultantForResolution[],
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

    snapshot.pageShared = {
      ...snapshot.pageShared,

      tipoInstalacao: normalizeTipoInstalacao(snapshot.pageShared.tipoInstalacao),

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
  aplicarSnapshotRef.current = aplicarSnapshot
  // Keep the hook's draft-apply ref in sync with the current function on every render.
  // This is safe in the render body (no side-effects) and ensures the async
  // IndexedDB loader in useStorageHydration always calls the latest closure.
  applyDraftRef.current = aplicarSnapshot as (data: unknown) => void

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

      clearPendingPreview()

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
  // Wire the late-bound ref so useContractModalState can call prepararDados without TDZ
  prepararDadosRef.current = prepararDadosContratoCliente

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

    const salvarContratoNoOneDrive = useCallback(
    async (fileName: string, blob: Blob, contentType?: string) => {
      try {
        const base64 = await readBlobAsBase64(blob)
        await persistContratoToOneDrive({
          fileName,
          contentBase64: base64,
          ...(contentType !== undefined ? { contentType } : {}),
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

          const janelaAtual = janelaPreview as Window | null
          if (!janelaAtual || janelaAtual.closed) {
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
          const janelaAtualCatch = janelaPreview as Window | null
          if (janelaAtualCatch && !janelaAtualCatch.closed) {
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

      const janelaFinal = janelaPreview as Window | null
      if (contratosGerados.length > 0 && janelaFinal && !janelaFinal.closed) {
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

  const hasUnsavedChanges = useCallback(() => {
    if (!userInteractedSinceSaveRef.current) {
      return false
    }

    if (lastSavedSignatureRef.current == null) {
      return initialSignatureSetRef.current
    }

    return computeSignatureRef.current() !== lastSavedSignatureRef.current
  }, [])
  hasUnsavedChangesRef.current = hasUnsavedChanges

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
  // Keep the nav-hook's guardRef in sync so navigation callbacks always call the
  // latest version of this guard (follows the applyDraftRef pattern).
  runWithUnsavedChangesGuardRef.current = runWithUnsavedChangesGuard

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
      // Explicitly reset the external stores so that getVendaSnapshot() and
      // getLeasingSnapshot() return clean initial state when createEmptySnapshot
      // is called below (inside buildEmptySnapshotForNewProposal).
      vendaStore.reset()
      leasingActions.reset()
      setSettingsTab(INITIAL_VALUES.settingsTab)
      setActivePage('app')
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
      clearNotificacoes()
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

      // Scroll to top so the user can see the cleared form.
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Notify the user that the reset completed successfully.
      adicionarNotificacao('Nova proposta iniciada.', 'info')

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
    adicionarNotificacao,
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

  const { handleNavigateToProposalTab } = useSimuladorTabActions({
    activeTabRef,
    runWithUnsavedChangesGuard,
    iniciarNovaProposta,
    setActiveTab,
  })

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
        proximaDistribuidora = listaDistribuidoras[0]!
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
    (patch: Omit<Partial<LeasingUcGeradoraTitular>, 'endereco'> & { endereco?: Partial<LeasingEndereco> }) => {
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

  const {
    buscandoCep,
    verificandoCidade,
    ucGeradoraTitularBuscandoCep,
    ucGeradoraTitularCepMessage,
    ucGeradoraCidadeBloqueadaPorCep,
    isApplyingCepRef,
    isEditingEnderecoRef,
    lastCepAppliedRef,
    isApplyingUcGeradoraCepRef,
    lastUcGeradoraCepAppliedRef,
    cepCidadeAvisoRef,
  } = useClientAddressLookup({
    cliente,
    clienteRef,
    isHydratingRef,
    distribuidorasPorUf,
    ensureIbgeMunicipios,
    updateClienteSync,
    setClienteMensagens,
    setCidadeBloqueadaPorCep,
    ucGeradoraTitularDraft: leasingContrato.ucGeradoraTitularDraft,
    updateUcGeradoraTitularDraft,
  })

  const handleUcGeradoraTitularUfChange = useCallback(
    (value: string) => {
      const ufNormalizada = value.toUpperCase()
      updateUcGeradoraTitularDraft({ endereco: { uf: ufNormalizada } })
      const listaDistribuidoras = distribuidorasPorUf[ufNormalizada] ?? []
      const atual = leasingContrato.ucGeradoraTitularDistribuidoraAneel
      let proximaDistribuidora = atual
      if (listaDistribuidoras.length === 1) {
        proximaDistribuidora = listaDistribuidoras[0]!
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

  const voltarParaPaginaPrincipal = useCallback(() => {
    setActivePage(lastPrimaryPageRef.current)
  }, [setActivePage])

  const fecharPesquisaOrcamentos = () => {
    voltarParaPaginaPrincipal()
  }

  const budgetCodeDisplay = useMemo(() => {
    return normalizeProposalId(printableData.budgetId) || null
  }, [printableData.budgetId])

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
            ...(shareUrl ? { url: shareUrl } : {}),
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
          <label className="norm-precheck-banner__ack flex items-center gap-3">
            <CheckboxSmall
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
            data-field="cliente-tipoRede"
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
      <TusdParametersSection
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
      />
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


  const renderAutoOrcamentoSection = () => (
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
  )


  const renderBudgetUploadSection = () => (
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
  )


  const renderBudgetKitSection = () => (
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
                {kitBudget.items.map((item) => (
                  <tr key={`budget-item-${item.id}`}>
                    <td>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(event) => {
                          updateKitBudgetItem(item.id, (prev) => ({ ...prev, description: event.target.value }))
                        }}
                        placeholder="Descrição do item"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={item.quantityInput}
                        onChange={(event) => {
                          updateKitBudgetItem(item.id, (prev) => ({ ...prev, quantityInput: event.target.value, quantity: Number(event.target.value) || null }))
                        }}
                        placeholder="Quantidade"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPriceInput}
                        onChange={(event) => {
                          updateKitBudgetItem(item.id, (prev) => ({ ...prev, unitPriceInput: event.target.value, unitPrice: Number(event.target.value) || null }))
                        }}
                        placeholder="Valor unitário"
                      />
                    </td>
                    <td>
                      <input type="text" value={currency((item.quantity ?? 0) * (item.unitPrice ?? 0))} readOnly aria-label="Total do item" />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ghost danger"
                        onClick={() => handleRemoveBudgetItem(item.id)}
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
  const topbarSubtitle = contentSubtitle
  const isSimulacoesMobile = isMobileViewport && activePage === 'simulacoes'
  const mobileTopbarSubtitle = isSimulacoesMobile ? undefined : currentPageIndicator
  const shellTopbarSubtitle = isSimulacoesMobile ? undefined : topbarSubtitle
  const shellContentSubtitle = isSimulacoesMobile ? undefined : contentSubtitle
  const shellPageIndicator = isSimulacoesMobile ? undefined : currentPageIndicator

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
    abrirClientesPainel,
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

  const mobileAllowedIds = [
    ...(canSeeProposalsEffective ? ['propostas-leasing', 'propostas-vendas'] : []),
    ...(canSeeContractsEffective ? ['propostas-contratos'] : []),
    ...(canSeeClientsEffective || canSeeProposalsEffective ? ['orcamentos-importar'] : []),
    ...(canSeeClientsEffective ? ['crm-clientes'] : []),
    ...(canSeePortfolioEffective ? ['carteira-clientes'] : []),
    ...(canSeeFinancialAnalysisEffective ? ['simulacoes-analise'] : []),
    ...(canSeeFinancialManagementEffective ? ['gestao-financeira-home'] : []),
  ]
  const allSidebarItems = new Map(sidebarGroups.flatMap((group) => group.items.map((item) => [item.id, item])))

  const desktopSimpleSidebarGroups: SidebarGroup[] = sidebarGroups.filter(
    (group) => group.id !== 'simulacoes' && group.id !== 'crm',
  )

  const mobileSidebarGroups: SidebarGroup[] = isMobileViewport
    ? [
        {
          id: 'mobile',
          label: '',
          items: mobileAllowedIds.flatMap((id) => {
            const item = allSidebarItems.get(id)
            return item ? [item] : []
          }),
        },
      ]
    : isDesktopSimpleEnabled
    ? desktopSimpleSidebarGroups
    : sidebarGroups

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
            ...(shellTopbarSubtitle !== undefined ? { subtitle: shellTopbarSubtitle } : {}),
            ...(mobileTopbarSubtitle !== undefined ? { mobileSubtitle: mobileTopbarSubtitle } : {}),
          }}
          sidebar={{
            collapsed: isSidebarCollapsed,
            mobileOpen: isSidebarMobileOpen,
            groups: mobileSidebarGroups,
            activeItemId: activeSidebarItem,
            onNavigate: handleSidebarNavigate,
            onCloseMobile: handleSidebarClose,
            ...(isMobileViewport ? {} : { onToggleCollapse: handleSidebarMenuToggle }),
            menuButtonLabel: isMobileViewport
              ? isSidebarMobileOpen
                ? 'Fechar menu Painel SolarInvest'
                : 'Abrir menu Painel SolarInvest'
              : 'Painel SolarInvest',
            menuButtonExpanded: isMobileViewport ? isSidebarMobileOpen : !isSidebarCollapsed,
            menuButtonText: 'Painel SolarInvest',
            ...(user?.displayName
              ? { userInfo: { name: user.displayName, role: userRole } }
              : {}),
          }}
          content={{
            ...(shellContentSubtitle !== undefined ? { subtitle: shellContentSubtitle } : {}),
            ...(contentActions != null ? { actions: contentActions } : {}),
            ...(shellPageIndicator !== undefined ? { pageIndicator: shellPageIndicator } : {}),
            ...(activePage === 'app' ? { className: 'content-wrap--proposal' } : {}),
          }}
          {...(isMobileViewport
            ? {
                mobileMenuButton: {
                  onToggle: handleSidebarMenuToggle,
                  label: isSidebarMobileOpen
                    ? 'Fechar menu Painel SolarInvest'
                    : 'Abrir menu Painel SolarInvest',
                  expanded: isSidebarMobileOpen,
                  ...(user?.displayName
                    ? { userInfo: { name: user.displayName, role: userRole } }
                    : {}),
                },
              }
            : {})}
          theme={appTheme}
          onCycleTheme={cycleAppTheme}
          {...(isAdmin ? { onOpenPreferences: () => { void abrirConfiguracoes() } } : {})}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        >
        <div className="printable-proposal-hidden" aria-hidden="true">
          <React.Suspense fallback={null}>
            <PrintableProposal ref={printableRef} {...printableData} />
          </React.Suspense>
        </div>
        <PageRenderer
          activePage={activePage}
          renderDashboard={() => <DashboardPage />}
          renderCrm={() => <CrmPage {...crmState} />}
          renderBudgetSearch={() => (
            <BudgetSearchPage
              registros={orcamentosSalvos}
              isPrivilegedUser={isAdmin || isOffice || isFinanceiro}
              isProposalReadOnly={isProposalReadOnly}
              onClose={fecharPesquisaOrcamentos}

              onCarregarOrcamento={carregarOrcamentoSalvo}

              onAbrirOrcamento={abrirOrcamentoSalvo}

              onConfirmarRemocao={confirmarRemocaoOrcamento}
            />
          )}
          renderClientes={() => (
            <ClientesPage
              registros={clientesSalvos}
              onClose={fecharClientesPainel}
              onEditar={(r) => { void handleEditarCliente(r as unknown as ClienteRegistro) }}
              onExcluir={(r) => { void handleExcluirCliente(r as unknown as ClienteRegistro) }}
              onExportarCarteira={(r) => { void handleExportarParaCarteira(r as unknown as ClienteRegistro) }}
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
          )}
          renderSimulacoes={() => (
            <SimuladorPage
              simulacoesSection={simulacoesSection}
              isMobileSimpleEnabled={isMobileSimpleEnabled}
              isMobileViewport={isMobileViewport}
              abrirSimulacoes={abrirSimulacoes}
              capexSolarInvest={capexSolarInvest}
              leasingPrazo={leasingPrazo}
              tipoSistema={tipoSistema}
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
              aprovacaoStatus={aprovacaoStatus}
              ultimaDecisaoTimestamp={ultimaDecisaoTimestamp}
              registrarDecisaoInterna={registrarDecisaoInterna}
              afBaseInitializedRef={afBaseInitializedRef}
              kcKwhMes={kcKwhMes}
            />
          )}
          renderSettings={() => (
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
          )}
          renderAdminUsers={() => (
            <AdminUsersPage onBack={() => setActivePage(lastPrimaryPageRef.current)} />
          )}
          renderCarteira={() => (
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
          )}
          renderFinancialManagement={() => (
            canSeeFinancialManagementEffective
              ? <RevenueAndBillingPage
                  onBack={() => setActivePage(lastPrimaryPageRef.current)}
                  initialProjectId={pendingFinancialProjectId}
                />
              : null
          )}
          renderOperationalDashboard={() => (
            canSeeDashboardEffective
              ? <OperationalDashboardPage />
              : null
          )}
          renderApp={() => (
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
                      <VendasSections
                        tipoInstalacao={tipoInstalacao}
                        tipoInstalacaoOutro={tipoInstalacaoOutro}
                        tipoSistema={tipoSistema}
                        isManualBudgetForced={isManualBudgetForced}
                        manualBudgetForceReason={manualBudgetForceReason}
                        modoOrcamento={modoOrcamento}
                        autoBudgetFallbackMessage={autoBudgetFallbackMessage}
                        onTipoInstalacaoChange={handleTipoInstalacaoChange}
                        onTipoInstalacaoOutroChange={setTipoInstalacaoOutro}
                        onTipoSistemaChange={handleTipoSistemaChange}
                        onModoOrcamentoChange={handleModoOrcamentoChange}
                      />
                    ) : null}
                    <PropostaImagensSection
                      propostaImagens={propostaImagens}
                      activeTab={activeTab}
                      onAddImages={handleAbrirUploadImagens}
                      onRemoveImagem={handleRemoverPropostaImagem}
                    />
              {activeTab === 'leasing' ? (
                <LeasingSections
                  parametrosPrincipaisProps={{
                    kcKwhMes,
                    tipoRedeLabel,
                    vendaForm,
                    tarifaCheiaField,
                    taxaMinimaInputEmpty,
                    taxaMinima,
                    encargosFixosExtras,
                    baseIrradiacao,
                    shouldHideSimpleViewItems,
                    tusdPercent,
                    tusdTipoCliente,
                    tusdSubtipo,
                    tusdSimultaneidade,
                    tusdTarifaRkwh,
                    tusdAnoReferencia,
                    tusdOpcoesExpandidas,
                    segmentoCliente,
                    tipoEdificacaoOutro,
                    tusdOptionsTitleId,
                    tusdOptionsToggleId,
                    tusdOptionsContentId,
                    multiUcAtivo,
                    multiUcRateioModo,
                    multiUcEnergiaGeradaKWh,
                    multiUcEnergiaGeradaTouched,
                    multiUcAnoVigencia,
                    multiUcOverrideEscalonamento,
                    multiUcEscalonamentoCustomPercent,
                    multiUcEscalonamentoPadrao,
                    multiUcEscalonamentoPercentual,
                    multiUcEscalonamentoTabela,
                    multiUcRows,
                    multiUcResultado,
                    multiUcResultadoPorId,
                    multiUcRateioPercentualTotal,
                    multiUcRateioManualTotal,
                    multiUcErrors,
                    multiUcWarnings,
                    distribuidoraAneelEfetiva,
                    initialMultiUcAnoVigencia: INITIAL_VALUES.multiUcAnoVigencia,
                    onSetKcKwhMes: setKcKwhMes,
                    onApplyVendaUpdates: applyVendaUpdates,
                    onNormalizeTaxaMinimaInputValue: normalizeTaxaMinimaInputValue,
                    onSetEncargosFixosExtras: setEncargosFixosExtras,
                    onTusdPercentChange: (normalized) => {
                      setTusdPercent(normalized)
                      applyVendaUpdates({ tusd_percentual: normalized })
                      resetRetorno()
                    },
                    onTusdTipoClienteChange: handleTusdTipoClienteChange,
                    onTusdSubtipoChange: (value) => {
                      setTusdSubtipo(value)
                      applyVendaUpdates({ tusd_subtipo: value || undefined })
                      resetRetorno()
                    },
                    onTusdSimultaneidadeChange: (value) => {
                      setTusdSimultaneidadeFromSource(value, 'manual')
                      resetRetorno()
                    },
                    onTusdTarifaRkwhChange: (value) => {
                      setTusdTarifaRkwh(value)
                      applyVendaUpdates({ tusd_tarifa_r_kwh: value ?? undefined })
                      resetRetorno()
                    },
                    onTusdAnoReferenciaChange: (value) => {
                      setTusdAnoReferencia(value)
                      applyVendaUpdates({ tusd_ano_referencia: value })
                      resetRetorno()
                    },
                    onTusdOpcoesExpandidasChange: setTusdOpcoesExpandidas,
                    onTipoEdificacaoOutroChange: setTipoEdificacaoOutro,
                    onHandleMultiUcToggle: handleMultiUcToggle,
                    onHandleMultiUcQuantidadeChange: handleMultiUcQuantidadeChange,
                    onSetMultiUcEnergiaGeradaKWh: setMultiUcEnergiaGeradaKWh,
                    onHandleMultiUcRateioModoChange: handleMultiUcRateioModoChange,
                    onSetMultiUcAnoVigencia: setMultiUcAnoVigencia,
                    onSetMultiUcOverrideEscalonamento: setMultiUcOverrideEscalonamento,
                    onSetMultiUcEscalonamentoCustomPercent: setMultiUcEscalonamentoCustomPercent,
                    onHandleMultiUcClasseChange: handleMultiUcClasseChange,
                    onHandleMultiUcConsumoChange: handleMultiUcConsumoChange,
                    onHandleMultiUcRateioPercentualChange: handleMultiUcRateioPercentualChange,
                    onHandleMultiUcManualRateioChange: handleMultiUcManualRateioChange,
                    onHandleMultiUcTeChange: handleMultiUcTeChange,
                    onHandleMultiUcTusdTotalChange: handleMultiUcTusdTotalChange,
                    onHandleMultiUcTusdFioBChange: handleMultiUcTusdFioBChange,
                    onHandleMultiUcObservacoesChange: handleMultiUcObservacoesChange,
                    onHandleMultiUcAdicionar: handleMultiUcAdicionar,
                    onHandleMultiUcRecarregarTarifas: handleMultiUcRecarregarTarifas,
                    onHandleMultiUcRemover: handleMultiUcRemover,
                  }}
                  configuracaoUsinaSection={renderConfiguracaoUsinaSection()}
                  leasingContratoProps={{
                    leasingContrato,
                    leasingHomologacaoInputId,
                    clienteDiaVencimento: cliente.diaVencimento,
                    onCampoChange: handleLeasingContratoCampoChange,
                    onClienteDiaVencimentoChange: (value) => handleClienteChange('diaVencimento', value),
                    onProprietarioChange: handleLeasingContratoProprietarioChange,
                    onAdicionarProprietario: handleAdicionarContratoProprietario,
                    onRemoverProprietario: handleRemoverContratoProprietario,
                  }}
                  shouldHideSimpleViewItems={shouldHideSimpleViewItems}
                  leasingFormProps={{
                    podeSalvarProposta,
                    salvandoPropostaLeasing,
                    onSalvarProposta: handleSalvarPropostaLeasing,
                    entradaRs,
                    onEntradaRsChange: setEntradaRs,
                    desconto,
                    onDescontoChange: setDesconto,
                    leasingPrazo,
                    onLeasingPrazoChange: setLeasingPrazo,
                    custoFinalProjetadoCanonico,
                    parcelasSolarInvest,
                    shouldHideSimpleViewItems,
                    capexSolarInvest,
                    modoEntradaNormalizado,
                    mostrarValorMercadoLeasing,
                    onMostrarValorMercadoLeasingChange: setMostrarValorMercadoLeasing,
                    mostrarTabelaParcelas,
                    onMostrarTabelaParcelasChange: setMostrarTabelaParcelas,
                    leasingMensalidades,
                    financiamentoMensalidades,
                    mostrarFinanciamento,
                  }}
                />
              ) : (
              <VendasForm
                modoOrcamento={modoOrcamento}
                autoOrcamentoSectionNode={renderAutoOrcamentoSection()}
                parametrosSectionNode={renderVendaParametrosSection()}
                resumoPublicoSectionNode={renderVendaResumoPublicoSection()}
                budgetUploadSectionNode={renderBudgetUploadSection()}
                budgetKitSectionNode={renderBudgetKitSection()}
                condicoesPagamentoSection={condicoesPagamentoSection}
                vendaConfiguracaoProps={{
                  configuracaoUsinaObservacoesExpanded,
                  configuracaoUsinaObservacoesVendaContainerId,
                  setConfiguracaoUsinaObservacoesExpanded,
                  configuracaoUsinaObservacoes,
                  configuracaoUsinaObservacoesVendaId,
                  setConfiguracaoUsinaObservacoes,
                  potenciaModulo,
                  setPotenciaModuloDirty,
                  setPotenciaModulo,
                  numeroModulosManual,
                  numeroModulosEstimado,
                  moduleQuantityInputRef,
                  setNumeroModulosManual,
                  applyVendaUpdates,
                  tipoInstalacao,
                  handleTipoInstalacaoChange,
                  tipoSistema,
                  handleTipoSistemaChange,
                  tipoRede,
                  handleTipoRedeSelection,
                  potenciaFonteManual,
                  vendaForm,
                  potenciaInstaladaKwp,
                  handlePotenciaInstaladaChange,
                  geracaoMensalKwh,
                  areaInstalacao,
                  tipoRedeCompatMessage,
                  estruturaTipoWarning,
                  handleMissingInfoUploadClick,
                  inverterModelInputRef,
                  geracaoDiariaKwh,
                }}
                composicaoUfvProps={{
                  descontosMoneyField,
                  capexBaseResumoField,
                  capexBaseResumoValor,
                  capexBaseManualValor,
                  margemOperacionalResumoField,
                  margemManualAtiva,
                  onOpenVendasConfig: () => { void abrirConfiguracoes('vendas') },
                }}
                retornoProps={{
                  retornoProjetado,
                  retornoStatus,
                  retornoError,
                  capexTotal: Number.isFinite(vendaForm.capex_total) ? Number(vendaForm.capex_total) : 0,
                  onCalcular: handleCalcularRetorno,
                }}
              />
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
        />
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
