// src/__tests__/critical/projects-domain.test.ts
// Pure-unit tests for src/domain/projects mirrors. These guarantee the TS
// domain stays in lock-step with the server planMapper.js.

import { describe, it, expect } from 'vitest'
import {
  mapContractTypeToProjectType,
  isProjectType,
  isProjectStatus,
  validatePlanSnapshot,
  buildNewProjectFields,
  buildPlanIdFromContract,
} from '../../domain/projects/mapPlanToProject'
import { PROJECT_STATUSES, PROJECT_TYPES } from '../../domain/projects/types'
import { applyComissaoAutomation } from '../../features/projectHub/ProjectHubPage'
import type { Projeto } from '../../features/projectHub/useProjectStore'

describe('src/domain/projects — ProjectType mapping', () => {
  it('maps contract_type to the canonical ProjectType', () => {
    expect(mapContractTypeToProjectType('leasing')).toBe('leasing')
    expect(mapContractTypeToProjectType('sale')).toBe('venda')
    expect(mapContractTypeToProjectType('venda')).toBe('venda')
    expect(mapContractTypeToProjectType('buyout')).toBe('venda')
    expect(mapContractTypeToProjectType('unknown')).toBe(null)
    expect(mapContractTypeToProjectType(null)).toBe(null)
  })

  it('exposes only the allowed enum values', () => {
    expect([...PROJECT_TYPES]).toEqual(['leasing', 'venda'])
    expect([...PROJECT_STATUSES]).toEqual(['Aguardando', 'Em andamento', 'Concluído'])
  })

  it('provides working type guards', () => {
    expect(isProjectType('leasing')).toBe(true)
    expect(isProjectType('sale')).toBe(false)
    expect(isProjectStatus('Concluído')).toBe(true)
    expect(isProjectStatus('concluído')).toBe(false)
  })
})

describe('src/domain/projects — validatePlanSnapshot', () => {
  it('accepts a valid leasing snapshot', () => {
    expect(
      validatePlanSnapshot({
        client_id: 1,
        plan_id: 'contract:1',
        contract_id: 1,
        proposal_id: null,
        contract_type: 'leasing',
        client_name: null,
        cpf_cnpj: null,
        city: null,
        state: null,
      }),
    ).toEqual([])
  })

  it('collects all errors for a fully-broken snapshot', () => {
    const errs = validatePlanSnapshot({} as Record<string, never>)
    expect(errs.map((e) => e.code).sort()).toEqual([
      'INVALID_CONTRACT_TYPE',
      'MISSING_CLIENT_ID',
      'MISSING_PLAN_ID',
    ])
  })
})

describe('src/domain/projects — buildNewProjectFields', () => {
  it('normalises snapshots & defaults status to Aguardando', () => {
    const fields = buildNewProjectFields({
      client_id: 1,
      plan_id: '  contract:1  ',
      contract_id: 1,
      proposal_id: null,
      contract_type: 'sale',
      client_name: '  ACME  ',
      cpf_cnpj: '123',
      city: '  São Paulo  ',
      state: 'SP',
    })
    expect(fields.project_type).toBe('venda')
    expect(fields.status).toBe('Aguardando')
    expect(fields.plan_id).toBe('contract:1')
    expect(fields.client_name_snapshot).toBe('ACME')
    expect(fields.city_snapshot).toBe('São Paulo')
  })
})

describe('src/domain/projects — buildPlanIdFromContract', () => {
  it('produces a stable plan_id', () => {
    expect(buildPlanIdFromContract(1)).toBe('contract:1')
    expect(buildPlanIdFromContract('99')).toBe('contract:99')
  })
})

// ---------------------------------------------------------------------------
// applyComissaoAutomation — nao_elegivel guard
// ---------------------------------------------------------------------------

function makeProjetoBase(overrides: Partial<Projeto> = {}): Projeto {
  return {
    id: 'proj-test',
    tipo: 'leasing',
    status: 'proposta_emitida',
    cliente: { nome: 'Test' },
    financeiro: { valorContrato: 0, custoTotal: 0, margem: 0 },
    createdAt: new Date().toISOString(),
    ...overrides,
  } as Projeto
}

describe('applyComissaoAutomation — nao_elegivel guard', () => {
  it('leasing with base 0 and status nao_elegivel stays nao_elegivel when advancing to ativo', () => {
    const projeto = makeProjetoBase({
      tipo: 'leasing',
      comissaoConsultor: {
        regra: 'leasing',
        valorTotalEstimado: 0,
        valorPago: 0,
        status: 'nao_elegivel',
        parcelas: [
          { descricao: 'Parcela 1', percentual: 40, valor: 0, gatilho: 'ativo', pago: false },
          { descricao: 'Parcela 2', percentual: 60, valor: 0, gatilho: 'mensalidade_paga', pago: false },
        ],
      },
    })

    const result = applyComissaoAutomation(projeto, 'ativo')
    expect(result).toBeNull()
  })

  it('venda with base 0 and status nao_elegivel stays nao_elegivel when advancing to concluido', () => {
    const projeto = makeProjetoBase({
      tipo: 'venda',
      comissaoConsultor: {
        regra: 'venda',
        valorTotalEstimado: 0,
        valorPago: 0,
        status: 'nao_elegivel',
        parcelas: [
          { descricao: 'Parcela única', percentual: 100, valor: 0, gatilho: 'concluido', pago: false },
        ],
      },
    })

    const result = applyComissaoAutomation(projeto, 'concluido')
    expect(result).toBeNull()
  })

  it('leasing with eligible commission still triggers automation on ativo', () => {
    const projeto = makeProjetoBase({
      tipo: 'leasing',
      comissaoConsultor: {
        regra: 'leasing',
        valorTotalEstimado: 1000,
        valorPago: 0,
        status: 'adiantamento_disponivel',
        parcelas: [
          { descricao: 'Parcela 1', percentual: 40, valor: 400, gatilho: 'ativo', pago: false },
          { descricao: 'Parcela 2', percentual: 60, valor: 600, gatilho: 'mensalidade_paga', pago: false },
        ],
      },
    })

    const result = applyComissaoAutomation(projeto, 'ativo')
    expect(result).not.toBeNull()
    expect(result?.comissaoConsultor?.status).toBe('parcial_pago')
    expect(result?.comissaoConsultor?.valorPago).toBe(400)
  })
})
