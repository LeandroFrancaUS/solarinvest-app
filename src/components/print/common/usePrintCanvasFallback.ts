import { useEffect } from 'react'

const PRINT_SWAP_FLAG = 'printSwap'

const SHOW_ELEMENT_STYLE = ''

const ensureNoBreakInside = (element: HTMLElement) => {
  if (!element.classList.contains('no-break-inside')) {
    element.classList.add('no-break-inside')
  }
}

export const usePrintCanvasFallback = (sectionSelector: string) => {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const getSection = () => document.querySelector(sectionSelector)

    const swapCanvasForImage = () => {
      const section = getSection()
      if (!section) {
        return
      }

      const canvases = section.querySelectorAll('canvas')
      canvases.forEach((canvasNode) => {
        const canvas = canvasNode instanceof HTMLCanvasElement ? canvasNode : null
        if (!canvas) {
          return
        }

        if (canvas.dataset[PRINT_SWAP_FLAG] === '1') {
          return
        }

        let dataUrl: string | null = null
        try {
          dataUrl = canvas.toDataURL('image/png')
        } catch (error) {
          dataUrl = null
        }

        if (!dataUrl) {
          return
        }

        const fallbackImage = document.createElement('img')
        fallbackImage.src = dataUrl
        fallbackImage.className = 'chart'
        fallbackImage.dataset.printSwap = '1'
        fallbackImage.alt = canvas.getAttribute('aria-label') || 'Gráfico impresso'
        ensureNoBreakInside(fallbackImage)

        canvas.dataset[PRINT_SWAP_FLAG] = '1'
        canvas.style.display = 'none'

        const parent = canvas.parentElement
        if (parent) {
          parent.insertBefore(fallbackImage, canvas)
        }
      })
    }

    const restoreCanvas = () => {
      const section = getSection()
      if (!section) {
        return
      }

      section.querySelectorAll('img[data-print-swap="1"]').forEach((image) => {
        if (image instanceof HTMLImageElement) {
          image.remove()
        }
      })

      section.querySelectorAll('canvas').forEach((canvasNode) => {
        const canvas = canvasNode instanceof HTMLCanvasElement ? canvasNode : null
        if (!canvas) {
          return
        }

        if (canvas.dataset[PRINT_SWAP_FLAG] === '1') {
          canvas.style.display = SHOW_ELEMENT_STYLE
          delete canvas.dataset[PRINT_SWAP_FLAG]
        }
      })
    }

    const handleBeforePrint = () => {
      swapCanvasForImage()
    }

    const handleAfterPrint = () => {
      restoreCanvas()
    }

    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)

    let mediaQuery: MediaQueryList | null = null
    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        handleBeforePrint()
      } else {
        handleAfterPrint()
      }
    }

    if (typeof window.matchMedia === 'function') {
      mediaQuery = window.matchMedia('print')
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleMediaChange)
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleMediaChange)
      }
    }

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === 'function') {
          mediaQuery.removeEventListener('change', handleMediaChange)
        } else if (typeof mediaQuery.removeListener === 'function') {
          mediaQuery.removeListener(handleMediaChange)
        }
      }
      restoreCanvas()
    }
  }, [sectionSelector])
}

export default usePrintCanvasFallback
