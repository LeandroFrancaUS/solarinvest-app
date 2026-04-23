// src/features/project-finance/ProjectFinanceSection.tsx
// Section component for the Financeiro tab of a project detail page.
// Shows a compact summary and provides an expand/edit toggle.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
    financeHeader,
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
  // useMemo produces a stable object reference (not recreated every render)
  // so it can safely appear in useEffect dependency arrays.
  const deriveParams = useMemo(() => ({
    consumo_kwh_mes: pvData?.consumo_kwh_mes ?? null,
    potencia_sistema_kwp: pvData?.potencia_sistema_kwp ?? null,
    numero_modulos: pvData?.numero_modulos ?? null,
    potencia_modulo_wp: pvData?.potencia_modulo_wp ?? null,
    uf: stateUf,
    mensalidade_base: mensalidadeFromContract ?? financeHeader?.mensalidade_base ?? null,
    desconto_percentual: financeHeader?.desconto_percentual ?? form.desconto_percentual ?? null,
    prazo_meses: contractTermMonths,
    crea_go_rs: vendasConfig.af_crea_go_rs,
    crea_df_rs: vendasConfig.af_crea_df_rs,
    projeto_faixas: vendasConfig.af_projeto_faixas,
    seguro_limiar_rs: vendasConfig.af_seguro_limiar_rs,
    seguro_faixa_baixa_percent: vendasConfig.af_seguro_faixa_baixa_percent,
    seguro_faixa_alta_percent: vendasConfig.af_seguro_faixa_alta_percent,
    seguro_piso_rs: vendasConfig.af_seguro_piso_rs,
    comissao_minima_percent: vendasConfig.af_comissao_minima_percent,
    impostos_percent: technicalParams.impostos_percent ?? (contractType === 'leasing' ? 4 : 6),
    taxa_desconto_aa_pct: technicalParams.taxa_desconto_aa_pct ?? null,
    reajuste_anual_pct: form.reajuste_anual_pct ?? 0,
    inadimplencia_pct: form.inadimplencia_pct ?? 0,
    custo_operacional_pct: form.opex_pct ?? 0,
    custo_manutencao: form.custo_manutencao ?? 0,
    receita_esperada: form.receita_esperada ?? null,
    // impostos_leasing_percent and impostos_venda_percent use their own defaults (4% / 6%)
    // as these are not stored in vendasConfig but handled per-contract in the AF screen.
  }), [
    pvData,
    stateUf,
    mensalidadeFromContract,
    financeHeader?.mensalidade_base,
    financeHeader?.desconto_percentual,
    contractTermMonths,
    vendasConfig,
    technicalParams.impostos_percent,
    technicalParams.taxa_desconto_aa_pct,
    contractType,
    form.reajuste_anual_pct,
    form.inadimplencia_pct,
    form.opex_pct,
    form.custo_manutencao,
    form.receita_esperada,
  ])

  // Always keep null fields hydrated from AF/UFV data.
  // force=false guarantees we only fill empty values and don't override manual edits.
  useEffect(() => {
    if (!isLoading && (pvData?.consumo_kwh_mes || pvData?.potencia_sistema_kwp)) {
      deriveFromEngine(deriveParams, false)
    }
  }, [isLoading, profile, pvData, deriveFromEngine, deriveParams])

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
    deriveFromEngine(deriveParams, force)
  }, [deriveFromEngine, deriveParams])

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
