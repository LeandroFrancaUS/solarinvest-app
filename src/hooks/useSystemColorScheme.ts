// src/hooks/useSystemColorScheme.ts
//
// Extracted from App.tsx. Tracks the OS-level prefers-color-scheme preference
// (light / dark) and derives the chart colour theme from it.
//
// This is intentionally separate from useTheme (which manages the app-level
// theme class 'theme-dark'/'theme-old' stored in localStorage).  The two
// concerns live in different hooks so each can evolve independently.
//
// Zero behavioural change — exact same logic as the original App.tsx blocks.

import { useEffect, useMemo, useState } from 'react'
import { CHART_THEME } from '../helpers/ChartTheme'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SystemColorScheme = 'light' | 'dark'

export interface UseSystemColorSchemeResult {
  /** Current OS-level colour scheme. */
  theme: SystemColorScheme
  /** Pre-resolved chart colour tokens for the active theme. */
  chartTheme: (typeof CHART_THEME)[SystemColorScheme]
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSystemColorScheme(): UseSystemColorSchemeResult {
  const [theme, setTheme] = useState<SystemColorScheme>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return 'light'
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (matches: boolean) => {
      const nextTheme: SystemColorScheme = matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', nextTheme)
      document.documentElement.style.colorScheme = nextTheme
      setTheme(nextTheme)
    }

    applyTheme(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => applyTheme(event.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const chartTheme = useMemo(() => CHART_THEME[theme], [theme])

  return { theme, chartTheme }
}
