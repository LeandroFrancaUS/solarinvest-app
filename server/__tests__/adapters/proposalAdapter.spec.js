// server/__tests__/adapters/proposalAdapter.spec.js
// Unit tests for the pure proposal field mapping adapter.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect } from 'vitest'
import {
  toCanonicalProposal,
  toProposalWritePayload,
  extractClientContext,
} from '../../adapters/proposalAdapter.js'

// ─── toCanonicalProposal ─────────────────────────────────────────────────────

describe('toCanonicalProposal', () => {
  it('returns canonical fields when already canonical', () => {
    const row = {
      id: 'uuid-1',
      proposal_type: 'leasing',
      client_name: 'Ana Souza',
      client_document: '12345678901',
      client_email: 'ana@test.com',
      client_phone: '11999999999',
      client_city: 'São Paulo',
      client_state: 'SP',
      payload_json: { kWp: 10 },
    }
    const result = toCanonicalProposal(row)
    expect(result.client_name).toBe('Ana Souza')
    expect(result.client_document).toBe('12345678901')
    expect(result.client_email).toBe('ana@test.com')
    expect(result.client_phone).toBe('11999999999')
    expect(result.client_city).toBe('São Paulo')
    expect(result.client_state).toBe('SP')
    expect(result.payload_json).toEqual({ kWp: 10 })
  })

  it('falls back to legacy fields when canonical are absent', () => {
    const row = {
      id: 'uuid-2',
      name: 'Bruno Lima',
      document: '98765432100',
      email: 'bruno@test.com',
      phone: '21988888888',
      city: 'Rio de Janeiro',
      state: 'RJ',
      payload_json: { kWp: 5 },
    }
    const result = toCanonicalProposal(row)
    expect(result.client_name).toBe('Bruno Lima')
    expect(result.client_document).toBe('98765432100')
    expect(result.client_email).toBe('bruno@test.com')
    expect(result.client_phone).toBe('21988888888')
    expect(result.client_city).toBe('Rio de Janeiro')
    expect(result.client_state).toBe('RJ')
  })

  it('prefers canonical over legacy when both are present', () => {
    const row = {
      client_name: 'Canonical Name',
      name: 'Legacy Name',
      payload_json: { a: 1 },
    }
    const result = toCanonicalProposal(row)
    expect(result.client_name).toBe('Canonical Name')
  })

  it('preserves payload_json as-is without any modification', () => {
    const payload = { nested: { value: 42 }, array: [1, 2, 3] }
    const row = { client_name: 'X', payload_json: payload }
    const result = toCanonicalProposal(row)
    expect(result.payload_json).toBe(payload) // same reference
  })

  it('sets payload_json to null when absent', () => {
    const result = toCanonicalProposal({ client_name: 'Y' })
    expect(result.payload_json).toBeNull()
  })

  it('returns nulls for absent client context fields', () => {
    const result = toCanonicalProposal({ id: 'uuid-3', payload_json: { a: 1 } })
    expect(result.client_name).toBeNull()
    expect(result.client_document).toBeNull()
    expect(result.client_email).toBeNull()
    expect(result.client_phone).toBeNull()
    expect(result.client_city).toBeNull()
    expect(result.client_state).toBeNull()
  })

  it('preserves all other fields from the original row', () => {
    const row = {
      id: 'uuid-4',
      proposal_code: 'SLRV-001',
      status: 'approved',
      client_name: 'C',
      payload_json: { x: 1 },
    }
    const result = toCanonicalProposal(row)
    expect(result.id).toBe('uuid-4')
    expect(result.proposal_code).toBe('SLRV-001')
    expect(result.status).toBe('approved')
  })

  it('preserves proposal_type leasing', () => {
    const row = { proposal_type: 'leasing', client_name: 'D', payload_json: { kWp: 8 } }
    expect(toCanonicalProposal(row).proposal_type).toBe('leasing')
  })

  it('preserves proposal_type venda', () => {
    const row = { proposal_type: 'venda', client_name: 'E', payload_json: { kWp: 12 } }
    expect(toCanonicalProposal(row).proposal_type).toBe('venda')
  })

  it('preserves client_id as a BIGINT (numeric value)', () => {
    const row = { id: 'uuid-5', client_name: 'F', client_id: 42, payload_json: { kWp: 5 } }
    expect(toCanonicalProposal(row).client_id).toBe(42)
  })

  it('preserves client_id as null for proposals without a linked client', () => {
    const row = { id: 'uuid-6', client_name: 'G', client_id: null, payload_json: { kWp: 3 } }
    expect(toCanonicalProposal(row).client_id).toBeNull()
  })

  it('returns empty object for null or non-object input', () => {
    expect(toCanonicalProposal(null)).toEqual({})
    expect(toCanonicalProposal(undefined)).toEqual({})
    expect(toCanonicalProposal('string')).toEqual({})
  })
})

// ─── toProposalWritePayload ──────────────────────────────────────────────────

