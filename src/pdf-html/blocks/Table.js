import React from 'react'

import { hasMeaningfulValue, joinClassNames } from '../utils.js'

const h = React.createElement

export const Table = ({ columns = [], rows = [], className }) => {
  const filteredRows = rows.filter((row) =>
    columns.some((column) => hasMeaningfulValue(row?.[column.key])),
  )
  if (filteredRows.length === 0) return null

  return h(
    'table',
    { className: joinClassNames('table', className) },
    h(
      'thead',
      null,
      h(
        'tr',
        null,
        columns.map((column) =>
          h('th', { key: column.key, style: column.align ? { textAlign: column.align } : undefined }, column.label),
        ),
      ),
    ),
    h(
      'tbody',
      null,
      filteredRows.map((row, index) =>
        h(
          'tr',
          { key: `row-${index}` },
          columns.map((column) =>
            h(
              'td',
              { key: column.key, style: column.align ? { textAlign: column.align } : undefined },
              row?.[column.key],
            ),
          ),
        ),
      ),
    ),
  )
}

export default Table
