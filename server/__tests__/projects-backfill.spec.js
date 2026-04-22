// server/__tests__/projects-backfill.spec.js
// Unit tests for the backfill helper logic. The heavy work is in
// listEffectivatedContractsWithoutProject (exercised via mocked sql) plus
// the idempotent service that the backfill script calls.

import { describe, it, expect, vi } from 'vitest'
import { listEffectivatedContractsWithoutProject } from '../projects/repository.js'

describe('listEffectivatedContractsWithoutProject', () => {
  it('delegates to sql with a joined query and returns rows as-is', async () => {
    const rows = [
      {
        contract_id: 1,
        contract_type: 'leasing',
        source_proposal_id: null,
        contract_status: 'active',
        client_id: 10,
        client_name: 'ACME',
        cpf_cnpj: '123',
        city: 'São Paulo',
        state: 'SP',
      },
    ]
    const sql = vi.fn(async () => rows)
    const result = await listEffectivatedContractsWithoutProject(sql)
    expect(result).toEqual(rows)
    expect(sql).toHaveBeenCalledOnce()
  })

  it('returns an empty array when nothing is pending', async () => {
    const sql = vi.fn(async () => [])
    const result = await listEffectivatedContractsWithoutProject(sql)
    expect(result).toEqual([])
  })
})
