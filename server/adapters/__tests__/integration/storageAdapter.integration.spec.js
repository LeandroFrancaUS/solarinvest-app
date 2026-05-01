// server/adapters/__tests__/integration/storageAdapter.integration.spec.js
//
// Integration tests for StorageAdapter against a real (test) database.
// SKIPPED unless INTEGRATION_TEST_DB_URL is set.
// @integration

import { describe, it, expect, beforeAll } from 'vitest'

const RUN = Boolean(process.env.INTEGRATION_TEST_DB_URL)

describe.skipIf(!RUN)('StorageAdapter [integration]', () => {
  let sql

  beforeAll(async () => {
    if (!RUN) return
    const { neon } = await import('@neondatabase/serverless')
    sql = neon(process.env.INTEGRATION_TEST_DB_URL)
  })

  it('toDb → storage table → fromDb round-trip', async () => {
    const { toDb, fromDb } = await import('../../storageAdapter.js')

    const userId = 'integration-storage-test'
    const key    = `test-key-${Date.now()}`
    const value  = { theme: 'dark', locale: 'pt-BR', count: 42 }

    const dbShape = toDb(key, value, userId)

    // Upsert
    await sql(
      `INSERT INTO storage (user_id, "key", value)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (user_id, "key") DO UPDATE SET value = EXCLUDED.value`,
      [dbShape.user_id, dbShape.key, JSON.stringify(dbShape.value)],
    )

    // Read back
    const [row] = await sql(
      `SELECT "key" AS key, value, user_id FROM storage WHERE user_id = $1 AND "key" = $2`,
      [userId, key],
    )

    expect(row).toBeDefined()
    const restored = fromDb(row)
    expect(restored.value).toEqual(value)
    expect(restored.key).toBe(key)

    // Cleanup (hard delete — storage has no soft delete)
    await sql(`DELETE FROM storage WHERE user_id = $1 AND "key" = $2`, [userId, key])
  })
})
