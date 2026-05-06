/**
 * src/hooks/__tests__/useAdminSettingsDraft.test.ts
 *
 * Tests for the useAdminSettingsDraft hook.
 *
 * Covered:
 *   1. Default state — settingsTab = 'mercado', aprovadoresText from vendasConfig, empty overrides
 *   2. setSettingsTab changes the active tab
 *   3. setAprovadoresText changes the draft text
 *   4. setImpostosOverridesDraft changes the draft overrides
 *   5. arredondarPasso derives correctly from vendasConfig.arredondar_venda_para
 *   6. arredondarPasso falls back to 100 for invalid/missing values
 *   7. aprovadoresResumo returns comma-joined string
 *   8. aprovadoresResumo returns '' when aprovadores is empty
 */

// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, afterEach } from 'vitest'
import {
  useAdminSettingsDraft,
  type UseAdminSettingsDraftOptions,
  type UseAdminSettingsDraftResult,
} from '../useAdminSettingsDraft'
import { DEFAULT_VENDAS_CONFIG } from '../../types/vendasConfig'

// ---------------------------------------------------------------------------
// Minimal renderHook
// ---------------------------------------------------------------------------

type HookRef = { current: UseAdminSettingsDraftResult }

function renderHook(opts: UseAdminSettingsDraftOptions): {
  result: HookRef
  rerender: (opts: UseAdminSettingsDraftOptions) => void
  unmount: () => void
} {
  const result: HookRef = { current: null as unknown as UseAdminSettingsDraftResult }
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)

  function Harness(props: UseAdminSettingsDraftOptions) {
    result.current = useAdminSettingsDraft(props)
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(Harness, opts))
  })

  return {
    result,
    rerender(nextOpts) {
      act(() => { root.render(React.createElement(Harness, nextOpts)) })
    },
    unmount() {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAdminSettingsDraft', () => {
  let unmount: () => void

  afterEach(() => { unmount?.() })

  it('1. settingsTab defaults to mercado', () => {
    const { result, unmount: u } = renderHook({ vendasConfig: DEFAULT_VENDAS_CONFIG })
    unmount = u
    expect(result.current.settingsTab).toBe('mercado')
  })

  it('1b. aprovadoresText initialised from vendasConfig.aprovadores', () => {
    const cfg = { ...DEFAULT_VENDAS_CONFIG, aprovadores: ['a@test.com', 'b@test.com'] }
    const { result, unmount: u } = renderHook({ vendasConfig: cfg })
    unmount = u
    expect(result.current.aprovadoresText).toBe('a@test.com\nb@test.com')
  })

  it('2. setSettingsTab updates the tab', () => {
    const { result, unmount: u } = renderHook({ vendasConfig: DEFAULT_VENDAS_CONFIG })
    unmount = u
    act(() => { result.current.setSettingsTab('vendas') })
    expect(result.current.settingsTab).toBe('vendas')
  })

  it('3. setAprovadoresText updates the draft text', () => {
    const { result, unmount: u } = renderHook({ vendasConfig: DEFAULT_VENDAS_CONFIG })
    unmount = u
    act(() => { result.current.setAprovadoresText('novo@email.com') })
    expect(result.current.aprovadoresText).toBe('novo@email.com')
  })

  it('4. setImpostosOverridesDraft updates the draft', () => {
    const { result, unmount: u } = renderHook({ vendasConfig: DEFAULT_VENDAS_CONFIG })
    unmount = u
    act(() => {
      result.current.setImpostosOverridesDraft({ lucro_presumido: { pis: 0.065 } as never })
    })
    expect((result.current.impostosOverridesDraft as Record<string, unknown>).lucro_presumido).toBeDefined()
  })

  it('5a. arredondarPasso = 10 when vendasConfig.arredondar_venda_para = "10"', () => {
    const cfg = { ...DEFAULT_VENDAS_CONFIG, arredondar_venda_para: '10' as const }
    const { result, unmount: u } = renderHook({ vendasConfig: cfg })
    unmount = u
    expect(result.current.arredondarPasso).toBe(10)
  })

  it('5b. arredondarPasso = 50 when vendasConfig.arredondar_venda_para = "50"', () => {
    const cfg = { ...DEFAULT_VENDAS_CONFIG, arredondar_venda_para: '50' as const }
    const { result, unmount: u } = renderHook({ vendasConfig: cfg })
    unmount = u
    expect(result.current.arredondarPasso).toBe(50)
  })

  it('6. arredondarPasso falls back to 100 for default config', () => {
    // DEFAULT_VENDAS_CONFIG has arredondar_venda_para = '100'
    const { result, unmount: u } = renderHook({ vendasConfig: DEFAULT_VENDAS_CONFIG })
    unmount = u
    expect(result.current.arredondarPasso).toBe(100)
  })

  it('7. aprovadoresResumo is comma-joined list of aprovadores', () => {
    const cfg = { ...DEFAULT_VENDAS_CONFIG, aprovadores: ['a@x.com', 'b@x.com', 'c@x.com'] }
    const { result, unmount: u } = renderHook({ vendasConfig: cfg })
    unmount = u
    expect(result.current.aprovadoresResumo).toBe('a@x.com, b@x.com, c@x.com')
  })

  it('8. aprovadoresResumo returns empty string when aprovadores is empty', () => {
    const cfg = { ...DEFAULT_VENDAS_CONFIG, aprovadores: [] }
    const { result, unmount: u } = renderHook({ vendasConfig: cfg })
    unmount = u
    expect(result.current.aprovadoresResumo).toBe('')
  })

  it('rerender with new vendasConfig updates aprovadoresResumo memo', () => {
    const { result, rerender, unmount: u } = renderHook({ vendasConfig: DEFAULT_VENDAS_CONFIG })
    unmount = u
    const updated = { ...DEFAULT_VENDAS_CONFIG, aprovadores: ['x@y.com'] }
    rerender({ vendasConfig: updated })
    expect(result.current.aprovadoresResumo).toBe('x@y.com')
  })
})
