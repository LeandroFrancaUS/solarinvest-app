// src/app/Providers.tsx
import type { ReactNode } from "react"
import { StackProvider, StackTheme } from "@stackframe/react"
import { stackClientApp } from "../stack/client"

export function Providers({ children }: { children: ReactNode }) {
  if (!stackClientApp) {
    // Stack Auth not configured (missing env vars) — passthrough for dev/bypass mode
    return <>{children}</>
  }

  return (
    <StackProvider app={stackClientApp}>
      <StackTheme>
        {children}
      </StackTheme>
    </StackProvider>
  )
}
