/**
 * src/features/simulacoes/__tests__/useAneelTarifaState.test.ts
 *
 * Tests for the useAneelTarifaState hook.
 *
 * The hook is a stateless effects/callbacks manager — all useState lives in
 * the caller (App.tsx in production). Tests drive it by passing vi.fn() spies
 * for the raw setters, so we can verify wrapper behaviour independently of
 * async effects.
 *
 * Covered:
 *   1.  setTarifaCheia — calls setTarifaCheiaState with normalised value
 *   2.  setTarifaCheia — normalises negative values to 0
 *   3.  setTarifaCheia — no-op in pageSharedState when value unchanged
 *   4.  setTaxaMinima — calls setTaxaMinimaState + clears inputEmpty when >0
 *   5.  setTaxaMinima normalises negative to 0
 *   6.  normalizeTaxaMinimaInputValue("") → 0, sets inputEmpty=true
 *   7.  normalizeTaxaMinimaInputValue("0.5") → 0.5, clears inputEmpty
 *   8.  setUfTarifa — calls setUfTarifaState + updates pageSharedState
 *   9.  setDistribuidoraTarifa — calls setDistribuidoraTarifaState + updates pageSharedState
 *  10.  distribuidorasDisponiveis memo — returns list for ufTarifa
 *  11.  clienteDistribuidorasDisponiveis memo — returns empty for unknown UF
 *  12.  distribuidoraTarifa sync effect — calls setDistribuidoraTarifaState when efetiva differs
 *  13.  loadDistribuidorasAneel effect — calls setUfsDisponiveis + setDistribuidorasPorUf
 *  14.  auto-select effect — picks sole distribuidora when list has length 1
 *  15.  auto-select effect — clears distribuidoraTarifa when ufTarifa is empty
 */

// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import {
  useAneelTarifaState,
  type UseAneelTarifaStateOptions,
  type UseAneelTarifaStateResult,
} from '../useAneelTarifaState'
import type { PageSharedSettings } from '../../../types/orcamentoTypes'

// ---------------------------------------------------------------------------
// Module mocks — prevent real HTTP calls
// ---------------------------------------------------------------------------

vi.mock('../../../utils/reajusteAneel', () => ({
  getMesReajusteFromANEEL: vi.fn().mockResolvedValue(6),
}))

vi.mock('../../../utils/tarifaAneel', () => ({
  getTarifaCheia: vi.fn().mockResolvedValue(1.14),
}))

