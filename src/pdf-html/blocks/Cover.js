import React from 'react'

const h = React.createElement

export const Cover = ({ clientName, location, proposalCode, subtitle, logoUrl }) =>
  h(
    'section',
    { className: 'cover keep-together' },
    h('div', { className: 'cover__background-shape' }),
    h('div', { className: 'cover__header' }, h('img', { src: logoUrl, alt: 'SolarInvest' })),
    h(
      'div',
      { className: 'cover__content' },
      h('span', { className: 'cover__eyebrow' }, 'SolarInvest'),
      h('h1', null, 'Proposta Comercial'),
      subtitle ? h('p', { className: 'cover__subtitle' }, subtitle) : null,
      h(
        'div',
        { className: 'cover__client' },
        clientName ? h('strong', null, clientName) : null,
        location ? h('span', null, location) : null,
      ),
      proposalCode ? h('div', { className: 'cover__code' }, `Código: ${proposalCode}`) : null,
    ),
  )

export default Cover
