// src/app/Providers.tsx
import type { ReactNode } from 'react'
import { StackProvider, StackTheme, useStackApp } from '@stackframe/stack'
import { stackClientApp } from '../stack/client'

function AuthGate({ children }: { children: ReactNode }) {
  const stack = useStackApp()

  // Em alguns setups, o stack pode demorar a hidratar
  // Se tiver um estado de loading no seu SDK, use ele aqui.
  const user = stack?.useUser?.() // alguns builds expõem assim
  // fallback: se não existir hook, só não bloqueia (mas normalmente existe)

  // Se o hook existir e não tiver user, mostra login
  if (typeof user !== 'undefined' && !user) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Entrar</h2>
        <p>Você precisa fazer login para acessar o app.</p>
        {/* SignIn oficial */}
        <stack.SignIn fullPage={false} automaticRedirect={true} firstTab="password" />
      </div>
    )
  }

  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StackProvider app={stackClientApp}>
      <StackTheme>
        <AuthGate>{children}</AuthGate>
      </StackTheme>
    </StackProvider>
  )
}