vi.mock('../../../utils/distribuidorasAneel', () => ({
  loadDistribuidorasAneel: vi.fn().mockResolvedValue({
    ufs: ['GO', 'SP'],
    distribuidorasPorUf: {
      GO: ['Equatorial Goiás'],
      SP: ['Enel São Paulo', 'CPFL'],
    },
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INITIAL_PAGE_SHARED: PageSharedSettings = {
  kcKwhMes: 0,
  tarifaCheia: 1.14,
  taxaMinima: 0,
  ufTarifa: 'GO',
  distribuidoraTarifa: 'Equatorial Goiás',
  potenciaModulo: 550,
  numeroModulosManual: '',
  segmentoCliente: 'residencial',
  tipoInstalacao: 'fibrocimento',
  tipoInstalacaoOutro: '',
  tipoSistema: 'ON_GRID',
  consumoManual: false,
  potenciaFonteManual: false,
  potenciaModuloDirty: false,
  tipoInstalacaoDirty: false,
}

/** Build a default options object with all raw setters as vi.fn() spies */
function makeOptions(
  override: Partial<UseAneelTarifaStateOptions> = {},
): UseAneelTarifaStateOptions & { capturedPageShared: PageSharedSettings } {
  const captured = { ...INITIAL_PAGE_SHARED }
  return {
    ufTarifa: 'GO',
    distribuidoraTarifa: 'Equatorial Goiás',
    distribuidorasPorUf: { GO: ['Equatorial Goiás'] },
    tarifaCheia: 1.14,
    taxaMinima: 0,
    setUfTarifaState: vi.fn(),
    setDistribuidoraTarifaState: vi.fn(),
    setUfsDisponiveis: vi.fn(),
    setDistribuidorasPorUf: vi.fn(),
    setMesReajuste: vi.fn(),
    setTarifaCheiaState: vi.fn(),
    setTaxaMinimaState: vi.fn(),
    setTaxaMinimaInputEmpty: vi.fn(),
    distribuidoraAneelEfetiva: 'Equatorial Goiás',
    clienteUf: 'GO',
    updatePageSharedState: (updater) => {
      Object.assign(captured, updater(captured))
    },
    capturedPageShared: captured,
    ...override,
  }
}

type HookRef = { current: UseAneelTarifaStateResult }

function renderHook(opts: UseAneelTarifaStateOptions): {
  result: HookRef
  unmount: () => void
} {
  const result: HookRef = { current: null as unknown as UseAneelTarifaStateResult }
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)

  function Harness() {
    result.current = useAneelTarifaState(opts)
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(Harness))
  })

  return {
    result,
    unmount() {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAneelTarifaState', () => {
  let unmount: () => void

  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { unmount?.() })

  // ── Wrapper setters ─────────────────────────────────────────────────────────

  it('1. setTarifaCheia calls setTarifaCheiaState with normalised value', () => {
    const opts = makeOptions()
    const { result, unmount: u } = renderHook(opts)
    unmount = u
    act(() => { result.current.setTarifaCheia(1.5) })
    expect(opts.setTarifaCheiaState).toHaveBeenCalledWith(1.5)
  })

  it('2. setTarifaCheia normalises negative to 0', () => {
    const opts = makeOptions({ distribuidoraAneelEfetiva: '', clienteUf: '' })
    const { result, unmount: u } = renderHook(opts)
    unmount = u
    act(() => { result.current.setTarifaCheia(-3) })
    expect(opts.setTarifaCheiaState).toHaveBeenCalledWith(0)
  })

  it('3. setTarifaCheia does not update pageSharedState when value unchanged', () => {
    const opts = makeOptions({ tarifaCheia: 1.14 })
    const captured = opts.capturedPageShared
    const { result, unmount: u } = renderHook(opts)
    unmount = u
    const snapBefore = captured.tarifaCheia
    act(() => { result.current.setTarifaCheia(1.14) })
    expect(captured.tarifaCheia).toBe(snapBefore)
  })

  it('4. setTaxaMinima calls setTaxaMinimaState and clears inputEmpty when >0', () => {
    const opts = makeOptions()
    const { result, unmount: u } = renderHook(opts)
    unmount = u
    act(() => { result.current.setTaxaMinima(0.3) })
    expect(opts.setTaxaMinimaState).toHaveBeenCalledWith(0.3)
    // setTaxaMinimaInputEmpty called with false-producing updater
    expect(opts.setTaxaMinimaInputEmpty).toHaveBeenCalled()
  })

  it('5. setTaxaMinima normalises negative to 0', () => {
    const opts = makeOptions()
    const { result, unmount: u } = renderHook(opts)
    unmount = u
    act(() => { result.current.setTaxaMinima(-1) })
    expect(opts.setTaxaMinimaState).toHaveBeenCalledWith(0)
  })

  it('6. normalizeTaxaMinimaInputValue("") sets inputEmpty=true and returns 0', () => {
    const opts = makeOptions()
    const { result, unmount: u } = renderHook(opts)
    unmount = u
    let returned: number
    act(() => { returned = result.current.normalizeTaxaMinimaInputValue('') })
    expect(returned!).toBe(0)
    expect(opts.setTaxaMinimaInputEmpty).toHaveBeenCalledWith(true)
  })

  it('7. normalizeTaxaMinimaInputValue("0.5") clears inputEmpty and returns 0.5', () => {
    const opts = makeOptions()
    const { result, unmount: u } = renderHook(opts)
    unmount = u
    let returned: number
    act(() => { returned = result.current.normalizeTaxaMinimaInputValue('0.5') })
    expect(returned!).toBe(0.5)
    expect(opts.setTaxaMinimaState).toHaveBeenCalledWith(0.5)
    expect(opts.setTaxaMinimaInputEmpty).toHaveBeenCalledWith(false)
  })

  it('8. setUfTarifa calls setUfTarifaState and updates pageSharedState', () => {
    const opts = makeOptions({ ufTarifa: 'GO' })
    const captured = opts.capturedPageShared
    const { result, unmount: u } = renderHook(opts)
    unmount = u
    act(() => { result.current.setUfTarifa('SP') })
    expect(opts.setUfTarifaState).toHaveBeenCalledWith('SP')
    expect(captured.ufTarifa).toBe('SP')
  })

  it('9. setDistribuidoraTarifa calls setDistribuidoraTarifaState and updates pageSharedState', () => {
    const opts = makeOptions({ distribuidoraTarifa: 'Equatorial Goiás' })
    const captured = opts.capturedPageShared
    const { result, unmount: u } = renderHook(opts)
    unmount = u
    act(() => { result.current.setDistribuidoraTarifa('CPFL') })
    expect(opts.setDistribuidoraTarifaState).toHaveBeenCalledWith('CPFL')
    expect(captured.distribuidoraTarifa).toBe('CPFL')
  })

  // ── Derived memos ────────────────────────────────────────────────────────────

  it('10. distribuidorasDisponiveis returns list for ufTarifa', () => {
    const opts = makeOptions({
      ufTarifa: 'SP',
      distribuidorasPorUf: { SP: ['Enel São Paulo', 'CPFL'] },
    })
    const { result, unmount: u } = renderHook(opts)
    unmount = u
    expect(result.current.distribuidorasDisponiveis).toEqual(['Enel São Paulo', 'CPFL'])
  })

  it('11. clienteDistribuidorasDisponiveis returns empty for unknown UF', () => {
    const opts = makeOptions({ clienteUf: 'XX', distribuidorasPorUf: {} })
    const { result, unmount: u } = renderHook(opts)
    unmount = u
    expect(result.current.clienteDistribuidorasDisponiveis).toEqual([])
  })

  // ── Effects ──────────────────────────────────────────────────────────────────

  it('12. sync effect calls setDistribuidoraTarifaState when efetiva differs', async () => {
    const opts = makeOptions({
      distribuidoraTarifa: 'OLD',
      distribuidoraAneelEfetiva: 'Equatorial Goiás',
    })
    const { unmount: u } = renderHook(opts)
    unmount = u
    await act(async () => {})
    // The sync effect should have called setDistribuidoraTarifaState('Equatorial Goiás')
    expect(opts.setDistribuidoraTarifaState).toHaveBeenCalledWith('Equatorial Goiás')
  })

  it('13. loadDistribuidorasAneel effect calls setUfsDisponiveis + setDistribuidorasPorUf', async () => {
    const opts = makeOptions()
    const { unmount: u } = renderHook(opts)
    unmount = u
    await act(async () => {})
    expect(opts.setUfsDisponiveis).toHaveBeenCalledWith(['GO', 'SP'])
    expect(opts.setDistribuidorasPorUf).toHaveBeenCalled()
  })

  it('14. auto-select effect picks sole distribuidora when list has length 1', async () => {
    const opts = makeOptions({
      ufTarifa: 'GO',
      distribuidoraTarifa: '',
      distribuidorasPorUf: { GO: ['Equatorial Goiás'] },
      distribuidoraAneelEfetiva: 'Equatorial Goiás',
    })
    const { unmount: u } = renderHook(opts)
    unmount = u
    await act(async () => {})
    // The auto-select effect calls setDistribuidoraTarifaState with an updater function
    // or with 'Equatorial Goiás' directly when lista.length === 1
    const calls = vi.mocked(opts.setDistribuidoraTarifaState).mock.calls
    const hasAutoSelect = calls.some((args) => {
      const arg = args[0]
      if (typeof arg === 'string') return arg === 'Equatorial Goiás'
      if (typeof arg === 'function') {
        const fn = arg as (prev: string) => string
        return fn('') === 'Equatorial Goiás'
      }
      return false
    })
    expect(hasAutoSelect).toBe(true)
  })

  it('15. auto-select effect clears distribuidoraTarifa when ufTarifa is empty', async () => {
    const opts = makeOptions({
      ufTarifa: '',
      distribuidoraTarifa: 'Equatorial Goiás',
      distribuidorasPorUf: { GO: ['Equatorial Goiás'] },
      distribuidoraAneelEfetiva: '',
    })
    const { unmount: u } = renderHook(opts)
    unmount = u
    await act(async () => {})
    expect(opts.setDistribuidoraTarifaState).toHaveBeenCalledWith('')
  })
})
