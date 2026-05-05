/**
 * src/hooks/__tests__/useDisplayPreferences.test.ts
 *
 * Tests for the useDisplayPreferences hook.
 *
 * Covered:
 *   1. Default state — useBentoGridPdf=false, density=compact, mobileSimpleView=true, desktopSimpleView=true
 *   2. localStorage initialisation — stored values are restored on mount
 *   3. localStorage persistence — state changes are written back
 *   4. density effect — document.documentElement.dataset.density is set
 *   5. Derived flags — isMobileSimpleEnabled / isDesktopSimpleEnabled / shouldHideSimpleViewItems
 *   6. Invalid density in localStorage falls back to DEFAULT_DENSITY
 */

// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  useDisplayPreferences,
  type UseDisplayPreferencesOptions,
  type UseDisplayPreferencesResult,
} from '../useDisplayPreferences'
import { DEFAULT_DENSITY, DENSITY_STORAGE_KEY } from '../../constants/ui'

// ---------------------------------------------------------------------------
// Minimal renderHook (React 18 + jsdom, no @testing-library dependency)
// ---------------------------------------------------------------------------

type HookRef = { current: UseDisplayPreferencesResult }

function renderHook(opts: UseDisplayPreferencesOptions): {
  result: HookRef
  rerender: (opts: UseDisplayPreferencesOptions) => void
  unmount: () => void
} {
  const result: HookRef = { current: null as unknown as UseDisplayPreferencesResult }
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)

  function Harness(props: UseDisplayPreferencesOptions) {
    result.current = useDisplayPreferences(props)
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(Harness, opts))
  })

  return {
    result,
    rerender(nextOpts) {
      act(() => {
        root.render(React.createElement(Harness, nextOpts))
      })
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

describe('useDisplayPreferences', () => {
  let unmount: () => void

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    unmount?.()
    localStorage.clear()
  })

  it('1. returns correct default state when localStorage is empty', () => {
    const { result, unmount: u } = renderHook({ isMobileViewport: false })
    unmount = u
    expect(result.current.useBentoGridPdf).toBe(false)
    expect(result.current.density).toBe(DEFAULT_DENSITY)
    expect(result.current.mobileSimpleView).toBe(true)
    expect(result.current.desktopSimpleView).toBe(true)
  })

  it('2. restores useBentoGridPdf from localStorage', () => {
    localStorage.setItem('useBentoGridPdf', 'true')
    const { result, unmount: u } = renderHook({ isMobileViewport: false })
    unmount = u
    expect(result.current.useBentoGridPdf).toBe(true)
  })

  it('2b. restores density from localStorage', () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, 'comfortable')
    const { result, unmount: u } = renderHook({ isMobileViewport: false })
    unmount = u
    expect(result.current.density).toBe('comfortable')
  })

  it('2c. restores mobileSimpleView=false from localStorage', () => {
    localStorage.setItem('mobileSimpleView', 'false')
    const { result, unmount: u } = renderHook({ isMobileViewport: false })
    unmount = u
    expect(result.current.mobileSimpleView).toBe(false)
  })

  it('3. persists density change to localStorage', () => {
    const { result, unmount: u } = renderHook({ isMobileViewport: false })
    unmount = u
    act(() => { result.current.setDensity('cozy') })
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('cozy')
  })

  it('3b. persists useBentoGridPdf change to localStorage', () => {
    const { result, unmount: u } = renderHook({ isMobileViewport: false })
    unmount = u
    act(() => { result.current.setUseBentoGridPdf(true) })
    expect(localStorage.getItem('useBentoGridPdf')).toBe('true')
  })

  it('4. density effect sets document.documentElement.dataset.density', () => {
    const { unmount: u } = renderHook({ isMobileViewport: false })
    unmount = u
    expect(document.documentElement.dataset.density).toBe(DEFAULT_DENSITY)
  })

  it('5a. isMobileSimpleEnabled = true when mobile viewport AND mobileSimpleView=true', () => {
    const { result, unmount: u } = renderHook({ isMobileViewport: true })
    unmount = u
    expect(result.current.isMobileSimpleEnabled).toBe(true)
    expect(result.current.shouldHideSimpleViewItems).toBe(true)
  })

  it('5b. isMobileSimpleEnabled = false when mobileSimpleView=false', () => {
    localStorage.setItem('mobileSimpleView', 'false')
    const { result, unmount: u } = renderHook({ isMobileViewport: true })
    unmount = u
    expect(result.current.isMobileSimpleEnabled).toBe(false)
  })

  it('5c. isDesktopSimpleEnabled = true when NOT mobile AND desktopSimpleView=true', () => {
    const { result, unmount: u } = renderHook({ isMobileViewport: false })
    unmount = u
    expect(result.current.isDesktopSimpleEnabled).toBe(true)
    expect(result.current.shouldHideSimpleViewItems).toBe(true)
  })

  it('5d. shouldHideSimpleViewItems = false when both simpleViews disabled', () => {
    localStorage.setItem('mobileSimpleView', 'false')
    localStorage.setItem('desktopSimpleView', 'false')
    const { result, unmount: u } = renderHook({ isMobileViewport: false })
    unmount = u
    expect(result.current.shouldHideSimpleViewItems).toBe(false)
  })

  it('6. invalid density in localStorage falls back to DEFAULT_DENSITY', () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, 'bogus')
    const { result, unmount: u } = renderHook({ isMobileViewport: false })
    unmount = u
    expect(result.current.density).toBe(DEFAULT_DENSITY)
  })

  it('rerender with different isMobileViewport updates derived flags', () => {
    const { result, rerender, unmount: u } = renderHook({ isMobileViewport: false })
    unmount = u
    expect(result.current.isMobileSimpleEnabled).toBe(false)
    rerender({ isMobileViewport: true })
    expect(result.current.isMobileSimpleEnabled).toBe(true)
  })
})
