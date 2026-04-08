/**
 * React hook that auto-triggers sync when connectivity is restored.
 */

import { useEffect, useState, useCallback } from 'react'
import { useConnectivity } from '../connectivity/useConnectivity'
import { runSync, setSyncTokenProvider, onSyncComplete, type SyncResult } from './syncEngine'
import { countPendingOperations } from '../offline/syncQueue'

export interface UseSyncEngineOptions {
  getAccessToken: () => Promise<string | null>
}

export interface SyncEngineState {
  lastResult: SyncResult | null
  isSyncing: boolean
  pendingCount: number
  triggerSync: () => void
}

export function useSyncEngine({ getAccessToken }: UseSyncEngineOptions): SyncEngineState {
  const connectivity = useConnectivity()
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  // Register token provider once
  useEffect(() => {
    setSyncTokenProvider(getAccessToken)
  }, [getAccessToken])

  // Listen for sync completion — single source of truth for isSyncing/lastResult
  useEffect(() => {
    const unsub = onSyncComplete((result) => {
      setLastResult(result)
      setIsSyncing(false)
    })
    return unsub
  }, [])

  // Auto-sync when connectivity is verified
  useEffect(() => {
    if (connectivity === 'online_verified') {
      setIsSyncing(true)
      void runSync()
    }
  }, [connectivity])

  // Update pending count after each sync result change
  useEffect(() => {
    void countPendingOperations().then(setPendingCount).catch(() => { /* ignore */ })
  }, [lastResult])

  const triggerSync = useCallback(() => {
    if (!isSyncing) {
      setIsSyncing(true)
      void runSync()
    }
  }, [isSyncing])

  return { lastResult, isSyncing, pendingCount, triggerSync }
}
