/**
 * Local Draft Cache — IndexedDB storage for complete proposal snapshots.
 *
 * ⚠️  THIS IS NOT THE SOURCE OF TRUTH FOR PROPOSALS.
 *
 * The official source of truth is the Neon database, accessed via:
 *   GET/POST/PATCH/DELETE /api/proposals
 * See docs/PROPOSALS_SOURCE_OF_TRUTH.md for the full architectural decision.
 *
 * This store exists solely as a local draft cache to:
 *   1. Restore all 80+ form fields after a page reload during active editing.
 *   2. Provide offline/fallback access when the backend is temporarily unavailable.
 *
 * Rules:
 *   - If `persistedProposalId` is set (from the backend), the backend copy is authoritative.
 *   - This cache should be cleared after a successful backend sync or on logout.
 *   - Never use this store as the primary source for listing or displaying proposals.
 */

import localforage from 'localforage'

const __DEV__ = import.meta.env.DEV

// Minimal type definition for the snapshot data stored by this cache.
// The authoritative definition lives in src/App.tsx as OrcamentoSnapshotData.
type OrcamentoSnapshotData = {
  cliente?: {
    nome?: string | null
    endereco?: string | null
    documento?: string | null
    [key: string]: unknown
  } | null
  kcKwhMes?: number | string | null
  [key: string]: unknown
}

const proposalStore = localforage.createInstance({
  name: 'solarinvest-app',
  storeName: 'proposals',
  description: 'Complete proposal snapshots indexed by budget ID',
})

type ProposalPayload = {
  version: 1
  savedAt: string
  snapshot: OrcamentoSnapshotData
}

/**
 * Check if a snapshot has meaningful data (not empty)
 */
function isMeaningfulSnapshot(snapshot: OrcamentoSnapshotData): boolean {
  if (!snapshot) return false
  
  const nome = (snapshot.cliente?.nome ?? '').trim()
  const endereco = (snapshot.cliente?.endereco ?? '').trim()
  const documento = (snapshot.cliente?.documento ?? '').trim()
  const kc = Number(snapshot.kcKwhMes ?? 0)
  
  const hasCliente = Boolean(nome || endereco || documento)
  const hasConsumption = kc > 0
  
  // Accept if has client data OR consumption, or any other strong signal
  return hasCliente || hasConsumption
}

/**
 * Save a complete proposal snapshot by budget ID with read-after-write verification
 */
export async function saveProposalSnapshotById(
  budgetId: string,
  snapshot: OrcamentoSnapshotData,
): Promise<void> {
  const key = `proposal:${budgetId}`
  
  // Guard: Block empty snapshots from being saved
  if (!isMeaningfulSnapshot(snapshot)) {
    if (__DEV__) console.debug('[proposalStore] BLOCKED save of empty snapshot for budget:', budgetId)
    return
  }
  
  // Create payload with versioning
  const payload: ProposalPayload = {
    version: 1,
    savedAt: new Date().toISOString(),
    snapshot: structuredClone(snapshot), // Prevent mutation after save
  }
  
  await proposalStore.setItem(key, payload)
  
  if (__DEV__) {
    console.debug('[proposalStore] Saved snapshot for budget:', budgetId)
  }
}

/**
 * Load a complete proposal snapshot by budget ID
 */
export async function loadProposalSnapshotById(
  budgetId: string,
): Promise<OrcamentoSnapshotData | null> {
  const key = `proposal:${budgetId}`
  const payload = await proposalStore.getItem<ProposalPayload>(key)
  
  if (!payload) {
    if (__DEV__) console.debug('[proposalStore] No snapshot found for budget:', budgetId)
    return null
  }
  
  if (__DEV__) {
    console.debug('[proposalStore] Loaded snapshot for budget:', budgetId, {
      totalFields: payload.snapshot ? Object.keys(payload.snapshot).length : 0,
    })
  }
  
  return payload.snapshot
}

/**
 * List all stored proposal IDs
 */
export async function listProposalIds(): Promise<string[]> {
  const keys = await proposalStore.keys()
  return keys
    .filter((k) => typeof k === 'string' && k.startsWith('proposal:'))
    .map((k) => (k).replace('proposal:', ''))
}

/**
 * Delete a proposal snapshot by budget ID
 */
export async function deleteProposalById(budgetId: string): Promise<void> {
  const key = `proposal:${budgetId}`
  await proposalStore.removeItem(key)
  if (__DEV__) console.debug(`[proposalStore] Deleted snapshot for budget: ${budgetId}`)
}

/**
 * Clear all proposal snapshots (use with caution)
 */
export async function clearAllProposals(): Promise<void> {
  await proposalStore.clear()
  if (__DEV__) console.debug('[proposalStore] Cleared all proposal snapshots')
}
