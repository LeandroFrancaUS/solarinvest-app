# API Documentation - SolarInvest Backend

## Overview

The SolarInvest backend provides RESTful APIs for managing clients, contracts, and persistent storage. All endpoints support JWT authentication via Stack Auth when configured.

## Base URL

- Development: `http://localhost:3000`
- Production: `https://app.solarinvest.info`

## Authentication

### Stack Auth JWT

When Stack Auth is configured, all data endpoints require a valid JWT token:

```
Authorization: Bearer <jwt_token>
```

If Stack Auth is not configured, the server operates in fallback mode and uses a default user ID.

### Environment Variables

Required for Stack Auth:
- `NEXT_PUBLIC_STACK_PROJECT_ID` - Stack Auth project ID
- `STACK_JWKS_URL` - JWKS endpoint URL

Optional:
- `TRUSTED_WEB_ORIGINS` - Comma-separated list of allowed CORS origins

## Health Check Endpoints

### GET /health

Basic server health check.

**Response:**
```json
{
  "status": "ok"
}
```

### GET /api/health/db

Database connectivity health check.

**Response (success):**
```json
{
  "ok": true,
  "db": "connected",
  "now": "2026-01-11T12:00:00.000Z",
  "latencyMs": 42
}
```

**Response (error):**
```json
{
  "ok": false,
  "db": "error",
  "error": "Connection timeout",
  "latencyMs": 5000,
  "requestId": "uuid"
}
```

## Storage API

Persistent key-value storage per user.

### GET /api/storage

List all storage entries for the authenticated user.

**Response:**
```json
{
  "entries": [
    {
      "key": "user_preferences",
      "value": { "theme": "dark", "language": "pt-BR" }
    }
  ]
}
```

### PUT /api/storage

Create or update a storage entry.

**Request:**
```json
{
  "key": "user_preferences",
  "value": { "theme": "light" }
}
```

**Response:** 204 No Content

### DELETE /api/storage

Delete a specific key or clear all storage.

**Request (delete key):**
```json
{
  "key": "user_preferences"
}
```

**Request (clear all):**
```json
{}
```

**Response:** 204 No Content

## Clients API

Manage CRM clients.

### GET /api/clients

List all clients for the authenticated user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `perPage` (optional): Results per page (default: 30, max: 100)
- `search` (optional): Search by name, email, or document

**Response:**
```json
{
  "clients": [
    {
      "id": 1,
      "user_id": "user123",
      "name": "João Silva",
      "document": "123.456.789-00",
      "email": "joao@example.com",
      "phone": "+55 11 98765-4321",
      "city": "São Paulo",
      "state": "SP",
      "created_at": "2026-01-11T12:00:00Z",
      "updated_at": "2026-01-11T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 30,
    "total": 100,
    "totalPages": 4
  }
}
```

### GET /api/clients/:id

Get a specific client by ID.

**Response:**
```json
{
  "id": 1,
  "user_id": "user123",
  "name": "João Silva",
  "document": "123.456.789-00",
  "email": "joao@example.com",
  ...
}
```

### POST /api/clients

Create a new client.

**Request:**
```json
{
  "name": "João Silva",
  "document": "123.456.789-00",
  "email": "joao@example.com",
  "phone": "+55 11 98765-4321",
  "city": "São Paulo",
  "state": "SP",
  "address": "Rua das Flores, 123",
  "uc": "123456789",
  "distribuidora": "CPFL"
}
```

**Response:** 201 Created
```json
{
  "id": 1,
  "user_id": "user123",
  "name": "João Silva",
  ...
}
```

### PUT /api/clients/:id

Update an existing client.

**Request:** Same as POST, all fields optional

**Response:** 200 OK (updated client object)

### DELETE /api/clients/:id

Delete a client.

**Response:** 204 No Content

## Contracts API

Manage contracts and contract generation.

### GET /api/contracts

List all contracts for the authenticated user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `perPage` (optional): Results per page (default: 30, max: 100)

