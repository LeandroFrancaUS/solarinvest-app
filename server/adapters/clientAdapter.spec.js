// server/adapters/clientAdapter.spec.js
// Tests for the pure client field-mapping adapter.
//
// Coverage goals (per PR 10 requirements):
//  - legacy fields only
//  - canonical fields only
//  - mixed fields (canonical preferred over legacy)
//  - missing optional fields (undefined/null behaviour)
//  - CPF/CNPJ document preservation

import { describe, it, expect } from 'vitest'
import { toCanonicalClient, toLegacyClient, toClientWritePayload } from './clientAdapter.js'

// ─────────────────────────────────────────────────────────────────────────────
// toCanonicalClient
// ─────────────────────────────────────────────────────────────────────────────
describe('toCanonicalClient', () => {
  it('returns empty object for null input', () => {
    expect(toCanonicalClient(null)).toEqual({})
  })

  it('returns empty object for undefined input', () => {
    expect(toCanonicalClient(undefined)).toEqual({})
  })

  it('returns empty object for non-object input', () => {
    expect(toCanonicalClient('string')).toEqual({})
    expect(toCanonicalClient(42)).toEqual({})
  })

  it('maps legacy name to client_name', () => {
    const result = toCanonicalClient({ name: 'Alice' })
    expect(result.client_name).toBe('Alice')
  })

  it('maps legacy document to client_document', () => {
    const result = toCanonicalClient({ document: '12345678901' })
    expect(result.client_document).toBe('12345678901')
  })

  it('maps legacy email to client_email', () => {
    const result = toCanonicalClient({ email: 'alice@example.com' })
    expect(result.client_email).toBe('alice@example.com')
  })

  it('maps legacy phone to client_phone', () => {
    const result = toCanonicalClient({ phone: '11999990000' })
    expect(result.client_phone).toBe('11999990000')
  })

  it('maps legacy city to client_city', () => {
    const result = toCanonicalClient({ city: 'Goiânia' })
    expect(result.client_city).toBe('Goiânia')
  })

  it('maps legacy state to client_state', () => {
    const result = toCanonicalClient({ state: 'GO' })
    expect(result.client_state).toBe('GO')
  })

  it('maps legacy address to client_address', () => {
    const result = toCanonicalClient({ address: 'Rua A, 1' })
    expect(result.client_address).toBe('Rua A, 1')
  })

  it('maps legacy uc to uc_geradora', () => {
    const result = toCanonicalClient({ uc: 'UC001' })
    expect(result.uc_geradora).toBe('UC001')
  })

  it('preserves canonical fields as-is', () => {
    const input = {
      client_name: 'Bob',
      client_document: '12345678901234',
      client_email: 'bob@example.com',
      client_phone: '11988880000',
      client_city: 'Brasília',
      client_state: 'DF',
      client_address: 'Quadra 1',
      uc_geradora: 'UC999',
    }
    const result = toCanonicalClient(input)
    expect(result.client_name).toBe('Bob')
    expect(result.client_document).toBe('12345678901234')
    expect(result.client_email).toBe('bob@example.com')
    expect(result.client_phone).toBe('11988880000')
    expect(result.client_city).toBe('Brasília')
    expect(result.client_state).toBe('DF')
    expect(result.client_address).toBe('Quadra 1')
    expect(result.uc_geradora).toBe('UC999')
  })

  it('prefers canonical field over legacy field', () => {
    const result = toCanonicalClient({ client_name: 'Canonical', name: 'Legacy' })
    expect(result.client_name).toBe('Canonical')
  })

  it('prefers canonical document over legacy document', () => {
    const result = toCanonicalClient({ client_document: '11111111111', document: '99999999999' })
    expect(result.client_document).toBe('11111111111')
  })

  it('handles missing optional fields with null', () => {
    const result = toCanonicalClient({ client_name: 'Alice' })
    expect(result.client_document).toBeNull()
    expect(result.client_email).toBeNull()
    expect(result.client_phone).toBeNull()
    expect(result.client_city).toBeNull()
    expect(result.client_state).toBeNull()
    expect(result.client_address).toBeNull()
    expect(result.uc_geradora).toBeNull()
  })

  it('preserves extra fields not in the mapping', () => {
    const result = toCanonicalClient({ id: 42, created_at: '2024-01-01', cpf_normalized: '12345678901' })
    expect(result.id).toBe(42)
    expect(result.created_at).toBe('2024-01-01')
    expect(result.cpf_normalized).toBe('12345678901')
  })

  it('preserves CPF document from legacy document field', () => {
    const cpf = '12345678901'
    const result = toCanonicalClient({ document: cpf })
    expect(result.client_document).toBe(cpf)
  })

  it('preserves CNPJ document from legacy document field', () => {
    const cnpj = '12345678000195'
    const result = toCanonicalClient({ document: cnpj })
    expect(result.client_document).toBe(cnpj)
  })

  it('preserves CPF document from canonical client_document field', () => {
    const cpf = '98765432100'
    const result = toCanonicalClient({ client_document: cpf })
    expect(result.client_document).toBe(cpf)
  })

  it('preserves CNPJ document from canonical client_document field', () => {
    const cnpj = '98765432000100'
    const result = toCanonicalClient({ client_document: cnpj })
    expect(result.client_document).toBe(cnpj)
  })

  it('handles mixed canonical and legacy fields, using full row', () => {
    const row = {
      id: 1,
      client_name: 'Alice',
      email: 'alice@example.com',  // legacy, no canonical counterpart present
      city: 'Goiânia',              // legacy
    }
    const result = toCanonicalClient(row)
    expect(result.client_name).toBe('Alice')
    expect(result.client_email).toBe('alice@example.com')
    expect(result.client_city).toBe('Goiânia')
    expect(result.id).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// toLegacyClient
// ─────────────────────────────────────────────────────────────────────────────
describe('toLegacyClient', () => {
  it('returns empty object for null input', () => {
    expect(toLegacyClient(null)).toEqual({})
  })

  it('returns empty object for undefined input', () => {
    expect(toLegacyClient(undefined)).toEqual({})
  })

  it('maps canonical client_name to legacy name', () => {
    const result = toLegacyClient({ client_name: 'Bob' })
    expect(result.name).toBe('Bob')
  })

  it('maps canonical client_document to legacy document', () => {
    const result = toLegacyClient({ client_document: '12345678901' })
    expect(result.document).toBe('12345678901')
  })

  it('maps canonical client_email to legacy email', () => {
    const result = toLegacyClient({ client_email: 'bob@example.com' })
    expect(result.email).toBe('bob@example.com')
  })

  it('maps canonical client_phone to legacy phone', () => {
    const result = toLegacyClient({ client_phone: '11988880000' })
    expect(result.phone).toBe('11988880000')
  })

  it('maps canonical client_city to legacy city', () => {
    const result = toLegacyClient({ client_city: 'Brasília' })
    expect(result.city).toBe('Brasília')
  })

  it('maps canonical client_state to legacy state', () => {
    const result = toLegacyClient({ client_state: 'DF' })
    expect(result.state).toBe('DF')
  })

  it('maps canonical client_address to legacy address', () => {
    const result = toLegacyClient({ client_address: 'Quadra 1' })
    expect(result.address).toBe('Quadra 1')
  })

  it('maps canonical uc_geradora to legacy uc', () => {
    const result = toLegacyClient({ uc_geradora: 'UC999' })
    expect(result.uc).toBe('UC999')
  })

  it('prefers canonical client_name over legacy name', () => {
    const result = toLegacyClient({ client_name: 'Canonical', name: 'Legacy' })
    expect(result.name).toBe('Canonical')
  })

  it('preserves canonical fields alongside legacy aliases', () => {
    const result = toLegacyClient({ client_name: 'Alice', client_email: 'alice@example.com' })
    expect(result.client_name).toBe('Alice')
    expect(result.name).toBe('Alice')
    expect(result.client_email).toBe('alice@example.com')
    expect(result.email).toBe('alice@example.com')
  })

  it('handles missing optional fields with null', () => {
    const result = toLegacyClient({ client_name: 'Alice' })
    expect(result.document).toBeNull()
    expect(result.email).toBeNull()
    expect(result.phone).toBeNull()
    expect(result.city).toBeNull()
    expect(result.state).toBeNull()
    expect(result.address).toBeNull()
    expect(result.uc).toBeNull()
  })

  it('preserves extra fields not in the mapping', () => {
    const result = toLegacyClient({ id: 42, cpf_normalized: '12345678901' })
    expect(result.id).toBe(42)
    expect(result.cpf_normalized).toBe('12345678901')
  })

  it('preserves CPF document through canonical-to-legacy path', () => {
    const cpf = '12345678901'
    const result = toLegacyClient({ client_document: cpf })
    expect(result.document).toBe(cpf)
    expect(result.client_document).toBe(cpf)
  })

  it('preserves CNPJ document through canonical-to-legacy path', () => {
    const cnpj = '12345678000195'
    const result = toLegacyClient({ client_document: cnpj })
    expect(result.document).toBe(cnpj)
    expect(result.client_document).toBe(cnpj)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// toClientWritePayload
// ─────────────────────────────────────────────────────────────────────────────
describe('toClientWritePayload', () => {
  it('returns empty object for null input', () => {
    expect(toClientWritePayload(null)).toEqual({})
  })

  it('returns empty object for undefined input', () => {
    expect(toClientWritePayload(undefined)).toEqual({})
  })

  it('handles legacy fields only', () => {
    const result = toClientWritePayload({
      name: 'Alice',
      document: '12345678901',
      email: 'alice@example.com',
      phone: '11999990000',
      city: 'Goiânia',
      state: 'GO',
      address: 'Rua A, 1',
      uc: 'UC001',
    })
    expect(result.client_name).toBe('Alice')
    expect(result.client_document).toBe('12345678901')
    expect(result.client_email).toBe('alice@example.com')
    expect(result.client_phone).toBe('11999990000')
    expect(result.client_city).toBe('Goiânia')
    expect(result.client_state).toBe('GO')
    expect(result.client_address).toBe('Rua A, 1')
    expect(result.uc_geradora).toBe('UC001')
  })

  it('handles canonical fields only', () => {
    const result = toClientWritePayload({
      client_name: 'Bob',
      client_document: '12345678000195',
      client_email: 'bob@example.com',
      client_phone: '11988880000',
      client_city: 'Brasília',
      client_state: 'DF',
      client_address: 'Quadra 1',
      uc_geradora: 'UC999',
    })
    expect(result.client_name).toBe('Bob')
    expect(result.client_document).toBe('12345678000195')
    expect(result.client_email).toBe('bob@example.com')
    expect(result.client_phone).toBe('11988880000')
    expect(result.client_city).toBe('Brasília')
    expect(result.client_state).toBe('DF')
    expect(result.client_address).toBe('Quadra 1')
    expect(result.uc_geradora).toBe('UC999')
  })

  it('prefers canonical fields over legacy fields', () => {
    const result = toClientWritePayload({
      client_name: 'Canonical',
      name: 'Legacy',
      client_document: '11111111111',
      document: '99999999999',
      client_email: 'canonical@example.com',
      email: 'legacy@example.com',
    })
    expect(result.client_name).toBe('Canonical')
    expect(result.client_document).toBe('11111111111')
    expect(result.client_email).toBe('canonical@example.com')
  })

  it('returns undefined (omits) missing optional fields', () => {
    const result = toClientWritePayload({ client_name: 'Alice' })
    expect(result.client_document).toBeUndefined()
    expect(result.client_email).toBeUndefined()
    expect(result.client_phone).toBeUndefined()
    expect(result.client_city).toBeUndefined()
    expect(result.client_state).toBeUndefined()
    expect(result.client_address).toBeUndefined()
    expect(result.uc_geradora).toBeUndefined()
  })

  it('preserves CPF document from legacy field', () => {
    const cpf = '12345678901'
    const result = toClientWritePayload({ name: 'Alice', document: cpf })
    expect(result.client_document).toBe(cpf)
  })

  it('preserves CNPJ document from legacy field', () => {
    const cnpj = '12345678000195'
    const result = toClientWritePayload({ name: 'Empresa', document: cnpj })
    expect(result.client_document).toBe(cnpj)
  })

  it('preserves CPF document from canonical field', () => {
    const cpf = '98765432100'
    const result = toClientWritePayload({ client_name: 'Alice', client_document: cpf })
    expect(result.client_document).toBe(cpf)
  })

  it('preserves CNPJ document from canonical field', () => {
    const cnpj = '98765432000100'
    const result = toClientWritePayload({ client_name: 'Empresa', client_document: cnpj })
    expect(result.client_document).toBe(cnpj)
  })

  it('handles mixed legacy and canonical fields', () => {
    const result = toClientWritePayload({
      client_name: 'Alice',        // canonical
      email: 'alice@example.com',  // legacy
      city: 'Goiânia',             // legacy
    })
    expect(result.client_name).toBe('Alice')
    expect(result.client_email).toBe('alice@example.com')
    expect(result.client_city).toBe('Goiânia')
  })

  it('does not include non-client-identity fields in output', () => {
    const result = toClientWritePayload({
      client_name: 'Alice',
      consultant_id: 5,
      system_kwp: 10,
      metadata: { foo: 'bar' },
    })
    // The adapter returns only the 8 core identity fields; extra fields are not forwarded
    expect(result).not.toHaveProperty('consultant_id')
    expect(result).not.toHaveProperty('system_kwp')
    expect(result).not.toHaveProperty('metadata')
    expect(result.client_name).toBe('Alice')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Round-trip: toCanonicalClient → toLegacyClient
// ─────────────────────────────────────────────────────────────────────────────
describe('round-trip: toCanonicalClient → toLegacyClient', () => {
  it('produces both canonical and legacy names for a legacy-field row', () => {
    const row = {
      id: 1,
      name: 'Alice',
      document: '12345678901',
      email: 'alice@example.com',
      phone: '11999990000',
      city: 'Goiânia',
      state: 'GO',
      address: 'Rua A, 1',
      uc: 'UC001',
    }
    const result = toLegacyClient(toCanonicalClient(row))

    // canonical
    expect(result.client_name).toBe('Alice')
    expect(result.client_document).toBe('12345678901')
    expect(result.client_email).toBe('alice@example.com')
    expect(result.client_phone).toBe('11999990000')
    expect(result.client_city).toBe('Goiânia')
    expect(result.client_state).toBe('GO')
    expect(result.client_address).toBe('Rua A, 1')
    expect(result.uc_geradora).toBe('UC001')

    // legacy
    expect(result.name).toBe('Alice')
    expect(result.document).toBe('12345678901')
    expect(result.email).toBe('alice@example.com')
    expect(result.phone).toBe('11999990000')
    expect(result.city).toBe('Goiânia')
    expect(result.state).toBe('GO')
    expect(result.address).toBe('Rua A, 1')
    expect(result.uc).toBe('UC001')
  })

  it('produces both canonical and legacy names for a canonical-field row', () => {
    const row = {
      id: 2,
      client_name: 'Bob',
      client_document: '12345678000195',
      client_email: 'bob@example.com',
      client_phone: '11988880000',
      client_city: 'Brasília',
      client_state: 'DF',
      client_address: 'Quadra 1',
      uc_geradora: 'UC999',
    }
    const result = toLegacyClient(toCanonicalClient(row))

    expect(result.client_name).toBe('Bob')
    expect(result.name).toBe('Bob')
    expect(result.client_document).toBe('12345678000195')
    expect(result.document).toBe('12345678000195')
    expect(result.client_email).toBe('bob@example.com')
    expect(result.email).toBe('bob@example.com')
  })

  it('CPF preserved through canonical→legacy round-trip', () => {
    const cpf = '12345678901'
    const result = toLegacyClient(toCanonicalClient({ client_document: cpf }))
    expect(result.client_document).toBe(cpf)
    expect(result.document).toBe(cpf)
  })

  it('CNPJ preserved through canonical→legacy round-trip', () => {
    const cnpj = '12345678000195'
    const result = toLegacyClient(toCanonicalClient({ document: cnpj }))
    expect(result.client_document).toBe(cnpj)
    expect(result.document).toBe(cnpj)
  })
})
