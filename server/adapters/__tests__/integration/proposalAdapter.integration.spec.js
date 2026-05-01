// server/adapters/__tests__/integration/proposalAdapter.integration.spec.js
//
// Integration tests for ProposalAdapter against a real (test) database.
// SKIPPED unless INTEGRATION_TEST_DB_URL is set.
// @integration

import { describe, it, expect, beforeAll } from 'vitest'

const RUN = Boolean(process.env.INTEGRATION_TEST_DB_URL)

describe.skipIf(!RUN)('ProposalAdapter [integration]', () => {
  let sql

  beforeAll(async () => {
    if (!RUN) return
    const { neon } = await import('@neondatabase/serverless')
    sql = neon(process.env.INTEGRATION_TEST_DB_URL)
  })

  it('toDb shape is accepted by the proposals table schema', async () => {
    const { toDb, fromDb, toSoftDelete } = await import('../../proposalAdapter.js')

    const actor = { authProviderUserId: 'integration-test-user' }
    const model = {
      proposal_type: 'leasing',
      proposal_code: `IT-${Date.now()}`,
      status:        'draft',
      payload_json:  { integration: true },
      owner_user_id: actor.authProviderUserId,
    }

    const dbShape = toDb(model, actor, 'insert')

    const [row] = await sql(
      `INSERT INTO proposals
         (proposal_type, proposal_code, status, payload_json,
          owner_user_id, created_by_user_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING *`,
      [
        dbShape.proposal_type,
        dbShape.proposal_code,
        dbShape.status,
        JSON.stringify(dbShape.payload_json),
        dbShape.owner_user_id,
        dbShape.created_by_user_id,
      ],
    )

    expect(row).toBeDefined()
    expect(row.proposal_type).toBe('leasing')

    const restored = fromDb(row)
    expect(restored.proposal_code).toBe(model.proposal_code)
    expect(restored.payload_json).toEqual(model.payload_json)

    // Soft-delete cleanup
    const sd = toSoftDelete(row.id, actor)
    await sql(`UPDATE proposals SET deleted_at = $1 WHERE id = $2`, [sd.deleted_at, sd.id])
  })
})
