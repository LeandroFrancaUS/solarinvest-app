/**
 * Proposal Store - IndexedDB storage for complete proposal snapshots
 * 
 * Stores complete proposal snapshots by budget ID to enable full restoration
 * when loading from the proposal list. This ensures all 80+ fields are preserved.
 */

import localforage from 'localforage'
import type { OrcamentoSnapshotData } from '../../types'

const proposalStore = localforage.createInstance({
  name: 'solarinvest-app',
  storeName: 'proposals',
  description: 'Complete proposal snapshots indexed by budget ID',
})

/**
 * Save a complete proposal snapshot by budget ID
 */
export async function saveProposalSnapshotById(
  budgetId: string,
  snapshot: OrcamentoSnapshotData,
): Promise<void> {
  const key = `proposal:${budgetId}`
  await proposalStore.setItem(key, snapshot)
  console.log(`[proposalStore] Saved complete snapshot for budget: ${budgetId}`)
}

/**
 * Load a complete proposal snapshot by budget ID
 */
export async function loadProposalSnapshotById(
  budgetId: string,
): Promise<OrcamentoSnapshotData | null> {
  const key = `proposal:${budgetId}`
  const snapshot = await proposalStore.getItem<OrcamentoSnapshotData>(key)
  
  if (snapshot) {
    console.log(`[proposalStore] Loaded complete snapshot for budget: ${budgetId}`)
  } else {
    console.warn(`[proposalStore] No snapshot found for budget: ${budgetId}`)
  }
  
  return snapshot
}

/**
 * List all stored proposal IDs
 */
export async function listProposalIds(): Promise<string[]> {
  const keys = await proposalStore.keys()
  return keys
    .filter((k) => typeof k === 'string' && k.startsWith('proposal:'))
    .map((k) => (k as string).replace('proposal:', ''))
}

/**
 * Delete a proposal snapshot by budget ID
 */
export async function deleteProposalById(budgetId: string): Promise<void> {
  const key = `proposal:${budgetId}`
  await proposalStore.removeItem(key)
  console.log(`[proposalStore] Deleted snapshot for budget: ${budgetId}`)
}

/**
 * Clear all proposal snapshots (use with caution)
 */
export async function clearAllProposals(): Promise<void> {
  await proposalStore.clear()
  console.log('[proposalStore] Cleared all proposal snapshots')
}
