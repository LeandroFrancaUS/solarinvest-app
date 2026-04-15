// src/domain/analytics/types.ts
// Canonical data model for the analytics layer.

/** Unified record that every data source normalizes into. */
export type AnalyticsRecord = {
  id: string
  createdAt: string | null
  closedAt: string | null
  activatedAt: string | null

  consultant: string | null
  city: string | null
  state: string | null
  region: string | null

  contractValue: number | null
  consumption: number | null

  isClosed: boolean
  isActive: boolean
}

/** Filters applied to the dashboard before any KPI computation. */
export type DashboardFilters = {
  period: string
  startDate: string | null
  endDate: string | null

  consultants: string[]
  regions: string[]
  states: string[]

  minValue: number | null
  maxValue: number | null

  minConsumption: number | null
  maxConsumption: number | null
}

/** KPI bag returned by the analytics engine. */
export type DashboardKPIs = {
  closedContracts: number
  activeClients: number
  totalContractValue: number
  averageTicket: number
  totalConsumption: number
  averageConsumption: number
  conversionRate: number
}

/** Forecast output. */
export type Forecast = {
  next30Days: number[]
  confidence: 'low' | 'medium' | 'high'
}

export type TimeBucketGranularity = 'day' | 'week' | 'month' | 'year' | 'custom'

export type TimeBucket = {
  label: string
  start: Date
  end: Date
  records: AnalyticsRecord[]
}

export type TimeSeriesPoint = {
  label: string
  contracts: number
  revenue: number
}

/** Full snapshot returned by computeDashboardSnapshot. */
export type DashboardSnapshot = {
  filtered: AnalyticsRecord[]
  kpis: DashboardKPIs
  timeSeries: TimeSeriesPoint[]
  forecast: Forecast
}

export type AnalyticsEventType =
  | 'client_created'
  | 'deal_closed'
  | 'client_activated'
  | 'portfolio_removed'
  | 'dashboard_viewed'

export type AnalyticsEvent = {
  eventType: AnalyticsEventType
  clientId: string | null
  contractValue: number | null
  occurredAt: string
}
