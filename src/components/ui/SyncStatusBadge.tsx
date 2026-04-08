/**
 * Shows pending sync count and last sync result.
 */

import React from 'react'

interface SyncStatusBadgeProps {
  pendingCount: number
  isSyncing: boolean
  lastSyncedAt?: string | null
  onTriggerSync?: () => void
  className?: string
}

export function SyncStatusBadge({
  pendingCount,
  isSyncing,
  lastSyncedAt,
  onTriggerSync,
  className,
}: SyncStatusBadgeProps) {
  if (isSyncing) {
    return (
      <span className={`sync-status-badge sync-status-badge--syncing${className ? ` ${className}` : ''}`}>
        ⏳ Sincronizando…
      </span>
    )
  }

  if (pendingCount > 0) {
    return (
      <button
        type="button"
        className={`sync-status-badge sync-status-badge--pending${className ? ` ${className}` : ''}`}
        onClick={onTriggerSync}
        title="Clique para sincronizar"
        aria-label={`${pendingCount} item(s) pendente(s) de sincronização`}
      >
        🔄 {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
      </button>
    )
  }

  if (lastSyncedAt) {
    return (
      <span className={`sync-status-badge sync-status-badge--synced${className ? ` ${className}` : ''}`}>
        ✅ Sincronizado
      </span>
    )
  }

  return null
}
