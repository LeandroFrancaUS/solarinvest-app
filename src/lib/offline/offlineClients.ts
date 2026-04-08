/**
 * CRUD operations for offline clients in IndexedDB.
 */

import { offlineClientsStore, syncMetadataStore } from './offlineDb'
import type { OfflineClient, IdMapping } from './types'
import { normalizeDocument } from '../normalize/document'
import { normalizePhone, normalizeEmail } from '../normalize/contact'
import { normalizeCity, normalizeUf } from '../normalize/address'

function generateLocalId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

/**
 * Save a new offline client. Normalizes all fields before storing.
 * Accepts either cpf_raw or cnpj_raw; auto-detects document type.
 */
export async function saveOfflineClient(
  data: Omit<OfflineClient, 'local_id' | 'created_at' | 'updated_at' | 'is_pending_sync' | 'is_deleted' | 'server_id'>
): Promise<OfflineClient> {
  // Accept whichever raw document field is provided
  const rawDoc = data.cpf_raw ?? data.cnpj_raw ?? null
  const doc = normalizeDocument(rawDoc)

  const cpfNormalized = doc.type === 'cpf' ? doc.normalized : null
  const cpfRaw = doc.type === 'cpf' ? doc.rawDigits : null
  const cnpjNormalized = doc.type === 'cnpj' ? doc.normalized : null
  const cnpjRaw = doc.type === 'cnpj' ? doc.rawDigits : null

  let identityStatus: OfflineClient['identity_status']
  if (doc.normalized) {
    identityStatus = 'confirmed'
  } else if (doc.type === 'cnpj') {
    identityStatus = 'pending_cnpj'
  } else {
    identityStatus = 'pending_cpf'
  }

  const client: OfflineClient = {
    ...data,
    local_id: generateLocalId(),
    server_id: null,
    cpf_normalized: cpfNormalized,
    cpf_raw: cpfRaw,
    cnpj_normalized: cnpjNormalized,
    cnpj_raw: cnpjRaw,
    document_type: doc.type,
    phone: normalizePhone(data.phone),
    email: normalizeEmail(data.email),
    city: normalizeCity(data.city),
    uf: normalizeUf(data.uf),
    identity_status: identityStatus,
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
 * Re-normalizes document fields when cpf_raw or cnpj_raw is patched.
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
  // Re-normalize document fields when either raw field was explicitly provided in the patch
  const hasCpfPatch = Object.prototype.hasOwnProperty.call(patch, 'cpf_raw')
  const hasCnpjPatch = Object.prototype.hasOwnProperty.call(patch, 'cnpj_raw')
  if (hasCpfPatch || hasCnpjPatch) {
    // If both are patched, prefer the one that carries an actual value
    const rawDoc = (hasCpfPatch && patch.cpf_raw != null)
      ? patch.cpf_raw
      : (hasCnpjPatch && patch.cnpj_raw != null)
        ? patch.cnpj_raw
        : null
    const doc = normalizeDocument(rawDoc)
    if (doc.type === 'cpf') {
      updated.cpf_normalized = doc.normalized
      updated.cpf_raw = doc.rawDigits
      updated.cnpj_normalized = existing.cnpj_normalized
      updated.cnpj_raw = existing.cnpj_raw
    } else if (doc.type === 'cnpj') {
      updated.cnpj_normalized = doc.normalized
      updated.cnpj_raw = doc.rawDigits
      updated.cpf_normalized = existing.cpf_normalized
      updated.cpf_raw = existing.cpf_raw
    }
    updated.document_type = doc.type
    if (doc.normalized) {
      updated.identity_status = 'confirmed'
    } else if (doc.type === 'cnpj') {
      updated.identity_status = 'pending_cnpj'
    } else {
      updated.identity_status = 'pending_cpf'
    }
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
 * Find offline client by normalized CNPJ.
 */
export async function findOfflineClientByCnpj(cnpjNormalized: string): Promise<OfflineClient | null> {
  let found: OfflineClient | null = null
  await offlineClientsStore.iterate((value: unknown) => {
    const client = value as OfflineClient
    if (!client.is_deleted && client.cnpj_normalized === cnpjNormalized) {
      found = client
      return undefined
    }
  })
  return found
}

/**
 * Find offline client by normalized CPF or CNPJ (auto-detects type).
 */
export async function findOfflineClientByDocument(normalizedDocument: string): Promise<OfflineClient | null> {
  const isCnpj = normalizedDocument.length === 14
  return isCnpj
    ? findOfflineClientByCnpj(normalizedDocument)
    : findOfflineClientByCpf(normalizedDocument)
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
