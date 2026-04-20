import { useCallback, useEffect, useState } from 'react'

export type AppTheme = 'dark' | 'old'

const STORAGE_KEY = 'si-app-theme'
const DEFAULT_THEME: AppTheme = 'dark'

function applyTheme(theme: AppTheme) {
  const root = document.documentElement
  // Manage only the app-level theme classes; the system colour-scheme preference
  // (data-theme='light'/'dark') is handled separately in App.tsx via matchMedia.
  root.classList.remove('theme-dark', 'theme-old')

  if (theme === 'old') {
    root.classList.add('theme-old')
  } else {
    root.classList.add('theme-dark')
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'dark' || stored === 'old') {
        return stored
      }
    } catch {
      // ignore
    }
    return DEFAULT_THEME
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }, [])

  const cycleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'old' : 'dark')
  }, [theme, setTheme])

  return { appTheme: theme, setAppTheme: setTheme, cycleAppTheme: cycleTheme }
}
