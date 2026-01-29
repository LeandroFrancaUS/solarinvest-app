import React from 'react'

import { joinClassNames } from '../utils.js'

const h = React.createElement

export const Notice = ({ title, variant = 'info', children, className }) =>
  h(
    'div',
    { className: joinClassNames('notice', `notice--${variant}`, className) },
    title ? h('strong', { className: 'notice__title' }, title) : null,
    h('div', { className: 'notice__body' }, children),
  )

export default Notice
