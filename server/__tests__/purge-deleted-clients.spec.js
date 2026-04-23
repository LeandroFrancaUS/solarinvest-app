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
// Number of tables checked by clientHasLinks (LINK_TABLES length).
// Update this constant whenever LINK_TABLES changes in purgeDeletedClients.js.
// ---------------------------------------------------------------------------
const NUM_LINK_TABLES = 7

/**
 * Returns an array of NUM_LINK_TABLES empty arrays — one per link-table check
 * made by clientHasLinks() via Promise.all.
 */
function noLinks() {
  return Array.from({ length: NUM_LINK_TABLES }, () => [])
}

/**
 * Returns an array of NUM_LINK_TABLES entries where the first entry has a
 * row and the rest are empty, simulating a match on the first table.
 */
function hasLinkOnFirst() {
  return [[{ 1: 1 }], ...Array.from({ length: NUM_LINK_TABLES - 1 }, () => [])]
}

// ---------------------------------------------------------------------------
// clientHasLinks
// ---------------------------------------------------------------------------

describe('clientHasLinks()', () => {
  it('returns false when no linked rows exist in any table', async () => {
    const sql = makeSql(noLinks())
    const result = await clientHasLinks(sql, 42)
    expect(result).toBe(false)
    expect(sql).toHaveBeenCalledTimes(NUM_LINK_TABLES)
  })

  it('returns true when the first table has a linked row', async () => {
    const sql = makeSql(hasLinkOnFirst())
    const result = await clientHasLinks(sql, 42)
    expect(result).toBe(true)
    // Promise.all fires all queries simultaneously regardless of results
    expect(sql).toHaveBeenCalledTimes(NUM_LINK_TABLES)
  })

  it('returns true when a later table (not the first) has a linked row', async () => {
    // Put a match in the last position
    const responses = [
      ...Array.from({ length: NUM_LINK_TABLES - 1 }, () => []),
      [{ 1: 1 }], // last table has a row
    ]
    const sql = makeSql(responses)
    const result = await clientHasLinks(sql, 42)
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// purgeDeletedClients — service
// ---------------------------------------------------------------------------

describe('purgeDeletedClients()', () => {
  // ── Case 1: client deleted > 7 days ago, no links → hard deleted ───────────
  it('hard-deletes a client with no operational links', async () => {
    const db = makeDb([
      [{ id: 10, is_high_value_protected: false }], // candidates SELECT
      ...noLinks(),                                  // clientHasLinks → all empty
      [{ id: 10 }],                                  // DELETE RETURNING id
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(1)
    expect(result.hardDeleted).toBe(1)
    expect(result.keptSoftDeletedDueToLinks).toBe(0)
    expect(result.keptSoftDeletedDueToProtection).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  // ── Case 2: client has proposals → preserved ───────────────────────────────
  it('preserves a client that has operational links (proposals)', async () => {
    const db = makeDb([
      [{ id: 20, is_high_value_protected: false }], // candidates SELECT
      ...hasLinkOnFirst(),                           // first table (proposals) has a row
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(1)
    expect(result.hardDeleted).toBe(0)
    expect(result.keptSoftDeletedDueToLinks).toBe(1)
    expect(result.keptSoftDeletedDueToProtection).toBe(0)
    expect(result.errors).toHaveLength(0)
    // candidates SELECT + NUM_LINK_TABLES link checks (no DELETE)
    expect(db.sql).toHaveBeenCalledTimes(1 + NUM_LINK_TABLES)
  })

  // ── Case 3: client deleted < 7 days ago → not returned by SELECT ───────────
  it('does not process clients deleted less than retentionDays ago', async () => {
    const db = makeDb([
      [], // candidates SELECT → empty (recent deletion excluded by DB query)
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(0)
    expect(result.hardDeleted).toBe(0)
    // Only the initial SELECT was called
    expect(db.sql).toHaveBeenCalledTimes(1)
  })

  // ── Case 4: non-deleted client (deleted_at IS NULL) → not returned ─────────
  it('does not process clients with no deleted_at (not soft-deleted)', async () => {
    const db = makeDb([
      [], // candidates SELECT returns empty (NULL deleted_at excluded)
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(0)
    expect(result.hardDeleted).toBe(0)
    expect(db.sql).toHaveBeenCalledTimes(1)
  })

  // ── Case 5: is_high_value_protected = true → skipped without link check ────
  it('skips a protected client without performing any link check', async () => {
    const db = makeDb([
      [{ id: 99, is_high_value_protected: true }], // candidate is protected
      // No link checks or DELETE should be performed
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(1)
    expect(result.hardDeleted).toBe(0)
    expect(result.keptSoftDeletedDueToProtection).toBe(1)
    expect(result.keptSoftDeletedDueToLinks).toBe(0)
    // Only candidates SELECT — no link check called
    expect(db.sql).toHaveBeenCalledTimes(1)
  })

  // ── Case 6: multiple owners — purge is global (no owner filter) ────────────
  it('finds candidates across all owners (no owner_user_id filter)', async () => {
    const db = makeDb([
      [
        { id: 30, is_high_value_protected: false },
        { id: 31, is_high_value_protected: false },
      ],           // two candidates from different owners
      ...noLinks(), // client 30 — no links
      [{ id: 30 }], // client 30 DELETE
      ...noLinks(), // client 31 — no links
      [{ id: 31 }], // client 31 DELETE
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(2)
    expect(result.hardDeleted).toBe(2)

    // Check that the first SQL call (candidates SELECT) does not filter by owner
    const firstCall = db.sql.mock.calls[0]
    expect(firstCall[0]).not.toMatch(/owner_user_id/)
    expect(firstCall[0]).not.toMatch(/current_user/)
  })

  // ── Case 7: dryRun mode — reports without deleting ────────────────────────
  it('does not execute DELETE in dryRun mode', async () => {
    const db = makeDb([
      [{ id: 50, is_high_value_protected: false }], // candidates SELECT
      ...noLinks(),                                  // clientHasLinks → no links
      // DELETE must NOT be called
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7, dryRun: true })

    expect(result.hardDeleted).toBe(1)
    // candidates SELECT + NUM_LINK_TABLES link checks (no DELETE)
    expect(db.sql).toHaveBeenCalledTimes(1 + NUM_LINK_TABLES)
  })

  // ── Case 8: defensive WHERE in DELETE — race condition guard ───────────────
  it('does not increment hardDeleted when defensive DELETE matches 0 rows', async () => {
    const db = makeDb([
      [{ id: 60, is_high_value_protected: false }], // candidates SELECT
      ...noLinks(),                                  // clientHasLinks → no links
      [],                                            // DELETE RETURNING id → 0 rows (client was restored)
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.hardDeleted).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  // ── Case 9: error during link check → recorded in errors, continues ────────
  it('records errors per-client and continues processing remaining candidates', async () => {
    const db = makeDb([
      [
        { id: 70, is_high_value_protected: false },
        { id: 71, is_high_value_protected: false },
      ],                                             // candidates SELECT
      new Error('DB timeout'),                       // clientHasLinks for client 70, table 1 throws
      // Promise.all fires all NUM_LINK_TABLES queries simultaneously; the
      // remaining tables for client 70 consume the next slots in the mock.
      ...Array.from({ length: NUM_LINK_TABLES - 1 }, () => []),
      ...noLinks(),                                  // client 71 — no links
      [{ id: 71 }],                                  // client 71 DELETE
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('clientId=70')
    expect(result.hardDeleted).toBe(1) // client 71 still processed
  })

  // ── Case 10: candidates fetch failure → returns error summary ─────────────
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

  // ── Case 11: mix of protected and unprotected candidates ─────────────────
  it('handles a mix of protected, linked, and purgeable clients', async () => {
    const db = makeDb([
      [
        { id: 80, is_high_value_protected: true },  // protected → skip
        { id: 81, is_high_value_protected: false }, // has links → preserve
        { id: 82, is_high_value_protected: false }, // no links → delete
      ],
      // client 81 link check (has a link on the first table)
      ...hasLinkOnFirst(),
      // client 82 link check (no links)
      ...noLinks(),
      [{ id: 82 }], // client 82 DELETE
    ])

    const result = await purgeDeletedClients(db, { retentionDays: 7 })

    expect(result.scanned).toBe(3)
    expect(result.keptSoftDeletedDueToProtection).toBe(1)
    expect(result.keptSoftDeletedDueToLinks).toBe(1)
    expect(result.hardDeleted).toBe(1)
    expect(result.errors).toHaveLength(0)
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
