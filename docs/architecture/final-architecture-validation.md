# Final Architecture Validation Report

> **Branch:** `copilot/validate-final-architecture-report`
> **App version:** 2.4.4
> **Date:** 2026-05-05
> **Mode:** Current Main

---

## 1. Executive Summary

| Gate | Result |
|---|---|
| `npm run lint` | ✅ PASS (0 errors, 0 warnings) |
| `npm run typecheck` | ✅ PASS |
| `npx vitest run` | ✅ PASS (2 223 tests · 130 files) |
| `npm run build` | ✅ PASS (chunk-size advisory only — non-blocking) |
| `npm run check:cycles` | ✅ PASS (no circular dependencies) |

**Overall verdict: READY TO MERGE — NOT YET READY FOR UNASSISTED CONTROLLED DEPLOY**

All code-quality gates pass. The architecture is substantially improved post-refactor. The remaining gap to full controlled-deploy readiness is the absence of a Neon staging branch clone in the deployment pipeline and a partial smoke-test scope (contracts only).

---

## 2. App.tsx Metrics

| Metric | Value |
|---|---|
| Total lines | **14 559** |
| `useState` calls | 125 |
| `useEffect` calls | 74 |
| `useMemo` calls | 87 |
| `useCallback` calls | 159 |
| **Total React hooks** | **445** |

### Remaining direct responsibilities in App.tsx

Even after the multi-PR hook-extraction campaign, App.tsx retains these
responsibilities that have **not yet been extracted**:

1. **IBGE states/cities fetch** — `carregarEstadosIbge` and the municipalities
   effect live as inline `useEffect` blocks (~lines 2506–2602).
2. **Distribuidoras ANEEL load** — `loadDistribuidorasAneel` called in an inline
   effect (~line 4301).
3. **`kcKwhMes` state** — declared directly in App.tsx (`useState`, line 1799);
   passed into `useAnaliseFinanceiraState` as a parameter.
4. **UF/distribuidora tariff state** — `ufTarifa`, `distribuidoraTarifa`,
   `ufsDisponiveis`, `distribuidorasPorUf`, `mesReajuste`, `tarifaCheia`
   (lines 1896–1914).
5. **Integration availability flags** — `oneDriveIntegrationAvailable`,
   `proposalPdfIntegrationAvailable` (lines 1873–1876).
6. **`saveDecisionPrompt` and `confirmDialog`** — modal prompt state (lines 1820,
   1848).
7. **`settingsTab`** — settings navigation state (line 1894).
8. **Theme/logout** — `isLoggingOut`, `theme` (lines 1660, 1700); though
   `useTheme` exists, the full logout flow is still inline.
9. **Inline `TarifaInput` sub-component** — local function component defined
   inside the module (~line 897).
10. **`AppShell` + `PageRenderer` wiring** — all render-prop closures that bridge
    `App` state into the layout. This is acceptable *orchestration* glue but
    adds ~300 lines of connective tissue.

---

## 3. Frontend Architecture Map

### 3.1 App Controller

| Layer | File | Lines | Role |
|---|---|---|---|
| React entry | `src/main.tsx` | — | Mounts `<App />` |
| Monolith root | `src/App.tsx` | 14 559 | State orchestration, render wiring |
| Facade hook | `src/app/useSolarInvestAppController.ts` | 296 | Composes 7 extracted hooks into a single call site |

`useSolarInvestAppController` composes (in call order):

1. `useNavigationState` — page/tab/sidebar state + nav callbacks
2. `useTusdState` — TUSD/ANEEL parameters + simultaneidade auto-effect
3. `useLeasingSimulacaoState` — leasing/venda simulation state + retorno
4. `useBudgetUploadState` — kit-budget processing, upload, OCR flow
5. `useStorageHydration` — auth token providers, migration, draft restore
6. `useClientState` — client CRUD state, sync, API load
7. `useProposalOrchestration` — proposal save/load orchestration, auto-save

### 3.2 AppShell

| File | Lines | Role |
|---|---|---|
| `src/layout/AppShell.tsx` | 104 | Pure layout wrapper: Topbar + Sidebar + Content |
| `src/layout/Sidebar.tsx` | — | Sidebar navigation |
| `src/layout/Topbar.tsx` | — | Top navigation bar |
| `src/layout/Content.tsx` | — | Main content area |

AppShell receives all configuration via props (no internal state reads from
stores). It is tested via `src/layout/__tests__/AppShell.smoke.test.tsx`.

### 3.3 PageRenderer

| File | Lines | Role |
|---|---|---|
| `src/app/PageRenderer.tsx` | 58 | Pure rendering dispatcher — no state, no hooks |

Dispatches on `activePage` by calling render-prop functions passed from
App.tsx. All 10 named pages have a render slot; unknown pages fall through to
`renderApp()`.

