/**
 * Table Component for PDF
 * 
 * Renders a table with headers and rows.
 */

import { View, Text } from '@react-pdf/renderer';
import { styles } from '../styles/theme';

export interface TableColumn {
  header: string;
  key: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps {
  columns: TableColumn[];
  data: Record<string, unknown>[];
}

export function Table({ columns, data }: TableProps) {
  if (data.length === 0) {
    return null;
  }

  return (
    <View style={styles.table}>
      {/* Header Row */}
      <View style={[styles.tableRow, styles.tableHeader]}>
        {columns.map((column) => (
          <View
            key={column.key}
            style={[
              styles.tableCell,
              { width: column.width || `${100 / columns.length}%` },
            ]}
          >
            <Text style={{ textAlign: column.align || 'left' }}>
              {column.header}
            </Text>
          </View>
        ))}
      </View>

      {/* Data Rows */}
      {data.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.tableRow}>
          {columns.map((column) => (
            <View
              key={column.key}
              style={[
                styles.tableCell,
                { width: column.width || `${100 / columns.length}%` },
              ]}
            >
              <Text style={{ textAlign: column.align || 'left' }}>
                {String(row[column.key] ?? '')}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
