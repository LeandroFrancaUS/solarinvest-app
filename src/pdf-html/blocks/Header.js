import React from 'react'

import { joinClassNames } from '../utils.js'

const h = React.createElement

export const Header = ({ title, subtitle, meta, className, logoUrl }) =>
  h(
    'header',
    { className: joinClassNames('proposal-header', className) },
    h(
      'div',
      { className: 'proposal-header__brand' },
      h('img', { src: logoUrl, alt: 'SolarInvest' }),
      h(
        'div',
        { className: 'proposal-header__titles' },
        h('span', { className: 'proposal-header__eyebrow' }, subtitle),
        h('h1', null, title),
      ),
    ),
    meta
      ? h(
          'div',
          { className: 'proposal-header__meta' },
          meta.map((item, index) =>
            h(
              'div',
              { className: 'proposal-header__meta-item', key: `${item.label}-${index}` },
              h('span', null, item.label),
              h('strong', null, item.value),
            ),
          ),
        )
      : null,
  )

export default Header
