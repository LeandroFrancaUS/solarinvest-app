/**
 * Pure PDF/print rendering utilities extracted from App.tsx.
 *
 * These helpers are responsible for rendering React components off-screen and
 * converting the resulting HTML into strings that can be piped to a PDF backend
 * or a browser print window.  They have no side-effects on application state.
 */
import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import type { PrintableProposalProps } from '../../types/printableProposal'
import type { PrintableBuyoutTableProps } from '../../components/print/PrintableBuyoutTable'
import { shouldUseBentoGrid } from '../../utils/pdfVariant'
import { renderBentoLeasingToHtml, buildBentoLeasingPdfDocument } from '../../utils/renderBentoLeasing'
import { printStyles, simplePrintStyles } from '../../styles/printTheme'

// Lazy-loaded only when needed to avoid eager bundle cost.
const PrintableProposal = React.lazy(() => import('../../components/print/PrintableProposal'))
const PrintableBuyoutTable = React.lazy(() => import('../../components/print/PrintableBuyoutTable'))

export type PrintVariant = 'standard' | 'simple' | 'buyout'

/**
 * Renders a PrintableProposal component off-screen and returns the outer HTML.
 * Waits for any Recharts SVGs to be populated before capturing.
 */
export function renderPrintableProposalToHtml(
  dados: PrintableProposalProps,
  userBentoPreference?: boolean,
): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null)
  }

  // Use Bento Grid for leasing proposals when user preference is enabled
  if (shouldUseBentoGrid(dados, userBentoPreference)) {
    return renderBentoLeasingToHtml(dados)
  }

  // Legacy rendering for other proposal types
  return new Promise((resolve) => {
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    container.style.width = '672px'
    container.style.padding = '0'
    container.style.background = '#f8fafc'
    container.style.zIndex = '-1'
    document.body.appendChild(container)

    let resolved = false

    const cleanup = (root: ReturnType<typeof createRoot> | null) => {
      if (root) {
        root.unmount()
      }
      if (container.parentElement) {
        container.parentElement.removeChild(container)
      }
    }

    const PrintableHost: React.FC = () => {
      const wrapperRef = useRef<HTMLDivElement>(null)
      const localRef = useRef<HTMLDivElement>(null)

      useEffect(() => {
        const timeouts: number[] = []
        let attempts = 0
        const maxAttempts = 8

        const chartIsReady = (containerEl: HTMLDivElement | null) => {
          if (!containerEl) {
            return false
          }
          const chartWrapper = containerEl.querySelector('.recharts-wrapper')
          if (!chartWrapper) {
            return true
          }
          const chartSvg = chartWrapper.querySelector('svg')
          if (!chartSvg) {
            return false
          }
          return chartSvg.childNodes.length > 0
        }

        const attemptCapture = (root: ReturnType<typeof createRoot> | null) => {
          if (resolved) {
            return
          }

          const containerEl = wrapperRef.current

          if (containerEl && chartIsReady(containerEl)) {
            resolved = true
            resolve(containerEl.outerHTML)
            cleanup(root)
            return
          }

          attempts += 1
          if (attempts >= maxAttempts) {
            resolved = true
            resolve(containerEl ? containerEl.outerHTML : null)
            cleanup(root)
            return
          }

          const timeoutId = window.setTimeout(() => attemptCapture(root), 160)
          timeouts.push(timeoutId)
        }

        const triggerResize = () => {
          window.dispatchEvent(new Event('resize'))
        }

        const resizeTimeout = window.setTimeout(triggerResize, 120)
        timeouts.push(resizeTimeout)

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const initialTimeout = window.setTimeout(() => attemptCapture(rootInstance), 220)
        timeouts.push(initialTimeout)

        return () => {
          timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
        }
      }, [])

      return (
        <div ref={wrapperRef} data-print-mode="download" data-print-variant="standard">
          <React.Suspense fallback={null}>
            <PrintableProposal ref={localRef} {...dados} />
          </React.Suspense>
        </div>
      )
    }

    const rootInstance = createRoot(container)
    rootInstance.render(<PrintableHost />)
  })
}

