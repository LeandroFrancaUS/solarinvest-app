# Backend Routing Guide

This document describes how HTTP routes are registered and dispatched in the
SolarInvest backend.  It covers the public API of `server/router.js`,
the `registerXRoutes` convention, middleware HOFs, response helpers, and
step-by-step instructions for adding a new route safely.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [createRouter()](#2-createrouter)
3. [registerXRoutes(router, moduleCtx)](#3-registerxroutesrouter-modulectx)
4. [Exact routes vs parameterized routes](#4-exact-routes-vs-parameterized-routes)
5. [reqCtx.params](#5-reqctxparams)
6. [Middleware HOFs](#6-middleware-hofs)
7. [Response helpers](#7-response-helpers)
8. [How to add a new route safely](#8-how-to-add-a-new-route-safely)
9. [Route inventory](#9-route-inventory)

---

## 1. Architecture overview

```
┌──────────────────────────────────────────────┐
│  server/handler.js  (compatibility shim)      │
│  ─ CORS setup                                 │
│  ─ router.match() dispatch                    │
│  ─ OPTIONS fallback                           │
│  ─ static/SPA fallback                        │
└──────────────────────┬───────────────────────┘
                       │ delegates to
                       ▼
┌──────────────────────────────────────────────┐
│  server/router.js   createRouter()            │
│  ─ register(method, path, fn)                 │
│  ─ match(method, pathname)                    │
└──────────────────────┬───────────────────────┘
                       │ populated by
                       ▼
┌──────────────────────────────────────────────┐
│  server/routes/*.js  registerXRoutes()        │
│  ─ health.js   aneel.js   auth.js   …         │
└──────────────────────────────────────────────┘
```

`server/handler.js` is a **compatibility shim**.  All API routes live in
`server/routes/*.js`.  When adding a new endpoint, create (or extend) a route
module in `server/routes/` and wire it up in `handler.js`.  Never add business
logic directly to `handler.js`.

---

## 2. createRouter()

```js
import { createRouter } from '../router.js'
const router = createRouter()
```

`createRouter()` returns a plain object with three members:

| Member | Signature | Purpose |
|--------|-----------|---------|
| `register` | `(method, path, fn) => void` | Register a route handler |
| `match` | `(method, pathname) => Function \| null` | Find the handler for a request |
| `size` | `number` (getter) | Number of registered routes |

Routes registered with `register` are matched by `match` using a two-pass
algorithm (see [§ 4](#4-exact-routes-vs-parameterized-routes)).

---

## 3. registerXRoutes(router, moduleCtx)

Every route module exports a single `registerXRoutes` function.

```js
// server/routes/myFeature.js
export function registerMyFeatureRoutes(router, moduleCtx) {
  const { readJsonBody, getScopedSql } = moduleCtx

  router.register('*', '/api/my-feature', async (req, res, reqCtx) => {
    // …
  })
}
```

### moduleCtx shape

`moduleCtx` is assembled in `handler.js` and contains shared dependencies
injected at startup.  Modules declare only the keys they actually need.

| Key | Type | Provided by |
|-----|------|-------------|
| `readJsonBody` | `(req) => Promise<object>` | handler.js |
| `getScopedSql` | `(actor) => Promise<Sql>` | handler.js (`createHandlerScopedSql`) |
| `storageService` | `StorageService \| null` | handler.js |
| `stackAuthEnabled` | `boolean` | handler.js |
| `databaseClient` | `{ sql } \| null` | handler.js |
| `databaseConfig` | `{ connectionString? }` | handler.js |
| `isConvertApiConfigured` | `() => boolean` | handler.js |
| `isGotenbergConfigured` | `() => boolean` | handler.js |
| `sendJson` | `(res, status, payload) => void` | handler.js |
| `sendNoContent` | `(res) => void` | handler.js |
| `sendServerError` | `(res, status, payload, reqId?, vid?) => void` | handler.js |
| `expireAuthCookie` | `(req, res) => void` | handler.js |
| `isAuthRateLimited` | `(req) => boolean` | handler.js |
| `isAdminRateLimited` | `(req) => boolean` | handler.js |
| `checkFileExists` | `(path: string) => Promise<void>` | handler.js |
| `contractTemplatePath` | `string` | handler.js |

Modules that use `server/response.js` directly (`jsonResponse`, etc.) do not
need `sendJson` / `sendNoContent` from moduleCtx.  Both approaches are valid;
prefer `server/response.js` for new modules.

---

## 4. Exact routes vs parameterized routes

`createRouter` compiles each registered path at startup.  A path is
**parameterized** when it contains one or more `:param` segments (e.g.
`/api/consultants/:id`).  All other paths are **exact**.

Matching uses a **two-pass** algorithm:

1. **Pass 1 — exact paths only.**  Checks whether any registered exact path
   equals `pathname` (strict string comparison, method check).  The first match
   wins immediately.

2. **Pass 2 — parameterized paths.**  If pass 1 finds no match, iterates
   parameterized paths and tests each compiled regex against `pathname`.  The
   first match wins.

**Why this matters:** a more-specific exact path (e.g.
`/api/consultants/picker`) will always be matched before a broader parameterized
pattern (`/api/consultants/:id`), regardless of registration order.

```js
// Exact path — always wins over the /:id pattern below.
router.register('*', '/api/consultants/picker', handlerA)
// Parameterized — only matched when no exact path matched.
router.register('*', '/api/consultants/:id',    handlerB)
```

**Convention:** still register more-specific paths first.  Doing so makes the
intent obvious to readers even though the router guarantees correctness
regardless of order.

---

## 5. reqCtx.params

For parameterized routes, the router extracts captured segments and injects them
as `reqCtx.params` before calling the handler.  The handler signature is
unchanged (`(req, res, reqCtx)`).

```js
// Route registered as '/api/admin/users/:id/permissions/:perm'
router.register('*', '/api/admin/users/:id/permissions/:perm', async (req, res, reqCtx) => {
  const userId = reqCtx.params.id
  const permId = decodeURIComponent(reqCtx.params.perm)
  // …
})
```

`reqCtx` also carries `requestId` and `vercelId` forwarded by `handler.js`.
When `withAuth` middleware is used, it additionally injects `reqCtx.actor`
(see [§ 6](#6-middleware-hofs)).

---

## 6. Middleware HOFs

All middleware lives in `server/middleware/` and is exported from
`server/middleware/index.js`.

```js
import { withAuth, withErrorHandler, withRateLimit } from '../middleware/index.js'
```

Handlers are wrapped outside-in: `withErrorHandler` is the outermost layer.

```js
const handler = withErrorHandler(
  withRateLimit(
    withAuth(innerHandler, { roles: ['admin', 'office'] }),
    { check: isAdminRateLimited },
  ),
)
router.register('*', '/api/my-feature', handler)
```

### withAuth(handler, options?)

Resolves the actor from the request and enforces authentication / role checks.

- Passes OPTIONS through unchanged (no auth on pre-flights).
- Returns **401** when the request is unauthenticated.
- Returns **403** when the actor lacks the required role.
- Injects the resolved actor as `reqCtx.actor`.

```js
options = {
  role:  'admin',               // single required role
  roles: ['admin', 'office'],   // any of the listed roles
}
```

Supported role names: `'admin'`, `'office'`, `'financeiro'`, `'comercial'`.
When no roles are specified, any authenticated user is allowed.

### withRateLimit(handler, options?)

Two modes:

| Mode | Options | Behaviour |
|------|---------|-----------|
| **check** | `{ check: (req) => boolean }` | Delegates to an existing bucket (e.g. the shared `isAdminRateLimited`) |
| **standalone** | `{ limit?: number, windowMs?: number }` | Per-IP sliding window, scoped to this middleware instance.  Defaults: 30 req / 60 s. |

Returns **429** when the limit is exceeded.  OPTIONS pre-flights are never
rate-limited.

### withErrorHandler(handler)

Wraps the handler in a `try/catch`.  Derives the HTTP status from
`error.statusCode` (defaults to 500).  Never leaks raw error messages in
production.  No-ops when `res.headersSent` is already true.

---

## 7. Response helpers

All helpers live in `server/response.js`.

```js
import {
  jsonResponse,
  noContentResponse,
  methodNotAllowedResponse,
  unauthorizedResponse,
  forbiddenResponse,
  tooManyRequestsResponse,
  serviceUnavailableResponse,
  internalErrorResponse,
  errorResponse,
} from '../response.js'
```

| Helper | Status | Notes |
|--------|--------|-------|
| `jsonResponse(res, status, payload, headers?)` | any | Primary JSON sender. No-op if `headersSent`. |
| `noContentResponse(res, headers?)` | 204 | No-op if `headersSent`. |
| `methodNotAllowedResponse(res, allowedMethods)` | 405 | Sets the `Allow` header. |
| `unauthorizedResponse(res, payload?)` | 401 | Default: `{ error: 'Unauthorized' }`. |
| `forbiddenResponse(res, payload?)` | 403 | Default: `{ error: 'Forbidden' }`. |
| `tooManyRequestsResponse(res, payload?)` | 429 | |
| `serviceUnavailableResponse(res, payload?)` | 503 | |
| `internalErrorResponse(res, payload?)` | 500 | |
| `errorResponse(res, error, fallbackMessage?)` | derived | Derives status from `error.statusCode`; safe to use in catch blocks. |

All helpers guard on `res.headersSent` and use `res.statusCode` +
`res.setHeader` + `res.end` (never `res.writeHead`).

---

## 8. How to add a new route safely

Follow these steps to add an endpoint without touching unrelated code.

### Step 1 — choose or create a route module

If the endpoint belongs to an existing domain (e.g. `/api/clients`), add it to
the corresponding `server/routes/clients.js`.  For a new domain, create
`server/routes/myFeature.js`.

### Step 2 — write the handler and register it

```js
// server/routes/myFeature.js
import { jsonResponse, noContentResponse } from '../response.js'

export function registerMyFeatureRoutes(router, moduleCtx) {
  const { readJsonBody } = moduleCtx

  // Exact paths first, then parameterized.
  router.register('*', '/api/my-feature', async (req, res, _reqCtx) => {
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,POST,OPTIONS' }); return }
    if (method === 'GET') {
      jsonResponse(res, 200, { items: [] })
    } else if (method === 'POST') {
      const body = await readJsonBody(req)
      // … business logic …
      jsonResponse(res, 201, { ok: true })
    } else {
      jsonResponse(res, 405, { error: 'Method not allowed' })
    }
  })

  router.register('*', '/api/my-feature/:id', async (req, res, reqCtx) => {
    const id = reqCtx.params.id
    const method = req.method?.toUpperCase() ?? ''
    if (method === 'OPTIONS') { noContentResponse(res, { Allow: 'GET,OPTIONS' }); return }
    if (method !== 'GET') { jsonResponse(res, 405, { error: 'Method not allowed' }); return }
    // … fetch by id …
    jsonResponse(res, 200, { id })
  })
}
```

### Step 3 — wire it in handler.js

```js
// server/handler.js
import { registerMyFeatureRoutes } from './routes/myFeature.js'

// … (in the route registry section) …
registerMyFeatureRoutes(router, { readJsonBody })
```

### Step 4 — wrap with middleware if needed

```js
import { withAuth, withErrorHandler } from '../middleware/index.js'

const protectedHandler = withErrorHandler(withAuth(innerHandler, { role: 'admin' }))
router.register('*', '/api/my-feature', protectedHandler)
```

### Step 5 — write a test

Add `server/__tests__/my-feature-routes.spec.js` following the pattern of an
existing spec (e.g. `health-router.spec.js` or `admin-users-routes.spec.js`).

### Step 6 — run the gates

```bash
npm run lint
npm run typecheck
npx vitest run
npm run build
npm run check:cycles
```

---

## 9. Route inventory

> Auth column legend:
> - **none** — unauthenticated access permitted
> - **CRON_SECRET** — `Authorization: Bearer <CRON_SECRET>` header required
> - **authenticated** — any valid Stack Auth session (resolved actor with userId)
> - **role:admin** — `actor.isAdmin === true`
> - **role:admin|office|financeiro** — any of those flags on the actor
> - **permission:page:financial_analysis** — Stack Auth permission check (when auth is enabled)

### health (`server/routes/health.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `*` | `/health` | none | — | `health-router.spec.js` |
| `*` | `/api/health` | none | — | `health-router.spec.js` |
| `*` | `/api/health/db` | none | — | `health-router.spec.js` |
| `*` | `/api/health/auth` | none | — | `health-router.spec.js` |
| `*` | `/api/health/storage` | none | — | `health-router.spec.js` |
| `*` | `/api/health/pdf` | none | — | `health-router.spec.js` |
| `*` | `/api/health/contracts` | none | — | `health-router.spec.js` |
| `*` | `/api/test` | none | — | `health-router.spec.js` |

### storage (`server/routes/storage.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET PUT POST DELETE` | `/api/storage` | authenticated | RLS-scoped SQL | `storage-router.spec.js` |

### auth (`server/routes/auth.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET` | `/api/auth/me` | none (401 returned when unauthenticated) | auth rate limit | `auth-router.spec.js` |
| `GET` | `/api/authz/me` | authenticated | auth rate limit | `auth-router.spec.js` |
| `POST` | `/api/auth/logout` | none | — | `auth-router.spec.js` |
| `POST` | `/api/internal/auth/reconcile` | role:admin | admin rate limit | `auth-router.spec.js` |
| `POST` | `/api/internal/auth/reconcile/:userId` | role:admin | admin rate limit | `auth-router.spec.js` |
| `GET` | `/api/internal/rbac/inspect` | role:admin | admin rate limit | `auth-router.spec.js` |

### admin users (`server/routes/adminUsers.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET POST` | `/api/admin/users` | role:admin | admin rate limit | `admin-users-routes.spec.js` |
| `POST` | `/api/admin/users/:id/approve` | role:admin | admin rate limit | `admin-users-routes.spec.js` |
| `POST` | `/api/admin/users/:id/block` | role:admin | admin rate limit | `admin-users-routes.spec.js` |
| `POST` | `/api/admin/users/:id/revoke` | role:admin | admin rate limit | `admin-users-routes.spec.js` |
| `POST` | `/api/admin/users/:id/role` | role:admin | admin rate limit | `admin-users-routes.spec.js` |
| `POST DELETE` | `/api/admin/users/:id/permissions/:perm` | role:admin | admin rate limit | `admin-users-routes.spec.js` |
| `DELETE` | `/api/admin/users/:id` | role:admin | admin rate limit | `admin-users-routes.spec.js` |

### database backup (`server/routes/databaseBackup.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `*` | `/api/admin/database-backup` | role:admin | `withErrorHandler(withRateLimit(withAuth(…)))` | `database-backup-route.spec.js` |

### purge cron jobs (`server/routes/purgeDeletedClients.js`, `purgeOldProposals.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET` | `/api/internal/purge-deleted-clients` | CRON_SECRET | — | `purge-deleted-clients.spec.js` |
| `GET` | `/api/internal/purge-old-proposals` | CRON_SECRET | — | `purge-old-proposals.spec.js` |

### ANEEL proxy (`server/routes/aneel.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `*` | `/api/aneel` | none | — | `aneel-route.spec.js` |

### contracts (`server/routes/contracts.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `*` | `/api/contracts/leasing/availability` | none | — | `contracts-routes.spec.js` |
| `*` | `/api/contracts/leasing/smoke` | none | — | `contracts-routes.spec.js` |
| `*` | `/api/contracts/leasing` | permission:page:financial_analysis | — | `contracts-routes.spec.js` |
| `*` | `/api/contracts/render` | permission:page:financial_analysis | — | `contracts-routes.spec.js` |
| `*` | `/api/contracts/templates` | permission:page:financial_analysis | — | `contracts-routes.spec.js` |

### DB info (`server/routes/dbInfo.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `*` | `/api/db-info` | role:admin | — | `db-info-route.spec.js` |

### clients (`server/routes/clients.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `POST` | `/api/clients/upsert-by-cpf` | authenticated | — | `clients-routes.spec.js` |
| `POST` | `/api/clients/bulk-import/preview` | authenticated | — | `clients-routes.spec.js` |
| `POST` | `/api/clients/bulk-import` | authenticated | — | `clients-routes.spec.js` |
| `POST` | `/api/clients/consultor-backfill` | authenticated | — | `clients-routes.spec.js` |
| `GET POST` | `/api/clients` | authenticated | — | `clients-routes.spec.js` |
| `GET` | `/api/clients/:id/proposals` | authenticated | — | `clients-routes.spec.js` |
| `GET PUT DELETE` | `/api/clients/:id` | authenticated | — | `clients-routes.spec.js` |

### proposals (`server/routes/proposals.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET POST` | `/api/proposals` | authenticated | — | `proposals-routes.spec.js` |
| `GET PATCH DELETE` | `/api/proposals/:id` | authenticated | — | `proposals-routes.spec.js` |

### portfolio (`server/routes/portfolio.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `PATCH` | `/api/clients/:clientId/portfolio-export` | authenticated | — | `portfolio-routes.spec.js` |
| `PATCH` | `/api/clients/:clientId/portfolio-remove` | authenticated | — | `portfolio-routes.spec.js` |
| `GET` | `/api/dashboard/portfolio/summary` | authenticated | — | `portfolio-routes.spec.js` |
| `GET` | `/api/client-portfolio` | authenticated | — | `portfolio-routes.spec.js` |
| `GET` | `/api/client-portfolio/:clientId` | authenticated | — | `portfolio-routes.spec.js` |
| `PATCH` | `/api/client-portfolio/:clientId/profile` | authenticated | — | `portfolio-routes.spec.js` |
| `PATCH` | `/api/client-portfolio/:clientId/contract` | authenticated | — | `portfolio-routes.spec.js` |
| `PATCH` | `/api/client-portfolio/:clientId/project` | authenticated | — | `portfolio-routes.spec.js` |
| `PATCH` | `/api/client-portfolio/:clientId/billing` | authenticated | — | `portfolio-routes.spec.js` |
| `PATCH` | `/api/client-portfolio/:clientId/plan` | authenticated | — | `portfolio-routes.spec.js` |
| `GET POST` | `/api/client-portfolio/:clientId/notes` | authenticated | — | `portfolio-routes.spec.js` |

### projects (`server/routes/projects.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET` | `/api/projects/summary` | authenticated | — | `project-routes.spec.js` |
| `POST` | `/api/projects/from-plan/:planId` | authenticated | — | `project-routes.spec.js` |
| `GET PUT` | `/api/projects/:id/finance` | authenticated | — | `project-routes.spec.js` |
| `GET` | `/api/projects` | authenticated | — | `project-routes.spec.js` |
| `GET PATCH` | `/api/projects/:id` | authenticated | — | `project-routes.spec.js` |
| `PATCH` | `/api/projects/:id/status` | authenticated | — | `project-routes.spec.js` |
| `PATCH` | `/api/projects/:id/pv-data` | authenticated | — | `project-routes.spec.js` |

### financial management (`server/routes/financialManagement.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET` | `/api/financial-management/summary` | authenticated | — | `financial-routes.spec.js` |
| `GET` | `/api/financial-management/projects` | authenticated | — | `financial-routes.spec.js` |
| `GET` | `/api/financial-management/cashflow` | authenticated | — | `financial-routes.spec.js` |
| `GET` | `/api/financial-management/categories` | authenticated | — | `financial-routes.spec.js` |
| `GET` | `/api/financial-management/dashboard-feed` | authenticated | — | `financial-routes.spec.js` |
| `GET POST PUT DELETE` | `/api/financial-management/entries` | authenticated | — | `financial-routes.spec.js` |
| `GET POST PUT DELETE` | `/api/financial-management/entries/:id` | authenticated | — | `financial-routes.spec.js` |

### invoices (`server/routes/invoices.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET` | `/api/invoices/notifications` | authenticated | — | `invoices-routes.spec.js` |
| `GET POST` | `/api/invoices/notification-config` | authenticated | — | `invoices-routes.spec.js` |
| `POST` | `/api/invoices/:invoiceId/payment` | authenticated | — | `invoices-routes.spec.js` |
| `GET POST` | `/api/invoices` | authenticated | — | `invoices-routes.spec.js` |
| `PATCH DELETE` | `/api/invoices/:invoiceId` | authenticated | — | `invoices-routes.spec.js` |

### revenue billing (`server/routes/revenueBilling.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET` | `/api/revenue-billing/clients` | authenticated | — | `financial-routes.spec.js` |

### operational tasks (`server/routes/operationalTasks.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET` | `/api/operational-tasks/:taskId/history` | authenticated | — | `operational-tasks-routes.spec.js` |
| `PATCH DELETE` | `/api/operational-tasks/:taskId` | authenticated | — | `operational-tasks-routes.spec.js` |
| `GET POST` | `/api/operational-tasks` | authenticated | — | `operational-tasks-routes.spec.js` |
| `GET POST` | `/api/dashboard/notification-preferences` | authenticated | — | `operational-tasks-routes.spec.js` |

### consultants (`server/routes/consultants.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET` | `/api/consultants/picker` | authenticated | getScopedSql | `personnel-routes.spec.js` |
| `GET` | `/api/consultants/auto-detect` | authenticated | getScopedSql | `personnel-routes.spec.js` |
| `GET POST` | `/api/consultants` | role:admin\|office\|financeiro (read), role:admin (write) | getScopedSql | `personnel-routes.spec.js` |
| `PUT` | `/api/consultants/:id` | role:admin | getScopedSql | `personnel-routes.spec.js` |
| `PATCH` | `/api/consultants/:id/deactivate` | role:admin | getScopedSql | `personnel-routes.spec.js` |
| `POST DELETE` | `/api/consultants/:id/link` | role:admin | getScopedSql | `personnel-routes.spec.js` |

### engineers (`server/routes/engineers.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET POST` | `/api/engineers` | role:admin\|office\|financeiro (read), role:admin (write) | getScopedSql | `personnel-routes.spec.js` |
| `PUT` | `/api/engineers/:id` | role:admin | getScopedSql | `personnel-routes.spec.js` |
| `PATCH` | `/api/engineers/:id/deactivate` | role:admin | getScopedSql | `personnel-routes.spec.js` |

### installers (`server/routes/installers.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET POST` | `/api/installers` | role:admin\|office\|financeiro (read), role:admin (write) | getScopedSql | `personnel-routes.spec.js` |
| `PUT` | `/api/installers/:id` | role:admin | getScopedSql | `personnel-routes.spec.js` |
| `PATCH` | `/api/installers/:id/deactivate` | role:admin | getScopedSql | `personnel-routes.spec.js` |

### personnel import (`server/routes/personnelImport.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `GET` | `/api/personnel/importable-users` | role:admin | getScopedSql | `personnel-routes.spec.js` |
| `GET` | `/api/personnel/importable-clients` | role:admin | getScopedSql | `personnel-routes.spec.js` |

### financial import (`server/routes/financialImport.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `POST` | `/api/financial-import/parse` | authenticated | — | `financial-routes.spec.js` |
| `POST` | `/api/financial-import/confirm` | authenticated | — | `financial-routes.spec.js` |
| `GET` | `/api/financial-import/batches` | authenticated | — | `financial-routes.spec.js` |

### financial analyses (`server/routes/financialAnalyses.js`)

| Method | Path | Auth | Middleware | Test spec |
|--------|------|------|-----------|-----------|
| `*` | `/api/financial-analyses` | authenticated (internal dispatch) | — | `financial-routes.spec.js` |

---

> **Inventory status:** covers all 26 route modules registered in `server/handler.js` as of this document's creation.
> When adding a new module, update both the registration call in handler.js and the table above.
> The canonical source of truth is always the `registerXRoutes` function in each route module.
