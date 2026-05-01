// src/domain/analytics/__tests__/normalizers.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeClient, normalizeProposal, normalizePortfolio } from '../normalizers.js'

describe('normalizeClient', () => {
  it('maps a client row to AnalyticsRecord', () => {
    const row = {
      id: 'c1',
      created_at: '2025-06-01T00:00:00Z',
      city: 'São Paulo',
      state: 'SP',
      owner_display_name: 'João',
      consumption_kwh_month: 500,
      contract_value: 1200,
      in_portfolio: true,
      portfolio_exported_at: '2025-07-01T00:00:00Z',
    }
    const r = normalizeClient(row)
    expect(r.id).toBe('c1')
    expect(r.createdAt).toBe('2025-06-01T00:00:00Z')
    expect(r.closedAt).toBe('2025-07-01T00:00:00Z')
    expect(r.consultant).toBe('João')
    expect(r.city).toBe('São Paulo')
    expect(r.state).toBe('SP')
    expect(r.region).toBe('Sudeste')
    expect(r.contractValue).toBe(1200)
    expect(r.consumption).toBe(500)
    expect(r.isClosed).toBe(true)
  })

  it('extracts contract value from energy_profile', () => {
    const row = {
      id: 'c2',
      energy_profile: { mensalidade: 900 },
    }
    const r = normalizeClient(row)
    expect(r.contractValue).toBe(900)
  })

  it('accepts client_name as consultant fallback (join-based rows)', () => {
    const row = {
      id: 'c10',
      client_name: 'Empresa ABC',
    }
    const r = normalizeClient(row)
    expect(r.consultant).toBe('Empresa ABC')
  })

  it('prefers owner_display_name over client_name when both present', () => {
    const row = {
      id: 'c11',
      owner_display_name: 'Consultor X',
      client_name: 'Empresa ABC',
    }
    const r = normalizeClient(row)
    expect(r.consultant).toBe('Consultor X')
  })

  it('handles client_state as state fallback', () => {
    const row = {
      id: 'c12',
      client_state: 'MG',
    }
    const r = normalizeClient(row)
    expect(r.state).toBe('MG')
    expect(r.region).toBe('Sudeste')
  })

  it('handles null/missing fields gracefully', () => {
    const r = normalizeClient({ id: 'c3' })
    expect(r.id).toBe('c3')
    expect(r.createdAt).toBeNull()
    expect(r.closedAt).toBeNull()
    expect(r.consultant).toBeNull()
    expect(r.contractValue).toBeNull()
    expect(r.consumption).toBeNull()
    expect(r.isClosed).toBe(false)
    expect(r.isActive).toBe(false)
  })
})

describe('normalizeProposal', () => {
  it('maps an approved proposal to a closed AnalyticsRecord', () => {
    const row = {
      id: 'p1',
      created_at: '2025-05-01T00:00:00Z',
      updated_at: '2025-06-15T00:00:00Z',
      status: 'approved',
      client_city: 'Curitiba',
      client_state: 'PR',
      owner_display_name: 'Maria',
      contract_value: 5000,
      consumption_kwh_month: 800,
    }
    const r = normalizeProposal(row)
    expect(r.isClosed).toBe(true)
    expect(r.closedAt).toBe('2025-06-15T00:00:00Z')
    expect(r.region).toBe('Sul')
    expect(r.contractValue).toBe(5000)
  })

  it('maps a draft proposal as not closed', () => {
    const r = normalizeProposal({ id: 'p2', status: 'draft', created_at: '2025-01-01T00:00:00Z' })
    expect(r.isClosed).toBe(false)
    expect(r.closedAt).toBeNull()
  })
})

describe('normalizePortfolio', () => {
  it('maps a portfolio row to AnalyticsRecord', () => {
    const row = {
      id: 10,
      client_created_at: '2025-03-01T00:00:00Z',
      exported_to_portfolio_at: '2025-04-01T00:00:00Z',
      city: 'Recife',
      state: 'PE',
      is_converted_customer: true,
      is_active_portfolio_client: true,
      consumption_kwh_month: 600,
      mensalidade: 750,
    }
    const r = normalizePortfolio(row)
    expect(r.id).toBe('10')
    expect(r.closedAt).toBe('2025-04-01T00:00:00Z')
    expect(r.activatedAt).toBe('2025-04-01T00:00:00Z')
    expect(r.region).toBe('Nordeste')
    expect(r.isClosed).toBe(true)
    expect(r.isActive).toBe(true)
    expect(r.contractValue).toBe(750)
    expect(r.consumption).toBe(600)
  })
})