describe('toProposalWritePayload', () => {
  it('builds a valid write payload from canonical-named input', () => {
    const input = {
      proposal_type: 'venda',
      proposal_code: 'SLRV-002',
      client_name: 'Carla',
      client_document: '11122233344',
      client_email: 'carla@test.com',
      client_phone: '31977777777',
      client_city: 'BH',
      client_state: 'MG',
      payload_json: { kWp: 8, total: 50000 },
    }
    const result = toProposalWritePayload(input)
    expect(result.proposal_type).toBe('venda')
    expect(result.proposal_code).toBe('SLRV-002')
    expect(result.client_name).toBe('Carla')
    expect(result.client_document).toBe('11122233344')
    expect(result.payload_json).toEqual({ kWp: 8, total: 50000 })
  })

  it('falls back to legacy field names for client context', () => {
    const input = {
      proposal_type: 'leasing',
      name: 'Daniel',
      document: '55566677788',
      email: 'd@test.com',
      phone: '41966666666',
      city: 'Curitiba',
      state: 'PR',
      payload_json: { kWp: 12 },
    }
    const result = toProposalWritePayload(input)
    expect(result.client_name).toBe('Daniel')
    expect(result.client_document).toBe('55566677788')
    expect(result.client_email).toBe('d@test.com')
    expect(result.client_phone).toBe('41966666666')
    expect(result.client_city).toBe('Curitiba')
    expect(result.client_state).toBe('PR')
  })

  it('preserves payload_json reference untouched', () => {
    const payload = { sensitive: true, calc: { irr: 0.12 } }
    const input = { client_name: 'E', payload_json: payload }
    const result = toProposalWritePayload(input)
    expect(result.payload_json).toBe(payload)
  })

  it('throws INVALID_PAYLOAD when payload_json is missing', () => {
    expect(() => toProposalWritePayload({ client_name: 'F' })).toThrow('payload_json must be a non-empty object')
  })

  it('throws INVALID_PAYLOAD when payload_json is null', () => {
    expect(() => toProposalWritePayload({ client_name: 'G', payload_json: null })).toThrow('payload_json must be a non-empty object')
  })

  it('throws INVALID_PAYLOAD when payload_json is an empty object', () => {
    expect(() => toProposalWritePayload({ client_name: 'H', payload_json: {} })).toThrow('payload_json must be a non-empty object')
  })

  it('throws INVALID_PAYLOAD when payload_json is an array', () => {
    expect(() => toProposalWritePayload({ client_name: 'I', payload_json: [] })).toThrow('payload_json must be a non-empty object')
  })

  it('attaches INVALID_PAYLOAD error code', () => {
    let caught = null
    try {
      toProposalWritePayload({ client_name: 'J', payload_json: null })
    } catch (err) {
      caught = err
    }
    expect(caught).not.toBeNull()
    expect(caught.code).toBe('INVALID_PAYLOAD')
  })

  it('throws for null input', () => {
    expect(() => toProposalWritePayload(null)).toThrow('proposal input must be a non-null object')
  })

  it('includes proposal_type leasing in write payload', () => {
    const result = toProposalWritePayload({ proposal_type: 'leasing', payload_json: { kWp: 10 } })
    expect(result.proposal_type).toBe('leasing')
  })

  it('includes proposal_type venda in write payload', () => {
    const result = toProposalWritePayload({ proposal_type: 'venda', payload_json: { kWp: 8 } })
    expect(result.proposal_type).toBe('venda')
  })

  it('maps mixed legacy and canonical client context fields, canonical wins', () => {
    const input = {
      proposal_type: 'leasing',
      client_name: 'Canonical Name',
      name: 'Legacy Name',
      document: '55566677788',
      payload_json: { kWp: 9 },
    }
    const result = toProposalWritePayload(input)
    expect(result.client_name).toBe('Canonical Name')
    expect(result.client_document).toBe('55566677788')
  })
})

// ─── extractClientContext ────────────────────────────────────────────────────

describe('extractClientContext', () => {
  it('extracts canonical client context fields from a proposal row', () => {
    const proposal = {
      id: 'uuid-5',
      status: 'draft',
      client_name: 'Eduarda',
      client_document: '99988877766',
      client_email: 'edu@test.com',
      client_phone: '48955555555',
      client_city: 'Florianópolis',
      client_state: 'SC',
      payload_json: { x: 1 },
    }
    const ctx = extractClientContext(proposal)
    expect(ctx.client_name).toBe('Eduarda')
    expect(ctx.client_document).toBe('99988877766')
    expect(ctx.client_email).toBe('edu@test.com')
    expect(ctx.client_phone).toBe('48955555555')
    expect(ctx.client_city).toBe('Florianópolis')
    expect(ctx.client_state).toBe('SC')
  })

  it('falls back to legacy field names', () => {
    const proposal = {
      name: 'Fábio',
      document: '33322211100',
      email: 'f@test.com',
      phone: '61944444444',
      city: 'Brasília',
      state: 'DF',
    }
    const ctx = extractClientContext(proposal)
    expect(ctx.client_name).toBe('Fábio')
    expect(ctx.client_document).toBe('33322211100')
    expect(ctx.client_city).toBe('Brasília')
    expect(ctx.client_state).toBe('DF')
  })

  it('does not include payload_json or other proposal metadata', () => {
    const proposal = {
      id: 'uuid-6',
      payload_json: { k: 1 },
      client_name: 'G',
      proposal_code: 'SLRV-003',
    }
    const ctx = extractClientContext(proposal)
    expect('id' in ctx).toBe(false)
    expect('payload_json' in ctx).toBe(false)
    expect('proposal_code' in ctx).toBe(false)
  })

  it('returns nulls for missing client fields', () => {
    const ctx = extractClientContext({ id: 'uuid-7' })
    expect(ctx.client_name).toBeNull()
    expect(ctx.client_document).toBeNull()
    expect(ctx.client_email).toBeNull()
    expect(ctx.client_phone).toBeNull()
    expect(ctx.client_city).toBeNull()
    expect(ctx.client_state).toBeNull()
  })

  it('returns empty object for null or non-object input', () => {
    expect(extractClientContext(null)).toEqual({})
    expect(extractClientContext(undefined)).toEqual({})
  })
})
