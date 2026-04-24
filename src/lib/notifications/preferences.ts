import type { DashboardNotificationPreference } from '../../types/dashboard'

const STORAGE_KEY = 'solarinvest:notification-preferences'

export const DEFAULT_PREFERENCES: DashboardNotificationPreference = {
  visualEnabled: true,
  soundEnabled: true,
  pushEnabled: false,
  overdueInvoices: true,
  dueSoonInvoices: true,
  kitDeliveryUpdates: true,
  installationUpdates: true,
  supportUpdates: true,
  criticalOnly: false,
}

export function loadPreferences(): DashboardNotificationPreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) as Partial<DashboardNotificationPreference> }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePreferences(prefs: DashboardNotificationPreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore storage errors
  }
}
