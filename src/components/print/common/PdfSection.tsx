import React from 'react'

import { hasRenderableChildren } from './pdfLayoutUtils'

type PdfSectionProps = {
  id?: string
  title?: string
  headingLevel?: 'h2' | 'h3' | 'h4'
  className?: string
  headingClassName?: string
  children?: React.ReactNode
}

export const PdfSection: React.FC<PdfSectionProps> = ({
  id,
  title,
  headingLevel = 'h2',
  className = '',
  headingClassName = '',
  children,
}) => {
  const shouldRender = hasRenderableChildren(children)

  if (!shouldRender) {
    if (title && process.env.NODE_ENV !== 'production') {
      throw new Error(`PdfSection "${title}" rendered without content.`)
    }
    return null
  }

  const HeadingTag = headingLevel
  const sectionClassName = ['print-section', className].filter(Boolean).join(' ')
  const headingClass = ['keep-with-next', headingClassName].filter(Boolean).join(' ')

  return (
    <section id={id} className={sectionClassName}>
      {title ? <HeadingTag className={headingClass}>{title}</HeadingTag> : null}
      {children}
    </section>
  )
}

export default PdfSection
