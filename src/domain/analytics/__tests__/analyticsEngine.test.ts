// src/domain/analytics/__tests__/analyticsEngine.test.ts
import { describe, it, expect } from 'vitest'
import { computeDashboardSnapshot, invalidateSnapshotCache } from '../analyticsEngine.js'
import { defaultFilters } from '../filters.js'
import type { AnalyticsRecord } from '../types.js'

function rec(overrides: Partial<AnalyticsRecord> = {}): AnalyticsRecord {
  return {
    id: '1',
    createdAt: '2025-06-01T00:00:00Z',
    closedAt: null,
    activatedAt: null,
    consultant: null,
    city: null,
    state: null,
    region: null,
    contractValue: null,
    saleContractValue: null,
    leasingMonthlyValue: null,
    contractType: 'unknown',
    consumption: null,
    isClosed: false,
    isActive: false,
    ...overrides,
  }
}

describe('computeDashboardSnapshot', () => {
  it('returns a complete snapshot', () => {
    invalidateSnapshotCache()
    const records = [
      rec({ id: '1', isClosed: true, contractType: 'sale', contractValue: 1000, closedAt: '2025-06-01T00:00:00Z' }),
      rec({ id: '2', isClosed: true, contractType: 'sale', contractValue: 2000, closedAt: '2025-06-15T00:00:00Z' }),
      rec({ id: '3', isClosed: false }),
    ]
    const snap = computeDashboardSnapshot(records, defaultFilters())

    expect(snap.filtered).toHaveLength(3)
    expect(snap.kpis.closedContracts).toBe(2)
    expect(snap.kpis.totalContractValue).toBe(3000)
    expect(snap.kpis.conversionRate).toBeCloseTo(2 / 3)
    expect(snap.timeSeries.length).toBeGreaterThan(0)
    expect(snap.forecast.next30Days).toHaveLength(30)
  })

  it('returns memoised result for same inputs', () => {
    invalidateSnapshotCache()
    const records = [rec({ id: '1', closedAt: '2025-06-01T00:00:00Z' })]
    const filters = defaultFilters()
    const snap1 = computeDashboardSnapshot(records, filters)
    const snap2 = computeDashboardSnapshot(records, filters)
    expect(snap1).toBe(snap2) // same reference
  })

  it('recomputes when filters change', () => {
    invalidateSnapshotCache()
    const records = [
      rec({ id: '1', state: 'SP', closedAt: '2025-06-01T00:00:00Z' }),
      rec({ id: '2', state: 'RJ', closedAt: '2025-06-01T00:00:00Z' }),
    ]
    const snap1 = computeDashboardSnapshot(records, defaultFilters())
    const snap2 = computeDashboardSnapshot(records, { ...defaultFilters(), states: ['SP'] })
    expect(snap1).not.toBe(snap2)
    expect(snap2.filtered).toHaveLength(1)
  })
})
