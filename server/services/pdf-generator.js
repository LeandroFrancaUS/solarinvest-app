/**
 * PDF Generator Service
 * Playwright-based PDF generation with Paged.js synchronization
 * Ensures accurate capture of Bento Grid layouts with proper pagination
 */

import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Generate Solar Proposal PDF
 * @param {string} targetUrl - URL of the proposal page to render
 * @param {string} outputPath - Path where PDF should be saved
 * @param {Object} options - Optional configuration
 * @returns {Promise<void>}
 */
export async function generateSolarProposal(targetUrl, outputPath, options = {}) {
  const {
    timeout = 60000,
    injectPagedJS = false,
  } = options

  let browser = null

  try {
    console.log('[PDF Generator] Starting Chromium...')
    
    // Launch browser with typography and color precision
    browser = await chromium.launch({
      headless: true,
      args: [
        '--font-render-hinting=none',  // Typography precision
        '--force-color-profile=srgb',  // Color accuracy
        '--no-sandbox',                // Required for some environments
        '--disable-setuid-sandbox',
      ],
    })

    const context = await browser.newContext({
      viewport: null, // Disable viewport to use natural page size
    })

    const page = await context.newPage()

    console.log(`[PDF Generator] Navigating to ${targetUrl}...`)
    
    // Navigate and wait for DOM to be ready
    await page.goto(targetUrl, { 
      waitUntil: 'domcontentloaded',
      timeout,
    })

    console.log('[PDF Generator] DOM loaded. Optimizing assets...')

    // Wait for fonts and images to load
    await page.evaluate(async () => {
      // Wait for fonts
      await document.fonts.ready
      console.log('[PDF Generator Client] Fonts loaded')

      // Wait for all images
      const images = Array.from(document.images)
      await Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve()
          return new Promise(resolve => {
            img.onload = resolve
            img.onerror = resolve // Resolve anyway to not block rendering
          })
        })
      )
      console.log('[PDF Generator Client] Images loaded')
    })

    // Inject Paged.js if not embedded (fallback)
    if (injectPagedJS) {
      console.log('[PDF Generator] Injecting Paged.js fallback...')
      
      await page.addScriptTag({
        url: 'https://unpkg.com/pagedjs@0.4.3/dist/paged.polyfill.js',
      })

      await page.addStyleTag({
        content: '@page { margin: 0; size: A4; }',
      })
    }

    console.log('[PDF Generator] Waiting for Paged.js rendering...')

    // Synchronization handshake: Wait for Paged.js to complete
    // NOTE: Uses window.pagedRenderingComplete as specified (NOT networkidle)
    try {
      await page.waitForFunction(
        () => window.pagedRenderingComplete === true,
        { timeout }
      )
      console.log('[PDF Generator] Paged.js rendering complete')
    } catch (error) {
      console.warn('[PDF Generator] Timeout waiting for pagedRenderingComplete')
      console.warn('[PDF Generator] Checking for render-success class as fallback...')
      
      // Fallback: check for render-success class
      const hasSuccessClass = await page.evaluate(() => 
        document.body.classList.contains('render-success')
      )
      
      if (!hasSuccessClass) {
        throw new Error('Paged.js rendering did not complete within timeout')
      }
    }

    console.log('[PDF Generator] Generating PDF...')

    // Generate PDF with exact specifications
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,      // REQUIRED for Bento Grid colors
      preferCSSPageSize: true,    // Respect @page CSS rules
      margin: { 
        top: 0, 
        right: 0, 
        bottom: 0, 
        left: 0 
      },
      displayHeaderFooter: false, // Headers/footers via CSS margin boxes
    })

    console.log(`[PDF Generator] PDF saved to ${outputPath}`)

  } catch (error) {
    console.error('[PDF Generator] Error generating PDF:', error)
    throw error
  } finally {
    if (browser) {
      await browser.close()
      console.log('[PDF Generator] Browser closed')
    }
  }
}

/**
 * Generate Solar Proposal PDF from HTML string
 * @param {string} htmlContent - HTML string to render
 * @param {string} outputPath - Path where PDF should be saved
 * @param {Object} options - Optional configuration
 * @returns {Promise<void>}
 */
export async function generateSolarProposalFromHTML(htmlContent, outputPath, options = {}) {
  const {
    timeout = 60000,
    baseURL = 'http://localhost:3000',
  } = options

  let browser = null

  try {
    console.log('[PDF Generator] Starting Chromium...')
    
    browser = await chromium.launch({
      headless: true,
      args: [
        '--font-render-hinting=none',
        '--force-color-profile=srgb',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    })

    const context = await browser.newContext({
      viewport: null,
      baseURL,
    })

    const page = await context.newPage()

    console.log('[PDF Generator] Setting HTML content...')
    
    // Set HTML content directly
    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded',
      timeout,
    })

    // Wait for assets
    await page.evaluate(async () => {
      await document.fonts.ready
      const images = Array.from(document.images)
      await Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve()
          return new Promise(resolve => {
            img.onload = resolve
            img.onerror = resolve
          })
        })
      )
    })

    // Wait for Paged.js
    await page.waitForFunction(
      () => window.pagedRenderingComplete === true,
      { timeout }
    )

    console.log('[PDF Generator] Generating PDF from HTML...')

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      displayHeaderFooter: false,
    })

    console.log(`[PDF Generator] PDF saved to ${outputPath}`)

  } catch (error) {
    console.error('[PDF Generator] Error generating PDF from HTML:', error)
    throw error
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
