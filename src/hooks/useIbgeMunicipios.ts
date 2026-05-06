// src/hooks/useIbgeMunicipios.ts
//
// Extracted from App.tsx. Encapsulates all IBGE-municipality related state,
// fetching, and derived values:
//
//   • Loads the list of Brazilian UF siglas from IBGE on mount (calls the
//     provided setUfsDisponiveis callback so App.tsx can still own that state).
//   • Lazily fetches city lists per UF on demand (ensureIbgeMunicipios).
//   • Manages the city-search dropdown for the cliente.cidade field.
//   • Owns cidadeBloqueadaPorCep — the flag set by the CEP lookup indicating
//     that the city was resolved automatically and the field should be locked.
//     The setter is returned so App.tsx CEP effects can update it.
//   • Derives the filtered / available city list from the loaded data.
//
// Zero behavioural change — exact same logic as the original App.tsx blocks.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeText } from '../utils/textUtils'

// ─── Types ─────────────────────────────────────────────────────────────────────

type IbgeMunicipio = {
  nome?: string
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla?: string
      }
    }
  }
}

type IbgeEstado = {
  sigla?: string
}

export interface UseIbgeMunicipiosOptions {
  /**
   * Normalised UF of the active client (e.g. 'SP'). Used to auto-load the
   * city list for the current state and to derive the available/filtered sets.
   */
  clienteUfNormalizada: string
  /**
   * Called when the IBGE estado list has been loaded so App.tsx can keep
   * ufsDisponiveis in sync.  Receives the sorted array of UF siglas.
   */
  setUfsDisponiveis: (ufs: string[]) => void
}

