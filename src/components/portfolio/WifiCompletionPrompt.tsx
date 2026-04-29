import React, { useState } from 'react'
import type { WifiStatus } from '../../domain/wifi/wifiStatus'
import { WIFI_STATUS_OPTIONS } from '../../domain/wifi/wifiStatus'

interface Props {
  open: boolean
  clientName?: string | null
  onSelect: (status: WifiStatus) => Promise<void> | void
  onClose: () => void
}

export function WifiCompletionPrompt({ open, clientName, onSelect, onClose }: Props) {
  const [saving, setSaving] = useState<WifiStatus | null>(null)
  if (!open) return null

  async function handleSelect(status: WifiStatus) {
    try {
      setSaving(status)
      await onSelect(status)
      onClose()
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="pf-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="pf-modal-card">
        <h3>Sistema conectado ao WiFi?</h3>
        <p>
          A instalação de {clientName || 'este cliente'} foi marcada como concluída. Confirme o status inicial de monitoramento.
        </p>

        <div className="pf-form-grid">
          {WIFI_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={saving != null}
              onClick={() => void handleSelect(option.value)}
              className="pf-btn pf-btn-secondary"
            >
              {option.icon} {option.label} {saving === option.value ? 'Salvando…' : ''}
            </button>
          ))}
        </div>

        <div className="pf-modal-actions">
          <button type="button" onClick={onClose} className="pf-btn pf-btn-cancel">
            Decidir depois
          </button>
        </div>
      </div>
    </div>
  )
}
