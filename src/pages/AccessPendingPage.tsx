// src/pages/AccessPendingPage.tsx
// Shown when the user is authenticated but not authorized in the internal DB.

import React from 'react'
import { useStackApp } from '@stackframe/react'
import { stackClientApp } from '../auth/stack-client'
import { useStackSdkCrashed } from '../app/stack-context'
import { performLogout } from '../lib/auth/logout'
import type { AccessStatus } from '../lib/auth/access-types'
import { accessStatusLabel } from '../lib/auth/access-mappers'

interface Props {
  email?: string | undefined
  accessStatus: AccessStatus | null
}

function titleFor(status: AccessStatus | null): string {
  if (status === 'blocked') return 'Acesso bloqueado'
  if (status === 'revoked') return 'Acesso revogado'
  if (status === 'no_permissions') return 'Perfil sem permissão'
  return 'Acesso pendente'
}

function messageFor(status: AccessStatus | null): string {
  if (status === 'blocked') {
    return 'Seu acesso ao SolarInvest foi bloqueado temporariamente. Entre em contato com o administrador.'
  }
  if (status === 'revoked') {
    return 'Seu acesso ao SolarInvest foi revogado. Entre em contato com o administrador caso acredite que isso foi um engano.'
  }
  if (status === 'no_permissions') {
    return 'Seu perfil ainda não possui uma permissão de acesso. Solicite ao administrador que atribua um papel (Comercial, Office, Financeiro ou Administrador) à sua conta.'
  }
  return 'Seu login foi identificado, mas seu acesso ao sistema ainda não foi liberado. Fale com o administrador da SolarInvest.'
}

function SignOutButton() {
  const app = useStackApp()
  const [signing, setSigning] = React.useState(false)

  const handleSignOut = React.useCallback(() => {
    if (signing) return
    setSigning(true)
    void performLogout(() => app.signOut())
  }, [app, signing])

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signing}
      className="cursor-pointer rounded-lg border border-ds-border bg-ds-ghost-bg px-4 py-2 text-sm font-medium text-ds-text-secondary transition-colors hover:border-ds-primary/40 hover:text-ds-primary focus:outline-none focus:ring-2 focus:ring-ds-primary disabled:opacity-60"
    >
      {signing ? 'Saindo…' : 'Sair'}
    </button>
  )
}

export function AccessPendingScreen({ email, accessStatus }: Props) {
  const stackSdkCrashed = useStackSdkCrashed()
  const title = titleFor(accessStatus)
  const message = messageFor(accessStatus)

  return (
    <div className="flex min-h-screen items-center justify-center bg-ds-background px-6 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-ds-border bg-ds-surface p-8 shadow-lg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ds-warning/15 border border-ds-warning/30">
            <svg className="h-6 w-6 text-ds-warning" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-ds-text-primary">{title}</h1>
          {email && (
            <p className="mt-1 text-sm text-ds-text-muted">{email}</p>
          )}
          {accessStatus && (
            <span className="mt-2 inline-block rounded-full bg-ds-warning/15 border border-ds-warning/30 px-2.5 py-0.5 text-xs font-medium text-ds-warning">
              {accessStatusLabel(accessStatus)}
            </span>
          )}
        </div>

        <p className="text-center text-sm text-ds-text-secondary">{message}</p>

        <div className="flex justify-center">
          {stackClientApp && !stackSdkCrashed ? (
            <SignOutButton />
          ) : (
            <p className="text-xs text-ds-text-muted">Auth não configurado</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AccessPendingPage() {
  return <AccessPendingScreen accessStatus={null} />
}
