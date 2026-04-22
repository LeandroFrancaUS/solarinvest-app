// src/features/project-finance/ProjectFinanceSection.tsx
// Section component for the Financeiro tab of a project detail page.
// Shows a compact summary and provides an expand/edit toggle.

import React, { useCallback, useState } from 'react'
import { useProjectFinance } from './useProjectFinance'
import { ProjectFinanceSummary } from './ProjectFinanceSummary'
import { ProjectFinanceEditor } from './ProjectFinanceEditor'
import type { ProjectPvData } from '../../domain/projects/types'

interface Props {
  projectId: string
  /**
   * PV system data from the Usina Fotovoltaica section.
   * Used as source-of-truth for consumo, potência, geração (readonly in finance).
   */
  pvData?: ProjectPvData | null
}

export function ProjectFinanceSection({ projectId, pvData = null }: Props) {
  const {
    profile,
    form,
    contractType,
    contractTermMonths,
    calculated,
    effective,
    overrides,
    summary,
    technicalParams,
    isLoading,
    isSaving,
    isDirty,
    error,
    setField,
    setTechnicalParam,
    setOverride,
    restoreAuto,
    restoreAll,
    save,
    reset,
  } = useProjectFinance(projectId, pvData)

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

  const handleSave = useCallback(() => {
    save().then(() => {
      setSaveSuccess(true)
      setIsExpanded(false)
    }).catch(() => {
      // error is surfaced in the editor footer
    })
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
        {error && !isExpanded ? (
          <div className="fm-error-banner fm-error-banner--inline" role="alert" style={{ marginBottom: 12 }}>
            ⚠️ {error}
          </div>
        ) : null}

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

        {isExpanded ? (
          <ProjectFinanceEditor
            form={form}
            contractType={contractType}
            contractTermMonths={contractTermMonths}
            pvData={pvData}
            calculated={calculated}
            effective={effective}
            overrides={overrides}
            technicalParams={technicalParams}
            isSaving={isSaving}
            isDirty={isDirty}
            error={error}
            setField={setField}
            setTechnicalParam={setTechnicalParam}
            setOverride={setOverride}
            restoreAuto={restoreAuto}
            restoreAll={restoreAll}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : null}
      </div>
    </div>
  )
}
