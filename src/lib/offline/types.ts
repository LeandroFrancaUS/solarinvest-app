/**
 * Types for the offline-first layer.
 */

export type IdentityStatus = 'confirmed' | 'pending_cpf' | 'merged'
export type OriginType = 'online' | 'offline_sync' | 'import'
export type SyncOperationType = 'create' | 'update' | 'merge' | 'link_client' | 'attach_cpf'
export type SyncStatus = 'pending' | 'syncing' | 'failed' | 'done' | 'conflict'
export type EntityType = 'client' | 'proposal'

export interface OfflineClient {
  local_id: string           // UUID generated locally
  server_id: string | null   // null until synced
  cpf_normalized: string | null
  cpf_raw: string | null
  name: string
  phone: string | null
  email: string | null
  city: string | null
  uf: string | null
  address: string | null
  identity_status: IdentityStatus
  created_by_user_id: string | null
  owner_user_id: string | null
  origin: OriginType
  created_at: string         // ISO timestamp
  updated_at: string         // ISO timestamp
  is_pending_sync: boolean
  is_deleted: boolean
}

export interface OfflineProposal {
  local_id: string           // UUID generated locally
  server_id: string | null   // null until synced
  client_local_id: string | null  // references OfflineClient.local_id
  client_server_id: string | null // set after client sync
  proposal_type: 'leasing' | 'venda'
  status: string
  version: number
  proposal_code: string | null
  created_by_user_id: string | null
  owner_user_id: string | null
  consumption_kwh_month: number | null
  system_kwp: number | null
  capex_total: number | null
  contract_value: number | null
  term_months: number | null
  client_name: string | null
  client_document: string | null
  client_city: string | null
  client_state: string | null
  client_phone: string | null
  client_email: string | null
  uc_geradora_numero: string | null
  payload_json: Record<string, unknown>
  created_at: string
  updated_at: string
  is_pending_sync: boolean
  is_conflicted: boolean
  conflict_reason: string | null
  draft_source: string | null
}

export interface SyncQueueItem {
  operation_id: string       // UUID
  entity_type: EntityType
  entity_local_id: string
  entity_server_id: string | null
  operation_type: SyncOperationType
  payload: Record<string, unknown>
  created_at: string
  last_attempt_at: string | null
  attempt_count: number
  status: SyncStatus
  error_code: string | null
  error_message: string | null
  user_id: string | null
}

export interface SyncConflict {
  conflict_id: string
  entity_type: EntityType
  entity_local_id: string
  entity_server_id: string | null
  local_value: Record<string, unknown>
  server_value: Record<string, unknown>
  conflict_reason: string
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
  resolution: 'local_wins' | 'server_wins' | 'manual' | null
}

export interface IdMapping {
  entity_type: EntityType
  local_id: string
  server_id: string
  synced_at: string
}
