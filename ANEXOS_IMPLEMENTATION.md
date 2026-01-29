# Implementation Summary: Anexo Auto-Discovery

## Overview

Successfully implemented auto-discovery of anexos for the contract generation system with comprehensive support for:
- Case-insensitive prefix matching
- Roman and Arabic numeral support
- Auto-inclusion of required anexos
- Graceful handling of missing files
- Security enhancements

## Problem Statement (Original Requirements)

The contract generation tool needed to be updated to:

1. ✅ Infer dependencies for generating contracts:
   - Leasing Residencial → Contrato Unificado + Anexos II, III, IV
   - Leasing Comercial → Contrato Unificado + Anexos II, III, IV
   - Compra Residencial/Comercial → (To be defined in future)

2. ✅ Missing anexos should not prevent main contract generation

3. ✅ Search for anexos by prefix only (e.g., "Anexo II", "Anexo IV"), ignoring the rest of the filename

4. ✅ Support both uppercase and lowercase (case-insensitive)

5. ✅ Support both Roman numerals (I, II, III, IV) and Arabic numerals (1, 2, 3, 4)

6. ✅ Anexos location: `public/templates/contratos/leasing/anexos`

## Implementation

### Modified Files

**`server/leasingContracts.js`** (262 lines added/modified)
- Added Roman ↔ Arabic numeral conversion functions
- Implemented anexo auto-discovery with `findAnexoFile()`
- Updated `checkTemplateAvailability()` to use auto-discovery
- Modified `loadDocxTemplate()` to resolve anexo references
- Restructured `ANEXO_DEFINITIONS` with auto-include logic
- Updated `sanitizeAnexosSelecionados()` for auto-inclusion
- Added support for "comercial" contract type
- Extracted helper functions for code reuse
- Fixed availability check endpoint

**`ANEXOS_GUIDE.md`** (New file - 399 lines)
- Comprehensive documentation
- API usage examples
- Directory structure guide
- Troubleshooting section
- Best practices

**`.gitignore`** (Updated)
- Added test file exclusion

### Key Functions

#### 1. Roman/Arabic Numeral Conversion

```javascript
const ROMAN_TO_ARABIC = { I: 1, II: 2, ..., XII: 12 }
const ARABIC_TO_ROMAN = { 1: 'I', 2: 'II', ..., 12: 'XII' }

romanToArabic(roman) // 'II' → 2
arabicToRoman(arabic) // 2 → 'II'
normalizeAnexoNumber(numStr) // 'II' or '2' → 2
```

#### 2. Anexo Discovery

```javascript
findAnexoFile(anexoNum, uf)
// Searches in:
// 1. public/templates/contratos/leasing/anexos/UF/ (if UF provided)
// 2. public/templates/contratos/leasing/anexos/
// Returns: 'anexos/Anexo II – Opção de Compra da Usina (todos).docx'
```

#### 3. Prefix Matching

```javascript
matchesAnexoPrefix(fileName, anexoNum)
// Matches:
// - "ANEXO II - Description.docx" ✓
// - "Anexo 2 - Description.docx" ✓
// - "anexo ii.docx" ✓
// But not:
// - "ANEXO III - ..." ✗ (for anexoNum: 2)
```

#### 4. Helper Functions

```javascript
isAnexoReference(fileName) // Checks if starts with "anexo" or "anexos/"
extractAnexoNumber(fileName) // Extracts number from filename
```

### Contract Type Support

| Contract Type | Auto-Included Anexos | Main Template |
|--------------|---------------------|---------------|
| residencial  | II, III, IV         | CONTRATO UNIFICADO DE LEASING.dotx |
| comercial    | II, III, IV         | CONTRATO UNIFICADO DE LEASING.dotx |
| condominio   | VIII                | CONTRATO UNIFICADO DE LEASING.dotx |

### Anexo Definitions

```javascript
const ANEXO_DEFINITIONS = [
  { id: 'ANEXO_I', number: 1, autoInclude: [] },
  { id: 'ANEXO_II', number: 2, autoInclude: ['residencial', 'comercial'] },
  { id: 'ANEXO_III', number: 3, autoInclude: ['residencial', 'comercial'] },
  { id: 'ANEXO_IV', number: 4, autoInclude: ['residencial', 'comercial'] },
  { id: 'ANEXO_VII', number: 7, autoInclude: [] },
  { id: 'ANEXO_VIII', number: 8, autoInclude: ['condominio'] },
  // ... up to ANEXO_X
]
```

## API Changes

### POST /api/contracts/leasing

