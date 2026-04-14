// server/__tests__/purge-deleted-clients.spec.js
//
// Unit tests for the hybrid-retention purge service and its cron route handler.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clientHasLinks, purgeDeletedClients } from '../clients/purgeDeletedClients.js'
import { handlePurgeDeletedClientsRequest } from '../routes/purgeDeletedClients.js'

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
// clientHasLinks
// ---------------------------------------------------------------------------

describe('clientHasLinks()', () => {
  it('returns false when no linked proposals exist', async () => {
    const sql = makeSql([
      [], // proposals check → empty
    ])
    const result = await clientHasLinks(sql, 42)
    expect(result).toBe(false)
  })

  it('returns true when a linked proposal exists', async () => {
    const sql = makeSql([
      [{ 1: 1 }], // proposals check → row found
    ])
    const result = await clientHasLinks(sql, 42)
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// purgeDeletedClients — service
// ---------------------------------------------------------------------------

describe('purgeDeletedClients()', () => {
  // ── Case 1: client deleted > 7 days ago, no proposals → hard deleted ───────
  it('hard-deletes a client with no operational links', async () => {
    const db = makeDb([
      [{ id: 10 }],   // candidates SELECT
      [],              // clientHasLinks → proposals empty
      [{ id: 10 }],   // DELETE RETURNING id
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(1)
    expect(result.hardDeleted).toBe(1)
    expect(result.keptSoftDeletedDueToLinks).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  // ── Case 2: client deleted > 7 days ago, has proposals → preserved ─────────
  it('preserves a client that has operational links (proposals)', async () => {
    const db = makeDb([
      [{ id: 20 }],      // candidates SELECT
      [{ 1: 1 }],        // clientHasLinks → proposals found
      // DELETE should NOT be called
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(1)
    expect(result.hardDeleted).toBe(0)
    expect(result.keptSoftDeletedDueToLinks).toBe(1)
    expect(result.errors).toHaveLength(0)
    // Verify DELETE was never called (sql was called only twice)
    expect(db.sql).toHaveBeenCalledTimes(2)
  })

  // ── Case 3: client deleted < 7 days ago → not returned by SELECT ───────────
  // The INTERVAL filter in the SELECT ensures recent deletions are never candidates.
  it('does not process clients deleted less than retentionDays ago', async () => {
    // candidates SELECT returns empty (recent deletion excluded by DB query)
    const db = makeDb([
      [], // candidates SELECT → empty
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(0)
    expect(result.hardDeleted).toBe(0)
    expect(result.keptSoftDeletedDueToLinks).toBe(0)
    // Only the initial SELECT was called
    expect(db.sql).toHaveBeenCalledTimes(1)
  })

  // ── Case 4: non-deleted client (deleted_at IS NULL) → not returned ─────────
  // Same as Case 3 — the WHERE clause ensures non-deleted rows are excluded.
  it('does not process clients with no deleted_at (not soft-deleted)', async () => {
    const db = makeDb([
      [], // candidates SELECT returns empty (NULL deleted_at excluded)
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(0)
    expect(result.hardDeleted).toBe(0)
    expect(db.sql).toHaveBeenCalledTimes(1)
  })

  // ── Case 5: multiple owners — purge is global (no owner filter) ────────────
  // Validates that the candidates SELECT has no owner constraint.
  // The test verifies the actual SQL string passed to sql() does NOT contain
  // owner_user_id so the purge is cross-owner by design.
  it('finds candidates across all owners (no owner_user_id filter)', async () => {
    const db = makeDb([
      [{ id: 30 }, { id: 31 }], // two candidates from different owners
      [],                        // client 30 — no proposals
      [{ id: 30 }],              // client 30 DELETE
      [],                        // client 31 — no proposals
      [{ id: 31 }],              // client 31 DELETE
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(2)
    expect(result.hardDeleted).toBe(2)

    // Check that the first SQL call (candidates SELECT) does not filter by owner
    const firstCall = db.sql.mock.calls[0]
    expect(firstCall[0]).not.toMatch(/owner_user_id/)
    expect(firstCall[0]).not.toMatch(/current_user/)
  })

  // ── Case 6: dryRun mode — reports without deleting ────────────────────────
  it('does not execute DELETE in dryRun mode', async () => {
    const db = makeDb([
      [{ id: 50 }], // candidates SELECT
      [],           // clientHasLinks → no proposals
      // DELETE must NOT be called
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7, dryRun: true })

    expect(result.hardDeleted).toBe(1)
    // sql called only twice: SELECT candidates + clientHasLinks
    expect(db.sql).toHaveBeenCalledTimes(2)
  })

  // ── Case 7: defensive WHERE in DELETE — race condition guard ───────────────
  // If the defensive DELETE returns 0 rows (client was restored between SELECT
  // and DELETE), hardDeleted is not incremented.
  it('does not increment hardDeleted when defensive DELETE matches 0 rows', async () => {
    const db = makeDb([
      [{ id: 60 }], // candidates SELECT
      [],           // clientHasLinks → no proposals
      [],           // DELETE RETURNING id → 0 rows (client was restored)
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.hardDeleted).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  // ── Case 8: error during link check → recorded in errors, continues ────────
  it('records errors per-client and continues processing remaining candidates', async () => {
    const db = makeDb([
      [{ id: 70 }, { id: 71 }],  // candidates SELECT
      new Error('DB timeout'),    // clientHasLinks for client 70 throws
      [],                          // client 71 — no proposals
      [{ id: 71 }],                // client 71 DELETE
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('clientId=70')
    expect(result.hardDeleted).toBe(1) // client 71 still processed
  })

  // ── Case 9: candidates fetch failure → returns error summary ──────────────
  it('returns error summary when candidates SELECT fails', async () => {
    const db = makeDb([
      new Error('connection refused'), // candidates SELECT throws
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(0)
    expect(result.hardDeleted).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('candidates')
  })
})

// ---------------------------------------------------------------------------
// handlePurgeDeletedClientsRequest — route handler
// ---------------------------------------------------------------------------

describe('handlePurgeDeletedClientsRequest()', () => {
  const CRON_SECRET = 'test-secret-value'

  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', CRON_SECRET)
  })

  // ── Auth: missing Authorization header → 401 ──────────────────────────────
  it('returns 401 when Authorization header is absent', async () => {
    const req = { headers: {} }
    const res = makeRes()

    await handlePurgeDeletedClientsRequest(req, res, { sendJson, requestUrl: null })

    expect(res.statusCode).toBe(401)
    expect(res.body?.error?.code).toBe('UNAUTHORIZED')
  })

  // ── Auth: wrong token → 401 ───────────────────────────────────────────────
  it('returns 401 when Authorization header has wrong token', async () => {
    const req = { headers: { authorization: 'Bearer wrong-token' } }
    const res = makeRes()

    await handlePurgeDeletedClientsRequest(req, res, { sendJson, requestUrl: null })

    expect(res.statusCode).toBe(401)
  })

  // ── Auth: valid token but CRON_SECRET not configured → 403 ────────────────
  it('returns 403 when CRON_SECRET env var is not set', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const req = { headers: { authorization: `Bearer ${CRON_SECRET}` } }
    const res = makeRes()

    await handlePurgeDeletedClientsRequest(req, res, { sendJson, requestUrl: null })

    expect(res.statusCode).toBe(403)
  })

  // ── DB unavailable → 503 ─────────────────────────────────────────────────
  // getDatabaseClient() is mocked to return null
  it('returns 503 when the database client is unavailable', async () => {
    const { getDatabaseClient } = await vi.importMock('../database/neonClient.js')
    getDatabaseClient.mockReturnValue(null)

    const req = { headers: { authorization: `Bearer ${CRON_SECRET}` } }
    const res = makeRes()

    await handlePurgeDeletedClientsRequest(req, res, { sendJson, requestUrl: null })

    expect(res.statusCode).toBe(503)
  })
})
