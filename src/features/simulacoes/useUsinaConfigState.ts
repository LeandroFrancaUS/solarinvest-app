/**
 * useUsinaConfigState.ts
 *
 * Owns the solar system (usina) configuration state: installation type, system
 * type, module power, number of modules, network type, segment, and related
 * dirty/manual flags.
 *
 * Params:
 *   updatePageSharedState — callback from App.tsx that writes changes into the
 *   cross-tab PageSharedSettings slice (must be stable / wrapped in useCallback).
 *
 * Returns every state variable, the smart wrapper setters that also sync to
 * PageSharedSettings, and the raw state setters (suffixed `Raw`) required by the
 * cross-tab hydration effect in App.tsx.
 */

import { useCallback, useMemo, useState } from 'react'
import {
  INITIAL_VALUES,
  type TipoRede,
} from '../../app/config'
import { TIPOS_REDE } from '../../constants/instalacao'
import type { PageSharedSettings } from '../../types/orcamentoTypes'
import type {
  TipoInstalacao,
} from '../../types/printableProposal'
import {
  type SegmentoCliente,
  type TipoSistema,
} from '../../lib/finance/roi'
import { normalizeTipoBasico } from '../../types/tipoBasico'

// ── Local helpers (mirrors of the module-level helpers in App.tsx) ─────────────

const TIPO_SISTEMA_VALUES: readonly TipoSistema[] = ['ON_GRID', 'HIBRIDO', 'OFF_GRID'] as const

export function normalizeTipoSistemaValue(value: unknown): TipoSistema | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const canonical = trimmed.toUpperCase().replace(/[\s-]+/g, '_')
    return TIPO_SISTEMA_VALUES.includes(canonical as TipoSistema)
      ? (canonical as TipoSistema)
      : undefined
  }
  if (value == null) return undefined
  if (typeof value === 'number' || typeof value === 'boolean') {
    return normalizeTipoSistemaValue(String(value))
  }
  return undefined
}

export function normalizeTipoInstalacao(value?: string | null): TipoInstalacao {
  if (!value) return 'fibrocimento'
  const v = value.toLowerCase()
  if (v === 'fibrocimento') return 'fibrocimento'
  if (v === 'metalico' || v === 'metálico') return 'metalico'
  if (v === 'ceramico' || v === 'cerâmico') return 'ceramico'
  if (v === 'laje') return 'laje'
  if (v === 'solo') return 'solo'
  return 'outros'
}

