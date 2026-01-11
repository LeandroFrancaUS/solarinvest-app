# SolarInvest App

Modern solar energy simulation platform with integrated CRM, contract generation, and persistent storage.

## 📚 Documentation

- **[API Documentation](./API_DOCUMENTATION.md)** - Complete REST API reference
- **[Deployment Guide](./DEPLOYMENT.md)** - Deploy to Vercel with Neon & Stack Auth
- **[Environment Variables](./.env.example)** - Configuration template

## Requirements

Develop locally with Node.js 24.x (an `.nvmrc` file is provided to pin the version).

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your credentials

# Run development server
npm run dev

# Run production build
npm run build
npm run start
```

## Features

- ☀️ Solar energy simulation and financial projections
- 👥 CRM for client management
- 📄 Contract generation with PDF conversion
- 💾 Persistent storage with Neon PostgreSQL
- 🔐 JWT authentication via Stack Auth
- 📊 ANEEL data integration with proxy
- 🧾 Invoice engine (prototype)

## API Endpoints

The backend exposes RESTful APIs for data persistence:

- `GET /health` - Server health check
- `GET /api/health/db` - Database connectivity test
- `GET/PUT/DELETE /api/storage` - Persistent key-value storage
- `GET/POST/PUT/DELETE /api/clients` - CRM client management
- `GET/POST /api/contracts` - Contract generation and tracking

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete details.

## Testing

```bash
# Unit tests
npm run test

# Linting
npm run lint

# Type checking
npm run typecheck

# Smoke tests
node scripts/smoke-test-db.mjs
```

## ANEEL data proxy

The application consults ANEEL's CKAN datasets to fetch distributor information and
energy tariffs. Those endpoints do not send CORS headers, so browsers block direct
requests. A built-in proxy is now exposed at `/api/aneel` so both the development
server and the production build can call the API without hitting CORS issues.

- `npm run dev` automatically mounts the proxy middleware inside Vite. Any request
  sent to `/api/aneel?path=...` is resolved on the server and forwarded to
  `https://dadosabertos.aneel.gov.br`.
- `npm run build && npm run start` builds the static assets and launches a minimal
  Node server that serves the production bundle and handles the same proxy route.

Advanced configuration:

- To disable the proxy entirely, set `VITE_ANEEL_PROXY_BASE=` (empty) in your
  environment. The application will then call the upstream origin directly and
  will only work in environments where CORS is already allowed.
- To point the frontend to a different ANEEL mirror, set
  `VITE_ANEEL_DIRECT_ORIGIN=https://example.com`.

## Testing

