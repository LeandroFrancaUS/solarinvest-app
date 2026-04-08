// src/components/proposals/ProposalSyncBadge.tsx
// Displays a discrete indicator of the current proposal's persistence state.
// See docs/PROPOSALS_SOURCE_OF_TRUTH.md for the state model.
//
// Variants:
//   draft    → "Rascunho local"   (proposal not yet persisted in Neon)
//   synced   → "Salvo no servidor" (backend is in sync with local state)
//   dirty    → "Alterações não sincronizadas" (local edits pending save)
//   readonly → "Somente leitura"  (role_financeiro — no write access)

import React from 'react'
import { getSyncStateLabel, type ProposalSyncState } from '../../lib/proposals/useProposalSyncState'

interface ProposalSyncBadgeProps {
  syncState: ProposalSyncState
  isReadOnly: boolean
  className?: string
}

export function ProposalSyncBadge({ syncState, isReadOnly, className }: ProposalSyncBadgeProps) {
  const { label, variant } = getSyncStateLabel(syncState, isReadOnly)

  return (
    <span
      className={`proposal-sync-badge proposal-sync-badge--${variant}${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={`Estado da proposta: ${label}`}
    >
      {variant === 'draft' && '📝 '}
      {variant === 'synced' && '✅ '}
      {variant === 'dirty' && '⚠️ '}
      {variant === 'readonly' && '🔒 '}
      {label}
    </span>
  )
}
