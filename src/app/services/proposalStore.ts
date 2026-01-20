/**
 * proposalStore - Instrumented proposal storage with logging
 * 
 * Provides save/load operations for complete proposal snapshots with detailed logging
 * for debugging proposal loading issues.
 */

import type { OrcamentoSnapshotData } from '../../App'

const PROPOSAL_SNAPSHOTS_PREFIX = 'solarinvest-proposal-snapshot-'

type SnapshotSummary = {
  clienteNome: string
  clienteEndereco: string
  kcKwhMes: number
  totalFields: number
}

type StoragePayload = {
  version: number
  updatedAt: string
  data: OrcamentoSnapshotData
  snapshot: OrcamentoSnapshotData  // For backward compatibility
}

/**
 * Generate storage key for a budget ID
 */
function getStorageKey(budgetId: string): string {
  return `${PROPOSAL_SNAPSHOTS_PREFIX}${budgetId}`
}

/**
 * Create a summary of snapshot data for logging
 */
function createSnapshotSummary(snapshot: OrcamentoSnapshotData): SnapshotSummary {
  const totalFields = Object.keys(snapshot).length
  return {
    clienteNome: snapshot.cliente?.nome ?? '',
    clienteEndereco: snapshot.cliente?.endereco ?? '',
    kcKwhMes: snapshot.kcKwhMes ?? 0,
    totalFields,
  }
}

/**
 * Check if snapshot has meaningful data
 */
function hasSnapshotData(snapshot: OrcamentoSnapshotData | null | undefined): boolean {
  if (!snapshot) return false
  
  const totalFields = Object.keys(snapshot).length
  if (totalFields < 20) return false  // Too few fields to be a real snapshot
  
  const hasCliente = !!(snapshot.cliente?.nome || snapshot.cliente?.endereco)
  const hasConsumo = (snapshot.kcKwhMes ?? 0) > 0
  return hasCliente || hasConsumo
}

/**
 * Clone snapshot data to avoid mutations
 */
function cloneSnapshot(snapshot: OrcamentoSnapshotData): OrcamentoSnapshotData {
  return JSON.parse(JSON.stringify(snapshot)) as OrcamentoSnapshotData
}

/**
 * Save a complete snapshot to storage with logging
 */
export async function saveCompleteSnapshot(
  budgetId: string,
  snapshot: OrcamentoSnapshotData,
): Promise<void> {
  const storageKey = getStorageKey(budgetId)
  
  console.log('[proposalStore] SAVE request', { budgetId, storageKey })
  
  const summary = createSnapshotSummary(snapshot)
  console.log('[proposalStore] SAVE payload summary', {
    budgetId,
    clienteNome: summary.clienteNome,
    clienteEndereco: summary.clienteEndereco,
    kcKwhMes: summary.kcKwhMes,
    totalFields: summary.totalFields,
  })

  try {
    // Create payload with both data and snapshot keys for compatibility
    const payload: StoragePayload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      data: cloneSnapshot(snapshot),
      snapshot: cloneSnapshot(snapshot),
    }
    
    const serialized = JSON.stringify(payload)
    localStorage.setItem(storageKey, serialized)
    
    // Read-after-write verification
    const verified = localStorage.getItem(storageKey)
    const found = verified !== null
    
    console.log('[proposalStore] SAVED+VERIFIED', { budgetId, found })
    
    if (!found) {
      console.error('[proposalStore] SAVE FAILED - read-after-write returned null', { budgetId })
    }
  } catch (error) {
    console.error('[proposalStore] SAVE ERROR', { budgetId, error })
    throw error
  }
}

/**
 * Load a complete snapshot from storage with logging
 */
export async function loadCompleteSnapshot(
  budgetId: string,
): Promise<OrcamentoSnapshotData | null> {
  const storageKey = getStorageKey(budgetId)
  
  console.log('[proposalStore] LOAD request', { budgetId, storageKey })
  
  try {
    const serialized = localStorage.getItem(storageKey)
    const found = serialized !== null
    
    if (!found) {
      console.log('[proposalStore] LOAD result', { budgetId, found: false, hasSnapshot: false })
      return null
    }
    
    const payload = JSON.parse(serialized) as Partial<StoragePayload> | OrcamentoSnapshotData
    
    // Extract snapshot from payload (support both old and new formats)
    let snapshot: OrcamentoSnapshotData | null = null
    
    if ('data' in payload && payload.data) {
      snapshot = payload.data
    } else if ('snapshot' in payload && payload.snapshot) {
      snapshot = payload.snapshot
    } else {
      // Old format: payload is the snapshot itself
      snapshot = payload as OrcamentoSnapshotData
    }
    
    const hasData = hasSnapshotData(snapshot)
    
    if (!hasData || !snapshot) {
      console.log('[proposalStore] LOAD result', {
        budgetId,
        found: true,
        hasSnapshot: !!snapshot,
        hasData: false,
        reason: 'Snapshot has insufficient data',
      })
      return null
    }
    
    const summary = createSnapshotSummary(snapshot)
    
    console.log('[proposalStore] LOAD result', {
      budgetId,
      found: true,
      hasSnapshot: true,
      hasData: true,
      clienteNome: summary.clienteNome,
      clienteEndereco: summary.clienteEndereco,
      kcKwhMes: summary.kcKwhMes,
      totalFields: summary.totalFields,
    })
    
    return cloneSnapshot(snapshot)
  } catch (error) {
    console.error('[proposalStore] LOAD ERROR', { budgetId, error })
    return null
  }
}

/**
 * Delete a snapshot from storage
 */
export async function deleteSnapshot(budgetId: string): Promise<void> {
  const storageKey = getStorageKey(budgetId)
  console.log('[proposalStore] DELETE request', { budgetId, storageKey })
  localStorage.removeItem(storageKey)
}
