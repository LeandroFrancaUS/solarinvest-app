# SolarInvest App – Copilot Instructions

This document guides AI agents through the SolarInvest codebase, a Node 24 + Vite + React + TypeScript + PostgreSQL financial simulation platform for Brazilian solar investments.

## Architecture Overview

**Full-stack monorepo** with:
- **Frontend**: SPA (React + Zustand stores) bundled with Vite, served at `/src`.
- **Backend**: Middleware server (`server/`) for ANEEL proxy, contract rendering, and `/api/storage` (Neon PostgreSQL).
- **Build**: Vite SPA → `dist/`, then Node server overlays API routes at startup.

### Data Flow
1. User opens app → Vite SPA loads from `dist/index.html` (or dev server via `npm run dev`).
2. Interactions → **Client-side calculations** in `src/utils/*.ts` (tariffs, financial math).
3. Persistence → **Zustand stores** (`src/store/*.ts`) → **localStorage** or **`/api/storage`** (PostgreSQL).
4. External data → **ANEEL proxy** (`server/aneelProxy.js`) handles CORS for tariffs and distributor info.
5. PDF/contracts → **Contract renderer** (`server/contracts.js`) merges Mustache templates + data.

### Key Directories
| Path | Purpose |
|------|---------|
| `src/` | Frontend SPA: components, stores, utils, calculations. |
| `server/` | API middleware: ANEEL proxy, storage, contracts, auth (Stack). |
| `db/migrations/` | PostgreSQL schema (Neon). |
| `scripts/` | Build/lint/test scripts. |
| `public/` | Static assets (CSVs, manifests). |

## Critical Patterns & Conventions

### 1. State Management: Zustand Stores
Stores live in `src/store/useXxxStore.ts` and persist via `/api/storage` or localStorage.

```typescript
// src/store/useSimulationsStore.ts
const STORAGE_KEY = 'solarinvest:simulacoes:v1'
export type SimulationsState = {
  items: Record<string, Simulacao>
  add: (s: Simulacao) => void
  // queuePersist() debounces saves to DB/localStorage
}
```

**Pattern**: Stores export a single hook; persistence is debounced (300ms) to avoid request floods.

### 2. Utility Functions: Domain Logic
`src/utils/*.ts` contain pure calculation functions for tariffs, financial projections, and geo-data.

```typescript
// src/utils/tarifaAneel.ts
export async function getTarifaCheia(distribuidor: string): Promise<number>

// src/utils/calcs.ts
export function calcularTaxaMinima(args): number
export const tarifaDescontada = (cheia, desconto) => cheia * (1 - desconto)
```

**Pattern**: Async utilities fetch ANEEL data; sync utilities compute with zero side effects.

### 3. ANEEL Integration: Proxy + Fallback
ANEEL API endpoints (tariffs, distributors) are behind a CORS-protected endpoint.

```javascript
// server/aneelProxy.js – dev middleware in vite.config.ts
// Handles /api/aneel?path=... → proxies to https://dadosabertos.aneel.gov.br
// frontend calls: resolveApiUrl('/aneel?path=dados/...') or uses direct origin if CORS allowed

// src/utils/distribuidorasAneel.ts
const getDistribuidorasFallback = () => [ { /* hardcoded fallback */ } ]
const loadDistribuidorasAneel = async () => {
  try {
    return await fetch(`/api/aneel?path=...`).then(r => r.json())
  } catch {
    return getDistribuidorasFallback()
  }
}
```

**Pattern**: Always have fallback data hardcoded; proxy is optimization, not requirement.

### 4. PDF/Contract Rendering
Contracts use Mustache templates + server-side merge via `server/contracts.js`.

