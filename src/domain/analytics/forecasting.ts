// src/domain/analytics/forecasting.ts
// Simple forecasting using moving average and linear trend.

import type { Forecast, TimeSeriesPoint } from './types.js'

// ---------------------------------------------------------------------------
// Moving average
// ---------------------------------------------------------------------------

/**
 * Compute a simple moving average from the last `window` data points.
 * Returns an array of 30 predicted daily values.
 */
function movingAverage(values: readonly number[], window: number): number[] {
  if (values.length === 0) return new Array<number>(30).fill(0)

  const w = Math.min(window, values.length)
  const tail = values.slice(-w)
  const avg = tail.reduce((a, b) => a + b, 0) / w

  // For daily forecast, distribute the periodic average across 30 days.
  // If the input is monthly data, each point ≈ 30 days → daily ≈ avg/30
  // We keep it simple: return 30 copies of avg (scaled to 1 day worth).
  return new Array<number>(30).fill(avg)
}

// ---------------------------------------------------------------------------
// Linear trend
// ---------------------------------------------------------------------------

/**
 * Fit y = a + b*x via least squares and extrapolate 30 values beyond the last x.
 */
function linearTrend(values: readonly number[]): number[] {
  const n = values.length
  if (n < 2) return movingAverage(values, n)

  // x = 0, 1, …, n-1
  const sumX = (n * (n - 1)) / 2
  const sumY = values.reduce((a, b) => a + b, 0)
  const sumXY = values.reduce((acc, y, x) => acc + x * y, 0)
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6

  const denom = n * sumX2 - sumX * sumX
  const b = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
  const a = (sumY - b * sumX) / n

  const forecast: number[] = []
  for (let i = 0; i < 30; i++) {
    const predicted = a + b * (n + i)
    forecast.push(Math.max(0, predicted)) // never predict negative revenue
  }
  return forecast
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

function assessConfidence(dataPoints: number): Forecast['confidence'] {
  if (dataPoints < 3) return 'low'
  if (dataPoints < 12) return 'medium'
  return 'high'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a 30-day revenue forecast from time series data.
 * Uses linear trend when enough data points exist; falls back to moving average.
 */
export function computeForecast(timeSeries: readonly TimeSeriesPoint[]): Forecast {
  const revenueValues = timeSeries.map((p) => p.revenue)
  const n = revenueValues.length

  const next30Days = n >= 3 ? linearTrend(revenueValues) : movingAverage(revenueValues, 3)
  const confidence = assessConfidence(n)

  return { next30Days, confidence }
}
