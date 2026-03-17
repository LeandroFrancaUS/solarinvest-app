// src/auth/guards/RequireAuthorizedUser.tsx
// Wraps routes that require an approved user. Shows appropriate UI for
// pending / blocked / revoked states.
import type { ReactNode } from "react"
import { useAuthSessionContext } from "../AuthSessionContext"
import { RequireAuth } from "./RequireAuth"
import AccessPendingPage from "../../pages/AccessPendingPage"

interface Props {
  children: ReactNode
}

export function RequireAuthorizedUser({ children }: Props) {
  return (
    <RequireAuth>
      <AuthorizedGate>{children}</AuthorizedGate>
    </RequireAuth>
  )
}

function AuthorizedGate({ children }: Props) {
  const { accessState } = useAuthSessionContext()

  if (accessState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-slate-500">Verificando acesso...</div>
      </div>
    )
  }

  if (accessState === "approved") {
    return <>{children}</>
  }

  // pending, blocked, revoked
  return <AccessPendingPage accessState={accessState} />
}

