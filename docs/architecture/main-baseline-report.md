# SolarInvest — Baseline Report (PR 01 / Fase 0)

**Mode:** Current Main Mode  
**Date/Time:** 2026-05-03T21:04:40Z  
**Branch:** `copilot/mapear-arquitetura-atual`  
**Commit SHA:** `d4651a3bc499c52b8fc75d6f67b8b1301bfce059`  
**App version:** `2.4.4` (package.json)  
**Node requirement:** 24.x (.nvmrc)

---

## Status

```
BASELINE DOCUMENTED
```

This report records the exact state of the `main` branch gates before any refactoring, modularisation, or fixes begin. No code was modified to produce this document. All gate results below are raw outputs from running the standard quality commands on the current branch.

---

## 1. Gate Results Summary

| Gate | Command | Result | Exit Code |
|---|---|---|---|
| TypeScript | `npm run typecheck` | ❌ FAIL — 422 errors in 83 files | 2 |
| Lint | `npm run lint` | ❌ FAIL — 227 problems (207 errors, 20 warnings) | 1 |
| Tests | `npm run test` | ❌ FAIL — 24 failed / 1486 passed (1510 total) across 15 failed file sets / 83 passing | 1 |
| Circular Deps | `npm run check:cycles` | ✅ PASS — No circular dependencies detected | 0 |
| Build | `npm run build` | ✅ PASS (with warnings) — `built in 30.09s` | 0 |

---

## 2. TypeCheck (`npm run typecheck`)

**Result:** ❌ FAIL  
**Error count:** 422 errors across 83 files

### Top files by error count

| File | Errors |
|---|---|
| `src/App.tsx` | 82 |
| `src/lib/pricing/pricingPorKwp.ts` | 27 |
| `src/pages/ClientPortfolioPage.tsx` | 24 |
| `src/domain/billing/__tests__/monthlyEngine.test.ts` | 20 |
| `src/domain/normas/precheckNormativo.ts` | 17 |
| `src/lib/dashboard/__tests__/alerts.test.ts` | 16 |
| `src/components/CondicoesPagamentoSection.tsx` | 16 |
| `src/utils/reajusteAneel.ts` | 11 |
| `src/lib/budget/budgetUploadPipeline.ts` | 11 |
| `src/components/UcGeradoraTitularPanel.tsx` | 9 |
| `src/pages/FinancialManagementPage.tsx` | 8 |
| `src/lib/import/parsers/generic.ts` | 7 |
| `src/config/sidebarConfig.ts` | 7 |
| `src/components/print/PrintableProposalLeasing.tsx` | 7 |
| `src/components/portfolio/FaturasTab.tsx` | 7 |

### Error categories in `src/App.tsx` (selected)

- `TS2339` — Property does not exist on type (`parametros`, `potenciaCalculadaKwp`, `financiamento`, `closed`, `unitValue`)
- `TS2551` — Property typos (`potencia_sistema_kwp` → `potencia_instalada_kwp`, `system_kwp` → `systemKwp`, `term_months` → `termMonths`)
- `TS2304` — Cannot find name (`PageSharedSettings`, `setOrcamentoVisualizado`, `NormComplianceStatus`, `handleBudgetItemChange`)
- `TS2375` / `TS2379` — `exactOptionalPropertyTypes` violations (undefined assigned to optional but non-undefined properties)
- `TS2739` — Missing required properties (`ClienteDados` missing `consultorId`, `consultorNome`)
- `TS2740` — Type missing 100+ properties from `OrcamentoSnapshotData`
- `TS18047` / `TS18048` — Object possibly null/undefined
- `TS2769` — No overload matches call
- `TS2322` — Various type assignment mismatches

### Config error (tsconfig.json)

```
tsconfig.json:11:5 - error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0.
Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
```

> **Note:** This tsconfig warning appears to be a known deprecation for TS 7.0 and does not block the current build. It did not prevent compilation in the full run.

---

## 3. Lint (`npm run lint`)

**Result:** ❌ FAIL  
**Problems:** 227 (207 errors, 20 warnings)  
**Flag:** `--max-warnings=0` — any warning fails the gate.

### Files with lint problems (30 files)

