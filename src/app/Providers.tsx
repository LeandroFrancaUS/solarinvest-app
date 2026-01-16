// src/app/Providers.tsx
import type { ReactNode } from "react"
import React, { useEffect } from "react"
import { StackProvider, useStackApp, useUser } from "@stackframe/react"
import { stackClientApp } from "../stack/client"

function NotConfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
      <div className="max-w-lg space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">
          Stack Auth não configurado
        </h1>
        <p className="text-sm text-slate-600">
          Defina <code>VITE_STACK_PROJECT_ID</code> e{" "}
          <code>VITE_STACK_PUBLISHABLE_CLIENT_KEY</code> em <code>.env.local</code>{" "}
          e reinicie <code>npm run dev</code>.
        </p>
      </div>
    </div>
  )
}

function AuthGate({ children }: { children: ReactNode }) {
  const app = useStackApp()
  // Use the hook from StackProvider context - it handles loading states automatically
  const user = useUser({ or: 'return-null' })

  // Handle OAuth callback redirect
  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Check if we're returning from an OAuth callback
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.has('code') && urlParams.has('state')) {
        console.log('[Stack Auth] Handling OAuth callback...')
        try {
          await app.redirectToOAuthCallback()
          console.log('[Stack Auth] OAuth callback handled successfully')
        } catch (error) {
          console.error('[Stack Auth] Failed to handle OAuth callback:', error)
        }
      }
    }

    handleOAuthCallback()
  }, [app])

  // Add debug logging
  useEffect(() => {
    console.log('[Stack Auth] User state:', user === undefined ? 'loading' : user === null ? 'not authenticated' : 'authenticated')
  }, [user])

  // While user is undefined (still loading), show loading state
  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
        <div className="max-w-lg space-y-3">
          <p className="text-sm text-slate-600">Carregando sessão…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
        <div className="max-w-lg space-y-4">
          <h1 className="text-2xl font-semibold text-slate-900">Entrar</h1>
          <p className="text-sm text-slate-600">
            Faça login para acessar o SolarInvest App.
          </p>

          <button
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={async () => {
              try {
                console.log('[Stack Auth] Starting OAuth sign-in...')
                // Use the correct method from Stack React SDK
                await app.signInWithOAuth("google")
              } catch (error) {
                console.error("[Stack Auth] Failed to sign in:", error)
              }
            }}
          >
            Entrar com Google
          </button>

          <p className="text-xs text-slate-500 mt-4">
            Configure os métodos de autenticação no Stack Auth Dashboard
          </p>
        </div>
      </div>
    )
  }

  console.log('[Stack Auth] User authenticated, rendering app')
  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  const stackAuthBypass = true

  if (stackAuthBypass) {
    return <>{children}</>
  }

  if (!stackClientApp) return <NotConfigured />

  return (
    <StackProvider app={stackClientApp}>
      <AuthGate>{children}</AuthGate>
    </StackProvider>
  )
}
