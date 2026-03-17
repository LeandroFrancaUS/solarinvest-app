// src/pages/SignInPage.tsx
// Login page with email/password and Google sign-in via Stack Auth.

import React from 'react'
import { stackClientApp } from '../auth/stack-client'
import { StackProvider, SignIn } from '@stackframe/react'

function StackSignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          </div>
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

export default function SignInPage() {
  if (!stackClientApp) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
        <div className="max-w-lg space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900">Carregando...</h1>
          <p className="text-sm text-slate-600">Você será redirecionado automaticamente.</p>
        </div>
      </div>
    )
  }

  return (
    <StackProvider app={stackClientApp}>
      <StackSignInPage />
    </StackProvider>
  )
}
