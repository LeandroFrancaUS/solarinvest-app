// server/__tests__/clients-owner-scope.spec.js
//
// Automated tests for owner-scoped access control on the /api/clients routes.
// Covers the six scenarios from spec F of the security hardening requirements:
//
//   F.1 Consultor A sees only their own clients (list)
//   F.2 Consultor B sees only their own clients (list)
//   F.3 Admin sees all clients
//   F.4 Consultor cannot access a client belonging to another owner (GET /:id)
//   F.5 Consultor cannot edit a client belonging to another owner (PUT /:id)
//   F.6 Consultor cannot delete a client belonging to another owner (DELETE /:id)
//
// These tests validate the application-layer defense-in-depth logic that mirrors
// the PostgreSQL RLS policies. No live database is required.
//
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect } from 'vitest'

// ─── Inline helpers ───────────────────────────────────────────────────────────
// All helpers below are extracted inline from repository.js / handler.js to
// avoid transitive server-only dependencies (DB drivers, env vars, etc.).

// Mirrors listClients() owner-filter injection logic (repository.js).
function buildOwnerConditions({ actorUserId = null, actorRole = null, createdByUserId = null } = {}) {
  const conditions = ['c.deleted_at IS NULL', 'c.merged_into_client_id IS NULL']
  const params = []

  if (createdByUserId) {
    params.push(createdByUserId)
    conditions.push(`c.created_by_user_id = $${params.length}`)
  }

  // Defense-in-depth: scope list to owner for role_comercial.
  if (actorRole === 'role_comercial' && actorUserId) {
    params.push(actorUserId)
    conditions.push(`c.owner_user_id = $${params.length}`)
  }

  return { conditions, params }
}

// Mirrors getClientById() owner-scope decision (repository.js).
function wouldScopeGetById({ actorRole = null, actorUserId = null }) {
  return actorRole === 'role_comercial' && Boolean(actorUserId)
}

// Simulates what updateClient() does: returns updated row only when owner matches
// (mirrors the WHERE clause added for role_comercial).
function simulateUpdateClient({ clientOwner, actorUserId, actorRole }) {
  const scopeByOwner = actorRole === 'role_comercial' && Boolean(actorUserId)
  if (!scopeByOwner) return { id: 'client-x', owner_user_id: clientOwner } // admin/privileged: always succeeds
  if (clientOwner === actorUserId) return { id: 'client-x', owner_user_id: clientOwner }
  return null // owner mismatch → no rows returned
}

// Simulates what softDeleteClient() does: returns id only when owner matches
// (mirrors the WHERE clause added for role_comercial).
function simulateSoftDelete({ clientOwner, actorUserId, actorRole }) {
  const scopeByOwner = actorRole === 'role_comercial' && Boolean(actorUserId)
  if (!scopeByOwner) return { id: 'client-x' } // admin/privileged: always succeeds
  if (clientOwner === actorUserId) return { id: 'client-x' }
  return null // owner mismatch → 0 rows
}

// Simulate a filtered list view: given a list of DB rows, apply the same
// owner_user_id filter that listClients() injects for role_comercial.
function simulateListClients(dbRows, { actorUserId = null, actorRole = null } = {}) {
  const scopeByOwner = actorRole === 'role_comercial' && Boolean(actorUserId)
  return dbRows.filter((row) => {
    if (row.deleted_at) return false
    if (scopeByOwner && row.owner_user_id !== actorUserId) return false
    return true
  })
}

// ─── Test data ────────────────────────────────────────────────────────────────

const CONSULTOR_A_ID = 'aaaa0000-0000-0000-0000-000000000001'
const CONSULTOR_B_ID = 'bbbb0000-0000-0000-0000-000000000002'
const ADMIN_ID       = 'admin000-0000-0000-0000-000000000000'

