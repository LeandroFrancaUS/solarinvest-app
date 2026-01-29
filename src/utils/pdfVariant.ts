import type { PrintableProposalProps } from '../types/printableProposal'

/**
 * Feature flag to enable/disable Bento Grid PDF generator
 * Set to true to use the new premium Bento Grid layout for leasing proposals
 * Set to false to use the legacy PDF layout
 */
export const USE_BENTO_GRID_PDF = import.meta.env.VITE_USE_BENTO_GRID_PDF === 'true'

/**
 * Check if Bento Grid should be used for a specific proposal
 * Currently enabled only for LEASING proposals when feature flag is on
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
