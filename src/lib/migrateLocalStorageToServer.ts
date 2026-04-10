/**
 * migrateLocalStorageToServer.ts
 *
 * One-shot migration that runs silently on app startup.
 * Reads clients and proposals stored in the browser's localStorage (legacy
 * "solarinvest-clientes" / "solarinvest-orcamentos" keys), pushes each record
 * to the Neon backend via the REST API, and — only after the server confirms
 * the save — purges the local-only entry.
 *
 * Idempotent: a localStorage key `solarinvest-local-migration-done` is set
 * when all records have been migrated. Subsequent calls are no-ops.
 *
 * All network errors are silenced; the app continues normally.
 */

import { resolveApiUrl } from '../utils/apiUrl'
import { normalizeNumbers } from '../utils/formatters'

// ─── Storage key constants (must match App.tsx) ───────────────────────────────
const CLIENTES_STORAGE_KEY = 'solarinvest-clientes'
const BUDGETS_STORAGE_KEY = 'solarinvest-orcamentos'
const CLIENT_SERVER_ID_MAP_STORAGE_KEY = 'solarinvest-client-server-id-map'
const PROPOSAL_SERVER_ID_MAP_STORAGE_KEY = 'solarinvest-proposal-server-id-map'
/** Set to "1" once all locally-stored records have been successfully migrated. */
const MIGRATION_DONE_KEY = 'solarinvest-local-migration-done'

// ─── Minimal types ────────────────────────────────────────────────────────────

interface ClienteDados {
  nome?: string
  documento?: string
  email?: string
  telefone?: string
  cidade?: string
  uf?: string
  endereco?: string
  uc?: string
  distribuidora?: string
  [key: string]: unknown
}

interface ClienteRegistro {
  id: string
  criadoEm?: string
  atualizadoEm?: string
  dados: ClienteDados
  [key: string]: unknown
}

interface OrcamentoSnapshotCliente {
  nome?: string
  documento?: string
  cidade?: string
  uf?: string
  telefone?: string
  email?: string
  [key: string]: unknown
}

interface OrcamentoSnapshot {
  cliente?: OrcamentoSnapshotCliente
  kcKwhMes?: number
  [key: string]: unknown
}

interface OrcamentoSalvo {
  id: string
  criadoEm?: string
  clienteId?: string
  clienteNome?: string
  clienteCidade?: string
  clienteUf?: string
  clienteDocumento?: string
  clienteUc?: string
  dados?: { tipoProposta?: string; [key: string]: unknown }
  snapshot?: OrcamentoSnapshot
  [key: string]: unknown
}

// ─── Token provider ───────────────────────────────────────────────────────────

let _getToken: (() => Promise<string | null>) | null = null

export function setMigrationTokenProvider(fn: () => Promise<string | null>): void {
  _getToken = fn
}

async function authHeader(): Promise<Record<string, string>> {
  if (!_getToken) return {}
  try {
    const token = await _getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiPost(path: string, body: unknown): Promise<{ ok: boolean; data: unknown }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
  }
  const res = await fetch(resolveApiUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(body),
  })
  let data: unknown = null
  try { data = await res.json() } catch { /* ignore */ }
  return { ok: res.ok, data }
}

// ─── ID-map helpers ───────────────────────────────────────────────────────────

function readIdMap(key: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === 'string')
    )
  } catch {
    return {}
  }
}

function writeIdMap(key: string, map: Record<string, string>): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(map))
  } catch { /* ignore */ }
}

// ─── Core logic ───────────────────────────────────────────────────────────────

