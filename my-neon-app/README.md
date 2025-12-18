# My Neon App

This Vite React app is preconfigured with the Neon Auth UI SDK.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and set `VITE_NEON_AUTH_URL` to your Neon Auth endpoint.
3. Start the development server:
   ```bash
   npm run dev
   ```

## Routes
- `/` – Protected home page that redirects unauthenticated visitors to sign in.
- `/auth/:pathname` – Authentication flow (sign-in/sign-up) handled by Neon components.
- `/account/:pathname` – Account management views such as password reset and session management.
