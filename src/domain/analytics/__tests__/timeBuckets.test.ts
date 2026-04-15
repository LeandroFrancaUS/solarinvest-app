// src/domain/analytics/__tests__/timeBuckets.test.ts
import { describe, it, expect } from 'vitest'
import { groupIntoBuckets, bucketsToTimeSeries, autoGranularity } from '../timeBuckets.js'
import type { AnalyticsRecord } from '../types.js'

function rec(overrides: Partial<AnalyticsRecord> = {}): AnalyticsRecord {
  return {
    id: '1',
    createdAt: null,
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

describe('groupIntoBuckets', () => {
  it('returns empty array for no records', () => {
    expect(groupIntoBuckets([], 'month')).toEqual([])
  })

  it('groups records by month', () => {
    const records = [
      rec({ id: '1', closedAt: '2025-01-15T00:00:00Z', isClosed: true, contractValue: 100 }),
      rec({ id: '2', closedAt: '2025-01-20T00:00:00Z', isClosed: true, contractValue: 200 }),
      rec({ id: '3', closedAt: '2025-02-10T00:00:00Z', isClosed: true, contractValue: 300 }),
    ]
    const buckets = groupIntoBuckets(records, 'month')
    expect(buckets).toHaveLength(2) // January + February
    expect(buckets[0]?.records).toHaveLength(2)
    expect(buckets[1]?.records).toHaveLength(1)
    expect(buckets[0]?.label).toBe('2025-01')
    expect(buckets[1]?.label).toBe('2025-02')
  })

  it('ignores records without dates', () => {
    const records = [
      rec({ id: '1', closedAt: '2025-01-15T00:00:00Z' }),
      rec({ id: '2' }), // no date
    ]
    const buckets = groupIntoBuckets(records, 'day')
    expect(buckets).toHaveLength(1)
    expect(buckets[0]?.records).toHaveLength(1)
  })

  it('prefers closedAt over createdAt', () => {
    const records = [
      rec({ id: '1', closedAt: '2025-03-01T00:00:00Z', createdAt: '2025-01-01T00:00:00Z' }),
    ]
    const buckets = groupIntoBuckets(records, 'month')
    expect(buckets[0]?.label).toBe('2025-03')
  })
})

describe('bucketsToTimeSeries', () => {
  it('converts buckets to time series points', () => {
    const records = [
      rec({ id: '1', closedAt: '2025-01-15T00:00:00Z', isClosed: true, contractValue: 100 }),
      rec({ id: '2', closedAt: '2025-01-20T00:00:00Z', isClosed: false }),
    ]
    const buckets = groupIntoBuckets(records, 'month')
    const ts = bucketsToTimeSeries(buckets)
    expect(ts).toHaveLength(1)
    expect(ts[0]?.contracts).toBe(1) // only the closed one
    expect(ts[0]?.revenue).toBe(100)
  })
})

describe('autoGranularity', () => {
  it('returns day for few close-together records', () => {
    const records = [
      rec({ id: '1', closedAt: '2025-01-01T00:00:00Z' }),
      rec({ id: '2', closedAt: '2025-01-05T00:00:00Z' }),
    ]
    expect(autoGranularity(records)).toBe('day')
  })

  it('returns month for records spanning several months', () => {
    const records = [
      rec({ id: '1', closedAt: '2025-01-01T00:00:00Z' }),
      rec({ id: '2', closedAt: '2025-09-01T00:00:00Z' }),
    ]
    expect(autoGranularity(records)).toBe('month')
  })

  it('returns year for records spanning many years', () => {
    const records = [
      rec({ id: '1', closedAt: '2020-01-01T00:00:00Z' }),
      rec({ id: '2', closedAt: '2025-01-01T00:00:00Z' }),
    ]
    expect(autoGranularity(records)).toBe('year')
  })
})
