/**
 * useProposalOrchestration – React hook that owns all proposal-management
 * state, refs, callbacks and effects extracted from App.tsx.
 *
 * Rules:
 * - No business-rule duplication
 * - No direct UI rendering
 * - All side effects are contained in useEffect / useCallback
 * - Preserve all production behavior exactly
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type React from 'react'
import type { OrcamentoSnapshotData } from '../../types/orcamentoTypes'
import type {
  PrintableProposalProps,
} from '../../types/printableProposal'
import { normalizeTipoBasico } from '../../types/tipoBasico'
import type { ActivePage } from '../../types/navigation'
import type { ClienteDados } from '../../types/printableProposal'
import type { UcBeneficiariaFormState } from '../../types/ucBeneficiaria'
import type { StructuredItem } from '../../utils/structuredBudgetParser'
import type { ClienteRegistro } from '../clientes/clienteHelpers'
import { getDistribuidoraValidationMessage } from '../clientes/clienteHelpers'
import {
  normalizeNumbers,
} from '../../utils/formatters'
import { normalizeText } from '../../utils/textUtils'
import {
  normalizeClienteHerdeiros,
  normalizeClienteIdCandidate,
  CLIENTE_ID_LENGTH,
  CLIENTE_ID_PATTERN,
} from '../clientes/clienteHelpers'
import { normalizeProposalId, ensureProposalId } from '../../lib/ids'
import {
  listProposals as listProposalsFromApi,
  createProposal,
  updateProposal,
  deleteProposal,
  type CreateProposalInput,
} from '../../lib/api/proposalsApi'
import {
  fetchRemoteStorageEntry,
  persistRemoteStorageEntry,
} from '../../app/services/serverStorage'
import { saveFormDraft, clearFormDraft } from '../../lib/persist/formDraft'
import {
  saveProposalSnapshotById,
  loadProposalSnapshotById,
} from '../../lib/persist/proposalStore'
import {
  loadPropostasFromOneDrive,
  OneDriveIntegrationMissingError,
  persistPropostasToOneDrive,
} from '../../utils/onedrive'
import { isOnline as isConnectivityOnline } from '../../lib/connectivity'
import {
  type OrcamentoSalvo,
  BUDGETS_STORAGE_KEY,
  PROPOSAL_SERVER_ID_MAP_STORAGE_KEY,
  tick,
  generateBudgetId,
  serverProposalToOrcamento,
  persistBudgetsToLocalStorage,
  alertPrunedBudgets,
  buildProposalUpsertPayload,
  normalizeTusdTipoClienteValue,
} from './proposalHelpers'
import type { PrintableUcBeneficiaria } from '../../types/printableProposal'

// Re-export for convenience
export type { OrcamentoSalvo }

// ---------------------------------------------------------------------------
// Options interface
// ---------------------------------------------------------------------------

export interface UseProposalOrchestrationOptions {
  meAuthState: string
  authSyncKey: number
  carregarClientesSalvos: () => ClienteRegistro[]
  adicionarNotificacao: (msg: string, tipo?: 'success' | 'info' | 'error') => void
  setActivePage: React.Dispatch<React.SetStateAction<ActivePage>>
  getActiveBudgetId: () => string
  switchBudgetId: (nextId: string) => void
  activeTabRef: React.MutableRefObject<string | null>
  isHydratingRef: React.MutableRefObject<boolean>
  setIsHydrating: React.Dispatch<React.SetStateAction<boolean>>
  clonePrintableData: (dados: PrintableProposalProps) => PrintableProposalProps
  cloneSnapshotData: (snapshot: OrcamentoSnapshotData) => OrcamentoSnapshotData
  computeSnapshotSignature: (
    snapshot: OrcamentoSnapshotData,
    dados: PrintableProposalProps,
  ) => string
  createBudgetFingerprint: (dados: PrintableProposalProps) => string
  clienteEmEdicaoIdRef: React.MutableRefObject<string | null>
  scheduleMarkStateAsSaved: (signatureOverride?: string | null) => void
  procuracaoUfRef: React.MutableRefObject<string | null>
  distribuidoraAneelEfetivaRef: React.MutableRefObject<string>
  runWithUnsavedChangesGuardRef: React.MutableRefObject<
    ((action: () => void | Promise<void>) => Promise<boolean>) | null
  >
  // Auto-save effect trigger deps
  cliente: ClienteDados
  kcKwhMes: number
  tarifaCheia: number
  potenciaModulo: number
  numeroModulosManual: number | '' | null
  activeTab: string
  ucsBeneficiarias: UcBeneficiariaFormState[]
  budgetStructuredItems: StructuredItem[]
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProposalOrchestration(options: UseProposalOrchestrationOptions) {
  const {
    meAuthState,
    authSyncKey,
    carregarClientesSalvos,
    adicionarNotificacao,
    setActivePage,
    getActiveBudgetId,
    switchBudgetId,
    activeTabRef,
    isHydratingRef,
    setIsHydrating,
    clonePrintableData,
    cloneSnapshotData,
    computeSnapshotSignature,
    createBudgetFingerprint,
    clienteEmEdicaoIdRef,
    scheduleMarkStateAsSaved,
    procuracaoUfRef,
    distribuidoraAneelEfetivaRef,
    runWithUnsavedChangesGuardRef,
    cliente,
    kcKwhMes,
    tarifaCheia,
    potenciaModulo,
    numeroModulosManual,
    activeTab,
    ucsBeneficiarias,
    budgetStructuredItems,
  } = options

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [orcamentosSalvos, setOrcamentosSalvos] = useState<OrcamentoSalvo[]>([])
  const [proposalsSyncState, setProposalsSyncState] = useState<
    'synced' | 'pending' | 'failed' | 'local-only'
  >('pending')
  const [orcamentoAtivoInfo, setOrcamentoAtivoInfo] = useState<{
    id: string
    cliente: string
  } | null>(null)
  const [orcamentoRegistroBase, setOrcamentoRegistroBase] = useState<OrcamentoSalvo | null>(null)
  const [orcamentoDisponivelParaDuplicar, setOrcamentoDisponivelParaDuplicar] =
    useState<OrcamentoSalvo | null>(null)

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proposalServerIdMapRef = useRef<Record<string, string>>({})
  const proposalServerAutoSaveInFlightRef = useRef(false)

  // Refs that App.tsx wires up after the hook call
  const getCurrentSnapshotRef = useRef<(() => OrcamentoSnapshotData | null) | null>(null)
  const aplicarSnapshotRef = useRef<
    | ((
        snapshot: OrcamentoSnapshotData,
        options?: { budgetIdOverride?: string; allowEmpty?: boolean },
      ) => void)
    | null
  >(null)

  // ---------------------------------------------------------------------------
  // Server-id map hydration effect
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (typeof window === 'undefined') return
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
        Object.entries(parsed).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    } catch (error) {
      console.warn('[AutoSave] Failed to hydrate proposal server-id map:', error)
      proposalServerIdMapRef.current = {}
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Server-id map helpers
  // ---------------------------------------------------------------------------

  const updateProposalServerIdMap = useCallback((budgetId: string, serverId: string) => {
    if (typeof window === 'undefined' || !budgetId || !serverId) return
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
    if (typeof window === 'undefined' || !budgetId) return
    if (!(budgetId in proposalServerIdMapRef.current)) return
    const next = { ...proposalServerIdMapRef.current }
    delete next[budgetId]
    proposalServerIdMapRef.current = next
    try {
      window.localStorage.setItem(PROPOSAL_SERVER_ID_MAP_STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      console.warn('[AutoSave] Failed to remove proposal server-id map entry:', error)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Proposal state callbacks
  // ---------------------------------------------------------------------------

  const limparOrcamentoAtivo = useCallback(() => {
    setOrcamentoAtivoInfo(null)
    setOrcamentoRegistroBase(null)
    setOrcamentoDisponivelParaDuplicar(null)
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

      setOrcamentoAtivoInfo({ id: idParaExibir, cliente: clienteNome })
      const registroClonado: OrcamentoSalvo = {
        ...registro,
        dados: clonePrintableData(registro.dados),
        ...(registro.snapshot ? { snapshot: cloneSnapshotData(registro.snapshot) } : {}),
      }
      setOrcamentoRegistroBase(registroClonado)
      setOrcamentoDisponivelParaDuplicar(registroClonado)
      const signatureOverride = registro.snapshot
        ? computeSnapshotSignature(registro.snapshot, dadosClonados)
        : null
      scheduleMarkStateAsSaved(signatureOverride)
    },
    [
      clonePrintableData,
      cloneSnapshotData,
      computeSnapshotSignature,
      scheduleMarkStateAsSaved,
    ],
  )

  // ---------------------------------------------------------------------------
  // parseOrcamentosSalvos
  // ---------------------------------------------------------------------------

  const parseOrcamentosSalvos = useCallback(
    (existenteRaw: string | null): OrcamentoSalvo[] => {
      if (!existenteRaw) return []

      try {
        const parsed = JSON.parse(existenteRaw) as unknown
        if (!Array.isArray(parsed)) return []

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
          if (typeof valor !== 'string') return ''
          const normalizado = normalizeClienteIdCandidate(valor)
          if (
            normalizado.length === CLIENTE_ID_LENGTH &&
            CLIENTE_ID_PATTERN.test(normalizado)
          ) {
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
            consultorId: clienteDados.consultorId ?? '',
            consultorNome: clienteDados.consultorNome ?? '',
          }

          const dadosNormalizados: PrintableProposalProps = {
            ...dados,
            budgetId: dados?.budgetId ?? registro.id,
            cliente: clienteNormalizado,
            distribuidoraTarifa:
              dados.distribuidoraTarifa ?? clienteNormalizado.distribuidora ?? '',
            tipoProposta: dados?.tipoProposta === 'VENDA_DIRETA' ? 'VENDA_DIRETA' : 'LEASING',
          }

          if (dados.ucGeradora && typeof dados.ucGeradora === 'object') {
            const numero =
              typeof dados.ucGeradora.numero === 'string' ? dados.ucGeradora.numero : ''
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
              typeof dados.ucGeradoraTitular.cpf === 'string'
                ? dados.ucGeradoraTitular.cpf
                : ''
            const rg =
              typeof dados.ucGeradoraTitular.rg === 'string'
                ? dados.ucGeradoraTitular.rg
                : ''
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
                .filter(
                  (ucItem): ucItem is PrintableUcBeneficiaria =>
                    Boolean(ucItem && typeof ucItem === 'object'),
                )
                .map((ucItem) => ({
                  numero: typeof ucItem.numero === 'string' ? ucItem.numero : '',
                  endereco: typeof ucItem.endereco === 'string' ? ucItem.endereco : '',
                  rateioPercentual:
                    ucItem.rateioPercentual != null &&
                    Number.isFinite(ucItem.rateioPercentual)
                      ? Number(ucItem.rateioPercentual)
                      : null,
                }))
            : []

          const clienteIdArmazenado = sanitizeClienteId(
            registro.clienteId ??
              registro.clienteID ??
              (dadosNormalizados as unknown as { clienteId?: string }).clienteId ??
              ((dadosNormalizados.cliente as unknown as { id?: string })?.id ?? ''),
          )

          const documentoRaw =
            registro.clienteDocumento ?? dadosNormalizados.cliente.documento ?? ''
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
              snapshotNormalizado = cloneSnapshotData(
                snapshotCandidate as OrcamentoSnapshotData,
              )
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
                  ? normalizeTusdTipoClienteValue(
                      snapshotNormalizado.vendaForm.tusd_tipo_cliente,
                    )
                  : undefined,
              }
            } catch (error) {
              console.warn(
                'Não foi possível interpretar o snapshot do orçamento salvo.',
                error,
              )
              snapshotNormalizado = undefined
            }
          }

          return {
            id,
            criadoEm,
            ...(clienteId ? { clienteId } : {}),
            clienteNome: dadosNormalizados.cliente.nome,
            clienteCidade: dadosNormalizados.cliente.cidade,
            clienteUf: dadosNormalizados.cliente.uf,
            clienteDocumento:
              registro.clienteDocumento ?? dadosNormalizados.cliente.documento ?? '',
            clienteUc: registro.clienteUc ?? dadosNormalizados.cliente.uc ?? '',
            dados: dadosNormalizados,
            ...(snapshotNormalizado != null ? { snapshot: snapshotNormalizado } : {}),
          }
        })
      } catch (error) {
        console.warn('Não foi possível interpretar os orçamentos salvos existentes.', error)
        return []
      }
    },
    [carregarClientesSalvos, cloneSnapshotData],
  )

  // ---------------------------------------------------------------------------
  // Load/persist proposals
  // ---------------------------------------------------------------------------

  // Loads the local draft cache from localStorage. NOT the official source of truth.
  const carregarOrcamentosSalvos = useCallback((): OrcamentoSalvo[] => {
    if (typeof window === 'undefined') return []
    const existenteRaw = window.localStorage.getItem(BUDGETS_STORAGE_KEY)
    return parseOrcamentosSalvos(existenteRaw)
  }, [parseOrcamentosSalvos])

  const carregarOrcamentosPrioritarios = useCallback(async (): Promise<OrcamentoSalvo[]> => {
    if (typeof window === 'undefined') return []

    try {
      const allRegistros: OrcamentoSalvo[] = []
      const proposalMapUpdates: Record<string, string> = {}
      let page = 1
      const limit = 100
      const MAX_PAGES = 50

      for (;;) {
        const result = await listProposalsFromApi({ page, limit })
        allRegistros.push(
          ...result.data.map((row) => {
            const mapped = serverProposalToOrcamento(row)
            if (mapped.id && row.id) proposalMapUpdates[mapped.id] = row.id
            return mapped
          }),
        )
        if (
          page >= result.pagination.pages ||
          result.data.length === 0 ||
          page >= MAX_PAGES
        )
          break
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
          console.warn(
            '[proposals] Failed to persist proposal server-id map after API load:',
            error,
          )
        }
      }

      try {
        window.localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(allRegistros))
      } catch {
        // Non-critical: local cache write failure
      }
      setProposalsSyncState('synced')
      return allRegistros
    } catch (error) {
      setProposalsSyncState('local-only')
      adicionarNotificacao(
        'Propostas em modo local temporário: backend indisponível / sem sincronização com o banco.',
        'error',
      )
      console.warn(
        '[proposals] Falha ao carregar propostas via API; fallback para armazenamento local.',
        error,
      )
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
        if (import.meta.env.DEV)
          console.debug('Leitura via OneDrive ignorada: integração não configurada.')
      } else {
        console.warn('Não foi possível carregar propostas via OneDrive.', error)
      }
    }

    const fallbackRaw = window.localStorage.getItem(BUDGETS_STORAGE_KEY)
    return parseOrcamentosSalvos(fallbackRaw)
  }, [adicionarNotificacao, carregarOrcamentosSalvos, parseOrcamentosSalvos])

  // ---------------------------------------------------------------------------
  // Proposals load effect
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (meAuthState !== 'authenticated') return
    let cancelado = false
    const carregar = async () => {
      if (cancelado) return
      const registros = await carregarOrcamentosPrioritarios()
      if (!cancelado) setOrcamentosSalvos(registros)
    }
    void carregar()
    return () => {
      cancelado = true
    }
    // authSyncKey increments when Stack Auth token becomes available
  }, [carregarOrcamentosPrioritarios, authSyncKey, meAuthState])

  // ---------------------------------------------------------------------------
  // Auto-save effect
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isHydratingRef.current) return

    const AUTO_SAVE_INTERVAL_MS = 5000

    const scheduleAutoSave = () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      autoSaveTimeoutRef.current = setTimeout(async () => {
        const activeBudgetId = getActiveBudgetId()
        if (isHydratingRef.current || !activeBudgetId) {
          if (import.meta.env.DEV)
            console.debug('[App] Auto-save skipped: hydrating or missing budgetId')
          return
        }

        try {
          const snapshot = getCurrentSnapshotRef.current?.()
          if (!snapshot || isHydratingRef.current) {
            console.warn('[AutoSave] Snapshot indisponível durante hidratação.')
            return
          }

          const snapshotNome = (snapshot?.cliente?.nome ?? '').trim()
          const snapshotEndereco = (snapshot?.cliente?.endereco ?? '').trim()
          const snapshotKwh = Number(snapshot?.kcKwhMes ?? 0)
          const isEmptySnapshot = !snapshotNome && !snapshotEndereco && snapshotKwh === 0

          if (isEmptySnapshot) return

          const online = isConnectivityOnline()

          if (!online) {
            await saveFormDraft(snapshot)
            if (import.meta.env.DEV)
              console.debug('[App] Auto-saved form draft to IndexedDB (offline fallback)')
            return
          }

          if (proposalServerAutoSaveInFlightRef.current) {
            if (import.meta.env.DEV)
              console.debug('[App] Auto-save skipped: server request already in flight')
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
                  ...(proposalPayload.client_name
                    ? { client_name: proposalPayload.client_name }
                    : {}),
                  ...(proposalPayload.client_document
                    ? { client_document: proposalPayload.client_document }
                    : {}),
                  ...(proposalPayload.client_city
                    ? { client_city: proposalPayload.client_city }
                    : {}),
                  ...(proposalPayload.client_state
                    ? { client_state: proposalPayload.client_state }
                    : {}),
                  ...(proposalPayload.client_phone
                    ? { client_phone: proposalPayload.client_phone }
                    : {}),
                  ...(proposalPayload.client_email
                    ? { client_email: proposalPayload.client_email }
                    : {}),
                  ...(proposalPayload.client_cep
                    ? { client_cep: proposalPayload.client_cep }
                    : {}),
                  ...(typeof proposalPayload.consumption_kwh_month === 'number'
                    ? { consumption_kwh_month: proposalPayload.consumption_kwh_month }
                    : {}),
                  ...(typeof proposalPayload.system_kwp === 'number'
                    ? { system_kwp: proposalPayload.system_kwp }
                    : {}),
                  ...(typeof proposalPayload.term_months === 'number'
                    ? { term_months: proposalPayload.term_months }
                    : {}),
                  ...(proposalPayload.uc_beneficiaria
                    ? { uc_beneficiaria: proposalPayload.uc_beneficiaria }
                    : {}),
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
            const snapshotFallback = getCurrentSnapshotRef.current?.()
            if (snapshotFallback && !isHydratingRef.current) {
              await saveFormDraft(snapshotFallback)
              if (import.meta.env.DEV)
                console.debug(
                  '[App] Auto-save fallback: form draft saved to IndexedDB after server failure',
                )
            }
          } catch (fallbackError) {
            console.warn('[App] Auto-save fallback failed:', fallbackError)
          }
        }
      }, AUTO_SAVE_INTERVAL_MS)
    }

    scheduleAutoSave()

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
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
    getActiveBudgetId,
    updateProposalServerIdMap,
    isHydratingRef,
    activeTabRef,
  ])

  // ---------------------------------------------------------------------------
  // carregarOrcamentoParaEdicao
  // ---------------------------------------------------------------------------

  const carregarOrcamentoParaEdicao = useCallback(
    async (
      registro: OrcamentoSalvo,
      opts?: { notificationMessage?: string },
    ) => {
      let snapshotToApply = registro.snapshot

      if (registro.id) {
        const budgetIdKey = normalizeProposalId(registro.id) || registro.id
        if (import.meta.env.DEV)
          console.debug(
            `[carregarOrcamentoParaEdicao] Loading snapshot for budget: ${budgetIdKey}`,
          )
        const completeSnapshot = await loadProposalSnapshotById(budgetIdKey)

        if (completeSnapshot) {
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
            snapshotToApply = completeSnapshot as unknown as OrcamentoSnapshotData
          } else {
            if (import.meta.env.DEV)
              console.debug(
                '[carregarOrcamentoParaEdicao] proposalStore snapshot empty, using fallback',
              )
          }
        } else {
          if (import.meta.env.DEV)
            console.debug('[carregarOrcamentoParaEdicao] snapshot not found, using fallback')
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
        aplicarSnapshotRef.current?.(snapshotToApply, { budgetIdOverride: targetBudgetId })
        await tick()
      } finally {
        isHydratingRef.current = false
        setIsHydrating(false)
      }
      setActivePage('app')
      atualizarOrcamentoAtivo(registro)
      adicionarNotificacao(
        opts?.notificationMessage ??
          'Orçamento carregado para edição. Salve novamente para preservar as alterações.',
        'info',
      )
    },
    [
      adicionarNotificacao,
      atualizarOrcamentoAtivo,
      isHydratingRef,
      setIsHydrating,
      switchBudgetId,
      setActivePage,
    ],
  )

  // ---------------------------------------------------------------------------
  // salvarOrcamentoLocalmente
  // ---------------------------------------------------------------------------

  const salvarOrcamentoLocalmente = useCallback(
    (dados: PrintableProposalProps): OrcamentoSalvo | null => {
      if (typeof window === 'undefined') return null

      const distribuidoraValidation = getDistribuidoraValidationMessage(
        procuracaoUfRef.current || cliente.uf,
        distribuidoraAneelEfetivaRef.current,
      )
      if (distribuidoraValidation) {
        adicionarNotificacao(distribuidoraValidation, 'error')
        return null
      }

      try {
        const registrosExistentes = carregarOrcamentosSalvos()
        const dadosClonados = clonePrintableData(dados)
        const snapshotAtual = getCurrentSnapshotRef.current?.() ?? null
        const activeBudgetId = getActiveBudgetId()
        if (!snapshotAtual || isHydratingRef.current || !activeBudgetId) {
          console.warn('[salvarOrcamentoLocalmente] blocked: hydrating or missing budgetId', {
            hydrating: isHydratingRef.current,
            activeBudgetId,
          })
          return null
        }
        const snapshotClonado = cloneSnapshotData(snapshotAtual)

        if (import.meta.env.DEV) {
          console.debug('[salvarOrcamentoLocalmente] Snapshot from getCurrentSnapshot():', {
            kcKwhMes: snapshotClonado.kcKwhMes ?? 0,
            totalFields: Object.keys(snapshotClonado).length,
          })
        }

        const nome = (snapshotClonado.cliente?.nome ?? '').trim()
        const endereco = (snapshotClonado.cliente?.endereco ?? '').trim()
        const documento = (snapshotClonado.cliente?.documento ?? '').trim()
        const kc = Number(snapshotClonado.kcKwhMes ?? 0)
        const hasCliente = Boolean(nome || endereco || documento)
        const hasConsumption = kc > 0
        const isSnapshotMeaningful = hasCliente || hasConsumption

        if (!isSnapshotMeaningful) {
          console.warn(
            '[salvarOrcamentoLocalmente] Snapshot is empty - cannot save proposal without data',
          )
          window.alert(
            'Proposta sem dados para salvar. Preencha os campos do cliente e/ou consumo.',
          )
          return null
        }

        const fingerprint = computeSnapshotSignature(snapshotClonado, dadosClonados)

        const registroExistenteIndex = registrosExistentes.findIndex((registro) => {
          if (registro.snapshot) {
            return (
              computeSnapshotSignature(registro.snapshot, registro.dados) === fingerprint
            )
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
            ...(clienteIdAtual != null
              ? { clienteId: clienteIdAtual }
              : existente.clienteId != null
              ? { clienteId: existente.clienteId }
              : {}),
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
            if (error instanceof OneDriveIntegrationMissingError) return
            if (import.meta.env.DEV)
              console.warn(
                'Não foi possível sincronizar propostas com o OneDrive.',
                error,
              )
          })

          const budgetIdKey =
            normalizeProposalId(effectiveBudgetId) || effectiveBudgetId
          if (import.meta.env.DEV)
            console.debug(
              '[salvarOrcamentoLocalmente] Saving to proposalStore (update):',
              budgetIdKey,
            )
          void saveProposalSnapshotById(budgetIdKey, snapshotAtualizado).catch((error) => {
            console.error(
              '[proposalStore] ERROR saving snapshot for budget:',
              budgetIdKey,
              error,
            )
          })

          return (
            persisted.find((registro) => registro.id === registroAtualizado.id) ??
            registroAtualizado
          )
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
          ...(clienteIdAtual != null ? { clienteId: clienteIdAtual } : {}),
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
          if (error instanceof OneDriveIntegrationMissingError) return
          if (import.meta.env.DEV)
            console.warn('Não foi possível sincronizar propostas com o OneDrive.', error)
        })

        const budgetIdKey = normalizeProposalId(registro.id) || registro.id
        if (import.meta.env.DEV)
          console.debug(
            '[salvarOrcamentoLocalmente] Saving to proposalStore (new):',
            budgetIdKey,
          )
        void saveProposalSnapshotById(budgetIdKey, snapshotParaArmazenar).catch((error) => {
          console.error(
            '[proposalStore] ERROR saving snapshot for budget:',
            budgetIdKey,
            error,
          )
        })

        return persisted.find((item) => item.id === registro.id) ?? registro
      } catch (error) {
        console.error('Erro ao salvar orçamento localmente.', error)
        window.alert('Não foi possível salvar o orçamento. Tente novamente.')
        return null
      }
    },
    [
      carregarOrcamentosSalvos,
      clonePrintableData,
      cloneSnapshotData,
      computeSnapshotSignature,
      createBudgetFingerprint,
      getActiveBudgetId,
      switchBudgetId,
      adicionarNotificacao,
      isHydratingRef,
      clienteEmEdicaoIdRef,
      procuracaoUfRef,
      distribuidoraAneelEfetivaRef,
      cliente.uf,
    ],
  )

  // ---------------------------------------------------------------------------
  // removerOrcamentoSalvo
  // ---------------------------------------------------------------------------

  const removerOrcamentoSalvo = useCallback(
    async (id: string) => {
      if (typeof window === 'undefined') return

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
          window.alert(
            'Não foi possível atualizar os orçamentos salvos. Tente novamente.',
          )
          return prevRegistros
        }
      })

      removeProposalServerIdMapEntry(id)
    },
    [removeProposalServerIdMapEntry],
  )

  // ---------------------------------------------------------------------------
  // abrirPesquisaOrcamentos
  // ---------------------------------------------------------------------------

  const abrirPesquisaOrcamentos = useCallback(async () => {
    const guard = runWithUnsavedChangesGuardRef.current
    if (!guard) return false
    const canProceed = await guard(async () => {
      const registros = await carregarOrcamentosPrioritarios()
      setOrcamentosSalvos(registros)
      setActivePage('consultar')
    })
    return canProceed
  }, [carregarOrcamentosPrioritarios, setActivePage, runWithUnsavedChangesGuardRef])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    orcamentosSalvos,
    setOrcamentosSalvos,
    proposalsSyncState,
    setProposalsSyncState,
    orcamentoAtivoInfo,
    orcamentoRegistroBase,
    orcamentoDisponivelParaDuplicar,
    proposalServerIdMapRef,
    limparOrcamentoAtivo,
    atualizarOrcamentoAtivo,
    updateProposalServerIdMap,
    removeProposalServerIdMapEntry,
    parseOrcamentosSalvos,
    carregarOrcamentosSalvos,
    carregarOrcamentosPrioritarios,
    carregarOrcamentoParaEdicao,
    salvarOrcamentoLocalmente,
    removerOrcamentoSalvo,
    abrirPesquisaOrcamentos,
    // Refs for App.tsx to wire up
    getCurrentSnapshotRef,
    aplicarSnapshotRef,
  }
}
