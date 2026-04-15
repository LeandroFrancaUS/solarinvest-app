// src/domain/analytics/analyticsEngine.ts
// Central orchestrator: consolidate data, apply filters, compute KPIs, series & forecast.

import type {
  AnalyticsRecord,
  DashboardFilters,
  DashboardSnapshot,
  TimeBucketGranularity,
} from './types.js'
import { applyFilters } from './filters.js'
import { computeKPIs } from './kpis.js'
import { autoGranularity, bucketsToTimeSeries, groupIntoBuckets } from './timeBuckets.js'
import { computeForecast } from './forecasting.js'

// ---------------------------------------------------------------------------
// Memoisation cache
// ---------------------------------------------------------------------------

let _lastRecords: readonly AnalyticsRecord[] | null = null
let _lastFilters: DashboardFilters | null = null
let _lastGranularity: TimeBucketGranularity | null = null
let _cachedSnapshot: DashboardSnapshot | null = null

function filtersEqual(a: DashboardFilters, b: DashboardFilters): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a full dashboard snapshot from raw AnalyticsRecords and filters.
 * Results are memoised: if inputs haven't changed, the cached snapshot is returned.
 *
 * @param records   All normalised records (from clients + proposals + portfolio).
 * @param filters   Active dashboard filters.
 * @param granularity  Optional override for time bucket granularity (auto-detected if omitted).
 */
export function computeDashboardSnapshot(
  records: readonly AnalyticsRecord[],
  filters: DashboardFilters,
  granularity?: TimeBucketGranularity,
): DashboardSnapshot {
  const effectiveGranularity = granularity ?? null

  // Check cache
  if (
    _cachedSnapshot &&
    _lastRecords === records &&
    _lastFilters && filtersEqual(_lastFilters, filters) &&
    _lastGranularity === effectiveGranularity
  ) {
    return _cachedSnapshot
  }

  // 1. Apply filters
  const filtered = applyFilters(records, filters)

  // 2. Compute KPIs
  const kpis = computeKPIs(filtered)

  // 3. Build time series
  const gran = effectiveGranularity ?? autoGranularity(filtered)
  const buckets = groupIntoBuckets(filtered, gran)
  const timeSeries = bucketsToTimeSeries(buckets)

  // 4. Forecast
  const forecast = computeForecast(timeSeries)

  const snapshot: DashboardSnapshot = { filtered, kpis, timeSeries, forecast }

  // Cache
  _lastRecords = records
  _lastFilters = filters
  _lastGranularity = effectiveGranularity
  _cachedSnapshot = snapshot

  return snapshot
}

/** Invalidate the memoised snapshot (e.g. when data sources change). */
export function invalidateSnapshotCache(): void {
  _lastRecords = null
  _lastFilters = null
  _lastGranularity = null
  _cachedSnapshot = null
}
