// src/auth/guards/RequireAdmin.tsx
// Wraps routes that require an approved admin user.
import type { ReactNode } from "react"
import { useAuthSessionContext } from "../AuthSessionContext"
import { RequireAuthorizedUser } from "./RequireAuthorizedUser"

interface Props {
  children: ReactNode
}

export function RequireAdmin({ children }: Props) {
  return (
    <RequireAuthorizedUser>
      <AdminGate>{children}</AdminGate>
    </RequireAuthorizedUser>
  )
}

function AdminGate({ children }: Props) {
  const { me } = useAuthSessionContext()

  if (me?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-slate-900">Acesso restrito</h1>
          <p className="text-sm text-slate-600">
            Esta área é exclusiva para administradores do sistema.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