### 3.4 Feature Hooks

| Hook | File | Lines | Scope |
|---|---|---|---|
| `useNavigationState` | `src/hooks/useNavigationState.ts` | 360 | All navigation state, sidebar, nav callbacks |
| `useStorageHydration` | `src/hooks/useStorageHydration.ts` | 198 | Auth token wiring, migration, draft restore |
| `useClientPortfolio` | `src/hooks/useClientPortfolio.ts` | 266 | Portfolio data loading |
| `useTheme` | `src/hooks/useTheme.ts` | 52 | Light/dark theme toggle |
| `useRouteGuard` | `src/hooks/useRouteGuard.ts` | 52 | Unsaved-changes route guard |
| `useLinkedConsultant` | `src/hooks/useLinkedConsultant.ts` | 78 | Linked consultant resolution |
| `useSimulationComparisons` | `src/hooks/useSimulationComparisons.ts` | 104 | Simulation comparison state |
| `useTusdState` | `src/features/simulacoes/useTusdState.ts` | 139 | TUSD/ANEEL params + simultaneidade |
| `useLeasingSimulacaoState` | `src/features/simulacoes/useLeasingSimulacaoState.ts` | 148 | Leasing/venda simulation + retorno |
| `useBudgetUploadState` | `src/features/simulacoes/useBudgetUploadState.ts` | 715 | Budget upload, OCR, kit processing |
| `useMultiUcState` | `src/features/simulacoes/useMultiUcState.ts` | 550 | Multi-UC beneficiary form (15 handlers + 4 effects) |
| `useAnaliseFinanceiraState` | `src/features/simulacoes/useAnaliseFinanceiraState.ts` | 905 | Financial analysis state (leasing + venda) |
| `useProposalOrchestration` | `src/features/propostas/useProposalOrchestration.ts` | 1 200 | Proposal save/load, auto-save orchestration |
| `useClientState` | `src/features/clientes/useClientState.ts` | 760 | Client CRUD state, sync, API load |

### 3.5 Feature UI Modules

| Module | Path |
|---|---|
| Simulações | `src/features/simulacoes/` |
| Simulador (leasing + vendas) | `src/features/simulador/` |
| CRM | `src/features/crm/` |
| Clientes | `src/features/clientes/` |
| Propostas | `src/features/propostas/` |
| Financial Engine | `src/features/financial-engine/` |
| Project Finance | `src/features/project-finance/` |
| Admin Users | `src/features/admin-users/` |

---

## 4. Backend Architecture Map

### 4.1 Router

| File | Lines | Role |
|---|---|---|
| `server/router.js` | 124 | `createRouter()` — exact + parameterised `:param` matching; exact paths always win |

Routes are registered via `router.register(method, path, fn)`.  
`router.match(method, pathname)` does a two-pass: exact first, then pattern.  
Params are injected into `reqCtx.params` before the handler is called.

### 4.2 Route Registry (27 modules)

| Module | File | Key endpoints |
|---|---|---|
| Health | `routes/health.js` | `/api/health`, `/api/health/pdf`, `/api/health/contracts` |
| Storage | `routes/storage.js` | `/api/storage` |
| Auth | `routes/auth.js`, `routes/authMe.js`, `routes/authReconcile.js` | `/api/auth/*`, `/api/authz/me` |
| Admin Users | `routes/adminUsers.js` | `/api/admin/users`, `/:id/{approve,block,revoke,role,permissions}` |
| Clients | `routes/clients.js` | `/api/clients` |
| Proposals | `routes/proposals.js` | `/api/proposals` |
| Portfolio | `routes/portfolio.js` | `/api/client-portfolio`, `/api/dashboard/portfolio/summary` |
| Projects | `routes/projects.js` | `/api/projects` |
| Invoices | `routes/invoices.js` | `/api/invoices` |
| Operational Tasks | `routes/operationalTasks.js` | `/api/operational-tasks` |
| Revenue Billing | `routes/revenueBilling.js` | `/api/revenue-billing` |
| Financial Management | `routes/financialManagement.js` | `/api/financial-management` |
| Financial Analyses | `routes/financialAnalyses.js` | `/api/financial-analyses` |
| Financial Import | `routes/financialImport.js` | `/api/financial-import` |
| Consultants | `routes/consultants.js` | `/api/consultants` |
| Engineers | `routes/engineers.js` | `/api/engineers` |
| Installers | `routes/installers.js` | `/api/installers` |
| Personnel Import | `routes/personnelImport.js` | `/api/admin/personnel-import` |
| ANEEL | `routes/aneel.js` | `/api/aneel` |
| Contracts | `routes/contracts.js` | `/api/contracts/*` (5 paths) |
| DB Info | `routes/dbInfo.js` | `/api/db-info` |
| Database Backup | `routes/databaseBackup.js` | `/api/admin/database-backup` |
| Purge Deleted Clients | `routes/purgeDeletedClients.js` | `/api/admin/purge-deleted-clients` |
| Purge Old Proposals | `routes/purgeOldProposals.js` | `/api/admin/purge-old-proposals` |
| RBAC Inspect | `routes/rbacInspect.js` | `/api/admin/rbac-inspect` |

