/**
 * useAneelTarifaState.ts
 *
 * Manages the ANEEL tariff / distribuidora slice: effects, wrapper setters,
 * and derived memos. Raw state (useState) lives in App.tsx so that tarifaCheia
 * is available to the proposal-orchestration controller before
 * distribuidoraAneelEfetiva is computed. This hook is called after the
 * controller, once distribuidoraAneelEfetiva is in scope.
 *
 *   Effects owned:
 *     1. Sync distribuidoraTarifa from distribuidoraAneelEfetiva
 *     2. Fetch mesReajuste from ANEEL API
 *     3. Fetch tarifaCheia from tariff API
 *     4. Load ufsDisponiveis + distribuidorasPorUf on mount
 *     5. Auto-select distribuidoraTarifa when distribuidorasPorUf / ufTarifa changes
 *
 *   Wrapper setters returned:
 *     setTarifaCheia, setTaxaMinima, setUfTarifa, setDistribuidoraTarifa
 *     normalizeTaxaMinimaInputValue
 *
 *   Derived memos returned:
 *     distribuidorasDisponiveis, clienteDistribuidorasDisponiveis
 *
 * Zero behavioural change — exact same logic as the original App.tsx blocks.
 */

import { useCallback, useEffect, useMemo } from 'react'
import { getMesReajusteFromANEEL } from '../../utils/reajusteAneel'
import { getTarifaCheia } from '../../utils/tarifaAneel'
import { loadDistribuidorasAneel } from '../../utils/distribuidorasAneel'
import type { PageSharedSettings } from '../../types/orcamentoTypes'

// ─── Types ────────────────────────────────────────────────────────────────────

type UpdatePageSharedStateFn = (
  updater: (current: PageSharedSettings) => PageSharedSettings,
) => void

export interface UseAneelTarifaStateOptions {
  // Raw state values (declared in App.tsx before the controller)
  ufTarifa: string
  distribuidoraTarifa: string
  distribuidorasPorUf: Record<string, string[]>
  tarifaCheia: number
  taxaMinima: number
  // Raw setters from App.tsx useState
  setUfTarifaState: React.Dispatch<React.SetStateAction<string>>
  setDistribuidoraTarifaState: React.Dispatch<React.SetStateAction<string>>
  setUfsDisponiveis: React.Dispatch<React.SetStateAction<string[]>>
  setDistribuidorasPorUf: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  setMesReajuste: React.Dispatch<React.SetStateAction<number>>
  setTarifaCheiaState: React.Dispatch<React.SetStateAction<number>>
  setTaxaMinimaState: React.Dispatch<React.SetStateAction<number>>
  setTaxaMinimaInputEmpty: React.Dispatch<React.SetStateAction<boolean>>
  // Computed deps (only available after the controller)
  distribuidoraAneelEfetiva: string
  clienteUf: string
  updatePageSharedState: UpdatePageSharedStateFn
}

