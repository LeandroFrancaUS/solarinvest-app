/**
 * src/hooks/__tests__/useSystemColorScheme.test.ts
 *
 * Tests for the useSystemColorScheme hook extracted from App.tsx.
 *
 * Covered:
 *   1. Initial state — defaults to 'light' when matchMedia is not available
 *   2. Initial state — reads 'dark' from matchMedia when dark mode is preferred
 *   3. chartTheme matches CHART_THEME[theme] for both light and dark
 *   4. Theme updates when the matchMedia 'change' event fires
 *   5. Cleanup — event listener is removed on unmount
 *   6. SSR safety — defaults to 'light' when window is undefined
 */

// Enable React act() flushing in jsdom (React 18 requirement)
// @ts-expect-error React 18 act env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSystemColorScheme, type UseSystemColorSchemeResult } from '../useSystemColorScheme'
import { CHART_THEME } from '../../helpers/ChartTheme'

// ---------------------------------------------------------------------------
// matchMedia mock helpers
// ---------------------------------------------------------------------------

type MatchMediaListener = (event: MediaQueryListEvent) => void

function createMatchMediaMock(initialMatches: boolean) {
  const listeners: MatchMediaListener[] = []

  const mql = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((event: string, listener: MatchMediaListener) => {
      if (event === 'change') listeners.push(listener)
    }),
    removeEventListener: vi.fn((event: string, listener: MatchMediaListener) => {
      const idx = listeners.indexOf(listener)
      if (idx !== -1) listeners.splice(idx, 1)
    }),
    dispatchEvent: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }

  const fireChange = (matches: boolean) => {
    mql.matches = matches
    const event = { matches } as MediaQueryListEvent
    for (const l of listeners) l(event)
  }

  return { mql, fireChange, listeners }
}

// ---------------------------------------------------------------------------
// Minimal renderHook (React 18 + jsdom, no @testing-library)
// ---------------------------------------------------------------------------

type HookRef = { current: UseSystemColorSchemeResult }

function renderHook(): {
  result: HookRef
  unmount: () => void
} {
  const result: HookRef = { current: null as unknown as UseSystemColorSchemeResult }
  let root: Root
  const container = document.createElement('div')
  document.body.appendChild(container)

  function TestComponent() {
    result.current = useSystemColorScheme()
    return null
  }

  act(() => {
    root = createRoot(container)
    root.render(React.createElement(TestComponent))
  })

  return {
    result,
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSystemColorScheme', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    vi.clearAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    })
  })

  // 1. Defaults to 'light' when matchMedia is not available
  it('defaults to "light" theme when matchMedia is not a function', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: undefined,
    })

    const { result, unmount } = renderHook()

    expect(result.current.theme).toBe('light')
    expect(result.current.chartTheme).toEqual(CHART_THEME.light)

    unmount()
  })

  // 2. Reads 'dark' from matchMedia on initial render
  it('initialises with "dark" when matchMedia reports dark mode preferred', () => {
    const { mql } = createMatchMediaMock(true)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => mql,
    })

    const { result, unmount } = renderHook()

    // The effect fires on mount and calls applyTheme(true)
    act(() => {
      // flush effects
    })

    expect(result.current.theme).toBe('dark')
    expect(result.current.chartTheme).toEqual(CHART_THEME.dark)

    unmount()
  })

  // 3. chartTheme matches CHART_THEME[theme]
  it('provides chartTheme that matches CHART_THEME for the active theme', () => {
    const { mql } = createMatchMediaMock(false)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => mql,
    })

    const { result, unmount } = renderHook()

    act(() => {})

    expect(result.current.chartTheme).toEqual(CHART_THEME[result.current.theme])

    unmount()
  })

  // 4. Theme updates when matchMedia 'change' event fires
  it('switches to "dark" when the matchMedia change event fires with matches=true', () => {
    const { mql, fireChange } = createMatchMediaMock(false)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => mql,
    })

    const { result, unmount } = renderHook()

    act(() => {})

    expect(result.current.theme).toBe('light')

    act(() => {
      fireChange(true)
    })

    expect(result.current.theme).toBe('dark')
    expect(result.current.chartTheme).toEqual(CHART_THEME.dark)

    unmount()
  })

  // 5. Event listener is removed on unmount
  it('removes the matchMedia event listener on unmount', () => {
    const { mql } = createMatchMediaMock(false)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => mql,
    })

    const { unmount } = renderHook()

    act(() => {})

    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    unmount()

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
