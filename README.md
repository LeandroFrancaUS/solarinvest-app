# SolarInvest App

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

## Stack Auth integration

When a Stack Auth project is configured the `/api/storage` endpoint now
requires authenticated requests using a Bearer token signed by Stack Auth. The
server validates the JWT against the project's JWKS document and rejects
unauthorized calls with HTTP 401.

Set the following environment variables:

- `NEXT_PUBLIC_STACK_PROJECT_ID` – Stack Auth project identifier.
- `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` – publishable key used by the
  frontend client.
- `STACK_SECRET_SERVER_KEY` – secret server key (required by Stack SDKs).
- `STACK_JWKS_URL` – JWKS URL published by Stack Auth.
- `TRUSTED_WEB_ORIGINS` – comma-separated list of allowed origins for CORS. If
  omitted the server trusts the default Vite dev URLs.

Example `.env` snippet based on the current SolarInvest deployment:

```
NEXT_PUBLIC_STACK_PROJECT_ID=deead568-c1e6-436c-ba28-85bf3fbebef5
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=pck_1t1r87ap8bbrdb9bf42fbzzqr27h7969s6vd3kha76gdr
STACK_SECRET_SERVER_KEY=ssk_0n5r6c4rjgc6rdx0ymt2kt0bfnp8vv9626f6crjsnypcg
STACK_JWKS_URL=https://api.stack-auth.com/api/v1/projects/deead568-c1e6-436c-ba28-85bf3fbebef5/.well-known/jwks.json
TRUSTED_WEB_ORIGINS=https://app.solarinvest.info
DATABASE_URL=postgresql://neondb_owner:npg_Y6Hrql3hWOum@ep-damp-mouse-ac5zr9v1-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
```
