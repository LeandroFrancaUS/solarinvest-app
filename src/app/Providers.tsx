// src/app/Providers.tsx
import React, { type ReactNode } from "react"
import { StackProvider, StackTheme, useUser } from "@stackframe/react"
import { stackClientApp } from "../stack/client"
import { StackUserContext, StackSdkCrashedContext } from "./stack-context"

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Must be rendered INSIDE <StackProvider>.  Calls useUser() (which may
 * suspend while the SDK validates the session) and publishes the resolved
 * value to StackUserContext so that components higher (or elsewhere) in the
 * tree can read it without needing their own StackProvider context.
 */
function StackUserPublisher({ children }: { children: ReactNode }) {
  const user = useUser()
  return (
    <StackUserContext.Provider value={user}>
      {children}
    </StackUserContext.Provider>
  )
}

// ─── Error boundary ──────────────────────────────────────────────────────────

type BoundaryState = { crashed: boolean }

/**
 * Error boundary specifically around <StackProvider> / <StackTheme>.
 *
 * MetaMask's SES (Secure ECMAScript) lockdown freezes globalThis, which can
 * cause StackProviderClient to throw during React render when it writes
 * `globalThis.__STACK_AUTH__ = { app }`.  StackTheme's BrowserScript also
 * calls `(0, eval)(script)` in a useLayoutEffect, which throws if SES tames
 * eval.  Rather than letting these extension-caused errors bubble up to the
 * top-level Boundary and show "Falhou ao renderizar", we catch them here and
 * fall back to passthrough mode (children rendered without Stack Auth
 * wrapping) so the app remains usable.
 *
 * When crashed, the boundary:
 *  1. Provides StackSdkCrashedContext=true so that guards in RequireAuth,
 *     RequireAuthorizedUser, AccessPendingPage etc. skip Stack hook calls.
 *  2. Provides StackUserContext=null so that useStackUser() returns null
 *     safely everywhere (treating the session as unauthenticated).
 *  3. Renders the raw `fallback` prop (the app children) rather than
 *     re-rendering `this.props.children` (the StackProvider tree) which
 *     would immediately re-crash and escalate to the outer Boundary.
 */
class StackProviderBoundary extends React.Component<
  { children: ReactNode; fallback: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { crashed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.warn(
      "[StackProviderBoundary] Stack Auth provider crashed — falling back to passthrough mode.",
      error,
      info,
    )
  }

  render(): ReactNode {
    if (this.state.crashed) {
      return (
        <StackSdkCrashedContext.Provider value={true}>
          <StackUserContext.Provider value={null}>
            {this.props.fallback}
          </StackUserContext.Provider>
        </StackSdkCrashedContext.Provider>
      )
    }
    return this.props.children
  }
}

// ─── Public provider ─────────────────────────────────────────────────────────

export function Providers({ children }: { children: ReactNode }) {
  if (!stackClientApp) {
    // Stack Auth not configured (missing env vars) — passthrough for dev/bypass mode.
    // StackUserContext default (null) and StackSdkCrashedContext default (false) apply.
    return <>{children}</>
  }

  return (
    <StackProviderBoundary fallback={children}>
      <StackProvider app={stackClientApp}>
        <StackTheme>
          {/*
           * StackUserPublisher calls useUser() which may suspend while the SDK
           * validates the session.  The Suspense boundary here prevents the
           * suspension from propagating above StackProvider where there is no
           * other Suspense ancestor.  The null fallback (blank screen) is
           * intentional — RequireAuth shows its own loading spinner once the
           * tree below this point renders.
           */}
          <React.Suspense fallback={null}>
            <StackUserPublisher>
              {children}
            </StackUserPublisher>
          </React.Suspense>
        </StackTheme>
      </StackProvider>
    </StackProviderBoundary>
  )
}
