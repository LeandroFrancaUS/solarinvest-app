export type WifiStatus = 'conectado' | 'desconectado' | 'falha'

export const WIFI_STATUS_OPTIONS: ReadonlyArray<{ value: WifiStatus; label: string; icon: string; tone: string }> = [
  { value: 'conectado', label: 'Conectado', icon: '🟢', tone: 'success' },
  { value: 'desconectado', label: 'Desconectado', icon: '🟡', tone: 'warning' },
  { value: 'falha', label: 'Falha', icon: '🔴', tone: 'danger' },
]

export const WIFI_STATUS_LABELS: Record<WifiStatus, string> = {
  conectado: 'Conectado',
  desconectado: 'Desconectado',
  falha: 'Falha',
}

export function isInstallationConcluded(status: unknown): boolean {
  return String(status ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'concluido'
}

export function normalizeWifiStatus(value: unknown): WifiStatus | null {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === 'conectado' || raw === 'desconectado' || raw === 'falha' ? raw : null
}

export function getWifiStatusMeta(status: WifiStatus | null | undefined) {
  return WIFI_STATUS_OPTIONS.find((item) => item.value === status) ?? null
}
