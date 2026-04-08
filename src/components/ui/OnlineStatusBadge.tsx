/**
 * Displays the current online/offline connectivity state.
 */

import React from 'react'
import { useConnectivity } from '../../lib/connectivity/useConnectivity'
import type { ConnectivityState } from '../../lib/connectivity/connectivityService'

const LABELS: Record<ConnectivityState, string> = {
  offline: 'Offline',
  online_unverified: 'Online',
  online_verified: 'Online',
  syncing: 'Sincronizando…',
  sync_error: 'Erro de sync',
}

const VARIANTS: Record<ConnectivityState, string> = {
  offline: 'offline',
  online_unverified: 'online',
  online_verified: 'online',
  syncing: 'syncing',
  sync_error: 'error',
}

interface OnlineStatusBadgeProps {
  className?: string
  showLabel?: boolean
}

export function OnlineStatusBadge({ className, showLabel = true }: OnlineStatusBadgeProps) {
  const state = useConnectivity()
  const label = LABELS[state]
  const variant = VARIANTS[state]

  return (
    <span
      className={`online-status-badge online-status-badge--${variant}${className ? ` ${className}` : ''}`}
      aria-label={`Conectividade: ${label}`}
      title={label}
    >
      <span className="online-status-badge__dot" aria-hidden="true" />
      {showLabel && <span className="online-status-badge__label">{label}</span>}
    </span>
  )
}
