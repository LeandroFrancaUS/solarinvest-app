/**
 * Offline-first sync engine.
 *
 * Processes the sync queue when the app comes online.
 * Handles client deduplication by CPF and proposal-client linking.
 *
 * Ordering guarantee: clients are always synced before proposals.
 * Idempotency: uses offline_origin_id as idempotency key on the backend.
 */

import {
  getPendingOperations,
  markOperationSyncing,
  markOperationDone,
  markOperationFailed,
  markOperationConflict,
  pruneCompletedOperations,
} from '../offline/syncQueue'
import {
  markClientSynced,
  updateOfflineClient,
  getClientServerId,
} from '../offline/offlineClients'
import {
  markProposalSynced,
  markProposalConflicted,
  updateProposalClientServerId,
  getProposalServerId,
} from '../offline/offlineProposals'
import {
  markSyncing,
  markSyncDone,
  markSyncError,
  isOnline,
} from '../connectivity/connectivityService'
import type { SyncQueueItem } from '../offline/types'

export type SyncResultStatus = 'success' | 'partial' | 'error' | 'nothing_to_sync'

export interface SyncResult {
  status: SyncResultStatus
  synced: number
  failed: number
  conflicts: number
  errors: string[]
}

let _isSyncing = false
let _syncListeners: Array<(result: SyncResult) => void> = []

export function onSyncComplete(listener: (result: SyncResult) => void): () => void {
  _syncListeners.push(listener)
  return () => {
    _syncListeners = _syncListeners.filter((l) => l !== listener)
  }
}

async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  }
  const resp = await fetch(path, { ...options, headers })
  let data: unknown
  try {
    data = await resp.json()
  } catch {
    data = null
  }
  return { ok: resp.ok, status: resp.status, data }
}

// Token provider — set by the app on startup
let _getToken: (() => Promise<string | null>) | null = null

export function setSyncTokenProvider(fn: () => Promise<string | null>) {
  _getToken = fn
}

async function getAccessToken(): Promise<string | null> {
  if (!_getToken) return null
  return _getToken()
}

interface OpResult {
  serverId: string | null
  ok: boolean
  errorCode?: string
  errorMessage?: string
}

/**
 * Sync a single client operation.
 */
