# Client Duplicate Prevention & Database Guardrails

## Overview

This system implements comprehensive duplicate prevention for client data, ensuring data quality and preventing unintentional duplicates based on UC (Unidade Consumidora) and address information.

## Implementation Components

### 1. Database Migration (0058)

**File:** `db/migrations/0058_client_duplicate_prevention.sql`

**New Columns:**
- `numero_normalizado` (TEXT) - Extracted and normalized building number
- `quadra` (TEXT) - Block number (common in rural areas)
- `lote` (TEXT) - Lot number (common in subdivisions)
- `allow_duplicate` (BOOLEAN) - Manual override flag (default: FALSE)

**Automatic Extraction:**
- Trigger `trigger_normalize_client_address` automatically extracts:
  - Building number from `logradouro` or `numero` fields
  - Quadra from patterns like "Qd 12", "Q. 34", "Quadra 56"
  - Lote from patterns like "Lt 12", "L. 34", "Lote 56"
- CEP is automatically normalized to 8 digits

**Database Functions:**
- `extract_numero_from_address()` - Extracts number from various address formats
- `extract_quadra_lote()` - Extracts block and lot numbers
- `check_client_duplicate()` - Main duplicate detection function

**Indexes:**
- `idx_clients_address_uc_dedup` - Composite index on (CEP + número + UC)
- `idx_clients_address_quadra_lote_uc_dedup` - Composite index on (CEP + quadra + lote + UC)
- `idx_clients_uc_geradora_active` - Index on UC geradora for quick lookups

**View:**
- `vw_client_duplicate_candidates` - Identifies potential duplicates

**Check Constraints:**
- UC geradora cannot be placeholder values (null, undefined, 0, N/A)
- CEP must be exactly 8 digits
- Phone must have at least 10 digits
- Email must contain @
- Name cannot be placeholder values

### 2. Backend Validation

**File:** `server/clients/duplicateValidation.js`

**Main Functions:**
- `checkClientDuplicate(sql, clientData, excludeClientId)` - Checks if duplicate exists
- `validateClientDuplicates(sql, clientData, existingClientId)` - Validates and returns user-friendly errors
- `extractNumeroFromAddress()` - Same logic as database function
- `extractQuadraLote()` - Same logic as database function

**Duplicate Detection Hierarchy:**
1. **UC Duplicada** - Same UC geradora (highest priority)
2. **Endereço Duplicado** - Same CEP + same número
3. **Endereço Duplicado (Quadra/Lote)** - Same CEP + same quadra + same lote

### 3. API Integration

**File:** `server/clients/handler.js`

**Updated Endpoints:**
- `POST /api/clients/upsert-by-cpf` - CPF-based upsert with duplicate validation
- `POST /api/clients` - Regular client creation with duplicate validation
- `PUT /api/clients/:id` - Client update with duplicate validation

**Response Codes:**
- `409 Conflict` - Duplicate detected
- Error codes: `DUPLICATE_UC`, `DUPLICATE_ADDRESS`, `DUPLICATE_ADDRESS_QUADRA_LOTE`

## Business Rules

### When is a client considered a duplicate?

1. **Same UC geradora** - Regardless of address
   - UC is the unique identifier for an energy consumer unit
   - One UC cannot be registered to multiple clients
   - Exception: Manual override with `allow_duplicate = TRUE`

2. **Same address + different UC** - Allowed
   - Multiple consumers at the same physical address are allowed
   - Example: Apartments in the same building

3. **Same CEP + same número** - Blocked
   - Even if UC is different, this is likely an error
   - User must provide quadra/lote distinction if needed

4. **Same CEP + same quadra + same lote** - Blocked
   - For rural/subdivision addresses
   - Prevents accidental duplicates

### When can duplicates be allowed?

Set `allow_duplicate = TRUE` on the client record to bypass validation. This should only be done:
- After administrative approval
- For legitimate cases (e.g., multiple installations at same address)
- With proper documentation

## User Error Messages

### UC Duplicada
```
Já existe um cliente com a mesma UC (1234567890).
Cliente existente: "João Silva" (ID: 123).
Não é possível cadastrar o mesmo número de UC para dois clientes diferentes.
Se este é um novo contrato para o mesmo endereço, edite o cliente existente.
```

### Endereço Duplicado
```
Já existe um cliente no mesmo endereço (CEP e número idênticos).
Cliente existente: "Maria Santos" no endereço Rua ABC 123 - São Paulo/SP.
Para cadastrar uma nova UC no mesmo endereço, é necessário que a UC seja diferente.
Se este é o mesmo cliente, edite o cadastro existente ao invés de criar um novo.
```

### Endereço Duplicado (Quadra/Lote)
```
Já existe um cliente no mesmo endereço (CEP, quadra e lote idênticos).
Cliente existente: "José Costa" no endereço Rua XYZ Qd 12 Lt 5 - Brasília/DF.
Para cadastrar uma nova UC no mesmo endereço, é necessário que a UC seja diferente.
Se este é o mesmo cliente, edite o cadastro existente ao invés de criar um novo.
```

## Address Format Support

### Número Extraction Patterns

The system recognizes various formats:
- `"Rua ABC, 123"` → extracts "123"
- `"Av. XYZ 456"` → extracts "456"
- `"Rua ABC nº 789"` → extracts "789"
- `"Rua ABC n. 321"` → extracts "321"
- `"Rua ABC número 654"` → extracts "654"

