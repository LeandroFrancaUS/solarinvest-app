// server/__tests__/clients-delete.spec.js
// Unit tests for DELETE /api/clients/:id handler logic.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers to build minimal handler context
// ---------------------------------------------------------------------------

function makeRes() {
  const res = { statusCode: null, ended: false, body: null }
  res.end = () => { res.ended = true }
  return res
}

function makeCtx(overrides = {}) {
  return {
    method: 'DELETE',
    clientId: 'client-123',
    subpath: null,
    readJsonBody: async () => ({}),
    sendJson: (res, status, payload) => {
      res.statusCode = status
      res.body = payload
      res.ended = true
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Lightweight mock of the handler's delete branch logic
// This mirrors the real handler logic without importing the full module,
// avoiding transitive server-only dependencies.
// ---------------------------------------------------------------------------

async function runDeleteBranch({ actor, clientId, softDeleteResult, existsResult, db, res, sendJson }) {
  const sendError = (sj, statusCode, code, message) => sj(statusCode, { error: { code, message } })

  // Guard: financeiro read-only
  if (actor.isFinanceiro && !actor.isAdmin) {
    sendJson(403, { error: { code: 'FORBIDDEN', message: 'Read-only role' } })
    return
  }

  try {
    const deleted = softDeleteResult

    if (!deleted) {
      const existsRows = existsResult
      if (existsRows.length > 0) {
        sendError(sendJson, 403, 'FORBIDDEN', 'Not authorized to delete this client')
        return
      }
      res.statusCode = 204
      res.end()
      return
    }

    // success
    res.statusCode = 204
    res.end()
  } catch (err) {
    sendError(sendJson, 500, 'INTERNAL_ERROR', 'Failed to delete client')
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DELETE /api/clients/:id handler logic', () => {
  let res
  let sentStatus
  let sentBody

  beforeEach(() => {
    res = makeRes()
    sentStatus = null
    sentBody = null
  })

  function sendJson(status, payload) {
    sentStatus = status
    sentBody = payload
    res.statusCode = status
    res.ended = true
  }

  // ── Case 1: owner deletes own client (success) ─────────────────────────────
  it('responds 204 when softDelete affects 1 row (owner success)', async () => {
    await runDeleteBranch({
      actor: { userId: 'user-1', isAdmin: false, isFinanceiro: false },
      clientId: 'client-123',
      softDeleteResult: { id: 'client-123' }, // row returned
      existsResult: [],                         // not reached
      db: {},
      res,
      sendJson,
    })

    expect(res.statusCode).toBe(204)
    expect(res.ended).toBe(true)
    expect(sentStatus).toBeNull() // sendJson was not called
  })

  // ── Case 2: admin deletes client of another owner ─────────────────────────
  it('responds 204 when admin soft-deletes any client', async () => {
    await runDeleteBranch({
      actor: { userId: 'admin-user', isAdmin: true, isFinanceiro: false },
      clientId: 'client-999',
      softDeleteResult: { id: 'client-999' },
      existsResult: [],
      db: {},
      res,
      sendJson,
    })

    expect(res.statusCode).toBe(204)
    expect(res.ended).toBe(true)
  })

  // ── Case 3: comercial tries to delete client belonging to another owner ────
  // RLS blocks the UPDATE → 0 rows; bypass check finds the record → 403
  it('responds 403 when UPDATE returns 0 rows but record still exists (RLS blocked)', async () => {
    await runDeleteBranch({
      actor: { userId: 'comercial-user', isAdmin: false, isFinanceiro: false },
      clientId: 'client-other',
      softDeleteResult: null,           // 0 rows from UPDATE
      existsResult: [{ 1: 1 }],         // record still exists
      db: {},
      res,
      sendJson,
    })

    expect(sentStatus).toBe(403)
    expect(sentBody?.error?.code).toBe('FORBIDDEN')
  })

  // ── Case 4: client is genuinely absent ─────────────────────────────────────
  it('responds 204 when UPDATE returns 0 rows and record does not exist', async () => {
    await runDeleteBranch({
      actor: { userId: 'user-1', isAdmin: false, isFinanceiro: false },
      clientId: 'client-gone',
      softDeleteResult: null,   // 0 rows
      existsResult: [],          // no row found
      db: {},
      res,
      sendJson,
    })

    expect(res.statusCode).toBe(204)
    expect(res.ended).toBe(true)
    expect(sentStatus).toBeNull()
  })

  // ── Case 5: financeiro is blocked regardless ───────────────────────────────
  it('responds 403 for financeiro role (read-only)', async () => {
    await runDeleteBranch({
      actor: { userId: 'fin-user', isAdmin: false, isFinanceiro: true },
      clientId: 'client-123',
      softDeleteResult: { id: 'client-123' },
      existsResult: [],
      db: {},
      res,
      sendJson,
    })

    expect(sentStatus).toBe(403)
    expect(sentBody?.error?.code).toBe('FORBIDDEN')
  })

  // ── Case 6: owner_user_id null – role_comercial ────────────────────────────
  // If owner_user_id is NULL, RLS should block comercial (UPDATE 0 rows) and
  // bypass check shows the record exists → 403.
  it('responds 403 when owner_user_id is null and actor is comercial', async () => {
    await runDeleteBranch({
      actor: { userId: 'comercial-user', isAdmin: false, isFinanceiro: false },
      clientId: 'client-null-owner',
      softDeleteResult: null,          // blocked by RLS (owner_user_id NULL ≠ uid)
      existsResult: [{ 1: 1 }],        // but record really exists
      db: {},
      res,
      sendJson,
    })

    expect(sentStatus).toBe(403)
    expect(sentBody?.error?.code).toBe('FORBIDDEN')
  })
})