/**
 * Strips any stray "html coding" artefacts that some older Gotenberg versions
 * could inject into the captured HTML.
 */
export function sanitizePrintableHtml(html: string | null): string | null {
  if (typeof html !== 'string') {
    return html
  }

  return html.replace(/html\s*coding/gi, '').trim()
}

/**
 * Wraps a rendered HTML fragment in a full document suitable for the PDF
 * backend (Gotenberg / Convert API).  Delegates to the Bento Grid document
 * builder when the fragment contains the Bento root marker.
 */
export const buildProposalPdfDocument = (
  layoutHtml: string,
  nomeCliente: string,
  variant: PrintVariant = 'standard',
) => {
  const safeCliente = nomeCliente?.trim() || 'SolarInvest'
  const safeHtml = layoutHtml || ''

  // Check if this is Bento Grid HTML (contains the marker)
  if (safeHtml.includes('data-testid="proposal-bento-root"')) {
    // Use Bento Grid document wrapper
    return buildBentoLeasingPdfDocument(safeHtml, safeCliente)
  }

  // Legacy PDF document structure
  return `<!DOCTYPE html>
<html data-print-mode="download" data-print-variant="${variant}">
  <head>
    <meta charset="utf-8" />
    <title>Proposta-${safeCliente}</title>
    <style>
      ${printStyles}
      ${simplePrintStyles}
      body{margin:0;background:#f8fafc;}
      .preview-container{max-width:calc(210mm - 32mm);width:100%;margin:0 auto;padding:24px 0 40px;}
    </style>
  </head>
  <body data-print-mode="download" data-print-variant="${variant}">
    <div class="preview-container">${safeHtml}</div>
  </body>
</html>`
}

/**
 * Renders a PrintableBuyoutTable component off-screen and returns the outer HTML.
 */
export function renderPrintableBuyoutTableToHtml(
  dados: PrintableBuyoutTableProps,
): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    container.style.width = '672px'
    container.style.padding = '0'
    container.style.background = '#f8fafc'
    container.style.zIndex = '-1'
    document.body.appendChild(container)

    let resolved = false
    let rootInstance: ReturnType<typeof createRoot> | null = null

    const cleanup = () => {
      if (rootInstance) {
        rootInstance.unmount()
      }
      if (container.parentElement) {
        container.parentElement.removeChild(container)
      }
    }

    const finalize = (html: string | null) => {
      if (resolved) {
        return
      }
      resolved = true
      resolve(html)
      cleanup()
    }

    const PrintableHost: React.FC = () => {
      const wrapperRef = useRef<HTMLDivElement>(null)

      useEffect(() => {
        const timeouts: number[] = []
        let attempts = 0
        const maxAttempts = 12

        const hasBuyoutContent = (containerEl: HTMLDivElement | null) => {
          if (!containerEl) {
            return false
          }

          return Boolean(containerEl.querySelector('[data-print-section="buyout"] .print-page'))
        }

        const attemptCapture = () => {
          const containerEl = wrapperRef.current
          if (hasBuyoutContent(containerEl)) {
            finalize(containerEl?.outerHTML ?? null)
            return
          }

          attempts += 1
          if (attempts >= maxAttempts) {
            finalize(containerEl?.outerHTML ?? null)
            return
          }

          const timeoutId = window.setTimeout(attemptCapture, 120)
          timeouts.push(timeoutId)
        }

        const initialTimeout = window.setTimeout(attemptCapture, 200)
        timeouts.push(initialTimeout)

        return () => {
          timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
          const html = wrapperRef.current ? wrapperRef.current.outerHTML : null
          finalize(html)
        }
      }, [])

      return (
        <div ref={wrapperRef} data-print-mode="download" data-print-variant="buyout">
          <React.Suspense fallback={null}>
            <PrintableBuyoutTable {...dados} />
          </React.Suspense>
        </div>
      )
    }

    rootInstance = createRoot(container)
    rootInstance.render(<PrintableHost />)
  })
}
