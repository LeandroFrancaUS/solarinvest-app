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

interface Props {
  children: ReactNode
}

export function RequireAuthorizedUser({ children }: Props) {
  const { authState, accessState, me, refresh } = useAuthSession()

  if (authState === 'loading' || accessState === 'loading') {
    return <LoadingScreen />
  }

  if (authState === 'anonymous') {
    // Not authenticated — let RequireAuth handle the redirect
    return <>{children}</>
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
