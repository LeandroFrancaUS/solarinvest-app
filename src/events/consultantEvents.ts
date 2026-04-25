// src/events/consultantEvents.ts
// Custom events for consultant linking/unlinking to trigger auto-detection refresh

/**
 * Event fired when a consultant is linked or unlinked from a user.
 * This allows the App to re-run consultant auto-detection for the current user.
 */
export const CONSULTANT_LINK_CHANGED_EVENT = 'consultant:link-changed'

export interface ConsultantLinkChangedDetail {
  consultantId: number
  userId: string
  action: 'linked' | 'unlinked'
}

/**
 * Dispatches a consultant link changed event.
 * This should be called after successfully linking or unlinking a consultant.
 */
export function emitConsultantLinkChanged(detail: ConsultantLinkChangedDetail): void {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<ConsultantLinkChangedDetail>(CONSULTANT_LINK_CHANGED_EVENT, {
      detail,
      bubbles: true,
    })
    window.dispatchEvent(event)
    if (import.meta.env.DEV) {
      console.debug('[consultant-events] Link changed event emitted', detail)
    }
  }
}

/**
 * Adds a listener for consultant link changed events.
 * Returns a cleanup function to remove the listener.
 */
export function onConsultantLinkChanged(
  callback: (detail: ConsultantLinkChangedDetail) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ConsultantLinkChangedDetail>
    callback(customEvent.detail)
  }

  window.addEventListener(CONSULTANT_LINK_CHANGED_EVENT, handler)

  return () => {
    window.removeEventListener(CONSULTANT_LINK_CHANGED_EVENT, handler)
  }
}
