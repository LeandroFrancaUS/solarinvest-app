# SolarInvest Copilot Instructions

This repository hosts the SolarInvest simulator (React + Vite + Node middleware + Neon/PostgreSQL) plus a standalone Invoice Engine prototype (backend + frontend). Use these guardrails to stay productive.

## Core App (root `src/` + `server/`)
- **Entry**: [src/main.tsx](../src/main.tsx) → [src/App.tsx](../src/App.tsx); built with Vite, served by [server/index.js](../server/index.js).
- **Backend**: ANEEL proxy `/api/aneel`, storage `/api/storage`, contract renderer, optional Stack Auth; see [server/](../server/) and [server/aneelProxy.js](../server/aneelProxy.js).
- **Persistence**: Zustand stores (`src/store/*`) write to localStorage; server upgrades to Neon via `/api/storage` (see [server/database/storageService.js](../server/database/storageService.js)). Legacy `app_storage` migrates automatically.
- **Calculations**: Pure domain helpers in [src/utils/](../src/utils/) (tariffs, irradiation, financial math). Keep them side-effect free.
- **Contracts/PDF**: Templates in [assets/templates/contratos/](../assets/templates/contratos/); renderer in [server/contracts.js](../server/contracts.js).

## Invoice Engine Prototype
- **Backend** (`backend/`): Express TS server with `/api/invoices` for upload, calculate, generate PDF. Run `cd backend && npm install && npm run dev` (port 3001).
- **Frontend** (`frontend/`): React + Vite dashboard hitting `http://localhost:3001/api`; see [frontend/src/api/client.ts](../frontend/src/api/client.ts). Run `cd frontend && npm install && npm run dev`.
- **CLI**: [cli/test-engine.ts](../cli/test-engine.ts) exercises the calculator with dummy data.

## Dev Workflows (root app)
- Node 24.x (.nvmrc). Install: `npm install` (or `npm ci`).
- Serve dev: `npm run dev` (Vite + ANEEL/contract middleware). Prod: `npm run build && npm run start`.
- Quality gates: `npm run lint` (no warnings), `npm run typecheck`, `npm run test` (Vitest), `npm run check:cycles`. Pre-push hook runs all four.
- Diagnostics: `npm run test:neon` (DB connectivity), `npm run check:locale` (blocks `toLocaleString` without `pt-BR`).

## Environment
- Frontend vars must be `VITE_*` (e.g., `VITE_ANEEL_PROXY_BASE`, `VITE_ANEEL_DIRECT_ORIGIN`).
- Backend vars: `DATABASE_URL` (or `DATABASE_URL_UNPOOLED`), `PORT`, optional Stack Auth (`STACK_SECRET_SERVER_KEY`, `STACK_JWKS_URL`, `TRUSTED_WEB_ORIGINS`).
- With Stack Auth enabled, `/api/storage` requires a valid Bearer JWT (see README for sample env block).

## Patterns to Follow
- **Zustand stores**: single exported hook per store; debounce persistence (`queuePersist`, ~300ms). Use `createStore` helper to auto-detect `/api/storage` and fall back to localStorage.
- **ANEEL data**: fetch via proxy (`resolveApiUrl`) and always provide fallback lists/tariffs (`getDistribuidorasFallback`, irradiation constants) to avoid CORS/availability issues.
- **Pure utils**: keep computation in `src/utils/*` (e.g., tarifas, irradiation, financial projections) and make them deterministic. UI components stay lean.
- **File organization**: Components live in `src/components/**` (PascalCase). Co-locate small helpers; promote to `utils/` only when reused.
- **Contracts**: When adding variables, keep names aligned between store shapes and Mustache templates in `assets/templates/contratos`.

## Troubleshooting (root app)
- Install issues: confirm Node 24 and registry access; `npm cache clean --force` if needed.
- Proxy 403: verify `/api/aneel?path=...`; fallback data is used on failure.
- Storage missing: ensure `DATABASE_URL`; otherwise it falls back to localStorage.
- WASM/esbuild hiccups: `npm run prebuild` to clear caches.
- Locale lint: `check:locale` fails if `toLocaleString` lacks `pt-BR`.

## References
- Frontend: [src/main.tsx](../src/main.tsx), [src/App.tsx](../src/App.tsx)
- Backend middleware: [server/index.js](../server/index.js)
- Stores: [src/store/](../src/store/)
- Utils: [src/utils/](../src/utils/)
- Build: [vite.config.ts](../vite.config.ts), [scripts/build.mjs](../scripts/build.mjs)
- Database: [db/migrations/](../db/migrations/), [server/database/](../server/database/)
- Invoice Engine: [backend/](../backend/), [frontend/](../frontend/), [cli/test-engine.ts](../cli/test-engine.ts)

**Last updated**: Jan 2026
