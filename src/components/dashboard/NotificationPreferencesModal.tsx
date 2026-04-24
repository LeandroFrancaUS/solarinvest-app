import React, { useState } from 'react'
import type { DashboardNotificationPreference } from '../../types/dashboard'

interface NotificationPreferencesModalProps {
  open: boolean
  preferences: DashboardNotificationPreference
  onSave: (prefs: DashboardNotificationPreference) => void
  onClose: () => void
}

type BooleanPrefKey = {
  [K in keyof DashboardNotificationPreference]: DashboardNotificationPreference[K] extends boolean | undefined ? K : never
}[keyof DashboardNotificationPreference]

export function NotificationPreferencesModal({
  open,
  preferences,
  onSave,
  onClose,
}: NotificationPreferencesModalProps) {
  const [local, setLocal] = useState<DashboardNotificationPreference>(preferences)

  if (!open) return null

  const toggle = (key: BooleanPrefKey) =>
    setLocal((prev) => ({ ...prev, [key]: !prev[key] }))

  const rows: { key: BooleanPrefKey; label: string }[] = [
    { key: 'visualEnabled', label: 'Notificações visuais' },
    { key: 'soundEnabled', label: 'Notificações sonoras' },
    { key: 'pushEnabled', label: 'Notificações push (navegador)' },
    { key: 'overdueInvoices', label: 'Faturas vencidas' },
    { key: 'dueSoonInvoices', label: 'Faturas a vencer' },
    { key: 'kitDeliveryUpdates', label: 'Atualizações de entrega de kit' },
    { key: 'installationUpdates', label: 'Atualizações de instalação' },
    { key: 'supportUpdates', label: 'Atualizações de suporte' },
    { key: 'criticalOnly', label: 'Apenas alertas críticos' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">Preferências de Notificação</h2>
        <div className="space-y-3 mb-6">
          {rows.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-sm text-gray-700">{label}</span>
              <input
                type="checkbox"
                checked={!!local[key]}
                onChange={() => toggle(key)}
                className="w-4 h-4 accent-blue-600"
              />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => { onSave(local); onClose() }}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
