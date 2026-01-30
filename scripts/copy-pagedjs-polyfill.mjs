#!/usr/bin/env node

/**
 * Copy Paged.js polyfill to public/vendor to avoid bundling issues
 * Paged.js has export map issues when deep imported, so we serve it as a static file
 */

import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

const source = join(projectRoot, 'node_modules', 'pagedjs', 'dist', 'paged.polyfill.js')
const targetDir = join(projectRoot, 'public', 'vendor')
const target = join(targetDir, 'paged.polyfill.js')

try {
  // Create vendor directory if it doesn't exist
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true })
    console.log('✓ Created public/vendor directory')
  }

  // Check if source exists
  if (!existsSync(source)) {
    console.warn('⚠ Warning: Paged.js polyfill not found at:', source)
    console.warn('  This is expected if pagedjs is not yet installed.')
    console.warn('  Run "npm install" to install dependencies.')
    process.exit(0)
  }

  // Copy the polyfill
  copyFileSync(source, target)
  console.log('✓ Copied Paged.js polyfill to public/vendor/')
} catch (error) {
  console.error('✗ Error copying Paged.js polyfill:', error.message)
  process.exit(1)
}
