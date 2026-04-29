// server/__tests__/contract-signed-status.spec.js
// Unit tests for applyContractSignedStatus — no live database required.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyContractSignedStatus } from '../clients/contractSignedStatus.js'

// ─────────────────────────────────────────────────────────────────────────────
// SQL stub helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a tagged-template sql stub that always resolves with `rows`.
 */
function makeSql(rows) {
  const stub = vi.fn()
  stub.mockResolvedValue(rows)
  // Make it usable as a tagged-template function: sql`…` → stub()
  const tag = (strings, ...values) => stub(strings, ...values)
  tag.mock = stub.mock
  return tag
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('applyContractSignedStatus', () => {
  const CLIENT_ID = 'client-uuid-001'

  it('updates status_comercial and status_cliente when client is not yet ATIVO', async () => {
    // DB returns the updated row (UPDATE matched 1 row)
    const sql = makeSql([{ id: CLIENT_ID }])

    const result = await applyContractSignedStatus(sql, CLIENT_ID)

    expect(result).toEqual({ updated: true })
    expect(sql.mock.calls).toHaveLength(1)
    const [strings] = sql.mock.calls[0]
    const query = strings.join('')
    expect(query).toContain("status_comercial = 'GANHO'")
    expect(query).toContain("status_cliente   = 'ATIVO'")
    expect(query).toContain('IS DISTINCT FROM')
  })

  it('does not duplicate the client — only issues a single UPDATE', async () => {
    const sql = makeSql([{ id: CLIENT_ID }])

    await applyContractSignedStatus(sql, CLIENT_ID)

    // Exactly one SQL call, no INSERT
    expect(sql.mock.calls).toHaveLength(1)
    const [strings] = sql.mock.calls[0]
    const query = strings.join('')
    expect(query.toUpperCase()).not.toContain('INSERT')
  })

  it('does not update a client that is already ATIVO (idempotent — 0 rows affected)', async () => {
    // Simulate DB returning empty array because WHERE status_cliente IS DISTINCT FROM 'ATIVO'
    // excluded the already-ATIVO row.
    const sql = makeSql([])

    const result = await applyContractSignedStatus(sql, CLIENT_ID)

    expect(result).toEqual({ updated: false })
  })

  it('running the function twice is idempotent — second call returns updated: false', async () => {
    // First call: client not yet ATIVO → row updated
    const sqlFirst = makeSql([{ id: CLIENT_ID }])
    const first = await applyContractSignedStatus(sqlFirst, CLIENT_ID)
    expect(first).toEqual({ updated: true })

    // Second call: client already ATIVO → WHERE excludes the row → 0 affected
    const sqlSecond = makeSql([])
    const second = await applyContractSignedStatus(sqlSecond, CLIENT_ID)
    expect(second).toEqual({ updated: false })
  })

  it('passes the clientId as a template value (no raw string interpolation)', async () => {
    const sql = makeSql([{ id: CLIENT_ID }])

    await applyContractSignedStatus(sql, CLIENT_ID)

    // The second argument to the tagged-template call contains the dynamic values.
    // clientId must appear among them, never embedded in a raw SQL string.
    const [, ...values] = sql.mock.calls[0]
    const flatValues = values.flat()
    expect(flatValues).toContain(CLIENT_ID)
  })
})
