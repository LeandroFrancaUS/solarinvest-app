/**
 * useStorageHydration
 *
 * Extracted from App.tsx. Encapsulates all storage-related hydration/sync logic:
 *   1. Registers auth token providers for every API service once a user signs in.
 *   2. Kicks off the local→Neon migration and server-storage sync on login.
 *   3. Exposes `authSyncKey` — a counter that increments whenever auth becomes
 *      available, allowing data-load effects elsewhere to re-run on new devices.
 *   4. Manages the `isHydrating` / `isHydratingRef` guard used throughout the
 *      app to suppress auto-save and other writes during snapshot restoration.
 *   5. Restores a form draft from IndexedDB once on mount.
 *
 * Zero behavioural change — exact same effect logic as the original App.tsx blocks.
 */

import { useEffect, useRef, useState } from 'react'
import {
  ensureServerStorageSync,
  setStorageTokenProvider,
} from '../app/services/serverStorage'
import { setProposalsTokenProvider } from '../lib/api/proposalsApi'
import { setClientsTokenProvider } from '../lib/api/clientsApi'
import { setAdminUsersTokenProvider } from '../services/auth/admin-users'
import { setPortfolioTokenProvider } from '../services/clientPortfolioApi'
import { setFinancialManagementTokenProvider } from '../services/financialManagementApi'
import { setRevenueBillingTokenProvider } from '../services/revenueBillingApi'
import { setProjectsTokenProvider } from '../services/projectsApi'
import { setProjectFinanceTokenProvider } from '../features/project-finance/api'
import { setFinancialImportTokenProvider } from '../services/financialImportApi'
import { setInvoicesTokenProvider } from '../services/invoicesApi'
import { setOperationalDashboardTokenProvider } from '../lib/api/operationalDashboardApi'
import {
  migrateLocalStorageToServer,
  setMigrationTokenProvider,
} from '../lib/migrateLocalStorageToServer'
import { setFetchAuthTokenProvider } from '../lib/auth/fetchWithStackAuth'
import { loadFormDraft } from '../lib/persist/formDraft'

type NotificacaoTipo = 'success' | 'info' | 'error'

/** Minimal draft shape — enough for the recovery notification message. */
type MinimalDraftData = {
  cliente?: { nome?: string | null } | null
  [key: string]: unknown
}

export interface UseStorageHydrationOptions {
  /** Stable primitive from `user?.id ?? null` — triggers token setup on login. */
  userId: string | null
  /** Stable token getter (useCallback with empty deps) forwarded from App.tsx. */
  getAccessToken: () => Promise<string | null>
  /**
   * Mutable ref pointing to the current `aplicarSnapshot` callback.
   * App.tsx updates this ref in the render body after `aplicarSnapshot` is
   * declared, so the async draft-loader always calls the latest version even
   * though the effect has empty deps.
   */
  applyDraftRef: React.MutableRefObject<((data: unknown) => void) | null>
  /** App.tsx notification dispatcher (adicionarNotificacao). */
  onNotify: (mensagem: string, tipo?: NotificacaoTipo) => void
}

export interface UseStorageHydrationResult {
  /**
   * Increments each time auth becomes available. Data-load effects include this
   * in their dependency arrays so they re-run on new devices after login.
   */
  authSyncKey: number
  /** React state mirror of `isHydratingRef` — used for render-time guards. */
  isHydrating: boolean
  /** Mutable ref used inside callbacks/effects to suppress auto-save etc. */
  isHydratingRef: React.MutableRefObject<boolean>
  /** State setter so App.tsx handlers can update `isHydrating` alongside the ref. */
  setIsHydrating: React.Dispatch<React.SetStateAction<boolean>>
}

