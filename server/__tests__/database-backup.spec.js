// server/__tests__/database-backup.spec.js
// Unit tests for the databaseBackup route helper functions.
// Run with: npm run test:server

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Inline copies of the pure helpers from databaseBackup.js to test them
// without importing the full ESM module (which has side-effect imports).
// ---------------------------------------------------------------------------

function toIsoString(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value?.toISOString === 'function') return value.toISOString()
  return String(value)
}

function parseDestination(value) {
  if (typeof value !== 'string') return 'local'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'platform' || normalized === 'cloud') return normalized
  return 'local'
}

function parseAction(value) {
  if (typeof value !== 'string') return 'export'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'import' || normalized === 'restore') return 'import'
  return 'export'
}

function sanitizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value
}

function serializeForQuery(val) {
  if (val === null || val === undefined) return null
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'object') return JSON.stringify(val)
  return val
}

function pickColumns(record, columns) {
  const base = sanitizeObject(record)
  if (!base) return null
  const picked = {}
  for (const column of columns) {
    if (Object.prototype.hasOwnProperty.call(base, column)) {
      picked[column] = base[column]
    }
  }
  return picked
}

// ---------------------------------------------------------------------------
// Tests: parseAction
// ---------------------------------------------------------------------------

describe('parseAction', () => {
  it('returns "import" for "import"', () => {
    expect(parseAction('import')).toBe('import')
  })
  it('returns "import" for "restore"', () => {
    expect(parseAction('restore')).toBe('import')
  })
  it('returns "export" for anything else', () => {
    expect(parseAction('export')).toBe('export')
    expect(parseAction(null)).toBe('export')
    expect(parseAction(42)).toBe('export')
    expect(parseAction('')).toBe('export')
  })
})

// ---------------------------------------------------------------------------
// Tests: parseDestination
// ---------------------------------------------------------------------------

describe('parseDestination', () => {
  it('returns "platform" for "platform"', () => {
    expect(parseDestination('platform')).toBe('platform')
  })
  it('returns "cloud" for "cloud"', () => {
    expect(parseDestination('cloud')).toBe('cloud')
  })
  it('defaults to "local"', () => {
    expect(parseDestination('local')).toBe('local')
    expect(parseDestination(null)).toBe('local')
    expect(parseDestination('other')).toBe('local')
  })
})

// ---------------------------------------------------------------------------
// Tests: serializeForQuery
// ---------------------------------------------------------------------------

