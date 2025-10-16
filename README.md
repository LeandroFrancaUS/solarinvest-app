# SolarInvest App

## ANEEL data proxy configuration

The application consults ANEEL's CKAN datasets to fetch distributor information and
energy tariffs. Those endpoints do not send CORS headers, so browsers block direct
requests during development. A lightweight proxy can be enabled in Vite to bypass
that restriction without changing the production build.

1. Create a `.env.local` file in the project root (or use your existing one) with
   the following content:

   ```bash
   VITE_ANEEL_PROXY_BASE=/aneel
   # Optional: override the default target (defaults to https://dadosabertos.aneel.gov.br)
   # VITE_ANEEL_PROXY_TARGET=https://dadosabertos.aneel.gov.br
   ```

2. Start the development server with `npm run dev`. Any request sent to
   `http://localhost:5173/aneel/...` will now be proxied to the ANEEL open-data
   portal.

If you ever need to point the frontend to a different ANEEL mirror or staging
instance without the proxy, you can define `VITE_ANEEL_DIRECT_ORIGIN` with the
desired origin URL. When neither environment variable is present the application
falls back to the public ANEEL endpoints directly.
