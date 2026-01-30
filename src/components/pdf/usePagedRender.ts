import { useEffect, useRef, useState } from 'react'

interface UsePagedRenderOptions {
  onComplete?: () => void
  onError?: (error: Error) => void
}

interface PagedWindow extends Window {
  PagedConfig?: { auto: boolean }
  PagedPolyfill?: {
    preview: () => Promise<void>
  }
  pagedRenderingComplete?: boolean
}

/**
 * usePagedRender - Hook to trigger Paged.js rendering
 * Waits for fonts and images to load before rendering pages
 */
export const usePagedRender = (options: UsePagedRenderOptions = {}) => {
  const [isRendering, setIsRendering] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const hasRendered = useRef(false)

  // Extract callbacks to avoid dependency issues
  const { onComplete, onError } = options

  useEffect(() => {
    // Only render once
    if (hasRendered.current) {
      return
    }

    const renderPages = async () => {
      const win = window as PagedWindow

      // Check if Paged.js is available
      if (!win.PagedPolyfill) {
        const err = new Error('Paged.js polyfill not loaded. Ensure /vendor/paged.polyfill.js is included.')
        setError(err)
        options.onError?.(err)
        return
      }

      try {
        setIsRendering(true)
        hasRendered.current = true

        // Wait for fonts to be ready
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready
        }

        // Wait for all images to load
        const images = Array.from(document.images)
        await Promise.all(
          images.map((img) => {
            if (img.complete) return Promise.resolve()
            return new Promise((resolve, reject) => {
              img.onload = resolve
              img.onerror = reject
              // Add timeout to prevent hanging
              setTimeout(resolve, 5000)
            })
          })
        )

        // Small delay to ensure DOM is stable
        await new Promise(resolve => setTimeout(resolve, 100))

        // Trigger Paged.js rendering
        await win.PagedPolyfill.preview()

        // Mark rendering as complete
        win.pagedRenderingComplete = true
        document.body.classList.add('render-finished')

        setIsComplete(true)
        setIsRendering(false)
        onComplete?.()
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        setIsRendering(false)
        onError?.(error)
      }
    }

    // Start rendering after a short delay to ensure DOM is ready
    const timer = setTimeout(renderPages, 300)

    return () => clearTimeout(timer)
  }, [onComplete, onError])

  return { isRendering, isComplete, error }
}
