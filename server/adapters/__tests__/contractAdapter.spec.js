// server/adapters/__tests__/contractAdapter.spec.js
// Unit tests for server/adapters/contractAdapter.js
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect } from 'vitest'
import { fromDb, toDb, toCancel } from '../contractAdapter.js'

const ACTOR = { authProviderUserId: 'user-contract-test' }

const DB_CONTRACT_ROW = {
  id:                          101,
  client_id:                   5001,
  contract_type:               'leasing',
  contract_status:             'active',
  contract_signed_at:          '2024-03-01T00:00:00Z',
  contract_start_date:         '2024-04-01',
  billing_start_date:          '2024-04-01',
  expected_billing_end_date:   '2034-03-31',
  contractual_term_months:     120,
  buyout_eligible:             true,
  buyout_status:               null,
  buyout_date:                 null,
  buyout_amount_reference:     null,
  notes:                       null,
  // Legacy TEXT fields (no FK)
  source_proposal_id:          'PROP-LEGACY-001',
  consultant_id:               'CONSULT-XYZ',
  contract_attachments_json:   [{ name: 'contract.pdf', url: 'https://s3/contract.pdf' }],
  created_at:                  '2024-03-01T00:00:00Z',
  updated_at:                  '2024-03-15T00:00:00Z',
}

// ─── fromDb ───────────────────────────────────────────────────────────────────

