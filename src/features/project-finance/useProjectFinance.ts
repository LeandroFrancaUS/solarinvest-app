// src/features/project-finance/useProjectFinance.ts
// React hook for loading, editing and saving project financial profiles.
// Implements:
//   - Auto-compute KPIs using the same engine as Análise Financeira
//     (computeIRR, computeNPV, computePayback) whenever form inputs change
//   - Override mechanism: manual values persist through recalculations
//   - Readonly contract term: sourced from client_contracts
//   - System sizing values (consumo, potência, geração) come from pvData
//     (Usina Fotovoltaica) — NOT from the financial form

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchProjectFinance, saveProjectFinance } from './api'
import { computeSummaryKPIs, computeProjectFinancialState, deriveProjectFinanceCosts } from './calculations'
import type {
  ProjectFinanceProfile,
  ProjectFinanceFormState,
  ProjectFinanceContractType,
  ProjectFinanceSummaryKPIs,
  ProjectFinanceComputed,
  ProjectFinanceOverrides,
  OverridableField,
  ProjectFinanceTechnicalParams,
  ProjectFinanceDeriveParams,
} from './types'
import type { ProjectPvData } from '../../domain/projects/types'

// Build a form state from a profile row (or empty defaults)
function profileToFormState(profile: ProjectFinanceProfile | null): ProjectFinanceFormState {
  if (!profile) return {}
  const out: ProjectFinanceFormState = {
    contract_type: profile.contract_type,
    status: profile.status,
    snapshot_source: profile.snapshot_source,
  }
  if (profile.client_id != null) out.client_id = profile.client_id
  if (profile.prazo_contratual_meses != null) out.prazo_contratual_meses = profile.prazo_contratual_meses
  if (profile.custo_equipamentos != null) out.custo_equipamentos = profile.custo_equipamentos
  if (profile.custo_instalacao != null) out.custo_instalacao = profile.custo_instalacao
  if (profile.custo_engenharia != null) out.custo_engenharia = profile.custo_engenharia
  if (profile.custo_homologacao != null) out.custo_homologacao = profile.custo_homologacao
  if (profile.custo_frete_logistica != null) out.custo_frete_logistica = profile.custo_frete_logistica
  if (profile.custo_comissao != null) out.custo_comissao = profile.custo_comissao
  if (profile.custo_impostos != null) out.custo_impostos = profile.custo_impostos
  if (profile.custo_diversos != null) out.custo_diversos = profile.custo_diversos
  if (profile.receita_esperada != null) out.receita_esperada = profile.receita_esperada
  if (profile.mensalidade_base != null) out.mensalidade_base = profile.mensalidade_base
  if (profile.desconto_percentual != null) out.desconto_percentual = profile.desconto_percentual
  if (profile.reajuste_anual_pct != null) out.reajuste_anual_pct = profile.reajuste_anual_pct
  if (profile.inadimplencia_pct != null) out.inadimplencia_pct = profile.inadimplencia_pct
  if (profile.opex_pct != null) out.opex_pct = profile.opex_pct
  if (profile.custo_seguro != null) out.custo_seguro = profile.custo_seguro
  if (profile.custo_manutencao != null) out.custo_manutencao = profile.custo_manutencao
  if (profile.valor_venda != null) out.valor_venda = profile.valor_venda
  if (profile.entrada_pct != null) out.entrada_pct = profile.entrada_pct
  if (profile.parcelamento_meses != null) out.parcelamento_meses = profile.parcelamento_meses
  if (profile.custo_financeiro_pct != null) out.custo_financeiro_pct = profile.custo_financeiro_pct
  if (profile.notas != null) out.notas = profile.notas
  return out
}

interface UseProjectFinanceReturn {
  profile: ProjectFinanceProfile | null
  form: ProjectFinanceFormState
  contractType: ProjectFinanceContractType
  /** Contract term in months from client_contracts. Readonly. */
  contractTermMonths: number | null
  calculated: ProjectFinanceComputed
  effective: ProjectFinanceComputed
  overrides: ProjectFinanceOverrides
  summary: ProjectFinanceSummaryKPIs
  technicalParams: ProjectFinanceTechnicalParams
  isLoading: boolean
  isSaving: boolean
  isDirty: boolean
  error: string | null
  load: () => Promise<void>
  setField: <K extends keyof ProjectFinanceFormState>(key: K, value: ProjectFinanceFormState[K]) => void
  setTechnicalParam: <K extends keyof ProjectFinanceTechnicalParams>(key: K, value: ProjectFinanceTechnicalParams[K]) => void
  setOverride: (field: OverridableField, value: number) => void
  restoreAuto: (field: OverridableField) => void
  restoreAll: () => void
  save: () => Promise<void>
  reset: () => void
  /**
   * Pre-fills cost fields using the AF engine given pvData + optional params.
   * By default, only fills NULL fields (force=false); pass force=true to
   * overwrite existing values with engine-derived ones.
   */
  deriveFromEngine: (deriveParams: ProjectFinanceDeriveParams, force?: boolean) => void
}

