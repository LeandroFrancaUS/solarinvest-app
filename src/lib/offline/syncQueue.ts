/**
 * Sync queue management.
 * Operations are stored in IndexedDB and processed in creation order.
 */

import { syncQueueStore } from './offlineDb'
import type { SyncQueueItem, EntityType, SyncOperationType } from './types'

function now(): string {
  return new Date().toISOString()
}

/**
 * Enqueue a new sync operation.
 */
export async function enqueueSyncOperation(
  params: Pick<SyncQueueItem, 'entity_type' | 'entity_local_id' | 'entity_server_id' | 'operation_type' | 'payload' | 'user_id'>
): Promise<SyncQueueItem> {
  const item: SyncQueueItem = {
    operation_id: crypto.randomUUID(),
    ...params,
    created_at: now(),
    last_attempt_at: null,
    attempt_count: 0,
    status: 'pending',
    error_code: null,
    error_message: null,
  }
  await syncQueueStore.setItem(item.operation_id, item)
  return item
}

/**
 * Get all pending operations sorted by created_at (ascending).
 * Clients always before proposals for ordering.
 */
export async function getPendingOperations(): Promise<SyncQueueItem[]> {
  const items: SyncQueueItem[] = []
  await syncQueueStore.iterate((value: unknown) => {
    const item = value as SyncQueueItem
    if (item.status === 'pending' || item.status === 'failed') {
      items.push(item)
    }
  })
  // Clients first, then proposals; within each type: by created_at asc
  return items.sort((a, b) => {
    if (a.entity_type !== b.entity_type) {
      return a.entity_type === 'client' ? -1 : 1
    }
    return a.created_at.localeCompare(b.created_at)
  })
}

/**
 * Get all sync queue items (for display/diagnostics).
 */
export async function getAllQueueItems(): Promise<SyncQueueItem[]> {
  const items: SyncQueueItem[] = []
  await syncQueueStore.iterate((value: unknown) => {
    items.push(value as SyncQueueItem)
  })
  return items.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/**
 * Mark an operation as syncing (in progress).
 */
export async function markOperationSyncing(operationId: string): Promise<void> {
  const item = await syncQueueStore.getItem<SyncQueueItem>(operationId)
  if (item) {
    await syncQueueStore.setItem(operationId, {
      ...item,
      status: 'syncing',
      last_attempt_at: now(),
      attempt_count: item.attempt_count + 1,
    })
  }
}

/**
 * Mark an operation as done.
 */
export async function markOperationDone(operationId: string, serverId: string | null): Promise<void> {
  const item = await syncQueueStore.getItem<SyncQueueItem>(operationId)
  if (item) {
    await syncQueueStore.setItem(operationId, {
      ...item,
      status: 'done',
      entity_server_id: serverId ?? item.entity_server_id,
      last_attempt_at: now(),
    })
  }
}

/**
 * Mark an operation as failed.
 */
export async function markOperationFailed(
  operationId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  const item = await syncQueueStore.getItem<SyncQueueItem>(operationId)
  if (item) {
    await syncQueueStore.setItem(operationId, {
      ...item,
      status: 'failed',
      error_code: errorCode,
      error_message: errorMessage,
      last_attempt_at: now(),
    })
  }
}

/**
 * Mark an operation as conflicted.
 */
export async function markOperationConflict(
  operationId: string,
  reason: string
): Promise<void> {
  const item = await syncQueueStore.getItem<SyncQueueItem>(operationId)
  if (item) {
    await syncQueueStore.setItem(operationId, {
      ...item,
      status: 'conflict',
      error_message: reason,
      last_attempt_at: now(),
    })
  }
}

/**
 * Count pending operations.
 */
export async function countPendingOperations(): Promise<number> {
  let count = 0
  await syncQueueStore.iterate((value: unknown) => {
    const item = value as SyncQueueItem
    if (item.status === 'pending' || item.status === 'failed') count++
  })
  return count
}

/**
 * Remove completed operations older than a given date.
 */
export async function pruneCompletedOperations(olderThanMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString()
  const toDelete: string[] = []
  await syncQueueStore.iterate((value: unknown, key: unknown) => {
    const item = value as SyncQueueItem
    if (item.status === 'done' && item.created_at < cutoff) {
      toDelete.push(key as string)
    }
  })
  await Promise.all(toDelete.map((k) => syncQueueStore.removeItem(k)))
}

/**
 * Check whether an operation with the same entity_local_id + operation_type is already queued.
 * Used to prevent duplicate queuing.
 */
export async function isDuplicateOperation(
  entityLocalId: string,
  operationType: SyncOperationType,
  entityType: EntityType
): Promise<boolean> {
  let found = false
  await syncQueueStore.iterate((value: unknown) => {
    const item = value as SyncQueueItem
    if (
      item.entity_local_id === entityLocalId &&
      item.operation_type === operationType &&
      item.entity_type === entityType &&
      (item.status === 'pending' || item.status === 'syncing')
    ) {
      found = true
      return undefined
    }
  })
  return found
}
