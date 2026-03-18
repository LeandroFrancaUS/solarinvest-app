// src/pages/AccessPendingPage.tsx
// Shown when the user is authenticated but not authorized in the internal DB.

import React from 'react'
import { useStackApp } from '@stackframe/react'
import { stackClientApp } from '../auth/stack-client'
import type { AccessStatus } from '../lib/auth/access-types'
import { accessStatusLabel } from '../lib/auth/access-mappers'

interface Props {
  email?: string | undefined
  accessStatus: AccessStatus | null
}

function titleFor(status: AccessStatus | null): string {
  if (status === 'blocked') return 'Acesso bloqueado'
  if (status === 'revoked') return 'Acesso revogado'
  return 'Acesso pendente'
}

function messageFor(status: AccessStatus | null): string {
  if (status === 'blocked') {
    return 'Seu acesso ao SolarInvest foi bloqueado temporariamente. Entre em contato com o administrador.'
  }
  if (status === 'revoked') {
    return 'Seu acesso ao SolarInvest foi revogado. Entre em contato com o administrador caso acredite que isso foi um engano.'
  }
  return 'Seu login foi identificado, mas seu acesso ao sistema ainda não foi liberado. Fale com o administrador da SolarInvest.'
}

function SignOutButton() {
  const app = useStackApp()
  return (
    <button
      type="button"
      onClick={() => { void app.signOut() }}
      className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
    >
      Sair
    </button>
  )
}

export function AccessPendingScreen({ email, accessStatus }: Props) {
  const title = titleFor(accessStatus)
  const message = messageFor(accessStatus)

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {email && (
            <p className="mt-1 text-sm text-slate-500">{email}</p>
          )}
          {accessStatus && (
            <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              {accessStatusLabel(accessStatus)}
            </span>
          )}
        </div>

        <p className="text-center text-sm text-slate-600">{message}</p>

        <div className="flex justify-center">
          {stackClientApp ? (
            <SignOutButton />
          ) : (
            <p className="text-xs text-slate-400">Auth não configurado</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AccessPendingPage() {
  return <AccessPendingScreen accessStatus={null} />
}
