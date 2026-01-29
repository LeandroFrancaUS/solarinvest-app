/**
 * PDF Generation API - Main Export
 * Public API for generating PDF proposals
 */

// Re-export client-side API
export { generateLeasingProposalSimple, generateLeasingProposalBlob } from './render/clientApi'

// Re-export types
export type { LeasingProposalData } from './types'
export type { PrintableProposalProps } from '../types/printableProposal'

// Re-export components (for custom document creation)
export { PdfHeader } from './components/PdfHeader'
export { PdfFooter } from './components/PdfFooter'
export { SectionTitle } from './components/SectionTitle'
export { KeyValueTable } from './components/KeyValueTable'
export { PricingComparisonTable } from './components/PricingComparisonTable'

// Re-export theme
export { styles as pdfTheme, SPACING, FONT_SIZE, COLORS } from './theme'

// Re-export documents
export { LeasingProposalSimple } from './documents/LeasingProposalSimple'
