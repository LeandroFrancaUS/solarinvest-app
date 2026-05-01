// server/adapters/__tests__/projectAdapter.spec.js
// Unit tests for server/adapters/projectAdapter.js
// Run with: vitest run --config vitest.server.config.ts

import { describe, it, expect } from 'vitest'
import {
  fromDb,
  toDb,
  toSoftDelete,
  fromPvDataDb,
  toPvDataDb,
} from '../projectAdapter.js'

const ACTOR = { authProviderUserId: 'user-project-test' }

const DB_PROJECT_ROW = {
  id:                   'proj-uuid-1',
  client_id:            5001,
  plan_id:              '5001',
  contract_id:          10,
  proposal_id:          'prop-uuid-1',
  project_type:         'leasing',
  status:               'Em andamento',
  client_name_snapshot: 'Ana Costa',
  cpf_cnpj_snapshot:    '111.222.333-44',
  city_snapshot:        'Goiânia',
  state_snapshot:       'GO',
  created_by_user_id:   'creator',
  updated_by_user_id:   'updater',
  created_at:           '2024-01-01T00:00:00Z',
  updated_at:           '2024-06-01T00:00:00Z',
  deleted_at:           null,
}

const DB_PV_ROW = {
  id:                        'pv-uuid-1',
  project_id:                'proj-uuid-1',
  consumo_kwh_mes:           450,
  potencia_modulo_wp:        400,
  numero_modulos:            25,
  tipo_rede:                 'trifasico',
  potencia_sistema_kwp:      10.0,
  geracao_estimada_kwh_mes:  1200,
  area_utilizada_m2:         50,
  modelo_modulo:             'Jinko 400W',
  modelo_inversor:           'Growatt 10kW',
  created_at:                '2024-01-01T00:00:00Z',
  updated_at:                '2024-06-01T00:00:00Z',
}

// ─── fromDb ───────────────────────────────────────────────────────────────────

describe('ProjectAdapter.fromDb', () => {
  it('maps all columns correctly', () => {
    const model = fromDb(DB_PROJECT_ROW)

    expect(model.id).toBe('proj-uuid-1')
    expect(model.client_id).toBe(5001)
    expect(model.plan_id).toBe('5001')
    expect(model.contract_id).toBe(10)
    expect(model.proposal_id).toBe('prop-uuid-1')
    expect(model.project_type).toBe('leasing')
    expect(model.status).toBe('Em andamento')
    expect(model.client_name_snapshot).toBe('Ana Costa')
    expect(model.deleted_at).toBeNull()
  })

  it('includes pv_data as undefined when not in row', () => {
    const model = fromDb(DB_PROJECT_ROW)
    expect(model.pv_data).toBeUndefined()
  })

  it('maps nested pv_data when row includes it', () => {
    const rowWithPv = { ...DB_PROJECT_ROW, pv_data: DB_PV_ROW }
    const model = fromDb(rowWithPv)
    expect(model.pv_data).toBeDefined()
    expect(model.pv_data.project_id).toBe('proj-uuid-1')
    expect(model.pv_data.potencia_sistema_kwp).toBe(10.0)
  })

  it('defaults status to Aguardando when absent', () => {
    const model = fromDb({ id: 'x', client_id: 1 })
    expect(model.status).toBe('Aguardando')
  })

  it('returns null for null input', () => {
    expect(fromDb(null)).toBeNull()
  })
})

// ─── toDb ─────────────────────────────────────────────────────────────────────

