/**
 * Paged.js Integration Module
 * Orchestrates pagination lifecycle and Playwright synchronization
 * 
 * Loads Paged.js polyfill from CDN to avoid build/bundler issues
 */

declare global {
  interface Window {
    PagedConfig?: {
      auto?: boolean
      after?: (flow: unknown) => void
    }
    PagedPolyfill?: {
      preview?: () => Promise<void>
    }
    pagedRenderingComplete?: boolean
  }
}

// CDN URL for Paged.js polyfill (unpkg provides automatic latest version)
const PAGEDJS_CDN_URL = 'https://unpkg.com/pagedjs@0.4.3/dist/paged.polyfill.js'

/**
 * Load Paged.js polyfill from CDN via script tag
 * Returns a promise that resolves when the script is loaded
 */
function loadPagedJSPolyfill(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.PagedPolyfill) {
      console.log('[Paged.js] Polyfill already loaded')
      resolve()
      return
    }

    // Check if script tag already exists
    const existingScript = document.querySelector(`script[src="${PAGEDJS_CDN_URL}"]`)
    if (existingScript) {
      console.log('[Paged.js] Script tag already exists, waiting for load...')
      existingScript.addEventListener('load', () => resolve())
      existingScript.addEventListener('error', reject)
      return
    }

    // Create and inject script tag
    const script = document.createElement('script')
    script.src = PAGEDJS_CDN_URL
    script.async = false // Load synchronously to ensure PagedConfig is applied
    
    script.onload = () => {
      console.log('[Paged.js] Polyfill loaded from CDN')
      // Wait a tick for the polyfill to fully initialize
      setTimeout(() => resolve(), 100)
    }
    
    script.onerror = () => {
      reject(new Error(`Failed to load Paged.js from ${PAGEDJS_CDN_URL}`))
    }

    document.head.appendChild(script)
    console.log('[Paged.js] Loading polyfill from CDN...')
  })
}

/**
 * Initialize Paged.js with proper lifecycle management
 * Waits for fonts and images before triggering pagination
 * Sets up Playwright handshake signal
 * 
 * Loads polyfill from CDN to avoid bundler deep import issues
 */
export async function initializePagedJS(): Promise<void> {
  // Server-side guard
  if (typeof window === 'undefined') {
    console.warn('[Paged.js] Skipping initialization on server')
    return
  }

  // Configure Paged.js behavior BEFORE loading polyfill
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

    // Load Paged.js polyfill from CDN
    await loadPagedJSPolyfill()

    // Check if polyfill is available
    if (!window.PagedPolyfill?.preview) {
      throw new Error('PagedPolyfill.preview not available after loading')
    }

    // Trigger pagination
    await window.PagedPolyfill.preview()
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