async function syncClientOperation(op: SyncQueueItem): Promise<OpResult> {
  const payload = op.payload

  if (op.operation_type === 'create') {
    const result = await apiFetch('/api/clients/upsert-by-cpf', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        offline_origin_id: op.entity_local_id,
      }),
    })
    if (result.ok) {
      const data = result.data as { data?: { id?: string | number } }
      const serverId = String(data?.data?.id ?? '')
      return { serverId: serverId || null, ok: true }
    }
    const err = result.data as { error?: { code?: string; message?: string } }
    return {
      ok: false,
      serverId: null,
      errorCode: err?.error?.code ?? `HTTP_${result.status}`,
      errorMessage: err?.error?.message ?? 'Unknown error',
    }
  }

  if (op.operation_type === 'update') {
    const serverId = op.entity_server_id ?? await getClientServerId(op.entity_local_id)
    if (!serverId) {
      return { ok: false, serverId: null, errorCode: 'NO_SERVER_ID', errorMessage: 'Client not yet synced' }
    }
    const result = await apiFetch(`/api/clients/${serverId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    if (result.ok) return { serverId, ok: true }
    const err = result.data as { error?: { code?: string; message?: string } }
    return {
      ok: false,
      serverId: null,
      errorCode: err?.error?.code ?? `HTTP_${result.status}`,
      errorMessage: err?.error?.message ?? 'Unknown error',
    }
  }

  return { ok: false, serverId: null, errorCode: 'UNSUPPORTED_OP', errorMessage: `Operation type ${op.operation_type} not supported` }
}

/**
 * Sync a single proposal operation.
 */
async function syncProposalOperation(op: SyncQueueItem): Promise<OpResult> {
  const payload = op.payload

  if (op.operation_type === 'create') {
    let clientServerId = payload.client_server_id as string | undefined
    if (!clientServerId && payload.client_local_id) {
      clientServerId = (await getClientServerId(payload.client_local_id as string)) ?? undefined
    }

    const result = await apiFetch('/api/proposals', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        client_id: clientServerId ?? null,
        offline_origin_id: op.entity_local_id,
      }),
    })
    if (result.ok) {
      const data = result.data as { data?: { id?: string } }
      return { serverId: data?.data?.id ?? null, ok: true }
    }
    const err = result.data as { error?: { code?: string; message?: string } }
    return {
      ok: false,
      serverId: null,
      errorCode: err?.error?.code ?? `HTTP_${result.status}`,
      errorMessage: err?.error?.message ?? 'Unknown error',
    }
  }

  if (op.operation_type === 'update') {
    const serverId = op.entity_server_id ?? await getProposalServerId(op.entity_local_id)
    if (!serverId) {
      return { ok: false, serverId: null, errorCode: 'NO_SERVER_ID', errorMessage: 'Proposal not yet synced' }
    }
    const result = await apiFetch(`/api/proposals/${serverId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    if (result.ok) return { serverId, ok: true }
    const err = result.data as { error?: { code?: string; message?: string } }
    return {
      ok: false,
      serverId: null,
      errorCode: err?.error?.code ?? `HTTP_${result.status}`,
      errorMessage: err?.error?.message ?? 'Unknown error',
    }
  }

  return { ok: false, serverId: null, errorCode: 'UNSUPPORTED_OP', errorMessage: `Operation type ${op.operation_type} not supported` }
}

/**
 * Process a single queue item.
 */
async function processOperation(op: SyncQueueItem): Promise<OpResult> {
  await markOperationSyncing(op.operation_id)

  if (op.entity_type === 'client') {
    return syncClientOperation(op)
  }
  if (op.entity_type === 'proposal') {
    return syncProposalOperation(op)
  }
  return { ok: false, serverId: null, errorCode: 'UNKNOWN_ENTITY', errorMessage: `Unknown entity type: ${String(op.entity_type)}` }
}

/**
 * Run the sync engine. Safe to call multiple times — only one instance runs at a time.
 */
export async function runSync(): Promise<SyncResult> {
  if (_isSyncing) {
    return { status: 'error', synced: 0, failed: 0, conflicts: 0, errors: ['Already syncing'] }
  }

  if (!isOnline()) {
    return { status: 'error', synced: 0, failed: 0, conflicts: 0, errors: ['Offline'] }
  }

  const pending = await getPendingOperations()
  if (pending.length === 0) {
    await pruneCompletedOperations()
    return { status: 'nothing_to_sync', synced: 0, failed: 0, conflicts: 0, errors: [] }
  }

  _isSyncing = true
  markSyncing()

  let synced = 0
  let failed = 0
  let conflicts = 0
  const errors: string[] = []

  for (const op of pending) {
    try {
      const result = await processOperation(op)
      if (result.ok) {
        await markOperationDone(op.operation_id, result.serverId)
        if (op.entity_type === 'client' && result.serverId) {
          await markClientSynced(op.entity_local_id, result.serverId)
          await updateProposalClientServerId(op.entity_local_id, result.serverId)
        }
        if (op.entity_type === 'proposal' && result.serverId) {
          await markProposalSynced(op.entity_local_id, result.serverId)
        }
        synced++
      } else {
        const isConflict = result.errorCode === 'CONFLICT' || result.errorCode === 'CPF_CONFLICT'
        if (isConflict) {
          await markOperationConflict(op.operation_id, result.errorMessage ?? 'Conflict')
          if (op.entity_type === 'proposal') {
            await markProposalConflicted(op.entity_local_id, result.errorMessage ?? 'Conflict')
          }
          conflicts++
          errors.push(`Conflict on ${op.entity_type} ${op.entity_local_id}: ${result.errorMessage ?? ''}`)
        } else {
          await markOperationFailed(
            op.operation_id,
            result.errorCode ?? 'UNKNOWN',
            result.errorMessage ?? 'Unknown error'
          )
          if (op.entity_type === 'client') {
            await updateOfflineClient(op.entity_local_id, {})
          }
          failed++
          errors.push(`Failed ${op.entity_type} ${op.entity_local_id}: [${result.errorCode}] ${result.errorMessage ?? ''}`)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await markOperationFailed(op.operation_id, 'EXCEPTION', message)
      failed++
      errors.push(`Exception on ${op.entity_type} ${op.entity_local_id}: ${message}`)
    }
  }

  await pruneCompletedOperations()

  _isSyncing = false

  const status: SyncResultStatus =
    failed === 0 && conflicts === 0 ? 'success' :
    synced > 0 ? 'partial' : 'error'

  if (status === 'success' || status === 'partial') {
    markSyncDone()
  } else {
    markSyncError()
  }

  const syncResult: SyncResult = { status, synced, failed, conflicts, errors }
  _syncListeners.forEach((fn) => fn(syncResult))

  return syncResult
}