```
src/App.tsx
src/app/services/serverStorage.ts
src/components/portfolio/FaturasTab.tsx
src/components/portfolio/InvoiceAlertsWidget.tsx
src/domain/billing/clientPaymentStatus.ts
src/domain/billing/paymentStatusEngine.ts
src/domain/conversion/__tests__/resolve-closed-deal-payload.test.ts
src/domain/dashboard/dashboardFinance.ts
src/domain/payments/clientPaymentStatusV2.ts
src/domain/payments/paymentStatus.ts
src/domain/payments/portfolioPaymentAdapter.ts
src/domain/wifi/wifiStatus.ts
src/features/crm/useCrm.ts
src/features/project-finance/__tests__/gfAfComparisonAudit.test.ts
src/features/project-finance/calculations.ts
src/features/simulacoes/AfBaseSistemaPanel.tsx
src/features/simulacoes/AnaliseFinanceiraSection.tsx
src/lib/api/operationalDashboardApi.ts
src/lib/dashboard/__tests__/alerts.test.ts
src/lib/dashboard/alerts.ts
src/lib/dashboard/notifications.ts
src/lib/proposals/__tests__/proposalOriginLink.test.ts
src/pages/ClientPortfolioPage.tsx
src/pages/FinancialAnalysesPage.tsx
src/pages/FinancialManagementPage.tsx
src/pages/OperationalDashboardPage.tsx
src/pages/settings/VendasParametrosInternosSettings.tsx
src/services/clientPortfolioApi.ts
src/services/financialAnalysesApi.ts
```

### Common lint error categories

- `@typescript-eslint/no-unsafe-assignment` — `any` values assigned without type narrowing
- `@typescript-eslint/no-unsafe-member-access` — member access on `any` typed values
- `@typescript-eslint/no-unsafe-return` — return of `any`
- `@typescript-eslint/no-explicit-any` — explicit `any` usage
- `@typescript-eslint/consistent-type-imports` — missing `type` qualifier on import-only types
- `@typescript-eslint/no-unnecessary-type-assertion` — redundant type assertions

> **8 errors and 9 warnings** are auto-fixable with `eslint --fix`.

---

## 4. Tests (`npm run test` / `npx vitest run`)

**Result:** ❌ FAIL  
**Test files:** 15 failed | 83 passed (98 total)  
**Individual tests:** 24 failed | 1486 passed (1510 total)

### Failed test files

```
src/utils/publicAssets.spec.ts
  - resolveDocumentBaseUrl > extracts pathname from document.baseURI

src/__tests__/pdf/parser.spec.ts
  - pdf parser guard rails > extrai itens entre cabeçalho e rodapé da proposta

src/lib/pdf/extractVendas.test.ts
  - parseVendaPdfText — Estrutura utilizada > suporta linhas linearizadas sem espaçamento duplo

src/utils/__tests__/structuredBudgetParser.test.ts
  - parseStructuredBudget > extrai itens principais entre cabeçalho e valor total
  - parseStructuredBudget > ignora linhas de contato e contabiliza itens invalidados

src/components/pdf/__tests__/BentoGrid.test.tsx
  - BentoCard > renders highlight variant
  - BentoCard > renders dark variant
  - BentoCardTitle > renders title with correct styling
  - BentoCardContent > renders content with correct styling
  - Integration > renders complete Bento Grid layout

src/components/print/__tests__/PrintableProposal.test.tsx
  - remove tags e URLs de campos textuais antes de exibir
  - remove URLs e tags HTML em propostas de leasing
  - exibe potência dos módulos a partir do catálogo e autonomia formatada
  - mostra potência dos módulos como indisponível quando não há dados e oculta VPL sem desconto
  - renderiza seções exclusivas de leasing com economia projetada
  - exibe mensalidades para todos os anos configurados no prazo do leasing
  - separa os encargos da distribuidora da mensalidade SolarInvest quando disponível

src/domain/analytics/__tests__/analyticsEngine.test.ts
  - computeDashboardSnapshot > returns a complete snapshot

src/domain/analytics/__tests__/kpis.test.ts
  - computeKPIs > counts closed contracts and computes value KPIs

src/domain/analytics/__tests__/normalizers.test.ts
  - normalizePortfolio > maps a portfolio row to AnalyticsRecord

src/lib/budget/__tests__/budgetUploadPipeline.test.ts
  - handleUpload > processes PNG images via OCR and returns normalized items
  - handleUpload > uses the quick PDF path when text density is high
  - handleUpload > falls back to OCR when PDF text density is low

src/lib/ocr/__tests__/input.test.ts
  - toUint8 > converte File para Uint8Array
```

### Test failure clusters

