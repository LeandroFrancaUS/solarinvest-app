// src/services/projectsApi.ts
// REST client for /api/projects endpoints (introduced in PR 1).
// Mirrors the pattern used by financialManagementApi.ts (timeout, auth headers,
// typed helpers). No localStorage touches — data lives in the DB.

import { resolveApiUrl } from '../utils/apiUrl'
import type { ProjectRow, ProjectPvData, ProjectListFilters, ProjectSummary, ProjectStatus } from '../domain/projects/types'

// ─────────────────────────────────────────────────────────────────────────────
// Auth token provider (injected by App.tsx, same pattern as financial API)
// ─────────────────────────────────────────────────────────────────────────────

type GetAccessToken = () => Promise<string | null>
let tokenProvider: GetAccessToken | null = null
const API_TIMEOUT_MS = 12_000

export function setProjectsTokenProvider(fn: GetAccessToken): void {
  tokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = tokenProvider ? await tokenProvider() : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...(await authHeaders()),
  }
  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal })
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => ({}))
      const msg =
        (body as { error?: { message?: string } })?.error?.message ??
        (typeof (body as { error?: string }).error === 'string'
          ? (body as { error: string }).error
          : `HTTP ${res.status}`)
      throw new Error(msg)
    }
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeoutId)
  }
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const resolved = resolveApiUrl(path)
  const url = new URL(resolved, window.location.origin)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

// ─────────────────────────────────────────────────────────────────────────────
// Response shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectListResponse {
  rows: ProjectRow[]
  meta: { total: number; limit: number; offset: number }
}

export interface ProjectDetailResponse {
  project: ProjectRow
  pv_data: ProjectPvData | null
}

// ─────────────────────────────────────────────────────────────────────────────
// API functions
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchProjects(filters: ProjectListFilters = {}): Promise<ProjectListResponse> {
  const url = buildUrl('/api/projects', {
    search: filters.search,
    project_type: filters.project_type,
    status: filters.status,
    limit: filters.limit,
    offset: filters.offset,
    order_by: filters.order_by,
    order_dir: filters.order_dir,
  })
  const res = await apiFetch<{ data: ProjectRow[]; meta: { total: number; limit: number; offset: number } }>(url)
  return { rows: res.data, meta: res.meta }
}

export async function fetchProjectById(projectId: string): Promise<ProjectDetailResponse> {
  const url = buildUrl(`/api/projects/${encodeURIComponent(projectId)}`)
  const res = await apiFetch<{ data: ProjectRow & { pv_data?: ProjectPvData | null } }>(url)
  const { pv_data, ...project } = res.data
  return { project, pv_data: pv_data ?? null }
}

export async function patchProjectStatus(projectId: string, status: ProjectStatus): Promise<ProjectRow> {
  const url = buildUrl(`/api/projects/${encodeURIComponent(projectId)}/status`)
  const res = await apiFetch<{ data: ProjectRow }>(url, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return res.data
}

export async function patchProjectPvData(
  projectId: string,
  pvData: Partial<Omit<ProjectPvData, 'id' | 'project_id' | 'created_at' | 'updated_at'>>,
): Promise<ProjectPvData> {
  const url = buildUrl(`/api/projects/${encodeURIComponent(projectId)}/pv-data`)
  const res = await apiFetch<{ data: ProjectPvData }>(url, {
    method: 'PATCH',
    body: JSON.stringify(pvData),
  })
  return res.data
}

export async function fetchProjectsSummary(): Promise<ProjectSummary> {
  const url = buildUrl('/api/projects/summary')
  const res = await apiFetch<{ data: ProjectSummary }>(url)
  return res.data
}