**Response:**
```json
{
  "contracts": [
    {
      "id": "uuid",
      "user_id": "user123",
      "client_id": 1,
      "client_name": "João Silva",
      "uf": "SP",
      "template_key": "leasing",
      "status": "generated",
      "contract_type": "leasing",
      "created_at": "2026-01-11T12:00:00Z",
      "updated_at": "2026-01-11T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 30,
    "total": 50,
    "totalPages": 2
  }
}
```

### GET /api/contracts/:id

Get a specific contract by ID.

**Response:**
```json
{
  "id": "uuid",
  "user_id": "user123",
  "client_id": 1,
  "client_name": "João Silva",
  ...
}
```

### POST /api/contracts/generate

Generate and save a contract record.

**Request:**
```json
{
  "clientId": 1,
  "uf": "SP",
  "templateKey": "leasing",
  "contractType": "leasing",
  "metadata": {
    "description": "Contrato de leasing solar"
  }
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "contract": {
    "id": "uuid",
    "user_id": "user123",
    "client_id": 1,
    "uf": "SP",
    "template_key": "leasing",
    "status": "generated",
    ...
  },
  "message": "Contrato criado com sucesso. Use o endpoint de renderização para gerar o PDF."
}
```

### PUT /api/contracts/:id/status

Update contract status.

**Request:**
```json
{
  "status": "signed"
}
```

**Response:** 200 OK (updated contract object)

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized
```json
{
  "ok": false,
  "error": "Autenticação obrigatória. Forneça um token JWT válido via header Authorization: Bearer <token>",
  "code": "UNAUTHORIZED"
}
```

### 404 Not Found
```json
{
  "error": "Cliente não encontrado"
}
```

### 500 Internal Server Error
```json
{
  "error": "Erro ao processar requisição",
  "message": "Detailed error message"
}
```

### 503 Service Unavailable
```json
{
  "error": "Persistência indisponível"
}
```

## Database Schema

### storage table
- `id`: INTEGER PRIMARY KEY
- `user_id`: TEXT NOT NULL
- `key`: TEXT NOT NULL
- `value`: JSONB
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ
- UNIQUE(user_id, key)

### clients table
- `id`: BIGSERIAL PRIMARY KEY
- `user_id`: TEXT
- `name`: TEXT NOT NULL
- `document`: TEXT
- `email`: TEXT
- `phone`: TEXT
- `city`: TEXT
- `state`: TEXT
- `address`: TEXT
- `uc`: TEXT
- `distribuidora`: TEXT
- `metadata`: JSONB
- Additional CRM fields (tipo, nome_razao, etc.)
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

### contracts table
- `id`: UUID PRIMARY KEY
- `user_id`: TEXT NOT NULL
- `client_id`: BIGINT REFERENCES clients(id)
- `uf`: TEXT NOT NULL
- `template_key`: TEXT NOT NULL
- `status`: TEXT DEFAULT 'generated'
- `contract_type`: TEXT
- `file_url`: TEXT
- `file_path`: TEXT
- `metadata`: JSONB
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

## Testing

Run the smoke test to verify all endpoints:

```bash
# Start the server
npm run start

# In another terminal, run smoke tests
node scripts/smoke-test-db.mjs

# Or specify a custom base URL
BASE_URL=https://app.solarinvest.info node scripts/smoke-test-db.mjs
```

## Deployment to Vercel

1. Configure environment variables in Vercel Project Settings:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/database
   NEXT_PUBLIC_STACK_PROJECT_ID=your-project-id
   STACK_JWKS_URL=https://api.stack-auth.com/api/v1/projects/your-project-id/.well-known/jwks.json
   TRUSTED_WEB_ORIGINS=https://app.solarinvest.info
   ```

2. Deploy:
   ```bash
   vercel deploy --prod
   ```

3. Verify deployment:
   ```bash
   curl https://app.solarinvest.info/health
   curl https://app.solarinvest.info/api/health/db
   ```
