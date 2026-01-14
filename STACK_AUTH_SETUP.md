# Stack Auth Setup Guide for SolarInvest (Vite SPA)

This guide walks you through setting up Stack Auth for the SolarInvest application running as a Vite Single Page Application (SPA).

## Prerequisites

- Node.js 24.x installed (see `.nvmrc`)
- A Stack Auth account and project created at [Stack Auth Dashboard](https://app.stack-auth.com/)
- Access to your Vercel project settings (for production deployment)

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

This installs `@stackframe/react` (v2.8.58) which is the correct package for Vite/React SPAs.

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Stack Auth credentials:

```env
VITE_STACK_PROJECT_ID=64612256-cc00-4e29-b694-d3944808e1a1
VITE_STACK_PUBLISHABLE_CLIENT_KEY=pck_your_actual_key_here
```

**Where to find these values:**
- Go to [Stack Auth Dashboard](https://app.stack-auth.com/)
- Select your `solarinvest-app` project
- Navigate to Project Settings
- Copy the Project ID and Publishable Client Key

### 3. Configure Redirect URLs in Stack Dashboard

In the Stack Auth Dashboard for your project, configure the allowed redirect URLs:

**Development URLs:**
- `http://localhost:5173`
- `http://localhost:5173/*`
- `http://localhost:5173/auth/callback` (if using OAuth callback)

**Production URLs:**
- `https://app.solarinvest.info`
- `https://app.solarinvest.info/*`
- `https://app.solarinvest.info/auth/callback` (if using OAuth callback)

**Steps:**
1. Go to Stack Dashboard → your project → Settings
2. Find "Redirect URLs" or "Allowed Callback URLs"
3. Add all the URLs listed above
4. Save changes

### 4. Configure Authentication Methods

In Stack Dashboard, enable the authentication methods you want to use:

- **OAuth Providers:** Google, GitHub, etc.
- **Email/Password:** For traditional login
- **Magic Links:** For passwordless login

For this app, we currently support:
- **Google OAuth** (primary method)

### 5. Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 6. Test the Auth Flow

1. Open `http://localhost:5173` in your browser
2. You should see a loading screen, then a login prompt
3. Click "Entrar com Google" (or configured auth method)
4. Complete the OAuth flow
5. You should be redirected back and logged in

## Production Deployment (Vercel)

### 1. Configure Environment Variables in Vercel

Go to your Vercel project dashboard:

1. Navigate to **Settings** → **Environment Variables**
2. Add the following variables:

```
VITE_STACK_PROJECT_ID = 64612256-cc00-4e29-b694-d3944808e1a1
VITE_STACK_PUBLISHABLE_CLIENT_KEY = pck_your_actual_key_here
```

3. Make sure to apply these to all environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development (if using Vercel Dev)

**Optional (for backward compatibility):**
```
NEXT_PUBLIC_STACK_PROJECT_ID = 64612256-cc00-4e29-b694-d3944808e1a1
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY = pck_your_actual_key_here
```

### 2. Trigger a Redeploy

After adding environment variables:

1. Go to **Deployments** tab
2. Click the three dots on the latest deployment
3. Select **Redeploy**
4. ✅ Check "Use existing Build Cache" (optional, for faster builds)

**Important:** Vite injects environment variables at build time, so you MUST redeploy for changes to take effect.

### 3. Verify Production Setup

1. Visit `https://app.solarinvest.info`
2. Test the login flow
3. Check browser console for any errors
4. Verify session persists after page refresh

## Architecture Overview

### File Structure

```
src/
├── stack/
│   └── client.ts          # Stack client initialization
├── app/
│   ├── Providers.tsx      # Auth provider wrapper
│   └── Routes.tsx         # Route configuration
├── pages/
│   └── SignInPage.tsx     # Standalone login page (optional)
└── main.tsx               # App entry point
```

### How It Works

1. **`src/stack/client.ts`**: Creates the Stack client app instance with your project credentials
2. **`src/app/Providers.tsx`**: Wraps the app with `StackProvider` and implements `AuthGate`
3. **`AuthGate` component**: 
   - Uses `useUser()` hook from Stack React
   - Shows loading state while session resolves
   - Shows login UI if no user
   - Renders app content if user is logged in
4. **`src/main.tsx`**: Boots the app with the providers

### Authentication Flow

```
User visits app
    ↓
Providers.tsx loads
    ↓
StackProvider initializes
    ↓
AuthGate checks session
    ↓
┌─────────────┬──────────────┐
│ No session  │ Has session  │
↓             ↓
Login UI      App content
```

## Troubleshooting

### Issue: App shows "Stack Auth não configurado"

**Cause:** Environment variables are missing or not loaded.

**Solution:**
- Check that `.env.local` exists and has the correct values
- Restart `npm run dev` after changing `.env.local`
- Verify variable names start with `VITE_` (not `NEXT_PUBLIC_`)

### Issue: Login button does nothing

**Cause:** Redirect URLs not configured in Stack Dashboard.

**Solution:**
- Go to Stack Dashboard → Settings → Redirect URLs
- Add your local and production URLs
- Make sure OAuth provider (e.g., Google) is enabled

### Issue: "Cannot use 'in' operator" error

**Cause:** Incorrect usage of Stack SDK hooks.

**Solution:**
- This should be fixed in the current implementation
- Make sure you're using `useUser({ or: 'return-null' })` correctly
- Check that hooks are only called inside components wrapped by `StackProvider`

### Issue: Session doesn't persist after refresh

**Cause:** Cookies or token storage not working.

**Solution:**
- Check browser console for storage errors
- Verify your domain is correct in Stack Dashboard
- Clear browser storage and try again
- Check that third-party cookies are not blocked

### Issue: Vercel deployment works locally but not in production

**Cause:** Environment variables not set in Vercel or build cache issue.

**Solution:**
1. Double-check environment variables in Vercel dashboard
2. Make sure they're applied to Production environment
3. Redeploy with cache cleared
4. Check deployment logs for build errors

### Issue: CSP (Content Security Policy) errors

**Cause:** Overly restrictive CSP headers blocking Stack Auth scripts.

**Solution:**
- Check for CSP configuration in `server/index.js` or `vercel.json`
- Add Stack Auth domains to allowed sources:
  ```
  script-src 'self' https://*.stack-auth.com
  connect-src 'self' https://*.stack-auth.com
  ```
- **Note:** Avoid using `unsafe-eval` if possible

## API Reference

### useUser Hook

```typescript
import { useUser } from "@stackframe/react"

// In a component:
const user = useUser({ or: 'return-null' })

if (!user) {
  return <div>Not logged in</div>
}

// User is available
console.log(user.primaryEmail)
```

### useStackApp Hook

```typescript
import { useStackApp } from "@stackframe/react"

// In a component:
const app = useStackApp()

// Sign in
await app.signInWithOAuth("google")

// Sign out
await app.signOut()
```

## Security Best Practices

1. **Never commit secrets:** Keep `.env.local` in `.gitignore`
2. **Use publishable keys only:** The `pck_` key is safe for client-side code
3. **Secret keys stay server-side:** Never expose `sck_` keys in frontend
4. **Configure CORS properly:** Use Stack Dashboard to restrict allowed origins
5. **Enable MFA:** Consider enabling multi-factor authentication for admin accounts

## Support & Resources

- [Stack Auth Documentation](https://docs.stack-auth.com/)
- [Stack Auth React SDK Reference](https://docs.stack-auth.com/sdk/react)
- [SolarInvest Internal Docs](./README.md)

## Changelog

- **2026-01-14**: Migrated from `@stackframe/stack` (Next.js) to `@stackframe/react` (Vite SPA)
- **2026-01-14**: Updated authentication flow to use proper hooks
- **2026-01-14**: Added comprehensive setup documentation
