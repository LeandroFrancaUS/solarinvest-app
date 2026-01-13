// src/app/Providers.tsx
import type { ReactNode } from "react"
import { StackProvider, StackTheme, SignIn, useUser } from "@stackframe/stack"
import { stackClientApp } from "../stack/client"

function AuthGate({ children }: { children: ReactNode }) {
  /**
   * IMPORTANTE:
   * useUser() NÃO retorna diretamente o usuário.
   * Ele retorna um estado que pode estar:
   * - loading / pending
   * - com user
   * - sem user
   */
  const state = useUser() as any

  const user = state?.user ?? state?.data?.user ?? null

  const isLoading =
    state?.isLoading === true ||
    state?.loading === true ||
    state?.status === "loading" ||
    state?.status === "pending"

  // 🔒 Enquanto o Stack inicializa token/session
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
        <div className="text-sm text-slate-600">Carregando sessão…</div>
      </div>
    )
  }

  // 🔐 Não autenticado → SignIn
  if (!user) {
    return <SignIn fullPage={true} automaticRedirect={true} firstTab="password" />
  }

  // ✅ Autenticado
  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  // Segurança extra: se o client não inicializou
  if (!stackClientApp) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
        <div className="max-w-lg space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            Stack Auth não configurado
          </h1>
          <p className="text-sm text-slate-600">
            Defina as variáveis{" "}
            <code>VITE_STACK_PROJECT_ID</code> e{" "}
            <code>VITE_STACK_PUBLISHABLE_CLIENT_KEY</code>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <StackProvider app={stackClientApp}>
      <StackTheme>
        <AuthGate>{children}</AuthGate>
      </StackTheme>
    </StackProvider>
  )
}
