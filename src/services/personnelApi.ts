// src/services/personnelApi.ts
// REST client for /api/consultants, /api/engineers, /api/installers
// CRUD operations for the personnel management feature.

import { resolveApiUrl } from '../utils/apiUrl'
import type {
  Consultant,
  Engineer,
  Installer,
  CreateConsultantRequest,
  UpdateConsultantRequest,
  CreateEngineerRequest,
  UpdateEngineerRequest,
  CreateInstallerRequest,
  UpdateInstallerRequest,
} from '../types/personnel'

type GetAccessToken = () => Promise<string | null>
let personnelTokenProvider: GetAccessToken | null = null

export function setPersonnelTokenProvider(fn: GetAccessToken): void {
  personnelTokenProvider = fn
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = personnelTokenProvider ? await personnelTokenProvider() : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...(await authHeaders()),
  }
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}))
    const msg = (body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

// ─────────────────────────────────────────────────────────────────────────────
// Consultants
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchConsultants(activeOnly = false): Promise<Consultant[]> {
  const url = new URL(resolveApiUrl('/api/consultants'), window.location.origin)
  if (activeOnly) url.searchParams.set('active', 'true')
  const res = await apiFetch<{ consultants: Consultant[] }>(url.toString())
  return res.consultants ?? []
}

export async function createConsultant(data: CreateConsultantRequest): Promise<Consultant> {
  const res = await apiFetch<{ consultant: Consultant }>(
    resolveApiUrl('/api/consultants'),
    { method: 'POST', body: JSON.stringify(data) },
  )
  return res.consultant
}

export async function updateConsultant(id: number, data: UpdateConsultantRequest): Promise<Consultant> {
  const res = await apiFetch<{ consultant: Consultant }>(
    resolveApiUrl(`/api/consultants/${id}`),
    { method: 'PUT', body: JSON.stringify(data) },
  )
  return res.consultant
}

export async function deactivateConsultant(id: number): Promise<Consultant> {
  const res = await apiFetch<{ consultant: Consultant }>(
    resolveApiUrl(`/api/consultants/${id}/deactivate`),
    { method: 'PATCH' },
  )
  return res.consultant
}

// ─────────────────────────────────────────────────────────────────────────────
// Engineers
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchEngineers(activeOnly = false): Promise<Engineer[]> {
  const url = new URL(resolveApiUrl('/api/engineers'), window.location.origin)
  if (activeOnly) url.searchParams.set('active', 'true')
  const res = await apiFetch<{ engineers: Engineer[] }>(url.toString())
  return res.engineers ?? []
}

export async function createEngineer(data: CreateEngineerRequest): Promise<Engineer> {
  const res = await apiFetch<{ engineer: Engineer }>(
    resolveApiUrl('/api/engineers'),
    { method: 'POST', body: JSON.stringify(data) },
  )
  return res.engineer
}

export async function updateEngineer(id: number, data: UpdateEngineerRequest): Promise<Engineer> {
  const res = await apiFetch<{ engineer: Engineer }>(
    resolveApiUrl(`/api/engineers/${id}`),
    { method: 'PUT', body: JSON.stringify(data) },
  )
  return res.engineer
}

export async function deactivateEngineer(id: number): Promise<Engineer> {
  const res = await apiFetch<{ engineer: Engineer }>(
    resolveApiUrl(`/api/engineers/${id}/deactivate`),
    { method: 'PATCH' },
  )
  return res.engineer
}

// ─────────────────────────────────────────────────────────────────────────────
// Installers
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchInstallers(activeOnly = false): Promise<Installer[]> {
  const url = new URL(resolveApiUrl('/api/installers'), window.location.origin)
  if (activeOnly) url.searchParams.set('active', 'true')
  const res = await apiFetch<{ installers: Installer[] }>(url.toString())
  return res.installers ?? []
}

export async function createInstaller(data: CreateInstallerRequest): Promise<Installer> {
  const res = await apiFetch<{ installer: Installer }>(
    resolveApiUrl('/api/installers'),
    { method: 'POST', body: JSON.stringify(data) },
  )
  return res.installer
}

export async function updateInstaller(id: number, data: UpdateInstallerRequest): Promise<Installer> {
  const res = await apiFetch<{ installer: Installer }>(
    resolveApiUrl(`/api/installers/${id}`),
    { method: 'PUT', body: JSON.stringify(data) },
  )
  return res.installer
}

export async function deactivateInstaller(id: number): Promise<Installer> {
  const res = await apiFetch<{ installer: Installer }>(
    resolveApiUrl(`/api/installers/${id}/deactivate`),
    { method: 'PATCH' },
  )
  return res.installer
}