export interface UseAneelTarifaStateResult {
  /** Wrapped setter — also syncs pageSharedState */
  setTarifaCheia: (valueOrUpdater: number | ((prev: number) => number)) => void
  /** Wrapped setter — also syncs pageSharedState + setTaxaMinimaInputEmpty */
  setTaxaMinima: (valueOrUpdater: number | ((prev: number) => number)) => void
  /** Wrapped setter — also syncs pageSharedState */
  setUfTarifa: (valueOrUpdater: string | ((prev: string) => string)) => void
  /** Wrapped setter — also syncs pageSharedState */
  setDistribuidoraTarifa: (valueOrUpdater: string | ((prev: string) => string)) => void
  normalizeTaxaMinimaInputValue: (rawValue: string) => number
  /** Distribuidoras for the currently selected ufTarifa */
  distribuidorasDisponiveis: string[]
  /** Distribuidoras for the client's UF */
  clienteDistribuidorasDisponiveis: string[]
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function resolveStateUpdate<T>(input: T | ((prev: T) => T), prev: T): T {
  return typeof input === 'function' ? (input as (previous: T) => T)(prev) : input
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAneelTarifaState({
  ufTarifa,
  distribuidoraTarifa,
  distribuidorasPorUf,
  tarifaCheia,
  taxaMinima,
  setUfTarifaState,
  setDistribuidoraTarifaState,
  setUfsDisponiveis,
  setDistribuidorasPorUf,
  setMesReajuste,
  setTarifaCheiaState,
  setTaxaMinimaState,
  setTaxaMinimaInputEmpty,
  distribuidoraAneelEfetiva,
  clienteUf,
  updatePageSharedState,
}: UseAneelTarifaStateOptions): UseAneelTarifaStateResult {

  // ── Wrapper setters ──────────────────────────────────────────────────────────

  const setTarifaCheia = useCallback(
    (valueOrUpdater: number | ((prev: number) => number)) => {
      const nextRaw = resolveStateUpdate(valueOrUpdater, tarifaCheia)
      const normalized = Number.isFinite(nextRaw) ? Math.max(0, nextRaw) : 0
      setTarifaCheiaState(normalized)
      updatePageSharedState((current) => {
        if (current.tarifaCheia === normalized) {
          return current
        }
        return { ...current, tarifaCheia: normalized }
      })
    },
    [tarifaCheia, setTarifaCheiaState, updatePageSharedState],
  )

  const setTaxaMinima = useCallback(
    (valueOrUpdater: number | ((prev: number) => number)) => {
      const nextRaw = resolveStateUpdate(valueOrUpdater, taxaMinima)
      const normalized = Number.isFinite(nextRaw) ? Math.max(0, nextRaw) : 0
      setTaxaMinimaState(normalized)
      setTaxaMinimaInputEmpty((prev) => (normalized === 0 ? prev : false))
      updatePageSharedState((current) => {
        if (current.taxaMinima === normalized) {
          return current
        }
        return { ...current, taxaMinima: normalized }
      })
    },
    [setTaxaMinimaInputEmpty, taxaMinima, setTaxaMinimaState, updatePageSharedState],
  )

  const normalizeTaxaMinimaInputValue = useCallback(
    (rawValue: string) => {
      if (rawValue === '') {
        setTaxaMinimaInputEmpty(true)
        setTaxaMinima(0)
        return 0
      }
      const parsed = Number(rawValue)
      const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
      setTaxaMinimaInputEmpty(false)
      setTaxaMinima(normalized)
      return normalized
    },
    [setTaxaMinima, setTaxaMinimaInputEmpty],
  )

  const setUfTarifa = useCallback(
    (valueOrUpdater: string | ((prev: string) => string)) => {
      const nextValue = resolveStateUpdate(valueOrUpdater, ufTarifa)
      setUfTarifaState(nextValue)
      updatePageSharedState((current) => {
        if (current.ufTarifa === nextValue) {
          return current
        }
        return { ...current, ufTarifa: nextValue }
      })
    },
    [ufTarifa, setUfTarifaState, updatePageSharedState],
  )

  const setDistribuidoraTarifa = useCallback(
    (valueOrUpdater: string | ((prev: string) => string)) => {
      const nextValue = resolveStateUpdate(valueOrUpdater, distribuidoraTarifa)
      setDistribuidoraTarifaState(nextValue)
      updatePageSharedState((current) => {
        if (current.distribuidoraTarifa === nextValue) {
          return current
        }
        return { ...current, distribuidoraTarifa: nextValue }
      })
    },
    [distribuidoraTarifa, setDistribuidoraTarifaState, updatePageSharedState],
  )

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Sync distribuidoraTarifa from distribuidoraAneelEfetiva
  useEffect(() => {
    if (distribuidoraTarifa === distribuidoraAneelEfetiva) {
      return
    }
    setDistribuidoraTarifa(distribuidoraAneelEfetiva)
  }, [distribuidoraAneelEfetiva, distribuidoraTarifa, setDistribuidoraTarifa])

  // Fetch mesReajuste from ANEEL API
  useEffect(() => {
    let cancelado = false
    const uf = ufTarifa.trim()
    const dist = distribuidoraAneelEfetiva.trim()

    if (!uf || !dist) {
      setMesReajuste(6)
      return () => {
        cancelado = true
      }
    }

    void getMesReajusteFromANEEL(uf, dist)
      .then((mes) => {
        if (cancelado) return
        const normalizado = Number.isFinite(mes) ? Math.round(mes) : 6
        const ajustado = Math.min(Math.max(normalizado || 6, 1), 12)
        setMesReajuste(ajustado)
      })
      .catch((error) => {
        console.warn('[ANEEL] não foi possível atualizar mês de reajuste:', error)
        if (!cancelado) setMesReajuste(6)
      })

    return () => {
      cancelado = true
    }
  }, [distribuidoraAneelEfetiva, ufTarifa, setMesReajuste])

  // Fetch tarifaCheia from tariff API
  useEffect(() => {
    const ufAtual = (ufTarifa || clienteUf || '').trim()
    if (!ufAtual) {
      return undefined
    }

    const distribuidoraAtual = distribuidoraAneelEfetiva.trim()
    let cancelado = false

    void getTarifaCheia({ uf: ufAtual, distribuidora: distribuidoraAtual || undefined })
      .then((valor) => {
        if (cancelado) return
        if (!Number.isFinite(valor)) return

        setTarifaCheia((atual) => {
          if (!Number.isFinite(atual)) {
            return valor
          }
          return Math.abs(atual - valor) < 0.0005 ? atual : valor
        })
      })
      .catch((error) => {
        if (cancelado) return
        if (import.meta.env.DEV) console.warn('[Tarifa] Não foi possível atualizar tarifa cheia automaticamente:', error)
      })

    return () => {
      cancelado = true
    }
  }, [clienteUf, distribuidoraAneelEfetiva, ufTarifa, setTarifaCheia])

  // Load ufsDisponiveis + distribuidorasPorUf on mount
  useEffect(() => {
    let cancelado = false

    void loadDistribuidorasAneel()
      .then((dados) => {
        if (cancelado) return
        setUfsDisponiveis(dados.ufs)
        setDistribuidorasPorUf(dados.distribuidorasPorUf)
      })
      .catch((error) => {
        console.warn('[ANEEL] não foi possível atualizar lista de distribuidoras:', error)
      })

    return () => {
      cancelado = true
    }
  }, [setUfsDisponiveis, setDistribuidorasPorUf])

  // Auto-select distribuidoraTarifa when distribuidorasPorUf or ufTarifa changes
  useEffect(() => {
    if (!ufTarifa) {
      setDistribuidoraTarifa('')
      return
    }

    const lista = distribuidorasPorUf?.[ufTarifa]
    if (!lista || lista.length === 0) {
      setDistribuidoraTarifa('')
      return
    }

    setDistribuidoraTarifa((atual) => {
      if (lista.length === 1) {
        return lista[0]!
      }
      return lista.includes(atual) ? atual : ''
    })
  }, [distribuidorasPorUf, ufTarifa, setDistribuidoraTarifa])

  // ── Derived memos ────────────────────────────────────────────────────────────

  const distribuidorasDisponiveis = useMemo(() => {
    if (!ufTarifa) return [] as string[]
    return distribuidorasPorUf[ufTarifa] ?? []
  }, [distribuidorasPorUf, ufTarifa])

  const clienteDistribuidorasDisponiveis = useMemo(() => {
    if (!clienteUf) return [] as string[]
    return distribuidorasPorUf[clienteUf] ?? []
  }, [clienteUf, distribuidorasPorUf])

  return {
    setTarifaCheia,
    setTaxaMinima,
    setUfTarifa,
    setDistribuidoraTarifa,
    normalizeTaxaMinimaInputValue,
    distribuidorasDisponiveis,
    clienteDistribuidorasDisponiveis,
  }
}
