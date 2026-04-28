// server/clients/contractSignedStatus.js
// Domain rule: when a contract is signed, promote the client to GANHO / ATIVO.
// Keep calculation and proposal logic completely untouched — this module only
// reacts to the contract-signed event.

/**
 * Promote a client's status when their contract is signed.
 *
 * Sets:
 *   status_comercial = 'GANHO'
 *   status_cliente   = 'ATIVO'
 *
 * Idempotent: if the client's status_cliente is already 'ATIVO' the UPDATE is
 * skipped entirely (WHERE clause excludes the row → 0 rows affected).
 *
 * @param {Function}      sql      - Neon tagged-template sql function
 * @param {string|number} clientId - UUID or bigint of the client
 * @returns {Promise<{ updated: boolean }>}
 */
export async function applyContractSignedStatus(sql, clientId) {
  const rows = await sql`
    UPDATE clients
    SET
      status_comercial = 'GANHO',
      status_cliente   = 'ATIVO',
      updated_at       = now()
    WHERE id = ${clientId}
      AND deleted_at IS NULL
      AND status_cliente IS DISTINCT FROM 'ATIVO'
    RETURNING id
  `
  const updated = rows.length > 0
  console.info('[clients][contractSignedStatus] apply', { clientId, updated })
  return { updated }
}
