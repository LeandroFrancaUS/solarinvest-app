// src/features/project-finance/ProjectFinanceSection.tsx
// Section component for the Financeiro tab of a project detail page.
// Shows a compact summary and provides an expand/edit toggle.

import React, { useCallback, useEffect, useState } from 'react'
import { useProjectFinance } from './useProjectFinance'
import { useVendasConfigStore } from '../../store/useVendasConfigStore'
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
  /**
   * State abbreviation from the project (e.g. 'DF', 'GO', 'SP').
   * Used to resolve CREA cost when auto-deriving costs from the AF engine.
   */
  stateUf?: string | null
  /**
   * Leasing base monthly fee from the client's contract.
   * When provided, it is used to auto-derive the CAC (comissão) field for leasing.
   */
  mensalidadeFromContract?: number | null
}

export function ProjectFinanceSection({
  projectId,
  pvData = null,
  stateUf = null,
  mensalidadeFromContract = null,
}: Props) {
  const vendasConfig = useVendasConfigStore((s) => s.config)

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
    deriveFromEngine,
  } = useProjectFinance(projectId, pvData)

  const [isExpanded, setIsExpanded] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Build derive params from available project data and vendasConfig AF params.
  const buildDeriveParams = useCallback(() => ({
    consumo_kwh_mes: pvData?.consumo_kwh_mes ?? null,
    potencia_sistema_kwp: pvData?.potencia_sistema_kwp ?? null,
    uf: stateUf,
    mensalidade_base: mensalidadeFromContract,
    prazo_meses: contractTermMonths,
    crea_go_rs: vendasConfig.af_crea_go_rs,
    crea_df_rs: vendasConfig.af_crea_df_rs,
    projeto_faixas: vendasConfig.af_projeto_faixas,
    seguro_limiar_rs: vendasConfig.af_seguro_limiar_rs,
    seguro_faixa_baixa_percent: vendasConfig.af_seguro_faixa_baixa_percent,
    seguro_faixa_alta_percent: vendasConfig.af_seguro_faixa_alta_percent,
    seguro_piso_rs: vendasConfig.af_seguro_piso_rs,
    comissao_minima_percent: vendasConfig.af_comissao_minima_percent,
    // impostos_leasing_percent and impostos_venda_percent use their own defaults (4% / 6%)
    // as these are not stored in vendasConfig but handled per-contract in the AF screen.
  }), [pvData, stateUf, mensalidadeFromContract, contractTermMonths, vendasConfig])

  // When the profile loads as empty AND pvData is available, auto-derive costs.
  useEffect(() => {
    if (!isLoading && profile === null && pvData?.consumo_kwh_mes) {
      deriveFromEngine(buildDeriveParams(), false)
    }
  }, [isLoading, profile, pvData, deriveFromEngine, buildDeriveParams])

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

  const handleDeriveFromEngine = useCallback((force: boolean) => {
    deriveFromEngine(buildDeriveParams(), force)
  }, [deriveFromEngine, buildDeriveParams])

  const contractLabel = contractType === 'leasing' ? 'Leasing' : 'Venda'
  const hasProfile = profile !== null
  const canDerive = Boolean(pvData?.consumo_kwh_mes || pvData?.potencia_sistema_kwp)

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
            canDeriveFromEngine={canDerive}
            setField={setField}
            setTechnicalParam={setTechnicalParam}
            setOverride={setOverride}
            restoreAuto={restoreAuto}
            restoreAll={restoreAll}
            onSave={handleSave}
            onCancel={handleCancel}
            onDeriveFromEngine={handleDeriveFromEngine}
          />
        ) : null}
      </div>
    </div>
  )
}
