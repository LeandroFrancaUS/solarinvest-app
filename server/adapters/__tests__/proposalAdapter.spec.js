// server/adapters/__tests__/proposalAdapter.spec.js
// Unit tests for server/adapters/proposalAdapter.js
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect } from 'vitest'
import { fromDb, toDb, toSoftDelete } from '../proposalAdapter.js'

const ACTOR = { authProviderUserId: 'user-proposal-test' }

const DB_ROW = {
  id:                    'uuid-proposal-1',
  proposal_type:         'leasing',
  proposal_code:         'PROP-001',
  version:               2,
  status:                'sent',
  client_id:             5001,
  client_name:           'Carlos Oliveira',
  client_document:       '987.654.321-00',
  client_city:           'Goiânia',
  client_state:          'GO',
  client_phone:          '62988888888',
  client_email:          'carlos@example.com',
  consumption_kwh_month: 450,
  system_kwp:            8.0,
  capex_total:           30000,
  contract_value:        500,
  term_months:           120,
  payload_json:          { tarifa: 0.88, desconto: 0.2 },
  owner_user_id:         'owner-uuid-x',
  owner_email:           'owner@solarinvest.app',
  owner_display_name:    'Owner Name',
  created_by_user_id:    'creator',
  updated_by_user_id:    'updater',
  created_at:            '2024-01-01T00:00:00Z',
  updated_at:            '2024-06-01T00:00:00Z',
  deleted_at:            null,
}

// ─── fromDb ───────────────────────────────────────────────────────────────────

describe('ProposalAdapter.fromDb', () => {
  it('maps all columns correctly', () => {
    const model = fromDb(DB_ROW)

    expect(model.id).toBe('uuid-proposal-1')
    expect(model.proposal_type).toBe('leasing')
    expect(model.proposal_code).toBe('PROP-001')
    expect(model.version).toBe(2)
    expect(model.status).toBe('sent')
    expect(model.client_id).toBe(5001)
    expect(model.client_name).toBe('Carlos Oliveira')
    expect(model.payload_json).toEqual({ tarifa: 0.88, desconto: 0.2 })
    expect(model.owner_user_id).toBe('owner-uuid-x')
    expect(model.deleted_at).toBeNull()
  })

  it('handles legacy row with null client_id', () => {
    const legacyRow = { ...DB_ROW, client_id: null }
    const model = fromDb(legacyRow)
    expect(model.client_id).toBeNull()
  })

  it('defaults payload_json to empty object when absent', () => {
    const row = { id: 'x', proposal_type: 'venda' }
    const model = fromDb(row)
    expect(model.payload_json).toEqual({})
  })

  it('defaults version to 1 when absent', () => {
    const model = fromDb({ id: 'x' })
    expect(model.version).toBe(1)
  })

  it('defaults status to draft when absent', () => {
    const model = fromDb({ id: 'x' })
    expect(model.status).toBe('draft')
  })

  it('returns null for null input', () => {
    expect(fromDb(null)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(fromDb(42)).toBeNull()
  })
})

// ─── toDb ─────────────────────────────────────────────────────────────────────

describe('ProposalAdapter.toDb', () => {
  it('maps model fields to DB shape', () => {
    const model = {
      proposal_type:  'venda',
      proposal_code:  'VEND-001',
      status:         'draft',
      client_id:      9999,
      payload_json:   { price: 50000 },
      owner_user_id:  'owner-abc',
    }

    const db = toDb(model, ACTOR)

    expect(db.proposal_type).toBe('venda')
    expect(db.proposal_code).toBe('VEND-001')
    expect(db.client_id).toBe(9999)
    expect(db.payload_json).toEqual({ price: 50000 })
    expect(db.owner_user_id).toBe('owner-abc')
    expect(db.updated_by_user_id).toBe('user-proposal-test')
  })

  it('stamps created_by_user_id on insert mode', () => {
    const db = toDb({ proposal_type: 'leasing', payload_json: {} }, ACTOR, 'insert')
    expect(db.created_by_user_id).toBe('user-proposal-test')
  })

  it('does not stamp created_by_user_id on update mode', () => {
    const db = toDb({ proposal_type: 'leasing', payload_json: {} }, ACTOR, 'update')
    expect(db.created_by_user_id).toBeUndefined()
  })

  it('preserves payload_json — never turns it null', () => {
    const db = toDb({ proposal_type: 'leasing' }, ACTOR)
    expect(db.payload_json).toEqual({})
  })

  it('preserves payload_json when provided', () => {
    const payload = { tarifa: 0.9, desconto: 0.15 }
    const db = toDb({ proposal_type: 'leasing', payload_json: payload }, ACTOR)
    expect(db.payload_json).toEqual(payload)
  })

  it('throws on invalid proposal_type', () => {
    expect(() =>
      toDb({ proposal_type: 'invalid_type', payload_json: {} }, ACTOR),
    ).toThrow(TypeError)
    expect(() =>
      toDb({ proposal_type: 'invalid_type', payload_json: {} }, ACTOR),
    ).toThrow(/proposal_type/)
  })

  it('accepts both valid proposal_type values without throwing', () => {
    expect(() => toDb({ proposal_type: 'leasing', payload_json: {} }, ACTOR)).not.toThrow()
    expect(() => toDb({ proposal_type: 'venda',   payload_json: {} }, ACTOR)).not.toThrow()
  })

  it('throws when actor is missing', () => {
    expect(() => toDb({ proposal_type: 'leasing' }, null)).toThrow(TypeError)
  })

  it('throws when model is null', () => {
    expect(() => toDb(null, ACTOR)).toThrow(TypeError)
  })

  it('passes client_id as null for legacy proposals', () => {
    const db = toDb({ proposal_type: 'leasing', payload_json: {} }, ACTOR)
    expect(db.client_id).toBeNull()
  })
})

// ─── toSoftDelete ─────────────────────────────────────────────────────────────

describe('ProposalAdapter.toSoftDelete', () => {
  it('returns id, deleted_at, updated_by_user_id', () => {
    const before = new Date()
    const result = toSoftDelete('uuid-x', ACTOR)
    const after  = new Date()

    expect(result.id).toBe('uuid-x')
    expect(result.deleted_at).toBeInstanceOf(Date)
    expect(result.deleted_at.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(result.deleted_at.getTime()).toBeLessThanOrEqual(after.getTime())
    expect(result.updated_by_user_id).toBe('user-proposal-test')
  })

  it('throws when id is missing', () => {
    expect(() => toSoftDelete(null, ACTOR)).toThrow(TypeError)
  })
})

// ─── round-trip ───────────────────────────────────────────────────────────────

describe('ProposalAdapter round-trip', () => {
  it('fromDb(toDb result) preserves key fields', () => {
    const model = {
      proposal_type: 'leasing',
      proposal_code: 'RT-001',
      version:       1,
      status:        'draft',
      client_id:     42,
      payload_json:  { x: 1 },
      owner_user_id: 'owner-rt',
    }

    const dbShape  = toDb(model, ACTOR)
    const restored = fromDb({ ...dbShape, id: 'rt-uuid' })

    expect(restored.proposal_type).toBe(model.proposal_type)
    expect(restored.proposal_code).toBe(model.proposal_code)
    expect(restored.client_id).toBe(model.client_id)
    expect(restored.payload_json).toEqual(model.payload_json)
    expect(restored.owner_user_id).toBe(model.owner_user_id)
  })
})