### Quadra Patterns

- `"Qd 12"`, `"Q. 34"`, `"Quadra 56"`, `"QD. 78"`

### Lote Patterns

- `"Lt 12"`, `"L. 34"`, `"Lote 56"`, `"LT. 78"`

## Data Quality Guardrails

### Automatic Validations (Check Constraints)

1. **UC geradora** - Cannot be:
   - Empty/whitespace only
   - "null", "undefined", "0", "N/A", "n/a"

2. **CEP** - Must be:
   - Exactly 8 digits (no formatting)
   - Automatically normalized on insert/update

3. **Phone** - Must be:
   - At least 10 digits (Brazilian phone numbers)

4. **Email** - Must contain:
   - "@" symbol (basic email validation)

5. **Name** - Cannot be:
   - "0", "null", "undefined", "[object object]", "{}", "[]"
   - "nan", "n/a", "na", "-", "—", "__", "??"
   - "test", "teste", "cliente", "client", "nome", "name"

### Trigger Actions

The `trigger_normalize_client_address` runs **BEFORE INSERT OR UPDATE** and:
1. Extracts and normalizes número
2. Extracts quadra and lote
3. Normalizes CEP to 8 digits
4. Synchronizes `cep` and `client_cep` fields

## Testing

### Manual Testing in Neon SQL Editor

```sql
-- Test 1: Check duplicate detection function
SELECT * FROM public.check_client_duplicate(
  '1234567890',  -- UC geradora
  '12345678',    -- CEP
  '123',         -- Número normalizado
  NULL,          -- Quadra
  NULL,          -- Lote
  NULL           -- Exclude client ID
);

-- Test 2: View duplicate candidates
SELECT * FROM public.vw_client_duplicate_candidates
WHERE tipo_duplicata IS NOT NULL
LIMIT 10;

-- Test 3: Test number extraction
SELECT public.extract_numero_from_address(
  'Rua ABC, número 123',
  NULL
);

-- Test 4: Test quadra/lote extraction
SELECT * FROM public.extract_quadra_lote(
  'Rua XYZ Quadra 12 Lote 34',
  NULL,
  NULL
);
```

### API Testing

```bash
# Test 1: Try to create duplicate UC
curl -X POST http://localhost:3000/api/clients/upsert-by-cpf \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Client",
    "uc_geradora": "1234567890",
    "cep": "12345678",
    "logradouro": "Rua ABC, 123"
  }'

# Expected: 409 Conflict with DUPLICATE_UC error

# Test 2: Try to create duplicate address
curl -X POST http://localhost:3000/api/clients/upsert-by-cpf \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Client 2",
    "uc_geradora": "9999999999",
    "cep": "12345678",
    "logradouro": "Rua ABC, 123"
  }'

# Expected: 409 Conflict with DUPLICATE_ADDRESS error
```

## Migration Rollback

If needed, to rollback this migration:

```sql
-- Drop trigger
DROP TRIGGER IF EXISTS trigger_normalize_client_address ON public.clients;

-- Drop functions
DROP FUNCTION IF EXISTS public.normalize_client_address_fields();
DROP FUNCTION IF EXISTS public.check_client_duplicate(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT);
DROP FUNCTION IF EXISTS public.extract_quadra_lote(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.extract_numero_from_address(TEXT, TEXT);

-- Drop view
DROP VIEW IF EXISTS public.vw_client_duplicate_candidates;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_clients_address_uc_dedup;
DROP INDEX IF EXISTS public.idx_clients_address_quadra_lote_uc_dedup;
DROP INDEX IF EXISTS public.idx_clients_uc_geradora_active;

-- Drop constraints
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS check_uc_geradora_valid;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS check_cep_format;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS check_client_cep_format;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS check_client_phone_format;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS check_client_email_format;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS check_client_name_not_placeholder;

-- Drop columns
ALTER TABLE public.clients DROP COLUMN IF EXISTS numero_normalizado;
ALTER TABLE public.clients DROP COLUMN IF EXISTS quadra;
ALTER TABLE public.clients DROP COLUMN IF EXISTS lote;
ALTER TABLE public.clients DROP COLUMN IF EXISTS allow_duplicate;
```

## Performance Considerations

- All duplicate detection queries use indexed lookups (O(log n))
- Trigger execution is minimal (regex patterns + simple assignments)
- Composite indexes cover the most common query patterns
- View `vw_client_duplicate_candidates` can be used for batch analysis

## Future Enhancements

1. **Fuzzy Address Matching** - Use PostGIS or trigram indexes for "near" duplicate detection
2. **Bulk Import Validation** - Batch validation before importing large datasets
3. **Duplicate Merge UI** - Frontend interface for merging confirmed duplicates
4. **Admin Override UI** - Frontend for setting `allow_duplicate` flag
5. **Audit Log** - Track all duplicate detections and overrides

## Support

For issues or questions, consult:
- Database migration: `db/migrations/0058_client_duplicate_prevention.sql`
- Backend validation: `server/clients/duplicateValidation.js`
- API integration: `server/clients/handler.js`
- This documentation: `db/CLIENT_DUPLICATE_PREVENTION_README.md`
