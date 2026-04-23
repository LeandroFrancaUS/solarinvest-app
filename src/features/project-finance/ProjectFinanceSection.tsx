// src/features/project-finance/ProjectFinanceSection.tsx
// Section component for the Financeiro tab of a project detail page.
// Shows a compact summary and provides an expand/edit toggle.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useProjectFinance } from './useProjectFinance'
import { useVendasConfigStore } from '../../store/useVendasConfigStore'
import { ProjectFinanceSummary } from './ProjectFinanceSummary'
import { ProjectFinanceEditor } from './ProjectFinanceEditor'
import type { ProjectPvData } from '../../domain/projects/types'
import type { ProjectFinanceDeriveParams } from './types'

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
    contractMensalidadeBase,
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

  // Mensalidade source priority for the AF engine derivation:
  //   1. user-typed value already on the form (`form.mensalidade_base`)
  //   2. value passed by the parent (legacy prop, for callers that already
  //      compute it themselves)
  //   3. `client_energy_profile.mensalidade` returned by the server (the value
  //      seeded by the closed-deal pipeline)
  // The third source is what unlocks CAC, impostos and receita_esperada for
  // projects that were created via "Negócio fechado" but whose financial
  // profile has not yet been edited.
  const resolvedMensalidadeBase =
    form.mensalidade_base ?? mensalidadeFromContract ?? contractMensalidadeBase ?? null

  // Build derive params from available project data and vendasConfig AF params.
  // useMemo produces a stable object reference (not recreated every render)
  // so it can safely appear in useEffect dependency arrays.
  //
  // Leasing premise inputs (`reajuste_anual_pct`, `inadimplencia_pct`,
  // `custo_operacional_pct`, `custo_manutencao`) are intentionally OMITTED
  // when the form has no value (vs. sent as `0`) so that
  // `deriveProjectFinanceCosts` can apply its `LEASING_PREMISE_DEFAULTS`
  // (matching the AF screen's 4 / 2 / 3 / 0). Sending `0` would mask the
  // defaults and write zero everywhere on a fresh project — which is exactly
  // the bug the auto-fill buttons exhibited.
  const deriveParams = useMemo(() => {
    const base: ProjectFinanceDeriveParams = {
      consumo_kwh_mes: pvData?.consumo_kwh_mes ?? null,
      potencia_sistema_kwp: pvData?.potencia_sistema_kwp ?? null,
      uf: stateUf,
      mensalidade_base: resolvedMensalidadeBase,
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
      receita_esperada: form.receita_esperada ?? null,
      // impostos_leasing_percent and impostos_venda_percent use their own defaults (4% / 6%)
      // as these are not stored in vendasConfig but handled per-contract in the AF screen.
    }
    if (form.reajuste_anual_pct != null) base.reajuste_anual_pct = form.reajuste_anual_pct
    if (form.inadimplencia_pct != null) base.inadimplencia_pct = form.inadimplencia_pct
    if (form.opex_pct != null) base.custo_operacional_pct = form.opex_pct
    if (form.custo_manutencao != null) base.custo_manutencao = form.custo_manutencao
    return base
  }, [
    pvData,
    stateUf,
    resolvedMensalidadeBase,
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

  // When the profile loads as empty AND we have any pvData OR a contract
  // mensalidade to drive a cascade, auto-derive costs once. The "or
  // mensalidade" branch covers leasing projects where the closed-deal pipeline
  // has seeded `client_energy_profile.mensalidade` but no pvData yet exists.
  useEffect(() => {
    if (
      !isLoading &&
      profile === null &&
      (pvData?.consumo_kwh_mes != null || resolvedMensalidadeBase != null)
    ) {
      deriveFromEngine(deriveParams, false)
    }
  }, [isLoading, profile, pvData, resolvedMensalidadeBase, deriveFromEngine, deriveParams])

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
  const canDerive = Boolean(
    pvData?.consumo_kwh_mes ||
      pvData?.potencia_sistema_kwp ||
      resolvedMensalidadeBase ||
      // Fall back to leasing-only premise defaults (impostos / inadimp / opex /
      // reajuste), which the engine can always emit even with no pvData.
      contractType === 'leasing',
  )

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
