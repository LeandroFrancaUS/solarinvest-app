// src/lib/proposals/useProposalSyncState.ts
// Tracks whether the current proposal exists in the backend (Neon) or is only
// a local draft. This is the frontend representation of the source-of-truth
// decision documented in docs/PROPOSALS_SOURCE_OF_TRUTH.md.
//
// Terminology (aligned with the architecture document):
//   - "local draft"   → proposal exists only in local stores / IndexedDB
//   - "server"        → proposal has been persisted in Neon via /api/proposals
//   - isDirty         → local state diverges from the last server-persisted state
//   - lastSyncedAt    → ISO timestamp of the last successful server sync

import { useState, useCallback } from 'react'

export type ProposalSaveSource = 'local-draft' | 'server'

export interface ProposalSyncState {
  /** The id returned by POST /api/proposals or PATCH /api/proposals/:id.
   *  Null means the proposal only exists locally (draft). */
  persistedProposalId: string | null
  /** Where the proposal was last saved. */
  saveSource: ProposalSaveSource
  /** True when local edits have not yet been synced to the backend. */
  isDirty: boolean
  /** ISO timestamp of the last successful sync with the backend. Null for drafts. */
  lastSyncedAt: string | null
}

export interface ProposalSyncActions {
  /** Mark the proposal as synced with the backend after a successful POST or PATCH. */
  markSyncedToServer: (persistedId: string) => void
  /** Mark the current state as having unsaved local edits. */
  markDirty: () => void
  /** Reset to a clean local draft (e.g. when starting a new proposal). */
  resetToDraft: () => void
  /** Hydrate the sync state from a loaded server proposal. */
  hydrateFromServer: (persistedId: string) => void
}

const INITIAL_STATE: ProposalSyncState = {
  persistedProposalId: null,
  saveSource: 'local-draft',
  isDirty: false,
  lastSyncedAt: null,
}

/**
 * Manages the sync state between local draft and backend-persisted proposal.
 *
 * Source-of-truth rule (docs/PROPOSALS_SOURCE_OF_TRUTH.md):
 *   - If persistedProposalId is set → proposal lives in Neon (backend is source of truth)
 *   - If persistedProposalId is null → proposal is a local draft (transitório)
 *
 * Usage:
 *   const { syncState, markSyncedToServer, markDirty, resetToDraft } = useProposalSyncState()
 *
 *   // After successful POST /api/proposals:
 *   markSyncedToServer(result.id)
 *
 *   // When user edits a field:
 *   markDirty()
 *
 *   // When opening an existing proposal from backend:
 *   hydrateFromServer(proposal.id)
 */
export function useProposalSyncState(): ProposalSyncState & ProposalSyncActions {
  const [state, setState] = useState<ProposalSyncState>(INITIAL_STATE)

  const markSyncedToServer = useCallback((persistedId: string) => {
    setState({
      persistedProposalId: persistedId,
      saveSource: 'server',
      isDirty: false,
      lastSyncedAt: new Date().toISOString(),
    })
  }, [])

  const markDirty = useCallback(() => {
    setState((prev) => {
      if (prev.isDirty) return prev
      return { ...prev, isDirty: true }
    })
  }, [])

  const resetToDraft = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  const hydrateFromServer = useCallback((persistedId: string) => {
    setState({
      persistedProposalId: persistedId,
      saveSource: 'server',
      isDirty: false,
      lastSyncedAt: new Date().toISOString(),
    })
  }, [])

  return {
    ...state,
    markSyncedToServer,
    markDirty,
    resetToDraft,
    hydrateFromServer,
  }
}

/**
 * Returns a human-readable label for the current sync state.
 * Used by the ProposalSyncBadge component.
 */
export function getSyncStateLabel(
  state: ProposalSyncState,
  isReadOnly: boolean,
): { label: string; variant: 'draft' | 'synced' | 'dirty' | 'readonly' } {
  if (isReadOnly) {
    return { label: 'Somente leitura', variant: 'readonly' }
  }
  if (!state.persistedProposalId) {
    return { label: 'Rascunho local', variant: 'draft' }
  }
  if (state.isDirty) {
    return { label: 'Alterações não sincronizadas', variant: 'dirty' }
  }
  return { label: 'Salvo no servidor', variant: 'synced' }
}
