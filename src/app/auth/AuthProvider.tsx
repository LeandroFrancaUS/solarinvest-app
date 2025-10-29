import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { apiFetch, type ApiError } from '../services/httpClient'

export type UserRole = 'ADMIN' | 'DIRETOR' | 'INTEGRADOR'

export interface AuthenticatedUser {
  id: string
  email: string
  role: UserRole
  mfaEnabled: boolean
}

export interface LoginResult {
  success: boolean
  error?: string
  mfaRequired?: boolean
  challengeId?: string
  methods?: string[]
}

interface AuthContextValue {
  user: AuthenticatedUser | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  login: (email: string, password: string, totp?: string) => Promise<LoginResult>
  verifyMfa: (challengeId: string, code: string) => Promise<LoginResult>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  refreshUser: () => Promise<void>
  canAccess: (permission: Permission) => boolean
  inviteUser: (input: InviteInput) => Promise<{ token: string }>
  requestPasswordReset: (email: string) => Promise<{ token?: string }>
  resetPassword: (token: string, password: string) => Promise<void>
}

export type Permission =
  | 'admin.users'
  | 'settings'
  | 'crm'
  | 'vendas'
  | 'leasing'
  | 'reports'

interface InviteInput {
  email: string
  role: UserRole
}

const PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: ['admin.users', 'settings', 'crm', 'vendas', 'leasing', 'reports'],
  DIRETOR: ['settings', 'crm', 'vendas', 'leasing', 'reports'],
  INTEGRADOR: ['vendas', 'leasing'],
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiFetch<{ user: AuthenticatedUser }>('/auth/me', { method: 'GET', skipCsrf: true })
      if (response?.user) {
        setUser(response.user)
        setStatus('authenticated')
      } else {
        setUser(null)
        setStatus('unauthenticated')
      }
    } catch (error) {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  React.useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const login = useCallback(
    async (email: string, password: string, totp?: string): Promise<LoginResult> => {
      try {
        const response = await apiFetch<{
          user?: AuthenticatedUser
          mfaRequired?: boolean
          challengeId?: string
          methods?: string[]
        }>('/auth/login', {
          method: 'POST',
          body: { email, password, totp },
          skipCsrf: true,
        })
        if (response.mfaRequired && response.challengeId) {
          return {
            success: false,
            mfaRequired: true,
            challengeId: response.challengeId,
            methods: response.methods,
          }
        }
        if (response.user) {
          setUser(response.user)
          setStatus('authenticated')
          return { success: true }
        }
        return { success: false, error: 'Resposta inesperada do servidor.' }
      } catch (error) {
        const apiError = error as ApiError
        return { success: false, error: apiError.message }
      }
    },
    [],
  )

  const verifyMfa = useCallback(
    async (challengeId: string, code: string): Promise<LoginResult> => {
      try {
        const response = await apiFetch<{ user?: AuthenticatedUser }>('/auth/mfa/verify', {
          method: 'POST',
          body: { challengeId, code },
          skipCsrf: true,
        })
        if (response.user) {
          setUser(response.user)
          setStatus('authenticated')
          return { success: true }
        }
        return { success: false, error: 'Resposta inesperada do servidor.' }
      } catch (error) {
        const apiError = error as ApiError
        return { success: false, error: apiError.message }
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  const logoutAll = useCallback(async () => {
    try {
      await apiFetch('/auth/logout-all', { method: 'POST' })
    } finally {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  const inviteUser = useCallback(async ({ email, role }: InviteInput) => {
    const response = await apiFetch<{ token: string }>('/auth/invite', {
      method: 'POST',
      body: { email, role },
    })
    return response
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const response = await apiFetch<{ token?: string }>('/auth/password/forgot', {
      method: 'POST',
      body: { email },
      skipCsrf: true,
    })
    return response
  }, [])

  const resetPassword = useCallback(async (token: string, password: string) => {
    await apiFetch('/auth/password/reset', {
      method: 'POST',
      body: { token, password },
      skipCsrf: true,
    })
  }, [])

  const canAccess = useCallback(
    (permission: Permission) => {
      if (!user) return false
      const allowed = PERMISSIONS[user.role] ?? []
      return allowed.includes(permission)
    },
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login,
      verifyMfa,
      logout,
      logoutAll,
      refreshUser,
      canAccess,
      inviteUser,
      requestPasswordReset,
      resetPassword,
    }),
    [
      user,
      status,
      login,
      verifyMfa,
      logout,
      logoutAll,
      refreshUser,
      canAccess,
      inviteUser,
      requestPasswordReset,
      resetPassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return ctx
}
