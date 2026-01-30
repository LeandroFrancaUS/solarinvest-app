#!/usr/bin/env node

/**
 * Playwright PDF Generator for Bento Grid Leasing Proposals
 * 
 * Usage:
 *   node server/pdf-generate-leasing.mjs --id=test-123 --output=./debug/leasing-proposal.pdf
 *   node server/pdf-generate-leasing.mjs --url=http://localhost:4173?mode=print&type=leasing
 * 
 * Options:
 *   --id         Proposal ID (will construct URL as ?mode=print&type=leasing&id=<id>)
 *   --url        Full URL to the print page (overrides --id)
 *   --output     Output PDF file path (default: ./debug/leasing-proposal.pdf)
 *   --screenshot Screenshot file path (default: ./debug/leasing-screenshot.png)
 *   --base-url   Base URL for the app (default: http://localhost:4173)
 *   --headless   Run browser in headless mode (default: true)
 *   --validate   Run full validation suite (default: true)
 */

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse command line arguments
function parseArgs() {
  const args = {}
  process.argv.slice(2).forEach(arg => {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/)
    if (match) {
      const key = match[1]
      const value = match[2] !== undefined ? match[2] : 'true'
      args[key] = value
    }
  })
  return args
}

// Default configuration
const args = parseArgs()
const config = {
  id: args.id || null,
  url: args.url || null,
  baseUrl: args['base-url'] || 'http://localhost:4173',
  output: args.output || './debug/leasing-proposal.pdf',
  screenshot: args.screenshot || './debug/leasing-screenshot.png',
  headless: args.headless !== 'false',
  validate: args.validate !== 'false',
}

// Construct URL
let targetUrl
if (config.url) {
  targetUrl = config.url
} else if (config.id) {
  targetUrl = `${config.baseUrl}?mode=print&type=leasing&id=${config.id}`
} else {
  targetUrl = `${config.baseUrl}?mode=print&type=leasing`
}

console.log('🚀 Playwright PDF Generator for Bento Grid Leasing')
console.log('━'.repeat(60))
console.log('Configuration:')
console.log(`  URL:        ${targetUrl}`)
console.log(`  Output:     ${config.output}`)
console.log(`  Screenshot: ${config.screenshot}`)
console.log(`  Headless:   ${config.headless}`)
console.log(`  Validate:   ${config.validate}`)
console.log('━'.repeat(60))

// Ensure output directories exist
const outputDir = path.dirname(config.output)
const screenshotDir = path.dirname(config.screenshot)

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
  console.log(`✓ Created output directory: ${outputDir}`)
}

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  console.log(`✓ Created screenshot directory: ${screenshotDir}`)
}

// Main PDF generation function
async function generatePDF() {
  let browser
  
  try {
    console.log('\n🌐 Launching browser...')
    browser = await chromium.launch({
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    })

    const page = await context.newPage()

    // Enable console logging
    page.on('console', msg => {
      const type = msg.type()
      const text = msg.text()
      if (type === 'error') {
        console.error(`  ❌ Browser console error: ${text}`)
      } else if (type === 'warning') {
        console.warn(`  ⚠️  Browser console warning: ${text}`)
      } else if (text.includes('✓') || text.includes('✗')) {
        console.log(`  ${text}`)
      }
    })

    // Enable page error logging
    page.on('pageerror', err => {
      console.error(`  ❌ Page error: ${err.message}`)
    })

    console.log(`\n📄 Navigating to: ${targetUrl}`)
    await page.goto(targetUrl, {
      waitUntil: 'networkidle',
      timeout: 60000
    })

    console.log('\n⏳ Waiting for Bento Grid root element...')
    await page.waitForSelector(
      '[data-testid="proposal-bento-root"][data-version="premium-v3"]',
      { timeout: 30000 }
    )
    console.log('✓ Bento Grid root element found')

    // Run validations if enabled
    if (config.validate) {
      console.log('\n🔍 Running validation suite...')

      // Validate Tailwind CSS
      const bgColorValid = await page.evaluate(() => {
        const bgColor = window.getComputedStyle(document.body).backgroundColor
        return bgColor.includes('248') && bgColor.includes('250') && bgColor.includes('252')
      })

      if (bgColorValid) {
        console.log('  ✓ Tailwind CSS applied (background: #F8FAFC)')
      } else {
        const actualBg = await page.evaluate(() => 
          window.getComputedStyle(document.body).backgroundColor
        )
        console.error(`  ❌ Tailwind CSS not applied correctly. Background: ${actualBg}`)
        throw new Error('Tailwind CSS validation failed')
      }

      // Check for HTML tables (should be zero)
      const tableCount = await page.evaluate(() => {
        return document.querySelectorAll('table').length
      })

      if (tableCount === 0) {
        console.log('  ✓ No HTML tables found (cards only)')
      } else {
        console.error(`  ❌ Found ${tableCount} HTML table(s). Bento Grid should use cards only.`)
        throw new Error('Table validation failed - malformed tables detected')
      }

      // Run full validation suite using window.__bentoValidation
      const validationResult = await page.evaluate(() => {
        if (typeof (window as any).__bentoValidation === 'undefined') {
          return {
            isValid: false,
            errors: ['Validation functions not attached to window'],
            warnings: []
          }
        }
        return (window as any).__bentoValidation.validateAll(document, 'premium-v3')
      })

      if (validationResult.isValid) {
        console.log('  ✓ All validations passed')
      } else {
        console.error('  ❌ Validation failures:')
        validationResult.errors.forEach((error: string) => {
          console.error(`    - ${error}`)
        })
        if (validationResult.warnings.length > 0) {
          console.warn('  ⚠️  Warnings:')
          validationResult.warnings.forEach((warning: string) => {
            console.warn(`    - ${warning}`)
          })
        }
        throw new Error('Full validation suite failed')
      }
    }

    console.log('\n⏳ Waiting for Paged.js rendering to complete...')
    await page.waitForFunction(
      () => (window as any).pagedRenderingComplete === true,
      { timeout: 60000 }
    )
    console.log('✓ Paged.js rendering complete')

    // Take screenshot
    console.log(`\n📸 Capturing screenshot: ${config.screenshot}`)
    await page.screenshot({
      path: config.screenshot,
      fullPage: true
    })
    console.log('✓ Screenshot saved')

    // Generate PDF
    console.log(`\n📄 Generating PDF: ${config.output}`)
    await page.pdf({
      path: config.output,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    })
    console.log('✓ PDF generated')

    // Get file sizes
    const pdfStats = fs.statSync(config.output)
    const screenshotStats = fs.statSync(config.screenshot)

    console.log('\n━'.repeat(60))
    console.log('✅ SUCCESS')
    console.log('━'.repeat(60))
    console.log(`PDF:        ${config.output} (${(pdfStats.size / 1024).toFixed(1)} KB)`)
    console.log(`Screenshot: ${config.screenshot} (${(screenshotStats.size / 1024).toFixed(1)} KB)`)
    console.log('━'.repeat(60))

  } catch (error) {
    console.error('\n━'.repeat(60))
    console.error('❌ ERROR')
    console.error('━'.repeat(60))
    console.error(error.message)
    if (error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    console.error('━'.repeat(60))
    process.exit(1)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// Run the generator
generatePDF()
