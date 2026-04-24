import React from 'react'
import type { DashboardAlert } from '../../types/dashboard'

const SEVERITY_STYLES = {
  critical: 'bg-red-50 border-red-400 text-red-800',
  warning: 'bg-yellow-50 border-yellow-400 text-yellow-800',
  info: 'bg-blue-50 border-blue-400 text-blue-800',
}

const SEVERITY_ICONS = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
}

interface AlertsPanelProps {
  alerts: DashboardAlert[]
  onAction?: (alert: DashboardAlert) => void
}

export function AlertsPanel({ alerts, onAction }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <div className="text-center text-gray-400 py-6 text-sm">
        ✅ Nenhum alerta no momento.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`border-l-4 rounded-md px-4 py-3 ${SEVERITY_STYLES[alert.severity]}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <span>{SEVERITY_ICONS[alert.severity]}</span>
              <div>
                <p className="font-semibold text-sm">{alert.title}</p>
                <p className="text-xs mt-0.5">{alert.description}</p>
                <p className="text-xs mt-1 italic opacity-75">{alert.recommendedAction}</p>
              </div>
            </div>
            {onAction && (
              <button
                onClick={() => onAction(alert)}
                className="shrink-0 text-xs font-medium underline hover:no-underline"
              >
                {alert.actionLabel}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
