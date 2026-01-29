/**
 * Pricing Comparison Table Component
 * Table for year-by-year pricing comparison (tariffs and monthly payments)
 */

import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { SPACING, FONT_SIZE, COLORS } from '../theme'

const styles = StyleSheet.create({
  table: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.default,
    paddingBottom: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  headerCell: {
    fontSize: FONT_SIZE.xs,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: COLORS.text.secondary,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border.light,
    paddingVertical: SPACING.sm,
  },
  cellYear: {
    width: '15%',
    fontSize: FONT_SIZE.sm,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text.primary,
  },
  cellTariff: {
    width: '40%',
    fontSize: FONT_SIZE.sm,
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.xs,
  },
  cellAmount: {
    width: '45%',
    fontSize: FONT_SIZE.sm,
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.xs,
  },
  tariffLine: {
    marginBottom: SPACING.xs / 2,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
    fontSize: FONT_SIZE.xs,
    color: COLORS.text.secondary,
  },
})

export type PricingRow = {
  ano: number
  tarifaCheiaAno: number
  tarifaComDesconto: number
  mensalidadeSolarInvest: number
  mensalidadeDistribuidora: number
}

type PricingComparisonTableProps = {
  rows: PricingRow[]
  formatCurrency: (value: number) => string
  formatTariff: (value: number) => string
}

export const PricingComparisonTable: React.FC<PricingComparisonTableProps> = ({
  rows,
  formatCurrency,
  formatTariff,
}) => {
  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.cellYear]}>Período</Text>
        <Text style={[styles.headerCell, styles.cellTariff]}>Tarifas (cheia / desconto)</Text>
        <Text style={[styles.headerCell, styles.cellAmount]}>Mensalidade (comparação)</Text>
      </View>
      
      {/* Rows - allow breaks between years */}
      {rows.map((row) => (
        <View key={row.ano} style={styles.row} wrap={false}>
          <Text style={styles.cellYear}>{row.ano}º ano</Text>
          
          <View style={styles.cellTariff}>
            <View style={styles.tariffLine}>
              <Text style={styles.label}>Cheia </Text>
              <Text>{formatTariff(row.tarifaCheiaAno)}</Text>
            </View>
            <View style={styles.tariffLine}>
              <Text style={styles.label}>Com desconto </Text>
              <Text>{formatTariff(row.tarifaComDesconto)}</Text>
            </View>
          </View>
          
          <View style={styles.cellAmount}>
            <View style={styles.tariffLine}>
              <Text style={styles.label}>Distribuidora </Text>
              <Text>{formatCurrency(row.mensalidadeDistribuidora)}</Text>
            </View>
            <View style={styles.tariffLine}>
              <Text style={styles.label}>SolarInvest </Text>
              <Text>{formatCurrency(row.mensalidadeSolarInvest)}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}
