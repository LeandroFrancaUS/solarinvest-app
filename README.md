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