**Handler shim** (`server/handler.js`, 387 lines): CORS setup, router
dispatch, OPTIONS fallback, SPA/static fallback. Carries its own
in-memory rate-limit implementation for auth and admin endpoints.
No route logic lives here.

### 4.3 Middleware

| HOF | File | Lines | Role |
|---|---|---|---|
| `withAuth` | `middleware/withAuth.js` | 95 | JWT/session verification, actor injection into `reqCtx` |
| `withErrorHandler` | `middleware/withErrorHandler.js` | 60 | Wraps handler, catches thrown errors, returns structured error response |
| `withRateLimit` | `middleware/withRateLimit.js` | 129 | Sliding-window rate limiter; supports `{check}` or `{limit, windowMs}` |

All three bypass `OPTIONS` requests. Composed as HOFs:

```
withErrorHandler(withRateLimit(withAuth(inner, { roles }), { check }))
```

### 4.4 Response Layer

| File | Lines | Exports |
|---|---|---|
| `server/response.js` | 130 | `jsonResponse`, `noContentResponse`, `methodNotAllowedResponse`, `unauthorizedResponse`, `forbiddenResponse`, `tooManyRequestsResponse`, `serviceUnavailableResponse`, `internalErrorResponse`, `errorResponse` |

Built on `res.statusCode + res.setHeader + res.end`. Guards on
`res.headersSent`. `errorResponse` preserves HTTP 401/403/404/429/503;
all other `error.statusCode` values fall back to 500.

### 4.5 Adapters

| Adapter | File | Role |
|---|---|---|
| `clientAdapter` | `server/adapters/clientAdapter.js` | `toCanonicalClient(raw)` — maps legacy (`name`, `document`, …) → canonical (`client_name`, `client_document`, …) with null-safe fallback |
| `proposalAdapter` | `server/adapters/proposalAdapter.js` | `toCanonicalProposal(raw)` — maps proposal client context fields; preserves `payload_json` intact |

Both adapters are **pure functions** (no DB access, no SQL, no side effects).
Both have companion spec files in `server/__tests__/adapters/`.

### 4.6 Database / RLS

| Layer | File | Notes |
|---|---|---|
| Connection | `server/database/connection.js`, `neonClient.js`, `pgPool.js` | Neon + local pg-pool |
| RLS context | `server/database/rlsContext.js`, `withRLSContext.js`, `withRls.js` | `createUserScopedSql` injects `userId` + `role` |
| Storage service | `server/database/storageService.js` | User-scoped key-value storage; localStorage fallback |

> **RLS hardening status (residual risk):** `createUserScopedSql` still has a
> graceful fallback path when RLS context cannot be applied. Full fail-closed
> behavior (throw rather than fall back to raw SQL) is a recommended
> hardening task.

---

## 5. Quality Gate Results

| Gate | Command | Result | Notes |
|---|---|---|---|
| Lint | `npm run lint` | ✅ **PASS** | 0 errors, 0 warnings |
| Type check | `npm run typecheck` | ✅ **PASS** | `tsc --noEmit` clean |
| Tests | `npx vitest run` | ✅ **PASS** | 2 223 tests · 130 files |
| Build | `npm run build` | ✅ **PASS** | chunk-size advisory for `index.js` (1 477 kB min / 378 kB gzip) — non-blocking |
| Cycle check | `npm run check:cycles` | ✅ **PASS** | No circular dependencies |

---

## 6. Deployment Safety Assessment

The current branch (`main`) **has** a split deployment workflow
(`.github/workflows/deploy.yml`):

| Phase | Status |
|---|---|
| `staging` job (auto, no approval) | ✅ EXISTS |
| `deploy:safety-check` (migration scanner) | ✅ EXISTS (`scripts/deploy/migration-safety-check.mjs`) |
| Vercel preview deployment | ✅ EXISTS |
| Smoke test against preview | ✅ EXISTS (`scripts/smoke-contracts-leasing.mjs`) |
| `deploy-production` job (`needs: [staging]`) | ✅ EXISTS |
| GitHub `environment: production` approval gate | ✅ EXISTS |
| `deploy:snapshot` (pre-deploy logical snapshot) | ✅ EXISTS (`scripts/deploy/pre-deploy-snapshot.mjs`) |
| `db:migrate` before production build | ✅ EXISTS |
| `deploy:verify` (post-deploy row/sum check) | ✅ EXISTS (`scripts/deploy/post-deploy-verify.mjs`) |
| Neon staging branch clone (separate DB for staging) | ❌ **MISSING** — preview uses Vercel env but not a Neon branch clone |
| Smoke test scope (full app vs. contracts-only) | ⚠️ **PARTIAL** — only leasing contracts are covered |