export function useProjectFinance(
  projectId: string,
  pvData: ProjectPvData | null = null,
): UseProjectFinanceReturn {
  const [profile, setProfile] = useState<ProjectFinanceProfile | null>(null)
  const [contractType, setContractType] = useState<ProjectFinanceContractType>('leasing')
  const [contractTermMonths, setContractTermMonths] = useState<number | null>(null)
  const [form, setForm] = useState<ProjectFinanceFormState>({})
  const [savedForm, setSavedForm] = useState<ProjectFinanceFormState>({})
  const [overrides, setOverrides] = useState<ProjectFinanceOverrides>({})
  const [savedOverrides, setSavedOverrides] = useState<ProjectFinanceOverrides>({})
  const [technicalParams, setTechnicalParams] = useState<ProjectFinanceTechnicalParams | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty =
    JSON.stringify(form) !== JSON.stringify(savedForm) ||
    JSON.stringify(overrides) !== JSON.stringify(savedOverrides)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetchProjectFinance(projectId)
      setContractType(res.contract_type)
      setContractTermMonths(res.contract_term_months ?? null)
      setProfile(res.profile)
      const fs = profileToFormState(res.profile)
      setForm(fs)
      setSavedForm(fs)
      const ov: ProjectFinanceOverrides = res.profile?.override_payload_json ?? {}
      setOverrides(ov)
      setSavedOverrides(ov)
      const tp: ProjectFinanceTechnicalParams | undefined = res.profile?.technical_params_json ?? undefined
      setTechnicalParams(tp)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar financeiro.')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  // Auto-compute KPIs using the shared engine (same as Análise Financeira).
  // System sizing values come from pvData (Usina Fotovoltaica), not the form.
  const { calculated, effective } = useMemo(() => {
    const termMonths = contractTermMonths ?? (form.prazo_contratual_meses ?? 0)
    return computeProjectFinancialState(form, contractType, termMonths, pvData, overrides, technicalParams)
  }, [form, contractType, contractTermMonths, pvData, overrides, technicalParams])

  const setField = useCallback(
    <K extends keyof ProjectFinanceFormState>(key: K, value: ProjectFinanceFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const setTechnicalParam = useCallback(
    <K extends keyof ProjectFinanceTechnicalParams>(key: K, value: ProjectFinanceTechnicalParams[K]) => {
      setTechnicalParams((prev) => ({ ...(prev ?? {}), [key]: value }))
    },
    [],
  )

  const setOverride = useCallback((field: OverridableField, value: number) => {
    setOverrides((prev) => ({ ...prev, [field]: value }))
  }, [])

  const restoreAuto = useCallback((field: OverridableField) => {
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const restoreAll = useCallback(() => {
    setOverrides({})
  }, [])

  const save = useCallback(async () => {
    setIsSaving(true)
    setError(null)
    try {
      const termMonths = contractTermMonths ?? (form.prazo_contratual_meses ?? 0)
      // Build save payload — use null (not undefined) for computed KPI fields
      // because ProjectFinanceFormState uses exactOptionalPropertyTypes.
      const kpiOverlay: Partial<ProjectFinanceFormState> = {}
      if (effective.payback_meses != null) kpiOverlay.payback_meses = effective.payback_meses
      if (effective.roi_pct != null) kpiOverlay.roi_pct = effective.roi_pct
      if (effective.tir_pct != null) kpiOverlay.tir_pct = effective.tir_pct
      if (effective.vpl != null) kpiOverlay.vpl = effective.vpl

      // Build save payload — cast to avoid exactOptionalPropertyTypes friction with spread.
      // The underlying shape is correct; TypeScript's strict mode false-positives on spreading
      // Partial types.
      const payload = {
        ...form,
        ...kpiOverlay,
        contract_type: contractType,
        // prazo_contratual_meses mirrors from contract (readonly)
        prazo_contratual_meses: termMonths > 0 ? termMonths : form.prazo_contratual_meses,
        // Persist overrides and technical params
        override_payload_json: Object.keys(overrides).length > 0 ? overrides : null,
        technical_params_json: technicalParams ?? null,
      } as ProjectFinanceFormState
      const saved = await saveProjectFinance(projectId, payload)
      setProfile(saved)
      const fs = profileToFormState(saved)
      setForm(fs)
      setSavedForm(fs)
      const ov: ProjectFinanceOverrides = saved.override_payload_json ?? {}
      setOverrides(ov)
      setSavedOverrides(ov)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar financeiro.')
      throw err
    } finally {
      setIsSaving(false)
    }
  }, [projectId, form, contractType, contractTermMonths, overrides, effective, technicalParams])

  const reset = useCallback(() => {
    setForm(savedForm)
    setOverrides(savedOverrides)
    setError(null)
  }, [savedForm, savedOverrides])

  /**
   * Derives cost fields from the AF engine and merges them into the form.
   * Only NULL form fields are filled when force=false (default).
   * Pass force=true to overwrite existing values with engine-derived ones.
   */
  const deriveFromEngine = useCallback(
    (deriveParams: ProjectFinanceDeriveParams, force = false) => {
      const derived = deriveProjectFinanceCosts(deriveParams, contractType)
      setForm((prev) => {
        // Build the next state by assigning only the derived keys.
        // We work with a typed partial and use Object.assign for type safety.
        const patch: ProjectFinanceFormState = {}
        for (const key of Object.keys(derived) as Array<keyof typeof derived>) {
          const v = derived[key]
          if (v !== undefined && (force || prev[key] == null)) {
            // Each key in `derived` is a valid key of ProjectFinanceFormState.
            // Object.assign keeps TypeScript happy without unsafe casts.
            Object.assign(patch, { [key]: v })
          }
        }
        return { ...prev, ...patch }
      })
    },
    [contractType],
  )

  const summaryForm: ProjectFinanceFormState = { ...form }
  if (effective.payback_meses != null) summaryForm.payback_meses = effective.payback_meses
  if (effective.roi_pct != null) summaryForm.roi_pct = effective.roi_pct
  const summary = computeSummaryKPIs(summaryForm, contractType, profile?.updated_at)

  return {
    profile,
    form,
    contractType,
    contractTermMonths,
    calculated,
    effective,
    overrides,
    summary,
    technicalParams: technicalParams ?? {},
    isLoading,
    isSaving,
    isDirty,
    error,
    load,
    setField,
    setTechnicalParam,
    setOverride,
    restoreAuto,
    restoreAll,
    save,
    reset,
    deriveFromEngine,
  }
}

