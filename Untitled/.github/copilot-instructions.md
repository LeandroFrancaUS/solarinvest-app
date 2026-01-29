# Copilot instructions for this repo

This project is a Vite + React + TypeScript single-page app for the SolarInvest website. Use these guardrails to work effectively and avoid pitfalls.

## Architecture and key files
- Entry and bootstrapping
  - `index.html` mounts the app at `#root`.
  - `src/main.tsx` creates the React root and renders `App`.
  - `src/App.tsx` wires top-level layout and routes (if any).
- Components and styles
  - `src/components/*` holds presentational and small stateful components.
  - `src/styles.css` contains global styles; prefer component-level styles where practical.
- Config and constants
  - `src/Config.tsx` centralizes site-wide constants (branding, contact, feature toggles, and/or API base URLs). Import from components rather than hardcoding.
- Tooling
  - `vite.config.ts` contains dev/build config.
  - `tsconfig.json` defines TS paths and compiler options.
  - `public/` contains static assets served at the site root.

Example usage pattern
```tsx
// src/components/Hero.tsx
import React from 'react'
import { /* brandColor, phone, apiBase, etc. */ } from '../Config' // use Config.tsx exports

export function Hero() {
  return (
    <section>
      <h1>SolarInvest</h1>
      {/* Use site-wide values from Config instead of literals */}
    </section>
  )
}
```

## Dev workflows (npm)
- Install deps
  - If a lockfile exists, prefer: `npm ci`
  - Otherwise: `npm install`
- Start dev server with HMR: `npm run dev`
- Build production bundle: `npm run build`
- Preview local production build: `npm run preview`

Notes
- Vite uses environment variables with the `VITE_` prefix. Define them in `.env.local` or `.env` and access via `import.meta.env`.
  - Example: `.env.local` → `VITE_API_BASE=https://api.example.com`
  - Usage: `const base = import.meta.env.VITE_API_BASE`
- Keep client-only secrets out of the repo and `Config.tsx`. Anything shipped to the client is public.

## Conventions and patterns in this codebase
- Components are functional `.tsx` files using React hooks.
- Use PascalCase for component files (`MyComponent.tsx`) and camelCase for variables/props.
- Prefer lifting shared state to the closest common parent. Cross-component data flows via props; avoid implicit globals.
- Co-locate simple helpers with the component that uses them; promote to `src/components/` or a shared utils folder only when reused.
- Static assets belong in `public/` and are referenced with absolute `/` paths at runtime.

## Integration points
- App-level configuration is read from `src/Config.tsx` and `import.meta.env`. Check these first when adding new content, toggles, or endpoints.
- If calling APIs, compose URLs from `VITE_*` vars and/or values exported by `Config.tsx`; do not hardcode full URLs in components.

## What to do when adding features
- Create new UI under `src/components/` and import into `App.tsx` (or an existing section) via relative paths.
- Read constants and any endpoints from `Config.tsx` and `import.meta.env`.
- Verify `npm run build` is clean and the component renders in `npm run dev`.

## File map reference (examples)
- `src/main.tsx` — React bootstrap
- `src/App.tsx` — top-level layout
- `src/Config.tsx` — global config/constants
- `src/components/*` — reusable UI units
- `src/styles.css` — global styles
- `vite.config.ts`, `tsconfig.json` — tooling config
- `public/*` — static files

---
Unclear or missing pieces to confirm
- No automated tests detected; confirm if a test runner exists (Vitest/Jest) before generating tests.
- Routing not confirmed (React Router vs. single-page sections). Point me to the router setup if present.
- If there are additional envs (staging/prod) or deployment scripts, share their locations and I’ll incorporate them here.