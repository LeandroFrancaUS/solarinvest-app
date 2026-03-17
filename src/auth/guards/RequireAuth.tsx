// src/auth/guards/RequireAuth.tsx
// Renders children only if the user is authenticated via Stack Auth.
// Shows the sign-in form if not authenticated.
// Falls back gracefully if Stack Auth is not configured.

import React, { type ReactNode } from 'react'
import { useUser, SignIn } from '@stackframe/react'
import { stackClientApp } from '../stack-client'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    </div>
  )
}

function RequireAuthWithStack({ children, fallback }: Props) {
  const user = useUser()

  if (user === undefined) {
    return <LoadingScreen />
  }

  if (!user) {
    if (fallback) return <>{fallback}</>
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
        <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-slate-900">SolarInvest</h1>
            <p className="mt-1 text-sm text-slate-500">Faça login para continuar</p>
          </div>
          <SignIn />
          <p className="text-center text-xs text-slate-400">
            Sua sessão é mantida de forma segura. Nenhuma senha é armazenada no navegador.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function RequireAuth({ children, fallback }: Props) {
  if (!stackClientApp) {
    // Stack Auth not configured: allow pass-through (dev/bypass mode)
    return <>{children}</>
  }

  return (
    <RequireAuthWithStack fallback={fallback}>
      {children}
    </RequireAuthWithStack>
  )
}
