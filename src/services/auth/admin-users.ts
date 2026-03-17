// src/services/auth/admin-users.ts
import type { AdminUsersResponse } from "../../lib/auth/access-types"

export async function fetchAdminUsers(params?: {
  page?: number
  perPage?: number
  search?: string
}): Promise<AdminUsersResponse | null> {
  try {
    const url = new URL("/admin/users", window.location.origin)
    if (params?.page) url.searchParams.set("page", String(params.page))
    if (params?.perPage) url.searchParams.set("per_page", String(params.perPage))
    if (params?.search) url.searchParams.set("search", params.search)

    const res = await fetch(url.toString(), { credentials: "include" })
    if (!res.ok) return null
    return (await res.json()) as AdminUsersResponse
  } catch {
    return null
  }
}

export async function approveUser(userId: string): Promise<boolean> {
  return postAction(userId, "approve")
}

export async function blockUser(userId: string): Promise<boolean> {
  return postAction(userId, "block")
}

export async function revokeUser(userId: string): Promise<boolean> {
  return postAction(userId, "revoke")
}

export async function changeUserRole(
  userId: string,
  role: "admin" | "manager" | "user",
): Promise<boolean> {
  try {
    const res = await fetch(`/admin/users/${userId}/role`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function postAction(userId: string, action: string): Promise<boolean> {
  try {
    const res = await fetch(`/admin/users/${userId}/${action}`, {
      method: "POST",
      credentials: "include",
    })
    return res.ok
  } catch {
    return false
  }
}
