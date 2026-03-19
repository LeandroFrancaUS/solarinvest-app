/**
 * Clears all persisted client-side data (IndexedDB drafts + proposals).
 * Call this when the user signs out to prevent stale data from persisting
 * across different user sessions and to protect customer privacy.
 */

import { clearAllDrafts } from './localDraft'
import { clearAllProposals } from './proposalStore'

export async function clearAllClientData(): Promise<void> {
  const results = await Promise.allSettled([
    clearAllDrafts(),
    clearAllProposals(),
  ])
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[clearOnLogout] partial failure:', result.reason)
    }
  }
}