async function migrateClients(
  registros: ClienteRegistro[]
): Promise<{ clientIdMap: Record<string, string>; migratedIds: Set<string> }> {
  const clientIdMap = readIdMap(CLIENT_SERVER_ID_MAP_STORAGE_KEY)
  const migratedIds = new Set<string>()

  for (const registro of registros) {
    // Skip if we already know this local ID maps to a server ID
    if (clientIdMap[registro.id]) {
      migratedIds.add(registro.id)
      continue
    }

    const dados = registro.dados ?? {}
    const documentDigits = normalizeNumbers(String(dados.documento ?? ''))

    const payload: Record<string, unknown> = {
      name: (dados.nome ?? '').trim() || 'Sem nome',
      metadata: { source: 'local_migration', local_id: registro.id },
    }
    if (dados.email?.trim()) payload.email = dados.email.trim()
    if (dados.telefone?.trim()) payload.phone = dados.telefone.trim()
    if (dados.cidade?.trim()) payload.city = dados.cidade.trim()
    if (dados.uf?.trim()) payload.state = dados.uf.trim()
    if (dados.endereco?.trim()) payload.address = dados.endereco.trim()
    if (dados.uc?.trim()) payload.uc = dados.uc.trim()
    if (dados.distribuidora?.trim()) payload.distribuidora = dados.distribuidora.trim()
    if (documentDigits.length === 11) {
      payload.cpf_raw = documentDigits
      payload.document = documentDigits
    } else if (documentDigits.length === 14) {
      payload.cnpj_raw = documentDigits
      payload.document = documentDigits
    } else if (documentDigits.length > 0) {
      payload.document = documentDigits
    }
    // Pass the local ID as the idempotency key so repeated migration attempts
    // don't create duplicate records.
    payload.offline_origin_id = registro.id

    try {
      const result = await apiPost('/api/clients/upsert-by-cpf', payload)
      if (result.ok) {
        const row = (result.data as { data?: { id?: string } })?.data
        if (row?.id) {
          clientIdMap[registro.id] = row.id
          migratedIds.add(registro.id)
        }
      }
    } catch (err) {
      console.warn('[Migration] Client upsert failed for local id', registro.id, err)
    }
  }

  writeIdMap(CLIENT_SERVER_ID_MAP_STORAGE_KEY, clientIdMap)
  return { clientIdMap, migratedIds }
}

async function migrateProposals(
  registros: OrcamentoSalvo[],
  clientIdMap: Record<string, string>
): Promise<Set<string>> {
  const proposalIdMap = readIdMap(PROPOSAL_SERVER_ID_MAP_STORAGE_KEY)
  const migratedIds = new Set<string>()

  for (const registro of registros) {
    // Skip if already mapped to a server ID
    if (proposalIdMap[registro.id]) {
      migratedIds.add(registro.id)
      continue
    }

    const snapshot = registro.snapshot ?? {}
    const cliente = snapshot.cliente ?? {}
    const tipoProposta = registro.dados?.tipoProposta
    const proposalType = tipoProposta === 'VENDA_DIRETA' ? 'venda' : 'leasing'

    const payload: Record<string, unknown> = {
      proposal_type: proposalType,
      proposal_code: registro.id,
      payload_json: snapshot,
      // Link to the server-side client ID when available
      ...(registro.clienteId && clientIdMap[registro.clienteId]
        ? { client_id: clientIdMap[registro.clienteId] }
        : {}),
      metadata: { source: 'local_migration', local_id: registro.id },
    }
    if (registro.clienteNome?.trim()) payload.client_name = registro.clienteNome.trim()
    else if (cliente.nome?.trim()) payload.client_name = cliente.nome.trim()

    const doc = registro.clienteDocumento ?? String(cliente.documento ?? '')
    if (doc) payload.client_document = doc

    if (registro.clienteCidade?.trim()) payload.client_city = registro.clienteCidade.trim()
    else if (cliente.cidade) payload.client_city = cliente.cidade

    if (registro.clienteUf?.trim()) payload.client_state = registro.clienteUf.trim()
    else if (cliente.uf) payload.client_state = cliente.uf

    if (cliente.telefone) payload.client_phone = cliente.telefone
    if (cliente.email) payload.client_email = cliente.email
    if (typeof snapshot.kcKwhMes === 'number' && Number.isFinite(snapshot.kcKwhMes)) {
      payload.consumption_kwh_month = snapshot.kcKwhMes
    }
    // Idempotency key: use proposal code/id so retries don't duplicate records
    payload.offline_origin_id = registro.id

    try {
      const result = await apiPost('/api/proposals', payload)
      if (result.ok) {
        const row = (result.data as { data?: { id?: string } })?.data
        if (row?.id) {
          proposalIdMap[registro.id] = row.id
          migratedIds.add(registro.id)
        }
      }
    } catch (err) {
      console.warn('[Migration] Proposal create failed for local id', registro.id, err)
    }
  }

  writeIdMap(PROPOSAL_SERVER_ID_MAP_STORAGE_KEY, proposalIdMap)
  return migratedIds
}

// ─── Purge helpers ────────────────────────────────────────────────────────────

/**
 * Remove migrated client entries from localStorage.
 * Only removes entries whose IDs are confirmed to have a server-side mapping.
 */
