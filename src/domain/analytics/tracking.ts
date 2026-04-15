// src/domain/analytics/tracking.ts
// Lightweight event tracking service for app analytics.

import type { AnalyticsEvent, AnalyticsEventType } from './types.js'

// ---------------------------------------------------------------------------
// In-memory event log (client-side buffer)
// ---------------------------------------------------------------------------

const eventBuffer: AnalyticsEvent[] = []

/**
 * Track an analytics event.
 * Events are buffered in memory and can be flushed to a backend later.
 */
export function trackEvent(
  eventType: AnalyticsEventType,
  opts: { clientId?: string; contractValue?: number } = {},
): void {
  const event: AnalyticsEvent = {
    eventType,
    clientId: opts.clientId ?? null,
    contractValue: opts.contractValue ?? null,
    occurredAt: new Date().toISOString(),
  }
  eventBuffer.push(event)
}

/** Return all buffered events (for testing or flushing). */
export function getBufferedEvents(): readonly AnalyticsEvent[] {
  return eventBuffer
}

/** Clear the event buffer (e.g. after successful flush). */
export function clearBufferedEvents(): void {
  eventBuffer.length = 0
}
