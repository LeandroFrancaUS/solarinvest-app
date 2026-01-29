/**
 * PDF Generation API Endpoint
 * Express middleware for generating PDFs via Playwright
 */

import { generateSolarProposal, generateSolarProposalFromHTML } from './services/pdf-generator.js'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'

/**
 * Create PDF generation middleware
 * @returns {Function} Express middleware
 */
export function createPdfGeneratorMiddleware() {
  return async (req, res, next) => {
    // Only handle /api/pdf/generate route
    if (!req.url.startsWith('/api/pdf/generate')) {
      return next()
    }

    try {
      const { url, html, filename = 'proposal.pdf' } = req.body

      if (!url && !html) {
        return res.status(400).json({
          error: 'Missing required parameter: url or html',
        })
      }

      // Create output directory if it doesn't exist
      const outputDir = join(process.cwd(), 'tmp', 'pdfs')
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }

      const outputPath = join(outputDir, filename)

      console.log('[PDF API] Generating PDF...')
      console.log('[PDF API] Output:', outputPath)

      if (url) {
        // Generate from URL
        await generateSolarProposal(url, outputPath, {
          timeout: 60000,
          injectPagedJS: false, // Assume Paged.js is in the page
        })
      } else {
        // Generate from HTML
        await generateSolarProposalFromHTML(html, outputPath, {
          timeout: 60000,
          baseURL: req.headers.origin || 'http://localhost:3000',
        })
      }

      console.log('[PDF API] PDF generated successfully')

      // Send file
      res.download(outputPath, filename, (err) => {
        if (err) {
          console.error('[PDF API] Error sending file:', err)
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to send PDF' })
          }
        }
      })
    } catch (error) {
      console.error('[PDF API] Error:', error)
      res.status(500).json({
        error: 'Failed to generate PDF',
        message: error.message,
      })
    }
  }
}