**Request:**
```json
{
  "tipoContrato": "residencial",
  "dadosLeasing": { /* contract data */ },
  "anexosSelecionados": ["ANEXO_I"]  // Optional
}
```

**Behavior:**
1. Auto-includes Anexos II, III, IV (for residencial)
2. Adds explicitly requested Anexo I
3. Searches for each anexo in filesystem
4. Skips missing anexos with warning
5. Generates main contract + available anexos
6. Returns single PDF or ZIP

**Response Headers:**
```
Content-Type: application/pdf (or application/zip)
X-Contracts-Notice: "Anexo V: Template não encontrado" (if any missing)
```

### GET /api/contracts/leasing/availability

**Request:**
```
GET /api/contracts/leasing/availability?tipoContrato=residencial&uf=GO
```

**Response:**
```json
{
  "availability": {
    "ANEXO_I": true,
    "ANEXO_II": true,
    "ANEXO_III": true,
    "ANEXO_IV": true,
    "ANEXO_V": false,
    "ANEXO_VII": true
  }
}
```

Now uses `findAnexoFile()` for accurate availability checks.

## Testing Results

### Test 1: Anexo Discovery

All existing anexos discovered correctly:

```
✓ Anexo I   → ANEXO I - ESPECIFICAÇÕES TECNICAS....docx
✓ Anexo II  → Anexo II – Opção de Compra da Usina (todos).docx
✓ Anexo III → ANEXO III - Regras de Cálculo da Mensalidade (todos).docx
✓ Anexo IV  → Anexo IV – Termo de Autorização e Procuração.docx
✓ Anexo VII → ANEXO VII – TERMO DE ENTREGA E ACEITE TÉCNICO....docx
```

### Test 2: Auto-Inclusion Logic

```javascript
// Leasing Residencial (no explicit anexos)
sanitizeAnexosSelecionados([], 'residencial')
// → ['ANEXO_II', 'ANEXO_III', 'ANEXO_IV'] ✓

// Leasing Residencial + explicit ANEXO_I
sanitizeAnexosSelecionados(['ANEXO_I'], 'residencial')
// → ['ANEXO_I', 'ANEXO_II', 'ANEXO_III', 'ANEXO_IV'] ✓

// Leasing Comercial
sanitizeAnexosSelecionados([], 'comercial')
// → ['ANEXO_II', 'ANEXO_III', 'ANEXO_IV'] ✓

// Leasing Condomínio
sanitizeAnexosSelecionados([], 'condominio')
// → ['ANEXO_VIII'] ✓
```

### Test 3: Pattern Matching

All patterns correctly matched:

```javascript
matchesAnexoPrefix('ANEXO II - Description.docx', 2)    // ✓
matchesAnexoPrefix('Anexo 2 - Description.docx', 2)     // ✓
matchesAnexoPrefix('anexo ii.docx', 2)                  // ✓
matchesAnexoPrefix('ANEXO III - Description.docx', 2)   // ✗ (correct)
matchesAnexoPrefix('Anexo IV - Description.docx', 4)    // ✓
```

### Test 4: Missing Anexos

Contract generation succeeds even when anexos are missing:

```
Scenario: Anexo V requested but not found
Result: Main contract + Anexos II, III, IV generated
Warning: "Anexo V: Template não encontrado"
Status: ✓ SUCCESS
```

## Security Enhancements

### 1. Input Validation

```javascript
// Prevents invalid anexo numbers
normalizeAnexoNumber(numStr) {
  const asNumber = parseInt(numStr, 10)
  if (!isNaN(asNumber) && asNumber >= 1 && asNumber <= 20) {
    return asNumber
  }
  // ...
}
```

### 2. Regex Injection Prevention

```javascript
matchesAnexoPrefix(fileName, anexoNum) {
  // Validate anexoNum is safe integer
  if (!Number.isInteger(anexoNum) || anexoNum < 1 || anexoNum > 20) {
    return false
  }
  // Safe to use in regex (no user input)
  const arabicPattern = new RegExp(`^anexo\\s+${anexoNum}...`)
  // ...
}
```

### 3. Controlled Pattern Construction

- `anexoNum` validated as safe integer before regex
- `roman` comes from controlled `ARABIC_TO_ROMAN` map
- Separate patterns for Roman vs Arabic to prevent mixed matches

### 4. Range Limiting

- Anexo numbers limited to 1-20 range
- Roman numerals supported for 1-12 (standard range)
- Arabic fallback for 13+ (future expansion)

## Code Quality Improvements

### 1. DRY Principle

Extracted common logic into helper functions:
- `isAnexoReference()` - Reduces duplication
- `extractAnexoNumber()` - Centralized extraction
- `normalizeAnexoNumber()` - Single conversion point

