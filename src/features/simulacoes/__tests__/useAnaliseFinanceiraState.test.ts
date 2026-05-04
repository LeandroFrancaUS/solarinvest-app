/**
 * src/features/simulacoes/__tests__/useAnaliseFinanceiraState.test.ts
 *
 * Tests for the useAnaliseFinanceiraState hook.
 *
 * Covered:
 *   1. Default state initial values match the original App.tsx declarations
 *   2. registrarDecisaoInterna sets aprovacaoStatus and ultimaDecisaoTimestamp
 *   3. toggleAprovacaoChecklist flips a single key
 *   4. Kit/frete/materialCA auto-populate when kcKwhMes changes
 *   5. analiseFinanceiraResult returns null when consumo or afCustoKit = 0
 */

// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  useAnaliseFinanceiraState,
  type UseAnaliseFinanceiraStateParams,
  type UseAnaliseFinanceiraStateReturn,
} from '../useAnaliseFinanceiraState'
import { DEFAULT_VENDAS_CONFIG } from '../../../types/vendasConfig'

// ---------------------------------------------------------------------------
// Minimal renderHook (React 18 + jsdom, no @testing-library dependency)
// ---------------------------------------------------------------------------
function renderHook(useHook: () => UseAnaliseFinanceiraStateReturn): {
  result: { current: UseAnaliseFinanceiraStateReturn }
  unmount: () => void
} {
  const result = { current: null as unknown as UseAnaliseFinanceiraStateReturn }
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)

  function TestComponent() {
    result.current = useHook()
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(TestComponent))
  })

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

// ---------------------------------------------------------------------------
// Default params — produce a fully-initialised hook with safe zero inputs
// ---------------------------------------------------------------------------
const DEFAULT_PARAMS: UseAnaliseFinanceiraStateParams = {
  kcKwhMes: 0,
  simulacoesSection: 'nova',
  vendasConfig: DEFAULT_VENDAS_CONFIG,
  baseIrradiacao: 5.0,
  eficienciaNormalizada: 0.8,
  diasMesNormalizado: 30,
  potenciaModulo: 550,
  ufTarifa: 'GO',
  tarifaCheia: 0.9,
  descontoConsiderado: 0,
  inflacaoAa: 5,
  taxaMinima: 0,
  taxaMinimaInputEmpty: false,
  tipoRede: 'monofasico',
  tusdPercent: 0,
  tusdTipoCliente: 'residencial',
  tusdSubtipo: '',
  tusdSimultaneidade: null,
  tusdTarifaRkwh: null,
  tusdAnoReferencia: 2024,
  mesReajuste: 6,
  mesReferencia: 1,
  vendaFormAplicaTaxaMinima: true,
  encargosFixos: 0,
  cidKwhBase: 0,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAnaliseFinanceiraState', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('1 — initial aprovacaoStatus is pendente', () => {
    const { result, unmount } = renderHook(() =>
      useAnaliseFinanceiraState(DEFAULT_PARAMS),
    )
    expect(result.current.aprovacaoStatus).toBe('pendente')
    expect(result.current.ultimaDecisaoTimestamp).toBeNull()
    unmount()
  })

  it('2 — registrarDecisaoInterna sets aprovacaoStatus and timestamp', () => {
    const { result, unmount } = renderHook(() =>
      useAnaliseFinanceiraState(DEFAULT_PARAMS),
    )

    act(() => {
      result.current.registrarDecisaoInterna('aprovado')
    })

    expect(result.current.aprovacaoStatus).toBe('aprovado')
    expect(result.current.ultimaDecisaoTimestamp).toBeGreaterThan(0)
    unmount()
  })

  it('3 — toggleAprovacaoChecklist flips the roi key', () => {
    const { result, unmount } = renderHook(() =>
      useAnaliseFinanceiraState(DEFAULT_PARAMS),
    )

    const initialRoi = result.current.aprovacaoChecklist.roi // true by default
    act(() => {
      result.current.toggleAprovacaoChecklist('roi')
    })
    expect(result.current.aprovacaoChecklist.roi).toBe(!initialRoi)
    unmount()
  })

  it('4 — kit/frete auto-populate when kcKwhMes is non-zero', () => {
    const params: UseAnaliseFinanceiraStateParams = { ...DEFAULT_PARAMS, kcKwhMes: 400 }
    const { result, unmount } = renderHook(() =>
      useAnaliseFinanceiraState(params),
    )

    // Kit  : round(1500 + 9.5 × 400) = round(5300) = 5300
    // Frete: round(300  + 0.52 × 400) = round(508) = 508
    expect(result.current.afCustoKit).toBe(5300)
    expect(result.current.afFrete).toBe(508)
    unmount()
  })

  it('5 — analiseFinanceiraResult is null when consumo or kit = 0', () => {
    const { result, unmount } = renderHook(() =>
      useAnaliseFinanceiraState(DEFAULT_PARAMS),
    )
    // DEFAULT_PARAMS has kcKwhMes = 0 so consumo = 0 → null
    expect(result.current.analiseFinanceiraResult).toBeNull()
    unmount()
  })

  it('6 — default afModo is venda', () => {
    const { result, unmount } = renderHook(() =>
      useAnaliseFinanceiraState(DEFAULT_PARAMS),
    )
    expect(result.current.afModo).toBe('venda')
    unmount()
  })

  it('7 — default numeric params match original App.tsx values', () => {
    const { result, unmount } = renderHook(() =>
      useAnaliseFinanceiraState(DEFAULT_PARAMS),
    )
    expect(result.current.afImpostosVenda).toBe(6)
    expect(result.current.afImpostosLeasing).toBe(4)
    expect(result.current.afInadimplencia).toBe(2)
    expect(result.current.afCustoOperacional).toBe(3)
    expect(result.current.afMesesProjecao).toBe(60)
    expect(result.current.afMargemLiquidaVenda).toBe(25)
    expect(result.current.afMargemLiquidaMinima).toBe(15)
    expect(result.current.afComissaoMinimaPercent).toBe(5)
    expect(result.current.afTaxaDesconto).toBe(20)
    expect(result.current.afPlaca).toBe(18)
    unmount()
  })
})
