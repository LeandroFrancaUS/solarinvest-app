// server/clients/client-status-values.js
// Canonical value lists for status_comercial and status_cliente.
// Server-side counterpart of src/domain/clients/client-status.ts.
// Keep the two files in sync when the domain values change.

export const STATUS_COMERCIAL_VALUES = [
  'LEAD',
  'PROPOSTA_ENVIADA',
  'NEGOCIANDO',
  'CONTRATO_ENVIADO',
  'GANHO',
  'PERDIDO',
]

export const STATUS_CLIENTE_VALUES = [
  'NAO_CLIENTE',
  'ATIVO',
  'INATIVO',
  'CANCELADO',
  'FINALIZADO',
]

export const VALID_STATUS_COMERCIAL = new Set(STATUS_COMERCIAL_VALUES)
export const VALID_STATUS_CLIENTE = new Set(STATUS_CLIENTE_VALUES)