| Cluster | Failed Tests | Risk Level |
|---|---|---|
| PrintableProposal (print/PDF) | 7 | HIGH — regression sensitive |
| BentoGrid (PDF layout) | 5 | MEDIUM |
| structuredBudgetParser / PDF parser | 3 | MEDIUM |
| analytics domain (KPIs, normalizers, snapshot) | 3 | MEDIUM |
| budgetUploadPipeline / OCR | 3 | LOW (infra-dependent) |
| publicAssets / extractVendas | 2 | LOW |
| OCR input | 1 | LOW |

---

## 5. Circular Dependencies (`npm run check:cycles`)

**Result:** ✅ PASS  
```
No circular dependencies detected.
```

No action needed.

---

## 6. Build (`npm run build`)

**Result:** ✅ PASS (with warnings)  
**Build time:** 30.09s  
**Exit code:** 0

### Build warnings

**Dynamic import conflicts (non-fatal):**

```
(!) src/events/consultantEvents.ts is dynamically imported by src/App.tsx but also
    statically imported by src/features/admin-users/PersonnelManagementTab.tsx —
    dynamic import will not move module into another chunk.

(!) src/components/print/PrintableProposal.tsx is dynamically imported by src/App.tsx,
    src/pages/BudgetSearchPage.tsx but also statically imported by
    src/services/proposalRecordsService.ts — dynamic import will not move module into another chunk.
```

**Chunk size warning:**

```
(!) Some chunks are larger than 500 kB after minification.
    dist/assets/index-CBPYR1Nh.js  1,444.53 kB │ gzip: 368.39 kB
```

### Build output (key assets)

| Asset | Size | Gzip |
|---|---|---|
| `index-CBPYR1Nh.js` (main bundle) | 1,444.53 kB | 368.39 kB |
| `vendor-charts-Dg8vHZZ-.js` | 393.88 kB | 102.74 kB |
| `vendor-react-De9qiMg1.js` | 139.41 kB | 45.05 kB |
| `index-4I95SGzX.css` | 300.61 kB | 49.66 kB |

> The main JS bundle at 1.44 MB (gzip: 368 kB) is a direct consequence of `src/App.tsx` being 21,511 lines. Code splitting in Fase 4 will address this.

---

## 7. Monolith File Sizes

| File | Lines | Risk |
|---|---|---|
| `src/App.tsx` | 21,511 | CRITICAL — 82 TypeScript errors, contains state, logic, modals, render fns |
| `server/handler.js` | 1,681 | HIGH — single if/else dispatcher for 60+ routes |
| `src/pages/ClientPortfolioPage.tsx` | 4,414 | HIGH — second largest page, 24 TS errors |
| `src/pages/FinancialManagementPage.tsx` | 1,237 | MEDIUM |
| `src/pages/SettingsPage.tsx` | 1,065 | MEDIUM |
| `src/store/useLeasingStore.ts` | 532 | LOW (contained) |
| `src/store/useVendaStore.ts` | 483 | LOW (contained) |

---

## 8. Known Blockers

### B1 — TypeCheck: 422 Errors (BLOCKER for merge gates)

The `npm run typecheck` gate fails with 422 errors. The largest concentration is in `src/App.tsx` (82 errors). Many errors stem from:
- `exactOptionalPropertyTypes` strictness in `tsconfig.json` — code was written before this option was enabled
- Missing properties on interface types (`consultorId`, `consultorNome` in `ClienteDados`)
- References to undefined names (`PageSharedSettings`, `handleBudgetItemChange`, `NormComplianceStatus`)
- Property name mismatches due to schema evolution (`system_kwp` vs `systemKwp`, `term_months` vs `termMonths`)

**Impact:** Any future PR merging to `main` must pass typecheck. This must be resolved in Fase 1.

### B2 — Lint: 227 Problems (BLOCKER for merge gates)

The `npm run lint` gate fails due to `--max-warnings=0`. The 20 warnings alone block the gate. Problems span 30 files, concentrated in `any`-typed API response handling and missing type-only imports.

**Impact:** Must be resolved in Fase 1.

### B3 — 24 Failing Tests (BLOCKER for merge gates)

PrintableProposal tests (7), BentoGrid (5), analytics (3), and budgetUploadPipeline (3) all fail. The PrintableProposal failures are the highest risk — they are regression-sensitive components that directly affect proposal rendering.

**Impact:** Must be stabilised in Fase 1/6.

### B4 — Main Bundle at 1.44 MB (non-blocking, performance)

