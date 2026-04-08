/**
 * CRUD operations for offline proposals in IndexedDB.
 */

import { offlineProposalsStore, syncMetadataStore } from './offlineDb'
import type { OfflineProposal, IdMapping } from './types'

function generateLocalId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

/**
 * Save a new offline proposal.
 */
export async function saveOfflineProposal(
  data: Omit<OfflineProposal, 'local_id' | 'created_at' | 'updated_at' | 'is_pending_sync' | 'is_conflicted' | 'conflict_reason' | 'server_id'>
): Promise<OfflineProposal> {
  const proposal: OfflineProposal = {
    ...data,
    local_id: generateLocalId(),
    server_id: null,
    created_at: now(),
    updated_at: now(),
    is_pending_sync: true,
    is_conflicted: false,
    conflict_reason: null,
  }
  await offlineProposalsStore.setItem(proposal.local_id, proposal)
  return proposal
}

/**
 * Update an existing offline proposal.
 */
export async function updateOfflineProposal(
  localId: string,
  patch: Partial<Omit<OfflineProposal, 'local_id' | 'created_at'>>
): Promise<OfflineProposal | null> {
  const existing = await offlineProposalsStore.getItem<OfflineProposal>(localId)
  if (!existing) return null
  const updated: OfflineProposal = {
    ...existing,
    ...patch,
    local_id: localId,
    updated_at: now(),
    is_pending_sync: true,
  }
  await offlineProposalsStore.setItem(localId, updated)
  return updated
}

/**
 * Get a single offline proposal by local_id.
 */
export async function getOfflineProposal(localId: string): Promise<OfflineProposal | null> {
  return offlineProposalsStore.getItem<OfflineProposal>(localId)
}

/**
 * List all offline proposals.
 */
export async function listOfflineProposals(): Promise<OfflineProposal[]> {
  const proposals: OfflineProposal[] = []
  await offlineProposalsStore.iterate((value: unknown) => {
    proposals.push(value as OfflineProposal)
  })
  return proposals
}

/**
 * List all offline proposals for a given local client ID.
 */
export async function listOfflineProposalsByClient(clientLocalId: string): Promise<OfflineProposal[]> {
  const proposals: OfflineProposal[] = []
  await offlineProposalsStore.iterate((value: unknown) => {
    const p = value as OfflineProposal
    if (p.client_local_id === clientLocalId) proposals.push(p)
  })
  return proposals
}

/**
 * Mark a proposal as synced.
 */
export async function markProposalSynced(localId: string, serverId: string): Promise<void> {
  const existing = await offlineProposalsStore.getItem<OfflineProposal>(localId)
  if (existing) {
    await offlineProposalsStore.setItem(localId, {
      ...existing,
      server_id: serverId,
      is_pending_sync: false,
      is_conflicted: false,
      conflict_reason: null,
      updated_at: now(),
    })
  }
  const mapping: IdMapping = {
    entity_type: 'proposal',
    local_id: localId,
    server_id: serverId,
    synced_at: now(),
  }
  await syncMetadataStore.setItem(`proposal_map:${localId}`, mapping)
}

/**
 * Mark a proposal as conflicted.
 */
export async function markProposalConflicted(localId: string, reason: string): Promise<void> {
  const existing = await offlineProposalsStore.getItem<OfflineProposal>(localId)
  if (existing) {
    await offlineProposalsStore.setItem(localId, {
      ...existing,
      is_conflicted: true,
      conflict_reason: reason,
      updated_at: now(),
    })
  }
}

/**
 * Update proposal's client server ID after the client was synced.
 */
export async function updateProposalClientServerId(
  clientLocalId: string,
  clientServerId: string
): Promise<void> {
  await offlineProposalsStore.iterate(async (value: unknown, key: unknown) => {
    const p = value as OfflineProposal
    if (p.client_local_id === clientLocalId && !p.client_server_id) {
      await offlineProposalsStore.setItem(key as string, {
        ...p,
        client_server_id: clientServerId,
      })
    }
  })
}

/**
 * Get proposal's server_id from local mapping.
 */
export async function getProposalServerId(localId: string): Promise<string | null> {
  const mapping = await syncMetadataStore.getItem<IdMapping>(`proposal_map:${localId}`)
  return mapping?.server_id ?? null
}
