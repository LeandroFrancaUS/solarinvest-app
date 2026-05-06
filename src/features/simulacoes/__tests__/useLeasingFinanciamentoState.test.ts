/**
 * src/features/simulacoes/__tests__/useLeasingFinanciamentoState.test.ts
 *
 * Tests for the useLeasingFinanciamentoState hook extracted from App.tsx.
 *
 * Covered:
 *   1. Initial values match INITIAL_VALUES
 *   2. setJurosFinAa updates jurosFinAa
 *   3. setPrazoFinMeses updates prazoFinMeses
 *   4. setEntradaFinPct updates entradaFinPct
 *   5. setMostrarFinanciamento toggles boolean
 *   6. setMostrarGrafico toggles boolean
 *   7. setEntradaModo updates entradaModo
 *   8. gerandoTabelaTransferencia starts as false and can be set to true
 *   9. All table visibility flags start as false
 */

// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, afterEach } from 'vitest'
import { INITIAL_VALUES } from '../../../app/config'
import {
  useLeasingFinanciamentoState,
  type UseLeasingFinanciamentoStateResult,
} from '../useLeasingFinanciamentoState'

// ---------------------------------------------------------------------------
// Minimal renderHook (React 18 + jsdom, no @testing-library dependency)
// ---------------------------------------------------------------------------

function renderHook(): {
  result: { current: UseLeasingFinanciamentoStateResult }
  unmount: () => void
} {
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)
  const result = { current: null as unknown as UseLeasingFinanciamentoStateResult }

  function HookCapture() {
    result.current = useLeasingFinanciamentoState()
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLeasingFinanciamentoState', () => {
  let unmount: () => void

  afterEach(() => {
    unmount?.()
  })

  // 1. Initial values
  it('initial values match INITIAL_VALUES', () => {
    const { result, unmount: u } = renderHook()
    unmount = u

    expect(result.current.jurosFinAa).toBe(INITIAL_VALUES.jurosFinanciamentoAa)
    expect(result.current.prazoFinMeses).toBe(INITIAL_VALUES.prazoFinanciamentoMeses)
    expect(result.current.entradaFinPct).toBe(INITIAL_VALUES.entradaFinanciamentoPct)
    expect(result.current.mostrarFinanciamento).toBe(INITIAL_VALUES.mostrarFinanciamento)
    expect(result.current.mostrarGrafico).toBe(INITIAL_VALUES.mostrarGrafico)
    expect(result.current.prazoMeses).toBe(INITIAL_VALUES.prazoMeses)
    expect(result.current.bandeiraEncargo).toBe(INITIAL_VALUES.bandeiraEncargo)
    expect(result.current.cipEncargo).toBe(INITIAL_VALUES.cipEncargo)
    expect(result.current.entradaRs).toBe(INITIAL_VALUES.entradaRs)
    expect(result.current.entradaModo).toBe(INITIAL_VALUES.entradaModo)
    expect(result.current.mostrarValorMercadoLeasing).toBe(INITIAL_VALUES.mostrarValorMercadoLeasing)
  })

  // 2. setJurosFinAa
  it('setJurosFinAa updates jurosFinAa', () => {
    const { result, unmount: u } = renderHook()
    unmount = u

    act(() => {
      result.current.setJurosFinAa(12)
    })
    expect(result.current.jurosFinAa).toBe(12)
  })

  // 3. setPrazoFinMeses
  it('setPrazoFinMeses updates prazoFinMeses', () => {
    const { result, unmount: u } = renderHook()
    unmount = u

    act(() => {
      result.current.setPrazoFinMeses(60)
    })
    expect(result.current.prazoFinMeses).toBe(60)
  })

  // 4. setEntradaFinPct
  it('setEntradaFinPct updates entradaFinPct', () => {
    const { result, unmount: u } = renderHook()
    unmount = u

    act(() => {
      result.current.setEntradaFinPct(30)
    })
    expect(result.current.entradaFinPct).toBe(30)
  })

  // 5. setMostrarFinanciamento
  it('setMostrarFinanciamento toggles the boolean', () => {
    const { result, unmount: u } = renderHook()
    unmount = u

    act(() => {
      result.current.setMostrarFinanciamento(true)
    })
    expect(result.current.mostrarFinanciamento).toBe(true)
  })

  // 6. setMostrarGrafico
  it('setMostrarGrafico can be toggled to false', () => {
    const { result, unmount: u } = renderHook()
    unmount = u

    act(() => {
      result.current.setMostrarGrafico(false)
    })
    expect(result.current.mostrarGrafico).toBe(false)
  })

  // 7. setEntradaModo
  it('setEntradaModo updates entradaModo', () => {
    const { result, unmount: u } = renderHook()
    unmount = u

    act(() => {
      result.current.setEntradaModo('Reduz piso contratado')
    })
    expect(result.current.entradaModo).toBe('Reduz piso contratado')
  })

  // 8. gerandoTabelaTransferencia starts false
  it('gerandoTabelaTransferencia starts as false and can be set', () => {
    const { result, unmount: u } = renderHook()
    unmount = u

    expect(result.current.gerandoTabelaTransferencia).toBe(false)

    act(() => {
      result.current.setGerandoTabelaTransferencia(true)
    })
    expect(result.current.gerandoTabelaTransferencia).toBe(true)
  })

  // 9. Table visibility flags
  it('all table visibility flags start as false (tabelaVisivel)', () => {
    const { result, unmount: u } = renderHook()
    unmount = u

    expect(result.current.mostrarTabelaParcelas).toBe(INITIAL_VALUES.tabelaVisivel)
    expect(result.current.mostrarTabelaBuyout).toBe(INITIAL_VALUES.tabelaVisivel)
    expect(result.current.mostrarTabelaParcelasConfig).toBe(INITIAL_VALUES.tabelaVisivel)
    expect(result.current.mostrarTabelaBuyoutConfig).toBe(INITIAL_VALUES.tabelaVisivel)
  })
})
