/**
 * useSolarInvestAppController
 *
 * Facade hook that composes the major extracted App hooks into a single call
 * site.  App.tsx calls this hook and destructures only what it needs; the
 * internal wiring (inter-hook refs, dependency threading) lives here.
 *
 * Composed hooks (in call order):
 *   1. useNavigationState      — page / tab / sidebar state + nav callbacks
 *   2. useTusdState            — TUSD/ANEEL parameters + simultaneidade effect
 *   3. useLeasingSimulacaoState — leasing/venda simulation state + retorno
 *   4. useBudgetUploadState    — kit-budget processing, upload, OCR flow
 *   5. useStorageHydration     — auth token wiring, migration, draft restore
 *   6. useClientState          — client CRUD state, sync, API load
 *   7. useProposalOrchestration — proposal save/load orchestration, auto-save
 *
 * Rules:
 *   - No business logic added or changed.
 *   - No UI rendering.
 *   - No new side effects beyond those already in the composed hooks.
 *   - All inter-hook refs are created here and returned so App.tsx can do
 *     late-binding assignments (applyDraftRef, autoFillVendaFromBudgetRef,
 *     runWithUnsavedChangesGuardRef, procuracaoUfRef, distribuidoraAneelEfetivaRef).
 */

import { useRef } from 'react'
import type React from 'react'

import { useNavigationState } from '../hooks/useNavigationState'
import { useStorageHydration } from '../hooks/useStorageHydration'
import { useClientState } from '../features/clientes/useClientState'
import { useTusdState } from '../features/simulacoes/useTusdState'
import { useLeasingSimulacaoState } from '../features/simulacoes/useLeasingSimulacaoState'
import { useBudgetUploadState } from '../features/simulacoes/useBudgetUploadState'
import { useProposalOrchestration } from '../features/propostas/useProposalOrchestration'
import { clonePrintableData } from '../lib/pdf/buildPrintableData'

import type { MeResponse } from '../lib/auth/access-types'
import type { OrcamentoSnapshotData } from '../types/orcamentoTypes'
import type { PrintableProposalProps } from '../types/printableProposal'
import type { UcBeneficiariaFormState } from '../types/ucBeneficiaria'
import type { TipoInstalacao } from '../shared/ufvComposicao'
import type { TipoSistema } from '../lib/finance/roi'
import type { StructuredBudget } from '../utils/structuredBudgetParser'
import type { ApplyVendaUpdatesFn } from '../features/simulacoes/useTusdState'

// ---------------------------------------------------------------------------
// Params interface
// ---------------------------------------------------------------------------

export interface UseSolarInvestAppControllerParams {
  // ── Navigation flags ─────────────────────────────────────────────────────
  canSeePortfolioEffective: boolean
  canSeeFinancialManagementEffective: boolean
  canSeeDashboardEffective: boolean
  canSeeFinancialAnalysisEffective: boolean

  // ── Auth / user ──────────────────────────────────────────────────────────
  /** From `user?.id ?? null` — triggers storage token setup on login. */
  userId: string | null
  /** Stable token getter (useCallback with empty deps) from App.tsx. */
  getAccessToken: () => Promise<string | null>
  /** Authentication state string from useAuthSession. */
  meAuthState: string
  /** Current Stack Auth user shape (loosely typed). */
  user: { id?: string; primaryEmail?: string | null } | null | undefined
  /** The /me response from the backend (null while loading or unauthenticated). */
  me: MeResponse | null
  isAdmin: boolean
  isOffice: boolean
  isFinanceiro: boolean
  /** Toast notification dispatcher (adicionarNotificacao). */
  adicionarNotificacao: (mensagem: string, tipo?: 'success' | 'info' | 'error') => void

  // ── Budget upload ────────────────────────────────────────────────────────
  renameVendasSimulacao: (prevId: string, nextId: string) => void
  tipoInstalacao: TipoInstalacao
  tipoSistema: TipoSistema
  moduleQuantityInputRef: React.RefObject<HTMLInputElement | null>
  inverterModelInputRef: React.RefObject<HTMLInputElement | null>