**Deploy safety rating: 7/10**  
The pipeline is substantially safer than a raw single-job deploy. The two
remaining gaps are (a) no isolated Neon staging branch and (b) limited smoke
coverage.

---

## 7. Residual Risks & Recommended Next Steps

### 7.1 App.tsx Monolith Remains Large

Despite successful extraction of 4 713 lines worth of hook logic across 8
dedicated modules, App.tsx is still 14 559 lines. The remaining hook count
(445 React hooks) and inline responsibilities listed in §2 represent the
highest-priority cleanup work.

**Recommended next:**
- Extract IBGE states/cities/distribuidoras ANEEL loading into
  `src/features/geo/useGeoState.ts`.
- Extract UF/tariff state (`ufTarifa`, `distribuidoraTarifa`, `tarifaCheia`,
  `mesReajuste`) into `src/features/simulacoes/useTarifaState.ts`.
- Extract `settingsTab` into `src/features/settings/useSettingsNav.ts`.
- Move `TarifaInput` sub-component to `src/components/TarifaInput.tsx`.

### 7.2 Bundle Size

The main JS chunk is 1 477 kB (minified). Route-level code-splitting with
`React.lazy` / dynamic `import()` for heavy pages (Simulações, CRM,
Financial Management) would bring the initial payload under 500 kB.

### 7.3 RLS Fail-Closed Hardening

`createUserScopedSql` has a graceful fallback when RLS context cannot be
applied. This is a latent security risk. The recommended hardening is to
throw a `503 Database context unavailable` error instead of silently
falling back to raw SQL for authenticated endpoints.

### 7.4 Smoke Test Coverage

`smoke-contracts-leasing.mjs` only validates the leasing contract PDF path.
Critical paths not covered: proposal save/load, client creation, portfolio
summary, storage round-trip, financial projections.

### 7.5 Neon Staging Branch Clone

The staging job deploys to a Vercel preview environment but runs against the
same database environment variables pulled by `vercel pull`. There is no
isolated Neon branch clone. A schema migration bug in staging would still
affect shared data.

### 7.6 `handler.js` Inline Rate Limiter

`server/handler.js` contains a bespoke in-memory rate limiter (used for
auth and admin endpoints) that is separate from the `withRateLimit` HOF in
`server/middleware/`. This is a duplication risk. Consolidating behind
`withRateLimit` would reduce maintenance surface.

---

## 8. Architecture Scores

| Dimension | Score | Rationale |
|---|---|---|
| **UI/UX changeability** | **6 / 10** | AppShell (104 lines), PageRenderer (58 lines), and 8 feature modules are well-isolated. However, App.tsx at 14 559 lines with 445 hooks is still the critical change surface. Any work touching tariffs, IBGE, or theme requires navigating the monolith. |
| **Backend modularity** | **9 / 10** | 27 route modules, clean middleware HOF chain, response layer abstraction, router with exact/param matching, pure adapters. `handler.js` duplication of rate limiter is the only notable gap. |
| **DB/schema safety** | **8 / 10** | 67 additive migrations, migration safety scanner, `IF NOT EXISTS` guards, soft-delete, pure adapters bridging schema evolution, no destructive patterns detected. RLS fallback (not fail-closed) prevents a 10. |
| **Deploy safety** | **7 / 10** | Split staging/production workflow, migration scanner, pre-deploy snapshot, post-deploy verification, GitHub production environment gate. Missing: Neon branch clone for staging, limited smoke test scope. |
| **Regression risk** | **5 / 10** | 2 223 tests passing, no circular deps, clean types. But App.tsx monolith creates a high blast radius for any cross-cutting change. Bundle-size advisory is cosmetic, but indicates poor code-splitting that raises deployment latency on first load. |

---

## 9. READY / NOT READY Conclusion

| Decision | Scope |
|---|---|
| ✅ **READY TO MERGE** | All 5 code-quality gates pass. No blocking issues identified. |
| ⚠️ **NOT READY FOR UNASSISTED CONTROLLED DEPLOY** | Staging DB isolation (Neon branch clone) and fuller smoke coverage are required before relying on the pipeline for production safety without human spot-checks. |

The post-refactor architecture represents a substantial improvement over the
baseline. The backend is production-grade. The frontend has correct
structural bones. The remaining work is incremental cleanup (App.tsx
extraction, code-splitting, RLS hardening) rather than foundational risk.
