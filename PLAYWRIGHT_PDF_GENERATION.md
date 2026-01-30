# Playwright PDF Generation Guide

Complete guide for generating Bento Grid PDF proposals using Playwright with validation and screenshots.

## Quick Start

### 1. Build the Application

```bash
npm run build
```

### 2. Start Preview Server

```bash
npm run pdf:serve
```

This starts the Vite preview server on `http://localhost:4173` with strict port mode.

### 3. Generate PDF with Playwright

In a new terminal:

```bash
# Basic usage (generates PDF with default mock data)
node server/pdf-generate-leasing.mjs

# With specific proposal ID
node server/pdf-generate-leasing.mjs --id=PROP-2024-001

# Custom output paths
node server/pdf-generate-leasing.mjs \
  --output=./output/my-proposal.pdf \
  --screenshot=./output/my-screenshot.png

# Skip validation (faster, but not recommended)
node server/pdf-generate-leasing.mjs --validate=false

# Headed mode (see browser rendering)
node server/pdf-generate-leasing.mjs --headless=false
```

## Script Options

### `--id`
Proposal ID to generate. Constructs URL as `?mode=print&type=leasing&id=<id>`

**Example:**
```bash
node server/pdf-generate-leasing.mjs --id=PROP-2024-123
```

### `--url`
Full URL to the print page. Overrides `--id` if both are provided.

**Example:**
```bash
node server/pdf-generate-leasing.mjs --url=http://localhost:4173?mode=print&type=leasing
```

### `--output`
Output PDF file path.

**Default:** `./debug/leasing-proposal.pdf`

**Example:**
```bash
node server/pdf-generate-leasing.mjs --output=./proposals/client-abc.pdf
```

### `--screenshot`
Screenshot file path (fullPage PNG).

**Default:** `./debug/leasing-screenshot.png`

**Example:**
```bash
node server/pdf-generate-leasing.mjs --screenshot=./screenshots/preview.png
```

### `--base-url`
Base URL for the application.

**Default:** `http://localhost:4173`

**Example:**
```bash
node server/pdf-generate-leasing.mjs --base-url=http://localhost:5173
```

### `--headless`
Run browser in headless mode.

**Default:** `true`

**Example:**
```bash
# See browser rendering (useful for debugging)
node server/pdf-generate-leasing.mjs --headless=false
```

### `--validate`
Run full validation suite before generating PDF.

**Default:** `true`

**Example:**
```bash
# Skip validation (faster, but not recommended)
node server/pdf-generate-leasing.mjs --validate=false
```

## Validation Suite

When `--validate=true` (default), the script performs:

### 1. Bento Grid Root Check
✓ Verifies `[data-testid="proposal-bento-root"]` exists  
✓ Validates version marker is `premium-v3`

### 2. Tailwind CSS Validation
✓ Checks background color is `#F8FAFC` (slate-50)  
✓ Ensures `print-color-adjust: exact` is set

### 3. Table Detection
✓ Scans for HTML `<table>` elements  
✓ Fails if any tables found (Bento Grid uses cards only)

### 4. Paged.js Completion
✓ Waits for `window.pagedRenderingComplete === true`  
✓ Checks for `render-finished` class on body

### 5. Brand Assets
✓ Verifies logo images are loaded  
✓ Checks images in `/brand/` path

### 6. Full Validation Suite
Runs all validations via `window.__bentoValidation.validateAll()`

**If any validation fails, the script exits with an error and does NOT generate the PDF.**

## Common Workflows

### Development Testing

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Generate PDF (pointing to dev server)
node server/pdf-generate-leasing.mjs --base-url=http://localhost:5173
```

### Production Testing

```bash
# Terminal 1: Build and serve
npm run build && npm run pdf:serve

# Terminal 2: Generate PDF
node server/pdf-generate-leasing.mjs
```

### Debugging

```bash
# Run with browser visible and console output
node server/pdf-generate-leasing.mjs --headless=false

# Check screenshot first, then PDF
node server/pdf-generate-leasing.mjs \
  --screenshot=./debug/check.png \
  --output=./debug/final.pdf
```

### CI/CD Pipeline

```bash
# Full build, serve, and generate
npm run build
npm run pdf:serve &
SERVER_PID=$!
sleep 5  # Wait for server to start

node server/pdf-generate-leasing.mjs \
  --output=./artifacts/proposal.pdf \
  --screenshot=./artifacts/preview.png

kill $SERVER_PID
```

## Validation Failures

### Common Issues and Solutions

#### ❌ "Tailwind CSS not applied correctly"

**Cause:** CSS not loading or wrong environment

**Solution:**
```bash
# Rebuild and ensure Tailwind is compiled
npm run build
npm run pdf:serve
```

#### ❌ "Found N HTML table(s)"

**Cause:** Legacy components still using tables

**Solution:**
- Check if user setting is disabled (Settings → Outros)
- Verify `shouldUseBentoGrid()` returns `true`
- Look for malformed templates using tables

#### ❌ "Paged.js rendering not complete"

**Cause:** Polyfill not loading or hanging

**Solution:**
```bash
# Check if polyfill exists
ls -lh public/vendor/paged.polyfill.js

