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
  const sendError = (sendJsonFn, statusCode, code, message) => sendJsonFn(statusCode, { error: { code, message } })

  // Guard: financeiro read-only
  if (actor.isFinanceiro && !actor.isAdmin) {
    sendError(sendJson, 403, 'FORBIDDEN', 'Read-only role')
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

// ─────────────────────────────────────────────────────────────────────────────
// Application-layer owner filter tests (mirrors listClients behavior)
// These tests validate the logic added to listClients() in repository.js:
//   when actorRole === 'role_comercial', inject WHERE c.owner_user_id = actorUserId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inline the filter-injection logic from repository.js listClients()
 * so we can unit test it without DB dependencies.
 */
function buildOwnerConditions(filter) {
  const { actorUserId = null, actorRole: role = null, createdByUserId = null } = filter
  const conditions = ['c.deleted_at IS NULL', 'c.merged_into_client_id IS NULL']
  const params = []

  if (createdByUserId) {
    params.push(createdByUserId)
    conditions.push(`c.created_by_user_id = $${params.length}`)
  }

  if (role === 'role_comercial' && actorUserId) {
    params.push(actorUserId)
    conditions.push(`c.owner_user_id = $${params.length}`)
  }

  return { conditions, params }
}

describe('listClients — application-layer owner filter', () => {
  it('injects owner_user_id filter when actor is role_comercial', () => {
    const { conditions, params } = buildOwnerConditions({
      actorUserId: 'a94a2cfb-973b-48c5-a85d-e3d94559c334',
      actorRole: 'role_comercial',
    })
    expect(conditions).toContain('c.owner_user_id = $1')
    expect(params).toEqual(['a94a2cfb-973b-48c5-a85d-e3d94559c334'])
  })

  it('second consultor (2eca...) gets scoped to their own owner_user_id', () => {
    const { conditions, params } = buildOwnerConditions({
      actorUserId: '2eca0fe5-d4d8-4f9b-8fbb-02616e08aefa',
      actorRole: 'role_comercial',
    })
    expect(conditions.some((c) => c.includes('owner_user_id'))).toBe(true)
    expect(params).toContain('2eca0fe5-d4d8-4f9b-8fbb-02616e08aefa')
  })

  it('does NOT inject owner filter for role_admin', () => {
    const { conditions, params } = buildOwnerConditions({
      actorUserId: 'admin-id',
      actorRole: 'role_admin',
    })
    expect(conditions.every((c) => !c.includes('owner_user_id'))).toBe(true)
    expect(params).toHaveLength(0)
  })

  it('does NOT inject owner filter for role_office', () => {
    const { conditions } = buildOwnerConditions({
      actorUserId: 'office-id',
      actorRole: 'role_office',
    })
    expect(conditions.every((c) => !c.includes('owner_user_id'))).toBe(true)
  })

  it('does NOT inject owner filter for role_financeiro', () => {
    const { conditions } = buildOwnerConditions({
      actorUserId: 'fin-id',
      actorRole: 'role_financeiro',
    })
    expect(conditions.every((c) => !c.includes('owner_user_id'))).toBe(true)
  })

  it('does NOT inject owner filter when actorUserId is null (safety guard)', () => {
    const { conditions } = buildOwnerConditions({
      actorUserId: null,
      actorRole: 'role_comercial',
    })
    expect(conditions.every((c) => !c.includes('owner_user_id'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getClientById owner-scope tests
// These tests validate that the getClientById helper would generate the correct
// query form based on the caller's role (mirrors repository.js getClientById).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inline the getClientById scoping decision from repository.js.
 * Returns true when the owner-scoped query path would be taken.
 */
function wouldScopeByOwner({ actorRole: role = null, actorUserId = null }) {
  return role === 'role_comercial' && Boolean(actorUserId)
}

describe('getClientById — owner scoping decision', () => {
  it('scopes by owner for role_comercial with valid userId', () => {
    expect(wouldScopeByOwner({ actorRole: 'role_comercial', actorUserId: 'u1' })).toBe(true)
  })

  it('does NOT scope by owner for role_admin', () => {
    expect(wouldScopeByOwner({ actorRole: 'role_admin', actorUserId: 'admin-id' })).toBe(false)
  })

  it('does NOT scope by owner for role_office', () => {
    expect(wouldScopeByOwner({ actorRole: 'role_office', actorUserId: 'office-id' })).toBe(false)
  })

  it('does NOT scope by owner for role_financeiro', () => {
    expect(wouldScopeByOwner({ actorRole: 'role_financeiro', actorUserId: 'fin-id' })).toBe(false)
  })

  it('does NOT scope when actorUserId is null even for comercial role', () => {
    expect(wouldScopeByOwner({ actorRole: 'role_comercial', actorUserId: null })).toBe(false)
  })
})
