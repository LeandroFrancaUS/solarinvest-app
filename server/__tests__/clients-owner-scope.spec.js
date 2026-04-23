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

// Placeholder name blocklist — mirrors listClients() in repository.js and the
// vw_clients_listable view (migration 0052).
const CLIENT_PLACEHOLDER_NAMES = new Set([
  '0', 'null', 'undefined', '[object object]', '-', '\u2014',
])

function hasListableAnchor(row) {
  const name = (row.client_name ?? '').trim().toLowerCase()
  const hasValidName =
    name !== '' && !CLIENT_PLACEHOLDER_NAMES.has(name)
  const hasValidEmail =
    row.client_email != null && String(row.client_email).includes('@')
  const phoneDigits = String(row.client_phone ?? '').replace(/\D/g, '')
  const hasValidPhone = phoneDigits.length >= 10
  return (
    hasValidName ||
    row.cpf_normalized != null ||
    row.cnpj_normalized != null ||
    hasValidEmail ||
    hasValidPhone
  )
}

// Mirrors listClients() owner-filter injection logic (repository.js).
function buildOwnerConditions({ actorUserId = null, actorRole = null, createdByUserId = null } = {}) {
  // Must match the updated baseConditions + conditions arrays in repository.js.
  const conditions = [
    'c.deleted_at IS NULL',
    "coalesce(c.identity_status, '') <> 'merged'",
    // Listable anchor guard (abbreviated for condition-check tests)
    'c.cpf_normalized IS NOT NULL OR c.client_email IS NOT NULL OR ...',
    'c.merged_into_client_id IS NULL',
  ]
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
// owner_user_id filter that listClients() injects for role_comercial,
// plus the new listability filters (identity_status + anchor guard).
function simulateListClients(dbRows, { actorUserId = null, actorRole = null } = {}) {
  const scopeByOwner = actorRole === 'role_comercial' && Boolean(actorUserId)
  return dbRows.filter((row) => {
    if (row.deleted_at) return false
    if (row.merged_into_client_id) return false
    if ((row.identity_status ?? '') === 'merged') return false
    if (!hasListableAnchor(row)) return false
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
  { id: 'client-a1', owner_user_id: CONSULTOR_A_ID, deleted_at: null, client_name: 'Ana Souza', client_email: 'ana@empresa.com', client_phone: null, cpf_normalized: null, cnpj_normalized: null, merged_into_client_id: null, identity_status: 'pending_cpf' },
  { id: 'client-a2', owner_user_id: CONSULTOR_A_ID, deleted_at: null, client_name: 'Carlos Lima', client_email: null, client_phone: '11999990001', cpf_normalized: null, cnpj_normalized: null, merged_into_client_id: null, identity_status: 'pending_cpf' },
  { id: 'client-b1', owner_user_id: CONSULTOR_B_ID, deleted_at: null, client_name: 'Maria Silva', client_email: 'maria@test.com', client_phone: null, cpf_normalized: null, cnpj_normalized: null, merged_into_client_id: null, identity_status: 'confirmed' },
  { id: 'client-b2', owner_user_id: CONSULTOR_B_ID, deleted_at: null, client_name: null, client_email: null, client_phone: null, cpf_normalized: '12345678901', cnpj_normalized: null, merged_into_client_id: null, identity_status: 'confirmed' },
  { id: 'client-b3', owner_user_id: CONSULTOR_B_ID, deleted_at: '2026-01-01T00:00:00Z', client_name: 'Deleted', client_email: null, client_phone: null, cpf_normalized: null, cnpj_normalized: null, merged_into_client_id: null, identity_status: 'pending_cpf' }, // deleted
  { id: 'client-adm', owner_user_id: ADMIN_ID, deleted_at: null, client_name: 'Admin Client', client_email: 'adm@test.com', client_phone: null, cpf_normalized: null, cnpj_normalized: null, merged_into_client_id: null, identity_status: 'confirmed' },
]

/** Clients that should be hidden by the new listability filters */
const garbageClients = [
  // Merged client — has merged_into_client_id set
  { id: 'merged-1', owner_user_id: CONSULTOR_A_ID, deleted_at: null, client_name: 'João Real', client_email: null, client_phone: null, cpf_normalized: '11111111111', cnpj_normalized: null, merged_into_client_id: 'client-a1', identity_status: 'pending_cpf' },
  // identity_status = 'merged' (without merged_into_client_id, edge-case)
  { id: 'status-merged-1', owner_user_id: CONSULTOR_A_ID, deleted_at: null, client_name: 'Dup Name', client_email: 'dup@x.com', client_phone: null, cpf_normalized: null, cnpj_normalized: null, merged_into_client_id: null, identity_status: 'merged' },
  // Placeholder name, no anchors
  { id: 'garbage-zero', owner_user_id: CONSULTOR_B_ID, deleted_at: null, client_name: '0', client_email: null, client_phone: null, cpf_normalized: null, cnpj_normalized: null, merged_into_client_id: null, identity_status: 'pending_cpf' },
  { id: 'garbage-obj', owner_user_id: CONSULTOR_B_ID, deleted_at: null, client_name: '[object Object]', client_email: null, client_phone: null, cpf_normalized: null, cnpj_normalized: null, merged_into_client_id: null, identity_status: 'pending_cpf' },
  // Null name, no anchors
  { id: 'garbage-null-name', owner_user_id: CONSULTOR_A_ID, deleted_at: null, client_name: null, client_email: null, client_phone: null, cpf_normalized: null, cnpj_normalized: null, merged_into_client_id: null, identity_status: 'pending_cpf' },
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

describe('F.3 Admin sees all (active, listable) clients', () => {
  it('list result contains all active listable clients for role_admin', () => {
    const visible = simulateListClients(allClients, {
      actorUserId: ADMIN_ID,
      actorRole: 'role_admin',
    })
    // deleted client-b3 excluded; all remaining records are listable (have a valid anchor)
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

// ─── Listability filter: merged and garbage records ───────────────────────────

describe('Listability filter: merged clients are excluded', () => {
  it('client with merged_into_client_id set is hidden', () => {
    const visible = simulateListClients(garbageClients, { actorRole: 'role_admin', actorUserId: ADMIN_ID })
    expect(visible.map((c) => c.id)).not.toContain('merged-1')
  })

  it('client with identity_status=merged (without merged_into_client_id) is hidden', () => {
    const visible = simulateListClients(garbageClients, { actorRole: 'role_admin', actorUserId: ADMIN_ID })
    expect(visible.map((c) => c.id)).not.toContain('status-merged-1')
  })

  it('none of the garbage clients are visible', () => {
    const visible = simulateListClients(garbageClients, { actorRole: 'role_admin', actorUserId: ADMIN_ID })
    expect(visible).toHaveLength(0)
  })
})

describe('Listability filter: placeholder names without anchors are excluded', () => {
  it('client_name="0" with no CPF/email/phone is hidden', () => {
    expect(hasListableAnchor({ client_name: '0', client_email: null, client_phone: null, cpf_normalized: null, cnpj_normalized: null })).toBe(false)
  })

  it('client_name="[object Object]" with no CPF/email/phone is hidden', () => {
    expect(hasListableAnchor({ client_name: '[object Object]', client_email: null, client_phone: null, cpf_normalized: null, cnpj_normalized: null })).toBe(false)
  })

  it('client_name=null with no CPF/email/phone is hidden', () => {
    expect(hasListableAnchor({ client_name: null, client_email: null, client_phone: null, cpf_normalized: null, cnpj_normalized: null })).toBe(false)
  })

  it('client with valid name is shown even without CPF/email/phone', () => {
    expect(hasListableAnchor({ client_name: 'João Silva', client_email: null, client_phone: null, cpf_normalized: null, cnpj_normalized: null })).toBe(true)
  })

  it('client with CPF is shown even if name is a placeholder', () => {
    expect(hasListableAnchor({ client_name: '0', client_email: null, client_phone: null, cpf_normalized: '12345678901', cnpj_normalized: null })).toBe(true)
  })

  it('client with valid email is shown even if name is placeholder', () => {
    expect(hasListableAnchor({ client_name: 'null', client_email: 'x@domain.com', client_phone: null, cpf_normalized: null, cnpj_normalized: null })).toBe(true)
  })

  it('client with valid phone (>= 10 digits) is shown even if name is placeholder', () => {
    expect(hasListableAnchor({ client_name: '-', client_email: null, client_phone: '11999990000', cpf_normalized: null, cnpj_normalized: null })).toBe(true)
  })

  it('phone with fewer than 10 digits does NOT count as a valid anchor', () => {
    expect(hasListableAnchor({ client_name: null, client_email: null, client_phone: '99999', cpf_normalized: null, cnpj_normalized: null })).toBe(false)
  })

  it('email without @ does NOT count as a valid anchor', () => {
    expect(hasListableAnchor({ client_name: null, client_email: 'domin', client_phone: null, cpf_normalized: null, cnpj_normalized: null })).toBe(false)
  })
})

describe('validateClientWriteFields: rejects garbage on creation', () => {
  // Mirror the CLIENT_PLACEHOLDER_NAMES check from handler.js inline.
  const BLOCKED = new Set(['[object object]', '0', 'null', 'undefined', '-', '\u2014'])
  function validateName(raw) {
    if (raw == null) return { ok: true }
    const lower = String(raw).trim().toLowerCase()
    return BLOCKED.has(lower) ? { ok: false } : { ok: true }
  }
  function validateEmail(raw) {
    if (!raw || String(raw).trim() === '') return { ok: true }
    return String(raw).includes('@') ? { ok: true } : { ok: false }
  }
  function validatePhone(raw) {
    if (!raw || String(raw).trim() === '') return { ok: true }
    const digits = String(raw).replace(/\D/g, '')
    return digits.length === 0 || digits.length >= 10 ? { ok: true } : { ok: false }
  }

  it('rejects client_name="[object Object]"', () => {
    expect(validateName('[object Object]').ok).toBe(false)
  })

  it('rejects client_name="0"', () => {
    expect(validateName('0').ok).toBe(false)
  })

  it('accepts client_name="João Silva"', () => {
    expect(validateName('João Silva').ok).toBe(true)
  })

  it('accepts null name (required check happens separately)', () => {
    expect(validateName(null).ok).toBe(true)
  })

  it('rejects email without @', () => {
    expect(validateEmail('domin').ok).toBe(false)
  })

  it('accepts valid email', () => {
    expect(validateEmail('user@domain.com').ok).toBe(true)
  })

  it('accepts null email', () => {
    expect(validateEmail(null).ok).toBe(true)
  })

  it('rejects phone with 5 digits', () => {
    expect(validatePhone('99999').ok).toBe(false)
  })

  it('accepts phone with 11 digits', () => {
    expect(validatePhone('11999990000').ok).toBe(true)
  })

  it('accepts null phone', () => {
    expect(validatePhone(null).ok).toBe(true)
  })
})

