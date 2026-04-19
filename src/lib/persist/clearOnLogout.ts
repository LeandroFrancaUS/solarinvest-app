/**
 * Clears all persisted client-side data (IndexedDB drafts + proposals,
 * sessionStorage form state, and localStorage app data).
 * Call this when the user signs out to prevent stale data from persisting
 * across different user sessions and to protect customer privacy.
 */

import { clearAllDrafts } from './localDraft'
import { clearAllProposals } from './proposalStore'

// sessionStorage keys for form stores — per-session data that must be wiped
// on logout so a subsequent user on the same device starts with a clean form.
const SESSION_STORAGE_FORM_KEYS: readonly string[] = [
  'solarinvest:venda-form:v1',   // useVendaStore
  'solarinvest:leasing-form:v1', // useLeasingStore
]

// localStorage keys for user-specific app data that should not persist for a
// different user logging in on the same device.
const LOCAL_STORAGE_DATA_KEYS: readonly string[] = [
  'solarinvest:vendas:v1',      // useVendasConfigStore
  'solarinvest:venda-sims:v1',  // useVendasSimulacoesStore
  'solarinvest:simulacoes:v1',  // useSimulationsStore
  // Client and proposal caches: must be cleared on logout so a subsequent
  // user on the same device does not inherit data from the previous session.
  'solarinvest-clientes',       // CLIENTES_STORAGE_KEY — API-sourced client list
  'solarinvest-orcamentos',     // BUDGETS_STORAGE_KEY  — API-sourced proposal list
  // Navigation state: cleared so next user starts fresh.
  'solarinvest-active-page',    // STORAGE_KEYS.activePage
  'solarinvest-active-tab',     // STORAGE_KEYS.activeTab
  'solarinvest-simulacoes-section', // STORAGE_KEYS.simulacoesSection
]

function clearFormSessionStorage(): void {
  if (typeof window === 'undefined') return
  try {
    for (const key of SESSION_STORAGE_FORM_KEYS) {
      window.sessionStorage.removeItem(key)
    }
  } catch {
    // Safari Private Browsing may restrict sessionStorage; non-fatal
  }
}

function clearAppLocalStorage(): void {
  if (typeof window === 'undefined') return
  try {
    for (const key of LOCAL_STORAGE_DATA_KEYS) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Storage access may fail in restricted environments; non-fatal
  }
}

export async function clearAllClientData(): Promise<void> {
  // Synchronous storage clear first so keys are wiped even if the async
  // IndexedDB operations are interrupted by a navigation redirect.
  clearFormSessionStorage()
  clearAppLocalStorage()

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
