// server/adapters/__tests__/integration/projectAdapter.integration.spec.js
//
// Integration tests for ProjectAdapter against a real (test) database.
// SKIPPED unless INTEGRATION_TEST_DB_URL is set.
// @integration

import { describe, it, expect, beforeAll } from 'vitest'

const RUN = Boolean(process.env.INTEGRATION_TEST_DB_URL)

describe.skipIf(!RUN)('ProjectAdapter [integration]', () => {
  let sql

  beforeAll(async () => {
    if (!RUN) return
    const { neon } = await import('@neondatabase/serverless')
    sql = neon(process.env.INTEGRATION_TEST_DB_URL)
  })

  it('toDb shape is accepted by the projects table schema', async () => {
    const { toDb, fromDb, toSoftDelete } = await import('../../projectAdapter.js')

    const actor = { authProviderUserId: 'integration-test-user' }

    // Find an existing client to use as FK reference
    const [existingClient] = await sql(
      `SELECT id FROM clients WHERE deleted_at IS NULL LIMIT 1`,
    )
    if (!existingClient) {
      console.warn('[integration] No client found — skipping ProjectAdapter test')
      return
    }

    const model = {
      client_id:    existingClient.id,
      plan_id:      `plan-${Date.now()}`,
      project_type: 'leasing',
      status:       'Aguardando',
      client_name_snapshot: 'Integration Client',
    }

    const dbShape = toDb(model, actor, 'insert')

    const [row] = await sql(
      `INSERT INTO projects
         (client_id, plan_id, project_type, status,
          client_name_snapshot, created_by_user_id, updated_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        dbShape.client_id,
        dbShape.plan_id,
        dbShape.project_type,
        dbShape.status,
        dbShape.client_name_snapshot,
        dbShape.created_by_user_id,
        dbShape.updated_by_user_id,
      ],
    )

    expect(row).toBeDefined()
    const restored = fromDb(row)
    expect(restored.project_type).toBe('leasing')
    expect(restored.status).toBe('Aguardando')

    // Soft-delete cleanup
    const sd = toSoftDelete(row.id, actor)
    await sql(
      `UPDATE projects SET deleted_at = $1, updated_by_user_id = $2 WHERE id = $3`,
      [sd.deleted_at, sd.updated_by_user_id, sd.id],
    )
  })
})
