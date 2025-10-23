import { useEffect } from 'react'

const PRINT_SWAP_FLAG = 'printSwap'

const SHOW_ELEMENT_STYLE = ''
const CHART_ALT_FALLBACK = 'Gráfico impresso'

const parseDimension = (value?: string | null): number => {
  if (!value) {
    return 0
  }

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const getChartAltText = (element: Element): string => {
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel) {
    return ariaLabel
  }

  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy && typeof document !== 'undefined') {
    const text = labelledBy
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter((value): value is string => Boolean(value))
      .join(' ')

    if (text) {
      return text
    }
  }

  return CHART_ALT_FALLBACK
}

const createFallbackImage = (source: Element, dataUrl: string): HTMLImageElement => {
  const fallbackImage = document.createElement('img')
  fallbackImage.src = dataUrl
  fallbackImage.className = 'chart'
  fallbackImage.dataset.printSwap = '1'
  fallbackImage.alt = getChartAltText(source)
  fallbackImage.style.display = 'block'
  fallbackImage.style.width = '100%'
  fallbackImage.style.height = 'auto'
  fallbackImage.loading = 'lazy'
  ensureNoBreakInside(fallbackImage)
  return fallbackImage
}

const convertSvgToDataUrl = (svg: SVGSVGElement): string | null => {
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement
    const viewBox = svg.viewBox?.baseVal
    const bbox = svg.getBoundingClientRect()

    const width =
      parseDimension(svg.getAttribute('width')) || viewBox?.width || bbox.width || parseDimension(clone.getAttribute('width'))
    const height =
      parseDimension(svg.getAttribute('height')) || viewBox?.height || bbox.height || parseDimension(clone.getAttribute('height'))

    if (width) {
      clone.setAttribute('width', `${width}`)
    }
    if (height) {
      clone.setAttribute('height', `${height}`)
    }

    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    }
    if (!clone.getAttribute('xmlns:xlink')) {
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    }

    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    background.setAttribute('width', '100%')
    background.setAttribute('height', '100%')
    background.setAttribute('fill', '#ffffff')
    clone.insertBefore(background, clone.firstChild)

    const serializer = new XMLSerializer()
    const serialized = serializer.serializeToString(clone)
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`
  } catch (error) {
    return null
  }
}

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

    const swapChartsForImages = () => {
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

        const fallbackImage = createFallbackImage(canvas, dataUrl)

        canvas.dataset[PRINT_SWAP_FLAG] = '1'
        canvas.style.display = 'none'

        const parent = canvas.parentElement
        if (parent) {
          parent.insertBefore(fallbackImage, canvas)
        }
      })

      const svgs = section.querySelectorAll('svg')
      svgs.forEach((svgNode) => {
        const svg = svgNode instanceof SVGSVGElement ? svgNode : null
        if (!svg) {
          return
        }

        if (svg.dataset[PRINT_SWAP_FLAG] === '1') {
          return
        }

        const chartContainer =
          svg.closest('.recharts-wrapper') ||
          svg.closest('[data-chart-root]') ||
          svg.closest('[data-chart-container]') ||
          svg.closest('[data-print-chart]')

        if (!chartContainer) {
          return
        }

        const dataUrl = convertSvgToDataUrl(svg)
        if (!dataUrl) {
          return
        }

        const fallbackImage = createFallbackImage(svg, dataUrl)

        svg.dataset[PRINT_SWAP_FLAG] = '1'
        svg.style.display = 'none'

        const parent = svg.parentElement
        if (parent) {
          parent.insertBefore(fallbackImage, svg)
        }
      })
    }

    const restoreCharts = () => {
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

      section.querySelectorAll('svg').forEach((svgNode) => {
        const svg = svgNode instanceof SVGSVGElement ? svgNode : null
        if (!svg) {
          return
        }

        if (svg.dataset[PRINT_SWAP_FLAG] === '1') {
          svg.style.display = SHOW_ELEMENT_STYLE
          delete svg.dataset[PRINT_SWAP_FLAG]
        }
      })
    }

    const handleBeforePrint = () => {
      swapChartsForImages()
    }

    const handleAfterPrint = () => {
      restoreCharts()
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
      restoreCharts()
    }
  }, [sectionSelector])
}

export default usePrintCanvasFallback