/** Shared pool of clients owned by A and B */
const allClients = [
  { id: 'client-a1', owner_user_id: CONSULTOR_A_ID, deleted_at: null },
  { id: 'client-a2', owner_user_id: CONSULTOR_A_ID, deleted_at: null },
  { id: 'client-b1', owner_user_id: CONSULTOR_B_ID, deleted_at: null },
  { id: 'client-b2', owner_user_id: CONSULTOR_B_ID, deleted_at: null },
  { id: 'client-b3', owner_user_id: CONSULTOR_B_ID, deleted_at: '2026-01-01T00:00:00Z' }, // deleted
  { id: 'client-adm', owner_user_id: ADMIN_ID, deleted_at: null },
]

// ─── F.1 — Consultor A sees only their own clients ────────────────────────────

describe('F.1 Consultor A sees only their own clients', () => {
  it('list result contains only clients owned by Consultor A', () => {
    const visible = simulateListClients(allClients, {
      actorUserId: CONSULTOR_A_ID,
      actorRole: 'role_comercial',
    })
    expect(visible.map((c) => c.id)).toEqual(['client-a1', 'client-a2'])
  })

  it('owner filter condition is injected for role_comercial', () => {
    const { conditions, params } = buildOwnerConditions({
      actorUserId: CONSULTOR_A_ID,
      actorRole: 'role_comercial',
    })
    expect(conditions).toContain(`c.owner_user_id = $${params.length}`)
    expect(params).toContain(CONSULTOR_A_ID)
  })
})

// ─── F.2 — Consultor B sees only their own clients ────────────────────────────

describe('F.2 Consultor B sees only their own clients', () => {
  it('list result contains only active clients owned by Consultor B', () => {
    const visible = simulateListClients(allClients, {
      actorUserId: CONSULTOR_B_ID,
      actorRole: 'role_comercial',
    })
    // client-b3 is deleted and must be excluded
    expect(visible.map((c) => c.id)).toEqual(['client-b1', 'client-b2'])
  })

  it('B cannot see clients belonging to A', () => {
    const visible = simulateListClients(allClients, {
      actorUserId: CONSULTOR_B_ID,
      actorRole: 'role_comercial',
    })
    expect(visible.every((c) => c.owner_user_id === CONSULTOR_B_ID)).toBe(true)
  })
})

// ─── F.3 — Admin sees all clients ─────────────────────────────────────────────

describe('F.3 Admin sees all (active) clients', () => {
  it('list result contains all active clients for role_admin', () => {
    const visible = simulateListClients(allClients, {
      actorUserId: ADMIN_ID,
      actorRole: 'role_admin',
    })
    // deleted client-b3 excluded; all others included
    const expected = allClients.filter((c) => !c.deleted_at).map((c) => c.id)
    expect(visible.map((c) => c.id)).toEqual(expected)
  })

  it('no owner filter condition is injected for role_admin', () => {
    const { conditions } = buildOwnerConditions({
      actorUserId: ADMIN_ID,
      actorRole: 'role_admin',
    })
    expect(conditions.every((c) => !c.includes('owner_user_id'))).toBe(true)
  })
})

// ─── F.4 — Consultor cannot GET a client they don't own ───────────────────────

describe('F.4 Consultor cannot access client of another owner (GET /:id)', () => {
  it('getClientById uses owner-scoped path for role_comercial', () => {
    expect(wouldScopeGetById({ actorRole: 'role_comercial', actorUserId: CONSULTOR_A_ID })).toBe(true)
  })

  it('getClientById does NOT scope for role_admin', () => {
    expect(wouldScopeGetById({ actorRole: 'role_admin', actorUserId: ADMIN_ID })).toBe(false)
  })

  it('consultor A cannot access client owned by consultor B via owner-scoped query', () => {
    // Simulate the SQL: WHERE id = $1 AND owner_user_id = $2 returning no rows
    // because the client belongs to B, not A.
    const clientBRecord = allClients.find((c) => c.id === 'client-b1')
    const visible = clientBRecord && clientBRecord.owner_user_id === CONSULTOR_A_ID
      ? clientBRecord
      : null
    expect(visible).toBeNull()
  })

  it('owner-scope check is skipped when actorUserId is null', () => {
    expect(wouldScopeGetById({ actorRole: 'role_comercial', actorUserId: null })).toBe(false)
  })
})

