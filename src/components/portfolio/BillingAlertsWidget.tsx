// src/components/portfolio/BillingAlertsWidget.tsx
// Dashboard widget that shows billing alerts (a vencer, vencendo hoje, vencida).

import React from 'react'
import type { BillingAlertLevel } from '../../domain/billing/monthlyEngine'

export interface BillingAlertItem {
  clientId: number
  clientName: string
  level: BillingAlertLevel
  dueDate: string
  amount: number
  installmentNumber: number
}

interface BillingAlertsWidgetProps {
  alerts: BillingAlertItem[]
  onClientClick?: (clientId: number) => void
}

const LEVEL_STYLES: Record<string, { bg: string; border: string; icon: string; label: string }> = {
  vencida: { bg: 'rgba(239,68,68,0.08)', border: '#ef4444', icon: '🔴', label: 'Vencida' },
  vence_hoje: { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', icon: '🟡', label: 'Vence Hoje' },
  a_vencer: { bg: 'rgba(59,130,246,0.08)', border: '#3b82f6', icon: '🔵', label: 'A Vencer' },
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatDate(value: string): string {
  const d = new Date(value)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

export function BillingAlertsWidget({ alerts, onClientClick }: BillingAlertsWidgetProps) {
  const actionableAlerts = alerts.filter(
    (a) => a.level === 'vencida' || a.level === 'vence_hoje' || a.level === 'a_vencer',
  )

  if (actionableAlerts.length === 0) {
    return (
      <div
        style={{
          background: 'var(--surface, #1e293b)',
          borderRadius: 10,
          padding: 16,
          border: '1px solid var(--border, #334155)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>💰 Cobranças</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)' }}>
          Nenhuma cobrança pendente ou em atraso.
        </p>
      </div>
    )
  }

  // Sort: vencida first, then vence_hoje, then a_vencer
  const priority: Record<string, number> = { vencida: 0, vence_hoje: 1, a_vencer: 2 }
  const sorted = [...actionableAlerts].sort(
    (a, b) => (priority[a.level] ?? 9) - (priority[b.level] ?? 9),
  )

  return (
    <div
      style={{
        background: 'var(--surface, #1e293b)',
        borderRadius: 10,
        padding: 16,
        border: '1px solid var(--border, #334155)',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
        💰 Cobranças ({actionableAlerts.length})
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {sorted.map((alert, idx) => {
          const levelStyle = LEVEL_STYLES[alert.level]
          const bg = levelStyle?.bg ?? 'rgba(59,130,246,0.08)'
          const border = levelStyle?.border ?? '#3b82f6'
          const icon = levelStyle?.icon ?? '🔵'
          const label = levelStyle?.label ?? ''
          return (
            <div
              key={`${alert.clientId}-${alert.installmentNumber}-${idx}`}
              onClick={() => onClientClick?.(alert.clientId)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: bg,
                borderLeft: `3px solid ${border}`,
                cursor: onClientClick ? 'pointer' : 'default',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {icon} {alert.clientName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 2 }}>
                  Parcela #{alert.installmentNumber} · Venc.: {formatDate(alert.dueDate)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{formatCurrency(alert.amount)}</div>
                <div style={{ fontSize: 10, color: border, fontWeight: 600 }}>{label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
