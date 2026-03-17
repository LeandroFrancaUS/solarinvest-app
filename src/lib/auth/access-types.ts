// src/lib/auth/access-types.ts
// Types for the internal authorization system (separate from authentication).

export type AccessRole = 'admin' | 'manager' | 'user'

export type AccessStatus = 'pending' | 'approved' | 'revoked' | 'blocked'

export type AuthState = 'loading' | 'anonymous' | 'authenticated'

export type AccessState = 'loading' | 'approved' | 'pending' | 'blocked' | 'revoked'

export interface AppUserAccess {
  id: string
  email: string
  fullName: string | null
  role: AccessRole
  accessStatus: AccessStatus
  isActive: boolean
  canAccessApp: boolean
}

export interface MeResponse {
  authenticated: boolean
  authorized: boolean
  role: AccessRole | null
  accessStatus: AccessStatus | null
  isActive?: boolean
  canAccessApp?: boolean
  email?: string
  fullName?: string | null
  id?: string
}

export interface AdminUser {
  id: string
  auth_provider_user_id: string
  email: string
  full_name: string | null
  role: AccessRole
  access_status: AccessStatus
  is_active: boolean
  can_access_app: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface AdminUsersResponse {
  users: AdminUser[]
  total: number
  page: number
  limit: number
  pages: number
}
