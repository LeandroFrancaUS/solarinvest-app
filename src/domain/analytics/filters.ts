// src/domain/analytics/filters.ts
// Apply DashboardFilters to an array of AnalyticsRecords.

import type { AnalyticsRecord, DashboardFilters } from './types.js'

/** Create a DashboardFilters with sensible defaults. */
export function defaultFilters(): DashboardFilters {
  return {
    period: 'all',
    startDate: null,
    endDate: null,
    consultants: [],
    regions: [],
    states: [],
    minValue: null,
    maxValue: null,
    minConsumption: null,
    maxConsumption: null,
  }
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

function periodRange(period: string): { start: Date; end: Date } | null {
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

  switch (period) {
    case 'today': {
      const s = startOfDay(now)
      return { start: s, end: new Date(s.getTime() + 86_400_000) }
    }
    case '7d': {
      const s = new Date(now.getTime() - 7 * 86_400_000)
      return { start: startOfDay(s), end: now }
    }
    case '30d': {
      const s = new Date(now.getTime() - 30 * 86_400_000)
      return { start: startOfDay(s), end: now }
    }
    case '90d': {
      const s = new Date(now.getTime() - 90 * 86_400_000)
      return { start: startOfDay(s), end: now }
    }
    case '12m': {
      const s = new Date(now)
      s.setFullYear(s.getFullYear() - 1)
      return { start: startOfDay(s), end: now }
    }
    case 'ytd': {
      const s = new Date(now.getFullYear(), 0, 1)
      return { start: s, end: now }
    }
    default:
      return null // 'all' or unknown
  }
}

function dateInRange(dateStr: string | null, start: Date, end: Date): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d >= start && d <= end
}

// ---------------------------------------------------------------------------
// Core filter
// ---------------------------------------------------------------------------

export function applyFilters(
  records: readonly AnalyticsRecord[],
  filters: DashboardFilters,
): AnalyticsRecord[] {
  let result = records as AnalyticsRecord[]

  // Period filter
  if (filters.period === 'custom') {
    if (filters.startDate || filters.endDate) {
      const start = filters.startDate ? new Date(filters.startDate) : new Date(0)
      const end = filters.endDate ? new Date(filters.endDate) : new Date()
      result = result.filter((r) => {
        const ref = r.closedAt ?? r.createdAt
        return dateInRange(ref, start, end)
      })
    }
  } else {
    const range = periodRange(filters.period)
    if (range) {
      result = result.filter((r) => {
        const ref = r.closedAt ?? r.createdAt
        return dateInRange(ref, range.start, range.end)
      })
    }
  }

  // Consultant filter
  if (filters.consultants.length > 0) {
    const set = new Set(filters.consultants.map((c) => c.toLowerCase()))
    result = result.filter((r) => r.consultant != null && set.has(r.consultant.toLowerCase()))
  }

  // Region filter
  if (filters.regions.length > 0) {
    const set = new Set(filters.regions.map((r) => r.toLowerCase()))
    result = result.filter((r) => r.region != null && set.has(r.region.toLowerCase()))
  }

  // State filter
  if (filters.states.length > 0) {
    const set = new Set(filters.states.map((s) => s.toUpperCase()))
    result = result.filter((r) => r.state != null && set.has(r.state.toUpperCase()))
  }

  // Value range filter
  if (filters.minValue != null) {
    const min = filters.minValue
    result = result.filter((r) => r.contractValue != null && r.contractValue >= min)
  }
  if (filters.maxValue != null) {
    const max = filters.maxValue
    result = result.filter((r) => r.contractValue != null && r.contractValue <= max)
  }

  // Consumption range filter
  if (filters.minConsumption != null) {
    const min = filters.minConsumption
    result = result.filter((r) => r.consumption != null && r.consumption >= min)
  }
  if (filters.maxConsumption != null) {
    const max = filters.maxConsumption
    result = result.filter((r) => r.consumption != null && r.consumption <= max)
  }

  return result
}
