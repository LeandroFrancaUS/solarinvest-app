/**
 * useClientState – React hook that owns all client-management state, refs,
 * callbacks and effects extracted from App.tsx.
 *
 * The hook accepts auth/notification dependencies via its options object so
 * that it can be called after those dependencies are available in App.tsx.
 *
 * Rules:
 * - No business-rule duplication
 * - No direct UI rendering
 * - All side effects are contained in the hook's useEffect / useCallback
 * - Preserve all production behavior exactly
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type { MeResponse } from '../../lib/auth/access-types'
import type { ConsultantEntry, ConsultantPickerEntry } from '../../lib/api/clientsApi'
import {
  ClientsApiError,
  listClients as listClientsFromApi,
  listConsultants as listConsultantsFromApi,
} from '../../lib/api/clientsApi'
import { fetchConsultantsForPicker, consultorDisplayName } from '../../services/personnelApi'
import {
  loadClientesFromOneDrive,
  OneDriveIntegrationMissingError,
} from '../../utils/onedrive'
import type { ClienteDados } from '../../types/printableProposal'
import type { ClienteMensagens } from '../../types/cliente'
import type { ClienteRegistro, ClientsSyncState, ClientsSource, PersistedClientReconciliation } from '../../types/orcamentoTypes'
import {
  CLIENTES_STORAGE_KEY,
  CLIENTS_RECONCILIATION_KEY,
  CONSULTORES_CACHE_KEY,
  CLIENT_SERVER_ID_MAP_STORAGE_KEY,
  CLIENTE_INICIAL,
  cloneClienteDados,
  normalizeClienteRegistros,
  persistClientesToLocalStorage,
} from './clienteHelpers'

// ---------------------------------------------------------------------------
// Options interface
// ---------------------------------------------------------------------------

/**
 * Minimal user shape required by the hook.
 * We keep this loose to avoid importing the full Stack Auth SDK type.
 */
type AuthUserLike = { id?: string; primaryEmail?: string } | null | undefined

