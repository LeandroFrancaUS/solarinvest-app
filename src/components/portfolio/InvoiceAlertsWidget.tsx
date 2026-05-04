// src/components/portfolio/InvoiceAlertsWidget.tsx
// Dashboard widget for invoice due date alerts

import React from 'react'
import type { InvoiceNotificationAlert } from '../../types/clientPortfolio'

interface InvoiceAlertsWidgetProps {
  alerts: InvoiceNotificationAlert[]
  onInvoiceClick?: (clientId: number) => void
}

const ALERT_STYLES: Record<string, { bg: string; border: string; icon: string; label: string }> = {
  vencida: { bg: 'rgba(239,68,68,0.08)', border: '#ef4444', icon: '🔴', label: 'Vencida' },
  vence_hoje: { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', icon: '🟡', label: 'Vence Hoje' },
  a_vencer: { bg: 'rgba(59,130,246,0.08)', border: '#3b82f6', icon: '🔵', label: 'A Vencer' },
}

const ALERT_STYLE_DEFAULT: { bg: string; border: string; icon: string; label: string } =
  { bg: 'rgba(59,130,246,0.08)', border: '#3b82f6', icon: '🔵', label: 'A Vencer' }

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string): string {
  const d = new Date(value + 'T00:00:00')
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

export function InvoiceAlertsWidget({ alerts, onInvoiceClick }: InvoiceAlertsWidgetProps) {
  if (alerts.length === 0) {
    return (
      <div
        style={{
          background: 'var(--surface, #1e293b)',
          borderRadius: 10,
          padding: 16,
          border: '1px solid var(--border, #334155)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🧾 Faturas</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)' }}>
          Nenhuma fatura pendente ou em atraso.
        </p>
      </div>
    )
  }

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
        🧾 Faturas ({alerts.length})
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {alerts.map((alert, idx) => {
          const levelStyle = ALERT_STYLES[alert.alertType] ?? ALERT_STYLE_DEFAULT
          const { bg, border, icon, label } = levelStyle
          return (
            <div
              key={`${alert.invoice.id}-${idx}`}
              onClick={() => onInvoiceClick?.(alert.invoice.client_id)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: bg,
                borderLeft: `3px solid ${border}`,
                cursor: onInvoiceClick ? 'pointer' : 'default',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {icon} UC {alert.invoice.uc}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 2 }}>
                  Ref: {formatDate(alert.invoice.reference_month)} · Venc.: {formatDate(alert.invoice.due_date)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{formatCurrency(alert.invoice.amount)}</div>
                <div style={{ fontSize: 10, color: border, fontWeight: 600 }}>{label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
