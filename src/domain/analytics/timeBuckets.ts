// src/domain/analytics/timeBuckets.ts
// Group AnalyticsRecords into temporal buckets (day, week, month, year, custom).

import type { AnalyticsRecord, TimeBucket, TimeBucketGranularity, TimeSeriesPoint } from './types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfWeek(d: Date): Date {
  const day = d.getDay() // 0 = Sunday
  const diff = d.getDate() - day
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

function addYears(d: Date, n: number): Date {
  const r = new Date(d)
  r.setFullYear(r.getFullYear() + n)
  return r
}

function formatLabel(d: Date, granularity: TimeBucketGranularity): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  switch (granularity) {
    case 'day':
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    case 'week':
      return `${d.getFullYear()}-W${pad(Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86_400_000 + 1) / 7))}`
    case 'month':
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    case 'year':
      return String(d.getFullYear())
    case 'custom':
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
}

function bucketStart(d: Date, granularity: TimeBucketGranularity): Date {
  switch (granularity) {
    case 'day':
    case 'custom':
      return startOfDay(d)
    case 'week':
      return startOfWeek(d)
    case 'month':
      return startOfMonth(d)
    case 'year':
      return startOfYear(d)
  }
}

function nextBucketStart(d: Date, granularity: TimeBucketGranularity): Date {
  switch (granularity) {
    case 'day':
    case 'custom':
      return addDays(d, 1)
    case 'week':
      return addDays(d, 7)
    case 'month':
      return addMonths(d, 1)
    case 'year':
      return addYears(d, 1)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Choose the reference date for bucketing.
 * closedAt is preferred; falls back to createdAt.
 */
function refDate(r: AnalyticsRecord): Date | null {
  const s = r.closedAt ?? r.createdAt
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Group records into time buckets.
 * Records without a valid reference date are ignored.
 */
export function groupIntoBuckets(
  records: readonly AnalyticsRecord[],
  granularity: TimeBucketGranularity,
): TimeBucket[] {
  // Collect records with valid dates and sort by date
  const dated = records
    .map((r) => ({ record: r, date: refDate(r) }))
    .filter((x): x is { record: AnalyticsRecord; date: Date } => x.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (dated.length === 0) return []

  const first = dated[0]
  const last = dated[dated.length - 1]
  if (!first || !last) return []

  const buckets: TimeBucket[] = []
  let current = bucketStart(first.date, granularity)
  const finalEnd = nextBucketStart(bucketStart(last.date, granularity), granularity)

  while (current < finalEnd) {
    const end = nextBucketStart(current, granularity)
    buckets.push({
      label: formatLabel(current, granularity),
      start: current,
      end,
      records: [],
    })
    current = end
  }

  // Distribute records into buckets
  for (const { record, date } of dated) {
    const bs = bucketStart(date, granularity)
    const bucket = buckets.find((b) => b.start.getTime() === bs.getTime())
    if (bucket) {
      bucket.records.push(record)
    }
  }

  return buckets
}

/** Convert time buckets into a simpler time series for charts. */
export function bucketsToTimeSeries(buckets: readonly TimeBucket[]): TimeSeriesPoint[] {
  return buckets.map((b) => ({
    label: b.label,
    contracts: b.records.filter((r) => r.isClosed).length,
    revenue: b.records
      .filter((r) => r.isClosed)
      .reduce((sum, r) => sum + (r.contractValue ?? 0), 0),
  }))
}

/** Auto-select a granularity based on the date span of the records. */
export function autoGranularity(records: readonly AnalyticsRecord[]): TimeBucketGranularity {
  const dates = records
    .map((r) => refDate(r))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())

  if (dates.length < 2) return 'day'

  const first = dates[0]
  const last = dates[dates.length - 1]
  if (!first || !last) return 'day'

  const spanDays = (last.getTime() - first.getTime()) / 86_400_000

  if (spanDays <= 31) return 'day'
  if (spanDays <= 180) return 'week'
  if (spanDays <= 730) return 'month'
  return 'year'
}
