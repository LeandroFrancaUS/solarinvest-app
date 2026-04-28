// src/domain/operations/operation-status.ts
// Pure domain types and validators for the Operação (post-contract operations) domain.
// No side effects — safe to import from both frontend and server.

// ─────────────────────────────────────────────────────────────────────────────
// Ticket
// ─────────────────────────────────────────────────────────────────────────────

export const TICKET_PRIORITIES = ['baixa', 'media', 'alta', 'urgente'] as const
export const TICKET_STATUSES = [
  'aberto',
  'em_andamento',
  'aguardando_cliente',
  'resolvido',
  'cancelado',
] as const

export type TicketPriority = (typeof TICKET_PRIORITIES)[number]
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export function isTicketPriority(value: unknown): value is TicketPriority {
  return TICKET_PRIORITIES.includes(value as TicketPriority)
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return TICKET_STATUSES.includes(value as TicketStatus)
}

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance
// ─────────────────────────────────────────────────────────────────────────────

export const MAINTENANCE_TYPES = ['preventiva', 'corretiva'] as const
export const MAINTENANCE_STATUSES = [
  'planejada',
  'agendada',
  'realizada',
  'cancelada',
] as const

export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number]
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number]

export function isMaintenanceType(value: unknown): value is MaintenanceType {
  return MAINTENANCE_TYPES.includes(value as MaintenanceType)
}

export function isMaintenanceStatus(value: unknown): value is MaintenanceStatus {
  return MAINTENANCE_STATUSES.includes(value as MaintenanceStatus)
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleaning
// ─────────────────────────────────────────────────────────────────────────────

export const CLEANING_STATUSES = ['planejada', 'agendada', 'realizada', 'cancelada'] as const

export type CleaningStatus = (typeof CLEANING_STATUSES)[number]

export function isCleaningStatus(value: unknown): value is CleaningStatus {
  return CLEANING_STATUSES.includes(value as CleaningStatus)
}

// ─────────────────────────────────────────────────────────────────────────────
// Insurance
// ─────────────────────────────────────────────────────────────────────────────

export const INSURANCE_STATUSES = ['ativa', 'vencida', 'cancelada', 'pendente'] as const

export type InsuranceStatus = (typeof INSURANCE_STATUSES)[number]

export function isInsuranceStatus(value: unknown): value is InsuranceStatus {
  return INSURANCE_STATUSES.includes(value as InsuranceStatus)
}

// ─────────────────────────────────────────────────────────────────────────────
// Operation events (agenda)
// ─────────────────────────────────────────────────────────────────────────────

export const OPERATION_EVENT_SOURCE_TYPES = [
  'ticket',
  'maintenance',
  'cleaning',
  'insurance',
  'manual',
] as const
export const OPERATION_EVENT_STATUSES = ['agendado', 'concluido', 'cancelado'] as const

export type OperationEventSourceType = (typeof OPERATION_EVENT_SOURCE_TYPES)[number]
export type OperationEventStatus = (typeof OPERATION_EVENT_STATUSES)[number]

export function isOperationEventSourceType(value: unknown): value is OperationEventSourceType {
  return OPERATION_EVENT_SOURCE_TYPES.includes(value as OperationEventSourceType)
}

export function isOperationEventStatus(value: unknown): value is OperationEventStatus {
  return OPERATION_EVENT_STATUSES.includes(value as OperationEventStatus)
}
