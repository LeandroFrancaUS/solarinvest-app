/**
 * CRUD operations for offline clients in IndexedDB.
 */

import { offlineClientsStore, syncMetadataStore } from './offlineDb'
import type { OfflineClient, IdMapping } from './types'
import { normalizeCpf, normalizeAndValidateCpf } from '../normalize/cpf'
import { normalizePhone, normalizeEmail, normalizeName } from '../normalize/contact'
import { normalizeCity, normalizeUf } from '../normalize/address'

function generateLocalId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

/**
 * Save a new offline client. Normalizes all fields before storing.
 */
export async function saveOfflineClient(
  data: Omit<OfflineClient, 'local_id' | 'created_at' | 'updated_at' | 'is_pending_sync' | 'is_deleted' | 'server_id'>
): Promise<OfflineClient> {
  const cpfNormalized = normalizeAndValidateCpf(data.cpf_raw) ?? normalizeCpf(data.cpf_raw)
  const client: OfflineClient = {
    ...data,
    local_id: generateLocalId(),
    server_id: null,
    cpf_normalized: cpfNormalized,
    cpf_raw: data.cpf_raw ?? null,
    name: normalizeName(data.name) ?? data.name,
    phone: normalizePhone(data.phone),
    email: normalizeEmail(data.email),
    city: normalizeCity(data.city),
    uf: normalizeUf(data.uf),
    identity_status: cpfNormalized ? 'confirmed' : 'pending_cpf',
    origin: 'offline_sync',
    created_at: now(),
    updated_at: now(),
    is_pending_sync: true,
    is_deleted: false,
  }
  await offlineClientsStore.setItem(client.local_id, client)
  return client
}

/**
 * Update an existing offline client.
 */
export async function updateOfflineClient(
  localId: string,
  patch: Partial<Omit<OfflineClient, 'local_id' | 'created_at'>>
): Promise<OfflineClient | null> {
  const existing = await offlineClientsStore.getItem<OfflineClient>(localId)
  if (!existing) return null
  const updated: OfflineClient = {
    ...existing,
    ...patch,
    local_id: localId,
    updated_at: now(),
    is_pending_sync: true,
  }
  if (patch.cpf_raw !== undefined) {
    updated.cpf_normalized = normalizeAndValidateCpf(patch.cpf_raw) ?? normalizeCpf(patch.cpf_raw)
    updated.identity_status = updated.cpf_normalized ? 'confirmed' : 'pending_cpf'
  }
  await offlineClientsStore.setItem(localId, updated)
  return updated
}

/**
 * Get a single offline client by local_id.
 */
export async function getOfflineClient(localId: string): Promise<OfflineClient | null> {
  return offlineClientsStore.getItem<OfflineClient>(localId)
}

/**
 * List all non-deleted offline clients.
 */
export async function listOfflineClients(): Promise<OfflineClient[]> {
  const clients: OfflineClient[] = []
  await offlineClientsStore.iterate((value: unknown) => {
    const client = value as OfflineClient
    if (!client.is_deleted) clients.push(client)
  })
  return clients
}

/**
 * Find offline client by normalized CPF.
 */
export async function findOfflineClientByCpf(cpfNormalized: string): Promise<OfflineClient | null> {
  let found: OfflineClient | null = null
  await offlineClientsStore.iterate((value: unknown) => {
    const client = value as OfflineClient
    if (!client.is_deleted && client.cpf_normalized === cpfNormalized) {
      found = client
      return undefined
    }
  })
  return found
}

/**
 * Mark a client as synced and update the server_id mapping.
 */
export async function markClientSynced(localId: string, serverId: string): Promise<void> {
  const existing = await offlineClientsStore.getItem<OfflineClient>(localId)
  if (existing) {
    await offlineClientsStore.setItem(localId, {
      ...existing,
      server_id: serverId,
      is_pending_sync: false,
      updated_at: now(),
    })
  }
  const mapping: IdMapping = {
    entity_type: 'client',
    local_id: localId,
    server_id: serverId,
    synced_at: now(),
  }
  await syncMetadataStore.setItem(`client_map:${localId}`, mapping)
}

/**
 * Get server_id for a local_id (from mapping).
 */
export async function getClientServerId(localId: string): Promise<string | null> {
  const mapping = await syncMetadataStore.getItem<IdMapping>(`client_map:${localId}`)
  return mapping?.server_id ?? null
}

/**
 * Soft-delete an offline client.
 */
export async function deleteOfflineClient(localId: string): Promise<void> {
  const existing = await offlineClientsStore.getItem<OfflineClient>(localId)
  if (existing) {
    await offlineClientsStore.setItem(localId, {
      ...existing,
      is_deleted: true,
      is_pending_sync: true,
      updated_at: now(),
    })
  }
}
