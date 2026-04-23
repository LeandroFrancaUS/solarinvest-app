// server/__tests__/purge-old-proposals.spec.js
//
// Unit tests for the proposal purge service and its cron route handler.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { purgeOldProposals } from '../proposals/purgeOldProposals.js'
import { handlePurgeOldProposalsRequest } from '../routes/purgeOldProposals.js'

// ---------------------------------------------------------------------------
// Helper: build a sql mock that returns canned results per call order
// ---------------------------------------------------------------------------

/**
 * Creates a mock sql function.
 * Each call to sql() consumes the next entry from `responses`.
 * An entry can be:
 *   - an array (resolved rows)
 *   - an Error (thrown)
 */
function makeSql(responses) {
  let callIndex = 0
  return vi.fn((_query, _params) => {
    const entry = responses[callIndex++]
    if (entry instanceof Error) return Promise.reject(entry)
    return Promise.resolve(entry ?? [])
  })
}

/**
 * Creates a minimal db client stub { sql }.
 */
function makeDb(responses) {
  return { sql: makeSql(responses) }
}

// ---------------------------------------------------------------------------
// Helper: build a minimal HTTP response object
// ---------------------------------------------------------------------------

function makeRes() {
  return {
    statusCode: null,
    body: null,
    ended: false,
    setHeader: vi.fn(),
    end: function () { this.ended = true },
  }
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.body = body
  res.ended = true
}

// ---------------------------------------------------------------------------
// purgeOldProposals — service
// ---------------------------------------------------------------------------

describe('purgeOldProposals()', () => {
  // ── Case 1: proposals older than 30 days → hard deleted ───────────────────
  it('hard-deletes proposals older than retentionDays', async () => {
    // DELETE … RETURNING returns 3 rows
    const db = makeDb([
      [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
    ])

    const result = await purgeOldProposals(db, { retentionDays: 30 })

    expect(result.hardDeleted).toBe(3)
    expect(result.errors).toHaveLength(0)
    expect(result.retentionDays).toBe(30)
    expect(db.sql).toHaveBeenCalledTimes(1)

    // Verify the SQL uses a parameterised interval (not string interpolation)
    const [query, params] = db.sql.mock.calls[0]
    expect(query).toContain('created_at')
    expect(params[0]).toBe('30')
  })

  // ── Case 2: no eligible proposals → hardDeleted = 0 ───────────────────────
  it('reports hardDeleted=0 when no proposals are older than retentionDays', async () => {
    const db = makeDb([
      [], // DELETE RETURNING → 0 rows
    ])

    const result = await purgeOldProposals(db, { retentionDays: 30 })

    expect(result.hardDeleted).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(db.sql).toHaveBeenCalledTimes(1)
  })

  // ── Case 3: dryRun — count returned, no DELETE executed ───────────────────
  it('returns count of eligible proposals in dryRun mode without deleting', async () => {
    // SELECT COUNT(*) returns 5
    const db = makeDb([
      [{ total: '5' }],
    ])

    const result = await purgeOldProposals(db, { retentionDays: 30, dryRun: true })

    expect(result.hardDeleted).toBe(5)
    expect(result.errors).toHaveLength(0)

    const [query] = db.sql.mock.calls[0]
    // dry-run must be a SELECT, not a DELETE
    expect(query.trim().toUpperCase()).toMatch(/^SELECT/)
  })

  // ── Case 4: custom retentionDays ──────────────────────────────────────────
  it('respects a custom retentionDays value', async () => {
    const db = makeDb([[{ id: 'b1' }]])

    const result = await purgeOldProposals(db, { retentionDays: 60 })

    expect(result.retentionDays).toBe(60)
    const params = db.sql.mock.calls[0][1]
    expect(params[0]).toBe('60')
  })

  // ── Case 5: retentionDays < 1 is clamped to 1 ────────────────────────────
  it('clamps retentionDays to a minimum of 1', async () => {
    const db = makeDb([[]])

    const result = await purgeOldProposals(db, { retentionDays: 0 })

    expect(result.retentionDays).toBe(1)
    const params = db.sql.mock.calls[0][1]
    expect(params[0]).toBe('1')
  })

  // ── Case 6: non-finite retentionDays throws ───────────────────────────────
  it('throws TypeError when retentionDays is NaN', async () => {
    const db = makeDb([])

    await expect(purgeOldProposals(db, { retentionDays: NaN })).rejects.toThrow(TypeError)
  })

  // ── Case 7: SQL error → error recorded in summary, hardDeleted=0 ──────────
  it('records errors in summary when the DELETE query fails', async () => {
    const db = makeDb([
      new Error('connection timeout'),
    ])

    const result = await purgeOldProposals(db, { retentionDays: 30 })

    expect(result.hardDeleted).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('connection timeout')
  })

  // ── Case 8: limit is respected ────────────────────────────────────────────
  it('passes limit parameter to the DELETE query', async () => {
    const db = makeDb([[]])

    await purgeOldProposals(db, { retentionDays: 30, limit: 10 })

    const params = db.sql.mock.calls[0][1]
    // Second param is the limit
    expect(Number(params[1])).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// handlePurgeOldProposalsRequest — route handler
// ---------------------------------------------------------------------------

describe('handlePurgeOldProposalsRequest()', () => {
  const CRON_SECRET = 'test-secret-value'

  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', CRON_SECRET)
  })

  // ── Auth: missing Authorization header → 401 ──────────────────────────────
  it('returns 401 when Authorization header is absent', async () => {
    const req = { headers: {} }
    const res = makeRes()

    await handlePurgeOldProposalsRequest(req, res, { sendJson, requestUrl: null })

    expect(res.statusCode).toBe(401)
    expect(res.body?.error?.code).toBe('UNAUTHORIZED')
  })

  // ── Auth: wrong token → 401 ───────────────────────────────────────────────
  it('returns 401 when Authorization header has wrong token', async () => {
    const req = { headers: { authorization: 'Bearer wrong-token' } }
    const res = makeRes()

    await handlePurgeOldProposalsRequest(req, res, { sendJson, requestUrl: null })

    expect(res.statusCode).toBe(401)
  })

  // ── Auth: valid token but CRON_SECRET not configured → 403 ────────────────
  it('returns 403 when CRON_SECRET env var is not set', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const req = { headers: { authorization: `Bearer ${CRON_SECRET}` } }
    const res = makeRes()

    await handlePurgeOldProposalsRequest(req, res, { sendJson, requestUrl: null })

    expect(res.statusCode).toBe(403)
  })

  // ── DB unavailable → 503 ─────────────────────────────────────────────────
  it('returns 503 when the database client is unavailable', async () => {
    const { getDatabaseClient } = await vi.importMock('../database/neonClient.js')
    getDatabaseClient.mockReturnValue(null)

    const req = { headers: { authorization: `Bearer ${CRON_SECRET}` } }
    const res = makeRes()

    await handlePurgeOldProposalsRequest(req, res, { sendJson, requestUrl: null })

    expect(res.statusCode).toBe(503)
  })
})
