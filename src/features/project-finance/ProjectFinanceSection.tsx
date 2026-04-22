// src/features/project-finance/ProjectFinanceSection.tsx
// Section component for the Financeiro tab of a project detail page.
// Shows a compact summary and provides an expand/edit toggle.

import React, { useCallback, useState } from 'react'
import { useProjectFinance } from './useProjectFinance'
import { ProjectFinanceSummary } from './ProjectFinanceSummary'
import { ProjectFinanceEditor } from './ProjectFinanceEditor'

interface Props {
  projectId: string
  /** A label showing the resolved contract type from parent (used for badge) */
  contractTypeHint?: 'leasing' | 'venda'
}

export function ProjectFinanceSection({ projectId }: Props) {
  const {
    profile,
    form,
    contractType,
    summary,
    isLoading,
    isSaving,
    isDirty,
    error,
    setField,
    save,
    reset,
  } = useProjectFinance(projectId)

  const [isExpanded, setIsExpanded] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleEdit = useCallback(() => {
    setIsExpanded(true)
    setSaveSuccess(false)
  }, [])

  const handleCancel = useCallback(() => {
    if (isDirty) {
      if (!window.confirm('Há alterações não salvas. Deseja descartar?')) return
    }
    reset()
    setIsExpanded(false)
  }, [isDirty, reset])

  const handleSave = useCallback(async () => {
    try {
      await save()
      setSaveSuccess(true)
      setIsExpanded(false)
    } catch {
      // error is surfaced in the editor footer
    }
  }, [save])

  const contractLabel = contractType === 'leasing' ? 'Leasing' : 'Venda'
  const hasProfile = profile !== null

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading && !profile) {
    return (
      <div className="fm-project-section">
        <div className="fm-project-section-header">
          <span className="fm-project-section-icon" aria-hidden="true">💰</span>
          <h2 className="fm-project-section-title">Financeiro</h2>
        </div>
        <div className="fm-project-section-body">
          <div className="fm-loading">
            <span className="fm-loading-spinner fm-loading-spinner--sm" aria-hidden="true" />
            Carregando…
          </div>
        </div>
      </div>
    )
  }

  // ── Action button ──────────────────────────────────────────────────────────
  const actionButton = !isExpanded ? (
    <button
      type="button"
      className="ghost"
      onClick={handleEdit}
      style={{ fontSize: 13, padding: '4px 10px' }}
    >
      ✏️ {hasProfile ? 'Editar' : 'Preencher'}
    </button>
  ) : null

  return (
    <div className="fm-project-section">
      <div className="fm-project-section-header">
        <span className="fm-project-section-icon" aria-hidden="true">💰</span>
        <h2 className="fm-project-section-title">Financeiro</h2>
        <span
          className={`fm-badge fm-badge--${contractType}`}
          style={{ marginLeft: 8, fontSize: 11 }}
        >
          {contractLabel}
        </span>
        {saveSuccess ? (
          <span style={{ fontSize: 12, color: 'var(--ds-success, #22c55e)', marginLeft: 8 }}>
            ✓ Salvo
          </span>
        ) : null}
        {actionButton ? (
          <div className="fm-project-section-action">{actionButton}</div>
        ) : null}
      </div>

      <div className="fm-project-section-body">
        {/* Error banner (loading error) */}
        {error && !isExpanded ? (
          <div className="fm-error-banner fm-error-banner--inline" role="alert" style={{ marginBottom: 12 }}>
            ⚠️ {error}
          </div>
        ) : null}

        {/* Collapsed summary */}
        {!isExpanded ? (
          hasProfile ? (
            <ProjectFinanceSummary summary={summary} />
          ) : (
            <div className="fm-project-section-placeholder">
              <p>
                Nenhum dado financeiro registrado. Clique em{' '}
                <strong>Preencher</strong> para adicionar os custos e receitas do projeto.
              </p>
            </div>
          )
        ) : null}

        {/* Expanded editor */}
        {isExpanded ? (
          <ProjectFinanceEditor
            form={form}
            contractType={contractType}
            isSaving={isSaving}
            isDirty={isDirty}
            error={error}
            setField={setField}
            onSave={() => { void handleSave() }}
            onCancel={handleCancel}
          />
        ) : null}
      </div>
    </div>
  )
}
