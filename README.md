# SolarInvest App

## Contributing & Stability Rules

⚠️ **Important for contributors**

This project has strict anti-regression and architectural stability rules.

Before making **large changes**, refactors, or touching core flows (proposal, leasing,
normative precheck, PDF generation, storage, auth), you **must** read:

- 📘 **CONTRIBUTING.md** — contribution rules, architecture constraints, and required checks
- 🛡 **Guia SolarInvest Anti-Regressão** — practical guide to avoid TDZ, circular imports, and production crashes

Mandatory before large PRs:

```bash
npm run check:prod
```

PRs that introduce circular dependencies, TDZ errors, or skip this check **will not be merged**.

---

## Requirements

Develop locally with Node.js 24.x (an `.nvmrc` file is provided to pin the version).

---

## ANEEL data proxy

The application consults ANEEL's CKAN datasets to fetch distributor information and
energy tariffs. Those endpoints do not send CORS headers, so browsers block direct
requests. A built-in proxy is now exposed at `/api/aneel`.

- `npm run dev` mounts the proxy middleware inside Vite.
- Production builds serve the same proxy via the Node server.

Advanced configuration:
- Disable proxy: `VITE_ANEEL_PROXY_BASE=`
- Custom mirror: `VITE_ANEEL_DIRECT_ORIGIN=https://example.com`

---

## Testing

Install dependencies:

```bash
npm install
```

Run unit tests:

```bash
npm run test
```

### Production safety check (required for large changes)

```bash
npm run check:prod
```

This ensures:
- No circular dependencies
- No TDZ (Temporal Dead Zone) crashes
- Successful production build

---

## Neon PostgreSQL storage

The app persists CRM data and workspace preferences in a Neon PostgreSQL database.

Required variables:
- `DATABASE_URL` or `DATABASE_URL_UNPOOLED`

Test locally with:

```bash
npm run test:neon
```

---

## Stack Auth integration

Authentication uses **Stack Auth** (`@stackframe/react`).

### Required frontend env vars
- `VITE_STACK_PROJECT_ID`
- `VITE_STACK_PUBLISHABLE_CLIENT_KEY`

### Optional backend vars
- `STACK_SECRET_SERVER_KEY`
- `STACK_JWKS_URL`
- `TRUSTED_WEB_ORIGINS`

---

## PDF conversion for leasing contracts

DOCX templates are converted to PDF using:
- `CONVERTAPI_SECRET` (primary)
- `GOTENBERG_URL` (optional fallback)

Health checks:
```bash
curl /api/health/pdf
curl /api/health/contracts
```

---

## ⚠️ Stability Notice

This application previously suffered production-only crashes caused by:
- Circular imports
- Hook dependency TDZ
- Improper dependency ordering

These are now actively prevented by tooling and conventions.
Always follow `CONTRIBUTING.md`.
