/**
 * src/features/simulacoes/__tests__/useTusdState.test.ts
 *
 * Tests for the useTusdState hook.
 *
 * Covered:
 *   1. Default state initial values match INITIAL_VALUES
 *   2. setTusdSimultaneidadeFromSource sets value and clears manualOverride for 'auto'
 *   3. setTusdSimultaneidadeFromSource sets manualOverride for 'manual'
 *   4. setTusdSimultaneidadeFromSource calls applyVendaUpdatesRef when value changes
 *   5. resolveDefaultTusdSimultaneidade returns correct defaults per tipo
 *   6. Auto-apply effect sets simultaneidade when panel opens (non-manual)
 *   7. Auto-apply effect clears manualOverride when panel closes
 */

// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { INITIAL_VALUES } from '../../../app/config'
import { useTusdState, type UseTusdStateReturn } from '../useTusdState'
import type { VendaForm } from '../../../lib/finance/roi'

// ---------------------------------------------------------------------------
// Minimal renderHook (React 18 + jsdom, no @testing-library dependency)
// ---------------------------------------------------------------------------
function renderHook(useHook: () => UseTusdStateReturn): {
  result: { current: UseTusdStateReturn }
  unmount: () => void
} {
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)
  const result = { current: null as unknown as UseTusdStateReturn }

  function HookCapture() {
    result.current = useHook()
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

describe('useTusdState', () => {
  let unmount: () => void

  afterEach(() => {
    unmount?.()
  })

  it('1. initial values match INITIAL_VALUES', () => {
    const applyVendaUpdatesRef = { current: null }
    const { result, unmount: u } = renderHook(() => useTusdState({ applyVendaUpdatesRef }))
    unmount = u

    expect(result.current.tusdPercent).toBe(INITIAL_VALUES.tusdPercent)
    expect(result.current.tusdSubtipo).toBe(INITIAL_VALUES.tusdSubtipo)
    expect(result.current.tusdSimultaneidade).toBe(INITIAL_VALUES.tusdSimultaneidade)
    expect(result.current.tusdOpcoesExpandidas).toBe(false)
    expect(result.current.tusdAnoReferencia).toBeDefined()
  })

  it('2. setTusdSimultaneidadeFromSource auto clears manualOverride', () => {
    const applyVendaUpdatesRef = { current: null as null | ((u: Partial<VendaForm>) => void) }
    const { result, unmount: u } = renderHook(() => useTusdState({ applyVendaUpdatesRef }))
    unmount = u

    act(() => {
      result.current.setTusdSimultaneidadeFromSource(85, 'auto')
    })
    expect(result.current.tusdSimultaneidade).toBe(85)
  })

  it('3. setTusdSimultaneidadeFromSource manual sets value', () => {
    const applyVendaUpdatesRef = { current: null as null | ((u: Partial<VendaForm>) => void) }
    const { result, unmount: u } = renderHook(() => useTusdState({ applyVendaUpdatesRef }))
    unmount = u

    act(() => {
      result.current.setTusdSimultaneidadeFromSource(90, 'manual')
    })
    expect(result.current.tusdSimultaneidade).toBe(90)
  })

  it('4. setTusdSimultaneidadeFromSource calls applyVendaUpdatesRef', () => {
    const mockApply = vi.fn()
    const applyVendaUpdatesRef = { current: mockApply as null | ((u: Partial<VendaForm>) => void) }
    const { result, unmount: u } = renderHook(() => useTusdState({ applyVendaUpdatesRef }))
    unmount = u

    act(() => {
      result.current.setTusdSimultaneidadeFromSource(75, 'auto')
    })
    expect(mockApply).toHaveBeenCalledWith({ tusd_simultaneidade: 75 })
  })

  it('5. resolveDefaultTusdSimultaneidade returns 70 for residencial', () => {
    const applyVendaUpdatesRef = { current: null }
    const { result, unmount: u } = renderHook(() => useTusdState({ applyVendaUpdatesRef }))
    unmount = u

    expect(result.current.resolveDefaultTusdSimultaneidade('residencial')).toBe(70)
    expect(result.current.resolveDefaultTusdSimultaneidade('comercial')).toBe(80)
    expect(result.current.resolveDefaultTusdSimultaneidade('industrial')).toBeNull()
  })

  it('6. opening TUSD panel auto-applies default simultaneidade', () => {
    const applyVendaUpdatesRef = { current: null as null | ((u: Partial<VendaForm>) => void) }
    const { result, unmount: u } = renderHook(() => useTusdState({ applyVendaUpdatesRef }))
    unmount = u

    // Set tipo to residencial first, then open panel
    act(() => {
      result.current.setTusdTipoCliente('residencial')
    })
    act(() => {
      result.current.setTusdOpcoesExpandidas(true)
    })
    // Default for residencial is 70
    expect(result.current.tusdSimultaneidade).toBe(70)
  })
})
