/**
 * src/features/simulacoes/__tests__/usePrecheckNormativo.test.ts
 *
 * Tests for the usePrecheckNormativo hook extracted from App.tsx.
 *
 * Covered:
 *   1. Initial state — precheckClienteCiente=false, precheckModalData=null
 *   2. setPrecheckClienteCiente updates state
 *   3. isPrecheckObservationTextValid rejects text with more than 5 lines
 *   4. isPrecheckObservationTextValid rejects text with empty lines
 *   5. isPrecheckObservationTextValid rejects text with forbidden chars
 *   6. isPrecheckObservationTextValid accepts valid text
 *   7. cleanPrecheckObservation strips pré-check normativo lines
 *   8. upsertPrecheckObservation appends block to existing text
 *   9. upsertPrecheckObservation sets block when existing text is empty
 *  10. removePrecheckObservation cleans the observation
 *  11. requestPrecheckDecision sets precheckModalData
 *  12. resolvePrecheckDecision clears precheckModalData
 */

// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  usePrecheckNormativo,
  type UsePrecheckNormativoResult,
} from '../usePrecheckNormativo'
import type { NormComplianceResult } from '../../../domain/normas/padraoEntradaRules'

// ---------------------------------------------------------------------------
// Minimal renderHook (React 18 + jsdom, no @testing-library dependency)
// ---------------------------------------------------------------------------

function renderHook(setObservacoes: React.Dispatch<React.SetStateAction<string>>): {
  result: { current: UsePrecheckNormativoResult }
  unmount: () => void
} {
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)
  const result = { current: null as unknown as UsePrecheckNormativoResult }

  function HookCapture() {
    result.current = usePrecheckNormativo({ setConfiguracaoUsinaObservacoes: setObservacoes })
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(HookCapture))
  })

  return {
    result,
    unmount: () => {
      act(() => root.unmount())
      document.body.removeChild(container)
    },
  }
}

