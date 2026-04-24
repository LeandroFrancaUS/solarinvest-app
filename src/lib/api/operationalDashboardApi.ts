// src/lib/api/operationalDashboardApi.ts
// API client for operational dashboard endpoints
import type {
  DashboardOperationalTask,
  DashboardNotificationPreference,
  DashboardActivityEvent,
} from '../../types/operationalDashboard.js'

let tokenProvider: (() => Promise<string>) | null = null

export function setOperationalDashboardTokenProvider(provider: () => Promise<string>) {
  tokenProvider = provider
}

async function getAuthHeaders(): Promise<HeadersInit> {
  if (!tokenProvider) {
    return {}
  }
  const token = await tokenProvider()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface ListTasksParams {
  clientId?: number
  type?: string
  status?: string
  priority?: string
  responsibleUserId?: string
  scheduledBefore?: string
  scheduledAfter?: string
  limit?: number
}

export async function listOperationalTasks(params?: ListTasksParams): Promise<{
  data: DashboardOperationalTask[]
}> {
  const searchParams = new URLSearchParams()
  if (params?.clientId) searchParams.set('client_id', String(params.clientId))
  if (params?.type) searchParams.set('type', params.type)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.priority) searchParams.set('priority', params.priority)
  if (params?.responsibleUserId) searchParams.set('responsible_user_id', params.responsibleUserId)
  if (params?.scheduledBefore) searchParams.set('scheduled_before', params.scheduledBefore)
  if (params?.scheduledAfter) searchParams.set('scheduled_after', params.scheduledAfter)
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const url = `/api/operational-tasks${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const headers = await getAuthHeaders()

  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`Failed to list operational tasks: ${response.statusText}`)
  }
  return response.json()
}

export async function createOperationalTask(
  data: Partial<DashboardOperationalTask>
): Promise<{ data: DashboardOperationalTask }> {
  const headers = {
    ...(await getAuthHeaders()),
    'Content-Type': 'application/json',
  }

  const response = await fetch('/api/operational-tasks', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`Failed to create operational task: ${response.statusText}`)
  }
  return response.json()
}

export async function updateOperationalTask(
  taskId: string | number,
  patch: Partial<DashboardOperationalTask>
): Promise<{ data: DashboardOperationalTask }> {
  const headers = {
    ...(await getAuthHeaders()),
    'Content-Type': 'application/json',
  }

  const response = await fetch(`/api/operational-tasks/${taskId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  })

  if (!response.ok) {
    throw new Error(`Failed to update operational task: ${response.statusText}`)
  }
  return response.json()
}

export async function deleteOperationalTask(taskId: string | number): Promise<{ data: { success: boolean } }> {
  const headers = await getAuthHeaders()

  const response = await fetch(`/api/operational-tasks/${taskId}`, {
    method: 'DELETE',
    headers,
  })

  if (!response.ok) {
    throw new Error(`Failed to delete operational task: ${response.statusText}`)
  }
  return response.json()
}

export async function getTaskHistory(
  taskId: string | number,
  limit?: number
): Promise<{ data: DashboardActivityEvent[] }> {
  const url = `/api/operational-tasks/${taskId}/history${limit ? `?limit=${limit}` : ''}`
  const headers = await getAuthHeaders()

  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`Failed to get task history: ${response.statusText}`)
  }
  return response.json()
}

export async function getNotificationPreferences(): Promise<{ data: DashboardNotificationPreference }> {
  const headers = await getAuthHeaders()

  const response = await fetch('/api/dashboard/notification-preferences', { headers })
  if (!response.ok) {
    throw new Error(`Failed to get notification preferences: ${response.statusText}`)
  }
  return response.json()
}

export async function updateNotificationPreferences(
  prefs: Partial<DashboardNotificationPreference>
): Promise<{ data: DashboardNotificationPreference }> {
  const headers = {
    ...(await getAuthHeaders()),
    'Content-Type': 'application/json',
  }

  const response = await fetch('/api/dashboard/notification-preferences', {
    method: 'POST',
    headers,
    body: JSON.stringify(prefs),
  })

  if (!response.ok) {
    throw new Error(`Failed to update notification preferences: ${response.statusText}`)
  }
  return response.json()
}
