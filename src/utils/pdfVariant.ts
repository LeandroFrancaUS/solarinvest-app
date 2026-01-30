import type { PrintableProposalProps } from '../types/printableProposal'

/**
 * Feature flag to enable/disable Bento Grid PDF generator
 * Defaults to TRUE - Bento Grid is enabled by default for leasing proposals
 * Set VITE_USE_BENTO_GRID_PDF=false to explicitly disable and use legacy layout
 */
export const USE_BENTO_GRID_PDF = import.meta.env.VITE_USE_BENTO_GRID_PDF !== 'false'

/**
 * Check if Bento Grid should be used for a specific proposal
 * Enabled by default for LEASING proposals (can be disabled via feature flag)
 */
export function shouldUseBentoGrid(props: PrintableProposalProps): boolean {
  if (!USE_BENTO_GRID_PDF) {
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
