import React from 'react'

import { hasRenderableChildren, joinClassNames, sectionShouldRender } from '../utils.js'

const h = React.createElement

export const Section = ({ title, subtitle, rows, className, children, id }) => {
  const shouldRender =
    sectionShouldRender(rows ?? []) || hasRenderableChildren(children, React)
  if (!shouldRender) {
    return null
  }

  return h(
    'section',
    { className: joinClassNames('section', className), id },
    title ? h('h2', { className: 'section-title no-break-after-title' }, title) : null,
    subtitle ? h('p', { className: 'section-subtitle' }, subtitle) : null,
    children,
  )
}

export default Section
