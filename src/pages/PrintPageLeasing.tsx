import React, { useCallback, useEffect, useState } from 'react'
import { PrintableProposalLeasingBento } from '../components/pdf/PrintableProposalLeasingBento'
import { usePagedRender } from '../components/pdf/usePagedRender'
import { attachBentoValidationToWindow } from '../utils/bentoValidation'
import type { PrintableProposalProps } from '../types/printableProposal'
import '../styles/print-bento.css'

interface PrintPageLeasingProps {
  data: PrintableProposalProps
}

/**
 * Standalone print page for Leasing proposals
 * This component is meant to be rendered in isolation for PDF generation
 */
export const PrintPageLeasing: React.FC<PrintPageLeasingProps> = ({ data }) => {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)

  // Load Paged.js polyfill
  useEffect(() => {
    // Set PagedConfig before loading the polyfill
    if (typeof window !== 'undefined') {
      (window as any).PagedConfig = { auto: false }

      // Check if script is already loaded
      const existingScript = document.querySelector('script[src*="paged.polyfill.js"]')
      if (existingScript) {
        setIsScriptLoaded(true)
        return
      }

      // Create config script
      const configScript = document.createElement('script')
      configScript.textContent = 'window.PagedConfig = { auto: false };'
      document.head.appendChild(configScript)

      // Load the polyfill script
      const script = document.createElement('script')
      script.src = '/vendor/paged.polyfill.js'
      script.async = true
      script.onload = () => {
        console.log('✓ Paged.js polyfill loaded')
        setIsScriptLoaded(true)
      }
      script.onerror = () => {
        console.error('✗ Failed to load Paged.js polyfill')
      }
      document.head.appendChild(script)

      return () => {
        // Cleanup both scripts
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
        if (configScript.parentNode) {
          configScript.parentNode.removeChild(configScript)
        }
      }
    }
  }, [])

  // Stable callbacks for usePagedRender
  const handleComplete = useCallback(() => {
    console.log('✓ Paged.js rendering complete')
  }, [])

  const handleError = useCallback((err: Error) => {
    console.error('✗ Paged.js rendering error:', err)
  }, [])

  // Trigger Paged.js rendering once the script is loaded
  const { isRendering, error } = usePagedRender({
    onComplete: handleComplete,
    onError: handleError,
  })

  // Attach validation functions to window for Playwright
  useEffect(() => {
    attachBentoValidationToWindow()
  }, [])

  if (error) {
    return (
      <div className="p-8 text-red-600">
        <h1 className="text-2xl font-bold mb-4">Erro ao Renderizar PDF</h1>
        <p>{error.message}</p>
      </div>
    )
  }

  return (
    <>
      {isRendering && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg z-50 text-sm">
          Renderizando páginas...
        </div>
      )}
      <PrintableProposalLeasingBento {...data} />
    </>
  )
}
