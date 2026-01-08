# Migration Guide: Old DOCX→PDF to New @react-pdf/renderer

This guide shows how to migrate from the old DOCX template + conversion flow to the new direct PDF generation using @react-pdf/renderer.

## Old Flow (DOCX → PDF conversion)

```typescript
// OLD: Using /api/contracts/render with DOCX templates
const response = await fetch(resolveApiUrl('/api/contracts/render'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    template,
    cliente: payload,
  }),
})

if (!response.ok) {
  const mensagemErro = await extrairErro(response, templateLabel)
  throw new Error(mensagemErro)
}

const blob = await response.blob()
const url = window.URL.createObjectURL(blob)

// Download or open in new tab
const anchor = document.createElement('a')
anchor.href = url
anchor.target = '_blank'
anchor.rel = 'noopener'
anchor.click()
```

## New Flow (Direct PDF generation)

```typescript
// NEW: Using generateContractPdf with @react-pdf/renderer
import { generateContractPdf } from '@/services/pdfClient';

// 1. Prepare contract data according to the schema
const contractData = {
  cliente: {
    nomeCompleto: payload.nomeCompleto,
    cpfCnpj: payload.cpfCnpj,
    endereco: payload.endereco,
    cidade: payload.cidade,
    uf: payload.uf,
    cep: payload.cep,
    telefone: payload.telefone,
    email: payload.email,
    // ... other optional fields
  },
  dadosTecnicos: {
    unidadeConsumidora: payload.unidadeConsumidora,
    potencia: payload.potencia,
    kWhContratado: payload.kWhContratado,
    modulosFV: payload.modulosFV,
    inversoresFV: payload.inversoresFV,
  },
  dadosContratuais: {
    prazoContratual: payload.prazoContratual,
    diaVencimento: payload.diaVencimento,
    // ... other contractual fields
  },
  tipoContrato: 'leasing' as const,
  incluirAnexos: true, // Set to true for bundle with annexes
};

// 2. Generate PDF
try {
  const result = await generateContractPdf(contractData, {
    autoDownload: true, // Automatically download
  });
  
  console.log(`PDF gerado: ${result.filename} (${result.size} bytes)`);
  
  // Or open in new tab instead of downloading:
  // openPdfInNewTab(result.blob);
  
} catch (error) {
  console.error('Erro ao gerar PDF:', error);
  throw new Error(error.message);
}
```

## Data Mapping Examples

### Basic Client Data
```typescript
// Old payload structure → New schema
const oldPayload = {
  nomeCompleto: "João Silva",
  cpfCnpj: "12345678901",
  enderecoCompleto: "Rua Teste, 123, São Paulo/SP, 01234-567",
  unidadeConsumidora: "123456789",
  // ...
};

// Map to new schema
const contractData = {
  cliente: {
    nomeCompleto: oldPayload.nomeCompleto,
    cpfCnpj: oldPayload.cpfCnpj,
    endereco: extractEndereco(oldPayload.enderecoCompleto),
    cidade: extractCidade(oldPayload.enderecoCompleto),
    uf: extractUf(oldPayload.enderecoCompleto),
    cep: extractCep(oldPayload.enderecoCompleto),
  },
  dadosTecnicos: {
    unidadeConsumidora: oldPayload.unidadeConsumidora,
  },
};
```

### With Technical Specifications
```typescript
const contractData = {
  cliente: { /* ... */ },
  dadosTecnicos: {
    potencia: "10.5", // kWp as string
    kWhContratado: "1200", // Monthly generation
    modulosFV: "20x 545W Jinko Solar Tiger Neo",
    inversoresFV: "1x 10kW Growatt",
  },
};
```

### With Commercial Terms
```typescript
const contractData = {
  cliente: { /* ... */ },
  dadosContratuais: {
    prazoContratual: "240", // months
    dataInicio: "01/01/2026",
    dataFim: "01/01/2046",
    diaVencimento: "10", // day of month
    anoContrato: "2026",
  },
};
```

## Template Selection

The new system automatically selects templates:

```typescript
// For leasing contracts (default)
{ tipoContrato: 'leasing' } // → contrato_leasing template

// For sales contracts
{ tipoContrato: 'venda' } // → contrato_venda template

// For bundle with annexes
{ incluirAnexos: true } // → contrato_bundle template (includes Anexo I & II)
```

## Error Handling

```typescript
try {
  const result = await generateContractPdf(contractData, {
    autoDownload: true,
  });
} catch (error) {
  // Error will include validation details if data is invalid
  if (error.message.includes('CPF/CNPJ é obrigatório')) {
    // Handle missing required field
  } else if (error.message.includes('UF deve ter 2 caracteres')) {
    // Handle invalid UF
  } else {
    // Generic error
    alert('Erro ao gerar contrato. Verifique os dados e tente novamente.');
  }
}
```

## Benefits of New Flow

1. ✅ **No native dependencies**: Works in any serverless environment
2. ✅ **Deterministic output**: Same input → same PDF
3. ✅ **No placeholders**: Empty fields are omitted automatically
4. ✅ **Type-safe**: Full TypeScript support with Zod validation
5. ✅ **Faster**: Direct PDF generation is typically faster than DOCX conversion
6. ✅ **Easier to maintain**: Pure React components instead of binary DOCX templates
7. ✅ **Better testing**: Components can be unit tested

## Gradual Migration Strategy

You can migrate gradually:

1. **Phase 1**: Keep both systems running in parallel
2. **Phase 2**: Add a feature flag to switch between old/new
3. **Phase 3**: Test new system with real users
4. **Phase 4**: Remove old DOCX conversion code

Example feature flag:
```typescript
const USE_NEW_PDF_GENERATION = true; // or read from env/config

if (USE_NEW_PDF_GENERATION) {
  // Use generateContractPdf
  const result = await generateContractPdf(contractData, {
    autoDownload: true,
  });
} else {
  // Use old /api/contracts/render
  const response = await fetch('/api/contracts/render', {
    method: 'POST',
    body: JSON.stringify({ template, cliente: payload }),
  });
}
```

## Testing Checklist

Before fully migrating, test:

- [ ] PDF generates successfully with minimal data
- [ ] PDF generates successfully with complete data
- [ ] Optional fields are omitted when empty (no "{{tag}}" visible)
- [ ] All formatting is correct (CPF/CNPJ masks, dates, currency)
- [ ] Addresses are in ALL CAPS as required
- [ ] Pagination works correctly
- [ ] Footer appears on all pages
- [ ] Bundle template includes all annexes
- [ ] Download works in all browsers
- [ ] Generation time is < 10 seconds
- [ ] Error messages are user-friendly

## Support

For questions or issues:
- See `PDF_GENERATION.md` for full API documentation
- Check existing tests in `src/pdf/__tests__/`
- Review example templates in `src/pdf/templates/`
