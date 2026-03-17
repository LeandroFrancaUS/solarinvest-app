// src/auth/guards/RequireAuth.tsx
// Shows the login page when the user is not authenticated.
import type { ReactNode } from "react"
import { useAuthSessionContext } from "../AuthSessionContext"
import SignInPage from "../../pages/SignInPage"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

export function RequireAuth({ children, fallback }: Props) {
  const { authState } = useAuthSessionContext()

  if (authState === "loading") {
    return (
      fallback ?? (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-sm text-slate-500">Carregando...</div>
        </div>
      )
    )
  }

  if (authState === "anonymous") {
    return <SignInPage />
  }

  return <>{children}</>
}

