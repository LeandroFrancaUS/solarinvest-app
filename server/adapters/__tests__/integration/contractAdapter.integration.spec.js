// server/adapters/__tests__/integration/contractAdapter.integration.spec.js
//
// Integration tests for ContractAdapter against a real (test) database.
// SKIPPED unless INTEGRATION_TEST_DB_URL is set.
// @integration

import { describe, it, expect, beforeAll } from 'vitest'

const RUN = Boolean(process.env.INTEGRATION_TEST_DB_URL)

describe.skipIf(!RUN)('ContractAdapter [integration]', () => {
  let sql

  beforeAll(async () => {
    if (!RUN) return
    const { neon } = await import('@neondatabase/serverless')
    sql = neon(process.env.INTEGRATION_TEST_DB_URL)
  })

  it('toDb shape is accepted by the client_contracts table schema', async () => {
    const { toDb, fromDb, toCancel } = await import('../../contractAdapter.js')

    const actor = { authProviderUserId: 'integration-test-user' }

    // Find an existing client to use as FK reference
    const [existingClient] = await sql(
      `SELECT id FROM clients WHERE deleted_at IS NULL LIMIT 1`,
    )
    if (!existingClient) {
      console.warn('[integration] No client found — skipping ContractAdapter test')
      return
    }

    const model = {
      client_id:            existingClient.id,
      contract_type:        'leasing',
      contract_status:      'draft',
      source_proposal_id:   'LEGACY-PROP-TEXT',
      consultant_id:        'LEGACY-CONSULT-TEXT',
    }

    const dbShape = toDb(model, actor, 'insert')

    const [row] = await sql(
      `INSERT INTO client_contracts
         (client_id, contract_type, contract_status, source_proposal_id, consultant_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        dbShape.client_id,
        dbShape.contract_type,
        dbShape.contract_status,
        dbShape.source_proposal_id,
        dbShape.consultant_id,
      ],
    )

    expect(row).toBeDefined()
    const restored = fromDb(row)
    expect(restored.contract_type).toBe('leasing')
    expect(restored.source_proposal_id).toBe('LEGACY-PROP-TEXT')
    expect(restored.consultant_id).toBe('LEGACY-CONSULT-TEXT')

    // Cancel (status-based, no deleted_at)
    const cancel = toCancel(row.id, actor)
    await sql(
      `UPDATE client_contracts SET contract_status = $1 WHERE id = $2`,
      [cancel.contract_status, cancel.id],
    )

    // Verify cancelled
    const [cancelled] = await sql(
      `SELECT contract_status FROM client_contracts WHERE id = $1`,
      [row.id],
    )
    expect(cancelled.contract_status).toBe('cancelled')

    // Hard-delete cleanup (test data)
    await sql(`DELETE FROM client_contracts WHERE id = $1`, [row.id])
  })
})
