// server/__tests__/adapters/clientAdapter.spec.js
// Unit tests for the pure client field mapping adapter.
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect } from 'vitest'
import {
  toCanonicalClient,
  toLegacyClient,
  toClientWritePayload,
} from '../../adapters/clientAdapter.js'

// ─── toCanonicalClient ───────────────────────────────────────────────────────

describe('toCanonicalClient', () => {
  it('returns canonical fields when already canonical', () => {
    const row = {
      id: 1,
      client_name: 'Ana Silva',
      client_document: '12345678901',
      client_email: 'ana@example.com',
      client_phone: '11999999999',
      client_city: 'São Paulo',
      client_state: 'SP',
      client_address: 'Rua A, 1',
      uc_geradora: 'UC-001',
    }
    const result = toCanonicalClient(row)
    expect(result.client_name).toBe('Ana Silva')
    expect(result.client_document).toBe('12345678901')
    expect(result.client_email).toBe('ana@example.com')
    expect(result.client_phone).toBe('11999999999')
    expect(result.client_city).toBe('São Paulo')
    expect(result.client_state).toBe('SP')
    expect(result.client_address).toBe('Rua A, 1')
    expect(result.uc_geradora).toBe('UC-001')
  })

  it('falls back to legacy fields when canonical are absent', () => {
    const row = {
      id: 2,
      name: 'Bruno Costa',
      document: '98765432100',
      email: 'bruno@example.com',
      phone: '21988888888',
      city: 'Rio de Janeiro',
      state: 'RJ',
      address: 'Av B, 2',
      uc: 'UC-002',
    }
    const result = toCanonicalClient(row)
    expect(result.client_name).toBe('Bruno Costa')
    expect(result.client_document).toBe('98765432100')
    expect(result.client_email).toBe('bruno@example.com')
    expect(result.client_phone).toBe('21988888888')
    expect(result.client_city).toBe('Rio de Janeiro')
    expect(result.client_state).toBe('RJ')
    expect(result.client_address).toBe('Av B, 2')
    expect(result.uc_geradora).toBe('UC-002')
  })

  it('prefers canonical over legacy when both are present', () => {
    const row = {
      client_name: 'Canonical Name',
      name: 'Legacy Name',
      client_document: '00000000000',
      document: '11111111111',
    }
    const result = toCanonicalClient(row)
    expect(result.client_name).toBe('Canonical Name')
    expect(result.client_document).toBe('00000000000')
  })

  it('returns nulls when neither canonical nor legacy fields are present', () => {
    const result = toCanonicalClient({ id: 3 })
    expect(result.client_name).toBeNull()
    expect(result.client_document).toBeNull()
    expect(result.client_email).toBeNull()
    expect(result.client_phone).toBeNull()
    expect(result.client_city).toBeNull()
    expect(result.client_state).toBeNull()
    expect(result.client_address).toBeNull()
    expect(result.uc_geradora).toBeNull()
  })

  it('preserves other fields from the original object', () => {
    const row = { id: 99, created_at: '2024-01-01', client_name: 'X' }
    const result = toCanonicalClient(row)
    expect(result.id).toBe(99)
    expect(result.created_at).toBe('2024-01-01')
  })

  it('returns empty object for null or non-object input', () => {
    expect(toCanonicalClient(null)).toEqual({})
    expect(toCanonicalClient(undefined)).toEqual({})
    expect(toCanonicalClient('string')).toEqual({})
  })
})

// ─── toLegacyClient ──────────────────────────────────────────────────────────

