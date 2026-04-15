// src/domain/analytics/__tests__/kpis.test.ts
import { describe, it, expect } from 'vitest'
import { computeKPIs } from '../kpis.js'
import type { AnalyticsRecord } from '../types.js'

function rec(overrides: Partial<AnalyticsRecord> = {}): AnalyticsRecord {
  return {
    id: '1',
    createdAt: '2025-01-01T00:00:00Z',
    closedAt: null,
    activatedAt: null,
    consultant: null,
    city: null,
    state: null,
    region: null,
    contractValue: null,
    consumption: null,
    isClosed: false,
    isActive: false,
    ...overrides,
  }
}

describe('computeKPIs', () => {
  it('returns zeroes for empty input', () => {
    const kpis = computeKPIs([])
    expect(kpis.closedContracts).toBe(0)
    expect(kpis.activeClients).toBe(0)
    expect(kpis.totalContractValue).toBe(0)
    expect(kpis.averageTicket).toBe(0)
    expect(kpis.totalConsumption).toBe(0)
    expect(kpis.averageConsumption).toBe(0)
    expect(kpis.conversionRate).toBe(0)
  })

  it('counts closed contracts and computes value KPIs', () => {
    const records = [
      rec({ id: '1', isClosed: true, contractValue: 1000 }),
      rec({ id: '2', isClosed: true, contractValue: 2000 }),
      rec({ id: '3', isClosed: false }),
    ]
    const kpis = computeKPIs(records)
    expect(kpis.closedContracts).toBe(2)
    expect(kpis.totalContractValue).toBe(3000)
    expect(kpis.averageTicket).toBe(1500)
    expect(kpis.conversionRate).toBeCloseTo(2 / 3)
  })

  it('counts active clients', () => {
    const records = [
      rec({ id: '1', isActive: true }),
      rec({ id: '2', isActive: true }),
      rec({ id: '3', isActive: false }),
    ]
    expect(computeKPIs(records).activeClients).toBe(2)
  })

  it('computes consumption metrics', () => {
    const records = [
      rec({ id: '1', consumption: 300 }),
      rec({ id: '2', consumption: 700 }),
      rec({ id: '3', consumption: null }),
    ]
    const kpis = computeKPIs(records)
    expect(kpis.totalConsumption).toBe(1000)
    expect(kpis.averageConsumption).toBe(500)
  })
})
