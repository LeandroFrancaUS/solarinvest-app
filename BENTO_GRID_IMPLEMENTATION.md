# Bento Grid PDF Generator - Implementation Guide

## Overview

This document describes the new premium Bento Grid PDF generator for leasing proposals, implementing a modern card-based layout with Tailwind CSS and Paged.js.

## Architecture

### Core Components

1. **PrintLayout** (`src/components/pdf/PrintLayout.tsx`)
   - Wrapper for A4 pages with 12-column Bento Grid
   - Provides consistent spacing and layout structure
   - Attributes: `data-testid="print-layout"`

2. **BentoCard** (`src/components/pdf/BentoCard.tsx`)
   - Reusable card component with variants: `default`, `highlight`, `dark`
   - Configurable column spans (e.g., `col-span-4`, `col-span-6`, `col-span-12`)
   - Auto break-inside-avoid for proper pagination
   - Sub-components: `BentoCardTitle`, `BentoCardContent`

3. **PrintableProposalLeasingBento** (`src/components/pdf/PrintableProposalLeasingBento.tsx`)
   - Main component rendering 5 pages of premium leasing proposal
   - Uses Bento Grid layout with rounded cards and shadows
   - NO TABLES - all data presented in cards for better layout control

4. **usePagedRender** (`src/components/pdf/usePagedRender.ts`)
   - React hook to trigger Paged.js rendering
   - Waits for fonts and images before pagination
   - Sets `window.pagedRenderingComplete = true` when done

### Rendering Utilities

1. **renderBentoLeasing.tsx** (`src/utils/renderBentoLeasing.tsx`)
   - `renderBentoLeasingToHtml()`: Renders component to HTML string
   - `buildBentoLeasingPdfDocument()`: Wraps HTML with Tailwind CSS and Paged.js

2. **PrintPageLeasing** (`src/pages/PrintPageLeasing.tsx`)
   - Standalone page wrapper for print rendering
   - Loads Paged.js polyfill from `/vendor/paged.polyfill.js`
   - Can be used for browser-based printing or Playwright rendering

### Styling System

#### Tailwind Configuration (`tailwind.config.js`)

```javascript
theme: {
  extend: {
    screens: {
      print: { raw: 'print' },
    },
    colors: {
      solar: {
        brand: '#FDB813',
        dark: '#1E293B',
        accent: '#0056b3',
        bg: '#F8FAFC',
      },
    },
    width: { a4: '210mm' },
    height: { a4: '297mm' },
    spacing: {
      mm: '1mm',
      sheet: '10mm',
      gutter: '4mm',
    },
    gridTemplateColumns: {
      'bento-12': 'repeat(12, minmax(0, 1fr))',
    },
  },
}

plugins: [
  // Custom print utilities
  '.break-inside-avoid': { 'break-inside': 'avoid' },
  '.break-after-page': { 'break-after': 'page' },
  '.decoration-clone': { 'box-decoration-break': 'clone' },
]
```

#### Print CSS (`src/styles/print-bento.css`)

- `@page { size: A4; margin: 0; }`
- Exact color reproduction with `print-color-adjust: exact`
- Page container: `.page { padding: 36px 40px; }`

### Page Structure (5 Pages)

#### Page 1: Hero Cover
- Full-width highlight card with logo and client info
- 3 main KPIs (Potência, Geração, Desconto) in 4-column cards
- "Como Funciona" section with 3-step grid

#### Page 2: Leasing Offer
- Dark header card
- 6-column split: "O Que Está Incluso" vs "Condições Essenciais"
- Highlight card with key benefit
- NO tables - all data in label/value format

#### Page 3: Technical Specifications
- Dark header card
- 3 technical KPIs in 4-column cards
- 6-column split: "Equipamentos" vs "Requisitos"
- Disclaimer card

#### Page 4: Financial Summary
- Dark header card
- Monthly expense comparison (3 columns)
- Accumulated savings in 4 mini-cards (5, 10, 20, 30 years)
- Optional highlight card for asset value
- Disclaimer card
- **CRITICAL:** NO tables - replaced malformed table with card grid