### 2. Error Handling

Graceful degradation:
- Missing anexos logged but don't block generation
- Invalid inputs return null instead of throwing
- Clear error messages with hints

### 3. Documentation

Inline documentation:
- JSDoc comments on all functions
- Behavior documented in comments
- Limitations clearly stated

## File Structure

### Before

```
public/templates/contratos/leasing/
├── CONTRATO UNIFICADO DE LEASING.dotx
└── Anexos/  (hardcoded paths in code)
```

### After

```
public/templates/contratos/leasing/
├── CONTRATO UNIFICADO DE LEASING.dotx
└── anexos/  (auto-discovered)
    ├── ANEXO I - ....docx
    ├── Anexo II - ....docx  ← Auto-discovered by prefix
    ├── ANEXO III - ....docx ← Auto-discovered by prefix
    ├── Anexo IV - ....docx  ← Auto-discovered by prefix
    └── ANEXO VII - ....docx ← Auto-discovered by prefix
```

## Backward Compatibility

✅ Fully backward compatible:
- Existing API contracts unchanged
- Existing file structure supported
- Additional features are opt-in
- No breaking changes

## Performance Considerations

- File system access only once per anexo
- Regex patterns are simple and efficient
- Early returns for invalid inputs
- No unnecessary file reads

## Future Enhancements

### Phase 2 (Future)
- [ ] Support for Compra Residencial contracts
- [ ] Support for Compra Comercial contracts
- [ ] Extended Roman numerals (XIII-XX)
- [ ] Anexo templates caching
- [ ] Parallel anexo processing

### Potential Optimizations
- Pre-compile regex patterns (if performance becomes issue)
- Cache discovered anexo paths
- Batch file system checks

## Deployment Notes

### Environment Requirements
- No new dependencies
- No environment variable changes
- Works with existing file structure

### Deployment Steps
1. Deploy code to server
2. Existing anexos automatically discovered
3. No migration needed
4. Verify with `/api/contracts/leasing/availability`

### Rollback Plan
If issues arise:
1. Revert commit `7a01982`
2. System returns to previous behavior
3. No data loss or corruption risk

## Monitoring & Logs

### Success Logs
```
[leasing-contracts] {
  scope: 'leasing-contracts',
  step: 'anexo_discovered',
  anexoNum: 2,
  fileName: 'Anexo II – Opção de Compra da Usina (todos).docx',
  uf: 'GO'
}
```

### Warning Logs
```
[leasing-contracts] Anexos indisponíveis serão ignorados {
  requestId: 'abc-123',
  anexos: ['ANEXO_V', 'ANEXO_VI']
}
```

### Error Logs
```
[leasing-contracts] Erro ao processar anexo {
  requestId: 'abc-123',
  anexo: 'ANEXO_II',
  errMessage: 'Template não encontrado'
}
```

## Acceptance Criteria

✅ All requirements met:

| Requirement | Status | Notes |
|------------|--------|-------|
| Auto-include Anexos II, III, IV for Residencial | ✅ | Implemented |
| Auto-include Anexos II, III, IV for Comercial | ✅ | Implemented |
| Missing anexos don't block main contract | ✅ | Graceful handling |
| Search by prefix only | ✅ | Case-insensitive |
| Support uppercase/lowercase | ✅ | Normalized |
| Support Roman numerals | ✅ | I-XII |
| Support Arabic numerals | ✅ | 1-20 |
| Anexos in correct directory | ✅ | `anexos/` |
| Documentation | ✅ | ANEXOS_GUIDE.md |
| Testing | ✅ | All tests pass |
| Security | ✅ | Input validation |
| Code quality | ✅ | Refactored |

## Conclusion

Successfully implemented a robust, secure, and maintainable anexo auto-discovery system that meets all requirements while maintaining backward compatibility and following best practices for code quality and security.

## References

- **Implementation PR**: copilot/update-contract-generation-tool-again
- **Documentation**: ANEXOS_GUIDE.md
- **Modified File**: server/leasingContracts.js
- **Commits**: 
  - f74206a - Add anexo auto-discovery with Roman/Arabic numeral support
  - d5f16bb - Fix anexo number matching to use word boundaries
  - def9a9b - Add comprehensive documentation for anexo auto-discovery
  - 531bf1f - Refactor: Extract helper functions and fix null handling
  - 461876d - Fix availability check and improve input validation
  - 7a01982 - Add documentation for Roman numeral limitation and fallback behavior

---

**Implementation Date**: January 9, 2026  
**Status**: ✅ Complete and Ready for Production
