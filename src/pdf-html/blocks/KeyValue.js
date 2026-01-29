import React from 'react'

import { joinClassNames, hasMeaningfulValue } from '../utils.js'

const h = React.createElement

export const KeyValue = ({ rows = [], columns = 2, className }) => {
  const visibleRows = rows.filter((row) => hasMeaningfulValue(row?.value))
  if (visibleRows.length === 0) return null

  return h(
    'dl',
    {
      className: joinClassNames('key-value-grid', `key-value-grid--cols-${columns}`, className),
    },
    visibleRows.map((row, index) =>
      h(
        'div',
        { className: 'key-value-grid__row', key: `${row.label}-${index}` },
        h('dt', { className: 'key-value-grid__label' }, row.label),
        h('dd', { className: 'key-value-grid__value' }, row.value),
      ),
    ),
  )
}

export default KeyValue
