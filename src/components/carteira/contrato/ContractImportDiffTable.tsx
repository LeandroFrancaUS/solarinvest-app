import React from 'react'
import type { ContractImportDiscrepancy } from '../../../lib/contracts/contractImport/types'

export function ContractImportDiffTable({
  discrepancies,
  approvedCodes,
  onToggleApprove,
}: {
  discrepancies: ContractImportDiscrepancy[]
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

  if (discrepancies.length === 0) return <p style={{ fontSize: 12 }}>Sem divergências detectadas.</p>

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {discrepancies.map((diff) => (
        <div key={`${diff.field}-${String(diff.currentValue)}`} style={{ border: '1px solid #334155', borderRadius: 8, padding: 8 }}>
          <div style={{ fontWeight: 600 }}>{diff.label}</div>
          <div style={{ fontSize: 12 }}>Atual: {formatValue(diff.currentValue)}</div>
          <div style={{ fontSize: 12 }}>Importado: {formatValue(diff.importedValue)}</div>
          <div style={{ fontSize: 11, color: diff.severity === 'blocking' ? '#f97316' : '#facc15' }}>
            {diff.severity === 'blocking' ? 'Bloqueante' : 'Aviso'}
          </div>
          {diff.code && (
            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={approvedCodes.has(diff.code)}
                onChange={() => onToggleApprove(diff.code!)}
                style={{ marginRight: 6 }}
              />
              Aprovar discrepância manualmente
            </label>
          )}
        </div>
      ))}
    </div>
  )
}
