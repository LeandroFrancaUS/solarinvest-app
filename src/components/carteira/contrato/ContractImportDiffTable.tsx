import React from 'react'
import type { ContractImportComparisonItem } from '../../../lib/contracts/contractImport/types'

export function ContractImportDiffTable({
  comparisons,
  approvedCodes,
  onToggleApprove,
}: {
  comparisons: ContractImportComparisonItem[]
  approvedCodes: Set<string>
  onToggleApprove: (code: string) => void
}) {
  const formatValue = (value: unknown): string => {
    if (value == null) return '—'
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    return JSON.stringify(value)
  }

  if (comparisons.length === 0) return <p style={{ fontSize: 12, color: '#0f172a', marginTop: 8 }}>Sem comparações detectadas.</p>

  const statusConfig = {
    green: { badge: '✅', color: '#15803d', label: 'Sem base anterior (ok)' },
    yellow: { badge: '🟡', color: '#a16207', label: 'Igual ao existente' },
    red: { badge: '🔴', color: '#b91c1c', label: 'Divergente (aprovação manual)' },
  } as const

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
      {comparisons.map((item) => {
        const config = statusConfig[item.status]
        return (
          <div key={item.code} style={{ border: '1px solid #cbd5e1', background: '#ffffff', borderRadius: 8, padding: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#0f172a' }}>
              <span>{config.badge}</span>
              <span>{item.label}</span>
            </div>
            <div style={{ fontSize: 12, color: '#334155' }}>Atual: {formatValue(item.currentValue)}</div>
            <div style={{ fontSize: 12, color: '#334155' }}>Importado: {formatValue(item.importedValue)}</div>
            <div style={{ fontSize: 11, color: config.color }}>
              {config.label}
            </div>
            {item.requiresManualApproval && (
              <label style={{ fontSize: 12, color: '#0f172a' }}>
                <input
                  type="checkbox"
                  checked={approvedCodes.has(item.code)}
                  onChange={() => onToggleApprove(item.code)}
                  style={{ marginRight: 6, width: 14, height: 14, accentColor: '#2563eb' }}
                />
                Aprovar divergência manualmente
              </label>
            )}
          </div>
        )
      })}
    </div>
  )
}
