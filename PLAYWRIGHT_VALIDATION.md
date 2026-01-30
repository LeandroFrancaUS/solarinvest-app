# Playwright Validation Guide for Bento Grid PDF

This guide provides examples for validating the Bento Grid PDF generation using Playwright.

## Prerequisites

- Playwright installed (`npm install --save-dev playwright`)
- Dev server running or production build deployed
- Bento Grid PDF enabled (default: ON)

## Basic Playwright Test

```typescript
import { test, expect } from '@playwright/test'

test('Bento Grid PDF renders correctly', async ({ page }) => {
  // 1. Navigate to print route
  await page.goto('http://localhost:5173?mode=print&type=leasing', {
    waitUntil: 'networkidle'
  })
  
  // 2. Wait for Bento Grid root with correct version
  await page.waitForSelector(
    '[data-testid="proposal-bento-root"][data-version="premium-v3"]',
    { timeout: 30000 }
  )
  
  // 3. Validate Tailwind CSS is applied (bg-solar-bg = #F8FAFC)
  const bgColor = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor
  })
  
  expect(bgColor).toContain('248') // RGB(248, 250, 252)
  expect(bgColor).toContain('250')
  expect(bgColor).toContain('252')
  
  // Alternative: use validation utility
  const validationResult = await page.evaluate(() => {
    const bgColor = window.getComputedStyle(document.body).backgroundColor
    const isCorrectBg = bgColor.includes('248') && bgColor.includes('250') && bgColor.includes('252')
    
    if (!isCorrectBg) {
      throw new Error(`Wrong background color. Expected #F8FAFC, got: ${bgColor}`)
    }
    
    return true
  })
  
  expect(validationResult).toBe(true)
  
  // 4. Wait for Paged.js to complete rendering
  await page.waitForFunction(
    () => (window as any).pagedRenderingComplete === true,
    { timeout: 60000 }
  )
  
  // 5. Take debug screenshot
  await page.screenshot({
    path: 'debug/bento-grid-preview.png',
    fullPage: true
  })
  
  // 6. Generate PDF
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  })
  
  expect(pdf).toBeTruthy()
  expect(pdf.byteLength).toBeGreaterThan(10000) // At least 10KB
})
```

## Advanced Validations

### Check for No HTML Tables

```typescript
test('Bento Grid has no HTML tables', async ({ page }) => {
  await page.goto('http://localhost:5173?mode=print&type=leasing')
  
  await page.waitForSelector('[data-testid="proposal-bento-root"]')
  
  const tableCount = await page.locator('table').count()
  
  expect(tableCount).toBe(0) // Bento Grid uses cards, not tables
})
```

### Validate Brand Assets

```typescript
test('Brand logo is loaded', async ({ page }) => {
  await page.goto('http://localhost:5173?mode=print&type=leasing')
  
  await page.waitForSelector('[data-testid="proposal-bento-root"]')
  
  // Check for logo in brand directory
  const logoExists = await page.locator('img[src*="/brand/logo"]').count()
  
  expect(logoExists).toBeGreaterThan(0)
  
  // Verify image is actually loaded
  const logoLoaded = await page.evaluate(() => {
    const logo = document.querySelector('img[src*="/brand/logo"]') as HTMLImageElement
    return logo && logo.complete && logo.naturalHeight > 0
  })
  
  expect(logoLoaded).toBe(true)
})
```

### Validate Premium-v3 Components

```typescript
test('Premium v3 components are present', async ({ page }) => {
  await page.goto('http://localhost:5173?mode=print&type=leasing')
  
  await page.waitForSelector('[data-testid="proposal-bento-root"]')
  
  // Check for BrandHeader
  const brandHeader = await page.locator('.bg-solar-dark').count()
  expect(brandHeader).toBeGreaterThan(0)
  
  // Check for KpiCards (cards with large values)
  const kpiCards = await page.locator('.text-4xl, .text-5xl').count()
  expect(kpiCards).toBeGreaterThan(0)
  
  // Check for rounded cards
  const roundedCards = await page.locator('.rounded-3xl').count()
  expect(roundedCards).toBeGreaterThan(5) // Multiple cards expected
})
```

## Complete Validation Suite

```typescript
test('Complete Bento Grid validation', async ({ page }) => {
  // Navigate
  await page.goto('http://localhost:5173?mode=print&type=leasing', {
    waitUntil: 'networkidle'
  })
  
  // 1. Check version marker
  const version = await page.getAttribute(
    '[data-testid="proposal-bento-root"]',
    'data-version'
  )
  expect(version).toBe('premium-v3')
  
  // 2. Validate Tailwind CSS
  const bgColor = await page.evaluate(() => 
    window.getComputedStyle(document.body).backgroundColor
  )
  expect(bgColor).toMatch(/rgb\(248,\s*250,\s*252\)/)
  
  // 3. Wait for Paged.js
  await page.waitForFunction(
    () => (window as any).pagedRenderingComplete === true,
    { timeout: 60000 }
  )
  
  // 4. Verify no tables
  const tableCount = await page.locator('table').count()
  expect(tableCount).toBe(0)
  
  // 5. Check brand assets
  const logoCount = await page.locator('img[src*="/brand/"]').count()
  expect(logoCount).toBeGreaterThan(0)
  
  // 6. Verify page structure
  const pageCount = await page.locator('[class*="page"]').count()
  expect(pageCount).toBeGreaterThanOrEqual(5) // At least 5 pages
  expect(pageCount).toBeLessThanOrEqual(6) // At most 6 pages
  
  // 7. Take screenshot
  await page.screenshot({
    path: 'debug/bento-grid-validation.png',
    fullPage: true
  })
  
  // 8. Generate PDF
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  })
  
  // Save PDF for manual inspection
  const fs = require('fs')
  fs.writeFileSync('debug/bento-grid-test.pdf', pdf)
  
  console.log('✅ Bento Grid PDF validated successfully')
  console.log(`📄 PDF size: ${(pdf.byteLength / 1024).toFixed(2)} KB`)
})
```

## Error Handling

```typescript
test('Handle Bento Grid errors gracefully', async ({ page }) => {
  // Set up error capture
  const errors: string[] = []
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  
  page.on('pageerror', error => {
    errors.push(error.message)
  })
  
  // Navigate and wait
  await page.goto('http://localhost:5173?mode=print&type=leasing')
  
  try {
    await page.waitForSelector(
      '[data-testid="proposal-bento-root"]',
      { timeout: 30000 }
    )
  } catch (error) {
    console.error('❌ Bento Grid root not found')
    console.error('Console errors:', errors)
    throw new Error('Bento Grid failed to render. Check logs above.')
  }
  
  // If we got here, check for any runtime errors
  expect(errors.length).toBe(0)
})
```

## Debug Tips

### 1. Visual Inspection

```bash
# Take screenshots at various stages
await page.screenshot({ path: 'debug/01-loaded.png' })
await page.waitForSelector('[data-testid="proposal-bento-root"]')
await page.screenshot({ path: 'debug/02-bento-root.png' })
await page.waitForFunction(() => window.pagedRenderingComplete)
await page.screenshot({ path: 'debug/03-paged-complete.png', fullPage: true })
```

### 2. Check CSS Loading

```typescript
const stylesheets = await page.evaluate(() => {
  return Array.from(document.styleSheets).map(sheet => {
    try {
      return {
        href: sheet.href,
        rules: sheet.cssRules.length
      }
    } catch (e) {
      return { href: sheet.href, error: 'Cannot access' }
    }
  })
})