# Reinstall if missing
npm run postinstall
```

#### ❌ "Validation functions not attached to window"

**Cause:** `attachBentoValidationToWindow()` not called

**Solution:**
- Verify `PrintPageLeasing.tsx` imports and calls the function
- Check browser console for attachment confirmation

## Output Files

### PDF (`./debug/leasing-proposal.pdf`)
- Format: A4
- Background: Printed (colors exact)
- Margins: 0 (full-bleed with internal padding)
- Pages: 5-6 pages (compact premium layout)

**Features:**
- ✅ Rounded cards with shadows
- ✅ Slate-50 background (#F8FAFC)
- ✅ SolarInvest branding and logo
- ✅ NO HTML tables (cards only)
- ✅ Proper pagination (no orphans)

### Screenshot (`./debug/leasing-screenshot.png`)
- Full page capture (all pages scrolled)
- Useful for visual inspection
- Shows complete layout before PDF conversion

## NPM Scripts

### `npm run pdf:serve`
Starts Vite preview server on port 4173 with strict port mode.

**Equivalent to:** `vite preview --strictPort --port 4173`

### `npm run pdf:open`
Opens preview server URL in default browser.

**Cross-platform:** Works on Linux, macOS, and Windows.

### `npm run preview`
Alias for `pdf:serve` (standard Vite preview command).

## Troubleshooting

### Port 4173 Already in Use

```bash
# Find and kill process on port 4173
lsof -ti:4173 | xargs kill -9

# Or use a different port
node server/pdf-generate-leasing.mjs --base-url=http://localhost:5173
```

### Build Artifacts Missing

```bash
# Clean and rebuild
rm -rf dist node_modules/.vite
npm run build
```

### Playwright Not Installed

```bash
# Install Playwright browsers
npx playwright install chromium

# Or install all browsers
npx playwright install
```

### Permission Denied

```bash
# Make script executable
chmod +x server/pdf-generate-leasing.mjs
```

### Timeout Errors

```bash
# Increase timeouts by modifying script
# Or use headed mode to see what's blocking
node server/pdf-generate-leasing.mjs --headless=false
```

## Advanced Usage

### Custom Validation

Edit `src/utils/bentoValidation.ts` to add custom checks:

```typescript
export function validateCustom(document: Document): ValidationResult {
  // Your validation logic
  return { isValid: true, errors: [], warnings: [] }
}

// Add to validateAll()
export function validateAll(document: Document, expectedVersion = 'premium-v3'): ValidationResult {
  const results = [
    validateBentoRoot(document, expectedVersion),
    validateTailwindCSS(document),
    validatePagedJsComplete(),
    validateNoTables(document),
    validateBrandAssets(document),
    validateCustom(document), // Your custom validation
  ]
  
  // ... rest of function
}
```

### Multiple PDFs

```bash
# Generate multiple proposals in sequence
for id in PROP-001 PROP-002 PROP-003; do
  node server/pdf-generate-leasing.mjs \
    --id=$id \
    --output=./output/$id.pdf \
    --screenshot=./output/$id.png
done
```

### Parallel Generation (CI/CD)

```bash
# Start server once
npm run pdf:serve &
SERVER_PID=$!
sleep 5

# Generate multiple PDFs in parallel
node server/pdf-generate-leasing.mjs --id=PROP-001 --output=./out/001.pdf &
node server/pdf-generate-leasing.mjs --id=PROP-002 --output=./out/002.pdf &
node server/pdf-generate-leasing.mjs --id=PROP-003 --output=./out/003.pdf &

# Wait for all to complete
wait

# Cleanup
kill $SERVER_PID
```

## Integration with Existing PDF Service

To integrate with an existing Playwright-based PDF service:

```javascript
import { chromium } from 'playwright'

async function generateLeasingPDF(proposalId) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  
  // Navigate to print route
  await page.goto(`http://localhost:4173?mode=print&type=leasing&id=${proposalId}`, {
    waitUntil: 'networkidle'
  })
  
  // Wait for Bento Grid
  await page.waitForSelector('[data-testid="proposal-bento-root"][data-version="premium-v3"]')
  
  // Validate
  const validation = await page.evaluate(() => {
    return window.__bentoValidation.validateAll(document, 'premium-v3')
  })
  
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
  }
  
  // Wait for Paged.js
  await page.waitForFunction(() => window.pagedRenderingComplete === true)
  
  // Generate PDF
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  })
  
  await browser.close()
  return pdf
}
```

## Status Summary

✅ **Script created:** `server/pdf-generate-leasing.mjs`  
✅ **NPM scripts added:** `pdf:serve`, `pdf:open`  
✅ **Validation exposed:** `window.__bentoValidation`  
✅ **Auto-attached:** `PrintPageLeasing.tsx` calls `attachBentoValidationToWindow()`  
✅ **Idempotent:** Safe to call multiple times  
✅ **Production ready:** Full validation suite with error handling

## Next Steps

1. **Build the app:** `npm run build`
2. **Start preview server:** `npm run pdf:serve`
3. **Generate PDF:** `node server/pdf-generate-leasing.mjs`
4. **Check output:** `./debug/leasing-proposal.pdf` and `./debug/leasing-screenshot.png`
5. **Verify quality:** Open PDF and check for premium layout

---

**Documentation:** See `PLAYWRIGHT_VALIDATION.md` for detailed testing patterns  
**Architecture:** See `BENTO_GRID_IMPLEMENTATION.md` for technical details  
**Integration:** See `BENTO_GRID_INTEGRATION.md` for App.tsx integration
