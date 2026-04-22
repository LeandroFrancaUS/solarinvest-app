import { describe, expect, it, vi } from 'vitest'
import { filterSavedProposals } from '../proposalSearch'
import {
  createProposalOriginLink,
  resolveLegacyProposalOrigin,
  validateProposalOriginLink,
} from '../proposalOriginLink'

const records = [
  {
    id: 'p-1',
    code: 'SLRINVST-LSE-42906319',
    clientName: 'Karla de Lima Pinheiro',
    document: '723.162.921-00',
    phone: '(61) 98540-4209',
    createdAt: '2026-04-13T03:00:00.000Z',
    proposalType: 'leasing',
  },
  {
    id: 'p-2',
    code: 'SALE-2026-0001',
    clientName: 'Cliente Teste',
    document: '11.222.333/0001-44',
    phone: '(11) 3333-1111',
    createdAt: '2026-02-10T03:00:00.000Z',
    proposalType: 'venda',
  },
]

describe('proposal origin link', () => {
  it('busca proposta por código em registros salvos', () => {
    const result = filterSavedProposals(records, { code: '42906319' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p-1')
  })

  it('seleciona proposta e preenche proposalOriginRecordId e proposalOriginCode', () => {
    const link = createProposalOriginLink(records[0])
    expect(link.proposalOriginRecordId).toBe('p-1')
    expect(link.proposalOriginCode).toBe('SLRINVST-LSE-42906319')
  })

  it('resolve proposalOriginId legado para recordId quando encontra proposta salva', async () => {
    const findByCode = vi.fn(async () => records[0])
    const resolved = await resolveLegacyProposalOrigin({ source_proposal_id: 'SLRINVST-LSE-42906319' }, findByCode)

    expect(findByCode).toHaveBeenCalledWith('SLRINVST-LSE-42906319')
    expect(resolved.proposalOriginRecordId).toBe('p-1')
    expect(resolved.proposalOriginCode).toBe('SLRINVST-LSE-42906319')
  })

  it('invalida vínculo sem recordId ou sem code', () => {
    expect(validateProposalOriginLink({ proposalOriginRecordId: '', proposalOriginCode: 'X' })).toEqual({
      valid: false,
      reason: 'proposalOriginRecordId ausente',
    })
    expect(validateProposalOriginLink({ proposalOriginRecordId: 'id', proposalOriginCode: '' })).toEqual({
      valid: false,
      reason: 'proposalOriginCode ausente',
    })
  })
})
