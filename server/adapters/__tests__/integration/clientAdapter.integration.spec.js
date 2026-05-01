// server/adapters/__tests__/integration/clientAdapter.integration.spec.js
//
// Integration tests for ClientAdapter against a real (test) database.
//
// These tests are SKIPPED unless the environment variable INTEGRATION_TEST_DB_URL
// is set.  They validate that the toDb() output is accepted by the real DB schema
// and that fromDb() correctly reads back the written row.
//
// Run with:
//   INTEGRATION_TEST_DB_URL=<neon-connection-string> vitest run --config vitest.server.config.ts
//
// @integration

import { describe, it, expect, beforeAll } from 'vitest'

const RUN = Boolean(process.env.INTEGRATION_TEST_DB_URL)

describe.skipIf(!RUN)('ClientAdapter [integration]', () => {
  let sql

  beforeAll(async () => {
    if (!RUN) return
    const { neon } = await import('@neondatabase/serverless')
    sql = neon(process.env.INTEGRATION_TEST_DB_URL)
  })

  it('toDb shape is accepted by the clients table schema', async () => {
    const { toDb, fromDb, toSoftDelete } = await import('../../clientAdapter.js')

    const actor = { authProviderUserId: 'integration-test-user' }
    const model = {
      name:     `Integration Test ${Date.now()}`,
      email:    `integration-${Date.now()}@test.invalid`,
      phone:    '11000000000',
      city:     'Goiânia',
      state:    'GO',
      document: null,
    }

    const dbShape = toDb(model, actor, 'insert')

    // INSERT — use RETURNING to get the created row back
    const [row] = await sql(
      `INSERT INTO clients
         (client_name, client_email, client_phone, client_city, client_state,
          created_by_user_id, owner_user_id, user_id, status_comercial, status_cliente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'LEAD', 'NAO_CLIENTE')
       RETURNING *`,
      [
        dbShape.client_name,
        dbShape.client_email,
        dbShape.client_phone,
        dbShape.client_city,
        dbShape.client_state,
        dbShape.created_by_user_id,
        dbShape.owner_user_id,
        dbShape.created_by_user_id,
      ],
    )

    expect(row).toBeDefined()
    expect(row.client_name).toBe(model.name)

    // fromDb should round-trip correctly
    const restored = fromDb(row)
    expect(restored.name).toBe(model.name)
    expect(restored.email).toBe(model.email)

    // Soft-delete cleanup
    const sd = toSoftDelete(row.id, actor)
    await sql(
      `UPDATE clients SET deleted_at = $1 WHERE id = $2`,
      [sd.deleted_at, sd.id],
    )
  })
})
