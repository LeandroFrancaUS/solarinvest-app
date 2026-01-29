import React from 'react'

import { hasMeaningfulValue } from './pdfLayoutUtils'

type KeyValueRow = {
  label: string
  value: React.ReactNode
}

type KeyValueGridProps = {
  rows: KeyValueRow[]
  columns?: 1 | 2 | 3
  className?: string
  labelClassName?: string
  valueClassName?: string
}

export const KeyValueGrid: React.FC<KeyValueGridProps> = ({
  rows,
  columns = 2,
  className = '',
  labelClassName = '',
  valueClassName = '',
}) => {
  const visibleRows = rows.filter((row) => hasMeaningfulValue(row.value))
  if (visibleRows.length === 0) {
    return null
  }

  const gridClass = [
    'print-key-value-grid',
    `print-key-value-grid--cols-${columns}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <dl className={gridClass}>
      {visibleRows.map((row) => (
        <div className="print-key-value-grid__row" key={`${row.label}-${String(row.value)}`}>
          <dt className={['print-key-value-grid__label', labelClassName].filter(Boolean).join(' ')}>
            {row.label}
          </dt>
          <dd className={['print-key-value-grid__value', valueClassName].filter(Boolean).join(' ')}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default KeyValueGrid
