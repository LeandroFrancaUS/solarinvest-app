// src/app/Providers.tsx
import type { ReactNode } from "react"
import { StackProvider, SignIn } from "@stackframe/stack"
import { stackClientApp } from "../stack/client"

export function Providers({ children }: { children: ReactNode }) {
  if (!stackClientApp) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
        <div className="max-w-lg space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            Stack Auth não configurado
          </h1>
          <p className="text-sm text-slate-600">
            Defina <code>VITE_STACK_PROJECT_ID</code> e{" "}
            <code>VITE_STACK_PUBLISHABLE_CLIENT_KEY</code> em <code>.env.local</code>
            e reinicie o <code>npm run dev</code>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <StackProvider app={stackClientApp}>
      {/* MVP: força login; depois trocamos por gate/rotas e liberamos {children} */}
      <SignIn fullPage automaticRedirect firstTab="password" />
      {/* {children} */}
    </StackProvider>
  )
}
