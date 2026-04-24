// REST client for /api/operational-dashboard endpoints.

import { resolveApiUrl } from '../utils/apiUrl'
import type {
  DashboardOperationalTask,
  OperationalTaskStatus,
  OperationalTaskType,
  TaskPriority,
} from '../types/dashboard'

const BASE = '/api/operational-dashboard'

function url(path: string): string {
  return resolveApiUrl(`${BASE}${path}`)
}

export interface KpiSummary {
  active_tasks: number
  blocked_tasks: number
  critical_tasks: number
  completed_tasks: number
  pending_deliveries: number
  pending_installations: number
  open_support_tickets: number
}

export async function fetchKpiSummary(): Promise<KpiSummary> {
  const res = await fetch(url('/kpi'))
  if (!res.ok) throw new Error('Failed to fetch KPI summary')
  const json = await res.json() as { data: KpiSummary }
  return json.data
}

export interface TaskFilters {
  status?: OperationalTaskStatus
  type?: OperationalTaskType
  priority?: TaskPriority
  clientId?: string
}

export async function fetchTasks(filters?: TaskFilters): Promise<DashboardOperationalTask[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.type) params.set('type', filters.type)
  if (filters?.priority) params.set('priority', filters.priority)
  if (filters?.clientId) params.set('clientId', filters.clientId)

  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(url(`/tasks${query}`))
  if (!res.ok) throw new Error('Failed to fetch tasks')
  const json = await res.json() as { data: Record<string, unknown>[] }
  return json.data.map(mapTask)
}

export async function createTask(
  data: Omit<DashboardOperationalTask, 'id' | 'updatedAt'>,
): Promise<DashboardOperationalTask> {
  const res = await fetch(url('/tasks'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create task')
  const json = await res.json() as { data: Record<string, unknown> }
  return mapTask(json.data)
}

export async function updateTask(
  id: string,
  data: Partial<Omit<DashboardOperationalTask, 'id' | 'updatedAt'>>,
): Promise<DashboardOperationalTask> {
  const res = await fetch(url(`/tasks/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update task')
  const json = await res.json() as { data: Record<string, unknown> }
  return mapTask(json.data)
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(url(`/tasks/${id}`), { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete task')
}

function mapTask(row: Record<string, unknown>): DashboardOperationalTask {
  return {
    id: String(row.id ?? ''),
    type: (row.type as DashboardOperationalTask['type']) ?? 'OTHER',
    title: String(row.title ?? ''),
    clientId: row.client_id != null ? String(row.client_id) : undefined,
    clientName: String(row.client_name ?? ''),
    proposalId: row.proposal_id != null ? String(row.proposal_id) : undefined,
    status: (row.status as DashboardOperationalTask['status']) ?? 'NOT_SCHEDULED',
    scheduledFor: (row.scheduled_for as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    blockedReason: (row.blocked_reason as string | null) ?? null,
    responsibleUserId: row.responsible_user_id != null ? String(row.responsible_user_id) : undefined,
    priority: (row.priority as DashboardOperationalTask['priority']) ?? 'MEDIUM',
    notes: row.notes != null ? String(row.notes) : undefined,
    updatedAt: String(row.updated_at ?? ''),
  }
}
