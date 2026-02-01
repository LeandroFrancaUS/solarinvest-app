import type { PrintableProposalProps } from '../types/printableProposal'

/**
 * Get user preference for Bento Grid from settings
 * Falls back to default (false) if not set
 */
export function getUserBentoGridPreference(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  
  // Check localStorage for user preference
  const stored = localStorage.getItem('useBentoGridPdf')
  if (stored !== null) {
    return stored === 'true'
  }
  
  // Default to disabled
  return false
}

/**
 * Check if Bento Grid should be used for a specific proposal
 * Priority: User settings > Default (disabled)
 */
export function shouldUseBentoGrid(props: PrintableProposalProps, userPreference?: boolean): boolean {
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
