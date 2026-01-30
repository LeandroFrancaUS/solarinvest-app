import { createRoot } from 'react-dom/client'
import React, { useEffect, useRef } from 'react'
import type { PrintableProposalProps } from '../types/printableProposal'
import { PrintableProposalLeasingBento } from '../components/pdf/PrintableProposalLeasingBento'

/**
 * Render the Bento Grid Leasing proposal to HTML string for PDF generation
 * This creates an off-screen DOM element and renders the component into it
 */
export function renderBentoLeasingToHtml(dados: PrintableProposalProps): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    container.style.width = '210mm' // A4 width
    container.style.padding = '0'
    container.style.background = '#F8FAFC'
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

      useEffect(() => {
        // Wait for rendering to complete
        // The Bento Grid doesn't have charts, so we can capture faster
        const timeoutId = window.setTimeout(() => {
          if (resolved) return

          const containerEl = wrapperRef.current
          if (containerEl) {
            resolved = true
            resolve(containerEl.outerHTML)
            cleanup(rootInstance)
          }
        }, 500)

        return () => {
          window.clearTimeout(timeoutId)
        }
      }, [])

      return (
        <div ref={wrapperRef}>
          <PrintableProposalLeasingBento {...dados} />
        </div>
      )
    }

    const rootInstance = createRoot(container)
    rootInstance.render(<PrintableHost />)

    // Fallback timeout
    window.setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve(container.outerHTML)
        cleanup(rootInstance)
      }
    }, 3000)
  })
}

/**
 * Build a complete HTML document for the Bento Grid Leasing PDF
 * Includes Tailwind CSS and Paged.js configuration
 */
export function buildBentoLeasingPdfDocument(layoutHtml: string, nomeCliente: string): string {
  const safeCliente = (nomeCliente?.trim() || 'SolarInvest').replace(/[<>"'&]/g, (match) => {
    const escapes: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '&': '&amp;',
    }
    return escapes[match] || match
  })
  const safeHtml = layoutHtml || ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Proposta-Leasing-${safeCliente}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- Load Tailwind CSS from the built stylesheet -->
    <link rel="stylesheet" href="/src/styles.css" />
    <link rel="stylesheet" href="/src/styles/print-bento.css" />
    
    <style>
      /* Ensure print colors are exact */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      /* Print-specific page rules */
      @page {
        size: A4;
        margin: 0 !important;
      }
      
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #F8FAFC !important;
      }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      }
      
      /* Hide any debug indicators */
      .fixed {
        display: none !important;
      }
    </style>
    
    <!-- Paged.js Configuration -->
    <script>window.PagedConfig = { auto: false };</script>
    <script src="/vendor/paged.polyfill.js"></script>
  </head>
  <body>
    ${safeHtml}
    
    <!-- Trigger Paged.js rendering after content loads -->
    <script>
      if (window.PagedPolyfill) {
        document.fonts.ready.then(() => {
          setTimeout(() => {
            window.PagedPolyfill.preview().then(() => {
              window.pagedRenderingComplete = true;
              document.body.classList.add('render-finished');
              console.log('Paged.js rendering complete');
            }).catch(err => {
              console.error('Paged.js rendering error:', err);
            });
          }, 100);
        });
      }
    </script>
  </body>
</html>`
}
