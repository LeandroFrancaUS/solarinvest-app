// src/app/Providers.tsx
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { StackProvider, StackTheme, SignIn, useUser } from '@stackframe/stack'
import { createStackClientApp, isStackConfigured } from '../stack/client'

function AuthGate({ children }: { children: ReactNode }) {
  const user = useUser()

  if (!user) {
    return <SignIn fullPage={true} automaticRedirect={true} firstTab="password" />
  }

  return <>{children}</>
}

function AuthGateWrapper({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  if (!enabled) {
    return <>{children}</>
  }

  return <AuthGate>{children}</AuthGate>
}

export function Providers({ children }: { children: ReactNode }) {
  const stackClientApp = useMemo(() => createStackClientApp(), [])

  if (!isStackConfigured || !stackClientApp) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
        <div className="max-w-lg space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900">Configuração do Stack Auth ausente</h1>
          <p className="text-sm text-slate-600">
            Defina as variáveis <code>VITE_STACK_PROJECT_ID</code> e{' '}
            <code>VITE_STACK_PUBLISHABLE_CLIENT_KEY</code> no ambiente para inicializar o login.
          </p>
        </div>
      </div>
    )
  }

  return (
    <StackProvider app={stackClientApp}>
      <StackTheme>
        <AuthGateWrapper enabled={Boolean(stackClientApp)}>{children}</AuthGateWrapper>
      </StackTheme>
    </StackProvider>
  )
}
