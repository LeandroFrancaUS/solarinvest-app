// src/auth/guards/RequireAuthorizedUser.tsx
// Renders children only if the user is authenticated AND authorized in the internal DB.
// Shows appropriate screens for loading, pending, blocked, and revoked states.

import React, { type ReactNode, createContext, useContext, useCallback } from 'react'
import { useUser } from '@stackframe/react'
import { useAuthSession } from '../auth-session'
import { stackClientApp } from '../stack-client'
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

/**
 * Shared rendering logic for both the Stack-Auth and the bypass-mode paths.
 * Receives an optional token getter that, when provided, is forwarded to
 * `useAuthSession` so that every `/api/auth/me` request carries a fresh
 * `Authorization: Bearer <token>` header.
 */
function RequireAuthorizedUserCore({
  children,
  getAccessToken,
}: Props & { getAccessToken?: (() => Promise<string | null>) | null }) {
  const { authState, accessState, me, refresh } = useAuthSession(getAccessToken)

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

/**
 * Inner component used when Stack Auth IS configured.
 *
 * Called only when we're already inside the <Suspense> + RequireAuthWithStack
 * boundary established by <RequireAuth>, which guarantees:
 *   1. A <StackProvider> is present in the React tree.
 *   2. useUser() has already resolved (does not suspend again here).
 *   3. The user is authenticated — useUser() returns a non-null User object.
 *
 * We call `user.getAccessToken()` to obtain a fresh Stack Auth JWT and forward
 * it to useAuthSession so that every /api/auth/me request includes an
 * `Authorization: Bearer <token>` header.  This prevents the 401 that occurred
 * when the server received no recognisable credential from the client.
 */
function RequireAuthorizedUserWithStack({ children }: Props) {
  const user = useUser()

  // Stable callback — recreated only when the user identity changes.
  // `user.getAccessToken()` automatically refreshes the short-lived JWT when
  // it is about to expire, so we always forward a valid token.
  const getAccessToken = useCallback(
    () => {
      if (!user) {
        console.debug('[auth] getAccessToken called but user is null — returning null')
        return Promise.resolve(null)
      }
      console.debug('[auth] getAccessToken — calling user.getAccessToken() for userId:', user.id)
      return user.getAccessToken()
    },
    [user],
  )

  return (
    <RequireAuthorizedUserCore getAccessToken={getAccessToken}>
      {children}
    </RequireAuthorizedUserCore>
  )
}

export function RequireAuthorizedUser({ children }: Props) {
  if (stackClientApp) {
    // Stack Auth IS configured: RequireAuth guarantees that this component is
    // rendered inside a <StackProvider> and only after the user is authenticated.
    // RequireAuthorizedUserWithStack safely calls useUser() in that context.
    return <RequireAuthorizedUserWithStack>{children}</RequireAuthorizedUserWithStack>
  }

  // Stack Auth NOT configured (dev/bypass mode): proceed without a token getter.
  // The server is expected to allow requests without a Bearer token in this mode
  // (e.g., via STACK_AUTH_BYPASS=true or when stackAuthEnabled is false).
  return <RequireAuthorizedUserCore>{children}</RequireAuthorizedUserCore>
}
