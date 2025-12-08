import React from 'react'

import type { PrintableProposalProps } from '../../../types/printableProposal'
import { PrintableProposalVendaInner } from './PrintableInner'

import './printable-v7.css'
import '../../../styles/print-pdf-v7.css'

type PrintVariant = 'standard' | 'simple' | 'buyout'

const normalizeVariant = (value: string | null | undefined): PrintVariant => {
  if (value === 'simple') {
    return 'simple'
  }
  if (value === 'buyout') {
    return 'buyout'
  }
  return 'standard'
}

export const PrintableProposalVenda = React.forwardRef<HTMLDivElement, PrintableProposalProps>(
  function PrintableProposalVenda(props, ref) {
    const [variant, setVariant] = React.useState<PrintVariant>('standard')
    const innerRef = React.useRef<HTMLDivElement | null>(null)

    React.useImperativeHandle(ref, () => innerRef.current as HTMLDivElement)

    React.useEffect(() => {
      if (typeof document === 'undefined') {
        return
      }

      const body = document.body
      const html = document.documentElement
      if (!body || !html) {
        return
      }

      if (body.getAttribute('data-print-mode') == null) {
        body.setAttribute('data-print-mode', 'preview')
      }
      if (html.getAttribute('data-print-mode') == null) {
        html.setAttribute('data-print-mode', 'preview')
      }

      const updateFromDom = () => {
        const fromBody = normalizeVariant(body.getAttribute('data-print-variant'))
        const fromHtml = normalizeVariant(html.getAttribute('data-print-variant'))
        const next = fromBody === 'standard' ? fromHtml : fromBody
        setVariant((current) => (current === next ? current : next))
      }

      updateFromDom()

      const observer = new MutationObserver(updateFromDom)
      observer.observe(body, { attributes: true, attributeFilter: ['data-print-variant'] })
      observer.observe(html, { attributes: true, attributeFilter: ['data-print-variant'] })

      return () => observer.disconnect()
    }, [])

    React.useEffect(() => {
      if (typeof document === 'undefined') {
        return
      }

      const body = document.body
      const html = document.documentElement
      const normalized = normalizeVariant(variant)

      if (body && body.getAttribute('data-print-variant') !== normalized) {
        body.setAttribute('data-print-variant', normalized)
      }
      if (html && html.getAttribute('data-print-variant') !== normalized) {
        html.setAttribute('data-print-variant', normalized)
      }
    }, [variant])

    React.useEffect(() => {
      if (typeof window === 'undefined') {
        return
      }

      const resetMode = () => {
        if (typeof document === 'undefined') {
          return
        }
        document.body?.setAttribute('data-print-mode', 'preview')
        document.documentElement?.setAttribute('data-print-mode', 'preview')
      }

      window.addEventListener('afterprint', resetMode)

      return () => {
        window.removeEventListener('afterprint', resetMode)
      }
    }, [])

    const resolvedVariant = variant === 'buyout' ? 'standard' : variant

    return (
      <div className="printable-v7-wrapper" data-print-variant={resolvedVariant}>
        <PrintableProposalVendaInner ref={innerRef} {...props} />
      </div>
    )
  },
)

export default PrintableProposalVenda