describe('toLegacyClient', () => {
  it('maps canonical fields to legacy names', () => {
    const row = {
      id: 4,
      client_name: 'Carla Dias',
      client_document: '55555555555',
      client_email: 'carla@example.com',
      client_phone: '31977777777',
      client_city: 'Belo Horizonte',
      client_state: 'MG',
      client_address: 'Rua C, 3',
      uc_geradora: 'UC-003',
    }
    const result = toLegacyClient(row)
    expect(result.name).toBe('Carla Dias')
    expect(result.document).toBe('55555555555')
    expect(result.email).toBe('carla@example.com')
    expect(result.phone).toBe('31977777777')
    expect(result.city).toBe('Belo Horizonte')
    expect(result.state).toBe('MG')
    expect(result.address).toBe('Rua C, 3')
    expect(result.uc).toBe('UC-003')
  })

  it('falls back to already-legacy fields when canonical are absent', () => {
    const row = { name: 'Daniel', document: '44444444444' }
    const result = toLegacyClient(row)
    expect(result.name).toBe('Daniel')
    expect(result.document).toBe('44444444444')
  })

  it('prefers canonical when both are present', () => {
    const row = {
      client_name: 'Canonical',
      name: 'Legacy',
    }
    const result = toLegacyClient(row)
    expect(result.name).toBe('Canonical')
  })

  it('preserves extra fields untouched', () => {
    const row = { id: 5, owner_user_id: 'usr-abc', client_name: 'E' }
    const result = toLegacyClient(row)
    expect(result.id).toBe(5)
    expect(result.owner_user_id).toBe('usr-abc')
  })

  it('returns empty object for null or non-object input', () => {
    expect(toLegacyClient(null)).toEqual({})
    expect(toLegacyClient(undefined)).toEqual({})
  })
})

// ─── toClientWritePayload ────────────────────────────────────────────────────

describe('toClientWritePayload', () => {
  it('maps canonical field names directly', () => {
    const input = {
      client_name: 'Eduardo Fonseca',
      client_document: '66666666666',
      client_email: 'edu@example.com',
      client_phone: '11966666666',
      client_city: 'Curitiba',
      client_state: 'PR',
      client_address: 'Rua D, 4',
      uc_geradora: 'UC-004',
    }
    const result = toClientWritePayload(input)
    expect(result.client_name).toBe('Eduardo Fonseca')
    expect(result.client_document).toBe('66666666666')
    expect(result.client_email).toBe('edu@example.com')
    expect(result.client_phone).toBe('11966666666')
    expect(result.client_city).toBe('Curitiba')
    expect(result.client_state).toBe('PR')
    expect(result.client_address).toBe('Rua D, 4')
    expect(result.uc_geradora).toBe('UC-004')
  })

  it('falls back to legacy field names when canonical are absent', () => {
    const input = {
      name: 'Fernanda Gomes',
      document: '77777777777',
      email: 'fer@example.com',
      phone: '48955555555',
      city: 'Florianópolis',
      state: 'SC',
      address: 'Rua E, 5',
      uc: 'UC-005',
    }
    const result = toClientWritePayload(input)
    expect(result.client_name).toBe('Fernanda Gomes')
    expect(result.client_document).toBe('77777777777')
    expect(result.client_email).toBe('fer@example.com')
    expect(result.client_phone).toBe('48955555555')
    expect(result.client_city).toBe('Florianópolis')
    expect(result.client_state).toBe('SC')
    expect(result.client_address).toBe('Rua E, 5')
    expect(result.uc_geradora).toBe('UC-005')
  })

  it('omits fields that are not present in input (returns undefined)', () => {
    const result = toClientWritePayload({ client_name: 'Only Name' })
    expect(result.client_name).toBe('Only Name')
    expect(result.client_document).toBeUndefined()
    expect(result.client_email).toBeUndefined()
  })

  it('does not include non-client-context keys in output', () => {
    const result = toClientWritePayload({ client_name: 'G', id: 7, owner_user_id: 'usr' })
    expect('id' in result).toBe(false)
    expect('owner_user_id' in result).toBe(false)
  })

  it('returns empty object for null or non-object input', () => {
    expect(toClientWritePayload(null)).toEqual({})
    expect(toClientWritePayload(undefined)).toEqual({})
  })
})
