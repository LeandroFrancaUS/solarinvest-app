import { useEffect } from 'react'

const PRINT_THEME_ATTRIBUTE = 'data-forced-print-theme'
const PRINT_THEME_VALUE = 'light'

const addMatchMediaListener = (
  mediaQuery: MediaQueryList,
  listener: (event: MediaQueryListEvent) => void,
) => {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }

  if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(listener)
    return () => mediaQuery.removeListener(listener)
  }

  return () => {}
}

export function usePrintThemeLight(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const { documentElement } = document
    if (!documentElement) {
      return
    }

    const forceLightTheme = () => {
      documentElement.setAttribute(PRINT_THEME_ATTRIBUTE, PRINT_THEME_VALUE)
    }

    const clearForcedTheme = () => {
      if (documentElement.getAttribute(PRINT_THEME_ATTRIBUTE) === PRINT_THEME_VALUE) {
        documentElement.removeAttribute(PRINT_THEME_ATTRIBUTE)
      }
    }

    const handleBeforePrint = () => {
      forceLightTheme()
    }

    const handleAfterPrint = () => {
      clearForcedTheme()
    }

    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)

    let removeMediaQueryListener: (() => void) | null = null

    if (typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('print')
      const handleMediaChange = (event: MediaQueryListEvent) => {
        if (event.matches) {
          forceLightTheme()
        } else {
          clearForcedTheme()
        }
      }

      if (mediaQuery.matches) {
        forceLightTheme()
      }

      removeMediaQueryListener = addMatchMediaListener(mediaQuery, handleMediaChange)
    }

    const printMode = documentElement.getAttribute('data-print-mode')
    if (printMode === 'print' || printMode === 'download') {
      forceLightTheme()
    }

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
      if (removeMediaQueryListener) {
        removeMediaQueryListener()
      }
      clearForcedTheme()
    }
  }, [])
}

export default usePrintThemeLight
