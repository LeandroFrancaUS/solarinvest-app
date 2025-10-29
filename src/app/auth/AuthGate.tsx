import React from 'react'
import { useAuth } from './AuthProvider'
import { LoginForm } from './LoginForm'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth()

  if (status === 'loading') {
    return (
      <div className="auth-loading">
        <p>Carregando segurança…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  return <>{children}</>
}