describe('serializeForQuery', () => {
  it('passes null through', () => {
    expect(serializeForQuery(null)).toBeNull()
    expect(serializeForQuery(undefined)).toBeNull()
  })

  it('serializes Date objects to ISO strings', () => {
    const d = new Date('2024-01-01T00:00:00Z')
    expect(serializeForQuery(d)).toBe('2024-01-01T00:00:00.000Z')
  })

  it('JSON.stringifies plain objects (for JSONB columns)', () => {
    const obj = { key: 'value', nested: { a: 1 } }
    expect(serializeForQuery(obj)).toBe(JSON.stringify(obj))
  })

  it('JSON.stringifies arrays', () => {
    const arr = [1, 2, 3]
    expect(serializeForQuery(arr)).toBe(JSON.stringify(arr))
  })

  it('passes strings through unchanged', () => {
    expect(serializeForQuery('hello')).toBe('hello')
  })

  it('passes numbers through unchanged', () => {
    expect(serializeForQuery(42)).toBe(42)
    expect(serializeForQuery(3.14)).toBe(3.14)
  })

  it('passes booleans through unchanged', () => {
    expect(serializeForQuery(true)).toBe(true)
    expect(serializeForQuery(false)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Tests: pickColumns
// ---------------------------------------------------------------------------

describe('pickColumns', () => {
  it('picks only the listed columns from the record', () => {
    const record = { id: 1, name: 'Test', extra: 'ignored' }
    expect(pickColumns(record, ['id', 'name'])).toEqual({ id: 1, name: 'Test' })
  })

  it('returns null for null/undefined/array input', () => {
    expect(pickColumns(null, ['id'])).toBeNull()
    expect(pickColumns(undefined, ['id'])).toBeNull()
    expect(pickColumns([], ['id'])).toBeNull()
  })

  it('omits columns absent from the record', () => {
    const record = { id: 1 }
    const result = pickColumns(record, ['id', 'name', 'email'])
    expect(result).toEqual({ id: 1 })
  })
})

// ---------------------------------------------------------------------------
// Tests: backup payload validation (restoreBackupPayload inline logic)
// ---------------------------------------------------------------------------

describe('backup payload structure validation', () => {
  it('detects missing data block', () => {
    const payload = { generatedAt: '2024-01-01' } // no .data
    const data = sanitizeObject(payload?.data)
    expect(data).toBeNull()
  })

  it('accepts full native export structure', () => {
    const payload = {
      generatedAt: '2024-01-01T00:00:00Z',
      generatedBy: { userId: 'u1', email: 'a@b.com', role: 'role_admin' },
      database: { name: 'neondb', postgresVersion: '15.0' },
      summary: { totalClients: 2, totalProposals: 1, totalClientAuditRows: 0 },
      data: {
        clients: [
          { id: '1', name: 'Client A', metadata: { foo: 'bar' } },
          { id: '2', name: 'Client B', deleted_at: '2024-06-01T00:00:00Z' },
        ],
        proposals: [
          {
            id: 'abc-uuid',
            proposal_type: 'leasing',
            owner_user_id: 'u1',
            created_by_user_id: 'u1',
            payload_json: { deep: { nested: true } },
          },
        ],
      },
    }

    const backupObject = sanitizeObject(payload)
    expect(backupObject).not.toBeNull()

    const data = sanitizeObject(backupObject.data)
    expect(data).not.toBeNull()

    const clients = Array.isArray(data.clients) ? data.clients : []
    const proposals = Array.isArray(data.proposals) ? data.proposals : []

    expect(clients).toHaveLength(2)
    expect(proposals).toHaveLength(1)
  })

  it('serializes payload_json correctly for insertion', () => {
    const proposal = {
      id: 'abc-uuid',
      proposal_type: 'leasing',
      owner_user_id: 'u1',
      created_by_user_id: 'u1',
      payload_json: { solar: { kwp: 10 }, pricing: [1, 2, 3] },
    }
    const COLS = ['id', 'proposal_type', 'owner_user_id', 'created_by_user_id', 'payload_json']
    const picked = pickColumns(proposal, COLS)
    const values = COLS.map((col) => serializeForQuery(picked[col] ?? null))

    // payload_json should be a JSON string, not an object
    const payloadJsonIndex = COLS.indexOf('payload_json')
    expect(typeof values[payloadJsonIndex]).toBe('string')
    expect(JSON.parse(values[payloadJsonIndex])).toEqual(proposal.payload_json)
  })

  it('serializes metadata correctly for insertion', () => {
    const client = { id: '1', name: 'Test', metadata: { source: 'web', tags: ['a', 'b'] } }
    const COLS = ['id', 'name', 'metadata']
    const picked = pickColumns(client, COLS)
    const values = COLS.map((col) => serializeForQuery(picked[col] ?? null))

    const metaIndex = COLS.indexOf('metadata')
    expect(typeof values[metaIndex]).toBe('string')
    expect(JSON.parse(values[metaIndex])).toEqual(client.metadata)
  })

  it('defaults created_by_user_id to owner_user_id when absent', () => {
    const proposal = {
      id: 'abc-uuid',
      proposal_type: 'leasing',
      owner_user_id: 'u1',
      // created_by_user_id intentionally absent (older backup)
      payload_json: {},
    }
    const COLS = ['id', 'proposal_type', 'owner_user_id', 'created_by_user_id', 'payload_json']
    const picked = pickColumns(proposal, COLS)

    // Simulate the fallback logic from upsertProposal
    if (!picked.created_by_user_id && COLS.includes('created_by_user_id')) {
      picked.created_by_user_id = picked.owner_user_id
    }

    expect(picked.created_by_user_id).toBe('u1')
  })

  it('preserves deleted_at (soft deleted clients) from backup', () => {
    const client = {
      id: '3',
      name: 'Deleted Client',
      deleted_at: '2024-06-15T10:00:00Z',
    }
    const COLS = ['id', 'name', 'deleted_at']
    const picked = pickColumns(client, COLS)
    expect(picked.deleted_at).toBe('2024-06-15T10:00:00Z')
  })

  it('accepts string ids (bigint-as-string from neon HTTP driver)', () => {
    const client = { id: '42', name: 'Client', owner_user_id: 'u1' }
    // id is truthy as a string — the guard !client?.id would pass
    expect(!client?.id).toBe(false)
  })
})
