# Vercel Deployment Risk Audit (Refresh)

Date: 2026-03-27  
Repository: `solarinvest-app`

## Scope audited

- Vercel config and routing: `vercel.json`
- Runtime entrypoints: `api/index.js`, `server/handler.js`
- Build/runtime constraints: `package.json`
- Heavy endpoints: `server/contracts.js`
- API structure consistency: `api/**`

---

## Risk scorecard

| ID | Risk | Severity | Likelihood | Impact | Priority |
|---|---|---|---|---|---|
| R1 | Broad rewrite of `/api/:path*` to `/api` | High | High | High | P0 |
| R2 | Non-deterministic install with `npm install --legacy-peer-deps` | Medium | High | Medium | P1 |
| R3 | Node engine pinned to `24.x` (non-LTS strategy risk) | Medium | Medium | Medium | P1 |
| R4 | Heavy document generation without explicit function limits | Medium | Medium | High | P1 |
| R5 | CSP allows `unsafe-inline` and `unsafe-eval` for scripts | Medium | Medium | High | P1 |
| R6 | Route organization drift (`/api/api/*`) | Low | Medium | Medium | P2 |

---

## Findings and evidence

### R1) Rewrite strategy can hide file-based API routes (High)

Current rewrite rules send every `/api/:path*` request to `/api`.

- Strength: central handler pattern is clear (`api/index.js` delegates to `server/handler.js`).
- Risk: route files under `api/` may be unintentionally bypassed or become ambiguous in behavior.

**Evidence**

- `vercel.json` rewrite: `/api/:path* -> /api`
- `api/index.js` central dispatch entrypoint
- Multiple additional route files under `api/` (e.g. contracts/clients/auth)

**Why this matters in production**

- Adds coupling between Vercel routing and custom in-app router.
- Increases chance of regressions when teams add file-based routes expecting native Vercel matching.

**Mitigation (choose one model)**

1. **File-based model (recommended for clarity):** remove broad `/api/:path*` rewrite.
2. **Central-router model:** keep rewrite, but remove competing route files and document architecture explicitly.

---

### R2) Install command weakens reproducibility (Medium)

Current install uses:

```json
"installCommand": "npm install --legacy-peer-deps"
```

**Risk**

- `npm install` is less deterministic than `npm ci` in CI/CD.
- `--legacy-peer-deps` can hide peer conflicts until runtime.

**Mitigation**

- Prefer `npm ci`.
- Remove `--legacy-peer-deps` after resolving peer conflicts.
- Keep lockfile authoritative and CI-enforced.

---

### R3) Node engine strategy is aggressive (`24.x`) (Medium)

`package.json` pins Node to `24.x`.

**Risk**

- Teams typically see lower deployment risk with LTS pinning.
- Ecosystem/tooling compatibility may lag on newest major versions.

**Mitigation**

- Pin to org-approved LTS major for Vercel deployments.
- If staying on 24.x, add CI matrix and deployment smoke tests in the same major.

---

### R4) Heavy contract generation paths lack explicit Vercel limits/tuning (Medium)

Contract rendering/template processing runs in API runtime and manipulates template files and ZIP/docx payloads.

**Risk**

- Timeout/memory failures under burst or large payload scenarios.

**Mitigation**

- Add per-function runtime tuning (`maxDuration`, memory, region).
- Add latency/error SLOs + alarms for contract endpoints.
- Consider asynchronous queueing for peak workloads.

---

### R5) CSP script policy is permissive (Medium/Security)

Global CSP currently includes `unsafe-inline` and `unsafe-eval` for scripts.

**Risk**

- Increases XSS blast radius.
- Can conflict with stricter security/compliance targets.

**Mitigation**

- Move to nonce/hash-based script policy.
- Remove `unsafe-eval` unless explicitly required.
- Roll out with `Content-Security-Policy-Report-Only` first.

---

### R6) API path layout suggests drift (`api/api/customers`) (Low)

A nested route path currently maps to `/api/api/customers`.

**Risk**

- Higher chance of incorrect client calls and maintenance confusion.

**Mitigation**

- Normalize route tree (e.g., `api/customers/index.js`) unless doubled prefix is intentional.
- Add route contract tests/smoke tests.

---

## 48-hour hardening plan

### Day 0 (quick wins)

1. Decide API routing model and align `vercel.json` accordingly.
2. Switch deployment install to `npm ci`.
3. Add post-deploy smoke checks for:
   - `/health`
   - `/api/health/db`
   - `/api/contracts/templates`

### Day 1

4. Add function runtime tuning for expensive endpoints.
5. Add structured logging fields (`route`, `durationMs`, `requestId`, `status`).

### Day 2

6. Start CSP tightening in report-only mode.
7. Add alerting on 5xx rate and p95 latency for API/contract routes.

---

## Validation run during this audit

- `npm run build` completed successfully.
- Build warnings observed (large chunks and warnings on named exports) and should be tracked as operational debt.

