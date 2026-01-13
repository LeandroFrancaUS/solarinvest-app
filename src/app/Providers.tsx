// src/app/Providers.tsx
import type { ReactNode } from "react"
import React from "react"
import { StackProvider } from "@stackframe/react"
import { stackClientApp } from "../stack/client"

function NotConfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
      <div className="max-w-lg space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">
          Stack Auth não configurado
        </h1>
        <p className="text-sm text-slate-600">
          Defina <code>VITE_STACK_PROJECT_ID</code> e{" "}
          <code>VITE_STACK_PUBLISHABLE_CLIENT_KEY</code> em <code>.env.local</code>{" "}
          e reinicie <code>npm run dev</code>.
        </p>
      </div>
    </div>
  )
}

function AuthGate({ children }: { children: ReactNode }) {
  // Se seu SDK expõe hook tipo useUser/useSession, usamos.
  // No @stackframe/react isso existe no provider.
  const user = stackClientApp?.useUser?.()

  // Enquanto o SDK resolve sessão (depende do SDK), evita piscar:
  const isLoading = user === undefined

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
        <div className="max-w-lg space-y-3">
          <p className="text-sm text-slate-600">Carregando sessão…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
        <div className="max-w-lg space-y-4">
          <h1 className="text-2xl font-semibold text-slate-900">Entrar</h1>
          <p className="text-sm text-slate-600">
            Faça login para acessar o SolarInvest App.
          </p>

          <button
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => {
              // fluxos comuns do SDK:
              // - signInWithRedirect()
              // - signIn()
              // - openSignIn()
              // A gente tenta os nomes mais comuns sem quebrar build.
              const anyApp = stackClientApp as any
              anyApp?.signInWithRedirect?.()
              anyApp?.signIn?.()
              anyApp?.openSignIn?.()
            }}
          >
            Entrar
          </button>

          <p className="text-xs text-slate-500">
            Se nada acontecer ao clicar, me mande o conteúdo do seu
            <code>node_modules/@stackframe/react</code> exports (ou o erro do console)
            que eu ajusto o método exato.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  if (!stackClientApp) return <NotConfigured />

  return (
    <StackProvider app={stackClientApp}>
      <AuthGate>{children}</AuthGate>
    </StackProvider>
  )
}
