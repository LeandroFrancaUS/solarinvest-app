// src/app/stack-context.tsx
//
// ⚠️  IMPORTANT: This file must have ZERO local imports (only 'react' and
// '@stackframe/react').  It is deliberately kept as a leaf module so that
// Vite/Rollup can always initialize it before any other local module, avoiding
// the TDZ "Cannot access '<name>' before initialization" error that would
// arise if this module were bundled together with heavier app modules that
// import from it.
//
// Other files should import useStackUser / useStackSdkCrashed from here
// rather than from Providers.tsx.

import { createContext, useContext } from "react"
import { useUser } from "@stackframe/react"

// ─── StackUser context ───────────────────────────────────────────────────────

/**
 * The current Stack Auth user published from inside <StackProvider> by
 * StackUserPublisher (defined in Providers.tsx).
 *
 * Returns null when the SDK is unavailable (not configured or crashed) or
 * when the user is not signed in.  Reading this context never throws — it is
 * always safe to call, even outside a StackProvider.
 *
 * Default value is null (SDK not configured / not yet mounted).
 */
type StackUser = ReturnType<typeof useUser>

export const StackUserContext = createContext<StackUser>(null)

/**
 * Safe hook that reads the current Stack Auth user from context.
 * Never throws; returns null when Stack Auth is not available or the user
 * is not signed in.
 */
export function useStackUser(): StackUser {
  return useContext(StackUserContext)
}

// ─── StackSdkCrashed context ─────────────────────────────────────────────────

/**
 * True when StackProviderBoundary (in Providers.tsx) caught an error from
 * <StackProvider> / <StackTheme> and the app is running without Stack Auth
 * context.  Components that call Stack hooks MUST check this before doing so.
 *
 * Default value is false (SDK not yet known to have crashed).
 */
export const StackSdkCrashedContext = createContext(false)

/**
 * Safe hook that returns true when the Stack Auth SDK crashed during
 * provider initialisation (e.g. wallet-extension SES lockdown).
 * Components should skip all Stack hook calls when this returns true.
 */
export function useStackSdkCrashed(): boolean {
  return useContext(StackSdkCrashedContext)
}