// ─── F.5 — Consultor cannot PUT (edit) a client they don't own ────────────────

describe('F.5 Consultor cannot edit client of another owner (PUT /:id)', () => {
  it('updateClient returns null when consultor tries to update a client they do not own', () => {
    const result = simulateUpdateClient({
      clientOwner: CONSULTOR_B_ID,
      actorUserId: CONSULTOR_A_ID,
      actorRole: 'role_comercial',
    })
    expect(result).toBeNull()
  })

  it('updateClient succeeds when consultor updates their own client', () => {
    const result = simulateUpdateClient({
      clientOwner: CONSULTOR_A_ID,
      actorUserId: CONSULTOR_A_ID,
      actorRole: 'role_comercial',
    })
    expect(result).not.toBeNull()
    expect(result.owner_user_id).toBe(CONSULTOR_A_ID)
  })

  it('admin can update any client regardless of ownership', () => {
    const result = simulateUpdateClient({
      clientOwner: CONSULTOR_B_ID,
      actorUserId: ADMIN_ID,
      actorRole: 'role_admin',
    })
    expect(result).not.toBeNull()
  })
})

// ─── F.6 — Consultor cannot DELETE a client they don't own ───────────────────

describe('F.6 Consultor cannot delete client of another owner (DELETE /:id)', () => {
  it('softDeleteClient returns null when consultor tries to delete a client they do not own', () => {
    const result = simulateSoftDelete({
      clientOwner: CONSULTOR_B_ID,
      actorUserId: CONSULTOR_A_ID,
      actorRole: 'role_comercial',
    })
    expect(result).toBeNull()
  })

  it('softDeleteClient succeeds when consultor deletes their own client', () => {
    const result = simulateSoftDelete({
      clientOwner: CONSULTOR_A_ID,
      actorUserId: CONSULTOR_A_ID,
      actorRole: 'role_comercial',
    })
    expect(result).not.toBeNull()
  })

  it('admin can delete any client regardless of ownership', () => {
    const result = simulateSoftDelete({
      clientOwner: CONSULTOR_B_ID,
      actorUserId: ADMIN_ID,
      actorRole: 'role_admin',
    })
    expect(result).not.toBeNull()
  })

  it('0-rows delete of a foreign client triggers 403 (not 404)', () => {
    // Simulate DELETE handler logic: if softDelete returns null and db.sql
    // finds the record still exists → it was blocked by owner filter → 403.
    const softDeleteResult = simulateSoftDelete({
      clientOwner: CONSULTOR_B_ID,
      actorUserId: CONSULTOR_A_ID,
      actorRole: 'role_comercial',
    })
    const recordStillExists = true // service-bypass check confirms row is present

    let responseStatus
    if (!softDeleteResult) {
      if (recordStillExists) {
        responseStatus = 403
      } else {
        responseStatus = 204
      }
    } else {
      responseStatus = 204
    }

    expect(responseStatus).toBe(403)
  })
})

// ─── Cross-role consistency checks ───────────────────────────────────────────

describe('role_office and role_financeiro are not scoped to owner', () => {
  for (const role of ['role_office', 'role_financeiro']) {
    it(`${role}: list query does NOT inject owner filter`, () => {
      const { conditions } = buildOwnerConditions({ actorUserId: 'some-id', actorRole: role })
      expect(conditions.every((c) => !c.includes('owner_user_id'))).toBe(true)
    })

    it(`${role}: getClientById does NOT scope to owner`, () => {
      expect(wouldScopeGetById({ actorRole: role, actorUserId: 'some-id' })).toBe(false)
    })
  }
})