export function useStorageHydration({
  userId,
  getAccessToken,
  applyDraftRef,
  onNotify,
}: UseStorageHydrationOptions): UseStorageHydrationResult {
  const [authSyncKey, setAuthSyncKey] = useState(0)
  const [isHydrating, setIsHydrating] = useState(false)
  const isHydratingRef = useRef(false)

  // Keep a stable ref to onNotify so the form-draft effect doesn't need it in deps.
  const onNotifyRef = useRef(onNotify)
  onNotifyRef.current = onNotify

  // ─── Auth / token providers ────────────────────────────────────────────────
  // Wire up Stack Auth Bearer token for cross-device data persistence.
  // When the user resolves, register the token provider so serverStorage
  // and all API clients can include Authorization: Bearer <token>.
  // Storage sync runs only after auth is available to avoid unauthenticated
  // /api/storage calls that can generate noisy 5xx/401 logs.
  //
  // Keyed on userId (primitive) + getAccessToken (stable ref from userRef pattern)
  // so this runs ONCE per real login — not on every SDK polling cycle.
  useEffect(() => {
    if (!userId) return

    setStorageTokenProvider(getAccessToken)
    setProposalsTokenProvider(getAccessToken)
    setClientsTokenProvider(getAccessToken)
    setAdminUsersTokenProvider(getAccessToken)
    setPortfolioTokenProvider(getAccessToken)
    setFinancialManagementTokenProvider(getAccessToken)
    setRevenueBillingTokenProvider(getAccessToken)
    setProjectsTokenProvider(getAccessToken)
    setProjectFinanceTokenProvider(getAccessToken)
    setFinancialImportTokenProvider(getAccessToken)
    setInvoicesTokenProvider(getAccessToken)
    setOperationalDashboardTokenProvider(async () => (await getAccessToken()) ?? '')
    // Register token provider for the local→Neon migration tool.
    setMigrationTokenProvider(getAccessToken)
    // Register global token provider for httpClient.ts (used by personnelApi
    // and other services that go through the shared apiFetch helper).
    setFetchAuthTokenProvider(getAccessToken)
    // Silently migrate any locally-stored clients/proposals to Neon.
    // Fire-and-forget: errors are caught internally; does not block auth flow.
    void migrateLocalStorageToServer()
    // Re-run server storage sync now that auth is available.
    void ensureServerStorageSync({ timeoutMs: 6000 })
    // Signal data-load effects to re-run now that auth token is available.
    // This fixes cross-device/cross-browser: the initial load runs before auth
    // resolves; this increment triggers a reload once the token provider is set.
    setAuthSyncKey((k) => k + 1)
  }, [userId, getAccessToken])

  // ─── Form draft restoration ────────────────────────────────────────────────
  // Restore a complete form snapshot from IndexedDB on first mount.
  // The apply callback is read through `applyDraftRef` (updated by App.tsx on
  // every render) rather than passed directly, so the async IndexedDB read
  // always calls the latest version of `aplicarSnapshot` without the effect
  // needing `aplicarSnapshot` in its dependency array.
  useEffect(() => {
    let cancelado = false

    const carregarDraft = async () => {
      try {
        if (import.meta.env.DEV)
          console.debug('[useStorageHydration] Loading form draft from IndexedDB on mount')

        const envelope = await loadFormDraft<MinimalDraftData>()

        if (cancelado) return

        if (envelope?.data) {
          if (import.meta.env.DEV)
            console.debug('[useStorageHydration] Form draft found, applying snapshot')

          // Enable hydration mode to prevent state reset and auto-save during apply
          isHydratingRef.current = true
          setIsHydrating(true)
          if (import.meta.env.DEV) console.debug('[useStorageHydration] Hydration mode enabled')

          try {
            applyDraftRef.current?.(envelope.data)

            // Wait for React to apply all setState calls
            await new Promise<void>((resolve) => setTimeout(resolve, 0))

            if (import.meta.env.DEV) console.debug('[useStorageHydration] Hydration done')
          } finally {
            isHydratingRef.current = false
            setIsHydrating(false)
          }

          // Show a discreet recovery notification
          const clientName = (envelope.data.cliente?.nome ?? '').trim()
          const recoveryMsg = clientName
            ? `Progresso recuperado: ${clientName}`
            : 'Progresso recuperado automaticamente'
          onNotifyRef.current(recoveryMsg, 'info')

          if (import.meta.env.DEV)
            console.debug('[useStorageHydration] Form draft applied successfully')
        } else {
          if (import.meta.env.DEV)
            console.debug('[useStorageHydration] No form draft found in IndexedDB')
        }
      } catch (error) {
        console.error('[useStorageHydration] Failed to load form draft:', error)
      }
    }

    void carregarDraft()
    return () => {
      cancelado = true
    }
  }, [applyDraftRef]) // applyDraftRef is a stable ref object — effect runs once

  return { authSyncKey, isHydrating, isHydratingRef, setIsHydrating }
}
