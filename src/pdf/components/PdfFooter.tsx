/**
 * PDF Footer Component
 * Simple footer for page numbering and branding
 */

import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { SPACING, FONT_SIZE, COLORS } from '../theme'

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border.light,
  },
  text: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text.muted,
  },
  pageNumber: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text.muted,
  },
})

type PdfFooterProps = {
  companyName?: string
}

export const PdfFooter: React.FC<PdfFooterProps> = ({
  companyName = 'SolarInvest',
}) => {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.text}>{companyName}</Text>
      <Text 
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  )
}