function resolveStateUpdate<T>(input: T | ((prev: T) => T), prev: T): T {
  return typeof input === 'function' ? (input as (previous: T) => T)(prev) : input
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseUsinaConfigStateParams {
  updatePageSharedState: (updater: (current: PageSharedSettings) => PageSharedSettings) => void
}

export function useUsinaConfigState({ updatePageSharedState }: UseUsinaConfigStateParams) {
  const [consumoManual, setConsumoManualState] = useState(false)
  const [potenciaFonteManual, setPotenciaFonteManualState] = useState(false)

  const [potenciaModulo, setPotenciaModuloState] = useState(INITIAL_VALUES.potenciaModulo)
  const [tipoRede, setTipoRede] = useState<TipoRede>(INITIAL_VALUES.tipoRede ?? 'nenhum')
  const [tipoRedeControle, setTipoRedeControle] = useState<'auto' | 'manual'>('auto')
  const tipoRedeLabel = useMemo(
    () => TIPOS_REDE.find((rede) => rede.value === tipoRede)?.label ?? tipoRede,
    [tipoRede],
  )
  const [potenciaModuloDirty, setPotenciaModuloDirtyState] = useState(false)
  const initialTipoInstalacao = normalizeTipoInstalacao(INITIAL_VALUES.tipoInstalacao)
  const [tipoInstalacao, setTipoInstalacaoState] = useState<TipoInstalacao>(
    () => initialTipoInstalacao,
  )
  const [tipoInstalacaoOutro, setTipoInstalacaoOutroState] = useState(
    INITIAL_VALUES.tipoInstalacaoOutro,
  )
  const [tipoSistema, setTipoSistemaState] = useState<TipoSistema>(INITIAL_VALUES.tipoSistema)
  const [segmentoCliente, setSegmentoClienteState] = useState<SegmentoCliente>(() =>
    INITIAL_VALUES.segmentoCliente
      ? normalizeTipoBasico(INITIAL_VALUES.segmentoCliente)
      : '',
  )
  const [tipoEdificacaoOutro, setTipoEdificacaoOutro] = useState(
    INITIAL_VALUES.tipoEdificacaoOutro,
  )
  const [tipoInstalacaoDirty, setTipoInstalacaoDirtyState] = useState(false)
  const [numeroModulosManual, setNumeroModulosManualState] = useState<number | ''>(
    INITIAL_VALUES.numeroModulosManual,
  )
  const [configuracaoUsinaObservacoes, setConfiguracaoUsinaObservacoes] = useState(
    INITIAL_VALUES.configuracaoUsinaObservacoes,
  )
  const [configuracaoUsinaObservacoesExpanded, setConfiguracaoUsinaObservacoesExpanded] =
    useState(false)

  // ── Wrapper setters ──────────────────────────────────────────────────────────

  const setConsumoManual = useCallback(
    (value: boolean) => {
      setConsumoManualState(value)
      updatePageSharedState((current) => {
        if (current.consumoManual === value) return current
        return { ...current, consumoManual: value }
      })
    },
    [updatePageSharedState],
  )

  const setPotenciaFonteManual = useCallback(
    (value: boolean) => {
      setPotenciaFonteManualState(value)
      updatePageSharedState((current) => {
        if (current.potenciaFonteManual === value) return current
        return { ...current, potenciaFonteManual: value }
      })
    },
    [updatePageSharedState],
  )

  const setPotenciaModulo = useCallback(
    (valueOrUpdater: number | ((prev: number) => number)) => {
      const nextRaw = resolveStateUpdate(valueOrUpdater, potenciaModulo)
      const normalized = Number.isFinite(nextRaw) ? nextRaw : INITIAL_VALUES.potenciaModulo
      setPotenciaModuloState(normalized)
      updatePageSharedState((current) => {
        if (current.potenciaModulo === normalized) return current
        return { ...current, potenciaModulo: normalized }
      })
    },
    [potenciaModulo, updatePageSharedState],
  )

  const setPotenciaModuloDirty = useCallback(
    (value: boolean) => {
      setPotenciaModuloDirtyState(value)
      updatePageSharedState((current) => {
        if (current.potenciaModuloDirty === value) return current
        return { ...current, potenciaModuloDirty: value }
      })
    },
    [updatePageSharedState],
  )

  const setTipoInstalacao = useCallback(
    (value: TipoInstalacao) => {
      setTipoInstalacaoState(value)
      updatePageSharedState((current) => {
        if (current.tipoInstalacao === value) return current
        return { ...current, tipoInstalacao: value }
      })
    },
    [updatePageSharedState],
  )

  const setTipoInstalacaoOutro = useCallback(
    (value: string) => {
      setTipoInstalacaoOutroState(value)
      updatePageSharedState((current) => {
        if (current.tipoInstalacaoOutro === value) return current
        return { ...current, tipoInstalacaoOutro: value }
      })
    },
    [updatePageSharedState],
  )

  const setTipoSistema = useCallback(
    (valueOrUpdater: TipoSistema | ((prev: TipoSistema) => TipoSistema)) => {
      const nextValue = resolveStateUpdate(valueOrUpdater, tipoSistema)
      const normalized = normalizeTipoSistemaValue(nextValue) ?? tipoSistema
      setTipoSistemaState(normalized)
      updatePageSharedState((current) => {
        if (current.tipoSistema === normalized) return current
        return { ...current, tipoSistema: normalized }
      })
    },
    [tipoSistema, updatePageSharedState],
  )

  const setTipoInstalacaoDirty = useCallback(
    (value: boolean) => {
      setTipoInstalacaoDirtyState(value)
      updatePageSharedState((current) => {
        if (current.tipoInstalacaoDirty === value) return current
        return { ...current, tipoInstalacaoDirty: value }
      })
    },
    [updatePageSharedState],
  )

  const setSegmentoCliente = useCallback(
    (valueOrUpdater: SegmentoCliente | ((prev: SegmentoCliente) => SegmentoCliente)) => {
      const nextValue = resolveStateUpdate(valueOrUpdater, segmentoCliente)
      setSegmentoClienteState(nextValue)
      updatePageSharedState((current) => {
        if (current.segmentoCliente === nextValue) return current
        return { ...current, segmentoCliente: nextValue }
      })
    },
    [segmentoCliente, updatePageSharedState],
  )

  const setNumeroModulosManual = useCallback(
    (valueOrUpdater: number | '' | ((prev: number | '') => number | '')) => {
      const nextValue = resolveStateUpdate(valueOrUpdater, numeroModulosManual)
      setNumeroModulosManualState(nextValue)
      updatePageSharedState((current) => {
        if (current.numeroModulosManual === nextValue) return current
        return { ...current, numeroModulosManual: nextValue }
      })
    },
    [numeroModulosManual, updatePageSharedState],
  )

  return {
    // State
    consumoManual,
    potenciaFonteManual,
    potenciaModulo,
    tipoRede,
    tipoRedeControle,
    tipoRedeLabel,
    potenciaModuloDirty,
    tipoInstalacao,
    tipoInstalacaoOutro,
    tipoSistema,
    segmentoCliente,
    tipoEdificacaoOutro,
    tipoInstalacaoDirty,
    numeroModulosManual,
    configuracaoUsinaObservacoes,
    configuracaoUsinaObservacoesExpanded,

    // Wrapper setters
    setConsumoManual,
    setPotenciaFonteManual,
    setPotenciaModulo,
    setPotenciaModuloDirty,
    setTipoInstalacao,
    setTipoInstalacaoOutro,
    setTipoSistema,
    setTipoInstalacaoDirty,
    setSegmentoCliente,
    setNumeroModulosManual,
    setTipoRede,
    setTipoRedeControle,
    setTipoEdificacaoOutro,
    setConfiguracaoUsinaObservacoes,
    setConfiguracaoUsinaObservacoesExpanded,

    // Raw state setters for the cross-tab hydration effect in App.tsx
    setPotenciaModuloRaw: setPotenciaModuloState,
    setNumeroModulosManualRaw: setNumeroModulosManualState,
    setSegmentoClienteRaw: setSegmentoClienteState,
    setTipoInstalacaoRaw: setTipoInstalacaoState,
    setTipoInstalacaoOutroRaw: setTipoInstalacaoOutroState,
    setTipoSistemaRaw: setTipoSistemaState,
    setConsumoManualRaw: setConsumoManualState,
    setPotenciaFonteManualRaw: setPotenciaFonteManualState,
    setPotenciaModuloDirtyRaw: setPotenciaModuloDirtyState,
    setTipoInstalacaoDirtyRaw: setTipoInstalacaoDirtyState,
  }
}

/** Convenience type alias for the hook's return value. */
export type UseUsinaConfigStateReturn = ReturnType<typeof useUsinaConfigState>
