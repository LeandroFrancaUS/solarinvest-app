/**
 * PDF Header Component
 * Simple, clean header without boxes or borders
 */

import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { SPACING, FONT_SIZE, COLORS } from '../theme'

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
    flexDirection: 'column',
    gap: SPACING.sm,
  },
  eyebrow: {
    fontSize: FONT_SIZE.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.text.muted,
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZE.xxxl,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text.secondary,
    lineHeight: 1.4,
  },
  meta: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  metaItem: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text.secondary,
  },
})

type PdfHeaderProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  budgetId?: string
  date?: string
}

export const PdfHeader: React.FC<PdfHeaderProps> = ({
  eyebrow = 'Proposta Comercial',
  title,
  subtitle,
  budgetId,
  date,
}) => {
  return (
    <View style={styles.header}>
      {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      
      {(budgetId || date) && (
        <View style={styles.meta}>
          {budgetId && (
            <Text style={styles.metaItem}>Código: {budgetId}</Text>
          )}
          {date && (
            <Text style={styles.metaItem}>Data: {date}</Text>
          )}
        </View>
      )}
    </View>
  )
}