export interface UseClientStateOptions {
  /** Authentication state string from useAuthSession. */
  meAuthState: string
  /** Counter that increments when the auth token becomes available. */
  authSyncKey: number
  /** Current Stack Auth user (or null/undefined when logged out). */
  user: AuthUserLike
  /**
   * The /me response from the backend (may be null while loading or when
   * unauthenticated).
   */
  me: MeResponse | null
  /** Whether the current user has the admin role. */
  isAdmin: boolean
  /** Whether the current user has the office role. */
  isOffice: boolean
  /** Whether the current user has the financeiro role. */
  isFinanceiro: boolean
  /**
   * Callback to display a toast notification.  The hook calls this when
   * fallback loading is activated due to an API error.
   */
  adicionarNotificacao: (mensagem: string, tipo?: string) => void
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseClientStateResult {
  // State
  cliente: ClienteDados
  setCliente: React.Dispatch<React.SetStateAction<ClienteDados>>
  clientesSalvos: ClienteRegistro[]
  setClientesSalvos: React.Dispatch<React.SetStateAction<ClienteRegistro[]>>
  clientsSyncState: ClientsSyncState
  setClientsSyncState: React.Dispatch<React.SetStateAction<ClientsSyncState>>
  clientsSource: ClientsSource
  setClientsSource: React.Dispatch<React.SetStateAction<ClientsSource>>
  clientsLastLoadError: string | null
  setClientsLastLoadError: React.Dispatch<React.SetStateAction<string | null>>
  clientsLastDeleteError: string | null
  setClientsLastDeleteError: React.Dispatch<React.SetStateAction<string | null>>
  lastSuccessfulApiLoadAt: number | null
  setLastSuccessfulApiLoadAt: React.Dispatch<React.SetStateAction<number | null>>
  lastDeleteReconciledAt: number | null
  setLastDeleteReconciledAt: React.Dispatch<React.SetStateAction<number | null>>
  reconciliationReady: boolean
  setReconciliationReady: React.Dispatch<React.SetStateAction<boolean>>
  allConsultores: ConsultantEntry[]
  setAllConsultores: React.Dispatch<React.SetStateAction<ConsultantEntry[]>>
  formConsultores: ConsultantPickerEntry[]
  setFormConsultores: React.Dispatch<React.SetStateAction<ConsultantPickerEntry[]>>
  clienteEmEdicaoId: string | null
  setClienteEmEdicaoId: React.Dispatch<React.SetStateAction<string | null>>
  originalClientData: ClienteDados
  setOriginalClientData: React.Dispatch<React.SetStateAction<ClienteDados>>
  clientLastSaveStatus: 'idle' | 'saving' | 'success' | 'error'
  setClientLastSaveStatus: React.Dispatch<React.SetStateAction<'idle' | 'saving' | 'success' | 'error'>>
  clienteMensagens: ClienteMensagens
  setClienteMensagens: React.Dispatch<React.SetStateAction<ClienteMensagens>>

  // Refs
  clienteRef: React.MutableRefObject<ClienteDados>
  clienteEmEdicaoIdRef: React.MutableRefObject<string | null>
  lastSavedClienteRef: React.MutableRefObject<ClienteDados | null>
  clientsLoadInFlightRef: React.MutableRefObject<Promise<ClienteRegistro[]> | null>
  clientAutoSaveTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  clientsSyncStateRef: React.MutableRefObject<ClientsSyncState>
  deletingClientIdsRef: React.MutableRefObject<Set<string>>
  deletedClientKeysRef: React.MutableRefObject<Set<string>>
  clientServerIdMapRef: React.MutableRefObject<Record<string, string>>
  clientServerAutoSaveInFlightRef: React.MutableRefObject<boolean>
  clientLastPayloadSignatureRef: React.MutableRefObject<string | null>
  consultantBackfillRanRef: React.MutableRefObject<boolean>
  myConsultorDefaultRef: React.MutableRefObject<{ id: string; nome: string } | null>

  // Callbacks
  updateClientServerIdMap: (localClientId: string, serverId: string) => void
  removeClientServerIdMapEntry: (localClientId: string) => void
  setClienteSync: (next: ClienteDados) => void
  updateClienteSync: (patch: Partial<ClienteDados>) => void
  parseClientesSalvos: (existenteRaw: string | null) => ClienteRegistro[]
  carregarClientesSalvos: () => ClienteRegistro[]
  getClientStableKey: (registro: ClienteRegistro) => string
  persistDeletedClientKeys: (keys: Set<string>, reconciledAt: number) => void
  carregarClientesPrioritarios: (options?: { silent?: boolean }) => Promise<ClienteRegistro[]>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClientState(options: UseClientStateOptions): UseClientStateResult {
  const {
    meAuthState,
    authSyncKey,
    user,
    me,
    isAdmin,
    isOffice,
    isFinanceiro,
    adicionarNotificacao,
  } = options

  // ── State ─────────────────────────────────────────────────────────────────

  const [cliente, setCliente] = useState<ClienteDados>(() => cloneClienteDados(CLIENTE_INICIAL))
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
  const [originalClientData, setOriginalClientData] = useState<ClienteDados>(() =>
    cloneClienteDados(CLIENTE_INICIAL),
  )
  const [clientLastSaveStatus, setClientLastSaveStatus] = useState<
    'idle' | 'saving' | 'success' | 'error'
  >('idle')
  const [clienteMensagens, setClienteMensagens] = useState<ClienteMensagens>({})

  // ── Refs ──────────────────────────────────────────────────────────────────

  const clienteRef = useRef<ClienteDados>(cliente)
  const clienteEmEdicaoIdRef = useRef<string | null>(clienteEmEdicaoId)
  const lastSavedClienteRef = useRef<ClienteDados | null>(null)
  const clientsLoadInFlightRef = useRef<Promise<ClienteRegistro[]> | null>(null)
  const clientAutoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clientsSyncStateRef = useRef<ClientsSyncState>(clientsSyncState)
  const deletingClientIdsRef = useRef<Set<string>>(new Set())
  const deletedClientKeysRef = useRef<Set<string>>(new Set())
  const clientServerIdMapRef = useRef<Record<string, string>>({})
  const clientServerAutoSaveInFlightRef = useRef(false)
  const clientLastPayloadSignatureRef = useRef<string | null>(null)
  const consultantBackfillRanRef = useRef(false)
  const myConsultorDefaultRef = useRef<{ id: string; nome: string } | null>(null)

  // ── Hydrate clientServerIdMapRef from localStorage (once on mount) ────────

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

  // ── Callbacks ─────────────────────────────────────────────────────────────

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

  const carregarClientesPrioritarios = useCallback(
    async (options_?: { silent?: boolean }): Promise<ClienteRegistro[]> => {
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

        // All authenticated users: try Neon DB first.
        try {
          const allRegistros: ClienteRegistro[] = []
          const clientMapUpdates: Record<string, string> = {}
          let page = 1
          const limit = 100
          const MAX_PAGES = 50
          for (;;) {
            const result = await listClientsFromApi({ page, limit })
            const { serverClientToRegistro } = await import('./clienteHelpers')
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
          const filteredRegistros = allRegistros.filter(
            (registro) => !deletedClientKeysRef.current.has(getClientStableKey(registro)),
          )
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
          console.error('[clients][load] failed', {
            message: error instanceof Error ? error.message : String(error),
          })
          console.warn('[clients][load] fallback-activated', {
            reason: error instanceof Error ? error.message : String(error),
            sourceAttempted: 'api',
          })
          if (!options_?.silent) {
            adicionarNotificacao(
              localFallback
                ? 'Clientes em modo local temporário: backend indisponível no momento.'
                : 'Falha ao recarregar a lista de clientes do banco. Alterações confirmadas podem demorar para aparecer.',
              localFallback ? 'error' : 'info',
            )
          }
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
            const reconciled = registros.filter(
              (registro) => !deletedClientKeysRef.current.has(getClientStableKey(registro)),
            )
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
            if (import.meta.env.DEV)
              console.debug('Leitura via OneDrive ignorada: integração não configurada.')
          } else {
            console.warn('Não foi possível carregar clientes via OneDrive.', error)
          }
        }

        const local = carregarClientesSalvos()
        const reconciled = local.filter(
          (registro) => !deletedClientKeysRef.current.has(getClientStableKey(registro)),
        )
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
    },
    [adicionarNotificacao, carregarClientesSalvos, getClientStableKey, meAuthState, parseClientesSalvos],
  )

  // ── Effect: restore reconciliation state ──────────────────────────────────

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

  // ── Effect: keep clientsSyncStateRef in sync ───────────────────────────────

  useEffect(() => {
    clientsSyncStateRef.current = clientsSyncState
  }, [clientsSyncState])

  // ── Effect: initial clients load ──────────────────────────────────────────

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

  // ── Effect: load all consultants (privileged users) ───────────────────────

  useEffect(() => {
    if (!user || !(isAdmin || isOffice || isFinanceiro)) {
      setAllConsultores([])
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

  // ── Effect: load form consultants + auto-detect for current user ───────────

  useEffect(() => {
    if (!user) {
      setFormConsultores([])
      return
    }
    let cancelado = false

    fetchConsultantsForPicker()
      .then((entries) => {
        if (cancelado) return
        setFormConsultores(entries)
      })
      .catch(() => {
        // Non-critical
      })

    const runAutoDetection = () => {
      if (import.meta.env.DEV) {
        console.debug('[consultant][auto-detect] Running auto-detection...')
      }
      import('../../services/personnelApi').then(({ autoDetectLinkedConsultant }) => {
        autoDetectLinkedConsultant()
          .then((result) => {
            if (cancelado) return
            if (result.consultant && me) {
              const defaultNome = me.fullName?.trim() || consultorDisplayName(result.consultant)
              myConsultorDefaultRef.current = { id: String(result.consultant.id), nome: defaultNome }
              const current = clienteRef.current ?? cliente
              updateClienteSync({ consultorId: String(result.consultant.id), consultorNome: defaultNome })
              if (import.meta.env.DEV) {
                console.debug('[consultant][auto-detect] Matched consultant via', result.matchType, {
                  consultantId: result.consultant.id,
                  nome: defaultNome,
                  currentClienteConsultorId: current.consultorId,
                })
              }
            } else if (result.consultant === null && me) {
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
        // Module import failed
      })
    }

    runAutoDetection()

    const cleanup = import('../../events/consultantEvents').then(({ onConsultantLinkChanged }) => {
      return onConsultantLinkChanged((detail) => {
        const matchesById = me?.id && detail.userId === me.id
        const matchesByAuthId = me?.authProviderId && detail.userId === me.authProviderId

        if (import.meta.env.DEV) {
          console.debug('[consultant][auto-detect] Link change event received', {
            detail,
            me: { id: me?.id, authProviderId: me?.authProviderId },
            matchesById,
            matchesByAuthId,
            willRunDetection: matchesById || matchesByAuthId,
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
  }, [user, authSyncKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // Note: me, cliente, updateClienteSync are intentionally excluded from deps
  // (matches original App.tsx behavior to avoid spurious re-runs)

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    // State
    cliente,
    setCliente,
    clientesSalvos,
    setClientesSalvos,
    clientsSyncState,
    setClientsSyncState,
    clientsSource,
    setClientsSource,
    clientsLastLoadError,
    setClientsLastLoadError,
    clientsLastDeleteError,
    setClientsLastDeleteError,
    lastSuccessfulApiLoadAt,
    setLastSuccessfulApiLoadAt,
    lastDeleteReconciledAt,
    setLastDeleteReconciledAt,
    reconciliationReady,
    setReconciliationReady,
    allConsultores,
    setAllConsultores,
    formConsultores,
    setFormConsultores,
    clienteEmEdicaoId,
    setClienteEmEdicaoId,
    originalClientData,
    setOriginalClientData,
    clientLastSaveStatus,
    setClientLastSaveStatus,
    clienteMensagens,
    setClienteMensagens,

    // Refs
    clienteRef,
    clienteEmEdicaoIdRef,
    lastSavedClienteRef,
    clientsLoadInFlightRef,
    clientAutoSaveTimeoutRef,
    clientsSyncStateRef,
    deletingClientIdsRef,
    deletedClientKeysRef,
    clientServerIdMapRef,
    clientServerAutoSaveInFlightRef,
    clientLastPayloadSignatureRef,
    consultantBackfillRanRef,
    myConsultorDefaultRef,

    // Callbacks
    updateClientServerIdMap,
    removeClientServerIdMapEntry,
    setClienteSync,
    updateClienteSync,
    parseClientesSalvos,
    carregarClientesSalvos,
    getClientStableKey,
    persistDeletedClientKeys,
    carregarClientesPrioritarios,
  }
}
