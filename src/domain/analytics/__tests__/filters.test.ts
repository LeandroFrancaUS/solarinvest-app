// src/domain/analytics/__tests__/filters.test.ts
import { describe, it, expect } from 'vitest'
import { applyFilters, defaultFilters } from '../filters.js'
import type { AnalyticsRecord, DashboardFilters } from '../types.js'

function makeRecord(overrides: Partial<AnalyticsRecord> = {}): AnalyticsRecord {
  return {
    id: 'r1',
    createdAt: '2025-06-15T00:00:00Z',
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

describe('applyFilters', () => {
  it('returns all records with default (all) filters', () => {
    const records = [makeRecord({ id: '1' }), makeRecord({ id: '2' })]
    const result = applyFilters(records, defaultFilters())
    expect(result).toHaveLength(2)
  })

  it('filters by consultant', () => {
    const records = [
      makeRecord({ id: '1', consultant: 'João' }),
      makeRecord({ id: '2', consultant: 'Maria' }),
      makeRecord({ id: '3', consultant: null }),
    ]
    const filters: DashboardFilters = { ...defaultFilters(), consultants: ['João'] }
    expect(applyFilters(records, filters)).toHaveLength(1)
    expect(applyFilters(records, filters)[0]?.id).toBe('1')
  })

  it('filters by state (case insensitive)', () => {
    const records = [
      makeRecord({ id: '1', state: 'SP' }),
      makeRecord({ id: '2', state: 'RJ' }),
    ]
    const filters: DashboardFilters = { ...defaultFilters(), states: ['sp'] }
    expect(applyFilters(records, filters)).toHaveLength(1)
  })

  it('filters by region', () => {
    const records = [
      makeRecord({ id: '1', region: 'Sudeste' }),
      makeRecord({ id: '2', region: 'Sul' }),
    ]
    const filters: DashboardFilters = { ...defaultFilters(), regions: ['Sudeste'] }
    expect(applyFilters(records, filters)).toHaveLength(1)
  })

  it('filters by value range', () => {
    const records = [
      makeRecord({ id: '1', contractValue: 100 }),
      makeRecord({ id: '2', contractValue: 500 }),
      makeRecord({ id: '3', contractValue: 1000 }),
    ]
    const filters: DashboardFilters = { ...defaultFilters(), minValue: 200, maxValue: 800 }
    expect(applyFilters(records, filters)).toHaveLength(1)
    expect(applyFilters(records, filters)[0]?.id).toBe('2')
  })

  it('filters by consumption range', () => {
    const records = [
      makeRecord({ id: '1', consumption: 200 }),
      makeRecord({ id: '2', consumption: 600 }),
    ]
    const filters: DashboardFilters = { ...defaultFilters(), minConsumption: 300 }
    expect(applyFilters(records, filters)).toHaveLength(1)
  })

  it('filters by custom date range', () => {
    const records = [
      makeRecord({ id: '1', createdAt: '2025-01-01T00:00:00Z' }),
      makeRecord({ id: '2', createdAt: '2025-06-15T00:00:00Z' }),
      makeRecord({ id: '3', createdAt: '2025-12-01T00:00:00Z' }),
    ]
    const filters: DashboardFilters = {
      ...defaultFilters(),
      period: 'custom',
      startDate: '2025-06-01',
      endDate: '2025-07-01',
    }
    expect(applyFilters(records, filters)).toHaveLength(1)
    expect(applyFilters(records, filters)[0]?.id).toBe('2')
  })

  it('prefers closedAt over createdAt for date filtering', () => {
    const records = [
      makeRecord({ id: '1', createdAt: '2025-01-01T00:00:00Z', closedAt: '2025-06-15T00:00:00Z' }),
    ]
    const filters: DashboardFilters = {
      ...defaultFilters(),
      period: 'custom',
      startDate: '2025-06-01',
      endDate: '2025-07-01',
    }
    expect(applyFilters(records, filters)).toHaveLength(1)
  })
})