export interface UseIbgeMunicipiosResult {
  // Raw state
  ibgeMunicipiosPorUf: Record<string, string[]>
  ibgeMunicipiosLoading: Record<string, boolean>
  // CEP-resolved city lock flag — set by App.tsx CEP effects via setCidadeBloqueadaPorCep
  cidadeBloqueadaPorCep: boolean
  setCidadeBloqueadaPorCep: React.Dispatch<React.SetStateAction<boolean>>
  // City-search dropdown
  cidadeSearchTerm: string
  setCidadeSearchTerm: React.Dispatch<React.SetStateAction<string>>
  cidadeSelectOpen: boolean
  setCidadeSelectOpen: React.Dispatch<React.SetStateAction<boolean>>
  // Derived
  cidadesDisponiveis: string[]
  cidadesCarregando: boolean
  cidadesFiltradas: string[]
  cidadeManualDigitada: string
  cidadeManualDisponivel: boolean
  /**
   * Lazily fetches (and caches) the sorted city list for the given UF.
   * Safe to call concurrently — in-flight requests are deduplicated via an
   * internal ref so only one HTTP request is ever made per UF.
   */
  ensureIbgeMunicipios: (uf: string, signal?: AbortSignal) => Promise<string[]>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIbgeMunicipios({
  clienteUfNormalizada,
  setUfsDisponiveis,
}: UseIbgeMunicipiosOptions): UseIbgeMunicipiosResult {
  const [ibgeMunicipiosPorUf, setIbgeMunicipiosPorUf] = useState<Record<string, string[]>>({})
  const [ibgeMunicipiosLoading, setIbgeMunicipiosLoading] = useState<Record<string, boolean>>({})
  const ibgeMunicipiosInFlightRef = useRef(new Map<string, Promise<string[]>>())

  const [cidadeBloqueadaPorCep, setCidadeBloqueadaPorCep] = useState(false)
  const [cidadeSearchTerm, setCidadeSearchTerm] = useState('')
  const [cidadeSelectOpen, setCidadeSelectOpen] = useState(false)

  // ── Load IBGE estados on mount ──────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController()

    const carregarEstadosIbge = async () => {
      try {
        const response = await fetch(
          'https://servicodados.ibge.gov.br/api/v1/localidades/estados',
          { signal: controller.signal },
        )

        if (!response.ok) {
          throw new Error('Falha ao buscar estados no IBGE.')
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data: IbgeEstado[] = await response.json()
        const estados = Array.isArray(data)
          ? data
              .map((item) => item?.sigla?.trim().toUpperCase())
              .filter((item): item is string => Boolean(item))
              .sort((a, b) => a.localeCompare(b, 'pt-BR'))
          : []

        if (estados.length > 0) {
          setUfsDisponiveis(estados)
        }
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'AbortError') {
          console.warn('[IBGE] Não foi possível carregar estados:', error)
        }
      }
    }

    void carregarEstadosIbge()

    return () => {
      controller.abort()
    }
  }, [setUfsDisponiveis])

  // ── ensureIbgeMunicipios ───────────────────────────────────────────────────
  const ensureIbgeMunicipios = useCallback(
    async (uf: string, signal?: AbortSignal): Promise<string[]> => {
      const normalizedUf = uf.trim().toUpperCase()

      if (!normalizedUf) {
        return []
      }

      if (ibgeMunicipiosPorUf[normalizedUf]?.length) {
        return ibgeMunicipiosPorUf[normalizedUf]
      }

      const inflight = ibgeMunicipiosInFlightRef.current.get(normalizedUf)
      if (inflight) {
        return inflight
      }

      const promise = (async () => {
        setIbgeMunicipiosLoading((prev) => ({ ...prev, [normalizedUf]: true }))

        try {
          const response = await fetch(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${normalizedUf}/municipios`,
            signal !== undefined ? { signal } : undefined,
          )

          if (!response.ok) {
            throw new Error('Falha ao buscar municípios no IBGE.')
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const data: IbgeMunicipio[] = await response.json()
          const municipios = Array.isArray(data)
            ? data
                .map((item) => item?.nome?.trim())
                .filter((item): item is string => Boolean(item))
                .sort((a, b) => a.localeCompare(b, 'pt-BR'))
            : []

          setIbgeMunicipiosPorUf((prev) => ({
            ...prev,
            [normalizedUf]: municipios,
          }))

          return municipios
        } catch (error) {
          if (!(error instanceof DOMException) || error.name !== 'AbortError') {
            console.warn('[IBGE] Não foi possível carregar municípios:', error)
          }

          setIbgeMunicipiosPorUf((prev) => ({
            ...prev,
            [normalizedUf]: prev[normalizedUf] ?? [],
          }))

          return ibgeMunicipiosPorUf[normalizedUf] ?? []
        } finally {
          ibgeMunicipiosInFlightRef.current.delete(normalizedUf)
          setIbgeMunicipiosLoading((prev) => ({ ...prev, [normalizedUf]: false }))
        }
      })()

      ibgeMunicipiosInFlightRef.current.set(normalizedUf, promise)

      return promise
    },
    [ibgeMunicipiosPorUf],
  )

  // ── Auto-load municipalities when client UF changes ─────────────────────────
  useEffect(() => {
    if (!clienteUfNormalizada) {
      return
    }

    const controller = new AbortController()
    void ensureIbgeMunicipios(clienteUfNormalizada, controller.signal)

    return () => {
      controller.abort()
    }
  }, [clienteUfNormalizada, ensureIbgeMunicipios])

  // ── Close city dropdown when CEP resolved the city ─────────────────────────
  useEffect(() => {
    if (cidadeBloqueadaPorCep) {
      setCidadeSelectOpen(false)
      setCidadeSearchTerm('')
    }
  }, [cidadeBloqueadaPorCep])

  // ── Derived values ──────────────────────────────────────────────────────────
  const cidadesDisponiveis = useMemo(() => {
    if (!clienteUfNormalizada) return [] as string[]
    return ibgeMunicipiosPorUf[clienteUfNormalizada] ?? []
  }, [clienteUfNormalizada, ibgeMunicipiosPorUf])

  const cidadesCarregando = Boolean(
    clienteUfNormalizada && ibgeMunicipiosLoading[clienteUfNormalizada],
  )

  const cidadesFiltradas = useMemo(() => {
    const termo = normalizeText(cidadeSearchTerm.trim())
    if (!termo) {
      return cidadesDisponiveis
    }
    return cidadesDisponiveis.filter((cidade) => normalizeText(cidade).includes(termo))
  }, [cidadeSearchTerm, cidadesDisponiveis])

  const cidadeManualDigitada = cidadeSearchTerm.trim()

  const cidadeManualDisponivel =
    Boolean(cidadeManualDigitada) &&
    !cidadesDisponiveis.some(
      (cidade) => normalizeText(cidade) === normalizeText(cidadeManualDigitada),
    )

  return {
    ibgeMunicipiosPorUf,
    ibgeMunicipiosLoading,
    cidadeBloqueadaPorCep,
    setCidadeBloqueadaPorCep,
    cidadeSearchTerm,
    setCidadeSearchTerm,
    cidadeSelectOpen,
    setCidadeSelectOpen,
    cidadesDisponiveis,
    cidadesCarregando,
    cidadesFiltradas,
    cidadeManualDigitada,
    cidadeManualDisponivel,
    ensureIbgeMunicipios,
  }
}
