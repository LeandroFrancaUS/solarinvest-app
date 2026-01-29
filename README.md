# SolarInvest App

## Requirements

Develop locally with Node.js 24.x (an `.nvmrc` file is provided to pin the version).

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

The SolarInvest app uses **Stack Auth** (`@stackframe/react`) for authentication in
the Vite SPA. When configured, the `/api/storage` endpoint requires authenticated
requests using a Bearer token signed by Stack Auth. The server validates the JWT
against the project's JWKS document and rejects unauthorized calls with HTTP 401.

### Environment Variables

**For Vite Frontend (required):**
- `VITE_STACK_PROJECT_ID` – Stack Auth project identifier (exposed to browser).
- `VITE_STACK_PUBLISHABLE_CLIENT_KEY` – publishable key for frontend (safe to expose).

**For Backend/Server (optional, for API protection):**
- `STACK_SECRET_SERVER_KEY` – secret server key (keep private, server-side only).
- `STACK_JWKS_URL` – JWKS URL published by Stack Auth.
- `TRUSTED_WEB_ORIGINS` – comma-separated list of allowed origins for CORS. If
  omitted the server trusts the default Vite dev URLs.

**Legacy Support (optional):**
- `NEXT_PUBLIC_STACK_PROJECT_ID` – Falls back if `VITE_STACK_PROJECT_ID` is missing.
- `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` – Falls back if `VITE_STACK_PUBLISHABLE_CLIENT_KEY` is missing.

### Setup Instructions

1. **Copy environment template:**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Configure Stack Auth:**
   - Go to [Stack Auth Dashboard](https://app.stack-auth.com/)
   - Copy your Project ID and Publishable Client Key
   - Add them to `.env.local`

3. **Configure redirect URLs in Stack Dashboard:**
   - Development: `http://localhost:5173` and `http://localhost:5173/*`
   - Production: `https://app.solarinvest.info` and `https://app.solarinvest.info/*`

4. **For Vercel deployment:**
   - Add `VITE_STACK_PROJECT_ID` and `VITE_STACK_PUBLISHABLE_CLIENT_KEY` to Vercel environment variables
   - Apply to Production, Preview, and Development environments
   - Redeploy to apply changes (Vite injects env vars at build time)

**See [STACK_AUTH_SETUP.md](./STACK_AUTH_SETUP.md) for detailed setup instructions, troubleshooting, and examples.**

Example `.env.local`:

```env
VITE_STACK_PROJECT_ID=64612256-cc00-4e29-b694-d3944808e1a1
VITE_STACK_PUBLISHABLE_CLIENT_KEY=pck_your_key_here
STACK_SECRET_SERVER_KEY=ssk_your_secret_key_here
STACK_JWKS_URL=https://api.stack-auth.com/api/v1/projects/64612256-cc00-4e29-b694-d3944808e1a1/.well-known/jwks.json
TRUSTED_WEB_ORIGINS=https://app.solarinvest.info
DATABASE_URL=postgresql://your-connection-string
```

## PDF conversion for leasing contracts

Leasing contracts and commercial proposals are rendered from `.dotx` templates and HTML, then converted to PDF using one of three methods. The system automatically selects the best available provider in priority order.

**Supported PDF Generators (in priority order):**

1. **Playwright** (recommended for development) - `PLAYWRIGHT_PDF_ENABLED=true`
   - Local generation with full CSS validation
   - Creates debug artifacts (HTML + screenshots) in `debug/` folder
   - Fastest during development, no external API costs
   - Requires: `npx playwright install chromium`

2. **ConvertAPI** (recommended for production) - `CONVERTAPI_SECRET=your_token`
   - Cloud-based, fast and reliable
   - Requires paid API key from https://www.convertapi.com/

3. **Gotenberg** (self-hosted fallback) - `GOTENBERG_URL=http://your-instance`
   - Self-hosted Docker container
   - No external API costs after setup

**For detailed information** on PDF generation, CSS validation, debug artifacts, and troubleshooting, see **[PDF_GENERATION_GUIDE.md](./PDF_GENERATION_GUIDE.md)**.

Quick setup for development:
```bash
# Install Playwright
npx playwright install chromium

# Enable in .env.local
PLAYWRIGHT_PDF_ENABLED=true
```

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
