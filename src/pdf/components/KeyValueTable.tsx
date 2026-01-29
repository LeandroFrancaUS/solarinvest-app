/**
 * Key-Value Table Component
 * Clean two-column table for parameters and values
 */

import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { SPACING, FONT_SIZE, COLORS } from '../theme'

const styles = StyleSheet.create({
  table: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border.light,
    paddingVertical: SPACING.sm,
  },
  labelCell: {
    flex: 1.2,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text.secondary,
    paddingRight: SPACING.md,
  },
  valueCell: {
    flex: 1.8,
    fontSize: FONT_SIZE.base,
    color: COLORS.text.primary,
  },
})

export type KeyValueRow = {
  label: string
  value: string | number
}

type KeyValueTableProps = {
  rows: KeyValueRow[]
  wrap?: boolean
}

export const KeyValueTable: React.FC<KeyValueTableProps> = ({
  rows,
  wrap = true,
}) => {
  return (
    <View style={styles.table} wrap={wrap}>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          <Text style={styles.labelCell}>{row.label}</Text>
          <Text style={styles.valueCell}>{row.value}</Text>
        </View>
      ))}
    </View>
  )
}