// Minimal NormComplianceResult fixture
const makeResult = (overrides?: Partial<NormComplianceResult>): NormComplianceResult => ({
  uf: 'SP',
  status: 'OK',
  tipoLigacao: 'MONOFASICO',
  potenciaInversorKw: 5,
  message: 'OK',
  kwMaxPermitido: 6,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePrecheckNormativo', () => {
  let unmount: () => void

  afterEach(() => {
    unmount?.()
    vi.restoreAllMocks()
  })

  // 1. Initial state
  it('initial state: precheckClienteCiente=false, precheckModalData=null', () => {
    const setter = vi.fn()
    const { result, unmount: u } = renderHook(setter)
    unmount = u

    expect(result.current.precheckClienteCiente).toBe(false)
    expect(result.current.precheckModalData).toBeNull()
    expect(result.current.precheckModalClienteCiente).toBe(false)
  })

  // 2. setPrecheckClienteCiente
  it('setPrecheckClienteCiente updates the state', () => {
    const setter = vi.fn()
    const { result, unmount: u } = renderHook(setter)
    unmount = u

    act(() => {
      result.current.setPrecheckClienteCiente(true)
    })
    expect(result.current.precheckClienteCiente).toBe(true)
  })

  // 3. isPrecheckObservationTextValid — too many lines
  it('isPrecheckObservationTextValid rejects text with more than 5 lines', () => {
    const setter = vi.fn()
    const { result, unmount: u } = renderHook(setter)
    unmount = u

    const text = 'a\nb\nc\nd\ne\nf'
    expect(result.current.isPrecheckObservationTextValid(text)).toBe(false)
  })

  // 4. isPrecheckObservationTextValid — empty lines
  it('isPrecheckObservationTextValid rejects text with empty lines', () => {
    const setter = vi.fn()
    const { result, unmount: u } = renderHook(setter)
    unmount = u

    const text = 'linha1\n\nlinha2'
    expect(result.current.isPrecheckObservationTextValid(text)).toBe(false)
  })

  // 5. isPrecheckObservationTextValid — forbidden chars
  it('isPrecheckObservationTextValid rejects text with forbidden chars', () => {
    const setter = vi.fn()
    const { result, unmount: u } = renderHook(setter)
    unmount = u

    expect(result.current.isPrecheckObservationTextValid('[PRECHECK] algo')).toBe(false)
    expect(result.current.isPrecheckObservationTextValid('texto {}')).toBe(false)
  })

  // 6. isPrecheckObservationTextValid — valid text
  it('isPrecheckObservationTextValid accepts valid 5-line text', () => {
    const setter = vi.fn()
    const { result, unmount: u } = renderHook(setter)
    unmount = u

    const text = 'Linha um.\nLinha dois.\nLinha três.\nLinha quatro.\nLinha cinco.'
    expect(result.current.isPrecheckObservationTextValid(text)).toBe(true)
  })

  // 7. cleanPrecheckObservation
  it('cleanPrecheckObservation removes pré-check normativo block', () => {
    const setter = vi.fn()
    const { result, unmount: u } = renderHook(setter)
    unmount = u

    const input = 'Texto anterior.\n\nPré-check normativo (SP).\nAlguma linha.\n\nTexto após.'
    const cleaned = result.current.cleanPrecheckObservation(input)
    expect(cleaned).not.toContain('Pré-check normativo')
    expect(cleaned).toContain('Texto após.')
  })

  // 8. upsertPrecheckObservation — appends to existing text
  it('upsertPrecheckObservation appends block to non-empty existing text', () => {
    let observacoes = 'Texto existente.'
    const setter: React.Dispatch<React.SetStateAction<string>> = (updater) => {
      if (typeof updater === 'function') {
        observacoes = updater(observacoes)
      } else {
        observacoes = updater
      }
    }
    const { result, unmount: u } = renderHook(setter)
    unmount = u

    act(() => {
      result.current.upsertPrecheckObservation('Novo bloco.')
    })

    expect(observacoes).toContain('Texto existente.')
    expect(observacoes).toContain('Novo bloco.')
  })

  // 9. upsertPrecheckObservation — empty existing text
  it('upsertPrecheckObservation sets block when existing text is empty', () => {
    let observacoes = ''
    const setter: React.Dispatch<React.SetStateAction<string>> = (updater) => {
      if (typeof updater === 'function') {
        observacoes = updater(observacoes)
      } else {
        observacoes = updater
      }
    }
    const { result, unmount: u } = renderHook(setter)
    unmount = u

    act(() => {
      result.current.upsertPrecheckObservation('Bloco único.')
    })

    expect(observacoes).toBe('Bloco único.')
  })

  // 10. removePrecheckObservation
  it('removePrecheckObservation strips the precheck block', () => {
    let observacoes = 'Pré-check normativo (SP).\nLinha dois.'
    const setter: React.Dispatch<React.SetStateAction<string>> = (updater) => {
      if (typeof updater === 'function') {
        observacoes = updater(observacoes)
      } else {
        observacoes = updater
      }
    }
    const { result, unmount: u } = renderHook(setter)
    unmount = u

    act(() => {
      result.current.removePrecheckObservation()
    })

    expect(observacoes).not.toContain('Pré-check normativo')
  })

  // 11. requestPrecheckDecision sets precheckModalData
  it('requestPrecheckDecision sets precheckModalData to the given result', () => {
    const setter = vi.fn()
    const { result, unmount: u } = renderHook(setter)
    unmount = u

    const mockResult = makeResult({ status: 'FORA_DA_NORMA' })

    act(() => {
      void result.current.requestPrecheckDecision(mockResult)
    })

    expect(result.current.precheckModalData).toEqual(mockResult)
  })

  // 12. resolvePrecheckDecision clears precheckModalData
  it('resolvePrecheckDecision clears precheckModalData', async () => {
    const setter = vi.fn()
    const { result, unmount: u } = renderHook(setter)
    unmount = u

    const mockResult = makeResult()
    let resolved: { action: string; clienteCiente: boolean } | undefined

    act(() => {
      void result.current.requestPrecheckDecision(mockResult).then((d) => {
        resolved = d
      })
    })

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    act(() => {
      result.current.resolvePrecheckDecision({ action: 'proceed', clienteCiente: false })
    })

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0))
    })

    expect(resolved).toEqual({ action: 'proceed', clienteCiente: false })
    expect(result.current.precheckModalData).toBeNull()
  })
})
