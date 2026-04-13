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

Before submitting large refactors, run `npm run check:prod` to validate circular
dependencies and production builds.

Note: Vercel installs currently use `npm install --legacy-peer-deps` while we
align Stackframe peer dependencies with React 18.

## Neon PostgreSQL storage

The app persists CRM data and workspace preferences in a Neon PostgreSQL database.

Required variables:
- `DATABASE_URL` (**preferred / padrão oficial**, pooled)
- `DATABASE_URL_UNPOOLED` (optional, only for direct/admin use such as migrations)

Legacy fallback (optional, not required for boot):
- `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `PGPORT`

Test locally with:

```bash
npm run test:neon
```

Vercel/Neon deployment notes:
- When adding DB env vars in Vercel, select the correct environment (`Production` for live).
- Serverless runtime should use the pooled URL (`DATABASE_URL`, hostname with `-pooler`).
- Preview deployments automatically receive branch-specific `DATABASE_URL` values from Neon integration.
- Production deployments automatically receive production `DATABASE_URL`.
- Keep credentials server-side only; never expose Neon secrets in browser code.

---

## Stack Auth integration

Authentication uses **Stack Auth** (`@stackframe/react`).

### Required frontend env vars (Vercel → Settings → Environment Variables)
- `VITE_STACK_PROJECT_ID` — found in Stack Auth dashboard → Project → API Keys (the Project ID field)
- `VITE_STACK_PUBLISHABLE_CLIENT_KEY` — found in Stack Auth dashboard → Project → API Keys (the Publishable Client Key field)

### Required backend env vars
- `STACK_PROJECT_ID` — same value as `VITE_STACK_PROJECT_ID` (the Server-side duplicate; `VITE_*` is used as fallback but the server-side name is preferred)
- `STACK_SECRET_SERVER_KEY` — found in Stack Auth dashboard → Project → API Keys (the **Secret Server Key** field). **⚠️ This key must match the project ID exactly.** If you see `INVALID_SECRET_SERVER_KEY` in server logs, the key has been rotated or copied from the wrong project — regenerate it in the dashboard and update the Vercel env var.

### Optional backend vars
- `STACK_JWKS_URL` — auto-derived from `STACK_PROJECT_ID` if omitted; only set manually if using a custom Stack Auth instance
- `TRUSTED_WEB_ORIGINS` — comma-separated list of allowed origins for CORS (defaults include `https://app.solarinvest.app` and `http://localhost:5173`)

### Bootstrap permission env vars (optional — have built-in defaults)
These control which users automatically receive certain Stack Auth permissions on first login:
- `BOOTSTRAP_COMERCIAL_EMAILS` — comma-separated list of emails to auto-grant `role_comercial`. Defaults to `laienygomes1@gmail.com,cmdosanjos123@gmail.com`.
- `BOOTSTRAP_OFFICE_EMAILS` — comma-separated list of emails to auto-grant `role_office`. Defaults to `laienygomes1@gmail.com`.

### Getting your Stack Auth credentials
1. Log in at https://app.stack-auth.com
2. Select your project (or create one)
3. Navigate to **API Keys**
4. Copy the **Project ID**, **Publishable Client Key**, and **Secret Server Key**
5. Set them as Vercel environment variables and redeploy

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
