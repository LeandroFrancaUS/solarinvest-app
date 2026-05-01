// server/adapters/__tests__/integration/financeAdapter.integration.spec.js
//
// Integration tests for FinanceAdapter against a real (test) database.
// SKIPPED unless INTEGRATION_TEST_DB_URL is set.
// @integration

import { describe, it, expect, beforeAll } from 'vitest'

const RUN = Boolean(process.env.INTEGRATION_TEST_DB_URL)

describe.skipIf(!RUN)('FinanceAdapter [integration]', () => {
  let sql

  beforeAll(async () => {
    if (!RUN) return
    const { neon } = await import('@neondatabase/serverless')
    sql = neon(process.env.INTEGRATION_TEST_DB_URL)
  })

  it('toEntryDb shape is accepted by the financial_entries table schema', async () => {
    const { toEntryDb, fromEntryDb, toSoftDelete } = await import('../../financeAdapter.js')

    const actor = { authProviderUserId: 'integration-test-user' }
    const model = {
      entry_type:       'expense',
      scope_type:       'company',
      category:         'Outros',
      description:      `Integration test entry ${Date.now()}`,
      amount:           99.99,
      status:           'planned',
    }

    const dbShape = toEntryDb(model, actor, 'insert')

    const [row] = await sql(
      `INSERT INTO financial_entries
         (entry_type, scope_type, category, description, amount, status,
          created_by_user_id, updated_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        dbShape.entry_type,
        dbShape.scope_type,
        dbShape.category,
        dbShape.description,
        dbShape.amount,
        dbShape.status,
        dbShape.created_by_user_id,
        dbShape.updated_by_user_id,
      ],
    )

    expect(row).toBeDefined()
    const restored = fromEntryDb(row)
    expect(restored.entry_type).toBe('expense')
    expect(Number(restored.amount)).toBeCloseTo(99.99)

    // Soft-delete cleanup
    const sd = toSoftDelete(row.id, actor)
    await sql(
      `UPDATE financial_entries SET deleted_at = $1 WHERE id = $2`,
      [sd.deleted_at, sd.id],
    )
  })
})
