import type { PrintableProposalProps } from '../types/printableProposal'

/**
 * Feature flag to enable/disable Bento Grid PDF generator
 * Defaults to TRUE - Bento Grid is enabled by default for leasing proposals
 * Set VITE_USE_BENTO_GRID_PDF=false to explicitly disable and use legacy layout
 */
export const USE_BENTO_GRID_PDF = import.meta.env.VITE_USE_BENTO_GRID_PDF !== 'false'

/**
 * Get user preference for Bento Grid from settings
 * Falls back to default (true) if not set
 */
export function getUserBentoGridPreference(): boolean {
  if (typeof window === 'undefined') {
    return true
  }
  
  // Check localStorage for user preference
  const stored = localStorage.getItem('useBentoGridPdf')
  if (stored !== null) {
    return stored === 'true'
  }
  
  // Default to enabled
  return true
}

/**
 * Check if Bento Grid should be used for a specific proposal
 * Priority: Environment variable > User settings > Default (enabled)
 */
export function shouldUseBentoGrid(props: PrintableProposalProps, userPreference?: boolean): boolean {
  // Environment variable can disable globally
  if (!USE_BENTO_GRID_PDF) {
    return false
  }
  
  // Check user preference (passed in or from localStorage)
  const useBento = userPreference !== undefined ? userPreference : getUserBentoGridPreference()
  if (!useBento) {
    return false
  }
  
  // Only use Bento Grid for leasing proposals
  return props.tipoProposta === 'LEASING'
}

/**
 * Get the appropriate PDF variant label
 */
export function getPdfVariant(props: PrintableProposalProps): 'bento' | 'standard' {
  return shouldUseBentoGrid(props) ? 'bento' : 'standard'
}
