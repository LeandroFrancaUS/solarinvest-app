// src/services/auth/admin-users.ts
// API calls for admin user management endpoints.

import { resolveApiUrl } from '../../utils/apiUrl'
import type { AdminUsersResponse, AccessRole, StackPermission } from '../../lib/auth/access-types'

const BASE = resolveApiUrl('/api/admin/users')

// ─── Token provider ───────────────────────────────────────────────────────────

type GetAccessToken = () => Promise<string | null>
let adminUsersTokenProvider: GetAccessToken | null = null

/**
 * Register the Stack Auth token provider for the admin users API.
 * Must be called once the authenticated user is available (e.g. in App.tsx).
 */
export function setAdminUsersTokenProvider(fn: GetAccessToken): void {
  adminUsersTokenProvider = fn
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAuthHeader(): Promise<Record<string, string>> {
  if (!adminUsersTokenProvider) return {}
  try {
    const token = await adminUsersTokenProvider()
    if (token) return { Authorization: `Bearer ${token}` }
  } catch {
    // fall back to cookie-only auth
  }
  return {}
}

async function request(url: string, method: string, body?: unknown): Promise<void> {
  const authHeader = await getAuthHeader()
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeader },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  const response = await fetch(url, init)
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `Request failed: ${response.status}`)
  }
}

function post(url: string, body?: unknown): Promise<void> {
  return request(url, 'POST', body)
}

function del(url: string): Promise<void> {
  return request(url, 'DELETE')
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function fetchAdminUsers(
  params: { page?: number; limit?: number; search?: string } = {}
): Promise<AdminUsersResponse> {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.search) qs.set('search', params.search)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''

  const authHeader = await getAuthHeader()
  const response = await fetch(`${BASE}${suffix}`, {
    method: 'GET',
    credentials: 'include',
    headers: { ...authHeader },
  })
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `/api/admin/users returned ${response.status}`)
  }
  return response.json() as Promise<AdminUsersResponse>
}

export function approveUser(id: string): Promise<void> {
  return post(`${BASE}/${id}/approve`)
}

export function blockUser(id: string): Promise<void> {
  return post(`${BASE}/${id}/block`)
}

export function revokeUser(id: string): Promise<void> {
  return post(`${BASE}/${id}/revoke`)
}

export function setUserRole(id: string, role: AccessRole): Promise<void> {
  return post(`${BASE}/${id}/role`, { role })
}

export function grantPermission(id: string, perm: StackPermission): Promise<void> {
  return post(`${BASE}/${id}/permissions/${encodeURIComponent(perm)}`)
}

export function revokePermission(id: string, perm: StackPermission): Promise<void> {
  return del(`${BASE}/${id}/permissions/${encodeURIComponent(perm)}`)
}

export function deleteUser(id: string): Promise<void> {
  return del(`${BASE}/${id}`)
}