#### Page 5: Terms & Responsibilities
- Dark header card
- 6-column split: SolarInvest responsibilities vs Client responsibilities
- Highlight card emphasizing ownership transfer
- Legal disclaimer

## Paged.js Integration

### Installation

```bash
npm install -D pagedjs@latest
node scripts/copy-pagedjs-polyfill.mjs
```

### Configuration

The polyfill is loaded from `/public/vendor/paged.polyfill.js` (NOT bundled):

```html
<script>window.PagedConfig = { auto: false };</script>
<script src="/vendor/paged.polyfill.js"></script>
```

### Rendering Flow

1. Component renders to HTML
2. Fonts load (`document.fonts.ready`)
3. Images load
4. `window.PagedPolyfill.preview()` called
5. `window.pagedRenderingComplete = true` set
6. Body gets class `render-finished`

## Testing

### Unit Tests

Run Bento Grid component tests:

```bash
npm test -- src/components/pdf/__tests__/BentoGrid.test.tsx
```

9 tests covering:
- PrintLayout structure
- BentoCard variants
- Column span configuration
- Typography components
- Full integration

### Visual Preview

Open `debug/bento-preview.html` in browser to see layout with Tailwind CDN.

### PDF Generation Test

```typescript
import { renderBentoLeasingToHtml, buildBentoLeasingPdfDocument } from './utils/renderBentoLeasing'

const dados: PrintableProposalProps = { /* ... */ }
const html = await renderBentoLeasingToHtml(dados)
const fullDocument = buildBentoLeasingPdfDocument(html, dados.cliente.nome)
// Save to file or send to PDF generator
```

## Feature Flag

Toggle between legacy and Bento Grid PDFs:

```typescript
// src/utils/pdfVariant.ts
export const USE_BENTO_GRID_PDF = import.meta.env.VITE_USE_BENTO_GRID_PDF === 'true'
```

Set in `.env`:

```bash
VITE_USE_BENTO_GRID_PDF=true
```

## Playwright PDF Generation

### Basic Flow

```typescript
await page.goto('http://localhost:3000/print/leasing/12345')
await page.waitForSelector('[data-testid="proposal-bento-root"][data-version="premium-v1"]')
await page.waitForFunction(() => window.pagedRenderingComplete === true, { timeout: 60000 })

// Validate CSS
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
// Should be close to #F8FAFC

// Screenshot for validation
await page.screenshot({ path: 'debug/proposal.png', fullPage: true })

// Generate PDF
await page.pdf({
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }
})
```

## Troubleshooting

### Tailwind classes not applied

- Ensure PostCSS config is correct
- Check that `@import 'tailwindcss/...'` is in styles.css
- Verify build output includes Tailwind CSS

### Paged.js not found

- Run `node scripts/copy-pagedjs-polyfill.mjs`
- Check `/public/vendor/paged.polyfill.js` exists
- Verify script tag in HTML

### Colors not printing

- Add `print-color-adjust: exact` to all elements
- Use `@page` rules in CSS
- Test in Chrome/Chromium (best print CSS support)

### Layout breaks between pages

- Add `break-inside-avoid` to cards
- Use `break-after-page` for explicit page breaks
- Keep cards reasonably sized

## Migration Path

1. **Phase 1** (Current): Bento Grid available via feature flag
2. **Phase 2**: A/B test with subset of users
3. **Phase 3**: Make Bento Grid default for leasing
4. **Phase 4**: Deprecate legacy leasing PDF

## Key Improvements Over Legacy

✅ Modern, premium design with rounded cards and shadows
✅ Consistent spacing with 12-column grid system
✅ NO broken tables - all data in structured cards
✅ Proper pagination with Paged.js
✅ Exact color reproduction in PDF
✅ Responsive card layout (works at different scales)
✅ Type-safe with TypeScript
✅ Unit tested (9 passing tests)
✅ Feature flag for safe rollout

## References

- Tailwind CSS: https://tailwindcss.com/docs
- Paged.js: https://pagedjs.org/documentation/
- A4 dimensions: 210mm × 297mm
- Solar brand colors: #FDB813 (brand), #1E293B (dark), #F8FAFC (bg)
