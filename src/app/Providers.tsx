// src/app/Providers.tsx
import React, { type ReactNode } from "react"
import { StackProvider, StackTheme } from "@stackframe/react"
import { stackClientApp } from "../stack/client"

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
 */
class StackProviderBoundary extends React.Component<
  { children: ReactNode },
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
      // Render children without Stack Auth wrapping.  The app will operate in
      // bypass/unauthenticated mode rather than showing the error screen.
      return <>{this.props.children}</>
    }
    return this.props.children
  }
}

export function Providers({ children }: { children: ReactNode }) {
  if (!stackClientApp) {
    // Stack Auth not configured (missing env vars) — passthrough for dev/bypass mode
    return <>{children}</>
  }

  return (
    <StackProviderBoundary>
      <StackProvider app={stackClientApp}>
        <StackTheme>
          {children}
        </StackTheme>
      </StackProvider>
    </StackProviderBoundary>
  )
}
