import React from 'react'
import type { WifiStatus } from '../../domain/wifi/wifiStatus'
import { WIFI_STATUS_OPTIONS, isInstallationConcluded } from '../../domain/wifi/wifiStatus'

interface Props {
  value: WifiStatus | null
  installationStatus?: string | null
  onChange: (value: WifiStatus | null) => void
}

export function WifiStatusField({ value, installationStatus, onChange }: Props) {
  const enabled = isInstallationConcluded(installationStatus)

  return (
    <div className="form-group">
      <label>Status WiFi</label>
      <select
        value={value ?? ''}
        disabled={!enabled}
        onChange={(e) => onChange((e.target.value || null) as WifiStatus | null)}
      >
        <option value="">—</option>
        {WIFI_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.icon} {opt.label}
          </option>
        ))}
      </select>
      {!enabled && (
        <small style={{ color: 'var(--text-muted)' }}>
          Disponível após instalação concluída
        </small>
      )}
    </div>
  )
}
