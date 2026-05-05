// src/features/simulacoes/usePrecheckNormativo.ts
//
// Extracted from App.tsx. Encapsulates the pre-check normativo modal state
// and its associated callbacks for building, upserting, and removing
// pre-check observation text blocks.
//
// Zero behavioural change — exact same logic as the original App.tsx block.

import { useCallback, useRef, useState } from 'react'
import type React from 'react'
import {
  formatTipoLigacaoLabel,
  type NormComplianceResult,
  type NormComplianceStatus,
  type PrecheckDecision,
  type PrecheckDecisionAction,
  type TipoLigacaoNorma,
} from '../../domain/normas/padraoEntradaRules'
import { formatNumberBRWithOptions } from '../../lib/locale/br-number'

// ─── Params ───────────────────────────────────────────────────────────────────

export interface UsePrecheckNormativoParams {
  setConfiguracaoUsinaObservacoes: React.Dispatch<React.SetStateAction<string>>
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UsePrecheckNormativoResult {
  precheckClienteCiente: boolean
  setPrecheckClienteCiente: React.Dispatch<React.SetStateAction<boolean>>
  precheckModalData: NormComplianceResult | null
  setPrecheckModalData: React.Dispatch<React.SetStateAction<NormComplianceResult | null>>
  precheckModalClienteCiente: boolean
  setPrecheckModalClienteCiente: React.Dispatch<React.SetStateAction<boolean>>
  buildPrecheckObservationText: (params: {
    result: NormComplianceResult
    action: PrecheckDecisionAction
    clienteCiente: boolean
    potenciaAplicada?: number
    tipoLigacaoAplicada?: TipoLigacaoNorma
  }) => string
  isPrecheckObservationTextValid: (text: string) => boolean
  buildPrecheckObservationBlock: (params: {
    result: NormComplianceResult
    action: PrecheckDecisionAction
    clienteCiente: boolean
    potenciaAplicada?: number
    tipoLigacaoAplicada?: TipoLigacaoNorma
  }) => string
  cleanPrecheckObservation: (value: string) => string
  upsertPrecheckObservation: (block: string) => void
  removePrecheckObservation: () => void
  requestPrecheckDecision: (result: NormComplianceResult) => Promise<PrecheckDecision>
  resolvePrecheckDecision: (decision: PrecheckDecision) => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePrecheckNormativo(
  params: UsePrecheckNormativoParams,
): UsePrecheckNormativoResult {
  const { setConfiguracaoUsinaObservacoes } = params

  const [precheckClienteCiente, setPrecheckClienteCiente] = useState(false)
  const [precheckModalData, setPrecheckModalData] = useState<NormComplianceResult | null>(null)
  const [precheckModalClienteCiente, setPrecheckModalClienteCiente] = useState(false)
  const precheckDecisionResolverRef = useRef<((value: PrecheckDecision) => void) | null>(null)

  const buildPrecheckObservationText = useCallback(
    (params: {
      result: NormComplianceResult
      action: PrecheckDecisionAction
      clienteCiente: boolean
      potenciaAplicada?: number
      tipoLigacaoAplicada?: TipoLigacaoNorma
    }) => {
      const { result, action: _action, clienteCiente: _clienteCiente, tipoLigacaoAplicada } = params
      const tipoLabel = formatTipoLigacaoLabel(tipoLigacaoAplicada ?? result.tipoLigacao)
      const upgradeLabel =
        result.upgradeTo && result.upgradeTo !== result.tipoLigacao
          ? formatTipoLigacaoLabel(result.upgradeTo)
          : null

      const formatKw = (value?: number | null) =>
        value != null
          ? formatNumberBRWithOptions(value, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })
          : '—'

      const statusTextMap: Record<NormComplianceStatus, string> = {
        OK: 'dentro do limite do padrão',
        WARNING: 'regra provisória',
        FORA_DA_NORMA: 'acima do limite do padrão',
        LIMITADO: 'acima do limite mesmo com upgrade',
      }

      const recomendacao =
        upgradeLabel && result.kwMaxUpgrade != null
          ? `upgrade do padrão de entrada para ${upgradeLabel.toLowerCase()} (até ${formatKw(
              result.kwMaxUpgrade,
            )} kW)`
          : 'sem upgrade sugerido para este caso'
      return [
        `Pré-check normativo (${result.uf}).`,
        `Tipo de ligação informado: ${tipoLabel}.`,
        `Potência informada: ${formatKw(result.potenciaInversorKw)} kW (limite do padrão: ${formatKw(
          result.kwMaxPermitido,
        )} kW).`,
        `Situação: ${statusTextMap[result.status]}.`,
        `Recomendação: ${recomendacao}.`,
      ].join('\n')
    },
    [],
  )

  const isPrecheckObservationTextValid = useCallback((text: string) => {
    const lines = text.split('\n')
    if (lines.length > 5) return false
    if (lines.some((line) => line.trim().length === 0)) return false
    if (lines.some((line) => line.length > 120)) return false
    if (/(\[PRECHECK|{|}|<|>|•)/.test(text)) return false
    if (/cliente ciente/i.test(text)) return false
    if (/[\u{1F300}-\u{1FAFF}]/u.test(text)) return false
    return true
  }, [])

  const buildPrecheckObservationBlock = useCallback(
    (params: {
      result: NormComplianceResult
      action: PrecheckDecisionAction
      clienteCiente: boolean
      potenciaAplicada?: number
      tipoLigacaoAplicada?: TipoLigacaoNorma
    }) => buildPrecheckObservationText(params),
    [buildPrecheckObservationText],
  )

  const cleanPrecheckObservation = useCallback((value: string) => {
    return value
      .replace(/(^|\n)Pré-check normativo[\s\S]*?(?:\n{2,}|$)/g, '$1')
      .split('\n')
      .filter((line) => !/Pré-check normativo|\[PRECHECK|\{|\}|•|Cliente ciente/i.test(line))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }, [])

  const upsertPrecheckObservation = useCallback(
    (block: string) => {
      setConfiguracaoUsinaObservacoes((prev) => {
        const cleaned = cleanPrecheckObservation(prev)
        if (!cleaned) {
          return block
        }
        return `${cleaned}\n\n${block}`
      })
    },
    [cleanPrecheckObservation, setConfiguracaoUsinaObservacoes],
  )

  const removePrecheckObservation = useCallback(() => {
    setConfiguracaoUsinaObservacoes((prev) => cleanPrecheckObservation(prev))
  }, [cleanPrecheckObservation, setConfiguracaoUsinaObservacoes])

  const requestPrecheckDecision = useCallback(
    (result: NormComplianceResult) =>
      new Promise<PrecheckDecision>((resolve) => {
        precheckDecisionResolverRef.current = resolve
        setPrecheckModalData(result)
        setPrecheckModalClienteCiente(precheckClienteCiente)
      }),
    [precheckClienteCiente],
  )

  const resolvePrecheckDecision = useCallback((decision: PrecheckDecision) => {
    precheckDecisionResolverRef.current?.(decision)
    precheckDecisionResolverRef.current = null
    setPrecheckModalData(null)
  }, [])

  return {
    precheckClienteCiente,
    setPrecheckClienteCiente,
    precheckModalData,
    setPrecheckModalData,
    precheckModalClienteCiente,
    setPrecheckModalClienteCiente,
    buildPrecheckObservationText,
    isPrecheckObservationTextValid,
    buildPrecheckObservationBlock,
    cleanPrecheckObservation,
    upsertPrecheckObservation,
    removePrecheckObservation,
    requestPrecheckDecision,
    resolvePrecheckDecision,
  }
}
