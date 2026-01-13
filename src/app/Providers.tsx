// src/app/Providers.tsx
import type { ReactNode } from "react"
import { StackProvider, StackTheme, SignIn, useUser } from "@stackframe/stack"
import { stackClientApp } from "../stack/client"

function MissingStackEnv() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
      <div className="max-w-lg space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">Stack Auth não configurado</h1>
        <p className="text-sm text-slate-600">
          Defina <code>VITE_STACK_PROJECT_ID</code> e <code>VITE_STACK_PUBLISHABLE_CLIENT_KEY</code> em{" "}
          <code>.env.local</code> e reinicie o <code>npm run dev</code>.
        </p>
      </div>
    </div>
  )
}

function AuthGate({ children }: { children: ReactNode }) {
  // OBS: o retorno do useUser varia por versão; então fazemos um "normalize" defensivo.
  const state = useUser() as any

  const user = state?.user ?? state?.data?.user ?? null
  const isLoading =
    state?.isLoading === true ||
    state?.loading === true ||
    state?.status === "loading" ||
    state?.status === "pending" ||
    state?.status === "initializing"

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
        <div className="text-sm text-slate-600">Carregando sessão…</div>
      </div>
    )
  }

  if (!user) {
    return <SignIn fullPage={true} automaticRedirect={true} firstTab="password" />
  }

  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  // ✅ Em Vite, as env vars são import.meta.env (não process.env)
  const projectId = import.meta.env.VITE_STACK_PROJECT_ID
  const publishableKey = import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY

  if (!projectId || !publishableKey) {
    return <MissingStackEnv />
  }

  return (
    <StackProvider app={stackClientApp}>
      <StackTheme>
        <AuthGate>{children}</AuthGate>
      </StackTheme>
    </StackProvider>
  )
}
