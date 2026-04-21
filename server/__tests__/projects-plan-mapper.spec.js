// server/__tests__/projects-plan-mapper.spec.js
// Pure-unit tests for the plan→project mapper. No DB.

import { describe, it, expect } from 'vitest'
import {
  mapContractTypeToProjectType,
  isProjectType,
  isProjectStatus,
  validatePlanSnapshot,
  buildNewProjectFields,
  buildPlanIdFromContract,
  PROJECT_TYPES,
  PROJECT_STATUSES,
} from '../projects/planMapper.js'

describe('mapContractTypeToProjectType', () => {
  it('maps "leasing" → "leasing"', () => {
    expect(mapContractTypeToProjectType('leasing')).toBe('leasing')
    expect(mapContractTypeToProjectType(' LEASING ')).toBe('leasing')
  })

  it('maps "sale"/"venda"/"buyout" → "venda"', () => {
    expect(mapContractTypeToProjectType('sale')).toBe('venda')
    expect(mapContractTypeToProjectType('venda')).toBe('venda')
    expect(mapContractTypeToProjectType('buyout')).toBe('venda')
  })

  it('returns null for null/empty/unknown types', () => {
    expect(mapContractTypeToProjectType(null)).toBe(null)
    expect(mapContractTypeToProjectType(undefined)).toBe(null)
    expect(mapContractTypeToProjectType('')).toBe(null)
    expect(mapContractTypeToProjectType('anything_else')).toBe(null)
  })
})

describe('type/status guards', () => {
  it('enumerates only the allowed values', () => {
    expect([...PROJECT_TYPES]).toEqual(['leasing', 'venda'])
    expect([...PROJECT_STATUSES]).toEqual(['Aguardando', 'Em andamento', 'Concluído'])
  })

  it('isProjectType', () => {
    expect(isProjectType('leasing')).toBe(true)
    expect(isProjectType('venda')).toBe(true)
    expect(isProjectType('sale')).toBe(false)
    expect(isProjectType(null)).toBe(false)
  })

  it('isProjectStatus', () => {
    expect(isProjectStatus('Aguardando')).toBe(true)
    expect(isProjectStatus('Em andamento')).toBe(true)
    expect(isProjectStatus('Concluído')).toBe(true)
    expect(isProjectStatus('Pending')).toBe(false)
    expect(isProjectStatus('aguardando')).toBe(false) // case-sensitive
  })
})

describe('validatePlanSnapshot', () => {
  const base = {
    client_id: 1,
    plan_id: 'contract:42',
    contract_type: 'leasing',
    contract_id: 42,
    proposal_id: null,
    client_name: 'ACME',
  }

  it('accepts a valid snapshot', () => {
    expect(validatePlanSnapshot(base)).toEqual([])
  })

  it('flags missing client_id', () => {
    const errs = validatePlanSnapshot({ ...base, client_id: null })
    expect(errs.map((e) => e.code)).toContain('MISSING_CLIENT_ID')
  })

  it('flags missing plan_id', () => {
    const errs = validatePlanSnapshot({ ...base, plan_id: '  ' })
    expect(errs.map((e) => e.code)).toContain('MISSING_PLAN_ID')
  })

  it('flags invalid contract_type', () => {
    const errs = validatePlanSnapshot({ ...base, contract_type: 'xyz' })
    expect(errs.map((e) => e.code)).toContain('INVALID_CONTRACT_TYPE')
  })
})

describe('buildNewProjectFields', () => {
  const snap = {
    client_id: 1,
    plan_id: 'contract:42',
    contract_id: 42,
    proposal_id: null,
    contract_type: 'leasing',
    client_name: '  ACME  ',
    cpf_cnpj: '123',
    city: 'São Paulo',
    state: 'SP',
  }

  it('returns canonical fields and defaults status to "Aguardando"', () => {
    const fields = buildNewProjectFields(snap)
    expect(fields).toEqual({
      client_id: 1,
      plan_id: 'contract:42',
      contract_id: 42,
      proposal_id: null,
      project_type: 'leasing',
      status: 'Aguardando',
      client_name_snapshot: 'ACME',
      cpf_cnpj_snapshot: '123',
      city_snapshot: 'São Paulo',
      state_snapshot: 'SP',
    })
  })

  it('maps contract_type "sale" → project_type "venda" (and fr legacy "venda")', () => {
    expect(buildNewProjectFields({ ...snap, contract_type: 'sale' }).project_type).toBe('venda')
    expect(buildNewProjectFields({ ...snap, contract_type: 'venda' }).project_type).toBe('venda')
  })

  it('maps contract_type "leasing" → project_type "leasing"', () => {
    expect(buildNewProjectFields({ ...snap, contract_type: 'leasing' }).project_type).toBe('leasing')
  })

  it('throws with structured validation errors for invalid input', () => {
    let caught
    try {
      buildNewProjectFields({ client_id: null, plan_id: '', contract_type: 'nope' })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeDefined()
    expect(caught.code).toBe('INVALID_PLAN')
    expect(caught.validationErrors.map((e) => e.code).sort()).toEqual([
      'INVALID_CONTRACT_TYPE',
      'MISSING_CLIENT_ID',
      'MISSING_PLAN_ID',
    ])
  })

  it('rejects invalid initialStatus', () => {
    expect(() => buildNewProjectFields(snap, 'Pending')).toThrow(/Status inicial inválido/)
  })
})

describe('buildPlanIdFromContract', () => {
  it('formats a stable plan_id', () => {
    expect(buildPlanIdFromContract(42)).toBe('contract:42')
    expect(buildPlanIdFromContract('42')).toBe('contract:42')
  })
})
