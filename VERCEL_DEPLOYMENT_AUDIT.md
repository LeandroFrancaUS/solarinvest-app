# Vercel Deployment Risk Audit

Date: 2026-03-27
Scope: `/workspace/solarinvest-app`

## Executive summary

This repository is **close to deployable on Vercel**, but there are several configuration and runtime risks that could cause reliability, security, or operability issues in production.

Top risks:

1. **Broad rewrite of all `/api/*` traffic to `/api`** can create route ambiguity and hide file-based functions.
2. **Node engine pinned to `24.x`** may be incompatible with some CI/runtime expectations and is higher-risk than an LTS pin.
3. **Install command uses `npm install --legacy-peer-deps`** (non-deterministic + weaker dependency safety).
4. **Long-running document generation paths** have no explicit Vercel function runtime limits configured.
5. **CSP allows `unsafe-inline` and `unsafe-eval`** for scripts (XSS blast radius).

---

## Findings

### 1) API rewrite strategy can mask file-based serverless routes (High)

- `vercel.json` rewrites every `/api/:path*` to `/api`. This means requests for specific serverless files can be funneled through a single handler unexpectedly.
- The repo currently has many API route files under `api/` (e.g. `api/contracts/render.js`, `api/clients/[id].js`), but rewrite behavior centralizes all traffic through `api/index.js` + `server/handler.js`.

**Why this is risky on Vercel**

- Mixed routing models (file-based serverless + central rewritten router) are easy to misconfigure and hard to debug.
- New route files may be added by developers and appear "correct" locally, but never be reached in production.

**Recommended mitigation**

- Choose one model and enforce it:
  - Prefer file-based routes: remove broad `/api/:path* -> /api` rewrite.
  - Or central router only: remove/relocate extra route files and document that `/api/index.js` owns all API paths.

---

### 2) Node version pin is aggressive (`24.x`) (Medium)

- Root `package.json` pins engines to `node: 24.x`.

**Why this is risky on Vercel**

- Very new major Node versions can lag in ecosystem support and operational tooling.
- Teams often see fewer deployment surprises by pinning to current LTS major.

**Recommended mitigation**

- Pin to a currently supported LTS major for Vercel + dependencies (e.g., `22.x` when verified by your org/runtime policy).
- If staying on `24.x`, add CI matrix coverage and deployment smoke tests that run in the same Node major.

---

### 3) Dependency install path is non-deterministic and permissive (Medium)

- `vercel.json` uses `installCommand: npm install --legacy-peer-deps`.

**Why this is risky on Vercel**

- `npm install` can mutate lockfile resolution across time.
- `--legacy-peer-deps` suppresses peer dependency conflict signals and can mask dependency drift issues.

**Recommended mitigation**

- Use `npm ci` in deployment for reproducibility.
- Remove `--legacy-peer-deps` once peer conflicts are fixed.
- Keep lockfile committed and audited.

---

### 4) PDF/contract generation endpoints may exceed default serverless limits (Medium)

- Contract rendering and template processing are handled in the API runtime (`server/contracts.js`, routed from `server/handler.js`).
- No explicit function `maxDuration`, memory, or region tuning is present in `vercel.json` for these expensive endpoints.

**Why this is risky on Vercel**

- Bursty or large payload conversions can hit timeout/memory limits and fail intermittently.

**Recommended mitigation**

- Add per-function runtime settings (duration/memory/region) for heavy endpoints.
- Add request-size guardrails and observability around conversion latency/failures.
- Consider queueing or async processing for peak loads.

---

### 5) CSP is permissive for scripts (Medium/Security)

- Global header sets `script-src 'self' 'unsafe-inline' 'unsafe-eval'`.

**Why this is risky on Vercel**

- `unsafe-inline` and especially `unsafe-eval` increase XSS exploitability.
- Security posture may fail internal or external compliance checks.

**Recommended mitigation**

- Move to nonce/hash-based CSP for inline scripts.
- Remove `unsafe-eval` unless absolutely required.
- Stage rollout with `Content-Security-Policy-Report-Only` first.

---

### 6) API path naming inconsistency indicates potential routing confusion (Low)

- File path `api/api/customers/index.js` implies externally exposed path `/api/api/customers`.

**Why this is risky on Vercel**

- Doubled path segments are easy for clients to call incorrectly.
- Suggests route organization drift that can create maintenance errors.

**Recommended mitigation**

- Normalize API directory structure (`api/customers/index.js`) unless `/api/api/*` is intentional.
- Add route contract docs and API smoke tests.

---

### 7) Build currently succeeds but surfaces important warnings (Operational)

Observed in `npm run build`:

- Warnings about missing named exports in TS imports.
- Large JS bundles (>500 kB) for main chunks.

**Why this matters for Vercel**

- Not a deployment blocker now, but can cause runtime defects or cold-start/perf regressions over time.

**Recommended mitigation**

- Treat critical Rollup warnings as CI failures.
- Continue code-splitting and bundle budget enforcement.

---

## Suggested hardening checklist

1. Simplify API routing model (single source of truth).
2. Move install to `npm ci` and reduce peer-dep bypasses.
3. Validate Node runtime policy and pin to tested LTS.
4. Add per-endpoint function runtime tuning for heavy operations.
5. Tighten CSP with staged report-only rollout.
6. Add deploy-time smoke tests:
   - `/health`
   - `/api/health/db`
   - `/api/contracts/templates`
   - one authenticated API path
7. Add post-deploy synthetic monitoring + alerting on 5xx and latency percentiles.