function purgeLocalClients(migratedIds: Set<string>): void {
  if (migratedIds.size === 0) return
  try {
    const raw = window.localStorage.getItem(CLIENTES_STORAGE_KEY)
    if (!raw) return
    const all = JSON.parse(raw) as ClienteRegistro[]
    if (!Array.isArray(all)) return
    const remaining = all.filter((r) => !migratedIds.has(r.id))
    if (remaining.length === all.length) return // nothing to purge
    if (remaining.length === 0) {
      window.localStorage.removeItem(CLIENTES_STORAGE_KEY)
    } else {
      window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(remaining))
    }
  } catch { /* ignore */ }
}

/**
 * Remove migrated proposal entries from localStorage.
 */
function purgeLocalProposals(migratedIds: Set<string>): void {
  if (migratedIds.size === 0) return
  try {
    const raw = window.localStorage.getItem(BUDGETS_STORAGE_KEY)
    if (!raw) return
    const all = JSON.parse(raw) as OrcamentoSalvo[]
    if (!Array.isArray(all)) return
    const remaining = all.filter((r) => !migratedIds.has(r.id))
    if (remaining.length === all.length) return
    if (remaining.length === 0) {
      window.localStorage.removeItem(BUDGETS_STORAGE_KEY)
    } else {
      window.localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(remaining))
    }
  } catch { /* ignore */ }
}

// ─── Public entry point ───────────────────────────────────────────────────────

let _migrationInFlight = false

/**
 * Silently migrates any locally-stored clients and proposals to the Neon
 * backend. Safe to call multiple times — only one run executes at a time, and
 * once all records are migrated the function becomes a no-op (checked via a
 * localStorage flag).
 *
 * Call this after the authenticated user and token provider are available.
 */
export async function migrateLocalStorageToServer(): Promise<void> {
  if (typeof window === 'undefined') return
  if (_migrationInFlight) return

  // Clients: read even if migration flag is set — we always try to migrate
  // any NEW locally-stored entries that were added since the last run.
  const clientsRaw = window.localStorage.getItem(CLIENTES_STORAGE_KEY)
  const proposalsRaw = window.localStorage.getItem(BUDGETS_STORAGE_KEY)

  let clientRegistros: ClienteRegistro[] = []
  let proposalRegistros: OrcamentoSalvo[] = []

  try {
    const parsed = clientsRaw ? (JSON.parse(clientsRaw) as unknown) : null
    if (Array.isArray(parsed)) clientRegistros = parsed as ClienteRegistro[]
  } catch { /* ignore */ }

  try {
    const parsed = proposalsRaw ? (JSON.parse(proposalsRaw) as unknown) : null
    if (Array.isArray(parsed)) proposalRegistros = parsed as OrcamentoSalvo[]
  } catch { /* ignore */ }

  const clientIdMap = readIdMap(CLIENT_SERVER_ID_MAP_STORAGE_KEY)
  const proposalIdMap = readIdMap(PROPOSAL_SERVER_ID_MAP_STORAGE_KEY)

  // Determine which records actually need migration
  const clientsToMigrate = clientRegistros.filter((r) => !clientIdMap[r.id])
  const proposalsToMigrate = proposalRegistros.filter((r) => !proposalIdMap[r.id])

  if (clientsToMigrate.length === 0 && proposalsToMigrate.length === 0) {
    window.localStorage.setItem(MIGRATION_DONE_KEY, '1')
    return
  }

  _migrationInFlight = true
  if (import.meta.env.DEV) {
    console.debug('[Migration] Starting local→Neon migration', {
      clients: clientsToMigrate.length,
      proposals: proposalsToMigrate.length,
    })
  }

  try {
    // Clients first so proposals can be linked to their server-side client IDs
    const { clientIdMap: updatedClientMap, migratedIds: migratedClientIds } =
      await migrateClients(clientsToMigrate)

    // Proposals — pass the updated client map for linking
    const migratedProposalIds = await migrateProposals(proposalsToMigrate, updatedClientMap)

    // Purge only after confirmed server saves
    purgeLocalClients(migratedClientIds)
    purgeLocalProposals(migratedProposalIds)

    // Mark done only when everything succeeded
    const allClientsDone = clientsToMigrate.every((r) => migratedClientIds.has(r.id))
    const allProposalsDone = proposalsToMigrate.every((r) => migratedProposalIds.has(r.id))
    if (allClientsDone && allProposalsDone) {
      window.localStorage.setItem(MIGRATION_DONE_KEY, '1')
    }

    if (import.meta.env.DEV) {
      console.debug('[Migration] Done', {
        migratedClients: migratedClientIds.size,
        migratedProposals: migratedProposalIds.size,
      })
    }
  } catch (err) {
    console.warn('[Migration] Unexpected error during migration:', err)
  } finally {
    _migrationInFlight = false
  }
}