describe('ProjectAdapter.toDb', () => {
  it('maps model fields to DB shape', () => {
    const model = {
      client_id:    5001,
      plan_id:      '5001',
      project_type: 'venda',
      status:       'Aguardando',
    }

    const db = toDb(model, ACTOR)

    expect(db.client_id).toBe(5001)
    expect(db.plan_id).toBe('5001')
    expect(db.project_type).toBe('venda')
    expect(db.status).toBe('Aguardando')
    expect(db.updated_by_user_id).toBe('user-project-test')
  })

  it('stamps created_by_user_id on insert', () => {
    const db = toDb({ project_type: 'leasing', status: 'Aguardando' }, ACTOR, 'insert')
    expect(db.created_by_user_id).toBe('user-project-test')
  })

  it('does not stamp created_by_user_id on update', () => {
    const db = toDb({ project_type: 'leasing', status: 'Aguardando' }, ACTOR, 'update')
    expect(db.created_by_user_id).toBeUndefined()
  })

  it('throws on invalid project_type', () => {
    expect(() => toDb({ project_type: 'other' }, ACTOR)).toThrow(TypeError)
    expect(() => toDb({ project_type: 'other' }, ACTOR)).toThrow(/project_type/)
  })

  it('accepts all valid project_type values', () => {
    expect(() => toDb({ project_type: 'leasing' }, ACTOR)).not.toThrow()
    expect(() => toDb({ project_type: 'venda' }, ACTOR)).not.toThrow()
  })

  it('throws on invalid status', () => {
    expect(() => toDb({ status: 'invalid' }, ACTOR)).toThrow(TypeError)
    expect(() => toDb({ status: 'invalid' }, ACTOR)).toThrow(/status/)
  })

  it('accepts all valid status values', () => {
    expect(() => toDb({ status: 'Aguardando' }, ACTOR)).not.toThrow()
    expect(() => toDb({ status: 'Em andamento' }, ACTOR)).not.toThrow()
    expect(() => toDb({ status: 'Concluído' }, ACTOR)).not.toThrow()
  })

  it('throws when actor is missing', () => {
    expect(() => toDb({ project_type: 'leasing' }, null)).toThrow(TypeError)
  })

  it('throws when model is null', () => {
    expect(() => toDb(null, ACTOR)).toThrow(TypeError)
  })
})

// ─── toSoftDelete ─────────────────────────────────────────────────────────────

describe('ProjectAdapter.toSoftDelete', () => {
  it('returns id, deleted_at, updated_by_user_id', () => {
    const before = new Date()
    const result = toSoftDelete('proj-uuid-1', ACTOR)
    const after  = new Date()

    expect(result.id).toBe('proj-uuid-1')
    expect(result.deleted_at).toBeInstanceOf(Date)
    expect(result.deleted_at.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(result.deleted_at.getTime()).toBeLessThanOrEqual(after.getTime())
    expect(result.updated_by_user_id).toBe('user-project-test')
  })

  it('throws when id is missing', () => {
    expect(() => toSoftDelete(null, ACTOR)).toThrow(TypeError)
  })
})

// ─── fromPvDataDb / toPvDataDb ────────────────────────────────────────────────

describe('ProjectAdapter.fromPvDataDb', () => {
  it('maps all pv_data columns', () => {
    const model = fromPvDataDb(DB_PV_ROW)

    expect(model.id).toBe('pv-uuid-1')
    expect(model.project_id).toBe('proj-uuid-1')
    expect(model.consumo_kwh_mes).toBe(450)
    expect(model.potencia_modulo_wp).toBe(400)
    expect(model.numero_modulos).toBe(25)
    expect(model.potencia_sistema_kwp).toBe(10.0)
    expect(model.modelo_modulo).toBe('Jinko 400W')
    expect(model.modelo_inversor).toBe('Growatt 10kW')
  })

  it('returns null for null input', () => {
    expect(fromPvDataDb(null)).toBeNull()
  })
})

describe('ProjectAdapter.toPvDataDb', () => {
  it('maps pv model to DB shape', () => {
    const pv = {
      project_id:              'proj-uuid-1',
      consumo_kwh_mes:         500,
      potencia_sistema_kwp:    12.5,
      modelo_modulo:           'BYD 450W',
    }

    const db = toPvDataDb(pv)

    expect(db.project_id).toBe('proj-uuid-1')
    expect(db.consumo_kwh_mes).toBe(500)
    expect(db.potencia_sistema_kwp).toBe(12.5)
    expect(db.modelo_modulo).toBe('BYD 450W')
    // Fields not in model default to null
    expect(db.numero_modulos).toBeNull()
  })

  it('throws on null input', () => {
    expect(() => toPvDataDb(null)).toThrow(TypeError)
  })
})

// ─── round-trip ───────────────────────────────────────────────────────────────

describe('ProjectAdapter round-trip', () => {
  it('fromDb → toDb preserves key fields', () => {
    const model = fromDb(DB_PROJECT_ROW)
    const db = toDb(model, ACTOR, 'update')
    expect(db.client_id).toBe(5001)
    expect(db.project_type).toBe('leasing')
    expect(db.status).toBe('Em andamento')
  })

  it('fromPvDataDb → toPvDataDb preserves key fields', () => {
    const pv = fromPvDataDb(DB_PV_ROW)
    const db = toPvDataDb(pv)
    expect(db.consumo_kwh_mes).toBe(450)
    expect(db.potencia_sistema_kwp).toBe(10.0)
    expect(db.modelo_modulo).toBe('Jinko 400W')
  })
})
