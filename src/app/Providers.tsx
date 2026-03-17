// src/app/Providers.tsx
import type { ReactNode } from "react"
import { AuthSessionProvider } from "../auth/AuthSessionContext"
import { stackClientApp } from "../stack/client"

// Lazily import Stack Auth provider — only when the client is configured.
// This avoids a crash when env vars are missing in development.
let StackProvider: React.ComponentType<{ app: NonNullable<typeof stackClientApp>; children: ReactNode }> | null = null
let StackTheme: React.ComponentType<{ children: ReactNode }> | null = null

try {
  // Dynamic require so the module can still load even if the package is absent
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const stackModule = require("@stackframe/react") as {
    StackProvider: NonNullable<typeof StackProvider>
    StackTheme: NonNullable<typeof StackTheme>
  }
  StackProvider = stackModule.StackProvider
  StackTheme = stackModule.StackTheme
} catch {
  // @stackframe/react not available — auth will run in bypass mode
}

export function Providers({ children }: { children: ReactNode }) {
  const inner = <AuthSessionProvider withStackBridge={Boolean(stackClientApp && StackProvider && StackTheme)}>{children}</AuthSessionProvider>

  if (stackClientApp && StackProvider && StackTheme) {
    return (
      <StackProvider app={stackClientApp}>
        <StackTheme>{inner}</StackTheme>
      </StackProvider>
    )
  }
  // Auth not configured — render children directly (dev / bypass mode)
  return inner
}


