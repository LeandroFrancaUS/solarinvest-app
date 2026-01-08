/**
 * PDF Theme and Global Styles
 * 
 * Centralized style definitions for consistent PDF layout.
 * All measurements are in points (pt).
 */

import { StyleSheet } from '@react-pdf/renderer';

// A4 dimensions in points (72 points = 1 inch)
export const PAGE_DIMENSIONS = {
  width: 595.28, // 210mm
  height: 841.89, // 297mm
};

// Standard margins
export const MARGINS = {
  top: 50,
  right: 50,
  bottom: 50,
  left: 50,
};

// Typography scale
export const FONT_SIZES = {
  small: 9,
  body: 11,
  bodyLarge: 12,
  h4: 13,
  h3: 14,
  h2: 16,
  h1: 18,
};

// Colors
export const COLORS = {
  black: '#000000',
  darkGray: '#333333',
  gray: '#666666',
  lightGray: '#999999',
  veryLightGray: '#CCCCCC',
  white: '#FFFFFF',
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/**
 * Global styles for PDF components
 * 
 * Uses NotoSans font family for full PT-BR character support.
 */
export const styles = StyleSheet.create({
  // Page styles
  page: {
    paddingTop: MARGINS.top,
    paddingRight: MARGINS.right,
    paddingBottom: MARGINS.bottom,
    paddingLeft: MARGINS.left,
    fontFamily: 'NotoSans',
    fontSize: FONT_SIZES.body,
    color: COLORS.black,
  },

  // Typography
  h1: {
    fontSize: FONT_SIZES.h1,
    fontFamily: 'NotoSans',
    fontWeight: 700,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },

  h2: {
    fontSize: FONT_SIZES.h2,
    fontFamily: 'NotoSans',
    fontWeight: 700,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },

  h3: {
    fontSize: FONT_SIZES.h3,
    fontFamily: 'NotoSans',
    fontWeight: 700,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },

  h4: {
    fontSize: FONT_SIZES.h4,
    fontFamily: 'NotoSans',
    fontWeight: 700,
    marginBottom: SPACING.sm,
  },

  body: {
    fontSize: FONT_SIZES.body,
    fontFamily: 'NotoSans',
    fontWeight: 400,
    lineHeight: 1.5,
    textAlign: 'justify',
  },

  bodyBold: {
    fontSize: FONT_SIZES.body,
    fontFamily: 'NotoSans',
    fontWeight: 700,
    lineHeight: 1.5,
  },

  small: {
    fontSize: FONT_SIZES.small,
    fontFamily: 'NotoSans',
    fontWeight: 400,
    lineHeight: 1.4,
  },

  // Layout
  section: {
    marginBottom: SPACING.lg,
  },

  paragraph: {
    marginBottom: SPACING.md,
    lineHeight: 1.5,
    textAlign: 'justify',
  },

  // Table styles
  table: {
    width: '100%',
    marginBottom: SPACING.lg,
  },

  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.veryLightGray,
    minHeight: 25,
    alignItems: 'center',
  },

  tableHeader: {
    backgroundColor: COLORS.veryLightGray,
    fontFamily: 'NotoSans',
    fontWeight: 700,
  },

  tableCell: {
    padding: SPACING.sm,
    fontSize: FONT_SIZES.body,
  },

  // Header and Footer
  header: {
    marginBottom: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.darkGray,
  },

  footer: {
    position: 'absolute',
    bottom: MARGINS.bottom - 20,
    left: MARGINS.left,
    right: MARGINS.right,
    textAlign: 'center',
    fontSize: FONT_SIZES.small,
    color: COLORS.gray,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.veryLightGray,
  },

  // Signature block
  signatureBlock: {
    marginTop: SPACING.xxl,
  },

  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: COLORS.black,
    marginTop: SPACING.xl,
    paddingTop: SPACING.xs,
    textAlign: 'center',
  },
});