describe('ContractAdapter.fromDb', () => {
  it('maps all production columns correctly', () => {
    const model = fromDb(DB_CONTRACT_ROW)

    expect(model.id).toBe(101)
    expect(model.client_id).toBe(5001)
    expect(model.contract_type).toBe('leasing')
    expect(model.contract_status).toBe('active')
    expect(model.contract_signed_at).toBe('2024-03-01T00:00:00Z')
    expect(model.contractual_term_months).toBe(120)
    expect(model.buyout_eligible).toBe(true)
  })

  it('surfaces legacy TEXT source_proposal_id as-is', () => {
    const model = fromDb(DB_CONTRACT_ROW)
    expect(model.source_proposal_id).toBe('PROP-LEGACY-001')
    expect(typeof model.source_proposal_id).toBe('string')
  })

  it('surfaces legacy TEXT consultant_id as-is', () => {
    const model = fromDb(DB_CONTRACT_ROW)
    expect(model.consultant_id).toBe('CONSULT-XYZ')
    expect(typeof model.consultant_id).toBe('string')
  })

  it('surfaces contract_attachments_json when present', () => {
    const model = fromDb(DB_CONTRACT_ROW)
    expect(Array.isArray(model.contract_attachments_json)).toBe(true)
    expect(model.contract_attachments_json).toHaveLength(1)
  })

  it('returns null source_proposal_id when absent', () => {
    const row = { ...DB_CONTRACT_ROW, source_proposal_id: null }
    const model = fromDb(row)
    expect(model.source_proposal_id).toBeNull()
  })

  it('returns null consultant_id when absent', () => {
    const row = { ...DB_CONTRACT_ROW, consultant_id: null }
    const model = fromDb(row)
    expect(model.consultant_id).toBeNull()
  })

  it('returns null for null input', () => {
    expect(fromDb(null)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(fromDb(42)).toBeNull()
  })
})

// ─── toDb ─────────────────────────────────────────────────────────────────────

describe('ContractAdapter.toDb', () => {
  it('maps model fields to DB shape', () => {
    const model = {
      client_id:            5001,
      contract_type:        'sale',
      contract_status:      'draft',
      source_proposal_id:   'PROP-TEXT-ID',
      consultant_id:        'CONSULT-TEXT',
    }

    const db = toDb(model, ACTOR)

    expect(db.client_id).toBe(5001)
    expect(db.contract_type).toBe('sale')
    expect(db.contract_status).toBe('draft')
    expect(db.source_proposal_id).toBe('PROP-TEXT-ID')
    expect(db.consultant_id).toBe('CONSULT-TEXT')
  })

  it('defaults contract_type to leasing when absent', () => {
    const db = toDb({ client_id: 1 }, ACTOR)
    expect(db.contract_type).toBe('leasing')
  })

  it('defaults contract_status to draft when absent', () => {
    const db = toDb({ client_id: 1 }, ACTOR)
    expect(db.contract_status).toBe('draft')
  })

  it('stamps _created_by_user_id on insert', () => {
    const db = toDb({ client_id: 1 }, ACTOR, 'insert')
    expect(db._created_by_user_id).toBe('user-contract-test')
  })

  it('does not stamp _created_by_user_id on update', () => {
    const db = toDb({ client_id: 1 }, ACTOR, 'update')
    expect(db._created_by_user_id).toBeUndefined()
  })

  it('always stamps _updated_by_user_id', () => {
    const db = toDb({ client_id: 1 }, ACTOR)
    expect(db._updated_by_user_id).toBe('user-contract-test')
  })

  it('throws on invalid contract_type', () => {
    expect(() => toDb({ contract_type: 'rental' }, ACTOR)).toThrow(TypeError)
    expect(() => toDb({ contract_type: 'rental' }, ACTOR)).toThrow(/contract_type/)
  })

  it('accepts all valid contract_type values', () => {
    expect(() => toDb({ contract_type: 'leasing' }, ACTOR)).not.toThrow()
    expect(() => toDb({ contract_type: 'sale' }, ACTOR)).not.toThrow()
    expect(() => toDb({ contract_type: 'buyout' }, ACTOR)).not.toThrow()
  })

  it('throws on invalid contract_status', () => {
    expect(() => toDb({ contract_status: 'expired' }, ACTOR)).toThrow(TypeError)
    expect(() => toDb({ contract_status: 'expired' }, ACTOR)).toThrow(/contract_status/)
  })

  it('accepts all valid contract_status values', () => {
    for (const status of ['draft', 'active', 'suspended', 'completed', 'cancelled']) {
      expect(() => toDb({ contract_status: status }, ACTOR)).not.toThrow()
    }
  })

  it('throws when actor is missing', () => {
    expect(() => toDb({ client_id: 1 }, null)).toThrow(TypeError)
  })

  it('throws when model is null', () => {
    expect(() => toDb(null, ACTOR)).toThrow(TypeError)
  })

  it('preserves legacy TEXT fields through without modification', () => {
    const model = {
      source_proposal_id: 'LEGACY-001',
      consultant_id:      'LEGACY-CONSULT',
    }
    const db = toDb(model, ACTOR)
    expect(db.source_proposal_id).toBe('LEGACY-001')
    expect(db.consultant_id).toBe('LEGACY-CONSULT')
  })
})

// ─── toCancel ─────────────────────────────────────────────────────────────────

describe('ContractAdapter.toCancel', () => {
  it('returns id, contract_status = cancelled, and actor metadata', () => {
    const result = toCancel(101, ACTOR)
    expect(result.id).toBe(101)
    expect(result.contract_status).toBe('cancelled')
    expect(result._updated_by_user_id).toBe('user-contract-test')
  })

  it('throws when id is missing', () => {
    expect(() => toCancel(null, ACTOR)).toThrow(TypeError)
  })

  it('throws when actor is missing', () => {
    expect(() => toCancel(101, null)).toThrow(TypeError)
  })

  it('does not set deleted_at (contracts use status, not soft-delete)', () => {
    const result = toCancel(101, ACTOR)
    expect(result.deleted_at).toBeUndefined()
  })
})

// ─── round-trip ───────────────────────────────────────────────────────────────

describe('ContractAdapter round-trip', () => {
  it('fromDb → toDb preserves key fields', () => {
    const model  = fromDb(DB_CONTRACT_ROW)
    const db     = toDb(model, ACTOR, 'update')

    expect(db.client_id).toBe(5001)
    expect(db.contract_type).toBe('leasing')
    expect(db.contract_status).toBe('active')
    expect(db.source_proposal_id).toBe('PROP-LEGACY-001')
    expect(db.consultant_id).toBe('CONSULT-XYZ')
  })
})