```javascript
// server/contracts.js
handleContractRenderRequest() → reads `/assets/templates/contratos/*.{html,xml}`
  → merges with form data (variables like {{cliente}}, {{tarifaAno1}})
  → renders to PDF or returns HTML
```

**Pattern**: Template variables match Zustand store shapes; ensure data is serialized before rendering.

### 5. Authentication (Optional Stack)
If `isStackAuthEnabled()`, routes check Stack session; otherwise default `user_id='default'`.

```javascript
// server/auth/stackAuth.js
const user = getStackUser(req)
const userId = sanitizeStackUserId(user?.id) || DEFAULT_USER_ID
```

**Pattern**: Storage rows are keyed by `user_id`; multi-user safe by design.

### 6. Component Structure
Functional `.tsx` components using React hooks; co-located styles preferred.

```tsx
// src/components/MyFeature.tsx
export function MyFeature() {
  const [state, setState] = useState(initialValue)
  const storeData = useSimulationsStore(s => s.items)
  return <div>...</div>
}
```

**Pattern**: PascalCase files, lift state to closest parent, avoid prop drilling via store hooks.

---

## Dev Workflows

### Installation & Setup
```bash
# Use Node 24.x (see .nvmrc)
nvm use  # or `nvm install 24`
npm install  # npm ci if lockfile exists
```

### Development
```bash
npm run dev              # Vite dev server on http://localhost:5173, ANEEL proxy included
npm run test            # Vitest (watch mode: vitest)
npm run build           # Production build → dist/
npm run start           # Serve dist/ + server middleware (localhost:3000)
npm run lint            # ESLint (--max-warnings=0)
npm run typecheck       # tsc --noEmit
npm run check:cycles    # Find circular dependencies
```

### Pre-Push Checks
The `.husky/pre-push` hook runs:
```bash
npm run lint && npm run typecheck && npm run check:cycles && npm run test
```

Bypass with `--no-verify` only if necessary.

### Environment Variables
Prefix with `VITE_` for frontend secrets; backend uses `DATABASE_URL`, `PORT`, etc.

```bash
# .env.local (never commit)
VITE_ANEEL_PROXY_BASE=/api/aneel
DATABASE_URL=postgresql://user:pass@host/db
```

Access in code:
```typescript
// Frontend
const proxyBase = import.meta.env.VITE_ANEEL_PROXY_BASE
// Backend
const dbUrl = process.env.DATABASE_URL
```

---

## Storage Persistence

### localStorage (Default, Dev)
Stores auto-save to `localStorage` via `queuePersist()` (debounced).

### PostgreSQL (Production)
When `DATABASE_URL` is set:
1. Server initializes Neon connection via `@neondatabase/serverless`.
2. `/api/storage` endpoint proxies localStorage keys → DB rows (user_id, key, value).
3. Frontend `createStore()` helper detects `/api/storage` availability and falls back to localStorage.

**Migration**: Old `app_storage` table rows are automatically migrated on first run.

---

## Build System & Optimization

### Vite Config
- **Entry**: `index.html` → `src/main.tsx`.
- **Plugins**: React JSX, ANEEL proxy middleware (dev only), contract render middleware (dev only).
- **Rollup**: Custom script `scripts/force-rollup-wasm.js` handles WASM deps.

### Production Build
```bash
npm run build  # Runs scripts/build.mjs
```

Stages:
1. Clean: `rm -rf dist/`
2. Vite bundle: `vite build`
3. Move to dist/ (already done by Vite).
4. Node server reads `dist/` at startup.

---

## Common Tasks

### Adding a New Feature
1. **Component**: Create `src/components/FeatureName.tsx`.
2. **State**: If stateful, add to `src/store/useXxxStore.ts` or component-level `useState`.
3. **Calculation**: Add pure functions to `src/utils/`.
4. **Integration**: Import into `App.tsx` or layout component.
5. **Test**: Add to `src/__tests__/` or use `.spec.ts` co-located tests.
6. **Build**: Run `npm run build && npm run start` to verify SPA + server.

### Calling External APIs
1. **ANEEL tariffs**: Use `getTarifaCheia()` (auto-retries with fallback).
2. **Custom backend**: Add route to `server/` (e.g., `server/customApi.js`), wire into `server/index.js`.
3. **Authentication**: Check `isStackAuthEnabled()` in `server/auth/stackAuth.js` before requiring login.

### Debugging Storage Issues
```bash
# Check Neon connection
npm run test:neon

# Verify DB schema
# SELECT * FROM storage; -- in Neon console

# Clear localStorage (dev)
# Open DevTools → Application → localStorage → Clear
```

### Testing & CI
- **Unit tests**: Vitest in `src/__tests__/` (watch: `vitest`).
- **Lint**: ESLint with strict rules (no warnings allowed).
- **Type safety**: `tsc --noEmit` catches issues early.
- **Full QA**: `npm run qa:full` = typecheck + lint + test + e2e (placeholder).

---

## Integration Points & Dependencies

### External Services
- **ANEEL**: Public CKAN API (tariffs, distributors). Proxied via `/api/aneel`.
- **Neon PostgreSQL**: For persistent storage. Connectionstring: `DATABASE_URL`.
- **Stack Auth** (optional): User authentication if enabled. Check `isStackAuthEnabled()`.
- **OneDrive** (optional): Export client registros to cloud via `persistClienteRegistroToOneDrive()`.
- **PDF generation**: Mustache templates + server-side HTML→PDF rendering.

### Libraries
| Package | Use |
|---------|-----|
| **React 18**, **React-DOM** | UI framework. |
| **Zustand** | Lightweight state management. |
| **Recharts** | Financial charts (LineChart, etc.). |
| **Vite** | SPA bundling. |
| **Vitest** | Testing. |
| **TypeScript 5.6** | Type safety. |
| **date-fns** | Date utilities. |
| **jszip** | ZIP file generation. |
| **Mustache** | Template rendering (contracts). |
| **fast-xml-parser** | XML parsing. |
| **@neondatabase/serverless** | PostgreSQL driver. |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `npm install` fails | Ensure Node 24.x; check npm registry access; try `npm cache clean --force`. |
| ANEEL proxy returns 403 | Check `/api/aneel?path=` URL; fallback data is used (check `getDistribuidorasFallback()`). |
| Storage not persisting | Check `DATABASE_URL` env var; run `npm run test:neon`. If undefined, falls back to localStorage. |
| Build fails on WASM | Run `npm run prebuild` to clean esbuild cache. |
| ESLint errors | Run `npm run lint -- --fix` to auto-fix; some rules require manual edits. |
| Type errors | Run `npm run typecheck`; check `tsconfig.json` paths and strict mode settings. |

---

## References
- **Frontend entry**: [src/main.tsx](../src/main.tsx), [src/App.tsx](../src/App.tsx)
- **Server entry**: [server/index.js](../server/index.js)
- **Stores**: [src/store/](../src/store/)
- **Utils**: [src/utils/](../src/utils/)
- **Config**: `import.meta.env.VITE_*` for frontend, `process.env.DATABASE_URL` for backend (see `.env.local` for local development)
- **Build**: [vite.config.ts](../vite.config.ts), [scripts/build.mjs](../scripts/build.mjs)
- **Database**: [db/migrations/](../db/migrations/), [server/database/](../server/database/)

---

**Last updated**: Jan 2026  
**For questions**: Check [README.md](../README.md) or review backend planning in [BACKEND_PLANNING.md](../BACKEND_PLANNING.md).
