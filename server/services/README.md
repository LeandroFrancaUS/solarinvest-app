# PDF Generator Service

Playwright-based PDF generation with Paged.js synchronization for high-fidelity Bento Grid layouts.

## Overview

This service uses Playwright (Chromium) to render HTML pages with Paged.js pagination and generate production-quality PDFs with exact color reproduction and typography precision.

## Architecture

```
server/services/pdf-generator.js  # Core Playwright PDF generation
server/pdfGenerator.js             # Express middleware/API endpoint
src/lib/pagedjs-integration.ts    # Client-side Paged.js lifecycle
src/styles/paged-print.css        # CSS @page rules
```

## Usage

### Method 1: Generate from URL

```javascript
import { generateSolarProposal } from './server/services/pdf-generator.js'

await generateSolarProposal(
  'http://localhost:3000/proposal/12345',
  './output/proposal.pdf',
  {
    timeout: 60000,
    injectPagedJS: false, // Set true if Paged.js not in page
  }
)
```

### Method 2: Generate from HTML String

```javascript
import { generateSolarProposalFromHTML } from './server/services/pdf-generator.js'

const html = `
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/styles/paged-print.css">
  <script src="https://unpkg.com/pagedjs@0.4.3/dist/paged.polyfill.js"></script>
</head>
<body>
  <!-- Your Bento Grid content -->
</body>
</html>
`

await generateSolarProposalFromHTML(
  html,
  './output/proposal.pdf',
  {
    timeout: 60000,
    baseURL: 'http://localhost:3000',
  }
)
```

### Method 3: API Endpoint

```bash
curl -X POST http://localhost:3000/api/pdf/generate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:3000/proposal/12345",
    "filename": "solar-proposal.pdf"
  }' \
  --output proposal.pdf
```

## Client-Side Integration

In your React proposal component:

```typescript
import { initializePagedJS } from '@/lib/pagedjs-integration'
import { useEffect } from 'react'

export function ProposalPage() {
  useEffect(() => {
    // Initialize Paged.js after component mount
    initializePagedJS().catch(console.error)
  }, [])

  return (
    <div>
      {/* Your Bento Grid content */}
    </div>
  )
}
```

## Synchronization Protocol

The service uses `window.pagedRenderingComplete` for deterministic synchronization:

**Client-side (Paged.js):**
```typescript
window.PagedConfig = {
  auto: false,
  after: (flow) => {
    window.pagedRenderingComplete = true  // Signal to Playwright
    document.body.classList.add('render-success')
  }
}
```

**Server-side (Playwright):**
```javascript
await page.waitForFunction(
  () => window.pagedRenderingComplete === true,
  { timeout: 60000 }
)
```

## Configuration

### Browser Arguments

- `--font-render-hinting=none` - Typography precision
- `--force-color-profile=srgb` - Color accuracy
- `--no-sandbox` - Required for containerized environments

### PDF Output Settings

```javascript
{
  format: 'A4',
  printBackground: true,      // REQUIRED for Bento Grid colors
  preferCSSPageSize: true,    // Respect @page CSS rules
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  displayHeaderFooter: false  // Use CSS margin boxes instead
}
```

## Asset Loading

The service ensures all assets load before PDF generation:

1. **Fonts**: Waits for `document.fonts.ready`
2. **Images**: Waits for all `<img>` elements to load
3. **Paged.js**: Waits for pagination to complete

## Error Handling

```javascript
try {
  await generateSolarProposal(url, outputPath)
} catch (error) {
  if (error.message.includes('timeout')) {
    // Paged.js didn't complete within timeout
  } else if (error.message.includes('navigation')) {
    // Page failed to load
  }
}
```

## Troubleshooting

### PDF is blank
- Ensure Paged.js is loaded and initialized
- Check that `window.pagedRenderingComplete` is being set
- Verify `printBackground: true` in PDF options

### Timeout errors
- Increase timeout option (default: 60000ms)
- Check browser console for Paged.js errors
- Verify all images and fonts are loading

### Missing colors
- Ensure `printBackground: true` is set
- Add `print-color-adjust: exact` to CSS
- Verify `--force-color-profile=srgb` browser arg

### Page breaks in wrong places
- Use `.break-inside-avoid` on Bento cards
- Add `.decoration-clone` for seamless fragments
- Review CSS @page rules in `paged-print.css`

## Performance

- Average generation time: 3-5 seconds for 4-page document
- Memory usage: ~200MB per generation
- Concurrent generations: Supported (separate browser instances)

## Testing

```bash
# Test URL generation
node -e "
  import('./server/services/pdf-generator.js').then(m => 
    m.generateSolarProposal(
      'http://localhost:3000/proposal/test',
      './test-output.pdf'
    )
  )
"

# Test HTML generation
node -e "
  import('./server/services/pdf-generator.js').then(m => 
    m.generateSolarProposalFromHTML(
      '<!DOCTYPE html><html><body><h1>Test</h1></body></html>',
      './test-output.pdf'
    )
  )
"
```

## Dependencies

```json
{
  "dependencies": {
    "playwright": "latest"
  },
  "devDependencies": {
    "pagedjs": "latest"
  }
}
```

## References

- [Paged.js Documentation](https://pagedjs.org/documentation/)
- [Playwright PDF API](https://playwright.dev/docs/api/class-page#page-pdf)
- [W3C Paged Media](https://www.w3.org/TR/css-page-3/)
