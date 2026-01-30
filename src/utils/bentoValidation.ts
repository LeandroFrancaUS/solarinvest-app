/**
 * Bento Grid PDF Validation Utilities
 * 
 * Helper functions for validating the Bento Grid PDF rendering
 * Used by Playwright tests and debug tools
 */

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Check if Bento Grid root element exists with correct version
 */
export function validateBentoRoot(document: Document, expectedVersion = 'premium-v3'): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  const root = document.querySelector('[data-testid="proposal-bento-root"]')
  
  if (!root) {
    errors.push('Bento Grid root element not found (data-testid="proposal-bento-root")')
    return { isValid: false, errors, warnings }
  }
  
  const version = root.getAttribute('data-version')
  if (version !== expectedVersion) {
    errors.push(`Version mismatch: expected "${expectedVersion}", got "${version}"`)
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate that Tailwind CSS is properly applied
 * Checks for Solar brand background color (#F8FAFC / rgb(248, 250, 252))
 */
export function validateTailwindCSS(document: Document): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  try {
    const body = document.body
    const bgColor = window.getComputedStyle(body).backgroundColor
    
    // Check for slate-50 background: #F8FAFC = rgb(248, 250, 252)
    const isCorrectBg = bgColor.includes('248') && bgColor.includes('250') && bgColor.includes('252')
    
    if (!isCorrectBg) {
      errors.push(`Tailwind CSS not applied correctly. Expected bg-solar-bg (#F8FAFC), got: ${bgColor}`)
    }
    
    // Check for print-color-adjust
    const printColorAdjust = window.getComputedStyle(body).printColorAdjust || 
                             (window.getComputedStyle(body) as any).webkitPrintColorAdjust
    
    if (printColorAdjust !== 'exact') {
      warnings.push(`print-color-adjust is not "exact": ${printColorAdjust}`)
    }
    
  } catch (error) {
    errors.push(`Failed to validate Tailwind CSS: ${error}`)
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate that Paged.js rendering is complete
 */
export function validatePagedJsComplete(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (typeof window === 'undefined') {
    errors.push('Window object not available')
    return { isValid: false, errors, warnings }
  }
  
  const isComplete = (window as any).pagedRenderingComplete === true
  
  if (!isComplete) {
    errors.push('Paged.js rendering not complete (window.pagedRenderingComplete !== true)')
  }
  
  // Check if body has render-finished class
  if (document.body && !document.body.classList.contains('render-finished')) {
    warnings.push('Body does not have "render-finished" class')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate that no HTML tables exist (Bento Grid uses cards instead)
 */
export function validateNoTables(document: Document): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  const tables = document.querySelectorAll('table')
  
  if (tables.length > 0) {
    errors.push(`Found ${tables.length} HTML table(s). Bento Grid should use cards only.`)
    
    // List first few tables for debugging
    tables.forEach((table, index) => {
      if (index < 3) {
        const context = table.parentElement?.textContent?.substring(0, 50) || 'unknown context'
        warnings.push(`Table ${index + 1}: ${context}...`)
      }
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate that brand assets are loaded
 */
export function validateBrandAssets(document: Document): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check for logo images
  const logos = document.querySelectorAll('img[src*="/brand/"]')
  
  if (logos.length === 0) {
    warnings.push('No brand assets found (expected logo in /brand/ path)')
  }
  
  // Check if images are loaded
  logos.forEach((img) => {
    const imgElement = img as HTMLImageElement
    if (!imgElement.complete || imgElement.naturalHeight === 0) {
      errors.push(`Brand asset not loaded: ${imgElement.src}`)
    }
  })
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Run all validations
 */
export function validateAll(document: Document, expectedVersion = 'premium-v3'): ValidationResult {
  const results = [
    validateBentoRoot(document, expectedVersion),
    validateTailwindCSS(document),
    validatePagedJsComplete(),
    validateNoTables(document),
    validateBrandAssets(document),
  ]
  
  const allErrors = results.flatMap(r => r.errors)
  const allWarnings = results.flatMap(r => r.warnings)
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  }
}

/**
 * Playwright-friendly validation function
 * Usage in Playwright:
 * 
 * await page.evaluate(() => {
 *   const { validateAll } = require('./utils/bentoValidation')
 *   return validateAll(document, 'premium-v3')
 * })
 */
export function playwrightValidate(): ValidationResult {
  if (typeof document === 'undefined') {
    return {
      isValid: false,
      errors: ['Document not available (not in browser context)'],
      warnings: []
    }
  }
  
  return validateAll(document, 'premium-v3')
}
