// src/auth/guards/RequireAuthorizedUser.tsx
// Renders children only if the user is authenticated AND authorized in the internal DB.
// Shows appropriate screens for loading, pending, blocked, and revoked states.

import React, { type ReactNode, createContext, useContext } from 'react'
import { useAuthSession } from '../auth-session'
import type { MeResponse } from '../../lib/auth/access-types'
import { AccessPendingScreen } from '../../pages/AccessPendingPage'

interface AuthContextValue {
  me: MeResponse | null
  refresh: () => void
}

const AuthContext = createContext<AuthContextValue>({ me: null, refresh: () => {} })

export function useAppAuth(): AuthContextValue {
  return useContext(AuthContext)
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="text-sm text-slate-500">Verificando acesso...</p>
      </div>
    </div>
  )
}

function ServerErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-sm text-center">
        <p className="mb-2 text-lg font-semibold text-slate-700">Serviço temporariamente indisponível</p>
        <p className="mb-6 text-sm text-slate-500">
          Não foi possível verificar seu acesso. Verifique sua conexão e tente novamente.
        </p>
        <button
          onClick={onRetry}
          className="rounded-lg bg-amber-500 px-6 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}

interface Props {
  children: ReactNode
}

export function RequireAuthorizedUser({ children }: Props) {
  const { authState, accessState, me, refresh } = useAuthSession()

  // Two-phase loading check:
  //   1. authState === 'loading': /api/auth/me hasn't responded yet
  //   2. authState === 'error': repeated failures — show error screen with retry
  //   3. authState === 'anonymous': server confirmed unauthenticated — let RequireAuth show sign-in
  //   4. accessState === 'loading': authenticated but DB authorization record is still being fetched
  if (authState === 'loading') {
    return <LoadingScreen />
  }

  if (authState === 'error') {
    return <ServerErrorScreen onRetry={refresh} />
  }

  if (authState === 'anonymous') {
    // Not authenticated — let RequireAuth handle the sign-in form.
    return <>{children}</>
  }

  if (accessState === 'loading') {
    return <LoadingScreen />
  }

  if (accessState !== 'approved') {
    const pendingEmail: string | undefined = me?.email
    return (
      <AccessPendingScreen
        email={pendingEmail}
        accessStatus={me?.accessStatus ?? null}
      />
    )
  }

  return (
    <AuthContext.Provider value={{ me, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
