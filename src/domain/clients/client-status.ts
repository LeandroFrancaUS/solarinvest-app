// src/domain/clients/client-status.ts
// Pure type definitions and helper functions for the client status domain.
//
// statusComercial — commercial pipeline state before a contract is signed.
// statusCliente   — post-contract client lifecycle state.
//
// Rules:
//   - A record appears in Comercial when statusComercial is not 'GANHO'/'PERDIDO'
//     OR when statusCliente is 'NAO_CLIENTE'.
//   - A record appears in Clientes when statusCliente is NOT 'NAO_CLIENTE'.
//   - When a contract is signed: statusComercial → 'GANHO', statusCliente → 'ATIVO'.

// ─── Canonical value sets ─────────────────────────────────────────────────────

export const STATUS_COMERCIAL_VALUES = [
  'LEAD',
  'PROPOSTA_ENVIADA',
  'NEGOCIANDO',
  'CONTRATO_ENVIADO',
  'GANHO',
  'PERDIDO',
] as const

export const STATUS_CLIENTE_VALUES = [
  'NAO_CLIENTE',
  'ATIVO',
  'INATIVO',
  'CANCELADO',
  'FINALIZADO',
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatusComercial = (typeof STATUS_COMERCIAL_VALUES)[number]

export type StatusCliente = (typeof STATUS_CLIENTE_VALUES)[number]

// ─── Minimal client shape required by status helpers ─────────────────────────

export interface ClientForStatusDomain {
  status_comercial?: StatusComercial | (string & Record<never, never>) | null
  status_cliente?: StatusCliente | (string & Record<never, never>) | null
}

// ─── Type guards ──────────────────────────────────────────────────────────────

/**
 * Returns true when `value` is a valid StatusComercial.
 */
export function isStatusComercial(value: unknown): value is StatusComercial {
  return STATUS_COMERCIAL_VALUES.includes(value as StatusComercial)
}

/**
 * Returns true when `value` is a valid StatusCliente.
 */
export function isStatusCliente(value: unknown): value is StatusCliente {
  return STATUS_CLIENTE_VALUES.includes(value as StatusCliente)
}

// ─── Visibility helpers ───────────────────────────────────────────────────────

/**
 * Determines where a client record should appear in the sidebar navigation.
 *
 * Rules:
 *   - Comercial: records that are still in the commercial pipeline
 *     (statusComercial ≠ GANHO/PERDIDO) OR have no client yet (statusCliente = NAO_CLIENTE).
 *   - Clientes: records that have or had a contract (statusCliente ≠ NAO_CLIENTE).
 *
 * A single record may appear in BOTH sections during the transition window
 * (e.g. status_comercial = GANHO and status_cliente = ATIVO is valid but the
 * Comercial visibility check intentionally stops showing GANHO records).
 */
export function deriveClientVisibility(client: ClientForStatusDomain): {
  showInComercial: boolean
  showInClientes: boolean
} {
  const sc = client.status_comercial ?? 'LEAD'
  const sk = client.status_cliente ?? 'NAO_CLIENTE'

  // Aparecer em Comercial: ainda não concluído no pipeline comercial
  const showInComercial = sc !== 'GANHO' && sc !== 'PERDIDO'

  // Aparecer em Clientes: já tem ou teve um contrato
  const showInClientes = sk !== 'NAO_CLIENTE'

  return { showInComercial, showInClientes }
}

// ─── Mutation helper ──────────────────────────────────────────────────────────

/**
 * Returns the status fields to set when a contract is signed.
 * Apply the returned patch to the client record (via updateClient or store update).
 *
 * Does NOT mutate the original object.
 */
export function applyContractSignedStatus(
  client: ClientForStatusDomain,
): ClientForStatusDomain & { status_comercial: 'GANHO'; status_cliente: 'ATIVO' } {
  return {
    ...client,
    status_comercial: 'GANHO',
    status_cliente: 'ATIVO',
  }
}
