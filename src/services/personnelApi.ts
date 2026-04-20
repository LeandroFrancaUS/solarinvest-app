// src/services/personnelApi.ts
// REST client for /api/consultants, /api/engineers, /api/installers
// CRUD operations for the personnel management feature.

import { apiFetch } from '../app/services/httpClient'
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

// ─────────────────────────────────────────────────────────────────────────────
// Consultants
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchConsultants(activeOnly = false): Promise<Consultant[]> {
  const path = activeOnly ? '/api/consultants?active=true' : '/api/consultants'
  const res = await apiFetch<{ consultants: Consultant[] }>(path)
  return res.consultants ?? []
}

export async function createConsultant(data: CreateConsultantRequest): Promise<Consultant> {
  const res = await apiFetch<{ consultant: Consultant }>(
    '/api/consultants',
    { method: 'POST', body: data },
  )
  return res.consultant
}

export async function updateConsultant(id: number, data: UpdateConsultantRequest): Promise<Consultant> {
  const res = await apiFetch<{ consultant: Consultant }>(
    `/api/consultants/${id}`,
    { method: 'PUT', body: data },
  )
  return res.consultant
}

export async function deactivateConsultant(id: number): Promise<Consultant> {
  const res = await apiFetch<{ consultant: Consultant }>(
    `/api/consultants/${id}/deactivate`,
    { method: 'PATCH' },
  )
  return res.consultant
}

// ─────────────────────────────────────────────────────────────────────────────
// Engineers
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchEngineers(activeOnly = false): Promise<Engineer[]> {
  const path = activeOnly ? '/api/engineers?active=true' : '/api/engineers'
  const res = await apiFetch<{ engineers: Engineer[] }>(path)
  return res.engineers ?? []
}

export async function createEngineer(data: CreateEngineerRequest): Promise<Engineer> {
  const res = await apiFetch<{ engineer: Engineer }>(
    '/api/engineers',
    { method: 'POST', body: data },
  )
  return res.engineer
}

export async function updateEngineer(id: number, data: UpdateEngineerRequest): Promise<Engineer> {
  const res = await apiFetch<{ engineer: Engineer }>(
    `/api/engineers/${id}`,
    { method: 'PUT', body: data },
  )
  return res.engineer
}

export async function deactivateEngineer(id: number): Promise<Engineer> {
  const res = await apiFetch<{ engineer: Engineer }>(
    `/api/engineers/${id}/deactivate`,
    { method: 'PATCH' },
  )
  return res.engineer
}

// ─────────────────────────────────────────────────────────────────────────────
// Installers
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchInstallers(activeOnly = false): Promise<Installer[]> {
  const path = activeOnly ? '/api/installers?active=true' : '/api/installers'
  const res = await apiFetch<{ installers: Installer[] }>(path)
  return res.installers ?? []
}

export async function createInstaller(data: CreateInstallerRequest): Promise<Installer> {
  const res = await apiFetch<{ installer: Installer }>(
    '/api/installers',
    { method: 'POST', body: data },
  )
  return res.installer
}

export async function updateInstaller(id: number, data: UpdateInstallerRequest): Promise<Installer> {
  const res = await apiFetch<{ installer: Installer }>(
    `/api/installers/${id}`,
    { method: 'PUT', body: data },
  )
  return res.installer
}

export async function deactivateInstaller(id: number): Promise<Installer> {
  const res = await apiFetch<{ installer: Installer }>(
    `/api/installers/${id}/deactivate`,
    { method: 'PATCH' },
  )
  return res.installer
}
