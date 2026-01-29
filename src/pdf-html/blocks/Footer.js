import React from 'react'

const h = React.createElement

export const Footer = ({ issuedAt, validityText }) =>
  h(
    'footer',
    { className: 'proposal-footer keep-together' },
    h(
      'div',
      { className: 'proposal-footer__meta' },
      issuedAt
        ? h('p', null, h('strong', null, 'Data de emissão:'), ` ${issuedAt}`)
        : null,
      validityText
        ? h('p', null, h('strong', null, 'Validade:'), ` ${validityText}`)
        : null,
    ),
    h('div', { className: 'proposal-footer__signature' }, h('div', { className: 'signature-line' }), h('span', null, 'Assinatura do cliente')),
    h(
      'p',
      { className: 'proposal-footer__note' },
      'Ao assinar esta proposta, o cliente manifesta intenção de contratação com a SolarInvest. Este documento não constitui contrato.',
    ),
  )

export default Footer
