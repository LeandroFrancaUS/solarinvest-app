/**
 * Flow V8 - Summary Sidebar Component
 * Shows KPIs, checklist (no CTA button - moved to Revisão step)
 */

import React from 'react'
import type { StepIndex } from './validation.v8'

export interface KPI {
  label: string
  value: string
  fallback?: string
}

export interface ChecklistItem {
  label: string
  completed: boolean
  step: StepIndex
  field: string
}

export interface SummarySidebarV8Props {
  kpis: KPI[]
  checklist: ChecklistItem[]
  showManualBadge: boolean
  manualBadgeReason?: string
  onChecklistItemClick: (item: ChecklistItem) => void
}

export function SummarySidebarV8({
  kpis,
  checklist,
  showManualBadge,
  manualBadgeReason,
  onChecklistItemClick,
}: SummarySidebarV8Props): JSX.Element {
  return (
    <aside className="v8-sidebar">
      {/* KPIs Section */}
      <div className="v8-sidebar-section">
        <h3 className="v8-sidebar-heading">Resumo</h3>
        <div className="v8-kpi-list">
          {kpis.map((kpi, index) => (
            <div key={index} className="v8-kpi">
              <span className="v8-kpi-label">{kpi.label}</span>
              <span className="v8-kpi-value">{kpi.value || kpi.fallback || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Manual Badge Section */}
      {showManualBadge && (
        <div className="v8-sidebar-section">
          <div className="v8-alert warning">
            <div>
              <strong>⚠️ Orçamento Manual</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                {manualBudgetReason || 'Este tipo de instalação/sistema requer orçamento manual.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Section */}
      {checklist.length > 0 && (
        <div className="v8-sidebar-section">
          <h3 className="v8-sidebar-heading">Pendências</h3>
          <ul className="v8-checklist">
            {checklist.map((item, index) => (
              <li
                key={index}
                className={`v8-checklist-item${item.completed ? ' completed' : ''}`}
                onClick={() => !item.completed && onChecklistItemClick(item)}
                role="button"
                tabIndex={item.completed ? -1 : 0}
                onKeyDown={(e) => {
                  if (!item.completed && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onChecklistItemClick(item)
                  }
                }}
              >
                <span className="v8-checklist-icon" aria-hidden="true">
                  {item.completed ? '✓' : '○'}
                </span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Note: "Gerar Proposta" button removed from sidebar */}
      {/* It will only appear in the final "Revisão" step */}
    </aside>
  )
}