The main JS bundle exceeds 500 kB (Vite's default warning threshold) by nearly 3×. This is expected given the App.tsx monolith. It does not block functionality.

**Impact:** Addressed naturally as Fase 4 extracts features from App.tsx.

---

## 9. Non-Blocking Risks

### R1 — Migration File Numbering Conflicts

Three migration number prefixes are reused (lexicographic sort determines execution order):

```
0045_add_usina_wifi_status.sql   (723 bytes)
0045_projects.sql                (15,860 bytes)

0056_client_invoices.sql         (3,780 bytes)
0056_create_financial_analyses.sql  (383 bytes)

0062_add_wifi_status_column.sql  (404 bytes)
0062_harden_wifi_status_persistence.sql  (2,532 bytes)
```

The migration runner sorts files lexicographically (`files.sort()`). Within each conflicting pair, the order is deterministic by filename, but the numeric intent (`0045a` vs `0045b`) is ambiguous. If these files have already run in production with the current names, renaming them risks re-running them (migration IDs are stored by filename in `schema_migrations`). Requires careful audit before any rename.

**Impact:** Non-blocking today. Must be investigated in Fase 1 (verify production `schema_migrations` state before any rename).

### R2 — Deploy Pipeline: No Staging, No Approval Gate

The `.github/workflows/deploy.yml` workflow is a **single job** that:
1. Checks out `main`
2. Installs deps
3. **Runs migrations directly on production DB** (`DATABASE_URL_UNPOOLED`)
4. Builds with Vercel
5. Deploys to production

There is no:
- Staging clone of the Neon database
- Smoke tests before production
- Manual approval gate separate from the `environment: production` Vercel gate
- Pre/post deploy row count verification
- Rollback step

**Impact:** Any migration failure runs directly against production data. This is the highest operational risk in the codebase. Addressed in Fase 7.

### R3 — RLS Legacy Fallback Path

In `server/database/withRLSContext.js`, there is a documented graceful fallback:

```js
// Graceful fallback: if the driver version does not expose .transaction(),
// log a warning and return raw sql.  The RLS context will not be set but
// application-layer checks still provide a security layer.
if (typeof sql?.transaction !== 'function') {
  console.warn('[rls] sql.transaction not available; RLS context not set for user', safeUserId)
  return sql
}
```

If `sql.transaction` is unavailable, queries execute **without RLS context** (service bypass). The new object-form API is fail-closed, but the fallback path exists.

Additionally, the legacy string-form API (`createUserScopedSql(sql, userId_string)`) sets only `app.current_user_id` but not `app.current_user_role`, so role-based RLS policies are not enforced on that path.

**Impact:** Security risk. Addressed in Fase 2.

### R4 — `zustand` in dependencies but unused

`zustand ^4.5.5` is listed in `package.json` dependencies but the custom `src/store/createStore.ts` (a `useSyncExternalStore` wrapper) is used instead. The Vite build outputs `vendor-zustand-DjArRx9a.js` at 0.09 kB, confirming it is bundled but empty.

**Impact:** Wasted dependency, potential confusion for contributors. Low risk.

### R5 — Duplicate Domain Modules

Two separate files implement `portfolioPaymentAdapter`:
- `src/domain/billing/portfolioPaymentAdapter.ts`
- `src/domain/payments/portfolioPaymentAdapter.ts`

This creates maintenance risk — a fix in one may not be applied to the other.

**Impact:** Medium risk during Fase 6 (tests/domain).

### R6 — PrintableProposalLeasing Duplicate Calculations (3 TODOs)

```
src/components/print/PrintableProposalLeasing.tsx:772 — TODO(F13): migrate calcMensalidadesPorAno
src/components/print/PrintableProposalLeasing.tsx:863 — TODO(F13): migrate calcObterBeneficio
src/components/print/PrintableProposalLeasing.tsx:883 — TODO(F13): migrate calcEconomiaTotalAteAno
```

The print component reimplements billing calculations that already exist in `src/lib/finance/leasingProposal.ts`. Divergence over time means the printed proposal may not match the simulator.

**Impact:** Medium risk. Addressed in Fase 6.

---

## 10. Current Deployment Workflow Assessment

```
.github/workflows/ci.yml (21 lines):
  - Trigger: pull_request + push to main
  - Jobs: lint → typecheck → check:cycles → test → build
  - ⚠️  Currently all gates would FAIL on main (see B1–B3 above)

.github/workflows/deploy.yml (58 lines):
  - Trigger: after ci workflow succeeds + workflow_dispatch
  - Single job: checkout → node 24 → install → db:migrate → build → deploy
  - Environment: production (manual approval via GitHub env)
  - ⚠️  Migrations run directly on DATABASE_URL_UNPOOLED (production)
  - ⚠️  No staging step, no pre/post verification
```

---

## 11. Migration Risk Assessment

| Category | Details | Risk |
|---|---|---|
| Total migrations | 67 `.sql` files in `db/migrations/` | — |
| Down migrations | 1 file: `0002_create_clients.down.sql` | LOW — executed by runner on each run |
| Duplicate prefixes | 3 pairs: `0045`, `0056`, `0062` | MEDIUM |
| Destructive patterns | `DROP POLICY IF EXISTS` (idempotent), no `DROP TABLE`, no `DELETE FROM` data rows | LOW |
| Runner behavior | Wraps each file in `BEGIN/COMMIT`; tracks by filename in `schema_migrations` | — |
| Re-run safety | Files already recorded in `schema_migrations` are skipped | SAFE |

**Key finding:** The runner skips already-applied migrations using `schema_migrations(filename TEXT PRIMARY KEY)`. Renaming a migration file would cause it to run again on the next deployment — this must be verified against production `schema_migrations` before any migration rename is attempted (see Fase 1, task "Investigate duplicate migration prefixes").

---

## 12. `npm audit` Output

Running `npm ci` reported:

```
14 vulnerabilities (4 low, 5 moderate, 5 high)
```

These are supply-chain vulnerabilities in dev/prod dependencies. Full audit details are available via `npm audit`. None have been verified to affect the production runtime path of SolarInvest directly. This baseline does not resolve them — they are documented here for awareness and should be triaged in Fase 1.

---

## 13. Recommendation for PR 02

**PR 02 target: Fase 1a — Fix prazoContratualMeses reset (state sync bug)**

**Rationale:** The most isolated and lowest-risk fix from the Fase 1 plan. It targets a single store function (`leasingActions.reset()` in `src/store/useLeasingStore.ts`) with a well-documented expected behaviour (re-sync `prazoContratualMeses = leasingPrazo * 12` after reset). No schema changes, no API changes, no UI changes.

**Before starting PR 02, note these Fase 1 prerequisites to sequence correctly:**

1. **Typecheck** — 422 errors must be resolved before the `typecheck` gate can be used as a safety check in subsequent PRs. Many are `exactOptionalPropertyTypes` violations that may require a targeted `tsconfig.json` adjustment or systematic fixes across ~83 files. This is the most effort-intensive Fase 1 task.

2. **Lint** — 227 problems across 30 files. Most are `any`-related and auto-fixable (`eslint --fix` covers 8 errors + 9 warnings). The rest require manual fixes.

3. **Failing tests (24)** — The PrintableProposal test failures (7 tests) are the most production-critical. The analytics/normalizer failures (3) may indicate API contract drift. The OCR/budget pipeline failures (3) may be environment-dependent.

4. **Migration duplicate prefixes** — Must be investigated (not renamed) before any migration work.

**Suggested PR 02 scope:**  
Run `eslint --fix` on the auto-fixable lint issues, then manually address the remaining lint problems in the 30 affected files. This is safe (lint fixes do not change runtime behaviour), self-contained, and makes subsequent PRs easier to merge by restoring the lint gate.

---

## Appendix: File Reference

| File | Size | Purpose |
|---|---|---|
| `src/App.tsx` | 21,511 lines | Main application monolith |
| `server/handler.js` | 1,681 lines | Backend route dispatcher |
| `server/index.js` | 9 lines | HTTP server entry point |
| `src/main.tsx` | ~52 lines | React entry point |
| `src/app/Providers.tsx` | ~130 lines | Stack Auth + Error boundary |
| `src/app/Routes.tsx` | ~15 lines | RequireAuth + RequireAuthorizedUser |
| `src/config/sidebarConfig.ts` | ~250 lines | Sidebar groups builder |
| `src/store/createStore.ts` | 104 lines | Custom store (not Zustand) |
| `src/selectors.ts` | ~100 lines | SimulationState selectors |
| `.github/workflows/ci.yml` | 21 lines | CI: lint → typecheck → test → build |
| `.github/workflows/deploy.yml` | 58 lines | Deploy: migrate → build → Vercel |
| `db/migrations/` | 67 files | PostgreSQL migrations (lexicographic order) |
| `scripts/run-migrations.js` | ~200 lines | Migration runner with advisory lock |