  // ── Proposal orchestration ───────────────────────────────────────────────
  scheduleMarkStateAsSaved: (signatureOverride?: string | null) => void
  cloneSnapshotData: (snapshot: OrcamentoSnapshotData) => OrcamentoSnapshotData
  computeSnapshotSignature: (
    snapshot: OrcamentoSnapshotData,
    dados: PrintableProposalProps,
  ) => string
  createBudgetFingerprint: (dados: PrintableProposalProps) => string
  kcKwhMes: number
  tarifaCheia: number
  potenciaModulo: number
  numeroModulosManual: number | '' | null
  ucsBeneficiarias: UcBeneficiariaFormState[]
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSolarInvestAppController(params: UseSolarInvestAppControllerParams) {
  const {
    // nav
    canSeePortfolioEffective,
    canSeeFinancialManagementEffective,
    canSeeDashboardEffective,
    canSeeFinancialAnalysisEffective,
    // auth
    userId,
    getAccessToken,
    meAuthState,
    user,
    me,
    isAdmin,
    isOffice,
    isFinanceiro,
    adicionarNotificacao,
    // budget
    renameVendasSimulacao,
    tipoInstalacao,
    tipoSistema,
    moduleQuantityInputRef,
    inverterModelInputRef,
    // proposal
    scheduleMarkStateAsSaved,
    cloneSnapshotData,
    computeSnapshotSignature,
    createBudgetFingerprint,
    kcKwhMes,
    tarifaCheia,
    potenciaModulo,
    numeroModulosManual,
    ucsBeneficiarias,
  } = params

  // ── Internal late-binding refs (returned so App.tsx can assign .current) ─

  /**
   * Guards navigation away from unsaved changes.
   * App.tsx assigns: runWithUnsavedChangesGuardRef.current = runWithUnsavedChangesGuard
   * (after the guard callback is declared lower in the render body).
   */
  const runWithUnsavedChangesGuardRef = useRef<
    ((action: () => void | Promise<void>) => Promise<boolean>) | null
  >(null)

  /**
   * Points to the current `aplicarSnapshot` callback.
   * App.tsx assigns: applyDraftRef.current = aplicarSnapshot
   */
  const applyDraftRef = useRef<((data: unknown) => void) | null>(null)

  /**
   * Points to the autoFillVendaFromBudget callback (declared later in App.tsx).
   * App.tsx assigns: autoFillVendaFromBudgetRef.current = autoFillVendaFromBudget
   */
  const autoFillVendaFromBudgetRef = useRef<
    | ((
        structured: StructuredBudget,
        totalValue?: number | null,
        plainText?: string | null,
      ) => void)
    | null
  >(null)

  /**
   * Tracks the current procuração UF for proposal rendering.
   * App.tsx assigns via: useEffect(() => { procuracaoUfRef.current = procuracaoUf }, [...])
   */
  const procuracaoUfRef = useRef<string | null>(null)

  /**
   * Tracks the effective ANEEL distributor string.
   * App.tsx assigns via: useEffect(() => { distribuidoraAneelEfetivaRef.current = ... }, [...])
   */
  const distribuidoraAneelEfetivaRef = useRef<string>('')

  // Internal ref used to break the TDZ cycle between useTusdState and
  // useLeasingSimulacaoState (applyVendaUpdates is declared inside the leasing
  // hook but the tusd hook needs to call it via a ref on every render).
  const applyVendaUpdatesRef = useRef<ApplyVendaUpdatesFn | null>(null)

  // ── 1. Navigation state ──────────────────────────────────────────────────

  const navResult = useNavigationState({
    canSeePortfolioEffective,
    canSeeFinancialManagementEffective,
    canSeeDashboardEffective,
    canSeeFinancialAnalysisEffective,
    guardRef: runWithUnsavedChangesGuardRef,
  })

  const { activeTab, activeTabRef, setActivePage } = navResult

  // ── 2. TUSD state ────────────────────────────────────────────────────────

  const tusdResult = useTusdState({ applyVendaUpdatesRef })

  // ── 3. Leasing / venda simulation state ──────────────────────────────────

  const leasingResult = useLeasingSimulacaoState()
  // Wire the late-bound ref so useTusdState effects can call applyVendaUpdates.
  applyVendaUpdatesRef.current = leasingResult.applyVendaUpdates

  // ── 4. Budget upload state ────────────────────────────────────────────────

  const budgetResult = useBudgetUploadState({
    renameVendasSimulacao,
    tipoInstalacao,
    tipoSistema,
    autoFillVendaFromBudgetRef,
    moduleQuantityInputRef,
    inverterModelInputRef,
  })

  const { getActiveBudgetId, switchBudgetId, budgetStructuredItems } = budgetResult

  // ── 5. Storage hydration ──────────────────────────────────────────────────

  const storageResult = useStorageHydration({
    userId,
    getAccessToken,
    applyDraftRef,
    onNotify: adicionarNotificacao,
  })

  const { authSyncKey, isHydratingRef, setIsHydrating } = storageResult

  // ── 6. Client state ───────────────────────────────────────────────────────

  const clientResult = useClientState({
    meAuthState,
    authSyncKey,
    user,
    me,
    isAdmin,
    isOffice,
    isFinanceiro,
    adicionarNotificacao,
  })

  const { cliente, clienteEmEdicaoIdRef, carregarClientesSalvos } = clientResult

  // ── 7. Proposal orchestration ─────────────────────────────────────────────

  const proposalResult = useProposalOrchestration({
    meAuthState,
    authSyncKey,
    activeTabRef,
    isHydratingRef,
    setIsHydrating,
    clienteEmEdicaoIdRef,
    runWithUnsavedChangesGuardRef,
    getActiveBudgetId,
    switchBudgetId,
    setActivePage,
    adicionarNotificacao,
    carregarClientesSalvos,
    scheduleMarkStateAsSaved,
    procuracaoUfRef,
    distribuidoraAneelEfetivaRef,
    clonePrintableData,
    cloneSnapshotData,
    computeSnapshotSignature,
    createBudgetFingerprint,
    cliente,
    kcKwhMes,
    tarifaCheia,
    potenciaModulo,
    numeroModulosManual,
    activeTab,
    ucsBeneficiarias,
    budgetStructuredItems,
  })

  // ── Combined return ───────────────────────────────────────────────────────

  return {
    // Late-binding refs App.tsx must assign after declaring their targets
    runWithUnsavedChangesGuardRef,
    applyDraftRef,
    autoFillVendaFromBudgetRef,
    procuracaoUfRef,
    distribuidoraAneelEfetivaRef,
    // All hook results
    ...navResult,
    ...tusdResult,
    ...leasingResult,
    ...budgetResult,
    ...storageResult,
    ...clientResult,
    ...proposalResult,
  }
}
