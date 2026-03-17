// src/services/auth/admin-users.ts
// API calls for admin user management endpoints.

import { resolveApiUrl } from '../../utils/apiUrl'
import type { AdminUsersResponse, AccessRole } from '../../lib/auth/access-types'

const BASE = resolveApiUrl('/api/admin/users')

async function post(url: string, body?: unknown): Promise<void> {
  const init: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  const response = await fetch(url, init)
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `Request failed: ${response.status}`)
  }
}

export async function fetchAdminUsers(
  params: { page?: number; limit?: number; search?: string } = {}
): Promise<AdminUsersResponse> {
  const url = new URL(BASE)
  if (params.page) url.searchParams.set('page', String(params.page))
  if (params.limit) url.searchParams.set('limit', String(params.limit))
  if (params.search) url.searchParams.set('search', params.search)

  const response = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(`/api/admin/users returned ${response.status}`)
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
