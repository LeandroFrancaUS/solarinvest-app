// server/adapters/__tests__/clientAdapter.spec.js
// Unit tests for server/adapters/clientAdapter.js
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect, vi } from 'vitest'

// ── Mock normalizeDocumentServer so tests don't need a real repository ────────
vi.mock('../../clients/repository.js', () => ({
  normalizeDocumentServer: (raw) => {
    if (!raw) return { type: 'unknown', normalized: null }
    const digits = raw.replace(/\D/g, '')
    if (digits.length === 11) return { type: 'cpf', normalized: digits }
    if (digits.length === 14) return { type: 'cnpj', normalized: digits }
    return { type: 'unknown', normalized: null }
  },
  normalizeCpfServer:  (raw) => {
    if (!raw) return null
    const d = raw.replace(/\D/g, '')
    return d.length === 11 ? d : null
  },
  normalizeCnpjServer: (raw) => {
    if (!raw) return null
    const d = raw.replace(/\D/g, '')
    return d.length === 14 ? d : null
  },
}))

import { fromDb, toDb, toSoftDelete } from '../clientAdapter.js'

const ACTOR = { authProviderUserId: 'user-test-123' }

// ─── fromDb ───────────────────────────────────────────────────────────────────

describe('ClientAdapter.fromDb', () => {
  it('maps all production column names to app model fields', () => {
    const row = {
      id: 42,
      client_name:     'Maria Silva',
      client_document: '123.456.789-00',
      client_email:    'maria@example.com',
      client_phone:    '62999999999',
      client_city:     'Goiânia',
      client_state:    'GO',
      client_address:  'Rua das Flores, 10',
      client_cep:      '74000-000',
      owner_user_id:   'owner-uuid',
      cpf_normalized:  '12345678900',
      cnpj_normalized: null,
      document_type:   'cpf',
      uc_geradora:     'UC123',
      uc_beneficiaria: 'UC456',
      system_kwp:      10.5,
      term_months:     60,
      consumption_kwh_month: 500,
      distribuidora:   'ENEL',
      status_comercial: 'LEAD',
      status_cliente:  'NAO_CLIENTE',
      in_portfolio:    false,
      created_by_user_id: 'creator',
      updated_by_user_id: 'updater',
      created_at:      '2024-01-01T00:00:00Z',
      updated_at:      '2024-06-01T00:00:00Z',
      deleted_at:      null,
      consultant_id:   5,
      metadata:        { foo: 'bar' },
      identity_status: 'cpf_verified',
      origin:          'online',
      offline_origin_id: null,
    }

    const model = fromDb(row)

    expect(model.id).toBe(42)
    expect(model.name).toBe('Maria Silva')
    expect(model.document).toBe('123.456.789-00')
    expect(model.email).toBe('maria@example.com')
    expect(model.phone).toBe('62999999999')
    expect(model.city).toBe('Goiânia')
    expect(model.state).toBe('GO')
    expect(model.address).toBe('Rua das Flores, 10')
    expect(model.cep).toBe('74000-000')
    expect(model.owner).toBe('owner-uuid')
    expect(model.cpf_normalized).toBe('12345678900')
    expect(model.cnpj_normalized).toBeNull()
    expect(model.document_type).toBe('cpf')
    expect(model.uc).toBe('UC123')
    expect(model.uc_beneficiaria).toBe('UC456')
    expect(model.system_kwp).toBe(10.5)
    expect(model.term_months).toBe(60)
    expect(model.consumption_kwh_month).toBe(500)
    expect(model.distribuidora).toBe('ENEL')
    expect(model.status_comercial).toBe('LEAD')
    expect(model.status_cliente).toBe('NAO_CLIENTE')
    expect(model.in_portfolio).toBe(false)
    expect(model.consultant_id).toBe(5)
  })

  it('returns null for null input', () => {
    expect(fromDb(null)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(fromDb('string')).toBeNull()
  })

  it('handles missing optional fields gracefully (all null)', () => {
    const minimal = { id: 1, client_name: 'Minimal' }
    const model = fromDb(minimal)
    expect(model.name).toBe('Minimal')
    expect(model.email).toBeNull()
    expect(model.document).toBeNull()
    expect(model.cpf_normalized).toBeNull()
    expect(model.cnpj_normalized).toBeNull()
    expect(model.deleted_at).toBeNull()
  })
})

// ─── toDb ─────────────────────────────────────────────────────────────────────

describe('ClientAdapter.toDb', () => {
  it('maps app model fields to production column names', () => {
    const model = {
      name:     'João Silva',
      document: '123.456.789-09',
      email:    'joao@example.com',
      phone:    '11999999999',
      city:     'São Paulo',
      state:    'SP',
      address:  'Av. Paulista, 1000',
      cep:      '01310-100',
      owner:    'owner-uuid-abc',
    }

    const db = toDb(model, ACTOR)

    expect(db.client_name).toBe('João Silva')
    expect(db.client_document).toBe('123.456.789-09')
    expect(db.client_email).toBe('joao@example.com')
    expect(db.client_phone).toBe('11999999999')
    expect(db.client_city).toBe('São Paulo')
    expect(db.client_state).toBe('SP')
    expect(db.client_address).toBe('Av. Paulista, 1000')
    expect(db.client_cep).toBe('01310-100')
    expect(db.owner_user_id).toBe('owner-uuid-abc')
  })

  it('stamps created_by_user_id and updated_by_user_id on insert', () => {
    const db = toDb({ name: 'Test' }, ACTOR, 'insert')
    expect(db.created_by_user_id).toBe('user-test-123')
    expect(db.updated_by_user_id).toBe('user-test-123')
  })

  it('only stamps updated_by_user_id on update', () => {
    const db = toDb({ name: 'Test' }, ACTOR, 'update')
    expect(db.updated_by_user_id).toBe('user-test-123')
    expect(db.created_by_user_id).toBeUndefined()
  })

  it('normalizes a CPF document string', () => {
    const db = toDb({ name: 'CPF', document: '529.982.247-25' }, ACTOR)
    expect(db.cpf_normalized).toBe('52998224725')
    expect(db.cnpj_normalized).toBeNull()
    expect(db.document_type).toBe('cpf')
  })

  it('normalizes a CNPJ document string', () => {
    const db = toDb({ name: 'CNPJ', document: '11.222.333/0001-81' }, ACTOR)
    expect(db.cnpj_normalized).toBe('11222333000181')
    expect(db.cpf_normalized).toBeNull()
    expect(db.document_type).toBe('cnpj')
  })

  it('handles null document without throwing', () => {
    const db = toDb({ name: 'No Document' }, ACTOR)
    expect(db.client_document).toBeNull()
    expect(db.cpf_normalized).toBeNull()
    expect(db.cnpj_normalized).toBeNull()
    expect(db.document_type).toBeNull()
  })

  it('uses actor userId as owner when model.owner is absent', () => {
    const db = toDb({ name: 'Test' }, ACTOR)
    expect(db.owner_user_id).toBe('user-test-123')
  })

  it('throws TypeError when model is null', () => {
    expect(() => toDb(null, ACTOR)).toThrow(TypeError)
  })

  it('throws TypeError when actor.authProviderUserId is missing', () => {
    expect(() => toDb({ name: 'Test' }, {})).toThrow(TypeError)
  })
})

// ─── toSoftDelete ─────────────────────────────────────────────────────────────

describe('ClientAdapter.toSoftDelete', () => {
  it('returns id, deleted_at, and updated_by_user_id', () => {
    const before = new Date()
    const result = toSoftDelete(99, ACTOR)
    const after  = new Date()

    expect(result.id).toBe(99)
    expect(result.deleted_at).toBeInstanceOf(Date)
    expect(result.deleted_at.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(result.deleted_at.getTime()).toBeLessThanOrEqual(after.getTime())
    expect(result.updated_by_user_id).toBe('user-test-123')
  })

  it('throws when id is missing', () => {
    expect(() => toSoftDelete(null, ACTOR)).toThrow(TypeError)
  })

  it('throws when actor is missing', () => {
    expect(() => toSoftDelete(1, null)).toThrow(TypeError)
  })
})

// ─── round-trip ───────────────────────────────────────────────────────────────

describe('ClientAdapter round-trip', () => {
  it('toDb → fromDb preserves core fields', () => {
    const model = {
      name:    'Round Trip',
      email:   'rt@example.com',
      phone:   '11999999998',
      city:    'Brasília',
      state:   'DF',
      address: 'SQN 100',
      owner:   'owner-rt',
    }

    const dbShape = toDb(model, ACTOR)

    // Simulate what the DB would return
    const dbRow = {
      ...dbShape,
      id: 100,
      client_name:    dbShape.client_name,
      client_email:   dbShape.client_email,
      client_phone:   dbShape.client_phone,
      client_city:    dbShape.client_city,
      client_state:   dbShape.client_state,
      client_address: dbShape.client_address,
    }

    const restored = fromDb(dbRow)

    expect(restored.name).toBe(model.name)
    expect(restored.email).toBe(model.email)
    expect(restored.phone).toBe(model.phone)
    expect(restored.city).toBe(model.city)
    expect(restored.state).toBe(model.state)
    expect(restored.address).toBe(model.address)
  })
})
