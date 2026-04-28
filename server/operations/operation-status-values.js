// server/operations/operation-status-values.js
// Canonical value lists and validators for the Operação domain.
// Server-side counterpart of src/domain/operations/operation-status.ts.
// Keep the two files in sync when the domain values change.

export const TICKET_PRIORITIES = ['baixa', 'media', 'alta', 'urgente']
export const TICKET_STATUSES   = ['aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'cancelado']

export const MAINTENANCE_TYPES    = ['preventiva', 'corretiva']
export const MAINTENANCE_STATUSES = ['planejada', 'agendada', 'realizada', 'cancelada']

export const CLEANING_STATUSES = ['planejada', 'agendada', 'realizada', 'cancelada']

export const INSURANCE_STATUSES = ['ativa', 'vencida', 'cancelada', 'pendente']

export const OPERATION_EVENT_SOURCE_TYPES = ['ticket', 'maintenance', 'cleaning', 'insurance', 'manual']
export const OPERATION_EVENT_STATUSES     = ['agendado', 'concluido', 'cancelado']

const TICKET_PRIORITY_SET         = new Set(TICKET_PRIORITIES)
const TICKET_STATUS_SET           = new Set(TICKET_STATUSES)
const MAINTENANCE_TYPE_SET        = new Set(MAINTENANCE_TYPES)
const MAINTENANCE_STATUS_SET      = new Set(MAINTENANCE_STATUSES)
const CLEANING_STATUS_SET         = new Set(CLEANING_STATUSES)
const INSURANCE_STATUS_SET        = new Set(INSURANCE_STATUSES)
const OPERATION_EVENT_SOURCE_SET  = new Set(OPERATION_EVENT_SOURCE_TYPES)
const OPERATION_EVENT_STATUS_SET  = new Set(OPERATION_EVENT_STATUSES)

export function isTicketPriority(value)           { return TICKET_PRIORITY_SET.has(value) }
export function isTicketStatus(value)             { return TICKET_STATUS_SET.has(value) }
export function isMaintenanceType(value)          { return MAINTENANCE_TYPE_SET.has(value) }
export function isMaintenanceStatus(value)        { return MAINTENANCE_STATUS_SET.has(value) }
export function isCleaningStatus(value)           { return CLEANING_STATUS_SET.has(value) }
export function isInsuranceStatus(value)          { return INSURANCE_STATUS_SET.has(value) }
export function isOperationEventSourceType(value) { return OPERATION_EVENT_SOURCE_SET.has(value) }
export function isOperationEventStatus(value)     { return OPERATION_EVENT_STATUS_SET.has(value) }
