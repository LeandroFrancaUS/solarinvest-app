/**
 * PDF Theme Configuration
 * Design system for @react-pdf/renderer documents
 * A4 real size, zero imposed margins, editorial premium appearance
 */

import { StyleSheet } from '@react-pdf/renderer'

// A4 dimensions in points (1 pt = 1/72 inch)
// A4 = 210mm x 297mm = 595.28pt x 841.89pt
export const PAGE_SIZE = {
  width: 595.28,
  height: 841.89,
}

// Controlled padding (small and consistent)
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
}

// Typography scale
export const FONT_SIZE = {
  xs: 8,
  sm: 9,
  base: 10,
  md: 11,
  lg: 13,
  xl: 16,
  xxl: 20,
  xxxl: 24,
}

// Colors - minimal palette
export const COLORS = {
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    muted: '#94a3b8',
  },
  background: {
    white: '#ffffff',
    light: '#f8fafc',
    accent: '#fff9f2',
  },
  brand: {
    primary: '#f97316', // Orange
    secondary: '#a9cf46', // Green
  },
  border: {
    light: '#e2e8f0',
    default: '#cbd5e1',
  },
}

// Base styles for all PDF documents
export const styles = StyleSheet.create({
  page: {
    size: 'A4',
    padding: 0, // ZERO padding - we control spacing with components
    fontFamily: 'Helvetica',
    fontSize: FONT_SIZE.base,
    color: COLORS.text.primary,
    backgroundColor: COLORS.background.white,
  },
  
  // Content wrapper - use for internal spacing
  content: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  
  // Typography
  h1: {
    fontSize: FONT_SIZE.xxxl,
    fontFamily: 'Helvetica-Bold',
    marginBottom: SPACING.md,
    color: COLORS.text.primary,
  },
  
  h2: {
    fontSize: FONT_SIZE.xxl,
    fontFamily: 'Helvetica-Bold',
    marginBottom: SPACING.sm,
    color: COLORS.text.primary,
  },
  
  h3: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Helvetica-Bold',
    marginBottom: SPACING.sm,
    color: COLORS.text.primary,
  },
  
  h4: {
    fontSize: FONT_SIZE.lg,
    fontFamily: 'Helvetica-Bold',
    marginBottom: SPACING.xs,
    color: COLORS.text.primary,
  },
  
  body: {
    fontSize: FONT_SIZE.base,
    lineHeight: 1.5,
    color: COLORS.text.primary,
  },
  
  small: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text.secondary,
  },
  
  caption: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Layout helpers
  row: {
    flexDirection: 'row',
  },
  
  column: {
    flexDirection: 'column',
  },
  
  spaceBetween: {
    justifyContent: 'space-between',
  },
  
  alignCenter: {
    alignItems: 'center',
  },
  
  // No borders or boxes - clean editorial layout
  noBorder: {
    border: 'none',
  },
  
  // Subtle divider when needed
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border.light,
    marginVertical: SPACING.sm,
  },
  
  // Table styles - minimal borders
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border.light,
    paddingVertical: SPACING.xs,
  },
  
  tableCell: {
    fontSize: FONT_SIZE.base,
    paddingHorizontal: SPACING.xs,
  },
  
  tableHeader: {
    fontFamily: 'Helvetica-Bold',
    fontSize: FONT_SIZE.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: COLORS.text.secondary,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.default,
  },
})
