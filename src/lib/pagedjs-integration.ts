/**
 * Paged.js Integration Module
 * Orchestrates pagination lifecycle and Playwright synchronization
 */

import { Paged } from 'pagedjs'

declare global {
  interface Window {
    PagedConfig?: {
      auto?: boolean
      after?: (flow: unknown) => void
    }
    PagedPolyfill?: Paged
    pagedRenderingComplete?: boolean
  }
}

/**
 * Initialize Paged.js with proper lifecycle management
 * Waits for fonts and images before triggering pagination
 * Sets up Playwright handshake signal
 */
export async function initializePagedJS(): Promise<void> {
  // Configure Paged.js behavior
  window.PagedConfig = {
    auto: false, // Manual control of pagination trigger
    after: (flow) => {
      // Signal to Playwright that rendering is complete
      window.pagedRenderingComplete = true
      document.body.classList.add('render-success')
      console.log('[Paged.js] Pagination complete, ready for capture')
    },
  }

  try {
    // Wait for fonts to load
    await document.fonts.ready
    console.log('[Paged.js] Fonts loaded')

    // Wait for all images to load
    await waitForImages()
    console.log('[Paged.js] Images loaded')

    // Initialize Paged.js
    const paged = new Paged()
    window.PagedPolyfill = paged

    // Trigger pagination
    await paged.preview()
    console.log('[Paged.js] Preview initiated')
  } catch (error) {
    console.error('[Paged.js] Initialization error:', error)
    // Still add error class and flag to avoid Playwright timeout
    window.pagedRenderingComplete = true
    document.body.classList.add('render-error')
    throw error
  }
}

/**
 * Wait for all images in the document to load
 */
function waitForImages(): Promise<void> {
  const images = Array.from(document.images)
  
  if (images.length === 0) {
    return Promise.resolve()
  }

  const imagePromises = images.map((img) => {
    if (img.complete) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      img.addEventListener('load', () => resolve())
      img.addEventListener('error', () => {
        console.warn(`[Paged.js] Image failed to load: ${img.src}`)
        resolve() // Resolve anyway to not block rendering
      })
    })
  })

  return Promise.all(imagePromises).then(() => undefined)
}

/**
 * Check if Paged.js rendering is complete
 * Used by Playwright to determine when to capture PDF
 */
export function isPagedRenderComplete(): boolean {
  return (
    window.pagedRenderingComplete === true ||
    document.body.classList.contains('render-success') ||
    document.body.classList.contains('render-error')
  )
}
