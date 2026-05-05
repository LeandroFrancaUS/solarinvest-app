/**
 * useTusdState.ts
 *
 * Owns all TUSD/ANEEL parameter state, the simultaneidade auto-resolver, and
 * the internal effect that applies the default simultaneidade when the TUSD
 * options panel is opened.
 *
 * Params:
 *   - applyVendaUpdatesRef — late-bound ref pointing to applyVendaUpdates
 *     (defined later in App.tsx; assigned right after useLeasingSimulacaoState).
 *     Using a ref breaks the TDZ cycle: the hook is called before
 *     applyVendaUpdates exists, but effects only run after the full render
 *     cycle during which App.tsx assigns the ref.
 *
 * Returns every TUSD state variable, its setter, resolveDefaultTusdSimultaneidade,
 * and setTusdSimultaneidadeFromSource.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_TUSD_ANO_REFERENCIA } from '../../lib/finance/tusd'
import type { TipoClienteTUSD } from '../../lib/finance/tusd'
import type { VendaForm } from '../../lib/finance/roi'
import { normalizeTusdTipoClienteValue } from '../../features/propostas/proposalHelpers'
import { INITIAL_VALUES } from '../../app/config'

// Minimal type for the subset of VendaForm updates used here.
type TusdVendaUpdates = { tusd_simultaneidade?: number | undefined }

// Late-bound callback reference type accepted by this hook.
export type ApplyVendaUpdatesFn = (updates: Partial<VendaForm>) => void

export interface UseTusdStateParams {
  applyVendaUpdatesRef: React.RefObject<ApplyVendaUpdatesFn | null>
}

export function useTusdState({ applyVendaUpdatesRef }: UseTusdStateParams) {
  const [tusdPercent, setTusdPercent] = useState(INITIAL_VALUES.tusdPercent)
  const [tusdTipoCliente, setTusdTipoCliente] = useState<TipoClienteTUSD>(() =>
    normalizeTusdTipoClienteValue(INITIAL_VALUES.tusdTipoCliente),
  )
  const [tusdSubtipo, setTusdSubtipo] = useState(INITIAL_VALUES.tusdSubtipo)
  const [tusdSimultaneidade, setTusdSimultaneidade] = useState<number | null>(
    INITIAL_VALUES.tusdSimultaneidade,
  )
  const [tusdSimultaneidadeManualOverride, setTusdSimultaneidadeManualOverride] =
    useState(false)
  const [tusdTarifaRkwh, setTusdTarifaRkwh] = useState<number | null>(
    INITIAL_VALUES.tusdTarifaRkwh,
  )
  const [tusdAnoReferencia, setTusdAnoReferencia] = useState(
    INITIAL_VALUES.tusdAnoReferencia ?? DEFAULT_TUSD_ANO_REFERENCIA,
  )
  const [tusdOpcoesExpandidas, setTusdOpcoesExpandidas] = useState(false)

  // Keep a stable ref to current tusdSimultaneidade for use in callbacks
  const tusdSimultaneidadeRef = useRef(tusdSimultaneidade)
  tusdSimultaneidadeRef.current = tusdSimultaneidade

  // -------------------------------------------------------------------------
  // Pure helper — no external deps
  // -------------------------------------------------------------------------
  const resolveDefaultTusdSimultaneidade = useCallback(
    (tipo: TipoClienteTUSD): number | null => {
      if (tipo === 'residencial') return 70
      if (tipo === 'comercial') return 80
      return null
    },
    [],
  )

  // -------------------------------------------------------------------------
  // Setter that coalesces simultaneidade + manual-override flag + venda form
  // Reads applyVendaUpdatesRef.current at call-time to break TDZ.
  // -------------------------------------------------------------------------
  const setTusdSimultaneidadeFromSource = useCallback(
    (value: number | null, source: 'auto' | 'manual') => {
      const isManual = source === 'manual'
      const current = tusdSimultaneidadeRef.current
      if (current === value) {
        setTusdSimultaneidadeManualOverride(isManual)
        return
      }
      setTusdSimultaneidade(value)
      setTusdSimultaneidadeManualOverride(isManual)
      const updates: TusdVendaUpdates =
        value == null ? { tusd_simultaneidade: undefined } : { tusd_simultaneidade: value }
      applyVendaUpdatesRef.current?.(updates as Partial<VendaForm>)
    },
    // applyVendaUpdatesRef is stable (same object reference), tusdSimultaneidadeRef is a ref
    [applyVendaUpdatesRef],
  )

  // -------------------------------------------------------------------------
  // Effect: auto-apply default simultaneidade when TUSD panel opens
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!tusdOpcoesExpandidas) {
      if (tusdSimultaneidadeManualOverride) {
        setTusdSimultaneidadeManualOverride(false)
      }
      return
    }
    if (tusdSimultaneidadeManualOverride) {
      return
    }
    const defaultSimultaneidade = resolveDefaultTusdSimultaneidade(tusdTipoCliente)
    setTusdSimultaneidadeFromSource(defaultSimultaneidade, 'auto')
  }, [
    resolveDefaultTusdSimultaneidade,
    setTusdSimultaneidadeFromSource,
    tusdOpcoesExpandidas,
    tusdSimultaneidadeManualOverride,
    tusdTipoCliente,
  ])

  return {
    tusdPercent,
    setTusdPercent,
    tusdTipoCliente,
    setTusdTipoCliente,
    tusdSubtipo,
    setTusdSubtipo,
    tusdSimultaneidade,
    setTusdSimultaneidade,
    tusdSimultaneidadeManualOverride,
    setTusdSimultaneidadeManualOverride,
    tusdTarifaRkwh,
    setTusdTarifaRkwh,
    tusdAnoReferencia,
    setTusdAnoReferencia,
    tusdOpcoesExpandidas,
    setTusdOpcoesExpandidas,
    resolveDefaultTusdSimultaneidade,
    setTusdSimultaneidadeFromSource,
  }
}
