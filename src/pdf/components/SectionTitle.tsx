/**
 * Section Title Component
 * Editorial-style section headers without boxes
 */

import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { SPACING, FONT_SIZE, COLORS } from '../theme'

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text.secondary,
    lineHeight: 1.4,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border.light,
    marginTop: SPACING.sm,
  },
})

type SectionTitleProps = {
  title: string
  subtitle?: string
  showDivider?: boolean
}

export const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  subtitle,
  showDivider = false,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {showDivider && <View style={styles.divider} />}
    </View>
  )
}
