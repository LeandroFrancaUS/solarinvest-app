// src/app/Providers.tsx
import type { ReactNode } from 'react'
import { StackProvider, StackTheme, SignIn, useUser } from '@stack-auth/react'
import { stackClientApp } from '../stack/client'

function AuthGate({ children }: { children: ReactNode }) {
  const user = useUser()

  if (!user) {
    return <SignIn fullPage={true} automaticRedirect={true} firstTab="password" />
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
