// src/auth/guards/RequireAuth.tsx
// Renders children only if the user is authenticated via Stack Auth.
// Shows the sign-in form if not authenticated.
// Falls back gracefully if Stack Auth is not configured.

import React, { type ReactNode, Suspense, useEffect, useRef, useState } from 'react'
import { useUser, SignIn } from '@stackframe/react'
import { stackClientApp } from '../stack-client'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

/** How long to wait for the Stack Auth SDK to resolve useUser() before giving up. */
const STACK_INIT_TIMEOUT_MS = 15_000

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

function StackInitErrorScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-sm text-center">
        <p className="mb-2 text-lg font-semibold text-slate-700">Falha ao iniciar autenticação</p>
        <p className="mb-6 text-sm text-slate-500">
          O serviço de login demorou para responder. Verifique sua conexão e recarregue a página.
        </p>
        <button
          onClick={() => { window.location.reload() }}
          className="rounded-lg bg-amber-500 px-6 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          Recarregar
        </button>
      </div>
    </div>
  )
}

/**
 * Suspense fallback that owns the STACK_INIT_TIMEOUT_MS watchdog.
 *
 * The Stack Auth SDK's useUser() hook may suspend (via React's use()) while it
 * validates the user's session over the network.  Without a <Suspense> boundary
 * the suspension propagates to the nearest error boundary, which shows
 * "Falhou ao renderizar".  This component is used as the fallback so the spinner
 * is shown during suspension, and a timed-out state shows the error screen if the
 * SDK never resolves within STACK_INIT_TIMEOUT_MS.
 */
function SuspendedLoadingFallback() {
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      console.warn('[auth] Stack Auth SDK init timed out after', STACK_INIT_TIMEOUT_MS / 1000, 's')
      setTimedOut(true)
    }, STACK_INIT_TIMEOUT_MS)
    return () => { clearTimeout(timer) }
  }, [])

  if (timedOut) return <StackInitErrorScreen />
  return <LoadingScreen />
}

/**
 * Returns true when the current URL is on the Stack Auth OAuth callback path.
 * The SDK defaults the callback path to /handler/oauth-callback.
 * We match the exact pathname (with or without a trailing slash) to avoid
 * false positives from paths that merely end with "oauth-callback".
 */
function isOAuthCallbackPath(): boolean {
  if (typeof window === 'undefined') return false
  const pathname = window.location.pathname.replace(/\/$/, '')
  // Use the configured oauthCallback path from the SDK; default is /handler/oauth-callback
  const callbackPath = (stackClientApp?.urls.oauthCallback ?? '/handler/oauth-callback').replace(/\/$/, '')
  // callbackPath may be absolute (https://...) — extract just the pathname
  try {
    return pathname === new URL(callbackPath, window.location.origin).pathname.replace(/\/$/, '')
  } catch (e) {
    console.warn('[auth] isOAuthCallbackPath: failed to parse callbackPath', callbackPath, e)
    return pathname === callbackPath
  }
}

/**
 * Handles the OAuth callback after a redirect from the OAuth provider.
 *
 * Without this component, the OAuth tokens are never extracted because the
 * main app renders <SignIn> when user === null — it never calls
 * app.callOAuthCallback() and the user stays stuck on the sign-in page.
 */
function OAuthCallbackHandler() {
  const called = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (called.current || !stackClientApp) return
    called.current = true
    const app = stackClientApp

    app.callOAuthCallback().then((redirected) => {
      if (!redirected) {
        // No OAuth params in the URL (or cookie missing) — go back to sign-in.
        app.redirectToSignIn({ noRedirectBack: true }).catch(() => {
          // Fallback: hard navigate to root if SDK redirect fails.
          window.location.replace('/')
        })
      }
      // If redirected === true, the SDK already navigated the user to afterSignIn.
    }).catch((err: unknown) => {
      console.error('[OAuthCallbackHandler] callOAuthCallback error', err)
      setError(err instanceof Error ? err.message : String(err))
    })
  }, [])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
        <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Erro ao entrar</h1>
          <p className="text-sm text-slate-500">
            Não foi possível completar o login. Por favor, tente novamente.
          </p>
          <button
            className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            onClick={() => { window.location.replace('/') }}
          >
            Voltar ao login
          </button>
        </div>
      </div>
    )
  }

  return <LoadingScreen />
}

/**
 * Inner component that calls useUser().
 *
 * useUser() from @stackframe/react either:
 *   - Returns null  → user is not signed in
 *   - Returns User  → user is signed in
 *   - Suspends      → session validation is in progress (React use() throws a Promise)
 *
 * It NEVER returns undefined.  The parent wraps this component in <Suspense> so
 * suspension is handled gracefully instead of falling through to an error boundary.
 */
function RequireAuthWithStack({ children, fallback }: Props) {
  const user = useUser()

  // While on the OAuth callback path we must process the authorization code
  // BEFORE rendering SignIn, otherwise the tokens are never extracted and the
  // user gets stuck in the sign-in loop.
  if (isOAuthCallbackPath()) {
    return <OAuthCallbackHandler />
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
    // SuspendedLoadingFallback owns the 15 s watchdog timer.
    // If useUser() suspends (session validation in flight), the spinner is shown
    // here instead of propagating to an error boundary.
    <Suspense fallback={<SuspendedLoadingFallback />}>
      <RequireAuthWithStack fallback={fallback}>
        {children}
      </RequireAuthWithStack>
    </Suspense>
  )
}
