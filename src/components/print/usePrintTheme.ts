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

    const shouldForceForMode = (mode: string | null | undefined) =>
      mode === 'print' || mode === 'download'

    const applyForcedThemeForMode = () => {
      const mode = documentElement.getAttribute('data-print-mode')
      if (shouldForceForMode(mode)) {
        forceLightTheme()
      } else {
        const mediaMatchesPrint = typeof window.matchMedia === 'function' && window.matchMedia('print').matches
        if (!mediaMatchesPrint) {
          clearForcedTheme()
        }
      }
    }

    const handleBeforePrint = () => {
      forceLightTheme()
    }

    const handleAfterPrint = () => {
      clearForcedTheme()
      applyForcedThemeForMode()
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
          applyForcedThemeForMode()
        }
      }

      if (mediaQuery.matches) {
        forceLightTheme()
      }

      removeMediaQueryListener = addMatchMediaListener(mediaQuery, handleMediaChange)
    }

    applyForcedThemeForMode()

    let modeObserver: MutationObserver | null = null
    if (typeof MutationObserver === 'function') {
      modeObserver = new MutationObserver((mutations) => {
        const shouldApply = mutations.some(
          (mutation) => mutation.type === 'attributes' && mutation.attributeName === 'data-print-mode',
        )

        if (shouldApply) {
          applyForcedThemeForMode()
        }
      })

      modeObserver.observe(documentElement, {
        attributes: true,
        attributeFilter: ['data-print-mode'],
      })
    }

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
      if (removeMediaQueryListener) {
        removeMediaQueryListener()
      }
      if (modeObserver) {
        modeObserver.disconnect()
      }
      clearForcedTheme()
    }
  }, [])
}

export default usePrintThemeLight
