# PDF Engine (@react-pdf/renderer)

Page-native PDF generation with full layout control, zero imposed margins, and editorial premium appearance.

## Architecture

```
src/pdf/
  ├── theme.ts                 # Design system (colors, spacing, typography)
  ├── types.ts                 # Type adapters for existing data structures
  ├── index.ts                 # Public API exports
  ├── components/              # Reusable PDF components
  │   ├── PdfHeader.tsx
  │   ├── PdfFooter.tsx
  │   ├── SectionTitle.tsx
  │   ├── KeyValueTable.tsx
  │   └── PricingComparisonTable.tsx
  ├── documents/               # Complete PDF documents
  │   ├── LeasingProposalSimple.tsx    # Simple leasing proposal (6-8 pages)
  │   └── LeasingProposalComplete.tsx  # Full leasing proposal (coming soon)
  └── render/                  # Rendering utilities
      ├── renderPdf.ts         # Core rendering functions
      └── clientApi.ts         # Client-side generation API
```

## Key Features

### ✅ A4 Real Size, Zero Margins
- Page size: A4 (595.28pt x 841.89pt)
- Padding: 0 (zero imposed margins)
- Spacing controlled internally via components

### ✅ No Boxy Layout
- No containers with max-width
- No card borders or backgrounds on large blocks
- Full-width content utilization
- Minimal, subtle dividers only

### ✅ Controlled Page Breaks
- `wrap={false}` on row components prevents orphans
- Allow breaks between logical sections (e.g., years in pricing table)
- No forced breaks creating half-empty pages

### ✅ Editorial Typography
- Helvetica font family (built-in, stable)
- Proper hierarchy with controlled letter-spacing (max 0.5pt)
- Clean section titles without boxes

## Usage

### Client-Side Generation (Browser)

```typescript
import { generateLeasingProposalSimple } from '@/pdf'
import type { PrintableProposalProps } from '@/types/printableProposal'

// Existing data format
const proposalData: PrintableProposalProps = {
  // ... your existing proposal data
}

// Generate and download PDF
await generateLeasingProposalSimple(proposalData, 'Proposta-Cliente.pdf')
```

### Get Blob for Upload/Preview

```typescript
import { generateLeasingProposalBlob } from '@/pdf'

const blob = await generateLeasingProposalBlob(proposalData)
// Upload to server or show preview
```

### Server-Side Generation (API Route)

```typescript
// Example: /api/proposal/pdf.ts
import { LeasingProposalSimple } from '@/pdf/documents/LeasingProposalSimple'
import { adaptPrintablePropsToLeasing } from '@/pdf/types'
import { renderPdfToBuffer } from '@/pdf/render/renderPdf'
import React from 'react'

export async function POST(request: Request) {
  const props = await request.json()
  const data = adaptPrintablePropsToLeasing(props)
  const document = React.createElement(LeasingProposalSimple, { data })
  const buffer = await renderPdfToBuffer(document)
  
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="proposta.pdf"',
    },
  })
}
```

## Design Principles

### Page-Native Thinking
- PDF is not a website
- Page is the canvas, not a scrollable container
- A4 is the real size, not a responsive breakpoint

### No Boxes, No Borders
- Avoid card-style containers with borders
- Use whitespace and typography for hierarchy
- Subtle dividers only when necessary for clarity

### Controlled Spacing
- Use `SPACING` constants from theme
- Small, consistent values (4pt to 24pt range)
- Padding on components, not on page wrapper

### Typography Hierarchy
- Use `FONT_SIZE` scale from theme
- Bold for emphasis, not for decoration
- Minimal letter-spacing (max 0.5pt for uppercase labels)

## Migration from HTML->PDF

### Parallel Rollout Strategy
1. **Phase 1** (Current): New PDF engine installed, old HTML system still active
2. **Phase 2**: Add feature flag to switch between engines
3. **Phase 3**: Test with subset of users
4. **Phase 4**: Full rollout, deprecate HTML engine

### Data Adapter
The `adaptPrintablePropsToLeasing()` function converts existing `PrintableProposalProps` to the new `LeasingProposalData` format. This allows:
- No changes to existing data collection
- Gradual migration
- Easy A/B testing

### Type Safety
All PDF components use TypeScript with strict typing:
- Props validated at compile time
- Data transformation explicit and traceable
- IDE autocomplete for component props

## Customization

### Adding New Sections
Create component in `components/` directory:
```typescript
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { SPACING, FONT_SIZE, COLORS } from '../theme'

export const MySection = ({ data }) => (
  <View style={{ paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md }}>
    <Text style={{ fontSize: FONT_SIZE.xl, fontFamily: 'Helvetica-Bold' }}>
      {data.title}
    </Text>
  </View>
)
```

### Creating New Document Types
1. Create file in `documents/` directory
2. Import and compose existing components
3. Export from `index.ts`
4. Add render function in `clientApi.ts`

## Testing

### Visual Validation
Generate PDFs with sample data and verify:
- No page frames or borders
- Clean typography (no excessive spacing)
- Natural page breaks (no half-empty pages)
- All content fits within A4 dimensions

### Automated Testing
```typescript
// Example test
import { generateLeasingProposalBlob } from '@/pdf'
import { mockProposalData } from './fixtures'

test('generates valid PDF blob', async () => {
  const blob = await generateLeasingProposalBlob(mockProposalData)
  expect(blob.type).toBe('application/pdf')
  expect(blob.size).toBeGreaterThan(0)
})
```

## Performance

### Client-Side
- First render: ~1-2s for 6-page document
- Subsequent renders: ~500ms (cached fonts)
- Memory: ~10-15MB for rendering

### Server-Side
- Cold start: ~2-3s (serverless)
- Warm: ~300-500ms
- Recommended: Cache rendered PDFs when data unchanged

## Troubleshooting

### "Module not found: @react-pdf/renderer"
Run: `npm install @react-pdf/renderer`

### Fonts not loading
@react-pdf/renderer includes Helvetica by default. For custom fonts:
```typescript
import { Font } from '@react-pdf/renderer'
Font.register({ family: 'CustomFont', src: '/fonts/custom.ttf' })
```

### Layout issues
- Check page padding is 0
- Verify spacing uses SPACING constants
- Ensure no max-width on content containers
- Use `wrap={false}` strategically to prevent orphans

## Next Steps

- [ ] Complete LeasingProposalComplete document
- [ ] Add server-side API route example
- [ ] Implement feature flag for engine selection
- [ ] Create visual regression tests
- [ ] Add custom font support (optional)
- [ ] Document migration guide for Venda proposals
