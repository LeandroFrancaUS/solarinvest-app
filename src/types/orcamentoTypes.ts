/**
 * Shared type definitions for OrcamentoSnapshotData, ClienteRegistro and
 * related helper types.  These were previously defined as local types inside
 * App.tsx.  Extracting them here allows client-state helpers and hooks in
 * src/features/clientes to import them without creating a circular dependency.
 */

import type {
  ClienteDados,
  PrintableProposalImage,
  TipoInstalacao,
  UfvComposicaoTelhadoValores,
  UfvComposicaoSoloValores,
} from './printableProposal'
import type { ClienteMensagens } from './cliente'
import type { UcBeneficiariaFormState } from './ucBeneficiaria'
import type { VendasConfig } from './vendasConfig'
import type {
  TabKey,
  SettingsTabKey,
  LeasingPrazoAnos,
  EntradaModoLabel,
  KitBudgetState,
  SeguroModo,
  TipoRede,
  MultiUcRowState,
  MultiUcRateioModo,
} from '../app/config'
import type { BudgetUploadProgress } from '../app/services/budgetUpload'
import type { SegmentoCliente, TipoSistema, VendaForm } from '../lib/finance/roi'
import type { TipoClienteTUSD } from '../lib/finance/tusd'
import type {
  ParsedVendaPdfData,
  EstruturaUtilizadaTipoWarning,
} from '../lib/pdf/extractVendas'
import type { Rede } from '../lib/pricing/pricingPorKwp'
import type { ImpostosRegimeConfig } from '../lib/venda/calcComposicaoUFV'
import type { LeasingCorresponsavel, LeasingState } from '../store/useLeasingStore'
import type { VendaSnapshot } from '../store/useVendaStore'
import type { VendasSimulacao } from '../store/useVendasSimulacoesStore'
import type { StructuredItem } from '../utils/structuredBudgetParser'
import type { LeasingAnexoId } from '../components/modals/LeasingContractsModal'

// ---------------------------------------------------------------------------
// OrcamentoSnapshot sub-types (previously local to App.tsx)
// ---------------------------------------------------------------------------

export type OrcamentoSnapshotBudgetState = {
  isProcessing: boolean
  error: string | null
  progress: BudgetUploadProgress | null
  isTableCollapsed: boolean
  ocrDpi: number
}

export type OrcamentoSnapshotMultiUcState = {
  ativo: boolean
  rows: MultiUcRowState[]
  rateioModo: MultiUcRateioModo
  energiaGeradaKWh: number
  energiaGeradaTouched: boolean
  anoVigencia: number
  overrideEscalonamento: boolean
  escalonamentoCustomPercent: number | null
}

export type PageSharedSettings = {
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

// ---------------------------------------------------------------------------
// OrcamentoSnapshotData (previously local to App.tsx)
// ---------------------------------------------------------------------------

export type OrcamentoSnapshotData = {
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

// ---------------------------------------------------------------------------
// ClienteRegistro (previously local to App.tsx)
// ---------------------------------------------------------------------------

export type ClienteRegistro = {
  id: string
  criadoEm: string
  atualizadoEm: string
  dados: ClienteDados
  propostaSnapshot?: OrcamentoSnapshotData
  consumption_kwh_month?: number | null
  system_kwp?: number | null
  term_months?: number | null
  ownerName?: string
  ownerEmail?: string
  ownerUserId?: string
  createdByUserId?: string | null
  deletedAt?: string | null
  inPortfolio?: boolean
  clientActivatedAt?: string | null
}

// ---------------------------------------------------------------------------
// Client sync / source types (previously defined inside the App function body)
// ---------------------------------------------------------------------------

export type ClientsSyncState = 'online-db' | 'reconciling' | 'degraded-api' | 'local-fallback'
export type ClientsSource = 'api' | 'server-storage' | 'local-browser-storage' | 'memory'

// ---------------------------------------------------------------------------
// Reconciliation persistence (previously local to App.tsx)
// ---------------------------------------------------------------------------

export type PersistedClientReconciliation = {
  deletedClientKeys: string[]
  updatedAt: number
  version: 1
}
