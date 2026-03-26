// src/auth/guards/RequireAuth.tsx
// Renders children only if the user is authenticated via Stack Auth.
// Shows the sign-in form if not authenticated.
// Falls back gracefully if Stack Auth is not configured.

import React, { type ReactNode, Suspense, useEffect, useRef, useState } from 'react'
import { useUser, SignIn } from '@stackframe/react'
import { stackClientApp } from '../stack-client'
import { clearLogoutMarker, isLogoutMarkerActive } from '../../lib/auth/logoutMarker'

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
 *
 * This app uses the Stack Auth PKCE flow (Model B):
 *   1. signInWithOAuth() → user → Google → api.stack-auth.com/oauth/callback/google
 *      (Stack Auth's hosted endpoint processes the Google code — Model A)
 *   2. Stack Auth redirects to /handler/oauth-callback?code=<stack-code>&state=<state>
 *      (our local SPA route — Model B)
 *   3. OAuthCallbackHandler calls callOAuthCallback() to exchange the Stack code
 *      for access+refresh tokens (PKCE code verifier stored in cookie)
 *   4. Tokens stored in cookies; user redirected to afterSignIn ("/")
 *
 * Both steps are necessary and not in conflict.  The "hosted" endpoint on
 * api.stack-auth.com handles Google↔StackAuth exchange; our local handler
 * handles the StackAuth↔app PKCE exchange.
 *
 * ⚠ If Stack Auth returns HTTP 400 at its own /oauth/callback/google, the
 *   redirect_uri (https://<domain>/handler/oauth-callback) is not registered in
 *   the Stack Auth project settings.  Register it there — no code change is needed
 *   for that specific fix.
 */

function LogoutRecoveryScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="text-sm text-slate-500">Finalizando logout...</p>
      </div>
    </div>
  )
}

function isOAuthCallbackPath(): boolean {
  if (typeof window === 'undefined') return false
  const pathname = window.location.pathname.replace(/\/$/, '')
  const callbackPath = (stackClientApp?.urls.oauthCallback ?? '/handler/oauth-callback').replace(/\/$/, '')
  try {
    return pathname === new URL(callbackPath, window.location.origin).pathname.replace(/\/$/, '')
  } catch {
    return pathname === callbackPath
  }
}

/**
 * Handles the local half of the Stack Auth PKCE OAuth callback.
 *
 * After api.stack-auth.com processes the Google response it redirects to
 * /handler/oauth-callback?code=<stack-code>&state=<state>.  This component
 * exchanges that code for tokens via callOAuthCallback().
 *
 * Without this handler the authorization code would expire unused and the
 * user would remain unauthenticated.
 */
function OAuthCallbackHandler() {
  const called = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (called.current || !stackClientApp) return
    called.current = true
    const app = stackClientApp

    if (import.meta.env.DEV) console.debug('[OAuthCallbackHandler] processing PKCE callback at', window.location.pathname)

    app.callOAuthCallback().then((redirected) => {
      if (!redirected) {
        // No valid OAuth params in the URL (cookie expired, reloaded page, etc.).
        // Navigate back to the sign-in page; noRedirectBack avoids adding
        // after_auth_return_to which would contaminate the next OAuth redirect_uri.
        console.warn('[OAuthCallbackHandler] no OAuth params — redirecting to sign-in')
        app.redirectToSignIn({ noRedirectBack: true }).catch(() => {
          window.location.replace('/')
        })
      } else if (import.meta.env.DEV) {
        console.debug('[OAuthCallbackHandler] callOAuthCallback succeeded — redirected')
      }
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
  const [logoutRecoveryInFlight, setLogoutRecoveryInFlight] = useState(false)
  const logoutMarkerActive = isLogoutMarkerActive()

  useEffect(() => {
    if (!user || !logoutMarkerActive || logoutRecoveryInFlight) {
      if (!user && logoutMarkerActive) {
        clearLogoutMarker()
      }
      return
    }

    let cancelled = false
    setLogoutRecoveryInFlight(true)

    const recoverLogout = async () => {
      try {
        await Promise.race([
          user.signOut({ redirectUrl: '/' }),
          new Promise<void>((resolve) => setTimeout(resolve, 2200)),
        ])
      } catch {
        // non-fatal; we still clear marker and reload to break loops
      } finally {
        clearLogoutMarker()
        if (!cancelled) {
          window.location.replace('/')
        }
      }
    }

    void recoverLogout()

    return () => {
      cancelled = true
    }
  }, [logoutMarkerActive, logoutRecoveryInFlight, user])

  if (logoutRecoveryInFlight || (user && logoutMarkerActive)) {
    return <LogoutRecoveryScreen />
  }

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
