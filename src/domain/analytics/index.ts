// src/domain/analytics/index.ts
// Public API barrel.

export type {
  AnalyticsRecord,
  DashboardFilters,
  DashboardKPIs,
  DashboardSnapshot,
  Forecast,
  TimeBucket,
  TimeBucketGranularity,
  TimeSeriesPoint,
  AnalyticsEventType,
  AnalyticsEvent,
} from './types.js'

export { normalizeClient, normalizeProposal, normalizePortfolio } from './normalizers.js'
export { applyFilters, defaultFilters } from './filters.js'
export { computeKPIs } from './kpis.js'
export { groupIntoBuckets, bucketsToTimeSeries, autoGranularity } from './timeBuckets.js'
export { computeForecast } from './forecasting.js'
export { computeDashboardSnapshot, invalidateSnapshotCache } from './analyticsEngine.js'
export { trackEvent, getBufferedEvents, clearBufferedEvents } from './tracking.js'
