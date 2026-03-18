// src/auth/guards/RequireAdmin.tsx
// Renders children only if the user has admin role with approved access.

import React, { type ReactNode } from 'react'
import { useAppAuth } from './RequireAuthorizedUser'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

export function RequireAdmin({ children, fallback }: Props) {
  const { me } = useAppAuth()

  if (!me?.authorized || me.role !== 'admin') {
    if (fallback) return <>{fallback}</>
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Acesso Restrito</h1>
          <p className="text-sm text-slate-600">
            Esta área é exclusiva para administradores.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