console.log('Loaded stylesheets:', stylesheets)
```

### 3. Check for Fonts

```typescript
await page.waitForFunction(() => document.fonts.ready)

const fontsLoaded = await page.evaluate(() => {
  return document.fonts.size
})

console.log(`Fonts loaded: ${fontsLoaded}`)
```

## CI/CD Integration

```yaml
# .github/workflows/pdf-validation.yml
name: Bento Grid PDF Validation

on: [push, pull_request]

jobs:
  test-pdf:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      
      - name: Build application
        run: npm run build
      
      - name: Start server
        run: npm run preview &
        
      - name: Wait for server
        run: npx wait-on http://localhost:4173
      
      - name: Run Playwright tests
        run: npx playwright test
      
      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results
          path: |
            debug/
            test-results/
```

## Acceptance Criteria Checklist

When validating the Bento Grid PDF, ensure:

- [ ] ✅ Version marker is `premium-v3`
- [ ] ✅ Background color is `#F8FAFC` (slate-50)
- [ ] ✅ No HTML `<table>` elements present
- [ ] ✅ Rounded cards (`.rounded-3xl`) visible
- [ ] ✅ Brand logo loaded from `/brand/` path
- [ ] ✅ Paged.js rendering complete (`window.pagedRenderingComplete === true`)
- [ ] ✅ 5-6 pages in final PDF
- [ ] ✅ Print-color-adjust set to `exact`
- [ ] ✅ PDF size > 10KB (content exists)
- [ ] ✅ No console errors during rendering

## Troubleshooting

### Issue: "Tailwind not applied"

**Check:**
```typescript
const tailwindLoaded = await page.evaluate(() => {
  const testDiv = document.createElement('div')
  testDiv.className = 'bg-solar-bg'
  document.body.appendChild(testDiv)
  const bgColor = window.getComputedStyle(testDiv).backgroundColor
  document.body.removeChild(testDiv)
  return bgColor.includes('248')
})
```

**Solution:** Ensure Tailwind CSS is properly linked in the print route.

### Issue: "Paged.js not completing"

**Check:**
```typescript
const pagedStatus = await page.evaluate(() => ({
  polyfillLoaded: typeof window.PagedPolyfill !== 'undefined',
  renderingComplete: window.pagedRenderingComplete,
  bodyClass: document.body.className
}))
```

**Solution:** Verify `/vendor/paged.polyfill.js` is accessible and `usePagedRender` hook is called.

### Issue: "Logo not displaying"

**Check:**
```typescript
const logoStatus = await page.evaluate(() => {
  const logo = document.querySelector('img[src*="/brand/logo"]')
  if (!logo) return 'Logo element not found'
  
  const img = logo as HTMLImageElement
  return {
    src: img.src,
    complete: img.complete,
    naturalHeight: img.naturalHeight,
    error: img.onerror ? 'Error loading' : null
  }
})
```

**Solution:** Verify `/brand/logo-header.svg` exists and is accessible.

## References

- [Playwright Documentation](https://playwright.dev/)
- [Paged.js Documentation](https://pagedjs.org/)
- [Bento Grid Implementation Guide](./BENTO_GRID_IMPLEMENTATION.md)
- [Integration Guide](./BENTO_GRID_INTEGRATION.md)
