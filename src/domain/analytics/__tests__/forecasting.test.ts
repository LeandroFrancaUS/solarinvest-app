// src/domain/analytics/__tests__/forecasting.test.ts
import { describe, it, expect } from 'vitest'
import { computeForecast } from '../forecasting.js'
import type { TimeSeriesPoint } from '../types.js'

function point(label: string, revenue: number, contracts = 1): TimeSeriesPoint {
  return { label, contracts, revenue }
}

describe('computeForecast', () => {
  it('returns low confidence and zeroes for empty series', () => {
    const f = computeForecast([])
    expect(f.confidence).toBe('low')
    expect(f.next30Days).toHaveLength(30)
    expect(f.next30Days.every((v) => v === 0)).toBe(true)
  })

  it('returns low confidence for very few data points', () => {
    const f = computeForecast([point('2025-01', 100)])
    expect(f.confidence).toBe('low')
    expect(f.next30Days).toHaveLength(30)
  })

  it('returns medium confidence for 3-11 data points', () => {
    const series = Array.from({ length: 5 }, (_, i) => point(`2025-0${i + 1}`, (i + 1) * 100))
    const f = computeForecast(series)
    expect(f.confidence).toBe('medium')
    expect(f.next30Days).toHaveLength(30)
  })

  it('returns high confidence for 12+ data points', () => {
    const series = Array.from({ length: 14 }, (_, i) => point(`pt${i}`, (i + 1) * 50))
    const f = computeForecast(series)
    expect(f.confidence).toBe('high')
    expect(f.next30Days).toHaveLength(30)
  })

  it('uses linear trend for 3+ data points — values increase', () => {
    const series = [
      point('m1', 100),
      point('m2', 200),
      point('m3', 300),
    ]
    const f = computeForecast(series)
    // Linear trend should predict increasing values beyond 300
    const last = f.next30Days[f.next30Days.length - 1] ?? 0
    expect(last).toBeGreaterThan(300)
  })

  it('never predicts negative revenue', () => {
    const series = [
      point('m1', 300),
      point('m2', 200),
      point('m3', 100),
    ]
    const f = computeForecast(series)
    expect(f.next30Days.every((v) => v >= 0)).toBe(true)
  })
})
