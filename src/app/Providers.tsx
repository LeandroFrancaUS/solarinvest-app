// src/app/Providers.tsx
import type { ReactNode } from "react"
import { StackProvider, StackTheme, SignIn } from "@stackframe/stack"
import { stackClientApp } from "../stack/client"

export function Providers({ children }: { children: ReactNode }) {
  // Sem env/config -> mostra tela de instrução
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
            <code>VITE_STACK_PUBLISHABLE_CLIENT_KEY</code>{" "}
            (ou <code>NEXT_PUBLIC_*</code>).
          </p>
        </div>
      </div>
    )
  }

  // ✅ Aqui: deixa o Stack renderizar e gerenciar a auth
  // (Sem useUser até estabilizar o runtime no Vite)
  return (
    <StackProvider app={stackClientApp}>
      <StackTheme>
        {/* Se você quiser forçar login sempre (MVP), deixa o SignIn na frente: */}
        {/* <SignIn fullPage automaticRedirect firstTab="password" /> */}
        {children}
      </StackTheme>
    </StackProvider>
  )
}