Install dependencies with `npm install` before running the test suite. The project
uses [Vitest](https://vitest.dev/) for unit tests, exposed through `npm run test`.
If your environment blocks access to the public npm registry, mirror the required
packages or configure an internal registry so Vitest can be installed successfully.

## Neon PostgreSQL storage

The Solarinvest app now persists CRM datasets, budgets and other workspace
preferences in a Neon PostgreSQL database. The backend automatically provisions
the `app_storage` table on startup and exposes a `/api/storage` endpoint that the
frontend transparently uses instead of the browser `localStorage` APIs.

Configure the following variables in your Vercel project (or `.env` file when
running locally):

- `DATABASE_URL` (or `DATABASE_URL_UNPOOLED`) – full Neon connection string.
- `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` – optional raw credentials if
  you prefer to assemble the URI manually.

The backend requires the `@neondatabase/serverless` driver. Run
`npm install @neondatabase/serverless` so the dependency is available before
starting the server.

To validate the connection locally, populate `DATABASE_URL` (or the equivalent
variables above) in a `.env` file and run:

```bash
npm run test:neon
```

The script loads the same environment variables as the server and executes a
simple `SELECT NOW()` against the Neon instance, confirming that credentials and
network access are working.

## Stack Auth integration

When a Stack Auth project is configured the `/api/storage` endpoint now
requires authenticated requests using a Bearer token signed by Stack Auth. The
server validates the JWT against the project's JWKS document and rejects
unauthorized calls with HTTP 401.

Set the following environment variables:

- `NEXT_PUBLIC_STACK_PROJECT_ID` – Stack Auth project identifier.
- `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` – publishable key used by the
  frontend client.
- `STACK_SECRET_SERVER_KEY` – secret server key (required by Stack SDKs).
- `STACK_JWKS_URL` – JWKS URL published by Stack Auth.
- `TRUSTED_WEB_ORIGINS` – comma-separated list of allowed origins for CORS. If
  omitted the server trusts the default Vite dev URLs.

Example `.env` snippet based on the current SolarInvest deployment:

```
NEXT_PUBLIC_STACK_PROJECT_ID=deead568-c1e6-436c-ba28-85bf3fbebef5
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=pck_1t1r87ap8bbrdb9bf42fbzzqr27h7969s6vd3kha76gdr
STACK_SECRET_SERVER_KEY=ssk_0n5r6c4rjgc6rdx0ymt2kt0bfnp8vv9626f6crjsnypcg
STACK_JWKS_URL=https://api.stack-auth.com/api/v1/projects/deead568-c1e6-436c-ba28-85bf3fbebef5/.well-known/jwks.json
TRUSTED_WEB_ORIGINS=https://app.solarinvest.info
DATABASE_URL=postgresql://neondb_owner:npg_Y6Hrql3hWOum@ep-damp-mouse-ac5zr9v1-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

## PDF conversion for leasing contracts

Leasing contracts are rendered from `.dotx` templates and converted to PDF using external services. Configure at least one provider:

- `CONVERTAPI_SECRET` – API token for ConvertAPI (primary provider).
- `GOTENBERG_URL` – optional HTTP endpoint for a Gotenberg instance (fallback provider).

If no provider is configured, the leasing endpoint will fall back to delivering DOCX files (or a ZIP with DOCX files) and will include a warning header in the response.

Templates must be deployed alongside the app in `public/templates/contratos` so the serverless runtime can read them at `/public` during execution.

To configure `CONVERTAPI_SECRET` in Vercel:

1. Open the project in Vercel.
2. Go to **Settings → Environment Variables**.
3. Add `CONVERTAPI_SECRET` for **Production** and **Preview** (and **Development** if needed).
4. Redeploy the project so the new variables are applied.

You can verify provider configuration with:

```bash
curl -s https://<your-domain>/api/health/pdf
```

You can also validate template availability with:

```bash
curl -s https://<your-domain>/api/health/contracts
```

And run the smoke test locally:

```bash
BASE_URL=http://localhost:3000 node scripts/smoke-contracts-leasing.mjs
```

## SolarInvest Invoice Engine (standalone)

O repositório agora contém uma versão independente do Invoice Engine com backend (Node + TypeScript) e frontend (React + Vite) prontos para uso em modo protótipo.

### Estrutura rápida
- `backend/`: servidor Express com rotas `/api/invoices` para upload, cálculo e geração de PDF.
- `frontend/`: dashboard React com fluxo de upload, revisão, cálculo e pré-visualização da fatura SolarInvest.
- `cli/test-engine.ts`: CLI simples para testar o motor de cálculo com dados dummy.

### Como executar
1. Backend
   ```bash
   cd backend
   npm install
   cp .env.example .env # ajuste as variáveis se tiver OCR externo
   npm run dev
   ```

2. Frontend
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

O frontend assume o backend em `http://localhost:3001`. Ajuste o `baseURL` em `frontend/src/api/client.ts` se necessário.

## Notas sobre TUSD Fio B (atualizadas)
- **Tarifa usada:** o simulador prioriza `tarifaFioBOficial` (R$/kWh), de acordo com a Lei 14.300/2022 e a REN 1.000/2021. Se ela não for informada, recorre ao cálculo legado `percentualFioB * tarifaTUSD` (mantenha apenas por compatibilidade).
- **Energia compensada:** a base é `energiaGerada * (1 - simultaneidade)`, com `simultaneidade` limitada a 0–1 (padrão 0,6 quando o campo está vazio). Isso evita percentuais inválidos.
- **Fator de incidência da lei:** o valor da TUSD pode ser multiplicado pelo fator da Lei 14.300 (padrão 1,0/100%).
- **Fórmula consolidada:**
  - Com tarifa oficial: `tusdFioB = tarifaFioBOficial * energiaGerada * (1 - simultaneidade) * fatorLei14300`.
  - Sem tarifa oficial (fallback): `tusdFioB = tarifaTUSD * percentualFioB * energiaGerada * (1 - simultaneidade) * fatorLei14300`.
- **Mensalidade com distribuidora:** `calcularValorContaRede` soma taxa mínima (CID) + CIP (se houver) + TUSD Fio B. A função `calcularMensalidadeSolarInvest` segue existindo como alias para não quebrar chamadas antigas.

## Architecture

### Backend Structure

```
server/
├── index.js              # Main server with route handling
├── aneelProxy.js         # ANEEL data proxy
├── contracts.js          # Contract rendering
├── leasingContracts.js   # Leasing-specific contracts
├── auth/
│   └── stackAuth.js      # JWT validation
├── database/
│   ├── neonClient.js     # Database singleton
│   ├── neonConfig.js     # Connection configuration
│   ├── storageService.js # Key-value storage
│   ├── clientsService.js # CRM clients
│   └── contractsService.js # Contracts
├── middleware/
│   └── requireAuth.js    # Auth middleware
└── routes/
    ├── clients.js        # /api/clients handler
    └── contracts.js      # /api/contracts handler
```

### Frontend Structure

```
src/
├── lib/
│   └── apiClient.ts      # Centralized API client
├── services/
│   ├── storageService.ts # Storage API wrapper
│   ├── clientsService.ts # Clients API wrapper
│   └── contractsService.ts # Contracts API wrapper
├── store/                # Zustand stores
├── components/           # React components
└── utils/                # Pure utility functions
```

### Database Schema

Tables are auto-created on first use:

- **storage** - User key-value storage
- **clients** - CRM client records with full contact info
- **contracts** - Contract generation tracking
- **storage_events** - Storage audit log
- Additional CRM tables: users, contacts, pipelines, deals, quotes, activities, notes

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md#database-schema) for complete schema.

## Contributing

1. Follow existing code patterns
2. Use TypeScript for new frontend code
3. Use ESM imports (`.js` extensions for imports)
4. Run quality checks before committing:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run check:cycles
   ```
5. Update documentation for new features

## License

Proprietary - All rights reserved
