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
    console.warn('[proposalStore] BLOCKED save of empty snapshot', {
      budgetId,
      clienteNome: snapshot?.cliente?.nome ?? '',
      clienteEndereco: snapshot?.cliente?.endereco ?? '',
      clienteDocumento: snapshot?.cliente?.documento ?? '',
      kcKwhMes: snapshot?.kcKwhMes ?? 0,
    })
    return
  }
  
  // Create payload with versioning
  const payload: ProposalPayload = {
    version: 1,
    savedAt: new Date().toISOString(),
    snapshot: structuredClone(snapshot), // Prevent mutation after save
  }
  
  await proposalStore.setItem(key, payload)
  
  // READ-AFTER-WRITE VERIFICATION
  const verify = await proposalStore.getItem<ProposalPayload>(key)
  const snap = verify?.snapshot
  
  // Check if verified data is meaningful
  const hasCliente = Boolean(
    (snap?.cliente?.nome ?? '').trim() ||
    (snap?.cliente?.endereco ?? '').trim() ||
    (snap?.cliente?.documento ?? '').trim()
  )
  const hasConsumption = Number(snap?.kcKwhMes ?? 0) > 0
  
  console.log('[proposalStore] SAVED+VERIFIED', budgetId, {
    hasPayload: !!verify,
    hasSnapshot: !!snap,
    hasCliente,
    hasConsumption,
    clienteNome: snap?.cliente?.nome ?? '',
    clienteEndereco: snap?.cliente?.endereco ?? '',
    kcKwhMes: snap?.kcKwhMes ?? 0,
    totalFields: snap ? Object.keys(snap).length : 0,
  })
  
  if (!verify || !snap) {
    console.error('[proposalStore] SAVE VERIFICATION FAILED - data not persisted correctly!')
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
    console.warn('[proposalStore] No snapshot found for budget:', budgetId)
    return null
  }
  
  const snap = payload.snapshot
  
  console.log('[proposalStore] Loaded complete snapshot for budget:', budgetId, {
    hasSnapshot: !!snap,
    clienteNome: snap?.cliente?.nome ?? '',
    clienteEndereco: snap?.cliente?.endereco ?? '',
    kcKwhMes: snap?.kcKwhMes ?? 0,
    totalFields: snap ? Object.keys(snap).length : 0,
    savedAt: payload.savedAt,
  })
  
  return snap
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
