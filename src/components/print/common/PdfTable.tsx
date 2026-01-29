import React from 'react'

import { hasMeaningfulValue } from './pdfLayoutUtils'

type PdfTableColumn<Row> = {
  key: keyof Row
  label: string
  align?: 'left' | 'right' | 'center'
}

type PdfTableProps<Row extends Record<string, React.ReactNode>> = {
  columns: PdfTableColumn<Row>[]
  rows: Row[]
  className?: string
  fixedHeader?: boolean
}

export function PdfTable<Row extends Record<string, React.ReactNode>>({
  columns,
  rows,
  className = '',
  fixedHeader = true,
}: PdfTableProps<Row>) {
  const filteredRows = rows.filter((row) =>
    columns.some((column) => hasMeaningfulValue(row[column.key])),
  )

  if (filteredRows.length === 0) {
    return null
  }

  return (
    <table className={['print-table', className].filter(Boolean).join(' ')}>
      <thead className={fixedHeader ? 'print-table__header' : undefined}>
        <tr>
          {columns.map((column) => (
            <th key={String(column.key)} style={column.align ? { textAlign: column.align } : undefined}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filteredRows.map((row, index) => (
          <tr key={`${index}-${columns.map((column) => String(row[column.key])).join('-')}`}>
            {columns.map((column) => (
              <td key={String(column.key)} style={column.align ? { textAlign: column.align } : undefined}>
                {row[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default PdfTable
