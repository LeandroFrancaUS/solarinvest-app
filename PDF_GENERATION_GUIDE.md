# PDF Generation Guide

## Overview

The SolarInvest app supports multiple PDF generation methods for proposal documents, with built-in CSS validation and debug capabilities.

## PDF Generation Methods

### 1. ConvertAPI (Default - External Service)
- **Environment**: `CONVERTAPI_SECRET=your_secret_key`
- **Pros**: Fast, reliable, cloud-based
- **Cons**: Requires paid API key, external dependency
- **Priority**: Medium (after Playwright if enabled)

### 2. Gotenberg (Fallback - Self-hosted)
- **Environment**: `GOTENBERG_URL=http://your-gotenberg-instance`
- **Pros**: Self-hosted, no external costs
- **Cons**: Requires separate Docker container
- **Priority**: Low (last fallback)

### 3. Playwright (New - Local with Validation) ⭐
- **Environment**: `PLAYWRIGHT_PDF_ENABLED=true`
- **Pros**: 
  - Local generation (no external services)
  - Full CSS validation before PDF generation
  - Debug artifacts (HTML + screenshots)
  - Fastest during development
- **Cons**: Requires Playwright installation (~200MB Chrome)
- **Priority**: Highest (when enabled)

## CSS Validation Banner

All PDFs now include a validation banner that shows:
- PDF version (premium-v1)
- CSS delivery status (embedded)
- CSS size in characters
- Client name

The banner is:
- Visible in HTML preview/debug screenshots
- Hidden when printed (via `@media print`)
- Styled with a green-to-blue gradient

Example:
```
PDF v1.0 | CSS: Embedded | Styles: 156789 chars | Client: João Silva
```

## Debug Artifacts

When using Playwright PDF generation, debug artifacts are saved to `debug/`:

- `proposal-{timestamp}.html` - The complete HTML sent to the PDF generator
- `proposal-{timestamp}.png` - Full-page screenshot before PDF generation
- `validation-failed-{timestamp}.png` - Screenshot if CSS validation fails

These files help diagnose styling issues and verify CSS delivery.

## Setup Instructions

### Enable Playwright (Recommended for Development)

1. Install Playwright browsers (already done if dependencies installed):
   ```bash
   npx playwright install chromium
   ```

2. Set environment variable:
   ```bash
   # .env.local or .env
   PLAYWRIGHT_PDF_ENABLED=true
   ```

3. Restart the server

### Using ConvertAPI (Production)

1. Get API key from https://www.convertapi.com/
2. Set environment variable:
   ```bash
   CONVERTAPI_SECRET=your_secret_here
   ```

### Using Gotenberg (Self-hosted)

1. Run Gotenberg container:
   ```bash
   docker run -d -p 3000:3000 gotenberg/gotenberg:8
   ```

2. Set environment variable:
   ```bash
   GOTENBERG_URL=http://localhost:3000
   ```

## Testing

Test Playwright PDF generation:
```bash
PLAYWRIGHT_PDF_ENABLED=true node test-playwright-pdf.mjs
```

Expected output:
- ✓ PDF generated successfully
- ✓ Debug artifacts created
- ✓ CSS validation passed

## CSS Validation

The Playwright generator validates:

1. **Banner presence**: Checks for `#pdf-validation-banner` element
2. **CSS embedded**: Checks for `#embedded-print-styles` in the document
3. **PDF version**: Verifies `data-pdf-version="premium-v1"` attribute
4. **Computed styles**: Validates actual rendered styles:
   - Body background color should be `#f8fafc` (rgb(248, 250, 252))
   - Cards should have border-radius ≥ 4px
   - Elements should have box-shadows

If validation fails, an error is thrown with details and a debug screenshot is saved.

## Troubleshooting

### "CSS validation failed"
- Check debug screenshots in `debug/` folder
- Verify CSS is embedded in the HTML (check debug HTML file)
- Ensure `buildProposalPdfDocument()` is including all CSS files

### "Playwright not available"
- Run `npx playwright install chromium`
- Verify `PLAYWRIGHT_PDF_ENABLED=true` is set
- Check Node.js version (requires 14+)

### PDF generation falls back to ConvertAPI
- This is expected if Playwright is not enabled
- Set `PLAYWRIGHT_PDF_ENABLED=true` to use Playwright
- Check server logs for provider selection

## Architecture

### Frontend Flow
1. `renderPrintableProposalToHtml()` → Renders React component to HTML string
2. `buildProposalPdfDocument(html, client, variant)` → Wraps HTML with CSS and validation banner
3. HTML is sent to backend via API

### Backend Flow
1. Receives HTML via `/api/contracts/leasing`
2. Writes HTML to temp file
3. Calls `convertHtmlToPdf(htmlPath, pdfPath)` which:
   - Tries Playwright (if enabled) with full validation
   - Falls back to ConvertAPI (if configured)
   - Falls back to Gotenberg (if configured)
4. Returns PDF to client

### CSS Delivery
All CSS is embedded inline in the `<style>` tag:
- `print.css` - Base print styles
- `print-colors.css` - Color schemes
- `proposal-venda.css` - Direct sale proposal styles
- `proposal-leasing.css` - Leasing proposal styles
- `simplePrintStyles` - Simple variant overrides (only if variant='simple')

The CSS is imported using Vite's `?raw` suffix to get the raw string content.

## Best Practices

1. **Always use Playwright during development** - Fastest feedback with validation
2. **Check debug artifacts** when styles don't look right
3. **Use ConvertAPI in production** if you need guaranteed external service
4. **Keep CSS in separate files** - Easier to maintain and already embedded via imports
5. **Test with real data** - Use actual client proposals to verify styling

## Environment Summary

```bash
# Playwright (recommended for dev)
PLAYWRIGHT_PDF_ENABLED=true

# ConvertAPI (for production)
CONVERTAPI_SECRET=your_secret

# Gotenberg (self-hosted alternative)
GOTENBERG_URL=http://localhost:3000
```

Priority: Playwright > ConvertAPI > Gotenberg

## Related Files

- `src/App.tsx` - `buildProposalPdfDocument()`, `renderPrintableProposalToHtml()`
- `src/styles/printTheme.ts` - CSS imports and composition
- `server/contracts.js` - `convertHtmlToPdf()`, `convertHtmlToPdfUsingPlaywright()`
- `server/leasingContracts.js` - Leasing contract generation flow
- `test-playwright-pdf.mjs` - Test script

## Migration Notes

**For existing deployments:**
- No changes required - Playwright is opt-in via env var
- ConvertAPI and Gotenberg continue to work as before
- New validation banner is always included (hidden in print)
- Debug artifacts only created when using Playwright

**To adopt Playwright:**
1. Install Playwright: `npx playwright install chromium`
2. Set `PLAYWRIGHT_PDF_ENABLED=true`
3. Monitor `debug/` folder for artifacts
4. Verify PDFs look correct
