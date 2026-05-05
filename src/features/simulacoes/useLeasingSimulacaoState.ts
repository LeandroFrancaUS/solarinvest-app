/**
 * useLeasingSimulacaoState.ts
 *
 * Owns the core venda/leasing simulation parameter state:
 *   precoPorKwp, irradiacao, eficiencia, diasMes, inflacaoAa,
 *   vendaForm, vendaFormErrors, retornoProjetado/Status/Error/Tick,
 *   leasingPrazo, and the two fundamental mutators: resetRetorno +
 *   applyVendaUpdates.
 *
 * No external params — all state is self-contained.
 *
 * After calling this hook, App.tsx assigns:
 *   applyVendaUpdatesRef.current = applyVendaUpdates
 * so that useTusdState (called earlier) can use it via its ref.
 */

import { useCallback, useMemo, useState } from 'react'
import { type RetornoProjetado, type VendaForm } from '../../lib/finance/roi'
import { INITIAL_VALUES, createInitialVendaForm, type LeasingPrazoAnos } from '../../app/config'
import { IRRADIACAO_FALLBACK } from '../../utils/irradiacao'

type VendaFormUpdates = { [K in keyof VendaForm]?: VendaForm[K] | undefined }

export function useLeasingSimulacaoState() {
  // ---------------------------------------------------------------------------
  // Simulation parameters
  // ---------------------------------------------------------------------------
  const [leasingPrazo, setLeasingPrazo] = useState<LeasingPrazoAnos>(
    INITIAL_VALUES.leasingPrazo,
  )
  const [precoPorKwp, setPrecoPorKwp] = useState(INITIAL_VALUES.precoPorKwp)
  const [irradiacao, setIrradiacao] = useState(IRRADIACAO_FALLBACK)
  const [eficiencia, setEficiencia] = useState(INITIAL_VALUES.eficiencia)
  const [diasMes, setDiasMes] = useState(INITIAL_VALUES.diasMes)
  const [inflacaoAa, setInflacaoAa] = useState(INITIAL_VALUES.inflacaoAa)

  // ---------------------------------------------------------------------------
  // Venda form state
  // ---------------------------------------------------------------------------
  const [vendaForm, setVendaForm] = useState<VendaForm>(() => createInitialVendaForm())
  const [vendaFormErrors, setVendaFormErrors] = useState<Record<string, string>>({})

  // ---------------------------------------------------------------------------
  // ROI projection state
  // ---------------------------------------------------------------------------
  const [retornoProjetado, setRetornoProjetado] = useState<RetornoProjetado | null>(null)
  const [retornoStatus, setRetornoStatus] = useState<'idle' | 'calculating'>('idle')
  const [retornoError, setRetornoError] = useState<string | null>(null)
  const [recalcularTick, setRecalcularTick] = useState(0)

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const valorTotalPropostaNormalizado = useMemo(
    () =>
      Number.isFinite(vendaForm.capex_total) ? Math.max(0, Number(vendaForm.capex_total)) : 0,
    [vendaForm.capex_total],
  )

  // ---------------------------------------------------------------------------
  // Fundamental mutators
  // ---------------------------------------------------------------------------
  const resetRetorno = useCallback(() => {
    setRetornoProjetado(null)
    setRetornoError(null)
    setRetornoStatus('idle')
  }, [])

  const applyVendaUpdates = useCallback(
    (updates: VendaFormUpdates) => {
      if (!updates || Object.keys(updates).length === 0) {
        return
      }
      setVendaForm((prev) => {
        let changed = false
        const next: VendaForm = { ...prev }
        const nextMutable = next as Record<keyof VendaForm, VendaForm[keyof VendaForm] | undefined>
        Object.entries(updates).forEach(([rawKey, value]) => {
          const key = rawKey as keyof VendaForm
          if (value === undefined) {
            if (next[key] !== undefined) {
              nextMutable[key] = value as VendaForm[typeof key] | undefined
              changed = true
            }
            return
          }
          if (next[key] !== value) {
            nextMutable[key] = value as VendaForm[typeof key]
            changed = true
          }
        })
        return changed ? next : prev
      })
      setVendaFormErrors((prev) => {
        if (!prev || Object.keys(prev).length === 0) {
          return prev
        }
        let changed = false
        const next = { ...prev }
        Object.keys(updates).forEach((key) => {
          if (key in next) {
            delete next[key]
            changed = true
          }
        })
        return changed ? next : prev
      })
      resetRetorno()
    },
    [resetRetorno],
  )

  // Public wrapper so callers can trigger recalculation tick
  const triggerRecalcular = useCallback(() => {
    setRecalcularTick((prev) => prev + 1)
  }, [])

  return {
    leasingPrazo,
    setLeasingPrazo,
    precoPorKwp,
    setPrecoPorKwp,
    irradiacao,
    setIrradiacao,
    eficiencia,
    setEficiencia,
    diasMes,
    setDiasMes,
    inflacaoAa,
    setInflacaoAa,
    vendaForm,
    setVendaForm,
    vendaFormErrors,
    setVendaFormErrors,
    retornoProjetado,
    setRetornoProjetado,
    retornoStatus,
    setRetornoStatus,
    retornoError,
    setRetornoError,
    recalcularTick,
    setRecalcularTick,
    valorTotalPropostaNormalizado,
    resetRetorno,
    applyVendaUpdates,
    triggerRecalcular,
  }
}
