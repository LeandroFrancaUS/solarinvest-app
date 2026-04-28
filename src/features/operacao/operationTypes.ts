// src/features/operacao/operationTypes.ts
// Frontend types mirroring the Operação domain DB tables.
// Keep in sync with server/operations/repository.js field lists.

// ─────────────────────────────────────────────────────────────────────────────
// Canonical value sets (mirrors server/operations/operation-status-values.js)
// ─────────────────────────────────────────────────────────────────────────────

export const TICKET_PRIORITIES = ['baixa', 'media', 'alta', 'urgente'] as const
export const TICKET_STATUSES = ['aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'cancelado'] as const

export const MAINTENANCE_TYPES = ['preventiva', 'corretiva'] as const
export const MAINTENANCE_STATUSES = ['planejada', 'agendada', 'realizada', 'cancelada'] as const

export const CLEANING_STATUSES = ['planejada', 'agendada', 'realizada', 'cancelada'] as const

export const INSURANCE_STATUSES = ['ativa', 'vencida', 'cancelada', 'pendente'] as const

export const OPERATION_EVENT_SOURCE_TYPES = ['ticket', 'maintenance', 'cleaning', 'insurance', 'manual'] as const
export const OPERATION_EVENT_STATUSES = ['agendado', 'concluido', 'cancelado'] as const

export type TicketPriority = (typeof TICKET_PRIORITIES)[number]
export type TicketStatus = (typeof TICKET_STATUSES)[number]
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number]
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number]
export type CleaningStatus = (typeof CLEANING_STATUSES)[number]
export type InsuranceStatus = (typeof INSURANCE_STATUSES)[number]
export type OperationEventSourceType = (typeof OPERATION_EVENT_SOURCE_TYPES)[number]
export type OperationEventStatus = (typeof OPERATION_EVENT_STATUSES)[number]

// ─────────────────────────────────────────────────────────────────────────────
// Row types (mirrors SELECT column lists from repository.js)
// ─────────────────────────────────────────────────────────────────────────────

export interface ServiceTicket {
  id: string
  client_id: number
  project_id: string | null
  ticket_type: string | null
  priority: TicketPriority | null
  status: TicketStatus
  title: string
  description: string | null
  responsible_user_id: string | null
  scheduled_at: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface MaintenanceJob {
  id: string
  client_id: number
  project_id: string | null
  maintenance_type: MaintenanceType | null
  status: MaintenanceStatus
  scheduled_date: string | null
  completed_date: string | null
  technician_name: string | null
  report: string | null
  cost: number
  created_at: string
  updated_at: string
}

export interface CleaningJob {
  id: string
  client_id: number
  project_id: string | null
  periodicity: string | null
  status: CleaningStatus
  scheduled_date: string | null
  completed_date: string | null
  responsible_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InsurancePolicy {
  id: string
  client_id: number
  project_id: string | null
  insurer: string | null
  policy_number: string | null
  coverage: number | null
  deductible: number | null
  start_date: string | null
  end_date: string | null
  status: InsuranceStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OperationEvent {
  id: string
  client_id: number | null
  project_id: string | null
  source_type: OperationEventSourceType
  source_id: string | null
  title: string
  event_type: string | null
  starts_at: string
  ends_at: string | null
  status: OperationEventStatus
  notes: string | null
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Create payloads (required fields only — rest are optional)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateTicketPayload {
  client_id: number
  title: string
  project_id?: string | null
  ticket_type?: string | null
  priority?: TicketPriority | null
  status?: TicketStatus
  description?: string | null
  responsible_user_id?: string | null
  scheduled_at?: string | null
}

export interface CreateMaintenanceJobPayload {
  client_id: number
  project_id?: string | null
  maintenance_type?: MaintenanceType | null
  status?: MaintenanceStatus
  scheduled_date?: string | null
  completed_date?: string | null
  technician_name?: string | null
  report?: string | null
  cost?: number
}

export interface CreateCleaningJobPayload {
  client_id: number
  project_id?: string | null
  periodicity?: string | null
  status?: CleaningStatus
  scheduled_date?: string | null
  completed_date?: string | null
  responsible_name?: string | null
  notes?: string | null
}

export interface CreateInsurancePolicyPayload {
  client_id: number
  project_id?: string | null
  insurer?: string | null
  policy_number?: string | null
  coverage?: number | null
  deductible?: number | null
  start_date?: string | null
  end_date?: string | null
  status?: InsuranceStatus
  notes?: string | null
}

export interface CreateOperationEventPayload {
  title: string
  starts_at: string
  client_id?: number | null
  project_id?: string | null
  source_type?: OperationEventSourceType
  source_id?: string | null
  event_type?: string | null
  ends_at?: string | null
  status?: OperationEventStatus
  notes?: string | null
}
