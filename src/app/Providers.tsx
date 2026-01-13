// src/app/Providers.tsx
import type { ReactNode } from "react"
import { StackProvider, StackTheme, SignIn, useUser } from "@stackframe/stack"
import { stackClientApp } from "../stack/client"

type UnknownRecord = Record<string, unknown>

function getUserFromState(state: unknown) {
  const s = state as UnknownRecord | null

  // tenta state.user
  const user = (s?.user as UnknownRecord | null) ?? null
  if (user) return user

  // tenta state.data.user
  const data = (s?.data as UnknownRecord | null) ?? null
  const userFromData = (data?.user as UnknownRecord | null) ?? null
  if (userFromData) return userFromData

  return null
}

function isLoadingState(state: unknown) {
  const s = state as UnknownRecord | null

  const isLoading =
    s?.isLoading === true ||
    s?.loading === true ||
    s?.status === "loading" ||
    s?.status === "pending"

  return Boolean(isLoading)
}

function AuthGate({ children }: { children: ReactNode }) {
  const state = useUser()

  const user = getUserFromState(state)
  const isLoading = isLoadingState(state)

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
