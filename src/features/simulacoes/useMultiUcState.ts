/**
 * useMultiUcState.ts
 *
 * Owns the full multi-UC (MLGD) simulation state:
 *   - raw state: multiUcAtivo, multiUcRows, multiUcRateioModo, …
 *   - derived memos: multiUcReferenciaData, multiUcConsumoTotal, multiUcResultado, …
 *   - internal callbacks: applyTarifasAutomaticas, all handleMultiUc* mutators,
 *     setMultiUcEnergiaGeradaKWh
 *   - 4 side-effects: initialise rows, refresh tariffs, sync kcKwhMes, restore on toggle
 *
 * Params:
 *   - distribuidoraAneelEfetiva — effective ANEEL distributor (drives tariff lookup)
 *   - kcKwhMes                  — current monthly consumption (read for sync effects)
 *   - setKcKwhMes               — setter for monthly consumption (used by sync effects)
 *
 * NOT included (stay in App.tsx because they depend on geracaoMensalKwh which
 * is declared much later):
 *   - handleMultiUcToggle
 *   - the effect that seeds multiUcEnergiaGeradaKWh from geracaoMensalKwh
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  INITIAL_VALUES,
  createDefaultMultiUcRow,
  type MultiUcRowState,
  type MultiUcRateioModo,
} from '../../app/config'
import {
  calcularMultiUc,
  type MultiUcCalculoResultado,
  type MultiUcCalculoUcResultado,
} from '../../utils/multiUc'
import { type MultiUcClasse } from '../../types/multiUc'
import { buscarTarifaPorClasse } from '../../utils/tarifasPorClasse'
import type { PrintableMultiUcResumo } from '../../types/printableProposal'

// ---------------------------------------------------------------------------
// Parameter & helper types
// ---------------------------------------------------------------------------

export type SetKcKwhMesFn = (value: number, origin?: 'auto' | 'user') => number

export interface UseMultiUcStateParams {
  distribuidoraAneelEfetiva: string
  kcKwhMes: number
  setKcKwhMes: SetKcKwhMesFn
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMultiUcState({
  distribuidoraAneelEfetiva,
  kcKwhMes,
  setKcKwhMes,
}: UseMultiUcStateParams) {
  // ---------------------------------------------------------------------------
  // Raw state
  // ---------------------------------------------------------------------------
  const [multiUcAtivo, setMultiUcAtivo] = useState(INITIAL_VALUES.multiUcAtivo)
  const [multiUcRows, setMultiUcRows] = useState<MultiUcRowState[]>(() =>
    INITIAL_VALUES.multiUcUcs.map((uc, index) => ({
      ...uc,
      id: uc.id || `UC-${index + 1}`,
    })),
  )
  const [multiUcRateioModo, setMultiUcRateioModo] = useState<MultiUcRateioModo>(
    INITIAL_VALUES.multiUcRateioModo,
  )
  const [multiUcEnergiaGeradaKWh, setMultiUcEnergiaGeradaKWhState] = useState(
    INITIAL_VALUES.multiUcEnergiaGeradaKWh,
  )
  const [multiUcEnergiaGeradaTouched, setMultiUcEnergiaGeradaTouched] = useState(false)
  const [multiUcAnoVigencia, setMultiUcAnoVigencia] = useState(
    INITIAL_VALUES.multiUcAnoVigencia,
  )
  const [multiUcOverrideEscalonamento, setMultiUcOverrideEscalonamento] = useState(
    INITIAL_VALUES.multiUcOverrideEscalonamento,
  )
  const [multiUcEscalonamentoCustomPercent, setMultiUcEscalonamentoCustomPercent] =
    useState<number | null>(INITIAL_VALUES.multiUcEscalonamentoCustomPercent)

  // Constant (from initial values, never mutated)
  const multiUcEscalonamentoPadrao = INITIAL_VALUES.multiUcEscalonamentoPadrao

  // Refs for ID generation and prior consumption tracking
  const multiUcConsumoAnteriorRef = useRef<number | null>(null)
  const multiUcIdCounterRef = useRef<number>(
    (INITIAL_VALUES.multiUcUcs?.length ?? 0) + 1,
  )

  // ---------------------------------------------------------------------------
  // Derived memos
  // ---------------------------------------------------------------------------
  const multiUcReferenciaData = useMemo(
    () => new Date(Math.max(0, multiUcAnoVigencia), 0, 1),
    [multiUcAnoVigencia],
  )

  const multiUcConsumoTotal = useMemo(
    () => multiUcRows.reduce((acc, row) => acc + Math.max(0, row.consumoKWh), 0),
    [multiUcRows],
  )

  const multiUcRateioPercentualTotal = useMemo(
    () =>
      multiUcRows.reduce((acc, row) => acc + Math.max(0, row.rateioPercentual || 0), 0),
    [multiUcRows],
  )

  const multiUcRateioManualTotal = useMemo(
    () => multiUcRows.reduce((acc, row) => acc + Math.max(0, row.manualRateioKWh ?? 0), 0),
    [multiUcRows],
  )

  const multiUcEscalonamentoPercentual = useMemo(() => {
    if (multiUcOverrideEscalonamento && multiUcEscalonamentoCustomPercent != null) {
      return Math.max(0, multiUcEscalonamentoCustomPercent) / 100
    }
    const padrao = multiUcEscalonamentoPadrao[multiUcAnoVigencia] ?? 0
    return Math.max(0, padrao) / 100
  }, [
    multiUcAnoVigencia,
    multiUcEscalonamentoPadrao,
    multiUcOverrideEscalonamento,
    multiUcEscalonamentoCustomPercent,
  ])

  const multiUcEscalonamentoTabela = useMemo(
    () =>
      Object.entries(multiUcEscalonamentoPadrao)
        .map(([ano, valor]) => ({ ano: Number(ano), valor }))
        .sort((a, b) => a.ano - b.ano),
    [multiUcEscalonamentoPadrao],
  )

  const multiUcResultado = useMemo<MultiUcCalculoResultado | null>(() => {
    if (!multiUcAtivo) return null
    return calcularMultiUc({
      energiaGeradaTotalKWh: multiUcEnergiaGeradaKWh,
      distribuicaoPorPercentual: multiUcRateioModo === 'percentual',
      ucs: multiUcRows.map((row) => ({
        id: row.id,
        classe: row.classe,
        consumoKWh: row.consumoKWh,
        rateioPercentual: row.rateioPercentual,
        manualRateioKWh: row.manualRateioKWh,
        tarifas: {
          TE: row.te,
          TUSD_total: row.tusdTotal,
          TUSD_FioB: row.tusdFioB,
        },
        observacoes: row.observacoes,
      })),
      parametrosMLGD: {
        anoVigencia: multiUcAnoVigencia,
        escalonamentoPadrao: multiUcEscalonamentoPadrao,
        overrideEscalonamento: multiUcOverrideEscalonamento,
        escalonamentoCustomPercent: multiUcEscalonamentoCustomPercent,
      },
    })
  }, [
    multiUcAtivo,
    multiUcRows,
    multiUcEnergiaGeradaKWh,
    multiUcRateioModo,
    multiUcAnoVigencia,
    multiUcEscalonamentoPadrao,
    multiUcOverrideEscalonamento,
    multiUcEscalonamentoCustomPercent,
  ])

  const multiUcResultadoPorId = useMemo(() => {
    const map = new Map<string, MultiUcCalculoUcResultado>()
    if (multiUcResultado) {
      multiUcResultado.ucs.forEach((uc) => map.set(uc.id, uc))
    }
    return map
  }, [multiUcResultado])

  const multiUcWarnings = multiUcResultado?.warnings ?? []
  const multiUcErrors = multiUcResultado?.errors ?? []

  const multiUcPrintableResumo = useMemo<PrintableMultiUcResumo | null>(() => {
    if (!multiUcAtivo || !multiUcResultado || multiUcErrors.length > 0) return null
    return {
      energiaGeradaTotalKWh: multiUcResultado.energiaGeradaTotalKWh,
      energiaGeradaUtilizadaKWh: multiUcResultado.energiaGeradaUtilizadaKWh,
      sobraCreditosKWh: multiUcResultado.sobraCreditosKWh,
      escalonamentoPercentual: multiUcResultado.escalonamentoPercentual,
      totalTusd: multiUcResultado.totalTusd,
      totalTe: multiUcResultado.totalTe,
      totalContrato: multiUcResultado.totalContrato,
      distribuicaoPorPercentual: multiUcRateioModo === 'percentual',
      anoVigencia: multiUcAnoVigencia,
      ucs: multiUcResultado.ucs.map((uc) => ({
        id: uc.id,
        classe: uc.classe,
        consumoKWh: uc.consumoKWh,
        rateioPercentual: uc.rateioPercentual,
        manualRateioKWh: uc.manualRateioKWh ?? null,
        creditosKWh: uc.creditosKWh,
        kWhFaturados: uc.kWhFaturados,
        kWhCompensados: uc.kWhCompensados,
        te: uc.tarifas.TE,
        tusdTotal: uc.tarifas.TUSD_total,
        tusdFioB: uc.tarifas.TUSD_FioB,
        tusdOutros: uc.tusdOutros,
        tusdMensal: uc.tusdMensal,
        teMensal: uc.teMensal,
        totalMensal: uc.totalMensal,
        observacoes: uc.observacoes ?? null,
      })),
    }
  }, [
    multiUcAtivo,
    multiUcResultado,
    multiUcErrors,
    multiUcRateioModo,
    multiUcAnoVigencia,
  ])

  // ---------------------------------------------------------------------------
  // Internal: applyTarifasAutomaticas
  // ---------------------------------------------------------------------------
  const applyTarifasAutomaticas = useCallback(
    (row: MultiUcRowState, classe?: MultiUcClasse, force = false): MultiUcRowState => {
      const classeFinal = classe ?? row.classe
      const distribuidoraReferencia =
        distribuidoraAneelEfetiva && distribuidoraAneelEfetiva.trim()
          ? distribuidoraAneelEfetiva
          : 'DEFAULT'
      const sugestao = buscarTarifaPorClasse(
        distribuidoraReferencia,
        classeFinal,
        multiUcReferenciaData,
      )

      let next = row
      if (classeFinal !== row.classe) {
        next = { ...next, classe: classeFinal }
      }

      if (sugestao) {
        if (force || row.teFonte === 'auto') {
          next = { ...next, te: sugestao.TE, teFonte: 'auto' }
        }
        if (force || row.tusdTotalFonte === 'auto') {
          next = { ...next, tusdTotal: sugestao.TUSD_total, tusdTotalFonte: 'auto' }
        }
        if (force || row.tusdFioBFonte === 'auto') {
          next = { ...next, tusdFioB: sugestao.TUSD_FioB, tusdFioBFonte: 'auto' }
        }
      }

      return next
    },
    [distribuidoraAneelEfetiva, multiUcReferenciaData],
  )

  // ---------------------------------------------------------------------------
  // Row mutation helper
  // ---------------------------------------------------------------------------
  const updateMultiUcRow = useCallback(
    (id: string, updater: (prev: MultiUcRowState) => MultiUcRowState) => {
      setMultiUcRows((prev) => {
        let changed = false
        const next = prev.map((row) => {
          if (row.id !== id) return row
          const updated = updater(row)
          if (updated !== row) changed = true
          return updated
        })
        return changed ? next : prev
      })
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Public row-level handlers
  // ---------------------------------------------------------------------------
  const handleMultiUcClasseChange = useCallback(
    (id: string, classe: MultiUcClasse) => {
      updateMultiUcRow(id, (row) =>
        applyTarifasAutomaticas(
          { ...row, teFonte: 'auto', tusdTotalFonte: 'auto', tusdFioBFonte: 'auto' },
          classe,
          true,
        ),
      )
    },
    [applyTarifasAutomaticas, updateMultiUcRow],
  )

  const handleMultiUcConsumoChange = useCallback(
    (id: string, valor: number) => {
      const normalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateMultiUcRow(id, (row) => ({ ...row, consumoKWh: normalizado }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcRateioPercentualChange = useCallback(
    (id: string, valor: number) => {
      const normalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateMultiUcRow(id, (row) => ({ ...row, rateioPercentual: normalizado }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcManualRateioChange = useCallback(
    (id: string, valor: number) => {
      const normalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateMultiUcRow(id, (row) => ({ ...row, manualRateioKWh: normalizado }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcTeChange = useCallback(
    (id: string, valor: number) => {
      const normalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateMultiUcRow(id, (row) => ({ ...row, te: normalizado, teFonte: 'manual' }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcTusdTotalChange = useCallback(
    (id: string, valor: number) => {
      const normalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateMultiUcRow(id, (row) => ({
        ...row,
        tusdTotal: normalizado,
        tusdTotalFonte: 'manual',
      }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcTusdFioBChange = useCallback(
    (id: string, valor: number) => {
      const normalizado = Number.isFinite(valor) ? Math.max(0, valor) : 0
      updateMultiUcRow(id, (row) => ({
        ...row,
        tusdFioB: normalizado,
        tusdFioBFonte: 'manual',
      }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcObservacoesChange = useCallback(
    (id: string, valor: string) => {
      updateMultiUcRow(id, (row) => ({ ...row, observacoes: valor }))
    },
    [updateMultiUcRow],
  )

  const handleMultiUcAdicionar = useCallback(() => {
    const novoId = multiUcIdCounterRef.current
    multiUcIdCounterRef.current += 1
    setMultiUcRows((prev) => {
      const novo = applyTarifasAutomaticas(createDefaultMultiUcRow(novoId), undefined, true)
      return [...prev, novo]
    })
  }, [applyTarifasAutomaticas])

  const handleMultiUcRemover = useCallback((id: string) => {
    setMultiUcRows((prev) => {
      if (prev.length <= 1) return prev
      const filtrado = prev.filter((row) => row.id !== id)
      return filtrado.length > 0 ? filtrado : prev
    })
  }, [])

  const handleMultiUcQuantidadeChange = useCallback(
    (valor: number) => {
      const alvo = Number.isFinite(valor) ? Math.max(1, Math.round(valor)) : 1
      setMultiUcRows((prev) => {
        if (alvo === prev.length) return prev
        if (alvo < prev.length) return prev.slice(0, alvo)
        const adicionais: MultiUcRowState[] = []
        const faltantes = alvo - prev.length
        for (let index = 0; index < faltantes; index += 1) {
          const novoId = multiUcIdCounterRef.current
          multiUcIdCounterRef.current += 1
          adicionais.push(
            applyTarifasAutomaticas(createDefaultMultiUcRow(novoId), undefined, true),
          )
        }
        return [...prev, ...adicionais]
      })
    },
    [applyTarifasAutomaticas],
  )

  const handleMultiUcRecarregarTarifas = useCallback(() => {
    setMultiUcRows((prev) =>
      prev.map((row) =>
        applyTarifasAutomaticas(
          { ...row, teFonte: 'auto', tusdTotalFonte: 'auto', tusdFioBFonte: 'auto' },
          row.classe,
          true,
        ),
      ),
    )
  }, [applyTarifasAutomaticas])

  const handleMultiUcRateioModoChange = useCallback(
    (modo: MultiUcRateioModo) => {
      setMultiUcRateioModo(modo)
      if (modo === 'manual') {
        setMultiUcRows((prev) =>
          prev.map((row) => {
            if (row.manualRateioKWh != null) return row
            const calculado =
              multiUcEnergiaGeradaKWh > 0
                ? multiUcEnergiaGeradaKWh * (row.rateioPercentual / 100)
                : 0
            return { ...row, manualRateioKWh: Math.max(0, calculado) }
          }),
        )
      }
    },
    [multiUcEnergiaGeradaKWh],
  )

  // Public wrapper that sets the touched flag
  const setMultiUcEnergiaGeradaKWh = useCallback(
    (value: number, origin: 'auto' | 'user' = 'auto') => {
      const normalized = Number.isFinite(value) ? Math.max(0, value) : 0
      if (origin === 'user') {
        setMultiUcEnergiaGeradaTouched(true)
      }
      setMultiUcEnergiaGeradaKWhState((prev) => (prev === normalized ? prev : normalized))
      return normalized
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Side-effects
  // ---------------------------------------------------------------------------

  // Ensure rows exist when multi-UC is activated
  useEffect(() => {
    if (!multiUcAtivo) return
    setMultiUcRows((prev) => {
      if (prev.length > 0) return prev
      const novoId = multiUcIdCounterRef.current
      multiUcIdCounterRef.current += 1
      return [applyTarifasAutomaticas(createDefaultMultiUcRow(novoId), undefined, true)]
    })
  }, [applyTarifasAutomaticas, multiUcAtivo])

  // Refresh tariffs on every distributor/date change while multi-UC is active
  useEffect(() => {
    if (!multiUcAtivo) return
    setMultiUcRows((prev) => {
      let changed = false
      const atualizadas = prev.map((row) => {
        const proxima = applyTarifasAutomaticas(row, row.classe, false)
        if (proxima !== row) changed = true
        return proxima
      })
      return changed ? atualizadas : prev
    })
  }, [applyTarifasAutomaticas, multiUcAtivo])

  // Keep kcKwhMes in sync with total consumption across UCs
  useEffect(() => {
    if (!multiUcAtivo) return
    if (multiUcConsumoAnteriorRef.current == null) {
      multiUcConsumoAnteriorRef.current = kcKwhMes
    }
    if (Math.abs(kcKwhMes - multiUcConsumoTotal) > 0.001) {
      setKcKwhMes(multiUcConsumoTotal, 'auto')
    }
  }, [kcKwhMes, multiUcAtivo, multiUcConsumoTotal, setKcKwhMes])

  // Restore previous kcKwhMes when multi-UC is deactivated
  useEffect(() => {
    if (multiUcAtivo) return
    if (multiUcConsumoAnteriorRef.current != null) {
      setKcKwhMes(multiUcConsumoAnteriorRef.current, 'auto')
      multiUcConsumoAnteriorRef.current = null
    }
  }, [multiUcAtivo, setKcKwhMes])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    // State
    multiUcAtivo,
    setMultiUcAtivo,
    multiUcRows,
    setMultiUcRows,
    multiUcRateioModo,
    setMultiUcRateioModo,
    multiUcEnergiaGeradaKWh,
    setMultiUcEnergiaGeradaKWhState,
    multiUcEnergiaGeradaTouched,
    setMultiUcEnergiaGeradaTouched,
    multiUcAnoVigencia,
    setMultiUcAnoVigencia,
    multiUcOverrideEscalonamento,
    setMultiUcOverrideEscalonamento,
    multiUcEscalonamentoCustomPercent,
    setMultiUcEscalonamentoCustomPercent,
    multiUcEscalonamentoPadrao,

    // Refs
    multiUcConsumoAnteriorRef,
    multiUcIdCounterRef,

    // Memos
    multiUcReferenciaData,
    multiUcConsumoTotal,
    multiUcRateioPercentualTotal,
    multiUcRateioManualTotal,
    multiUcEscalonamentoPercentual,
    multiUcEscalonamentoTabela,
    multiUcResultado,
    multiUcResultadoPorId,
    multiUcWarnings,
    multiUcErrors,
    multiUcPrintableResumo,

    // Callbacks
    applyTarifasAutomaticas,
    updateMultiUcRow,
    setMultiUcEnergiaGeradaKWh,
    handleMultiUcClasseChange,
    handleMultiUcConsumoChange,
    handleMultiUcRateioPercentualChange,
    handleMultiUcManualRateioChange,
    handleMultiUcTeChange,
    handleMultiUcTusdTotalChange,
    handleMultiUcTusdFioBChange,
    handleMultiUcObservacoesChange,
    handleMultiUcAdicionar,
    handleMultiUcRemover,
    handleMultiUcQuantidadeChange,
    handleMultiUcRecarregarTarifas,
    handleMultiUcRateioModoChange,
  }
}
