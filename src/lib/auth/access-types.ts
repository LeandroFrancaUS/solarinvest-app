// src/lib/auth/access-types.ts

export type UserRole = 'admin' | 'manager' | 'user'

export type AccessStatus = 'pending' | 'approved' | 'revoked' | 'blocked'

export type AuthState = 'loading' | 'anonymous' | 'authenticated'

export type AccessState = 'loading' | 'approved' | 'pending' | 'blocked' | 'revoked'

export interface MeResponse {
  authenticated: boolean
  authorized: boolean
  role: UserRole | null
  accessStatus: AccessStatus | null
  user: {
    id: string
    email: string
    fullName: string | null
    providerUserId: string
    stackEmail: string
  } | null
}

export interface AppUserAccess {
  id: string
  auth_provider_user_id: string
  email: string
  full_name: string | null
  role: UserRole
  access_status: AccessStatus
  is_active: boolean
  can_access_app: boolean
  last_login_at: string | null
  created_at: string
}

export interface AdminUsersResponse {
  users: AppUserAccess[]
  total: number
  page: number
  perPage: number
}
