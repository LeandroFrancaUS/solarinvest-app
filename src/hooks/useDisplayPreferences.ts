/**
 * useDisplayPreferences.ts
 *
 * Owns all UI display-preference state that is persisted in localStorage:
 *   - useBentoGridPdf   — toggle between Bento-Grid and classic PDF layouts
 *   - density           — UI density mode (compact / default / comfortable)
 *   - mobileSimpleView  — simplified mobile layout
 *   - desktopSimpleView — simplified desktop layout
 *
 * Each preference is read from localStorage on mount and written back
 * whenever it changes.  The density value also drives
 * `document.documentElement.dataset.density` so CSS can react to it.
 *
 * Three derived convenience flags are computed from the viewport / state:
 *   - isMobileSimpleEnabled
 *   - isDesktopSimpleEnabled
 *   - shouldHideSimpleViewItems
 *
 * Params:
 *   - isMobileViewport — boolean from useNavigationState; used to compute
 *     the derived simple-view flags.
 *
 * Zero behavioural change — exact same logic as the original App.tsx blocks.
 */

import { useEffect, useState } from 'react'
import { DEFAULT_DENSITY, DENSITY_STORAGE_KEY, isDensityMode, type DensityMode } from '../constants/ui'
import { INITIAL_VALUES } from '../app/config'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseDisplayPreferencesOptions {
  isMobileViewport: boolean
}

export interface UseDisplayPreferencesResult {
  useBentoGridPdf: boolean
  setUseBentoGridPdf: React.Dispatch<React.SetStateAction<boolean>>
  density: DensityMode
  setDensity: React.Dispatch<React.SetStateAction<DensityMode>>
  mobileSimpleView: boolean
  setMobileSimpleView: React.Dispatch<React.SetStateAction<boolean>>
  desktopSimpleView: boolean
  setDesktopSimpleView: React.Dispatch<React.SetStateAction<boolean>>
  /** true when in mobile viewport AND mobileSimpleView is enabled */
  isMobileSimpleEnabled: boolean
  /** true when NOT in mobile viewport AND desktopSimpleView is enabled */
  isDesktopSimpleEnabled: boolean
  /** true when either simple-view mode is active */
  shouldHideSimpleViewItems: boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDisplayPreferences({
  isMobileViewport,
}: UseDisplayPreferencesOptions): UseDisplayPreferencesResult {
  const [useBentoGridPdf, setUseBentoGridPdf] = useState(() => {
    if (typeof window === 'undefined') {
      return INITIAL_VALUES.useBentoGridPdf
    }
    const stored = window.localStorage.getItem('useBentoGridPdf')
    return stored !== null ? stored === 'true' : INITIAL_VALUES.useBentoGridPdf
  })

  const [density, setDensity] = useState<DensityMode>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_DENSITY
    }
    const stored = window.localStorage.getItem(DENSITY_STORAGE_KEY)
    return stored && isDensityMode(stored) ? stored : DEFAULT_DENSITY
  })

  const [mobileSimpleView, setMobileSimpleView] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    const stored = window.localStorage.getItem('mobileSimpleView')
    return stored !== null ? stored === 'true' : true
  })

  const [desktopSimpleView, setDesktopSimpleView] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    const stored = window.localStorage.getItem('desktopSimpleView')
    return stored !== null ? stored === 'true' : true
  })

  // Persist density + update CSS data-attribute
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.density = density
    }
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, density)
    } catch (error) {
      console.warn('Não foi possível persistir a densidade da interface.', error)
    }
  }, [density])

  // Persist useBentoGridPdf
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem('useBentoGridPdf', useBentoGridPdf.toString())
    } catch (error) {
      console.warn('Não foi possível persistir a preferência de Bento Grid PDF.', error)
    }
  }, [useBentoGridPdf])

  // Persist mobileSimpleView
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem('mobileSimpleView', mobileSimpleView.toString())
    } catch (error) {
      console.warn('Não foi possível persistir a preferência Mobile view simples.', error)
    }
  }, [mobileSimpleView])

  // Persist desktopSimpleView
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem('desktopSimpleView', desktopSimpleView.toString())
    } catch (error) {
      console.warn('Não foi possível persistir a preferência Desktop view simples.', error)
    }
  }, [desktopSimpleView])

  const isMobileSimpleEnabled = isMobileViewport && mobileSimpleView
  const isDesktopSimpleEnabled = !isMobileViewport && desktopSimpleView
  const shouldHideSimpleViewItems = isMobileSimpleEnabled || isDesktopSimpleEnabled

  return {
    useBentoGridPdf,
    setUseBentoGridPdf,
    density,
    setDensity,
    mobileSimpleView,
    setMobileSimpleView,
    desktopSimpleView,
    setDesktopSimpleView,
    isMobileSimpleEnabled,
    isDesktopSimpleEnabled,
    shouldHideSimpleViewItems,
  }
}
